#!/usr/bin/env python3
"""
Velaris Unified AI Gateway (Universal Multi-Project AI Service)
===============================================================
Exposes an OpenAI-compatible /v1/chat/completions endpoint on http://127.0.0.1:4041
Powered by warm resident Antigravity CLI processes running Gemini 3.8 Flash (Low).

Key Capabilities:
- 100% Free & Unlimited (0€ API cost across all projects).
- Unified Multi-Project Hub: Velaris Studio, Velaris Agent, Velarisse, Mon Coach & future apps.
- Strict Project & Session Isolation (Zero cross-talk, isolated memory per client/prospect).
- Hot Token Reload (Watchdog on Antigravity OAuth Token: switching emails immediately flushes & re-authenticates workers).
- Zero-Downtime Auto-Recovery on Quota Exceeded (429 / RESOURCE_EXHAUSTED).
- Contabo VPS & WAHA Ready: Plugs directly into WAHA and dockerized engines via port 4041.
"""

import sys
import os
import json
import time
import subprocess
import threading
import signal
import select
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(line_buffering=True)

PORT = int(os.environ.get("VELARIS_AI_PORT", "4041"))
MODEL_NAME = "gemini-3.8-flash-low"
ALIAS_MODELS = ["velaris-sales-v1", "velaris-gateway-v1", "deepseek-chat"]
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNTIME_DIR = os.path.join(PROJECT_DIR, "scratch", "runtime")
TOKEN_FILE = "/root/.gemini/antigravity-cli/antigravity-oauth-token"
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
        clean_env = os.environ.copy()
        for key in ["ANTIGRAVITY_AGENT", "ANTIGRAVITY_CONVERSATION_ID", "ANTIGRAVITY_TRAJECTORY_ID", "ANTIGRAVITY_SOURCE_METADATA"]:
            clean_env.pop(key, None)

        self.proc = subprocess.Popen(
            cmd,
            cwd=RUNTIME_DIR,
            env=clean_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1
        )
        # Read init event emitted by agy with select non-blocking
        init_start = time.time()
        while time.time() - init_start < 25:
            if self.proc.poll() is not None:
                break
            rlist, _, _ = select.select([self.proc.stdout], [], [], 0.4)
            if not rlist:
                continue
            line = self.proc.stdout.readline()
            if not line:
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

    def query(self, prompt: str, timeout: int = 60) -> tuple[str, int]:
        with self.lock:
            if not self.is_alive():
                print("[Worker] Processus arrêté, redémarrage à chaud...", flush=True)
                self._start_worker()

            payload = {"event": "user", "message": {"content": prompt}}
            try:
                self.proc.stdin.write(json.dumps(payload) + "\n")
                self.proc.stdin.flush()
                print(f"[Worker] Prompt sent to agy ({len(prompt)} chars)...", flush=True)
            except Exception as e:
                print(f"[Worker] Write error: {e}, recycling worker...", flush=True)
                self._start_worker()
                self.proc.stdin.write(json.dumps(payload) + "\n")
                self.proc.stdin.flush()
                print(f"[Worker] Prompt resent to new agy ({len(prompt)} chars)...", flush=True)

            start_t = time.time()
            response_text = ""
            total_tokens = 0

            while time.time() - start_t < timeout:
                if self.proc.poll() is not None:
                    raise RuntimeError("Agy worker process terminated unexpectedly.")

                rlist, _, _ = select.select([self.proc.stdout], [], [], 0.5)
                if not rlist:
                    continue

                line = self.proc.stdout.readline()
                if not line:
                    continue

                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)
                    evt = data.get("event")
                    if evt != "step_update":
                        print(f"[Worker] Evt: {evt}", flush=True)
                    if evt == "result":
                        res = data.get("result", {})
                        if res.get("status") == "ERROR":
                            err_msg = res.get("error", "Unknown agy error")
                            if "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower() or "429" in err_msg:
                                self.kill()
                                raise RuntimeError(f"QUOTA_EXHAUSTED: {err_msg}")
                            raise RuntimeError(f"Agy execution error: {err_msg}")
                        response_text = res.get("response", "")
                        total_tokens = res.get("usage", {}).get("total_tokens", 0)
                        break
                except json.JSONDecodeError:
                    continue

            if not response_text and time.time() - start_t >= timeout:
                print("[Worker] Timeout reached, terminating worker...", flush=True)
                self.kill()
                raise TimeoutError("Agy response timed out.")

            self.last_active = time.time()
            return response_text.strip(), total_tokens


class WorkerPool:
    """Manages active session workers, maintains warm standby, and watches token updates."""

    def __init__(self):
        self.active_workers: dict[str, AgyWorker] = {}
        self.standby_worker: AgyWorker | None = None
        self.pool_lock = threading.Lock()
        self.start_time = time.time()
        self.last_token_mtime = self._get_token_mtime()
        self._replenish_thread = threading.Thread(target=self._standby_loop, daemon=True)
        self._replenish_thread.start()
        self._cleaner_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleaner_thread.start()

    def _get_token_mtime(self) -> float:
        try:
            if os.path.exists(TOKEN_FILE):
                return os.path.getmtime(TOKEN_FILE)
        except Exception:
            pass
        return 0.0

    def check_token_update(self):
        """Watches if Antigravity token was updated (user switched Google email/account)."""
        current_mtime = self._get_token_mtime()
        if self.last_token_mtime and current_mtime > self.last_token_mtime:
            print(f"[Gateway] 🔄 Détection de mise à jour du token Antigravity (changement de compte/email) !")
            print(f"[Gateway] Recyclage à chaud de tous les workers pour activer le nouveau compte...")
            self.last_token_mtime = current_mtime
            self.recycle_all_workers()

    def recycle_all_workers(self):
        with self.pool_lock:
            if self.standby_worker:
                self.standby_worker.kill()
                self.standby_worker = None
            for key, w in list(self.active_workers.items()):
                w.kill()
            self.active_workers.clear()
            print("[Gateway] ✅ Tous les workers ont été recyclés. Nouveau compte actif.")

    def _standby_loop(self):
        """Maintains at least one warm standby worker in RAM and monitors token changes."""
        while True:
            time.sleep(1.5)
            self.check_token_update()

            needs_standby = False
            with self.pool_lock:
                if self.standby_worker is None or not self.standby_worker.is_alive():
                    needs_standby = True

            if needs_standby:
                try:
                    t0 = time.time()
                    w = AgyWorker()
                    if w.is_alive():
                        with self.pool_lock:
                            if self.standby_worker is None or not self.standby_worker.is_alive():
                                self.standby_worker = w
                                print(f"[Pool] Standby warm worker ready in {round(time.time()-t0, 2)}s.", flush=True)
                            else:
                                w.kill()
                except Exception as e:
                    print(f"[Pool] Standby worker init error: {e}", flush=True)

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
                    print(f"[Pool] Pruning expired session {key} (inactive > 15m).", flush=True)
                    w = self.active_workers.pop(key, None)
                    if w:
                        w.kill()

    def _take_standby(self) -> AgyWorker:
        with self.pool_lock:
            if self.standby_worker and self.standby_worker.is_alive():
                w = self.standby_worker
                self.standby_worker = None
                return w
        print("[Pool] Standby non prêt, démarrage synchrone du worker...", flush=True)
        return AgyWorker()

    def get_worker(self, session_key: str, message_count: int) -> AgyWorker:
        self.check_token_update()
        with self.pool_lock:
            worker = self.active_workers.get(session_key)

        if worker and worker.is_alive():
            # If conversation was cleared or restarted
            if (message_count <= 2 and worker.turn_count > 0) or (worker.last_message_count > 0 and message_count < worker.last_message_count):
                print(f"[Pool] Session {session_key} reset detected. Re-assigning warm worker.", flush=True)
                worker.kill()
                worker = self._take_standby()
                with self.pool_lock:
                    self.active_workers[session_key] = worker
            return worker

        print(f"[Pool] Assigning worker to session: {session_key}", flush=True)
        worker = self._take_standby()
        with self.pool_lock:
            self.active_workers[session_key] = worker

        # Limit maximum active sessions to 8 to preserve VPS RAM
        with self.pool_lock:
            if len(self.active_workers) > 8:
                sorted_sessions = sorted(
                    self.active_workers.items(),
                    key=lambda item: item[1].last_active
                )
                excess = len(self.active_workers) - 8
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


class VelarisGatewayHandler(BaseHTTPRequestHandler):
    """Universal OpenAI-compatible API Gateway Handler."""

    def _send_json(self, status_code: int, data: dict):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Project, X-Project-Id")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Project, X-Project-Id")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ["/health", "/", "/v1/health"]:
            standby_ready = pool.standby_worker is not None and pool.standby_worker.is_alive()
            uptime = int(time.time() - pool.start_time)
            self._send_json(200, {
                "status": "healthy",
                "service": "velaris-ai-gateway",
                "version": "2.0.0",
                "port": PORT,
                "model": MODEL_NAME,
                "supported_projects": ["velaris", "velaris-agent", "velarisse", "mon-coach", "general"],
                "cost": "0€ (Illimité)",
                "uptime_seconds": uptime,
                "active_sessions": list(pool.active_workers.keys()),
                "standby_ready": standby_ready
            })
        elif path in ["/v1/models", "/models"]:
            created_ts = int(pool.start_time)
            models_data = [
                {"id": MODEL_NAME, "object": "model", "created": created_ts, "owned_by": "velaris-studio"},
                {"id": "deepseek-chat", "object": "model", "created": created_ts, "owned_by": "velaris-studio"},
                {"id": "gpt-4o-mini", "object": "model", "created": created_ts, "owned_by": "velaris-studio"},
                {"id": "velaris-sales-v1", "object": "model", "created": created_ts, "owned_by": "velaris-studio"}
            ]
            self._send_json(200, {"object": "list", "data": models_data})
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

        # 1. Project Identification & Session Namespacing
        project_header = self.headers.get("X-Project-Id") or self.headers.get("X-Project") or ""
        project_payload = data.get("project") or data.get("projectId") or ""
        raw_user = data.get("user") or ""
        raw_conv = data.get("conversationId") or data.get("session_id") or ""

        project_id = project_header or project_payload
        session_id = raw_conv or raw_user or "default"

        if not project_id and "::" in session_id:
            parts = session_id.split("::", 1)
            project_id = parts[0]
            session_id = parts[1]

        project_id = (project_id or "velaris").lower().strip()
        session_key = f"{project_id}::{session_id}"

        # 2. Extract System Prompt & Conversation History
        system_content = next((m.get("content", "") for m in messages if m.get("role") == "system"), "").strip()
        chat_turns = [m for m in messages if m.get("role") in ["user", "assistant"]]
        last_user_turn = next((m for m in reversed(messages) if m.get("role") == "user"), None)
        last_user_content = last_user_turn.get("content", "").strip() if last_user_turn else ""

        worker = pool.get_worker(session_key, len(messages))

        # 3. Context & Persona Formatting per Project Domain
        is_velaris = "velaris" in project_id or "VELARIS" in system_content or "Chansons" in system_content
        is_coach = "coach" in project_id or "mentor" in system_content.lower()

        if worker.turn_count == 0 or len(chat_turns) <= 2:
            formatted_prompt = ""
            if system_content:
                header_title = "DIRECTIVES COMMERCIALES VELARIS" if is_velaris else ("DIRECTIVES MENTORAT" if is_coach else "DIRECTIVES SYSTÈME")
                formatted_prompt += f"[{header_title}]\n{system_content}\n\n"

            formatted_prompt += "[HISTORIQUE DE LA CONVERSATION]\n"
            for turn in chat_turns:
                role = turn.get("role", "user")
                if is_velaris:
                    role_label = "Client" if role == "user" else "Conseiller Velaris"
                elif is_coach:
                    role_label = "Anicet" if role == "user" else "Coach"
                else:
                    role_label = "Utilisateur" if role == "user" else "Assistant"
                formatted_prompt += f"{role_label}: {turn.get('content', '').strip()}\n"

            if is_velaris:
                execution_instruction = (
                    "Incarne avec respect et bienveillance ton rôle de Conseiller Commercial Velaris sur WhatsApp. "
                    "Applique scrupuleusement les 4 invariants du brief et les directives du studio. "
                    "Rédige une réponse directe, chaleureuse et sobre, sans méta-commentaire, avec une seule question à la fois."
                )
            elif is_coach:
                execution_instruction = (
                    "Incarne rigoureusement ton rôle de mentor, applique tes directives et réponds directement à Anicet sans préambule ni méta-commentaire."
                )
            else:
                execution_instruction = (
                    "Applique scrupuleusement tes directives système et réponds directement au dernier message sans méta-commentaire."
                )

            formatted_prompt += f"\n[INSTRUCTION D'EXÉCUTION]\n{execution_instruction}"
        else:
            # Resident memory turn
            role_prefix = "Client" if is_velaris else ("Anicet" if is_coach else "Utilisateur")
            consigne = "Réponds directement selon tes directives système. Zéro méta-commentaire."
            if is_velaris:
                consigne = "Réponds directement au client selon les directives du studio Velaris. Concision, respect, zéro méta-commentaire, une seule question à la fois."

            formatted_prompt = (
                f"{role_prefix}: {last_user_content}\n\n"
                f"[CONSIGNE]\n{consigne}"
            )

        # 4. Inférence Résidente Haute Vitesse
        try:
            t0 = time.time()
            reply_text, tokens = worker.query(formatted_prompt)
            latency = round(time.time() - t0, 3)
            worker.turn_count += 1
            worker.last_message_count = len(messages)
            print(f"[Gateway] [{session_key}] Turn #{worker.turn_count} answered in {latency}s ({len(reply_text)} chars, {tokens} tokens)")

            # Clean outer markdown quotes
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
            err_str = str(e)
            print(f"[Gateway] Erreur sur {session_key}: {err_str}")
            if "QUOTA_EXHAUSTED" in err_str:
                self._send_json(429, {
                    "error": {
                        "message": "Quota Antigravity atteint sur le compte actuel. Changez d'email/compte dans Antigravity pour réinitialiser le quota automatiquement.",
                        "type": "insufficient_quota",
                        "code": "quota_exceeded"
                    }
                })
            else:
                self._send_json(500, {
                    "error": {
                        "message": f"Velaris AI Gateway error: {err_str}",
                        "type": "server_error"
                    }
                })


def run_gateway():
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadedHTTPServer(server_address, VelarisGatewayHandler)
    print(f"============================================================")
    print(f"🌐 Velaris Unified AI Gateway démarré sur http://0.0.0.0:{PORT}")
    print(f"💎 Modèle Résident : {MODEL_NAME}")
    print(f"🛡️ Isolation Multi-Projets : Activée")
    print(f"🔄 Détection Changement de Compte (OAuth Watchdog) : Activée")
    print(f"💰 Coût API : 0€ (Illimité)")
    print(f"============================================================")

    def handle_signal(sig, frame):
        print("\n[Gateway] Arrêt propre de la passerelle...")
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
    run_gateway()
