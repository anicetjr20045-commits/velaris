/**
 * Proxy WAHA authentifié — la clé X-Api-Key ne quitte jamais le serveur.
 *
 * Règles :
 *   - un studio ne touche qu'à SA session (studio_<8 premiers caractères de son id>) ;
 *   - un administrateur (profiles.is_admin) peut lire toutes les sessions ;
 *   - les sessions protégées (anicet2 par défaut) ne peuvent jamais être
 *     arrêtées, redémarrées, déconnectées ni utilisées pour envoyer depuis le web ;
 *   - seuls les chemins WAHA utilisés par le Studio sont relayés (liste blanche).
 *
 * Corps attendu : { method: "GET" | "POST", path: "/api/...", body?: object }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, corsHeaders, fetchWithTimeout, json, requireUser } from "../_shared/http.ts";

const PROTECTED = new Set((Deno.env.get("WAHA_PROTECTED_SESSIONS") || "anicet2").split(",").map((s) => s.trim()).filter(Boolean));
const SEND_PATHS = new Set(["/api/sendText", "/api/sendVoice", "/api/sendSeen"]);

type Route = { session: string | null; write: boolean; adminOnly?: boolean };

function route(method: string, path: string, body: any): Route | null {
  if (method === "GET" && path === "/ping") return { session: null, write: false };
  if (method === "GET" && path === "/api/sessions") return { session: null, write: false, adminOnly: true };
  if (method === "POST" && path === "/api/sessions") return { session: String(body?.name || ""), write: true };
  let m = path.match(/^\/api\/sessions\/([\w-]+)$/);
  if (m && method === "GET") return { session: m[1], write: false };
  m = path.match(/^\/api\/sessions\/([\w-]+)\/(start|stop|restart)$/);
  if (m && method === "POST") return { session: m[1], write: true };
  m = path.match(/^\/api\/([\w-]+)\/auth\/qr$/);
  if (m && method === "GET") return { session: m[1], write: false };
  m = path.match(/^\/api\/([\w-]+)\/chats\/[^/]+\/messages$/);
  if (m && method === "GET") return { session: m[1], write: false };
  if (method === "POST" && SEND_PATHS.has(path)) return { session: String(body?.session || ""), write: true };
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const baseUrl = Deno.env.get("WAHA_BASE_URL") || "https://waha.velarisagent.life";
  const apiKey = Deno.env.get("WAHA_API_KEY");
  if (!apiKey) return json({ error: "Passerelle WAHA non configurée" }, 503);

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user) return json({ error: "Connexion requise" }, 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Requête invalide" }, 400);
  }
  const method = payload.method === "POST" ? "POST" : "GET";
  const [rawPath, query = ""] = String(payload.path || "").split("?");
  const r = route(method, rawPath, payload.body);
  if (!r) return json({ error: "Chemin WAHA non autorisé" }, 403);

  const own = `studio_${user.id.slice(0, 8)}`;
  let isAdmin = false;
  if (r.adminOnly || (r.session && r.session !== own)) {
    const { data } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = !!data?.is_admin;
  }

  if (r.adminOnly && !isAdmin) return json({ error: "Réservé à l'administration" }, 403);
  if (r.session && r.session !== own) {
    if (!isAdmin) return json({ error: "Session WhatsApp d'un autre studio" }, 403);
    if (r.write && PROTECTED.has(r.session)) return json({ error: `Session ${r.session} protégée` }, 403);
  }

  // Création de session : configuration imposée côté serveur (webhook du moteur, anti-déconnexion)
  let body = payload.body;
  if (method === "POST" && rawPath === "/api/sessions") {
    body = {
      name: own,
      start: true,
      config: {
        noweb: { markOnline: false, store: { enabled: true, fullSync: false } },
        webhooks: [{ url: Deno.env.get("WAHA_ENGINE_WEBHOOK") || "http://waha-bridge:3001/webhook", events: ["message", "message.any", "message.reaction", "message.ack", "session.status"] }],
      },
    };
  }

  // Seuls les paramètres de pagination connus sont relayés
  const params = new URLSearchParams(query);
  const safe = new URLSearchParams();
  for (const k of ["limit", "downloadMedia"]) if (params.has(k)) safe.set(k, params.get(k)!.slice(0, 10));

  const res = await fetchWithTimeout(`${baseUrl}${rawPath}${safe.size ? `?${safe}` : ""}`, {
    method,
    headers: { "X-Api-Key": apiKey, Accept: "application/json", "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  }, SEND_PATHS.has(rawPath) ? 30000 : 10000).catch(() => null);

  if (!res) return json({ error: "Passerelle WAHA injoignable" }, 504);

  // QR code : l'image est relayée telle quelle
  const type = res.headers.get("content-type") || "application/json";
  return new Response(res.body, { status: res.status, headers: { ...corsHeaders, "Content-Type": type } });
});
