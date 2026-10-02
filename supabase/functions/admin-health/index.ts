/**
 * Sondes de santé de la console de direction — exécutées côté serveur avec les
 * vraies clés (WAHA, Kie.ai, SasPay), réservées aux administrateurs.
 * Retourne pour chaque nœud : joignable, authentifié, latence, détail.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, corsHeaders, fetchWithTimeout, json, requireUser } from "../_shared/http.ts";

type Probe = { reachable: boolean; authOk: boolean | null; ms: number; detail: string };

async function probe(url: string, init: RequestInit, interpret: (res: Response, body: any) => Pick<Probe, "authOk" | "detail">): Promise<Probe> {
  const t0 = performance.now();
  try {
    const res = await fetchWithTimeout(url, init, 8000);
    const ms = Math.round(performance.now() - t0);
    const body = await res.json().catch(() => null);
    return { reachable: true, ms, ...interpret(res, body) };
  } catch (err) {
    return { reachable: false, authOk: null, ms: Math.round(performance.now() - t0), detail: (err as Error)?.name === "AbortError" ? "Délai dépassé (8 s)" : "Injoignable" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user) return json({ error: "Connexion requise" }, 401);
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return json({ error: "Réservé à l'administration" }, 403);

  const wahaBase = Deno.env.get("WAHA_BASE_URL") || "https://waha.velarisagent.life";
  const wahaKey = Deno.env.get("WAHA_API_KEY") || "";
  const kieKey = Deno.env.get("KIE_API_KEY") || "";
  const sasKey = Deno.env.get("SASPAY_API_KEY") || "";

  const [waha, sessions, kie, saspay] = await Promise.all([
    probe(`${wahaBase}/ping`, { headers: { "X-Api-Key": wahaKey } }, (res) => ({ authOk: res.status !== 401, detail: res.ok ? "Passerelle opérationnelle" : `HTTP ${res.status}` })),
    fetchWithTimeout(`${wahaBase}/api/sessions`, { headers: { "X-Api-Key": wahaKey } }, 8000)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    probe("https://api.kie.ai/api/v1/chat/credit", { headers: { Authorization: `Bearer ${kieKey}` } }, (res, body) => ({
      authOk: res.status !== 401 && body?.code !== 401,
      detail: typeof body?.data === "number" ? `Solde Kie.ai : ${body.data} crédits` : res.ok ? "API opérationnelle" : `HTTP ${res.status}`,
    })),
    probe("https://api.saspay.me/api/v1/countries/", { headers: { Authorization: `Bearer ${sasKey}` } }, (res) => ({
      authOk: res.status !== 401 && res.status !== 403,
      detail: res.ok ? "Passerelle Mobile Money en ligne" : `HTTP ${res.status}`,
    })),
  ]);

  const list = Array.isArray(sessions) ? sessions : [];
  return json({
    checkedAt: new Date().toISOString(),
    configured: { waha: !!wahaKey, kie: !!kieKey, saspay: !!sasKey, webhookSecret: !!Deno.env.get("SASPAY_WEBHOOK_SECRET") },
    waha,
    kie,
    saspay,
    sessions: list.map((s: any) => ({
      name: s.name,
      status: s.status,
      // Numéro masqué : la console n'a pas besoin du numéro complet
      phone: s.me?.id ? String(s.me.id).split("@")[0].replace(/^(\d{5})\d+(\d{2})$/, "$1••••$2") : null,
      pushName: s.me?.pushName ?? null,
    })),
  });
});
