import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const TOLERANCE_SECONDS = 300; // 5 minutes anti-rejeu window
const CFA_PER_CREDIT = 85;

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp, x-webhook-event",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const signature = req.headers.get("x-webhook-signature") || "";
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const eventType = req.headers.get("x-webhook-event") || "";

    const rawBody = await req.text();

    // 1. Validation de l'horodatage (Anti-Rejeu < 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const tsNumber = parseInt(timestamp, 10);
    if (!tsNumber || Math.abs(now - tsNumber) > TOLERANCE_SECONDS) {
      console.warn(`[SasPay Webhook] Horodatage hors tolérance : timestamp=${timestamp}, now=${now}`);
      return new Response(JSON.stringify({ error: "Horodatage hors tolérance (anti-rejeu)" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Vérification cryptographique de la signature HMAC-SHA256
    const webhookSecret = Deno.env.get("SASPAY_WEBHOOK_SECRET") || "";
    if (webhookSecret) {
      const signedPayload = `${timestamp}.${rawBody}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(webhookSecret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        encoder.encode(signedPayload)
      );
      const expectedHex = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (signature.toLowerCase() !== expectedHex.toLowerCase()) {
        console.error("[SasPay Webhook] Signature invalide");
        return new Response(JSON.stringify({ error: "Signature HMAC invalide" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = eventType || payload.event;
    const data = payload.data || {};

    console.log(`[SasPay Webhook] Event reçu: ${event}, Ref: ${data.reference || data.id}`);

    // Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://dnwlqgsftauqsyjwhoza.supabase.co";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (event === "transaction.success") {
      const amount = parseFloat(data.amount || data.net_amount || "0");
      const metadata = data.metadata || {};
      const userId = metadata.userId || metadata.user_id;
      const type = metadata.type || "CREDIT_RECHARGE";

      if (type === "SUBSCRIPTION") {
        const plan = metadata.plan || (amount >= 6500 ? "quarterly" : "monthly");
        const days = plan === "quarterly" ? 90 : 30;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        if (userId) {
          await supabase.from("profiles").update({
            subscription_status: "ACTIVE",
            subscription_plan: plan,
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString()
          }).eq("id", userId);
        }

        console.log(`[SasPay Webhook] Abonnement activé : User=${userId}, Plan=${plan}, Exp=${expiresAt}`);
      } else {
        // Recharge de crédits (Paiement Libre ou Pack)
        // 1 crédit = 85 F CFA
        const calculatedCredits = Math.max(1, Math.round((amount / CFA_PER_CREDIT) * 100) / 100);

        if (userId) {
          // Incrémenter les crédits de l'utilisateur
          const { data: profile } = await supabase.from("profiles").select("credits").eq("id", userId).maybeSingle();
          const currentCredits = Number(profile?.credits || 0);
          const newCredits = currentCredits + calculatedCredits;

          await supabase.from("profiles").update({
            credits: newCredits,
            updated_at: new Date().toISOString()
          }).eq("id", userId);

          // Journaliser la transaction
          await supabase.from("credit_transactions").insert({
            user_id: userId,
            amount_cfa: amount,
            credits_added: calculatedCredits,
            transaction_ref: data.reference || data.id,
            payment_provider: "SASPAY",
            status: "SUCCESS",
            created_at: new Date().toISOString()
          });

          console.log(`[SasPay Webhook] Crédits ajoutés : User=${userId}, +${calculatedCredits} crédits (Nouveau solde: ${newCredits})`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[SasPay Webhook] Erreur:", err);
    return new Response(JSON.stringify({ error: err?.message || "Erreur interne webhook" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
