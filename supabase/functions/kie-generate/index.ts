/**
 * Génération musicale Kie.ai (Suno) — clé API côté serveur, crédit débité
 * atomiquement AVANT l'appel et remboursé si Kie.ai refuse la tâche.
 *
 * Actions :
 *   generate { title, style, lyrics, clientName?, clientPhone?, orderRef? }
 *   status   { taskId }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, corsHeaders, fetchWithTimeout, json, requireUser } from "../_shared/http.ts";

const KIE_BASE = "https://api.kie.ai/api/v1";
const SONG_COST = 1;
// Limites documentées par Kie.ai pour le mode personnalisé (V3_5)
const MAX_LYRICS = 3000;
const MAX_STYLE = 200;
const MAX_TITLE = 80;

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("KIE_API_KEY");
  if (!apiKey) return json({ error: "Moteur Kie.ai non configuré" }, 503);

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
    const taskId = clean(body.taskId, 120);
    const { data: row } = await admin
      .from("song_generations")
      .select("id, status, audio_url, duration, error")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return json({ error: "Tâche introuvable" }, 404);
    if (row.status !== "pending") return json({ status: row.status, audioUrl: row.audio_url, duration: row.duration, error: row.error });

    const res = await fetchWithTimeout(`${KIE_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.code !== 200) return json({ status: "pending" });

    const track = (data?.data?.response?.sunoData || data?.data?.sunoData || [])[0];
    const state = data?.data?.status;
    if (track?.audioUrl || track?.streamAudioUrl) {
      const audioUrl = track.audioUrl || track.streamAudioUrl;
      await admin.from("song_generations").update({ status: "success", audio_url: audioUrl, duration: track.duration ?? null, updated_at: new Date().toISOString() }).eq("id", row.id);
      return json({ status: "success", audioUrl, duration: track.duration ?? null });
    }
    if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"].includes(state)) {
      const error = clean(data?.data?.errorMessage || state, 300);
      await admin.from("song_generations").update({ status: "failed", error, updated_at: new Date().toISOString() }).eq("id", row.id);
      // L'audio n'a jamais été produit : le crédit revient au studio
      await admin.rpc("velaris_refund_credits", { p_user: user.id, p_amount: SONG_COST, p_reason: `Échec Kie.ai : ${error}`, p_ref: `REFUND-${taskId}` });
      return json({ status: "failed", error, refunded: true });
    }
    return json({ status: "pending" });
  }

  if (body.action !== "generate") return json({ error: "Action inconnue" }, 400);

  const lyrics = clean(body.lyrics, MAX_LYRICS);
  const style = clean(body.style, MAX_STYLE) || "Afro-Love acoustique";
  const title = clean(body.title, MAX_TITLE) || "Chanson personnalisée";
  if (lyrics.length < 40) return json({ error: "Paroles trop courtes pour une production" }, 400);

  // 1. Débit atomique (refusé si solde insuffisant)
  const debitRef = `SONG-${crypto.randomUUID()}`;
  const { data: balance, error: debitErr } = await admin.rpc("velaris_consume_credits_for", {
    p_user: user.id,
    p_amount: SONG_COST,
    p_kind: "song_generation",
    p_reason: `Génération « ${title} »`,
    p_ref: debitRef,
  });
  if (debitErr) {
    const insufficient = debitErr.message.includes("insufficient_credits");
    return json({ error: insufficient ? "Solde de crédits insuffisant" : "Débit impossible" }, insufficient ? 402 : 500);
  }

  // 2. Appel Kie.ai
  const callBackUrl = Deno.env.get("KIE_CALLBACK_URL") || "https://velaris.money/api/public/melody/kie-callback";
  let kieError: string | null = null;
  let taskId: string | null = null;
  try {
    const res = await fetchWithTimeout(`${KIE_BASE}/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: lyrics, customMode: true, style, title, instrumental: false, model: "V3_5", callBackUrl }),
    }, 25000);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.code === 200 && data?.data?.taskId) taskId = String(data.data.taskId);
    else kieError = res.status === 402 || data?.code === 402 ? "Solde du compte Kie.ai épuisé" : clean(data?.msg || `Kie.ai HTTP ${res.status}`, 200);
  } catch (err) {
    kieError = (err as Error)?.name === "AbortError" ? "Kie.ai ne répond pas" : "Kie.ai injoignable";
  }

  if (!taskId) {
    // 3a. Échec : remboursement immédiat, jamais de morceau factice
    const { data: refunded } = await admin.rpc("velaris_refund_credits", {
      p_user: user.id, p_amount: SONG_COST, p_reason: `Échec Kie.ai : ${kieError}`, p_ref: `REFUND-${debitRef}`,
    });
    return json({ error: kieError, refunded: true, balance: refunded }, 502);
  }

  // 3b. Succès : tâche enregistrée, le navigateur suit la progression via action=status
  await admin.from("song_generations").insert({
    user_id: user.id,
    task_id: taskId,
    order_ref: clean(body.orderRef, 60) || null,
    client_name: clean(body.clientName, 80) || null,
    client_phone: clean(body.clientPhone, 30) || null,
    title,
    style,
    credits_charged: SONG_COST,
  });

  return json({ taskId, status: "pending", balance });
});
