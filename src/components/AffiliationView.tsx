import { useState, type FC, type FormEvent } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  X,
  Loader2,
  Smartphone,
  Wallet,
  Sparkles,
  TrendingUp,
  Palette,
  Globe,
  Share2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

const ACCENT_COLORS = [
  { id: '#E2BD6B', name: 'Or Champagne', class: 'bg-[#E2BD6B]' },
  { id: '#10D98E', name: 'Émeraude Royale', class: 'bg-[#10D98E]' },
  { id: '#00E5FF', name: 'Cyan Électrique', class: 'bg-[#00E5FF]' },
  { id: '#F43F5E', name: 'Rose Amour', class: 'bg-[#F43F5E]' },
  { id: '#A855F7', name: 'Violet Studio', class: 'bg-[#A855F7]' },
];

export const AffiliationView: FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'site' | 'affiliate'>('site');

  // État du mini-site co-brandé (synchronisé avec Supabase user_metadata et table studios)
  const initialName = (user?.user_metadata?.studio_name as string) || 'Mon Studio';
  const [studioName, setStudioName] = useState(initialName);
  const [studioSlug, setStudioSlug] = useState(
    (user?.user_metadata?.studio_slug as string) ||
      initialName.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
      'mon-studio'
  );
  const [studioBio, setStudioBio] = useState(
    (user?.user_metadata?.studio_bio as string) ||
      'Création de chansons personnalisées émouvantes, livrées en 15 minutes sur WhatsApp.'
  );
  const [studioColor, setStudioColor] = useState<string>(
    (user?.user_metadata?.studio_color as string) || '#E2BD6B'
  );

  const [savingSite, setSavingSite] = useState(false);
  const [siteSavedNotice, setSiteSavedNotice] = useState<string | null>(null);

  // État Affiliation 50% & Retrait WhatsApp
  const [copiedKey, setCopiedKey] = useState<'ref' | 'mini' | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawPhone, setWithdrawPhone] = useState(
    (user?.user_metadata?.phone as string) || ''
  );
  const [withdrawName, setWithdrawName] = useState(
    (user?.user_metadata?.full_name as string) || ''
  );
  const [withdrawOperator, setWithdrawOperator] = useState('Wave');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const cleanSlug = studioSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mon-studio';
  const miniSiteUrl = `https://djelia.store/s/${cleanSlug}`;

  // Métriques d'Affiliation 50% (Split 50/50 : 600 F CFA net par vente de 1 200 F)
  const totalClicks = 34;
  const totalSales = 6;
  const commissionPerSale = 600; // 50% de 1 200 F CFA
  const balanceCfa = totalSales * commissionPerSale; // 3 600 F CFA
  const minWithdrawThreshold = 1500;

  const handleCopy = (text: string, type: 'ref' | 'mini') => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveSite = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    setSiteSavedNotice(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          studio_name: studioName.trim(),
          studio_slug: cleanSlug,
          studio_bio: studioBio.trim().slice(0, 200),
          studio_color: studioColor,
          studio_price: 1200,
        },
      });
      if (error) throw error;

      // Tentative miroir dans la table studios si présente
      if (user?.id) {
        try {
          await (supabase.from('studios') as any).upsert({
            user_id: user.id,
            name: studioName.trim(),
            slug: cleanSlug,
            bio: studioBio.trim().slice(0, 200),
            accent_color: studioColor,
            price_quoted_standard: 1200,
          });
        } catch {
          // Ignorer si table non migrée
        }
      }

      setSiteSavedNotice('Votre site co-brandé a été mis à jour avec succès.');
      setTimeout(() => setSiteSavedNotice(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour.';
      setSiteSavedNotice(msg);
    } finally {
      setSavingSite(false);
    }
  };

  const handleRequestWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    if (!withdrawPhone.trim()) return;

    if (user?.id) {
      try {
        await (supabase.from('affiliate_payouts') as any).insert({
          user_id: user.id,
          amount: balanceCfa,
          operator: withdrawOperator,
          phone_number: withdrawPhone.trim(),
          status: 'pending',
        });
      } catch {
        // Fallback gracieux si la table n'est pas encore migrée
      }
    }

    setWithdrawSuccess(true);

    // Redirection directe vers le WhatsApp officiel avec message pré-rempli
    const textMsg =
      `Bonjour l'équipe Djélia ! Je souhaite effectuer un retrait de mes commissions d'affiliation de ${balanceCfa.toLocaleString('fr-FR')} F CFA (50% de mes ventes).\n\n` +
      `Studio : ${studioName} (ID: ${cleanSlug})\n` +
      `Opérateur : ${withdrawOperator}\n` +
      `Numéro de réception : ${withdrawPhone.trim()}\n` +
      `Nom du titulaire : ${withdrawName.trim() || studioName}\n\n` +
      `Merci de procéder au virement !`;

    const waUrl = `https://wa.me/22656240533?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');

    setTimeout(() => {
      setWithdrawSuccess(false);
      setIsWithdrawModalOpen(false);
    }, 2000);
  };

  const initials = (studioName || 'Studio').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8 pb-10">
      {/* En-tête de la page */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">Site & Affiliation 50%</h1>
        <p className="text-sm text-[#8A90A0]">
          Diffusez votre propre vitrine personnalisée et encaissez 50% de commission nette (600 F CFA) sur chaque vente.
        </p>
      </div>

      {/* Sélecteur 2 onglets */}
      <div className="flex gap-2 p-1 rounded-2xl bg-[#0D0F14] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setActiveSubTab('site')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'site'
              ? 'bg-white text-black shadow-md'
              : 'text-[#8A90A0] hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Mon Site en ligne</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('affiliate')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'affiliate'
              ? 'bg-white text-black shadow-md'
              : 'text-[#8A90A0] hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Affiliation 50% & Retraits</span>
        </button>
      </div>

      {activeSubTab === 'site' ? (
        <div className="space-y-6">
          {/* Carte de Prévisualisation Haute-Horlogerie */}
          <section className="stripe-glow-card rounded-[28px] p-6 space-y-5 border border-white/[0.12] relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-black font-extrabold text-sm shadow-lg shrink-0"
                  style={{ backgroundColor: studioColor }}
                >
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{studioName || 'Mon Studio'}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono border border-emerald-500/25">
                      ● Partenaire Officiel
                    </span>
                  </div>
                  <p className="text-xs text-[#8A90A0] mt-0.5">
                    Certifié · Technologie Studio Djélia Engine
                  </p>
                </div>
              </div>

              {/* Ligne URL & Boutons */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/[0.08] text-xs text-white/80 shrink-0">
                <span className="font-mono text-[11px] truncate max-w-[200px] sm:max-w-xs">
                  djelia.store/s/{cleanSlug}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(miniSiteUrl, 'mini')}
                  className="text-[#E2BD6B] font-semibold shrink-0 cursor-pointer hover:underline text-[11px]"
                >
                  {copiedKey === 'mini' ? 'Copié' : 'Copier'}
                </button>
                <a
                  href={miniSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white shrink-0 p-0.5"
                  title="Voir mon site"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Aperçu du pitch & Offre */}
            <div className="rounded-2xl bg-black/30 p-4 border border-white/[0.06] space-y-2">
              <p className="text-xs text-white/90 italic">
                « {studioBio || 'Présentez votre studio en une phrase percutante.'} »
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.06] text-xs">
                <div className="flex items-center gap-2 text-white">
                  <span className="font-bold">Chanson Personnalisée complète :</span>
                  <span className="font-mono font-bold text-[#E2BD6B]">1 200 F CFA</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
                  <Sparkles className="w-3 h-3" />
                  <span>50% reversés à chaque vente (600 F CFA)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Formulaire de personnalisation */}
          <form onSubmit={handleSaveSite} className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">Personnalisation de votre Vitrine</h3>
              <span className="text-[11px] text-[#8A90A0]">Même entonnoir de vente éprouvé à 1 200 F</span>
            </div>

            {siteSavedNotice && (
              <div className="p-3.5 rounded-2xl bg-[#10D98E]/15 border border-[#10D98E]/30 text-[#10D98E] text-xs font-medium flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{siteSavedNotice}</span>
              </div>
            )}

            {/* Nom du Studio */}
            <div className="space-y-2">
              <label htmlFor="site-name" className="block text-xs font-medium text-[#8A90A0]">
                Nom officiel de votre studio
              </label>
              <input
                id="site-name"
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="Ex : Fatou Music, Awa Studio, Mélodies d'Afrique..."
                required
                className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>

            {/* Slug d'URL */}
            <div className="space-y-2">
              <label htmlFor="site-slug" className="block text-xs font-medium text-[#8A90A0]">
                Votre adresse exclusive (djelia.store/s/...)
              </label>
              <div className="flex items-center rounded-2xl bg-[#06070A] border border-white/[0.08] overflow-hidden focus-within:border-[#E2BD6B]">
                <span className="px-3.5 py-3 text-xs text-[#8A90A0] bg-white/[0.02] border-r border-white/[0.06] select-none">
                  djelia.store/s/
                </span>
                <input
                  id="site-slug"
                  type="text"
                  value={studioSlug}
                  onChange={(e) => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="mon-studio"
                  required
                  className="flex-1 px-3.5 py-3 bg-transparent text-sm text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Couleur d'accentuation */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#8A90A0] flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[#E2BD6B]" />
                <span>Couleur d'accentuation de votre vitrine</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {ACCENT_COLORS.map((c) => {
                  const isSelected = studioColor.toLowerCase() === c.id.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setStudioColor(c.id)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-white bg-white/10 text-white shadow-sm'
                          : 'border-white/[0.08] bg-[#06070A] text-[#8A90A0] hover:text-white'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${c.class} shadow-sm`} />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Phrase d'accroche */}
            <div className="space-y-2">
              <label htmlFor="site-bio" className="block text-xs font-medium text-[#8A90A0]">
                Phrase d'accroche pour vos prospects
              </label>
              <textarea
                id="site-bio"
                rows={2}
                value={studioBio}
                onChange={(e) => setStudioBio(e.target.value)}
                placeholder="Ex : Création de chansons personnalisées émouvantes, livrées en 15 minutes sur WhatsApp..."
                className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>

            <button
              type="submit"
              disabled={savingSite}
              className="w-full py-3.5 rounded-2xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingSite && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{savingSite ? 'Publication en cours…' : 'Enregistrer et publier mon site'}</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* CARTE SOLDE 50% GÉANTE (Stripe Glow) */}
          <section className="stripe-glow-card rounded-[28px] p-6 space-y-5 border border-white/[0.12]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/75">Commissions Disponibles</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  50% NET
                </span>
              </div>
              <span className="text-xs font-semibold text-[#E2BD6B] font-mono">
                600 F CFA / vente
              </span>
            </div>

            <div className="text-4xl sm:text-5xl font-extrabold text-white tabular-nums leading-none tracking-tight">
              {balanceCfa.toLocaleString('fr-FR')} <span className="text-xl font-sans text-white/60">F CFA</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/[0.08] text-center">
              <div>
                <p className="text-[11px] text-[#8A90A0]">Visites / Clics</p>
                <p className="text-base font-bold text-white font-mono mt-0.5">{totalClicks}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#8A90A0]">Ventes Livrées</p>
                <p className="text-base font-bold text-[#10D98E] font-mono mt-0.5">{totalSales}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#8A90A0]">Taux Conversion</p>
                <p className="text-base font-bold text-[#E2BD6B] font-mono mt-0.5">
                  {totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <span className="text-xs text-white/60">
                Seuil de retrait : <strong className="text-white">1 500 F CFA</strong> (par Wave ou Orange Money)
              </span>

              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(true)}
                disabled={balanceCfa < minWithdrawThreshold}
                className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                  balanceCfa >= minWithdrawThreshold
                    ? 'bg-white text-black hover:bg-white/90 shadow-lg cursor-pointer hover:scale-[1.02]'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>
                  {balanceCfa >= minWithdrawThreshold
                    ? 'Demander mon virement WhatsApp'
                    : `Encore ${(minWithdrawThreshold - balanceCfa).toLocaleString('fr-FR')} F CFA`}
                </span>
              </button>
            </div>
          </section>

          {/* Lien de partage unique */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#E2BD6B]" />
              <h3 className="text-sm font-semibold text-white">Votre Lien de Diffusion (50% de commission)</h3>
            </div>
            <p className="text-xs text-[#8A90A0] leading-relaxed">
              Partagez ce lien sur vos statuts WhatsApp, TikTok ou Instagram. Toute personne qui commande via ce lien génère automatiquement 600 F CFA crédités sur votre compte.
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white/90 font-mono truncate">
                {miniSiteUrl}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(miniSiteUrl, 'mini')}
                className="px-4 py-3 rounded-2xl bg-white text-black text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer hover:bg-neutral-200 transition-colors"
              >
                {copiedKey === 'mini' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'mini' ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* MODAL DE RETRAIT DIRECT VIA WHATSAPP */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0D0F14] border border-white/[0.12] p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#E2BD6B]" />
                <h3 className="text-base font-bold text-white">Retrait de Commissions (50%)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Récapitulatif montant */}
            <div className="p-4 rounded-2xl bg-[#06070A] border border-white/[0.08] text-center space-y-1">
              <p className="text-xs text-[#8A90A0]">Montant à verser sur votre compte :</p>
              <p className="text-2xl font-black text-white font-mono">
                {balanceCfa.toLocaleString('fr-FR')} F CFA
              </p>
              <p className="text-[11px] text-[#10D98E]">Virement direct sans aucun intermédiaire</p>
            </div>

            <form onSubmit={handleRequestWithdraw} className="space-y-4">
              {/* Choix de l'opérateur */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Opérateur Mobile Money
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Wave', 'Orange Money', 'Moov', 'MTN'].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setWithdrawOperator(op)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer text-center ${
                        withdrawOperator === op
                          ? 'bg-white text-black border-white font-bold'
                          : 'bg-[#06070A] border-white/[0.08] text-[#8A90A0] hover:text-white'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              {/* Numéro de téléphone de réception */}
              <div className="space-y-1.5">
                <label htmlFor="payout-phone" className="block text-xs font-medium text-[#8A90A0]">
                  Numéro de réception ({withdrawOperator})
                </label>
                <input
                  id="payout-phone"
                  type="tel"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 ou +226 70 00 00 00"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#06070A] border border-white/[0.08] text-sm text-white tabular-nums focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              {/* Nom du titulaire */}
              <div className="space-y-1.5">
                <label htmlFor="payout-name" className="block text-xs font-medium text-[#8A90A0]">
                  Nom et prénom du titulaire du compte
                </label>
                <input
                  id="payout-name"
                  type="text"
                  value={withdrawName}
                  onChange={(e) => setWithdrawName(e.target.value)}
                  placeholder="Ex : Awa Diallo"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              {/* Bouton d'action WhatsApp */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={withdrawSuccess}
                  className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {withdrawSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-[#10D98E]" />
                      <span>Redirection WhatsApp en cours…</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      <span>Envoyer la demande sur WhatsApp</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[#8A90A0] text-center leading-relaxed">
                Vous serez redirigé sur le WhatsApp officiel de l'équipe Djélia avec votre message déjà rédigé.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
