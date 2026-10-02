import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, corsHeaders, json } from "../_shared/http.ts";

const TOLERANCE_SECONDS = 300; // fenêtre anti-rejeu de 5 minutes

const encoder = new TextEncoder();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparaison en temps constant (pas de fuite par mesure du temps de réponse) */
function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a.toLowerCase());
  const y = encoder.encode(b.toLowerCase());
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Sans secret configuré, aucun paiement ne peut être prouvé : on refuse (fail closed)
  const webhookSecret = Deno.env.get("SASPAY_WEBHOOK_SECRET") || "";
  if (!webhookSecret) {
    console.error("[SasPay Webhook] SASPAY_WEBHOOK_SECRET absent : webhook refusé");
    return json({ error: "Webhook non configuré" }, 503);
  }

  const signature = (req.headers.get("x-webhook-signature") || "").replace(/^sha256=/i, "");
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  const eventHeader = req.headers.get("x-webhook-event") || "";
  const rawBody = await req.text();

  // 1. Anti-rejeu : horodatage dans une fenêtre de 300 s
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(now - ts) > TOLERANCE_SECONDS) {
    console.warn(`[SasPay Webhook] Horodatage hors tolérance : ${timestamp}`);
    return json({ error: "Horodatage hors tolérance" }, 403);
  }

  // 2. Signature HMAC-SHA256 sur "timestamp.corps brut"
  const expected = await hmacHex(webhookSecret, `${timestamp}.${rawBody}`);
  if (!signature || !safeEqual(signature, expected)) {
    console.error("[SasPay Webhook] Signature invalide");
    return json({ error: "Signature invalide" }, 403);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Corps JSON invalide" }, 400);
  }

  const event = eventHeader || payload.event;
  const data = payload.data || {};
  const reference = String(data.reference || data.transaction_id || data.id || "");
  console.log(`[SasPay Webhook] ${event} ref=${reference}`);

  // Seul un succès crédite ; les autres événements sont acquittés sans effet
  if (event !== "transaction.success") return json({ received: true, applied: false });

  const metadata = data.metadata || {};
  const userId = metadata.userId || metadata.user_id;
  const type = metadata.type === "SUBSCRIPTION" ? "SUBSCRIPTION" : "CREDIT_RECHARGE";
  const plan = type === "SUBSCRIPTION" ? (metadata.plan === "quarterly" ? "quarterly" : "monthly") : null;
  const amount = Number.parseFloat(String(data.amount ?? "0"));
  const currency = String(data.currency || "XOF").toUpperCase();

  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    console.warn("[SasPay Webhook] Paiement sans utilisateur rattaché (lien universel ?) : à réconcilier manuellement", reference);
    return json({ received: true, applied: false, reason: "no_user" });
  }
  if (currency !== "XOF" || !Number.isFinite(amount) || amount <= 0 || !reference) {
    return json({ received: true, applied: false, reason: "invalid_payload" });
  }

  const supabase = adminClient();
  const { data: result, error } = await supabase.rpc("velaris_apply_payment", {
    p_user: userId,
    p_amount_cfa: amount,
    p_ref: `SASPAY-${reference}`,
    p_type: type,
    p_plan: plan,
  });

  if (error) {
    // 500 : SasPay relivrera l'événement ; l'idempotence empêche tout double crédit
    console.error("[SasPay Webhook] Application impossible :", error.message);
    return json({ error: "Application du paiement impossible" }, 500);
  }

  console.log(`[SasPay Webhook] Appliqué : user=${userId} type=${type}`, result);
  return json({ received: true, ...result });
});
