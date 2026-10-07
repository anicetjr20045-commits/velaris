#!/usr/bin/env python3
"""
Velaris AI Daemon (High-Performance Resident AI Service)
=========================================================
Exposes an OpenAI-compatible /v1/chat/completions endpoint on http://127.0.0.1:4041
Powered by warm resident Antigravity CLI processes running Gemini 3.8 Flash (Low).

Key Features:
- 100% Free & Unlimited (0€ API cost, no external API keys needed).
- Production-grade OpenAI Chat Completion specification (/v1/chat/completions, /v1/models, /health).
- WhatsApp / WAHA ready: Plug-and-play for webhooks and bots using session_key / conversationId.
- Pre-warmed resident session pool with zero cross-talk between prospects.
- Sub-3s response latency with auto-recovery and memory management.
"""

import sys
import os
import json
import time
import subprocess
import threading
import signal
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

PORT = int(os.environ.get("VELARIS_AI_PORT", "4041"))
MODEL_NAME = "gemini-3.8-flash-low"
ALIAS_MODEL = "velaris-sales-v1"
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNTIME_DIR = os.path.join(PROJECT_DIR, "scratch", "runtime")
os.makedirs(RUNTIME_DIR, exist_ok=True)

# Ensure /root/.local/bin is in PATH for agy
if "/root/.local/bin" not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"/root/.local/bin:{os.environ.get('PATH', '')}"


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handles requests in separate threads for non-blocking concurrency."""
    daemon_threads = True


class AgyWorker:
    """Manages a resident Antigravity CLI subprocess running Gemini Flash."""

    def __init__(self, model: str = MODEL_NAME):
        self.model = model
        self.proc = None
        self.lock = threading.Lock()
        self.conversation_id = None
        self.turn_count = 0
        self.last_message_count = 0
        self.created_at = time.time()
        self.last_active = time.time()
        self._start_worker()

    def _start_worker(self):
        cmd = [
            "agy",
            "--model", self.model,
            "--effort", "low",
            "--input-format", "stream-json",
            "--output-format", "stream-json",
            "--dangerously-skip-permissions",
            "--disable-slash-commands"
        ]
        self.proc = subprocess.Popen(
            cmd,
            cwd=RUNTIME_DIR,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        # Read init event emitted by agy (plain loop to prevent stream buffering issues)
        init_start = time.time()
        while time.time() - init_start < 25:
            line = self.proc.stdout.readline()
            if not line:
                if self.proc.poll() is not None:
                    break
                time.sleep(0.04)
                continue
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if data.get("event") == "init":
                    self.conversation_id = data.get("conversation_id")
                    break
            except Exception:
                continue

    def is_alive(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def kill(self):
        if self.proc:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=2)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
            self.proc = None

    def query(self, prompt: str, timeout: int = 40) -> tuple[str, int]:
        with self.lock:
            if not self.is_alive():
                print("[Worker] Subprocess not alive, starting fresh worker...")
                self._start_worker()

            payload = {"event": "user", "message": {"content": prompt}}
            try:
                self.proc.stdin.write(json.dumps(payload) + "\n")
                self.proc.stdin.flush()
            except Exception as e:
                print(f"[Worker] Write error: {e}, recycling worker...")
                self._start_worker()
                self.proc.stdin.write(json.dumps(payload) + "\n")
                self.proc.stdin.flush()

            start_t = time.time()
            response_text = ""
            total_tokens = 0

            while time.time() - start_t < timeout:
                line = self.proc.stdout.readline()
                if not line:
                    if self.proc.poll() is not None:
                        raise RuntimeError("Agy worker process terminated unexpectedly.")
                    time.sleep(0.04)
                    continue

                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)
                    evt = data.get("event")
                    if evt == "result":
                        res = data.get("result", {})
                        if res.get("status") == "ERROR":
                            err_msg = res.get("error", "Unknown agy error")
                            raise RuntimeError(f"Agy execution error: {err_msg}")
                        response_text = res.get("response", "")
                        total_tokens = res.get("usage", {}).get("total_tokens", 0)
                        break
                except json.JSONDecodeError:
                    continue

            if not response_text and time.time() - start_t >= timeout:
                print("[Worker] Timeout reached, terminating worker...")
                self.kill()
                raise TimeoutError("Agy response timed out.")

            self.last_active = time.time()
            return response_text.strip(), total_tokens


class WorkerPool:
    """Manages active session workers and maintains a warm standby worker."""

    def __init__(self):
        self.active_workers: dict[str, AgyWorker] = {}
        self.standby_worker: AgyWorker | None = None
        self.pool_lock = threading.Lock()
        self.start_time = time.time()
        self._replenish_thread = threading.Thread(target=self._standby_loop, daemon=True)
        self._replenish_thread.start()
        self._cleaner_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleaner_thread.start()

    def _standby_loop(self):
        """Maintains at least one warm standby worker in RAM."""
        while True:
            time.sleep(1.5)
            with self.pool_lock:
                if self.standby_worker is None or not self.standby_worker.is_alive():
                    try:
                        t0 = time.time()
                        w = AgyWorker()
                        if w.is_alive():
                            self.standby_worker = w
                            print(f"[Pool] Standby warm worker ready in {round(time.time()-t0, 2)}s.")
                    except Exception as e:
                        print(f"[Pool] Standby worker init error: {e}")

    def _cleanup_loop(self):
        """Cleans up inactive sessions every 60 seconds (inactivity > 15 min)."""
        while True:
            time.sleep(60)
            now = time.time()
            with self.pool_lock:
                to_prune = []
                for key, worker in self.active_workers.items():
                    if now - worker.last_active > 900:  # 15 minutes
                        to_prune.append(key)
                for key in to_prune:
                    print(f"[Pool] Pruning expired session {key} (inactive > 15m).")
                    w = self.active_workers.pop(key, None)
                    if w:
                        w.kill()

    def _take_standby(self) -> AgyWorker:
        w = None
        with self.pool_lock:
            if self.standby_worker and self.standby_worker.is_alive():
                w = self.standby_worker
                self.standby_worker = None
        if w is None:
            print("[Pool] Standby not ready, spawning worker synchronously...")
            w = AgyWorker()
        return w

    def get_worker(self, session_key: str, message_count: int) -> AgyWorker:
        with self.pool_lock:
            worker = self.active_workers.get(session_key)

        if worker and worker.is_alive():
            # If conversation was cleared or restarted
            if message_count <= 2 or message_count < worker.last_message_count:
                print(f"[Pool] Session {session_key} reset detected. Re-assigning warm worker.")
                worker.kill()
                worker = self._take_standby()
                with self.pool_lock:
                    self.active_workers[session_key] = worker
            return worker

        print(f"[Pool] Assigning worker to session: {session_key}")
        worker = self._take_standby()
        with self.pool_lock:
            self.active_workers[session_key] = worker

        # Limit maximum active sessions to 6 to preserve VPS RAM
        with self.pool_lock:
            if len(self.active_workers) > 6:
                sorted_sessions = sorted(
                    self.active_workers.items(),
                    key=lambda item: item[1].last_active
                )
                excess = len(self.active_workers) - 6
                for key, old_w in sorted_sessions[:excess]:
                    print(f"[Pool] Evicting oldest session: {key}")
                    old_w.kill()
                    del self.active_workers[key]

        return worker

    def shutdown(self):
        with self.pool_lock:
            if self.standby_worker:
                self.standby_worker.kill()
            for key, w in self.active_workers.items():
                w.kill()
            self.active_workers.clear()


pool = WorkerPool()


class VelarisAIHandler(BaseHTTPRequestHandler):
    """OpenAI-compatible HTTP request handler."""

    def _send_json(self, status_code: int, data: dict):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ["/health", "/", "/v1/health"]:
            standby_ready = pool.standby_worker is not None and pool.standby_worker.is_alive()
            uptime = int(time.time() - pool.start_time)
            self._send_json(200, {
                "status": "healthy",
                "service": "velaris-ai-daemon",
                "version": "1.0.0",
                "port": PORT,
                "model": MODEL_NAME,
                "alias": ALIAS_MODEL,
                "cost": "0€ (Illimité)",
                "uptime_seconds": uptime,
                "active_sessions": list(pool.active_workers.keys()),
                "standby_ready": standby_ready
            })
        elif path in ["/v1/models", "/models"]:
            created_ts = int(pool.start_time)
            self._send_json(200, {
                "object": "list",
                "data": [
                    {
                        "id": MODEL_NAME,
                        "object": "model",
                        "created": created_ts,
                        "owned_by": "velaris-studio"
                    },
                    {
                        "id": ALIAS_MODEL,
                        "object": "model",
                        "created": created_ts,
                        "owned_by": "velaris-studio"
                    }
                ]
            })
        else:
            self._send_json(404, {"error": {"message": f"Endpoint not found: {path}", "type": "invalid_request_error"}})

    def do_POST(self):
        path = self.path.split("?")[0]
        if path not in ["/v1/chat/completions", "/chat/completions"]:
            self._send_json(404, {"error": {"message": f"Endpoint not found: {path}", "type": "invalid_request_error"}})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            data = json.loads(body_bytes.decode("utf-8"))
        except Exception as e:
            self._send_json(400, {"error": {"message": f"Invalid JSON body: {str(e)}", "type": "invalid_request_error"}})
            return

        messages = data.get("messages", [])
        if not messages:
            self._send_json(400, {"error": {"message": "Field 'messages' is required and must not be empty", "type": "invalid_request_error"}})
            return

        # Determine session key (WhatsApp phone / conversationId / user)
        session_key = (
            data.get("conversationId") or
            data.get("session_id") or
            data.get("user") or
            "velaris_default"
        )
        if "::" in session_key:
            session_key = session_key.split("::")[-1]

        # Extract system prompt and user/assistant messages
        system_content = next((m.get("content", "") for m in messages if m.get("role") == "system"), "").strip()
        chat_turns = [m for m in messages if m.get("role") in ["user", "assistant"]]

        last_user_turn = next((m for m in reversed(messages) if m.get("role") == "user"), None)
        last_user_content = last_user_turn.get("content", "").strip() if last_user_turn else ""

        worker = pool.get_worker(session_key, len(messages))

        # Format prompt according to session state
        if worker.turn_count == 0 or len(chat_turns) <= 2:
            formatted_prompt = ""
            if system_content:
                formatted_prompt += f"[DIRECTIVES COMMERCIALES DU STUDIO VELARIS]\n{system_content}\n\n"

            # Reconstruct recent conversation context
            formatted_prompt += "[HISTORIQUE DE LA CONVERSATION]\n"
            for turn in chat_turns:
                role_label = "Client" if turn.get("role") == "user" else "Conseiller Velaris"
                formatted_prompt += f"{role_label}: {turn.get('content', '').strip()}\n"

            formatted_prompt += (
                "\n[INSTRUCTION D'EXÉCUTION COMMERCIALE]\n"
                "Incarne avec respect et bienveillance ton rôle de Conseiller Commercial Velaris sur WhatsApp. "
                "Applique scrupuleusement les 4 invariants du brief et les directives du studio. "
                "Rédige une réponse fluide, chaleureuse et sobre, sans méta-commentaire, avec une seule question à la fois."
            )
        else:
            # Resident turn: worker already holds system & history in memory!
            formatted_prompt = (
                f"Client: {last_user_content}\n\n"
                "[CONSIGNE COMMERCIALE VELARIS]\n"
                "Réponds directement au client selon les directives du studio Velaris. "
                "Concision, respect, zéro méta-commentaire, une seule question à la fois."
            )

        try:
            t0 = time.time()
            reply_text, tokens = worker.query(formatted_prompt)
            latency = round(time.time() - t0, 3)
            worker.turn_count += 1
            worker.last_message_count = len(messages)
            print(f"[Daemon] [{session_key}] Turn #{worker.turn_count} completed in {latency}s ({len(reply_text)} chars, {tokens} tokens)")

            # Clean any accidental outer quotes or markdown code blocks
            reply_clean = reply_text.strip()
            if reply_clean.startswith("```") and reply_clean.endswith("```"):
                lines = reply_clean.split("\n")
                if len(lines) >= 3:
                    reply_clean = "\n".join(lines[1:-1]).strip()

            openai_response = {
                "id": f"chatcmpl-velaris-{int(time.time() * 1000)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": data.get("model") or MODEL_NAME,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": reply_clean
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": len(reply_clean.split()),
                    "total_tokens": tokens or len(reply_clean.split())
                }
            }
            self._send_json(200, openai_response)

        except Exception as e:
            print(f"[Daemon] Error on query for session {session_key}: {e}")
            self._send_json(500, {
                "error": {
                    "message": f"Velaris AI Engine error: {str(e)}",
                    "type": "server_error"
                }
            })


def run_daemon():
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadedHTTPServer(server_address, VelarisAIHandler)
    print(f"============================================================")
    print(f"🚀 Velaris AI Daemon démarré avec succès !")
    print(f"📡 Écoute sur : http://127.0.0.1:{PORT}")
    print(f"💎 Modèle : {MODEL_NAME} (Alias : {ALIAS_MODEL})")
    print(f"💰 Coût API : 0€ (Illimité & Résident)")
    print(f"============================================================")

    def handle_signal(sig, frame):
        print("\n[Daemon] Arrêt propre du pool et des workers...")
        pool.shutdown()
        httpd.server_close()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        handle_signal(None, None)


if __name__ == "__main__":
    run_daemon()
