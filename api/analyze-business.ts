import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zoamdwupbhegcmancaeu.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let kieApiKey = process.env.KIE_API_KEY || '';

  if (!supabaseSecretKey || !kieApiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m) {
            const k = m[1].trim();
            const v = m[2].trim();
            if (k === 'SUPABASE_SECRET_KEY' && !supabaseSecretKey) supabaseSecretKey = v;
            if (k === 'KIE_API_KEY' && !kieApiKey) kieApiKey = v;
          }
        }
      }
    } catch {}
  }
  return { supabaseUrl, supabaseSecretKey, kieApiKey };
}

function detectCountryFromPhone(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('225')) return 'Côte d’Ivoire';
  if (digits.startsWith('226')) return 'Burkina Faso';
  if (digits.startsWith('221')) return 'Sénégal';
  if (digits.startsWith('237')) return 'Cameroun';
  if (digits.startsWith('223')) return 'Mali';
  if (digits.startsWith('228')) return 'Togo';
  if (digits.startsWith('229')) return 'Bénin';
  if (digits.startsWith('227')) return 'Niger';
  if (digits.startsWith('224')) return 'Guinée';
  if (digits.startsWith('241')) return 'Gabon';
  if (digits.startsWith('242') || digits.startsWith('243')) return 'Congo';
  if (digits.startsWith('33')) return 'France';
  return 'Autre';
}

function extractKieText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }
  for (const item of payload?.output || []) {
    for (const c of item?.content || []) {
      if (typeof c?.text === 'string' && c.text.trim()) return c.text;
    }
  }
  const chatContent = payload?.choices?.[0]?.message?.content;
  if (typeof chatContent === 'string') return chatContent;
  return '';
}

function safeJsonParse(raw: string): any {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { supabaseUrl, supabaseSecretKey, kieApiKey } = getEnvConfig();
  if (!supabaseSecretKey) {
    return res.status(500).json({ ok: false, error: 'server_not_configured' });
  }

  const authHeader = String(req.headers['authorization'] || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }
  const userId = userData.user.id;

  // GET : renvoie uniquement l'état en cache sans déclencher d'analyse
  if (req.method === 'GET') {
    const { data: stateRow } = await admin
      .from('studio_analytics_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return res.status(200).json({ ok: true, state: stateRow || null, report: stateRow?.last_report || null });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const reset = Boolean(body.reset);

  const { data: existingState } = await admin
    .from('studio_analytics_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const sinceAt = reset ? null : (existingState?.last_analyzed_at || null);
  const nowIso = new Date().toISOString();

  // Charger uniquement les NOUVELLES commandes et NOUVEAUX contacts depuis last_analyzed_at
  let ordersQuery = admin
    .from('orders')
    .select('id, amount_cents, price_xof, status, payment_method, occasion, recipient_name, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(150);

  let contactsQuery = admin
    .from('contacts')
    .select('id, name, phone, occasion, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(150);

  if (sinceAt) {
    ordersQuery = ordersQuery.gt('created_at', sinceAt);
    contactsQuery = contactsQuery.gt('created_at', sinceAt);
  }

  const [ordersRes, contactsRes] = await Promise.all([ordersQuery, contactsQuery]);
  const newOrders = ordersRes.data || [];
  const newContacts = contactsRes.data || [];

  if (newOrders.length === 0 && newContacts.length === 0 && existingState?.last_report && !reset) {
    return res.status(200).json({
      ok: true,
      upToDate: true,
      state: existingState,
      report: existingState.last_report,
    });
  }

  // Calculs mathématiques exacts (100% déterministes)
  let deltaRevenue = 0;
  const countryMap = new Map<string, number>();
  const paymentMap = new Map<string, number>();

  for (const o of newOrders) {
    const amt = Number(o.price_xof) || Math.round(Number(o.amount_cents || 0) / 100);
    deltaRevenue += amt;
    const pay = String(o.payment_method || 'Mobile Money').trim();
    paymentMap.set(pay, (paymentMap.get(pay) || 0) + 1);
  }

  for (const c of newContacts) {
    const country = detectCountryFromPhone(c.phone);
    countryMap.set(country, (countryMap.get(country) || 0) + 1);
  }

  // Préparer un échantillon compact pour le jugement IA (max 80 fiches)
  const peopleForAi: Array<{ id: string; name: string; occasion: string; notes: string }> = [];
  const seenIds = new Set<string>();

  for (const c of newContacts) {
    if (peopleForAi.length >= 80) break;
    seenIds.add(c.id);
    peopleForAi.push({
      id: c.id,
      name: String(c.name || '').slice(0, 60),
      occasion: String(c.occasion || '').slice(0, 60),
      notes: String(c.notes || '').slice(0, 120),
    });
  }
  for (const o of newOrders) {
    if (peopleForAi.length >= 80) break;
    if (seenIds.has(o.id)) continue;
    peopleForAi.push({
      id: o.id,
      name: String(o.recipient_name || '').slice(0, 60),
      occasion: String(o.occasion || '').slice(0, 60),
      notes: String(o.notes || '').slice(0, 120),
    });
  }

  let deltaWomen = 0;
  let deltaMen = 0;
  let deltaUnknown = 0;
  let topOccasions: string[] = [];
  let verdict = '';
  let recommendations: string[] = [];

  if (kieApiKey && peopleForAi.length > 0) {
    try {
      const prompt = [
        'Tu es un analyste business expert pour un studio de chansons personnalisées vendues sur WhatsApp en Afrique francophone.',
        'On te donne UNIQUEMENT les nouveaux contacts et commandes depuis la dernière analyse.',
        '',
        `Chiffres exacts de cette nouvelle période : ${newOrders.length} ventes, ${deltaRevenue} F CFA, ${newContacts.length} nouveaux contacts.`,
        `Pays des nouveaux contacts : ${JSON.stringify(Object.fromEntries(countryMap))}`,
        `Précédent bilan (continuité) : ${existingState?.last_report?.verdict || 'Première analyse'}`,
        '',
        `Nouvelles fiches à juger (${peopleForAi.length}) :`,
        JSON.stringify(peopleForAi),
        '',
        'Réponds STRICTEMENT en JSON valide avec cette structure exacte :',
        '{',
        '  "genders": [ { "id": "uuid", "gender": "femme" | "homme" | "inconnu" } ],',
        '  "topOccasions": ["Occasion 1", "Occasion 2"],',
        '  "verdict": "2 à 3 phrases directes et utiles sur ce qui ressort de cette période par rapport à avant.",',
        '  "recommendations": ["Action concrète 1 pour demain", "Action concrète 2"]',
        '}',
        'Règles pour "genders" : déduis le sexe du CLIENT qui contacte (ex: prénom féminin/masculin, ou indice dans occasion/notes comme "pour mon mari" => femme, "pour ma femme" => homme). Si impossible à savoir (pseudo, numéro pur), mets "inconnu".',
      ].join('\n');

      const aiRes = await fetch('https://api.kie.ai/openai/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kieApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v4-1-flash',
          input: prompt,
          temperature: 0.2,
          reasoning: { effort: 'none' },
          text: { format: { type: 'json_object' } },
        }),
      });

      if (aiRes.ok) {
        const aiPayload = await aiRes.json();
        const rawText = extractKieText(aiPayload);
        if (rawText) {
          const parsed = safeJsonParse(rawText);
          const genders = Array.isArray(parsed.genders) ? parsed.genders : [];
          const judgedIds = new Set<string>();
          for (const g of genders) {
            if (!g?.id || judgedIds.has(g.id)) continue;
            judgedIds.add(g.id);
            if (g.gender === 'femme') deltaWomen += 1;
            else if (g.gender === 'homme') deltaMen += 1;
            else deltaUnknown += 1;
          }
          if (Array.isArray(parsed.topOccasions)) topOccasions = parsed.topOccasions.slice(0, 4).map(String);
          if (typeof parsed.verdict === 'string') verdict = parsed.verdict;
          if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations.slice(0, 3).map(String);
        }
      }
    } catch (err) {
      console.error('analyze-business LLM error:', err);
    }
  }

  if (!verdict) {
    verdict = `Nouvelle période analysée : ${newOrders.length} vente(s) pour ${deltaRevenue.toLocaleString('fr-FR')} F CFA et ${newContacts.length} nouveau(x) contact(s).`;
  }

  const baseWomen = reset ? 0 : (existingState?.women_count || 0);
  const baseMen = reset ? 0 : (existingState?.men_count || 0);
  const baseUnknown = reset ? 0 : (existingState?.unknown_count || 0);
  const baseOrders = reset ? 0 : (existingState?.total_orders_analyzed || 0);
  const baseRev = reset ? 0 : (existingState?.total_revenue_analyzed || 0);

  const womenCount = baseWomen + deltaWomen;
  const menCount = baseMen + deltaMen;
  const unknownCount = baseUnknown + deltaUnknown;
  const totalOrdersAnalyzed = baseOrders + newOrders.length;
  const totalRevenueAnalyzed = baseRev + deltaRevenue;

  const report = {
    analyzedAt: nowIso,
    sinceAt,
    deltaOrders: newOrders.length,
    deltaRevenue,
    deltaContacts: newContacts.length,
    deltaWomen,
    deltaMen,
    deltaUnknown,
    womenCount,
    menCount,
    unknownCount,
    totalOrdersAnalyzed,
    totalRevenueAnalyzed,
    topOccasions,
    topCountries: [...countryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, count })),
    verdict,
    recommendations,
  };

  const { data: savedState, error: saveErr } = await admin
    .from('studio_analytics_state')
    .upsert({
      user_id: userId,
      last_analyzed_at: nowIso,
      women_count: womenCount,
      men_count: menCount,
      unknown_count: unknownCount,
      total_orders_analyzed: totalOrdersAnalyzed,
      total_revenue_analyzed: totalRevenueAnalyzed,
      last_report: report,
      updated_at: nowIso,
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (saveErr) {
    return res.status(500).json({ ok: false, error: saveErr.message });
  }

  return res.status(200).json({
    ok: true,
    upToDate: false,
    state: savedState,
    report,
  });
}
