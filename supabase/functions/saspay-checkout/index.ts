/**
 * Création et suivi des paiements SasPay — la clé secrète reste côté serveur.
 * Le montant, le type et l'utilisateur sont fixés ici : le navigateur ne peut
 * ni changer le prix d'un abonnement ni créditer un autre compte.
 * Le crédit effectif n'est appliqué que par le webhook signé (saspay-webhook).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, corsHeaders, fetchWithTimeout, json, requireUser } from "../_shared/http.ts";

const SASPAY_BASE = "https://api.saspay.me/api/v1";
const PLANS = {
  monthly: { price: 3000, label: "Pass Studio Velaris Mensuel (30 jours)" },
  quarterly: { price: 7000, label: "Pass Studio Velaris Trimestriel (90 jours)" },
} as const;
const MIN_RECHARGE = 200;
const MAX_RECHARGE = 500000;
const CFA_PER_CREDIT = 85;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("SASPAY_API_KEY");
  if (!apiKey) return json({ error: "Passerelle de paiement non configurée" }, 503);

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user) return json({ error: "Connexion requise" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide" }, 400);
  }

  if (body.action === "status") {
    const id = String(body.sessionId || "");
    if (!/^[\w-]{6,80}$/.test(id)) return json({ error: "Session invalide" }, 400);
    const res = await fetchWithTimeout(`${SASPAY_BASE}/checkout-sessions/${id}/status/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.data) return json({ error: data?.message || `SasPay HTTP ${res.status}` }, 502);
    return json({ status: data.data.status, transactionStatus: data.data.transaction_status ?? null });
  }

  if (body.action !== "create") return json({ error: "Action inconnue" }, 400);

  let amount: number;
  let description: string;
  let metadata: Record<string, unknown>;

  if (body.kind === "SUBSCRIPTION") {
    const planId = body.plan === "quarterly" ? "quarterly" : "monthly";
    amount = PLANS[planId].price;
    description = PLANS[planId].label;
    metadata = { type: "SUBSCRIPTION", plan: planId, userId: user.id };
  } else if (body.kind === "CREDIT_RECHARGE") {
    amount = Math.round(Number(body.amountCfa));
    if (!Number.isFinite(amount) || amount < MIN_RECHARGE || amount > MAX_RECHARGE) {
      return json({ error: `Montant entre ${MIN_RECHARGE} et ${MAX_RECHARGE.toLocaleString("fr-FR")} F CFA` }, 400);
    }
    const credits = Math.round((amount / CFA_PER_CREDIT) * 100) / 100;
    description = `Recharge Velaris Studio : ${credits} crédits`;
    metadata = { type: "CREDIT_RECHARGE", amount_cfa: amount, credits_expected: credits, userId: user.id };
  } else {
    return json({ error: "Type de paiement inconnu" }, 400);
  }

  const returnUrl = typeof body.returnUrl === "string" && /^https:\/\//.test(body.returnUrl) ? body.returnUrl : undefined;

  const res = await fetchWithTimeout(`${SASPAY_BASE}/checkout-sessions/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: `${amount}.00`,
      currency: "XOF",
      description,
      customer_email: user.email,
      customer_name: (user.user_metadata?.studio_name as string) || user.email,
      return_url: returnUrl,
      metadata,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.data?.checkout_url) {
    return json({ error: data?.message || data?.error || `SasPay HTTP ${res.status}` }, 502);
  }

  return json({ id: data.data.id, checkoutUrl: data.data.checkout_url, amount, status: data.data.status });
});
