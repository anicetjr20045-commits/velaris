import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { debitUserCredits } from './_credits.js';

function getEnvConfig() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zoamdwupbhegcmancaeu.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  let kieApiKey = process.env.KIE_API_KEY || '';
  let wahaGowsUrl = (process.env.WAHA_GOWS_URL || 'https://waha2.162.35.113.220.sslip.io').replace(/\/+$/, '');
  let wahaGowsKey = process.env.WAHA_GOWS_API_KEY || '';

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
            if (k === 'WAHA_GOWS_URL' && v) wahaGowsUrl = v.replace(/\/+$/, '');
            if (k === 'WAHA_GOWS_API_KEY' && v) wahaGowsKey = v;
          }
        }
      }
    } catch {}
  }
  return { supabaseUrl, supabaseSecretKey, kieApiKey, wahaGowsUrl, wahaGowsKey };
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

const FEMALE_NAMES = new Set([
  'mme', 'madame', 'mlle', 'mademoiselle', 'soeur', 'tante', 'tata', 'maman', 'reine', 'princesse', 'dame',
  'fatou', 'fatoumata', 'aminata', 'amina', 'aicha', 'aichatou', 'awa', 'mariam', 'mariama', 'maimouna',
  'kadiatou', 'kady', 'kadi', 'kadidia', 'kadidja', 'salimata', 'sali', 'safiatou', 'safia', 'fanta',
  'djeneba', 'rokia', 'rokhaya', 'binta', 'bintou', 'assita', 'assetou', 'oumou', 'oumu', 'hawa', 'haoua',
  'nene', 'ramata', 'ramatoulaye', 'bibata', 'zenab', 'zeinab', 'zeynab', 'nafissatou', 'nadia',
  'nathalie', 'christelle', 'christine', 'carine', 'karine', 'sandrine', 'mireille', 'sonia', 'ruth',
  'esther', 'sarah', 'sara', 'grace', 'benedicte', 'beatrice', 'veronique', 'valerie', 'celine',
  'celestine', 'charlotte', 'claire', 'clarisse', 'cynthia', 'danielle', 'delphine', 'diane', 'dorothee',
  'edwige', 'elodie', 'elise', 'emilie', 'estelle', 'evelyne', 'fabienne', 'fanny', 'florence',
  'francine', 'francoise', 'genevieve', 'geraldine', 'ghislaine', 'giselle', 'gisele', 'helene',
  'hortense', 'ines', 'irene', 'isabelle', 'jacqueline', 'jeanne', 'jessica', 'jocelyne', 'joelle',
  'josephine', 'judith', 'julie', 'julienne', 'justine', 'laetitia', 'laure', 'laurence', 'lea',
  'leila', 'leonie', 'linda', 'lisa', 'louise', 'lucie', 'lydie', 'madeleine', 'magali', 'manon',
  'marguerite', 'marie', 'marina', 'marine', 'marlene', 'marthe', 'martine', 'melanie', 'melissa',
  'michele', 'michelle', 'monique', 'nadege', 'naomi', 'naomie', 'nicole', 'noelle', 'noemie',
  'odette', 'odile', 'olivia', 'pascale', 'patricia', 'pauline', 'pelagie', 'prisca', 'rachel',
  'raissa', 'rebecca', 'regine', 'renee', 'rita', 'rose', 'roseline', 'sabine', 'salome', 'sandra',
  'solange', 'sophie', 'stephanie', 'suzanne', 'sylviane', 'sylvie', 'tatiana', 'therese', 'vanessa',
  'victoire', 'victoria', 'virginie', 'viviane', 'yolande', 'yvette', 'yvonne', 'adjoua', 'akissi',
  'affoue', 'aya', 'amenan', 'amoin', 'abiba', 'habiba', 'habibatou', 'mawa', 'masseni', 'tenin',
  'korotoumou', 'noura', 'aissata', 'aissatou', 'djamila', 'jamila', 'samira', 'yasmine', 'yasmina',
  'angele', 'angelique', 'audrey', 'aurelie', 'barbara', 'bernadette', 'brigitte', 'camille', 'caroline',
  'catherine', 'cecile', 'chantal', 'chloe', 'claudine', 'corinne', 'deborah', 'denise', 'edith',
  'emmanuelle', 'eugenie', 'flore', 'gabrielle', 'gaelle', 'georgette', 'germaine', 'gladys',
  'henriette', 'jennifer', 'johanna', 'karen', 'katia', 'kelly', 'lara', 'laurette', 'liliane',
  'line', 'lucile', 'maelle', 'maeva', 'maite', 'marcelline', 'margaux', 'marianne', 'mathilde',
  'morgane', 'muriel', 'myriam', 'nadine', 'natacha', 'nelly', 'oceane', 'ophelie', 'pamela',
  'paula', 'paule', 'perrine', 'philomene', 'rosalie', 'roselyne', 'roxane', 'sabrina', 'salima',
  'severine', 'sharon', 'sheila', 'simone', 'solene', 'stella', 'tania', 'tiffany', 'valentine',
  'wendy', 'zoe', 'solen', 'maria', 'ariane', 'claudette', 'armelle', 'dorcas', 'eunice', 'lydia',
  'miriam', 'naima', 'rahima', 'latifa', 'farida', 'souad', 'asma', 'halima', 'salma', 'mounira', 'adissa',
]);

const MALE_NAMES = new Set([
  'mr', 'monsieur', 'frere', 'tonton', 'papa', 'roi', 'prince',
  'moussa', 'ibrahim', 'ibrahima', 'issouf', 'issa', 'ismael', 'ismail', 'abdoul', 'abdoulaye',
  'abou', 'aboubacar', 'abraham', 'adam', 'amadou', 'boubacar', 'boukary', 'cheick', 'cheikh',
  'daouda', 'dramane', 'drissa', 'idrissa', 'karim', 'kassim', 'lassina', 'madou', 'mahamadou',
  'mamadou', 'modibo', 'mohamed', 'mohammed', 'mouhamadou', 'moustapha', 'ousmane', 'oumar', 'oumarou',
  'salif', 'salifou', 'saydou', 'seydou', 'sidiki', 'souleymane', 'soumaila', 'tidiane', 'yacouba',
  'yaya', 'youssouf', 'zakaria', 'aziz', 'ali', 'aliou', 'amine', 'amir', 'anis', 'arthur', 'augustin',
  'axel', 'baptiste', 'basile', 'benjamin', 'benoit', 'bernard', 'bertrand', 'brice', 'bruno', 'cedric',
  'charles', 'christian', 'christophe', 'claude', 'clement', 'cyril', 'damien', 'daniel', 'david',
  'denis', 'didier', 'dieudonne', 'dimitri', 'dylan', 'edouard', 'elie', 'emile', 'emmanuel', 'eric',
  'ernest', 'etienne', 'fabien', 'fabrice', 'felix', 'fernand', 'florent', 'florian', 'franck',
  'francois', 'frederic', 'gabriel', 'gael', 'gaston', 'georges', 'gerard', 'germain', 'ghislain',
  'gilbert', 'gilles', 'gregoire', 'guillaume', 'guy', 'henri', 'herve', 'hugues', 'igor', 'ivan',
  'jacques', 'jean', 'jeremie', 'jerome', 'joel', 'jonathan', 'jordan', 'joseph', 'jules', 'julien',
  'justin', 'kevin', 'koffi', 'kouadio', 'kouakou', 'kouame', 'kouassi', 'konan', 'yao', 'nguessan',
  'aubin', 'landry', 'laurent', 'leo', 'leon', 'lionel', 'loic', 'louis', 'luc', 'lucas', 'ludovic',
  'marc', 'marcel', 'martial', 'martin', 'mathieu', 'matthieu', 'maurice', 'maxime', 'michel', 'mickael',
  'moise', 'nathan', 'nicolas', 'noel', 'norbert', 'olivier', 'omar', 'oscar', 'pascal', 'patrice',
  'patrick', 'paul', 'philippe', 'pierre', 'quentin', 'raphael', 'raymond', 'regis', 'remi', 'remy',
  'renaud', 'richard', 'robert', 'robin', 'roger', 'roland', 'romain', 'romuald', 'samuel',
  'sebastien', 'serge', 'simon', 'stephane', 'sylvain', 'thierry', 'thomas', 'timothee', 'tony',
  'tristan', 'ulrich', 'valentin', 'victor', 'vincent', 'wilfried', 'william', 'willy', 'xavier',
  'yann', 'yannick', 'yohan', 'yves', 'anicet', 'wendyam', 'alexandre', 'alexis', 'alain', 'albert',
  'alex', 'alfred', 'alphonse', 'andre', 'antoine', 'armand', 'arnaud', 'anselme', 'pacome', 'rodrigue',
  'boris', 'souleyman', 'adama', 'konate', 'desire', 'hermann',
]);

const FEMALE_SUBSTRINGS = ['fatou', 'aminata', 'amina', 'aicha', 'mariam', 'rokia', 'haoua', 'hawa', 'kadiatou', 'salimata', 'djeneba', 'bintou', 'princesse', 'madame', 'maman', 'sonia', 'mireille', 'nadia', 'nathalie', 'sandrine', 'christelle', 'jessica', 'vanessa', 'esther', 'ruth', 'sarah', 'mounira', 'adissa'];
const MALE_SUBSTRINGS = ['moussa', 'ibrahim', 'abdoul', 'mamadou', 'mohamed', 'ousmane', 'souleymane', 'seydou', 'yacouba', 'eric', 'franck', 'emmanuel', 'christian', 'alexandre', 'anselme', 'pacome', 'jonathan', 'kevin', 'wilfried', 'stephane', 'romain', 'nicolas'];

function inferGenderFast(rawName?: string, occasion?: string, notes?: string): 'femme' | 'homme' | 'inconnu' {
  const ctx = `${occasion || ''} ${notes || ''}`.toLowerCase();
  if (/\bpour mon mari\b|\bpour mon cheri\b|\bpour mon fiancé\b|\bpour mon copain\b|\bpour mon homme\b|\bpour mon epoux\b/.test(ctx)) {
    return 'femme';
  }
  if (/\bpour ma femme\b|\bpour ma cherie\b|\bpour ma fiancee\b|\bpour ma copine\b|\bpour mon epouse\b/.test(ctx)) {
    return 'homme';
  }

  if (!rawName) return 'inconnu';
  const cleaned = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .trim();
  if (!cleaned || cleaned.startsWith('client ')) return 'inconnu';

  const tokens = cleaned.split(/[\s'-]+/).filter(Boolean);
  for (const tok of tokens.slice(0, 4)) {
    if (FEMALE_NAMES.has(tok)) return 'femme';
    if (MALE_NAMES.has(tok)) return 'homme';
  }
  const compact = cleaned.replace(/\s+/g, '');
  for (const sub of FEMALE_SUBSTRINGS) {
    if (compact.includes(sub)) return 'femme';
  }
  for (const sub of MALE_SUBSTRINGS) {
    if (compact.includes(sub)) return 'homme';
  }
  return 'inconnu';
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

interface WahaChatDigest {
  chatId: string;
  phone: string;
  name: string;
  lastTimestamp: number;
  dateIso: string;
  dayKey: string;
  messages: Array<{ fromMe: boolean; at: string; body: string }>;
}

async function fetchLiveWhatsAppChats(
  wahaUrl: string,
  wahaKey: string,
  sessionName: string,
  cutoffUnixSec: number,
): Promise<WahaChatDigest[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`${wahaUrl}/api/${encodeURIComponent(sessionName)}/chats/overview?limit=45`, {
      headers: { 'X-Api-Key': wahaKey },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const list = (await res.json()) as any[];
    if (!Array.isArray(list)) return [];

    const recent = list
      .filter((c) => {
        const id = String(c?.id || '');
        if (!id || id.endsWith('@g.us') || id === 'status@broadcast') return false;
        const ts = Number(c?.lastMessage?.timestamp || c?.timestamp || 0);
        return ts >= cutoffUnixSec;
      })
      .slice(0, 30);

    const digests: Array<WahaChatDigest | null> = [];
    for (let i = 0; i < recent.length; i += 5) {
      const batch = recent.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async (c): Promise<WahaChatDigest | null> => {
          const chatId = String(c.id);
          const ts = Number(c?.lastMessage?.timestamp || c?.timestamp || 0);
          const info = c?.lastMessage?._data?.Info;
          const altJid = [info?.RecipientAlt, info?.SenderAlt]
            .map((v: any) => String(v || ''))
            .find((v) => v.endsWith('@s.whatsapp.net') || v.endsWith('@c.us'));
          const rawPhoneSource = chatId.endsWith('@lid') ? (altJid || '') : chatId;
          const digits = rawPhoneSource.replace(/@.*$/, '').replace(/\D/g, '');
          const phone = digits.length >= 8 ? `+${digits}` : '';
          const name = String(c?.name || phone || 'Client WhatsApp').trim();
          let msgs: Array<{ fromMe: boolean; at: string; body: string }> = [];

          try {
            const mCtrl = new AbortController();
            const mTimer = setTimeout(() => mCtrl.abort(), 6000);
            const mRes = await fetch(
              `${wahaUrl}/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(chatId)}/messages?limit=15`,
              { headers: { 'X-Api-Key': wahaKey }, signal: mCtrl.signal },
            );
            clearTimeout(mTimer);
            if (mRes.ok) {
              const rawMsgs = (await mRes.json()) as any[];
              if (Array.isArray(rawMsgs)) {
                msgs = rawMsgs
                  .map((m) => {
                    const text = String(m?.body || '').trim().slice(0, 140);
                    const mediaType = String(m?._data?.Info?.MediaType || '').toLowerCase();
                    const hasMedia = Boolean(m?.hasMedia || mediaType);
                    let mediaTag = '';
                    if (hasMedia) {
                      if (mediaType === 'image') mediaTag = '[IMAGE]';
                      else if (mediaType === 'audio' || mediaType === 'ptt') mediaTag = '[AUDIO/VOCAL]';
                      else if (mediaType === 'video') mediaTag = '[VIDEO]';
                      else if (mediaType === 'document') mediaTag = '[DOCUMENT]';
                      else mediaTag = '[MEDIA]';
                    }
                    const combined = [mediaTag, text].filter(Boolean).join(' ').trim();
                    return {
                      fromMe: Boolean(m?.fromMe),
                      at: new Date((Number(m?.timestamp) || ts) * 1000).toISOString(),
                      body: combined,
                    };
                  })
                  .filter((m) => m.body.length > 0)
                  .slice(0, 12);
              }
            }
          } catch {}

          if (msgs.length === 0 && (c?.lastMessage?.body || c?.lastMessage?.hasMedia)) {
            const lmText = String(c.lastMessage.body || '').slice(0, 140);
            const lmTag = c.lastMessage.hasMedia ? '[MEDIA]' : '';
            const combined = [lmTag, lmText].filter(Boolean).join(' ').trim();
            if (combined) {
              msgs = [{
                fromMe: Boolean(c.lastMessage.fromMe),
                at: new Date(ts * 1000).toISOString(),
                body: combined,
              }];
            }
          }

          const dt = new Date(ts * 1000);
          return {
            chatId,
            phone,
            name,
            lastTimestamp: ts,
            dateIso: dt.toISOString(),
            dayKey: dt.toISOString().slice(0, 10),
            messages: msgs,
          };
        }),
      );
      digests.push(...batchResults);
    }

    return digests.filter((d): d is WahaChatDigest => d !== null);
  } catch {
    return [];
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { supabaseUrl, supabaseSecretKey, kieApiKey, wahaGowsUrl, wahaGowsKey } = getEnvConfig();
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
  const sessionName = `studio_${userId.slice(0, 8)}`;

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
  const waSinceAt = (reset || existingState?.last_report?.waScannerVersion !== 2)
    ? null
    : (existingState?.last_report?.waSyncedAt || null);
  const nowIso = new Date().toISOString();
  // Checkpoint strict : si waSyncedAt (v2) existe, on ne scanne que les nouveautés (avec 5 min de marge) ; sinon rattrapage 72h
  const waCutoffSec = waSinceAt
    ? Math.max(0, Math.floor(Date.parse(waSinceAt) / 1000) - 300)
    : Math.floor((Date.now() - 72 * 3600 * 1000) / 1000);

  const fetchLimit = sinceAt ? 500 : 2500;
  let ordersQuery = admin
    .from('orders')
    .select('id, contact_id, amount_cents, price_xof, status, payment_method, occasion, recipient_name, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  let contactsQuery = admin
    .from('contacts')
    .select('id, name, phone, occasion, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (sinceAt) {
    ordersQuery = ordersQuery.gt('created_at', sinceAt);
    contactsQuery = contactsQuery.gt('created_at', sinceAt);
  }

  const allOrdersLightQuery = admin
    .from('orders')
    .select('id, contact_id, amount_cents, price_xof, status, payment_status, recipient_name, created_at')
    .eq('user_id', userId)
    .limit(2500);

  const allContactsLightQuery = admin
    .from('contacts')
    .select('id, name, phone, wa_jid, created_at')
    .eq('user_id', userId)
    .limit(2500);

  const [ordersRes, contactsRes, allOrdersLightRes, allContactsLightRes, waChats] = await Promise.all([
    ordersQuery,
    contactsQuery,
    allOrdersLightQuery,
    allContactsLightQuery,
    fetchLiveWhatsAppChats(wahaGowsUrl, wahaGowsKey, sessionName, waCutoffSec),
  ]);

  const newOrders = ordersRes.data || [];
  const newContacts = contactsRes.data || [];

  // Index rapide des contacts et commandes existants pour éviter tout doublon lors de la synchro WhatsApp
  const existingPhoneToContactId = new Map<string, string>();
  const contactLookup = new Map<string, { name: string; phone: string }>();
  for (const c of allContactsLightRes.data || []) {
    const p = String(c.phone || '').trim();
    const digits = p.replace(/\D/g, '');
    if (digits.length >= 8) existingPhoneToContactId.set(digits.slice(-8), c.id);
    contactLookup.set(c.id, { name: String(c.name || '').trim(), phone: p });
  }

  const isPaidOrder = (o: any) =>
    o?.payment_status === 'confirmed' ||
    o?.payment_status === 'paid' ||
    o?.status === 'delivered' ||
    o?.status === 'validated' ||
    o?.status === 'paid';

  const existingOrderDayKeys = new Set<string>();
  for (const o of allOrdersLightRes.data || []) {
    if (!isPaidOrder(o)) continue;
    const cInfo = o.contact_id ? contactLookup.get(o.contact_id) : undefined;
    const digits = String(cInfo?.phone || '').replace(/\D/g, '');
    const day = String(o.created_at || '').slice(0, 10);
    if (digits.length >= 8 && day) existingOrderDayKeys.add(`${digits.slice(-8)}|${day}`);
  }

  // Synchroniser les nouveaux contacts WhatsApp manquants dans `contacts` (avec leur vraie date WhatsApp)
  const preExistingPhoneTails = new Set<string>(existingPhoneToContactId.keys());
  const newlySyncedWaChats: WahaChatDigest[] = [];
  let syncedContactsCount = 0;
  for (const wc of waChats) {
    const digits = wc.phone.replace(/\D/g, '');
    if (digits.length < 8) continue;
    const tail8 = digits.slice(-8);
    if (!existingPhoneToContactId.has(tail8)) {
      const { data: inserted } = await admin
        .from('contacts')
        .insert({
          user_id: userId,
          name: wc.name,
          phone: wc.phone,
          wa_jid: wc.chatId,
          source: 'whatsapp_sync',
          created_at: wc.dateIso,
        })
        .select('id')
        .single();
      if (inserted?.id) {
        existingPhoneToContactId.set(tail8, inserted.id);
        contactLookup.set(inserted.id, { name: wc.name, phone: wc.phone });
        newlySyncedWaChats.push(wc);
        syncedContactsCount += 1;
      }
    }
  }

  // Pré-filtrage déterministe des discussions WhatsApp contenant un signal de paiement/livraison (économie de crédits IA)
  const SALE_SIGNAL_RE = /\[(IMAGE|AUDIO\/VOCAL|DOCUMENT|VIDEO|MEDIA)\]|paiement|pay[ée]|re[çc]u|wave|orange|mtn|moov|franc|1\s?200|3\s?000|5\s?000|merci|ecout|[ée]cout|chanson|djelia|ecoute\/|livr[ée]|envoy[ée]|valid[ée]|d[ée]p[ôo]t|capture/i;
  const waChatsForSaleDetection = waChats
    .filter((wc) => {
      const digits = wc.phone.replace(/\D/g, '');
      if (digits.length < 8 || existingOrderDayKeys.has(`${digits.slice(-8)}|${wc.dayKey}`)) return false;
      return wc.messages.some((m) => SALE_SIGNAL_RE.test(m.body));
    })
    .map((wc) => ({
      chatId: wc.chatId,
      name: wc.name,
      phone: wc.phone,
      dayKey: wc.dayKey,
      dateIso: wc.dateIso,
      messages: wc.messages,
    }));

  if (newOrders.length === 0 && newContacts.length === 0 && newlySyncedWaChats.length === 0 && waChatsForSaleDetection.length === 0 && existingState?.last_report && !reset) {
    return res.status(200).json({
      ok: true,
      upToDate: true,
      state: existingState,
      report: existingState.last_report,
    });
  }

  // Débiter 0.25 crédit uniquement quand l'analyse traite de vraies nouveautés
  const debit = await debitUserCredits(authHeader, 0.25, 'Analyse Business & Scan WhatsApp', 'analytics');
  if (!debit.ok) {
    return res.status(debit.status || 402).json({ ok: false, error: debit.error || 'Crédits insuffisants.' });
  }

  // Déduplication stricte des personnes uniques pour l'analyse du sexe
  let deltaWomen = 0;
  let deltaMen = 0;
  let deltaUnknown = 0;
  const ambiguousForAi: Array<{ id: string; name: string; occasion: string; notes: string }> = [];
  const seenPersonKeys = new Set<string>();

  const registerPerson = (personKey: string, id: string, name: string, occasion: string, notes: string) => {
    if (seenPersonKeys.has(personKey)) return;
    seenPersonKeys.add(personKey);

    const cleanName = name.trim();
    const fast = inferGenderFast(cleanName, occasion, notes);
    if (fast === 'femme') {
      deltaWomen += 1;
    } else if (fast === 'homme') {
      deltaMen += 1;
    } else if (cleanName && !cleanName.toLowerCase().startsWith('client ') && !/^\+?\d+$/.test(cleanName) && ambiguousForAi.length < 180) {
      ambiguousForAi.push({
        id,
        name: cleanName.slice(0, 60),
        occasion: occasion.slice(0, 50),
        notes: notes.slice(0, 120),
      });
    } else {
      deltaUnknown += 1;
    }
  };

  const waChatsForDemographics = sinceAt ? newlySyncedWaChats : waChats;
  for (const wc of waChatsForDemographics) {
    const digits = wc.phone.replace(/\D/g, '');
    if (sinceAt && digits.length >= 8 && preExistingPhoneTails.has(digits.slice(-8))) continue;
    const pKey = digits.length >= 8 ? `tel:${digits.slice(-8)}` : `wa:${wc.chatId}`;
    const snippet = wc.messages.map((m) => `${m.fromMe ? 'Moi' : 'Client'}: ${m.body}`).join(' | ');
    registerPerson(pKey, wc.chatId, wc.name, '', snippet);
  }
  for (const c of newContacts) {
    const digits = String(c.phone || '').replace(/\D/g, '');
    const pKey = digits.length >= 8 ? `tel:${digits.slice(-8)}` : `cid:${c.id}`;
    registerPerson(pKey, c.id, String(c.name || ''), String(c.occasion || ''), String(c.notes || ''));
  }
  for (const o of newOrders) {
    const cInfo = o.contact_id ? contactLookup.get(o.contact_id) : undefined;
    const digits = String(cInfo?.phone || '').replace(/\D/g, '');
    const pKey = digits.length >= 8
      ? `tel:${digits.slice(-8)}`
      : (o.contact_id ? `cid:${o.contact_id}` : `ord:${o.id}`);
    const name = (cInfo?.name && !cInfo.name.startsWith('Client ') ? cInfo.name : '') || String(o.recipient_name || '');
    registerPerson(pKey, o.id, name, String(o.occasion || ''), String(o.notes || ''));
  }

  let deltaRevenue = 0;
  const countryMap = new Map<string, number>();
  for (const o of newOrders) {
    deltaRevenue += Number(o.price_xof) || Math.round(Number(o.amount_cents || 0) / 100);
  }
  for (const c of allContactsLightRes.data || []) {
    const country = detectCountryFromPhone(c.phone);
    if (country !== 'Autre') countryMap.set(country, (countryMap.get(country) || 0) + 1);
  }
  for (const wc of newlySyncedWaChats) {
    const country = detectCountryFromPhone(wc.phone);
    if (country !== 'Autre') countryMap.set(country, (countryMap.get(country) || 0) + 1);
  }

  let topOccasions: string[] = [];
  let syncedOrdersCount = 0;
  let syncedRevenue = 0;

  if (kieApiKey && (waChatsForSaleDetection.length > 0 || ambiguousForAi.length > 0 || newOrders.length > 0)) {
    try {
      const prompt = [
        'Tu es un analyste business expert pour un studio de chansons personnalisées vendues sur WhatsApp en Afrique francophone (prix standard 1 200 F CFA ou 3 000 F CFA).',
        sinceAt
          ? 'On te donne UNIQUEMENT les nouveautés depuis la dernière analyse (base + WhatsApp en direct).'
          : 'Première analyse complète (base + discussions WhatsApp récentes en direct).',
        '',
        `Chiffres déjà enregistrés en base sur la période : ${newOrders.length} ventes, ${deltaRevenue} F CFA, ${newContacts.length} contacts base, ${waChats.length} discussions WhatsApp récentes.`,
        `Précédent bilan : ${existingState?.last_report?.verdict || 'Aucun (bilan initial)'}`,
        '',
        `1) Discussions WhatsApp récentes sans commande enregistrée (${waChatsForSaleDetection.length}) — détecte celles où le client a clairement payé ou reçu sa chanson livrée :`,
        JSON.stringify(waChatsForSaleDetection),
        '',
        `2) Fiches ambiguës à classer par sexe (${ambiguousForAi.length}) :`,
        JSON.stringify(ambiguousForAi),
        '',
        'Réponds STRICTEMENT en JSON valide :',
        '{',
        '  "detectedSales": [ { "chatId": "...", "amountXof": 1200, "saleDateIso": "2026-11-26T18:16:00Z", "occasion": "Anniversaire", "reason": "Livraison audio confirmée" } ],',
        '  "genders": [ { "id": "...", "gender": "femme" | "homme" | "inconnu" } ],',
        '  "topOccasions": ["Occasion 1", "Occasion 2"]',
        '}',
        'Règle stricte pour "detectedSales" : n\'inclus un chat QUE si les messages prouvent vraiment un paiement reçu ou une livraison de chanson effectuée : par exemple [DOCUMENT] ou [AUDIO/VOCAL] ou [VIDEO] envoyé par Moi (même seul sans texte, ou avec "Vos chansons", "Votre chanson", "Bonne écoute"), lien d\'écoute envoyé, "paiement reçu", "vous serez livré", "à tout à l\'heure pour la chanson", "merci pour la confiance", "j\'ai écouté", "merci beaucoup pour la chanson". Pour [VIDEO] livrée, le tarif par défaut est 3000 F. Mets dans "saleDateIso" la date exacte (`at`) du message où le paiement ou la livraison a eu lieu (pour bien séparer hier, aujourd\'hui et les autres jours). Ne devine pas une vente sur un simple "Bonjour" ou une demande de prix.',
      ].join('\n');

      const aiRes = await fetch('https://api.kie.ai/openai/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kieApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v4-1-flash',
          stream: false,
          input: prompt,
          temperature: 0.15,
          reasoning: { effort: 'none' },
          text: { format: { type: 'json_object' } },
        }),
      });

      if (aiRes.ok) {
        const aiPayload = await aiRes.json();
        const rawText = extractKieText(aiPayload);
        if (rawText) {
          const parsed = safeJsonParse(rawText);

          // Enregistrer en base les ventes WhatsApp confirmées détectées par l'IA
          const detectedSales = Array.isArray(parsed.detectedSales) ? parsed.detectedSales : [];
          for (const sale of detectedSales) {
            const wc = waChatsForSaleDetection.find((x) => x.chatId === sale?.chatId);
            if (!wc) continue;
            const parsedSaleMs = sale?.saleDateIso ? Date.parse(String(sale.saleDateIso)) : NaN;
            const nowMs = Date.now();
            const saleIso = Number.isFinite(parsedSaleMs) && parsedSaleMs <= nowMs && parsedSaleMs >= nowMs - 14 * 86400 * 1000
              ? new Date(parsedSaleMs).toISOString()
              : wc.dateIso;
            const saleDay = saleIso.slice(0, 10);
            const digits = wc.phone.replace(/\D/g, '');
            const tail8 = digits.slice(-8);
            const dedupKey = `${tail8}|${saleDay}`;
            if (existingOrderDayKeys.has(dedupKey)) continue;
            existingOrderDayKeys.add(dedupKey);

            const amount = Number(sale.amountXof) > 0 ? Number(sale.amountXof) : 1200;
            const contactId = existingPhoneToContactId.get(tail8) || null;
            const { error: insErr } = await admin.from('orders').insert({
              user_id: userId,
              contact_id: contactId,
              amount_cents: Math.round(amount * 100),
              price_xof: amount,
              currency: 'XOF',
              status: 'delivered',
              payment_status: 'confirmed',
              stage: 'delivered',
              payment_method: 'WhatsApp (Analyse IA)',
              occasion: String(sale.occasion || 'Chanson personnalisée').slice(0, 80),
              recipient_name: wc.name,
              notes: `Vente détectée par Analyse IA depuis WhatsApp (${String(sale.reason || '').slice(0, 120)})`,
              created_at: saleIso,
              payment_confirmed_at: saleIso,
            });
            if (insErr) {
              console.error('analyze-business orders insert error:', insErr.message);
            } else {
              syncedOrdersCount += 1;
              syncedRevenue += amount;
            }
          }

          const genders = Array.isArray(parsed.genders) ? parsed.genders : [];
          const judgedIds = new Set<string>();
          for (const g of genders) {
            if (!g?.id || judgedIds.has(g.id)) continue;
            judgedIds.add(g.id);
            if (g.gender === 'femme') deltaWomen += 1;
            else if (g.gender === 'homme') deltaMen += 1;
            else deltaUnknown += 1;
          }
          for (const item of ambiguousForAi) {
            if (!judgedIds.has(item.id)) deltaUnknown += 1;
          }
          if (Array.isArray(parsed.topOccasions)) topOccasions = parsed.topOccasions.slice(0, 4).map(String);
        }
      }
    } catch (err) {
      console.error('analyze-business LLM error:', err);
      deltaUnknown += ambiguousForAi.length;
    }
  } else {
    deltaUnknown += ambiguousForAi.length;
  }

  // Recalculer Meilleurs Clients & Fidélité après synchro WhatsApp (uniquement commandes payées/livrées)
  const { data: finalOrdersLight } = await admin
    .from('orders')
    .select('id, contact_id, amount_cents, price_xof, status, payment_status, recipient_name, created_at')
    .eq('user_id', userId)
    .limit(2500);

  const clientAgg = new Map<string, { name: string; phone: string; ordersCount: number; totalSpent: number }>();
  let totalAllRevenue = 0;

  for (const o of finalOrdersLight || []) {
    if (!isPaidOrder(o)) continue;
    const amt = Number(o.price_xof) || Math.round(Number(o.amount_cents || 0) / 100);
    totalAllRevenue += amt;
    const cInfo = o.contact_id ? contactLookup.get(o.contact_id) : undefined;
    const rawName = (cInfo?.name && !cInfo.name.startsWith('Client ') ? cInfo.name : '') || String(o.recipient_name || cInfo?.name || '').trim();
    const phone = cInfo?.phone || '';
    const phoneDigits = phone.replace(/\D/g, '');
    const key = phoneDigits.length >= 8
      ? `tel:${phoneDigits.slice(-8)}`
      : (o.contact_id ? `cid:${o.contact_id}` : `ord:${o.id}`);
    const displayName = rawName || phone || 'Client WhatsApp';
    const prev = clientAgg.get(key) || { name: displayName, phone, ordersCount: 0, totalSpent: 0 };
    prev.ordersCount += 1;
    prev.totalSpent += amt;
    if (prev.name.startsWith('Client ') && rawName && !rawName.startsWith('Client ')) prev.name = rawName;
    if (!prev.phone && phone) prev.phone = phone;
    clientAgg.set(key, prev);
  }

  const allBuyers = [...clientAgg.values()];
  const returningBuyers = allBuyers.filter((b) => b.ordersCount >= 2);
  const returningClientsCount = returningBuyers.length;
  const returningOrdersCount = returningBuyers.reduce((acc, b) => acc + b.ordersCount, 0);
  const returningRevenue = returningBuyers.reduce((acc, b) => acc + b.totalSpent, 0);
  const returningRevenuePct = totalAllRevenue > 0 ? Math.round((returningRevenue / totalAllRevenue) * 100) : 0;
  const topClients = allBuyers
    .filter((b) => b.phone || (b.name && !b.name.toLowerCase().startsWith('client whatsapp')))
    .sort((a, b) => b.totalSpent - a.totalSpent || b.ordersCount - a.ordersCount)
    .slice(0, 8);

  const totalNewOrders = newOrders.length + syncedOrdersCount;
  const totalNewRevenue = deltaRevenue + syncedRevenue;
  const totalNewContacts = newContacts.length + syncedContactsCount;

  const baseWomen = reset ? 0 : (existingState?.women_count || 0);
  const baseMen = reset ? 0 : (existingState?.men_count || 0);
  const baseUnknown = reset ? 0 : (existingState?.unknown_count || 0);
  const baseOrders = reset ? 0 : (existingState?.total_orders_analyzed || 0);
  const baseRev = reset ? 0 : (existingState?.total_revenue_analyzed || 0);

  const womenCount = baseWomen + deltaWomen;
  const menCount = baseMen + deltaMen;
  const unknownCount = baseUnknown + deltaUnknown;
  const totalOrdersAnalyzed = baseOrders + totalNewOrders;
  const totalRevenueAnalyzed = baseRev + totalNewRevenue;

  const report = {
    analyzedAt: nowIso,
    waSyncedAt: nowIso,
    waScannerVersion: 2,
    sinceAt,
    deltaOrders: totalNewOrders,
    deltaRevenue: totalNewRevenue,
    deltaContacts: totalNewContacts,
    syncedOrdersCount,
    whatsappChatsScanned: waChats.length,
    deltaWomen,
    deltaMen,
    deltaUnknown,
    womenCount,
    menCount,
    unknownCount,
    totalOrdersAnalyzed,
    totalRevenueAnalyzed,
    totalUniqueBuyers: allBuyers.length,
    returningClientsCount,
    returningOrdersCount,
    returningRevenuePct,
    topClients,
    topOccasions,
    topCountries: [...countryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, count })),
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
    syncedOrdersCount,
    state: savedState,
    report,
  });
}
