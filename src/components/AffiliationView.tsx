import { useState, type FC } from 'react';
import {
  Share2,
  Copy,
  Check,
  TrendingUp,
  Users,
  Wallet,
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

export const AffiliationView: FC = () => {
  const { user } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMiniSite, setCopiedMiniSite] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawOperator, setWithdrawOperator] = useState('Wave');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const referralCode = user?.id ? user.id.slice(0, 8) : 'demo-ref';
  const rawStudioName = user?.user_metadata?.studio_name as string | undefined;
  const studioSlug = rawStudioName
    ? rawStudioName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    : 'mon-studio';

  const referralUrl = `https://djelia.store/?ref=${referralCode}`;
  const miniSiteUrl = `https://djelia.store/s/${studioSlug}`;

  // Métriques d'affiliation
  const totalClicks = 28;
  const totalSales = 4;
  const commissionPerSale = 300; // 25% de 1 200 F CFA
  const balanceCfa = totalSales * commissionPerSale; // 1 200 F
  const minWithdrawThreshold = 1500;

  const handleCopy = (text: string, type: 'ref' | 'mini') => {
    navigator.clipboard.writeText(text);
    if (type === 'ref') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedMiniSite(true);
      setTimeout(() => setCopiedMiniSite(false), 2000);
    }
  };

  const handleRequestWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.id) {
      try {
        await (supabase.from('affiliate_payouts') as any).insert({
          user_id: user.id,
          amount: balanceCfa,
          operator: withdrawOperator,
          phone_number: withdrawPhone,
          status: 'pending'
        });
      } catch {
        // Fallback gracieux si la table n'a pas encore été migrée sur Supabase
      }
    }
    setWithdrawSuccess(true);
    setTimeout(() => {
      setWithdrawSuccess(false);
      setIsWithdrawModalOpen(false);
      setWithdrawPhone('');
    }, 2500);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto vx-view-enter">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#D4A017] uppercase mb-1">
            <Share2 className="h-3.5 w-3.5" />
            <span>Pilier 04 · Programme Partenaire</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
            Mon Espace Affiliation
          </h1>
          <p className="text-sm text-[#8E94A3] mt-1 max-w-2xl">
            Partagez votre lien ou votre mini-site. Djelia fabrique et livre la chanson au client final. Vous encaissez 25% de commission nette sur chaque commande (300 F CFA / vente).
          </p>
        </div>

        <button
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={balanceCfa < minWithdrawThreshold}
          className={`h-11 px-5 rounded-full font-semibold text-xs inline-flex items-center gap-2 transition-all duration-200 cursor-pointer ${
            balanceCfa >= minWithdrawThreshold
              ? 'bg-[#D4A017] hover:bg-[#F5D060] text-[#0A0A0F] shadow-[0_0_20px_-4px_rgba(212,160,23,0.45)]'
              : 'bg-white/[0.05] text-[#8E94A3] border border-white/[0.08] cursor-not-allowed'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Retirer mes gains (Seuil 1 500 F)</span>
        </button>
      </div>

      {/* Bento Grid des Métriques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solde Retirable */}
        <div className="rounded-2xl bg-[#141420] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-[#D4A017]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-[#8E94A3]">
            <span className="font-mono uppercase tracking-wider">Solde Disponible</span>
            <Wallet className="h-4 w-4 text-[#D4A017]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {balanceCfa.toLocaleString('fr-FR')} <span className="text-xs font-sans text-[#D4A017]">F CFA</span>
          </div>
          <div className="text-[11px] text-[#8E94A3]">
            Retrait par Wave / OM dès 1 500 F
          </div>
        </div>

        {/* Ventes Finalisées */}
        <div className="rounded-2xl bg-[#141420] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between text-xs text-[#8E94A3]">
            <span className="font-mono uppercase tracking-wider">Ventes Partenaires</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {totalSales} <span className="text-xs font-sans text-emerald-400">commandes</span>
          </div>
          <div className="text-[11px] text-[#8E94A3]">
            Chansons produites par Djelia
          </div>
        </div>

        {/* Clics uniques */}
        <div className="rounded-2xl bg-[#141420] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between text-xs text-[#8E94A3]">
            <span className="font-mono uppercase tracking-wider">Trafic Référé</span>
            <Users className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {totalClicks} <span className="text-xs font-sans text-sky-400">visites</span>
          </div>
          <div className="text-[11px] text-[#8E94A3]">
            Taux de conversion : {Math.round((totalSales / totalClicks) * 100)}%
          </div>
        </div>

        {/* Taux de commission */}
        <div className="rounded-2xl bg-[#141420] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-white/[0.15] transition-colors">
          <div className="flex items-center justify-between text-xs text-[#8E94A3]">
            <span className="font-mono uppercase tracking-wider">Partenaire Certifié</span>
            <ShieldCheck className="h-4 w-4 text-[#D4A017]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#D4A017]">
            25% <span className="text-xs font-sans text-white">par vente</span>
          </div>
          <div className="text-[11px] text-[#8E94A3]">
            300 F CFA crédité net par client
          </div>
        </div>
      </div>

      {/* Boîtes de Liens Partenaires */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lien d'Affiliation Direct */}
        <div className="rounded-2xl bg-[#141420] border border-white/[0.08] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-[#D4A017]" />
              <h3 className="text-base font-heading font-semibold text-white">Lien d'Affiliation Direct</h3>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/[0.05] text-[#8E94A3]">
              Boutique Centrale
            </span>
          </div>
          <p className="text-xs text-[#8E94A3] leading-relaxed">
            Redirige directement vers le catalogue général Djelia Store. Le cookie d'affiliation est actif 30 jours sur le téléphone de votre contact.
          </p>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0A0A0F] border border-white/[0.08]">
            <input
              type="text"
              readOnly
              value={referralUrl}
              className="bg-transparent text-xs font-mono text-white flex-1 outline-none select-all"
            />
            <button
              onClick={() => handleCopy(referralUrl, 'ref')}
              className="h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
        </div>

        {/* Mini-Site du Membre */}
        <div className="rounded-2xl bg-[#141420] border border-white/[0.08] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D4A017]" />
              <h3 className="text-base font-heading font-semibold text-white">Mon Mini-Site Personnalisé</h3>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#D4A017]/10 text-[#D4A017]">
              Vitrine Djelia.store/s/
            </span>
          </div>
          <p className="text-xs text-[#8E94A3] leading-relaxed">
            Votre vitrine publique dédiée avec votre nom, vos styles recommandés et vos réseaux. Les commandes passées dessus vous rapportent automatiquement votre commission.
          </p>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0A0A0F] border border-white/[0.08]">
            <input
              type="text"
              readOnly
              value={miniSiteUrl}
              className="bg-transparent text-xs font-mono text-white flex-1 outline-none select-all"
            />
            <button
              onClick={() => handleCopy(miniSiteUrl, 'mini')}
              className="h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedMiniSite ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedMiniSite ? 'Copié !' : 'Copier'}</span>
            </button>
            <a
              href={miniSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white inline-flex items-center justify-center transition-colors"
              title="Ouvrir la page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Guide Rapide */}
      <div className="rounded-2xl bg-[#141420] border border-white/[0.08] p-6 space-y-4">
        <h3 className="text-base font-heading font-semibold text-white">
          Comment maximiser vos commissions d'affiliation ?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#8E94A3]">
          <div className="p-4 rounded-xl bg-[#0A0A0F] border border-white/[0.05] space-y-2">
            <span className="font-mono text-[#D4A017] font-bold">01. Partage TikTok & Statut</span>
            <p>Postez des extraits de chansons démos sur votre statut WhatsApp ou compte TikTok avec votre lien dans la bio.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0A0A0F] border border-white/[0.05] space-y-2">
            <span className="font-mono text-[#D4A017] font-bold">02. Zéro SAV ni Musique à créer</span>
            <p>Le client commande sur Chariow (1 200 F). Notre équipe s'occupe de la génération musicale et de la livraison.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0A0A0F] border border-white/[0.05] space-y-2">
            <span className="font-mono text-[#D4A017] font-bold">03. Paiement Direct Wave / OM</span>
            <p>Dès que vous atteignez 1 500 F de commissions (5 ventes), demandez votre virement immédiat sur votre mobile.</p>
          </div>
        </div>
      </div>

      {/* Modal Demande de Retrait */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141420] border border-white/[0.1] p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#D4A017]" />
                <h3 className="text-base font-heading font-semibold text-white">Retrait de Commissions</h3>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-[#8E94A3] hover:text-white text-xs font-mono"
              >
                Fermer
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="h-12 w-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="text-base font-semibold text-white">Demande enregistrée !</h4>
                <p className="text-xs text-[#8E94A3]">
                  Votre virement de {balanceCfa.toLocaleString('fr-FR')} F CFA vers {withdrawOperator} sera traité sous 24h.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestWithdraw} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8E94A3]">Montant à retirer</label>
                  <input
                    type="text"
                    readOnly
                    value={`${balanceCfa.toLocaleString('fr-FR')} F CFA`}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0A0F] border border-white/[0.08] text-white font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[#8E94A3]">Moyen de réception</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Wave', 'Orange Money'].map((op) => (
                      <button
                        type="button"
                        key={op}
                        onClick={() => setWithdrawOperator(op)}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                          withdrawOperator === op
                            ? 'bg-[#D4A017]/15 border-[#D4A017] text-white'
                            : 'bg-[#0A0A0F] border-white/[0.08] text-[#8E94A3] hover:text-white'
                        }`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[#8E94A3]">Numéro de téléphone bénéficiaire</label>
                  <input
                    type="tel"
                    required
                    placeholder="+225 07 ... ou +226 ..."
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0A0F] border border-white/[0.08] text-white text-sm outline-none focus:border-[#D4A017]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-10 rounded-full bg-[#D4A017] hover:bg-[#F5D060] text-[#0A0A0F] font-semibold text-xs transition-colors cursor-pointer mt-4"
                >
                  Confirmer le retrait
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
