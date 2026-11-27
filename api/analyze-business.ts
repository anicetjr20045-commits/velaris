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

const FEMALE_NAMES = new Set([
  'mme', 'madame', 'mlle', 'mademoiselle', 'soeur', 'tante', 'tata', 'maman', 'reine', 'princesse',
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
  'miriam', 'naima', 'rahima', 'latifa', 'farida', 'souad', 'asma', 'halima', 'salma',
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
  'boris', 'arthur', 'ismael', 'souleyman', 'adama', 'issa', 'konate', 'martial', 'desire', 'hermann',
]);

const FEMALE_SUBSTRINGS = ['fatou', 'aminata', 'amina', 'aicha', 'mariam', 'rokia', 'haoua', 'hawa', 'kadiatou', 'salimata', 'djeneba', 'bintou', 'princesse', 'madame', 'maman', 'sonia', 'mireille', 'nadia', 'nathalie', 'sandrine', 'christelle', 'jessica', 'vanessa', 'esther', 'ruth', 'sarah'];
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
  // Vérification dans les pseudos collés (ex: keitarokia119, ericpacomegbocho21, haouadiakite)
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
    .select('id, contact_id, amount_cents, price_xof, recipient_name, created_at')
    .eq('user_id', userId)
    .limit(2500);

  const allContactsLightQuery = admin
    .from('contacts')
    .select('id, name, phone, created_at')
    .eq('user_id', userId)
    .limit(2500);

  const [ordersRes, contactsRes, allOrdersLightRes, allContactsLightRes] = await Promise.all([
    ordersQuery,
    contactsQuery,
    allOrdersLightQuery,
    allContactsLightQuery,
  ]);

  const newOrders = ordersRes.data || [];
  const newContacts = contactsRes.data || [];

  // 1. Calcul exact des Clients qui Reviennent & Meilleurs Clients (VIP) — sans jamais fusionner des inconnus par prénom
  const contactLookup = new Map<string, { name: string; phone: string }>();
  for (const c of allContactsLightRes.data || []) {
    contactLookup.set(c.id, { name: String(c.name || '').trim(), phone: String(c.phone || '').trim() });
  }

  const clientAgg = new Map<string, { name: string; phone: string; ordersCount: number; totalSpent: number }>();
  let totalAllRevenue = 0;

  for (const o of allOrdersLightRes.data || []) {
    const amt = Number(o.price_xof) || Math.round(Number(o.amount_cents || 0) / 100);
    totalAllRevenue += amt;
    const cInfo = o.contact_id ? contactLookup.get(o.contact_id) : undefined;
    const rawName = (cInfo?.name && !cInfo.name.startsWith('Client ') ? cInfo.name : '') || String(o.recipient_name || cInfo?.name || '').trim();
    const phone = cInfo?.phone || '';
    const phoneDigits = phone.replace(/\D/g, '');
    // Clé stricte : téléphone (>=8 chiffres) ou contact_id, sinon ordre individuel (jamais par prénom seul)
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

  // Activité des 7 derniers jours (contacts + ventes) pour transparence sur Aujourd'hui / Hier
  const dayStatsMap = new Map<string, { date: string; contacts: number; orders: number; revenue: number }>();
  const ensureDay = (iso: string) => {
    const key = String(iso || '').slice(0, 10);
    if (!key) return null;
    let d = dayStatsMap.get(key);
    if (!d) {
      d = { date: key, contacts: 0, orders: 0, revenue: 0 };
      dayStatsMap.set(key, d);
    }
    return d;
  };
  for (const c of allContactsLightRes.data || []) {
    const d = ensureDay(c.created_at);
    if (d) d.contacts += 1;
  }
  for (const o of allOrdersLightRes.data || []) {
    const d = ensureDay(o.created_at);
    if (d) {
      d.orders += 1;
      d.revenue += Number(o.price_xof) || Math.round(Number(o.amount_cents || 0) / 100);
    }
  }
  const recentDays = [...dayStatsMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  if (newOrders.length === 0 && newContacts.length === 0 && existingState?.last_report && !reset) {
    const refreshedReport = {
      ...existingState.last_report,
      totalUniqueBuyers: allBuyers.length,
      returningClientsCount,
      returningOrdersCount,
      returningRevenuePct,
      topClients,
      recentDays,
    };
    await admin
      .from('studio_analytics_state')
      .update({ last_report: refreshedReport, updated_at: nowIso })
      .eq('user_id', userId);
    return res.status(200).json({
      ok: true,
      upToDate: true,
      state: { ...existingState, last_report: refreshedReport },
      report: refreshedReport,
    });
  }

  // 2. Calculs mathématiques exacts du delta
  let deltaRevenue = 0;
  const countryMap = new Map<string, number>();

  for (const o of newOrders) {
    const amt = Number(o.price_xof) || Math.round(Number(o.amount_cents || 0) / 100);
    deltaRevenue += amt;
  }
  for (const c of newContacts) {
    const country = detectCountryFromPhone(c.phone);
    countryMap.set(country, (countryMap.get(country) || 0) + 1);
  }

  // 3. Déduplication stricte des personnes uniques (1 personne = 1 vote de sexe, jamais doublée)
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
    } else if (cleanName && !cleanName.toLowerCase().startsWith('client ') && ambiguousForAi.length < 180) {
      ambiguousForAi.push({
        id,
        name: cleanName.slice(0, 60),
        occasion: occasion.slice(0, 50),
        notes: notes.slice(0, 100),
      });
    } else {
      deltaUnknown += 1;
    }
  };

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

  let topOccasions: string[] = [];
  let verdict = '';
  let recommendations: string[] = [];

  if (kieApiKey) {
    try {
      const prompt = [
        'Tu es un analyste business expert pour un studio de chansons personnalisées vendues sur WhatsApp en Afrique francophone.',
        sinceAt
          ? 'On te donne UNIQUEMENT les nouveautés depuis la dernière analyse.'
          : 'Première analyse complète de tout l’historique du compte.',
        '',
        `Chiffres exacts de la période : ${newOrders.length} ventes, ${deltaRevenue} F CFA, ${newContacts.length} nouveaux contacts.`,
        `Fidélité globale : ${returningClientsCount} client(s) revenu(s) (>= 2 commandes) générant ${returningRevenuePct}% du chiffre d'affaires (${returningOrdersCount} commandes).`,
        `Top clients VIP : ${JSON.stringify(topClients.slice(0, 3))}`,
        `Pays : ${JSON.stringify(Object.fromEntries(countryMap))}`,
        `Précédent bilan : ${existingState?.last_report?.verdict || 'Aucun (bilan initial)'}`,
        '',
        `Fiches ambiguës à classer (${ambiguousForAi.length}) :`,
        JSON.stringify(ambiguousForAi),
        '',
        'Réponds STRICTEMENT en JSON valide :',
        '{',
        '  "genders": [ { "id": "uuid", "gender": "femme" | "homme" | "inconnu" } ],',
        '  "topOccasions": ["Occasion 1", "Occasion 2"],',
        '  "verdict": "2 à 3 phrases directes et concrètes sur la performance, la fidélité client et le profil qui achète.",',
        '  "recommendations": ["Action concrète 1", "Action concrète 2"]',
        '}',
        'Pour "genders" : déduis le sexe du CLIENT qui contacte (prénom ou pseudo africain/francophone, ou indice dans occasion/notes). Si impossible à savoir, mets "inconnu".',
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
          for (const item of ambiguousForAi) {
            if (!judgedIds.has(item.id)) deltaUnknown += 1;
          }
          if (Array.isArray(parsed.topOccasions)) topOccasions = parsed.topOccasions.slice(0, 4).map(String);
          if (typeof parsed.verdict === 'string') verdict = parsed.verdict;
          if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations.slice(0, 3).map(String);
        }
      }
    } catch (err) {
      console.error('analyze-business LLM error:', err);
      deltaUnknown += ambiguousForAi.length;
    }
  } else {
    deltaUnknown += ambiguousForAi.length;
  }

  if (!verdict) {
    verdict = `Période analysée : ${newOrders.length} vente(s) pour ${deltaRevenue.toLocaleString('fr-FR')} F CFA. ${returningClientsCount} client(s) fidèle(s) représentent ${returningRevenuePct}% de votre chiffre d'affaires.`;
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
    totalUniqueBuyers: allBuyers.length,
    returningClientsCount,
    returningOrdersCount,
    returningRevenuePct,
    topClients,
    recentDays,
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
