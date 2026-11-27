import { useEffect, useMemo, useState, type FC } from 'react';
import { MessageCircle, TrendingUp, Sparkles, Globe2, Users, Wallet, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import type { Order, StudioMetrics } from '../types';

interface RevenusViewProps {
  orders: Order[];
  metrics?: StudioMetrics;
  onOpenConversations?: () => void;
  onOpenVentes?: () => void;
  onSelectOrder?: (orderId: string, conversationId?: string, clientPhone?: string) => void;
  isWhatsAppConnected?: boolean;
}

type PeriodKey = '7d' | '30d' | 'all';
type SourceFilter = 'all' | 'whatsapp' | 'affiliate';

interface AffiliateCommission {
  order_id: string;
  created_at: string;
  order_price: number;
  commission: number;
  formula?: string;
  status?: string;
}

interface AffiliateStats {
  clicks_count: number;
  sales_count: number;
  conversion_rate: number;
  total_earned: number;
  balance: number;
  commissions: AffiliateCommission[];
}

const fmtFCFA = (amount: number) =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} F CFA`;

const getInitials = (name: string) => {
  const parts = (name || 'CL').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.slice(0, 2) || 'CL').toUpperCase();
};

function inferClientGender(rawName?: string): 'femme' | 'homme' | 'inconnu' {
  if (!rawName) return 'inconnu';
  const cleaned = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .trim();
  if (!cleaned || cleaned.startsWith('client ')) return 'inconnu';

  const FEMALE_NAMES = new Set([
    'mme', 'madame', 'mlle', 'mademoiselle', 'soeur', 'tante', 'tata', 'maman', 'reine', 'princesse',
    'fatou', 'fatoumata', 'aminata', 'amina', 'aicha', 'aichatou', 'awa', 'mariam', 'mariama', 'maimouna',
    'kadiatou', 'kady', 'kadi', 'kadidia', 'kadidja', 'salimata', 'sali', 'safiatou', 'safia', 'fanta',
    'djene', 'djeneba', 'rokia', 'rokhaya', 'binta', 'bintou', 'assita', 'assetou', 'oumou', 'oumu',
    'hawa', 'adama', 'nene', 'ramata', 'ramatoulaye', 'bibata', 'zenab', 'zeinab', 'zeynab', 'nafissatou',
    'nadia', 'nathalie', 'christelle', 'christine', 'carine', 'karine', 'sandrine', 'mireille', 'sonia',
    'ruth', 'esther', 'sarah', 'sara', 'grace', 'benedicte', 'beatrice', 'veronique', 'valerie', 'celine',
    'celestine', 'charlotte', 'claire', 'clarisse', 'cynthia', 'danielle', 'delphine', 'diane', 'dorothee',
    'edwige', 'elodie', 'elise', 'emilie', 'estelle', 'evelyne', 'fabienne', 'fanny', 'florence', 'francine',
    'francoise', 'genevieve', 'geraldine', 'ghislaine', 'giselle', 'gisele', 'helene', 'hortense', 'ines',
    'irene', 'isabelle', 'jacqueline', 'jeanne', 'jessica', 'jocelyne', 'joelle', 'josephine', 'judith',
    'julie', 'julienne', 'justine', 'laetitia', 'laure', 'laurence', 'lea', 'leila', 'leonie', 'linda',
    'lisa', 'louise', 'lucie', 'lydie', 'madeleine', 'magali', 'manon', 'marguerite', 'marie', 'marina',
    'marine', 'marlene', 'marthe', 'martine', 'melanie', 'melissa', 'michele', 'michelle', 'monique',
    'nadege', 'naomi', 'naomie', 'nicole', 'noelle', 'noemie', 'odette', 'odile', 'olivia',
    'pascale', 'patricia', 'pauline', 'pelagie', 'prisca', 'rachel', 'raissa', 'rebecca', 'regine', 'renee',
    'rita', 'rose', 'roseline', 'sabine', 'salome', 'sandra', 'solange', 'sophie', 'stephanie', 'suzanne',
    'sylviane', 'sylvie', 'tatiana', 'therese', 'vanessa', 'victoire', 'victoria', 'virginie', 'viviane',
    'yolande', 'yvette', 'yvonne', 'adjoua', 'akissi', 'affoue', 'aya', 'amenan', 'amoin', 'koffiwa',
    'abiba', 'habiba', 'habibatou', 'mawa', 'masseni', 'matenin', 'tenin', 'korotoumou', 'koro', 'noura',
    'aissata', 'aissatou', 'djamila', 'jamila', 'samira', 'yasmine', 'yasmina', 'chadia', 'fleur', 'angele',
    'angelique', 'audrey', 'aurelie', 'barbara', 'bernadette', 'brigitte', 'camille', 'caroline', 'catherine',
    'cecile', 'chantal', 'chloe', 'claudine', 'corinne', 'deborah', 'denise', 'edith', 'emmanuelle',
    'eugenie', 'flore', 'gabrielle', 'gaelle', 'georgette', 'germaine', 'gladys', 'henriette', 'honore',
    'jennifer', 'johanna', 'karen', 'katia', 'kelly', 'lara', 'laurette', 'liliane', 'line', 'lucile',
    'maelle', 'maeva', 'maite', 'marcelline', 'margaux', 'marianne', 'marjolaine', 'mathilde', 'maud',
    'mirella', 'morgane', 'muriel', 'myriam', 'nadine', 'nanou', 'natacha', 'nell', 'nelly', 'oceane',
    'ophelie', 'orlane', 'pamela', 'paula', 'paule', 'perrine', 'philomene', 'reine', 'roberta', 'romaine',
    'rosalie', 'roselyne', 'roxane', 'sabrina', 'salima', 'severine', 'sharon', 'sheila', 'simone', 'solene',
    'sonita', 'stella', 'tania', 'tiffany', 'valentine', 'veronica', 'wendy', 'zoe', 'solen',
  ]);

  const MALE_NAMES = new Set([
    'mr', 'monsieur', 'frere', 'tonton', 'papa', 'roi', 'prince',
    'moussa', 'ibrahim', 'ibrahima', 'issouf', 'issa', 'ismael', 'ismail', 'abdoul', 'abdoulaye', 'abou',
    'aboubacar', 'abraham', 'adam', 'adama', 'amadou', 'amamou', 'boubacar', 'boukary', 'cheick', 'cheikh',
    'daouda', 'dramane', 'drissa', 'idrissa', 'karim', 'kassim', 'lassina', 'madou', 'mahamadou', 'mamadou',
    'mamad', 'modibo', 'mohamed', 'mohammed', 'mouhamadou', 'moustapha', 'ousmane', 'oumar', 'oumarou',
    'salif', 'salifou', 'saydou', 'seydou', 'sidiki', 'souleymane', 'soumaila', 'tidiane', 'yacouba',
    'yaya', 'youssouf', 'zakaria', 'aziz', 'ali', 'aliou', 'amine', 'amir', 'anis', 'arthur', 'augustin',
    'axel', 'baptiste', 'basile', 'benjamin', 'benoit', 'bernard', 'bertrand', 'brice', 'bruno', 'cedric',
    'charles', 'christian', 'christophe', 'claude', 'clement', 'cyril', 'damien', 'daniel', 'david', 'denis',
    'didier', 'dieudonne', 'dimitri', 'dominique', 'dylan', 'edouard', 'elie', 'emile', 'emmanuel', 'eric',
    'ernest', 'etienne', 'fabien', 'fabrice', 'felix', 'fernand', 'florent', 'florian', 'franck', 'francois',
    'frederic', 'gabriel', 'gael', 'gaston', 'georges', 'gerard', 'germain', 'ghislain', 'gilbert', 'gilles',
    'gregoire', 'guillaume', 'guy', 'henri', 'herve', 'hugues', 'igor', 'ivan', 'jacques', 'jean', 'jeremie',
    'jerome', 'joel', 'jonathan', 'jordan', 'joseph', 'jules', 'julien', 'justin', 'kevin', 'koffi', 'kouadio',
    'kouakou', 'kouame', 'kouassi', 'konan', 'yao', 'nguessan', 'akossi', 'aubin', 'landry',
    'laurent', 'leo', 'leon', 'lionel', 'loic', 'louis', 'luc', 'lucas', 'ludovic', 'marc', 'marcel', 'martial',
    'martin', 'mathieu', 'matthieu', 'maurice', 'maxime', 'michel', 'mickael', 'moise', 'nathan', 'nicolas',
    'noel', 'norbert', 'olivier', 'omar', 'oscar', 'pascal', 'patrice', 'patrick', 'paul', 'philippe', 'pierre',
    'quentin', 'raphael', 'raymond', 'regis', 'remi', 'remy', 'renaud', 'rene', 'richard', 'robert', 'robin',
    'roger', 'roland', 'romain', 'romuald', 'samuel', 'sebastien', 'serge', 'simon', 'stephane', 'sylvain',
    'thierry', 'thomas', 'timothee', 'tony', 'tristan', 'ulrich', 'valentin', 'victor', 'vincent', 'wilfried',
    'william', 'willy', 'xavier', 'yann', 'yannick', 'yohan', 'yves', 'anicet', 'wendyam', 'alexandre', 'alexis',
    'alain', 'albert', 'alex', 'alfred', 'alphonse', 'andre', 'ange', 'antoine', 'armand', 'arnaud',
  ]);

  const tokens = cleaned.split(/[\s'-]+/).filter(Boolean);
  for (const tok of tokens.slice(0, 3)) {
    if (FEMALE_NAMES.has(tok)) return 'femme';
    if (MALE_NAMES.has(tok)) return 'homme';
  }
  return 'inconnu';
}

interface AiBusinessReport {
  analyzedAt: string;
  sinceAt: string | null;
  deltaOrders: number;
  deltaRevenue: number;
  deltaContacts: number;
  deltaWomen: number;
  deltaMen: number;
  deltaUnknown: number;
  womenCount: number;
  menCount: number;
  unknownCount: number;
  totalOrdersAnalyzed: number;
  totalRevenueAnalyzed: number;
  topOccasions?: string[];
  verdict: string;
  recommendations?: string[];
}

export const RevenusView: FC<RevenusViewProps> = ({
  orders,
  metrics,
  onSelectOrder,
}) => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Slug d'affiliation pour récupérer les commissions 50%
  const meta = user?.user_metadata || {};
  const studioName = (meta.studio_name as string) || 'Mon Studio';
  const cleanSlug =
    (meta.studio_slug as string) ||
    studioName.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
    'mon-studio';

  const [affiliateStats, setAffiliateStats] = useState<AffiliateStats>({
    clicks_count: 0,
    sales_count: 0,
    conversion_rate: 0,
    total_earned: 0,
    balance: 0,
    commissions: [],
  });

  const reportCacheKey = user?.id ? `velaris_ai_report_${user.id}` : '';
  const [aiReport, setAiReport] = useState<AiBusinessReport | null>(() => {
    if (!reportCacheKey || typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(reportCacheKey);
      return raw ? (JSON.parse(raw) as AiBusinessReport) : null;
    } catch {
      return null;
    }
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUpToDate, setAiUpToDate] = useState(false);

  useEffect(() => {
    if (!reportCacheKey) return;
    try {
      const raw = localStorage.getItem(reportCacheKey);
      if (raw) {
        setAiReport(JSON.parse(raw) as AiBusinessReport);
        return;
      }
    } catch {}
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/analyze-business', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!cancelled && json?.ok && json.report) {
          setAiReport(json.report);
          try { localStorage.setItem(reportCacheKey, JSON.stringify(json.report)); } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [reportCacheKey]);

  const runIncrementalAnalysis = async (reset = false) => {
    setAiLoading(true);
    setAiError(null);
    setAiUpToDate(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAiError('Session expirée, veuillez vous reconnecter.');
        return;
      }
      const res = await fetch('/api/analyze-business', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reset }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setAiError(json?.error || 'Impossible de lancer l\'analyse.');
        return;
      }
      if (json.report) {
        setAiReport(json.report);
        if (reportCacheKey) {
          try { localStorage.setItem(reportCacheKey, JSON.stringify(json.report)); } catch {}
        }
      }
      setAiUpToDate(Boolean(json.upToDate));
    } catch (err: any) {
      setAiError(err?.message || 'Erreur réseau lors de l\'analyse.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchAffiliate = async () => {
      try {
        const res = await fetch(
          `https://waha.velarisagent.life/api/stt/pay/affiliate/stats?slug=${encodeURIComponent(
            cleanSlug
          )}`
        );
        const json = await res.json();
        if (!cancelled && json.code === 200 && json.data) {
          setAffiliateStats(json.data);
        }
      } catch {
        // En cas d'indisponibilité temporaire, conserver l'état local
      }
    };
    fetchAffiliate();
    return () => {
      cancelled = true;
    };
  }, [cleanSlug]);

  // Commandes directes WhatsApp filtrées par période
  const filteredWhatsAppOrders = useMemo(() => {
    if (period === 'all') return orders;
    const now = Date.now();
    const days = period === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 3600 * 1000;

    return orders.filter((o) => {
      const parsed = Date.parse(o.rawCreatedAt || o.createdAt);
      if (Number.isNaN(parsed)) return true;
      return parsed >= cutoff;
    });
  }, [orders, period]);

  // Commissions d'affiliation filtrées par période
  const filteredCommissions = useMemo(() => {
    if (period === 'all') return affiliateStats.commissions;
    const now = Date.now();
    const days = period === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 3600 * 1000;

    return affiliateStats.commissions.filter((c) => {
      const parsed = Date.parse(c.created_at);
      if (Number.isNaN(parsed)) return true;
      return parsed >= cutoff;
    });
  }, [affiliateStats.commissions, period]);

  // Calculs financiers consolidés
  const directWhatsAppRevenue = useMemo(() => {
    const ordersSum = filteredWhatsAppOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    if (
      period === 'all' &&
      typeof metrics?.totalRevenue === 'number' &&
      metrics.totalRevenue > ordersSum
    ) {
      return metrics.totalRevenue;
    }
    return ordersSum;
  }, [filteredWhatsAppOrders, metrics?.totalRevenue, period]);

  const affiliateRevenue = useMemo(() => {
    if (period === 'all' && affiliateStats.total_earned > 0) {
      return affiliateStats.total_earned;
    }
    return filteredCommissions.reduce((sum, c) => sum + (c.commission || 0), 0);
  }, [affiliateStats.total_earned, filteredCommissions, period]);

  // REVENU TOTAL CONSOLIDÉ = VENTES DIRECTES WHATSAPP + COMMISSIONS AFFILIATION 50%
  const totalConsolidatedRevenue = directWhatsAppRevenue + affiliateRevenue;
  const totalSalesCount = filteredWhatsAppOrders.length + filteredCommissions.length;
  const avgBasket = totalSalesCount > 0 ? Math.round(totalConsolidatedRevenue / totalSalesCount) : 0;

  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Statistiques avancées (Pays majeurs, Sexe des Clients, Paiements, Créneaux horaires, Taux de livraison)
  const analytics = useMemo(() => {
    const countryMap = new Map<string, { name: string; code: string; count: number; revenue: number }>();
    const genderMap = { Femme: 0, Homme: 0, Inconnu: 0 };
    const paymentMap = new Map<string, { label: string; count: number; revenue: number }>();
    const formulaMap = new Map<string, { label: string; count: number; revenue: number }>();
    const slotMap = { Matin: 0, 'Après-midi': 0, Soirée: 0, Nuit: 0 };
    let deliveredCount = 0;

    for (const o of filteredWhatsAppOrders) {
      // 1. Pays
      const cName = o.country || 'Afrique de l’Ouest';
      const cCode = o.countryCode || 'AFR';
      const prevC = countryMap.get(cName) || { name: cName, code: cCode, count: 0, revenue: 0 };
      prevC.count += 1;
      prevC.revenue += o.amount || 0;
      countryMap.set(cName, prevC);

      // 2. Sexe du client qui nous contacte (détection par prénom)
      const g = inferClientGender(o.clientName);
      if (g === 'femme') genderMap.Femme += 1;
      else if (g === 'homme') genderMap.Homme += 1;
      else genderMap.Inconnu += 1;

      // 3. Moyen de paiement
      const rawPay = (o.paymentMethod || 'Wave').trim();
      const payLabel = /orange/i.test(rawPay)
        ? 'Orange Money'
        : /wave/i.test(rawPay)
        ? 'Wave'
        : /mtn/i.test(rawPay)
        ? 'MTN MoMo'
        : rawPay || 'Mobile Money';
      const prevP = paymentMap.get(payLabel) || { label: payLabel, count: 0, revenue: 0 };
      prevP.count += 1;
      prevP.revenue += o.amount || 0;
      paymentMap.set(payLabel, prevP);

      // 4. Formules par montant
      const amt = Math.round(o.amount || 0);
      const fLabel = amt > 0 ? `${amt.toLocaleString('fr-FR')} F` : 'Autre';
      const prevF = formulaMap.get(fLabel) || { label: fLabel, count: 0, revenue: 0 };
      prevF.count += 1;
      prevF.revenue += amt;
      formulaMap.set(fLabel, prevF);

      // 5. Créneau horaire
      const ts = o.rawCreatedAt ? Date.parse(o.rawCreatedAt) : NaN;
      if (!Number.isNaN(ts)) {
        const h = new Date(ts).getHours();
        if (h >= 6 && h < 12) slotMap.Matin += 1;
        else if (h >= 12 && h < 18) slotMap['Après-midi'] += 1;
        else if (h >= 18) slotMap.Soirée += 1;
        else slotMap.Nuit += 1;
      }

      if (o.status === 'livre') deliveredCount += 1;
    }

    const topCountries = [...countryMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const topPayments = [...paymentMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    const topFormulas = [...formulaMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    const identifiedGenderTotal = genderMap.Femme + genderMap.Homme || 1;
    const genderBreakdown = [
      { label: 'Femmes', count: genderMap.Femme, pct: Math.round((genderMap.Femme / identifiedGenderTotal) * 100) },
      { label: 'Hommes', count: genderMap.Homme, pct: Math.round((genderMap.Homme / identifiedGenderTotal) * 100) },
    ];
    const unknownGenderCount = genderMap.Inconnu;
    const peakSlot = Object.entries(slotMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Soirée';
    const deliveryRate = filteredWhatsAppOrders.length > 0
      ? Math.round((deliveredCount / filteredWhatsAppOrders.length) * 100)
      : 0;

    return {
      topCountries,
      topPayments,
      topFormulas,
      genderBreakdown,
      unknownGenderCount,
      slotMap,
      peakSlot,
      deliveryRate,
      deliveredCount,
    };
  }, [filteredWhatsAppOrders]);

  // Liste unifiée des transactions récentes (WhatsApp + Affiliation)
  interface UnifiedTransaction {
    id: string;
    type: 'whatsapp' | 'affiliate';
    clientName: string;
    clientPhone?: string;
    country?: string;
    countryCode?: string;
    exactTime?: string;
    conversationId?: string;
    subtitle: string;
    amount: number;
    rawDate: string;
    status: string;
    orderRef?: Order;
    commissionRef?: AffiliateCommission;
  }

  const unifiedTransactions = useMemo<UnifiedTransaction[]>(() => {
    const list: UnifiedTransaction[] = [];

    // Ajouter les commandes WhatsApp directes
    filteredWhatsAppOrders.forEach((o) => {
      list.push({
        id: `wa-${o.id}`,
        type: 'whatsapp',
        clientName: o.clientName || 'Client WhatsApp',
        clientPhone: o.clientPhone,
        country: o.country || 'Afrique de l’Ouest',
        countryCode: o.countryCode || 'AFR',
        exactTime: o.exactTime || o.createdAt,
        conversationId: o.conversationId,
        subtitle: `${o.occasion || 'Chanson personnalisée'}${
          o.paymentMethod ? ` · ${o.paymentMethod}` : ''
        }`,
        amount: o.amount || 0,
        rawDate: o.rawCreatedAt || o.createdAt || new Date().toISOString(),
        status: o.status === 'livre' ? 'Livré' : 'Validé',
        orderRef: o,
      });
    });

    // Ajouter les commissions d'affiliation
    filteredCommissions.forEach((c) => {
      const orderShortId = c.order_id ? c.order_id.slice(-6).toUpperCase() : 'REC';
      list.push({
        id: `aff-${c.order_id}`,
        type: 'affiliate',
        clientName: `Commande #${orderShortId}`,
        subtitle: `Commission 50% · Formule ${c.formula || 'Chanson'} (Vente ${fmtFCFA(
          c.order_price || 0
        )})`,
        amount: c.commission || 0,
        rawDate: c.created_at || new Date().toISOString(),
        status: c.status || 'Validée',
        commissionRef: c,
      });
    });

    // Trier par date décroissante
    list.sort((a, b) => {
      const timeA = Date.parse(a.rawDate) || 0;
      const timeB = Date.parse(b.rawDate) || 0;
      return timeB - timeA;
    });

    // Appliquer le filtre de source
    if (sourceFilter === 'whatsapp') return list.filter((t) => t.type === 'whatsapp');
    if (sourceFilter === 'affiliate') return list.filter((t) => t.type === 'affiliate');
    return list;
  }, [filteredWhatsAppOrders, filteredCommissions, sourceFilter]);

  // Courbe douce de tendance
  const curvePath =
    period === '7d'
      ? 'M 0 46 C 45 42, 75 30, 120 32 C 165 34, 210 18, 255 20 C 285 21, 305 10, 320 6'
      : period === '30d'
      ? 'M 0 50 C 45 46, 85 36, 130 38 C 175 40, 215 20, 260 16 C 290 14, 305 8, 320 4'
      : 'M 0 52 C 55 48, 110 38, 165 28 C 215 18, 265 12, 320 4';

  const fillPath = `${curvePath} L 320 64 L 0 64 Z`;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* 1. GRANDE CARTE SOLDE CONSOLIDÉ STYLE STRIPE LUMINEUX */}
      <section className="stripe-glow-card rounded-[28px] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10D98E] animate-pulse" />
            <span className="text-xs font-medium text-white/80">
              Revenu Central Consolidé (Direct WhatsApp + Affiliation 50%)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/[0.08]">
            {(
              [
                ['7d', '7j'],
                ['30d', '30j'],
                ['all', 'Tout'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  period === key
                    ? 'bg-white text-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Montant Total Consolidé */}
        <div className="space-y-3">
          <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white tabular-nums leading-none">
            {fmtFCFA(totalConsolidatedRevenue)}
          </div>

          {/* Ventilation nette : WhatsApp Direct vs Affiliation 50% */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10D98E]/10 border border-[#10D98E]/25 text-[#10D98E] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10D98E]" />
              <span>WhatsApp Direct : {fmtFCFA(directWhatsAppRevenue)}</span>
              <span className="text-white/40">({filteredWhatsAppOrders.length})</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E2BD6B]/15 border border-[#E2BD6B]/30 text-[#E2BD6B] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E2BD6B]" />
              <span>Affiliation 50% : {fmtFCFA(affiliateRevenue)}</span>
              <span className="text-white/40">({filteredCommissions.length})</span>
            </div>

            <span className="text-white/40 text-[11px] hidden sm:inline">
              Encaissements Wave & Orange Money
            </span>
          </div>
        </div>

        {/* Courbe SVG fluide lumineuse */}
        <div className="pt-2">
          <svg
            viewBox="0 0 320 64"
            className="w-full h-14 overflow-visible"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="velarisRevenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E2BD6B" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#E2BD6B" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPath} fill="url(#velarisRevenueArea)" />
            <path
              d={curvePath}
              fill="none"
              stroke="#E2BD6B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="320" cy={period === '7d' ? '6' : '4'} r="4" fill="#FFF3D1" />
          </svg>
        </div>
      </section>

      {/* 2. STATISTIQUES & INDICATEURS DÉTAILLÉS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pôle WhatsApp Direct */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Ventes Directes</span>
            <span className="w-2 h-2 rounded-full bg-[#10D98E]" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {fmtFCFA(directWhatsAppRevenue)}
          </p>
          <p className="text-[11px] text-[#8A90A0]">
            {filteredWhatsAppOrders.length} client{filteredWhatsAppOrders.length > 1 ? 's' : ''} WhatsApp
          </p>
        </div>

        {/* Pôle Affiliation 50% */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Commissions Affiliation</span>
            <span className="w-2 h-2 rounded-full bg-[#E2BD6B]" />
          </div>
          <p className="text-2xl font-bold text-[#E2BD6B] tabular-nums">
            {fmtFCFA(affiliateRevenue)}
          </p>
          <p className="text-[11px] text-[#8A90A0]">
            {filteredCommissions.length} vente{filteredCommissions.length > 1 ? 's' : ''} via lien court
          </p>
        </div>

        {/* Panier Moyen Global */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Panier Moyen</span>
            <TrendingUp className="w-3.5 h-3.5 text-white/40" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {avgBasket > 0 ? fmtFCFA(avgBasket) : '—'}
          </p>
          <p className="text-[11px] text-[#8A90A0]">Sur l'ensemble des canaux</p>
        </div>

        {/* Taux de Conversion ou Total Ventes */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A90A0]">Volume Total</span>
            <Sparkles className="w-3.5 h-3.5 text-[#E2BD6B]" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{totalSalesCount}</p>
          <p className="text-[11px] text-[#8A90A0]">
            {affiliateStats.clicks_count > 0
              ? `${affiliateStats.clicks_count} clics · ${(
                  (totalSalesCount / affiliateStats.clicks_count) *
                  100
                ).toFixed(1)}% conv.`
              : 'Commandes traitées'}
          </p>
        </div>
      </section>

      {/* 2B. ANALYSE IA INCRÉMENTALE (À LA DEMANDE) */}
      <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E2BD6B]" />
              <span className="text-sm font-semibold text-white">Bilan & Jugement IA</span>
              {aiUpToDate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#10D98E] bg-[#10D98E]/10 border border-[#10D98E]/20 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="w-3 h-3" /> À jour
                </span>
              )}
            </div>
            <p className="text-xs text-[#8A90A0]">
              {aiReport?.analyzedAt
                ? `Dernière analyse le ${new Date(aiReport.analyzedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — reprendra uniquement les nouveautés.`
                : 'Analyse à la demande des nouveaux contacts, sexes, occasions et revenus.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {aiReport && (
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => runIncrementalAnalysis(true)}
                className="px-3 py-2 rounded-full text-xs text-[#8A90A0] hover:text-white border border-white/[0.08] hover:border-white/20 transition disabled:opacity-50"
              >
                Tout réanalyser
              </button>
            )}
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => runIncrementalAnalysis(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#08090C] text-xs font-semibold hover:bg-white/90 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
              {aiLoading ? 'Analyse en cours...' : aiReport ? 'Analyser les nouveautés' : 'Analyser ma journée'}
            </button>
          </div>
        </div>

        {aiError && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {aiError}
          </p>
        )}

        {aiReport && (
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/80 font-mono">
                +{aiReport.deltaOrders} vente{aiReport.deltaOrders > 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#E2BD6B] font-mono">
                +{fmtFCFA(aiReport.deltaRevenue)}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/80 font-mono">
                +{aiReport.deltaContacts} contact{aiReport.deltaContacts > 1 ? 's' : ''}
              </span>
              {(aiReport.deltaWomen > 0 || aiReport.deltaMen > 0) && (
                <span className="px-2.5 py-1 rounded-full bg-[#10D98E]/10 border border-[#10D98E]/20 text-[#10D98E] font-mono">
                  +{aiReport.deltaWomen} F / +{aiReport.deltaMen} H
                </span>
              )}
              {(aiReport.topOccasions || []).map((occ) => (
                <span key={occ} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/70">
                  {occ}
                </span>
              ))}
            </div>

            <p className="text-xs leading-relaxed text-white/90">{aiReport.verdict}</p>

            {aiReport.recommendations && aiReport.recommendations.length > 0 && (
              <ul className="space-y-1 text-xs text-[#8A90A0]">
                {aiReport.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#E2BD6B] font-mono text-[11px]">0{i + 1}</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* 2C. ANALYTIQUE DÉTAILLÉE (PAYS MAJEURS, SEXE DES CLIENTS, PAIEMENTS, CRÉNEAUX) */}
      {filteredWhatsAppOrders.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Pays Majeurs */}
          <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Pays Majeurs</span>
              <Globe2 className="w-4 h-4 text-[#E2BD6B]" />
            </div>
            <div className="space-y-2.5">
              {analytics.topCountries.map((c) => {
                const pct = Math.round((c.count / filteredWhatsAppOrders.length) * 100);
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/90 truncate flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[9px] font-mono text-[#E2BD6B]">
                          {c.code}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#8A90A0] shrink-0">
                        {c.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#E2BD6B]"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sexe des Clients */}
          <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                Sexe des Clients {aiReport && (aiReport.womenCount + aiReport.menCount > 0) ? '· IA' : ''}
              </span>
              <Users className="w-4 h-4 text-[#10D98E]" />
            </div>
            <div className="space-y-2.5">
              {(aiReport && (aiReport.womenCount + aiReport.menCount > 0)
                ? [
                    {
                      label: 'Femmes',
                      count: aiReport.womenCount,
                      pct: Math.round((aiReport.womenCount / (aiReport.womenCount + aiReport.menCount)) * 100),
                    },
                    {
                      label: 'Hommes',
                      count: aiReport.menCount,
                      pct: Math.round((aiReport.menCount / (aiReport.womenCount + aiReport.menCount)) * 100),
                    },
                  ]
                : analytics.genderBreakdown
              ).map((g) => (
                <div key={g.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/90">{g.label}</span>
                    <span className="font-mono text-[11px] text-[#8A90A0]">
                      {g.count} ({g.pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#10D98E]"
                      style={{ width: `${Math.max(2, g.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
              {(aiReport ? aiReport.unknownCount : analytics.unknownGenderCount) > 0 && (
                <p className="text-[11px] text-[#6B7280] pt-1">
                  {aiReport ? aiReport.unknownCount : analytics.unknownGenderCount} non identifié(s)
                </p>
              )}
            </div>
          </div>

          {/* Moyens de Paiement & Formules */}
          <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Paiements & Formules</span>
              <Wallet className="w-4 h-4 text-sky-400" />
            </div>
            <div className="space-y-2">
              {analytics.topPayments.map((p) => (
                <div key={p.label} className="flex items-center justify-between text-xs">
                  <span className="text-white/90">{p.label}</span>
                  <span className="font-mono text-[11px] text-white/70">
                    {fmtFCFA(p.revenue)} <span className="text-white/40">({p.count})</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-1.5">
              {analytics.topFormulas.map((f) => (
                <span
                  key={f.label}
                  className="px-2 py-0.5 rounded-full bg-white/[0.05] text-[10px] font-mono text-[#8A90A0]"
                >
                  {f.label} · {f.count}x
                </span>
              ))}
            </div>
          </div>

          {/* Créneaux & Livraison */}
          <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Rythme & Livraison</span>
              <Clock className="w-4 h-4 text-violet-400" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(analytics.slotMap).map(([slot, cnt]) => (
                <div
                  key={slot}
                  className={`p-2 rounded-xl border ${
                    slot === analytics.peakSlot
                      ? 'bg-[#E2BD6B]/10 border-[#E2BD6B]/30 text-white'
                      : 'bg-white/[0.02] border-white/[0.05] text-[#8A90A0]'
                  }`}
                >
                  <p className="text-[10px] font-mono uppercase">{slot}</p>
                  <p className="text-sm font-bold tabular-nums">{cnt}</p>
                </div>
              ))}
            </div>
            <div className="pt-1 flex items-center justify-between text-[11px] text-[#8A90A0]">
              <span>Taux de livraison</span>
              <span className="font-mono font-semibold text-[#10D98E]">
                {analytics.deliveryRate}% ({analytics.deliveredCount}/{filteredWhatsAppOrders.length})
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 3. HISTORIQUE & JOURNAL DES TRANSACTIONS */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Journal des Transactions</h2>
            <p className="text-xs text-[#8A90A0]">
              Historique complet de vos clients et accès direct WhatsApp en 1 clic.
            </p>
          </div>

          {/* Filtres de source */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0D0F14] border border-white/[0.06] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                sourceFilter === 'all'
                  ? 'bg-white text-black'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              Toutes ({filteredWhatsAppOrders.length + filteredCommissions.length})
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter('whatsapp')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                sourceFilter === 'whatsapp'
                  ? 'bg-[#10D98E] text-black font-bold'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              WhatsApp Direct ({filteredWhatsAppOrders.length})
            </button>

            <button
              type="button"
              onClick={() => setSourceFilter('affiliate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                sourceFilter === 'affiliate'
                  ? 'bg-[#E2BD6B] text-black font-bold'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              Affiliation ({filteredCommissions.length})
            </button>
          </div>
        </div>

        {/* Liste des transactions unifiées */}
        {unifiedTransactions.length > 0 ? (
          <div className="space-y-4">
            <div className="divide-y divide-white/[0.06] rounded-3xl bg-[#08090C] border border-white/[0.06] overflow-hidden px-4 sm:px-6">
              {unifiedTransactions.slice(0, visibleCount).map((tx) => {
                const cleanPhone = tx.clientPhone?.replace(/[^0-9]/g, '');
                const isWhatsApp = tx.type === 'whatsapp';

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      if (isWhatsApp) {
                        onSelectOrder?.(tx.orderRef?.id || '', tx.conversationId, tx.clientPhone);
                      }
                    }}
                    className={`py-4 px-2 -mx-2 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isWhatsApp ? 'hover:bg-white/[0.04] cursor-pointer' : ''
                    }`}
                  >
                    {/* Côté gauche : Avatar + Nom + Téléphone + Pays + Heure */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
                          isWhatsApp
                            ? 'bg-[#10D98E]/10 border border-[#10D98E]/25 text-[#10D98E]'
                            : 'bg-[#E2BD6B]/15 border border-[#E2BD6B]/30 text-[#E2BD6B]'
                        }`}
                      >
                        <span className="text-xs font-bold leading-none">
                          {isWhatsApp ? getInitials(tx.clientName) : '50%'}
                        </span>
                        {isWhatsApp && tx.countryCode && (
                          <span className="text-[9px] font-mono font-semibold tracking-wider opacity-80 mt-0.5">
                            {tx.countryCode}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">
                            {tx.clientName}
                          </p>
                          {tx.clientPhone && (
                            <span className="text-xs font-mono text-[#C7CAD4] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
                              {tx.clientPhone}
                            </span>
                          )}
                          {tx.country && (
                            <span className="text-[10px] font-medium text-[#A6ABB9] px-2 py-0.5 rounded-md bg-white/[0.03]">
                              {tx.country}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A90A0]">
                          <span>{tx.subtitle}</span>
                          {tx.exactTime && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[11px] text-[#A6ABB9]">
                                {tx.exactTime}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Côté droit : Bouton WhatsApp direct + Montant + Statut */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-14 sm:pl-0">
                      {isWhatsApp && cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#10D98E]/10 hover:bg-[#10D98E]/20 text-[#10D98E] text-xs font-semibold border border-[#10D98E]/25 transition-colors cursor-pointer"
                          title={`Ouvrir WhatsApp avec ${tx.clientName}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <div className="text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isWhatsApp ? 'text-[#10D98E]' : 'text-[#E2BD6B]'
                          }`}
                        >
                          +{fmtFCFA(tx.amount)}
                        </p>
                        <p className="text-[11px] text-[#8A90A0] mt-0.5 font-mono">
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination / Voir plus */}
            {unifiedTransactions.length > visibleCount && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 50)}
                  className="px-5 py-2.5 rounded-2xl bg-[#0D0F14] hover:bg-[#141720] border border-white/[0.08] text-xs font-semibold text-white transition-all cursor-pointer inline-flex items-center gap-2 shadow-md"
                >
                  <span>Afficher 50 transactions supplémentaires ({visibleCount} / {unifiedTransactions.length})</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-8 text-center space-y-2">
            <p className="text-sm font-medium text-white">Aucune transaction enregistrée</p>
            <p className="text-xs text-[#8A90A0] max-w-sm mx-auto leading-relaxed">
              Dès qu’une vente est effectuée sur WhatsApp ou via votre lien d’affiliation personnalisé, elle apparaîtra ici avec son montant et un accès direct au client.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
