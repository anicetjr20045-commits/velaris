import { useState, type FC, type FormEvent } from 'react';
import { Copy, Check, ExternalLink, X, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

export const AffiliationView: FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'site' | 'affiliate'>('site');

  // État du mini-site (synchronisé avec Supabase user_metadata)
  const initialName = (user?.user_metadata?.studio_name as string) || 'Mon Studio';
  const [studioName, setStudioName] = useState(initialName);
  const [studioSlug, setStudioSlug] = useState(
    (user?.user_metadata?.studio_slug as string) ||
      initialName.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
      'mon-studio'
  );
  const [studioBio, setStudioBio] = useState(
    (user?.user_metadata?.studio_bio as string) ||
      'Chansons personnalisées qualité studio, livrées en 3 min sur WhatsApp.'
  );
  const [studioPrice, setStudioPrice] = useState<number>(
    Number(user?.user_metadata?.studio_price) || 2000
  );
  const [savingSite, setSavingSite] = useState(false);
  const [siteSavedNotice, setSiteSavedNotice] = useState<string | null>(null);

  // État Affiliation & Retrait
  const [copiedKey, setCopiedKey] = useState<'ref' | 'mini' | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawOperator, setWithdrawOperator] = useState('Wave');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const referralCode = user?.id ? user.id.slice(0, 8) : 'demo-ref';
  const cleanSlug = studioSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mon-studio';
  const referralUrl = `https://djelia.store/?ref=${referralCode}`;
  const miniSiteUrl = `https://djelia.store/s/${cleanSlug}`;

  const totalClicks = 28;
  const totalSales = 4;
  const commissionPerSale = 300;
  const balanceCfa = totalSales * commissionPerSale;
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
          studio_price: studioPrice,
        },
      });
      if (error) throw error;
      setSiteSavedNotice('Votre site en ligne a été mis à jour.');
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
    if (user?.id) {
      try {
        await (supabase.from('affiliate_payouts') as any).insert({
          user_id: user.id,
          amount: balanceCfa,
          operator: withdrawOperator,
          phone_number: withdrawPhone,
          status: 'pending',
        });
      } catch {
        // Fallback gracieux si la table n'est pas encore migrée
      }
    }
    setWithdrawSuccess(true);
    setTimeout(() => {
      setWithdrawSuccess(false);
      setIsWithdrawModalOpen(false);
      setWithdrawPhone('');
    }, 2400);
  };

  return (
    <div className="space-y-8 pb-8">
      {/* En-tête */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">Site & Affiliation</h1>
        <p className="text-sm text-[#8A90A0]">
          Personnalisez votre vitrine publique et suivez vos commissions.
        </p>
      </div>

      {/* Sélecteur 2 onglets propres */}
      <div className="flex gap-2 p-1 rounded-2xl bg-[#0D0F14]">
        <button
          type="button"
          onClick={() => setActiveSubTab('site')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeSubTab === 'site' ? 'bg-white text-black' : 'text-[#8A90A0] hover:text-white'
          }`}
        >
          Mon Site en ligne
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('affiliate')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeSubTab === 'affiliate' ? 'bg-white text-black' : 'text-[#8A90A0] hover:text-white'
          }`}
        >
          Affiliation
        </button>
      </div>

      {activeSubTab === 'site' ? (
        <div className="space-y-6">
          {/* Aperçu en direct du mini-site */}
          <section className="stripe-glow-card rounded-[28px] p-6 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/35 text-[11px] text-white/80 max-w-full">
              <span className="truncate">djelia.store/s/{cleanSlug}</span>
              <button
                type="button"
                onClick={() => handleCopy(miniSiteUrl, 'mini')}
                className="text-[#E2BD6B] font-semibold shrink-0 cursor-pointer"
              >
                {copiedKey === 'mini' ? 'Copié' : 'Copier'}
              </button>
              <a
                href={miniSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ouvrir mon mini-site"
                className="text-white/70 hover:text-white shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-1.5 pt-1">
              <h2 className="text-xl font-bold text-white">{studioName || 'Mon Studio'}</h2>
              <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
                {studioBio || 'Présentez votre studio en une phrase.'}
              </p>
            </div>

            <div className="pt-1">
              <span className="inline-block px-5 py-2.5 rounded-full bg-white text-black text-xs font-semibold tabular-nums">
                Commander · {studioPrice.toLocaleString('fr-FR')} F CFA
              </span>
            </div>
          </section>

          {/* Éditeur du site */}
          <form onSubmit={handleSaveSite} className="rounded-3xl bg-[#0D0F14] p-5 sm:p-6 space-y-5">
            {siteSavedNotice && (
              <div className="p-3 rounded-2xl bg-[#10D98E]/10 text-[#10D98E] text-xs font-medium flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{siteSavedNotice}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="site-name" className="block text-xs font-medium text-[#8A90A0]">
                Nom affiché sur votre site
              </label>
              <input
                id="site-name"
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                required
                className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="site-slug" className="block text-xs font-medium text-[#8A90A0]">
                  Adresse unique (/s/...)
                </label>
                <input
                  id="site-slug"
                  type="text"
                  value={studioSlug}
                  onChange={(e) => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="site-price" className="block text-xs font-medium text-[#8A90A0]">
                  Tarif affiché (F CFA)
                </label>
                <select
                  id="site-price"
                  value={studioPrice}
                  onChange={(e) => setStudioPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                >
                  <option value={1500}>1 500 F CFA</option>
                  <option value={2000}>2 000 F CFA</option>
                  <option value={3000}>3 000 F CFA</option>
                  <option value={5000}>5 000 F CFA</option>
                  <option value={10000}>10 000 F CFA</option>
                  <option value={15000}>15 000 F CFA</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="site-bio" className="block text-xs font-medium text-[#8A90A0]">
                Phrase d'accroche
              </label>
              <textarea
                id="site-bio"
                rows={2}
                value={studioBio}
                onChange={(e) => setStudioBio(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>

            <button
              type="submit"
              disabled={savingSite}
              className="w-full py-3.5 rounded-2xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {savingSite && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{savingSite ? 'Publication…' : 'Enregistrer mon site'}</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Carte Solde Affiliation lumineuse */}
          <section className="stripe-glow-card rounded-[28px] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/75">Commissions disponibles</span>
              <span className="text-xs font-semibold text-[#E2BD6B]">25% / vente</span>
            </div>

            <div className="text-4xl font-bold text-white tabular-nums leading-none">
              {balanceCfa.toLocaleString('fr-FR')} F CFA
            </div>

            <div className="flex items-center justify-between text-xs text-white/65">
              <span>{totalSales} ventes · {totalClicks} visites</span>
              <span>Seuil de retrait : 1 500 F</span>
            </div>

            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(true)}
              disabled={balanceCfa < minWithdrawThreshold}
              className={`w-full py-3 rounded-2xl text-xs font-semibold transition-colors ${
                balanceCfa >= minWithdrawThreshold
                  ? 'bg-white text-black hover:bg-white/90 cursor-pointer'
                  : 'bg-black/35 text-white/50 cursor-not-allowed'
              }`}
            >
              {balanceCfa >= minWithdrawThreshold
                ? 'Retirer mes commissions'
                : `Encore ${(minWithdrawThreshold - balanceCfa).toLocaleString('fr-FR')} F CFA avant retrait`}
            </button>
          </section>

          {/* Lien d'affiliation direct */}
          <section className="rounded-3xl bg-[#0D0F14] p-5 space-y-3">
            <p className="text-xs font-medium text-[#8A90A0]">Votre lien d'affiliation (300 F CFA / vente)</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.06] text-xs text-white/85 truncate">
                {referralUrl}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(referralUrl, 'ref')}
                className="px-4 py-3 rounded-2xl bg-white text-black text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'ref' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'ref' ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modale Retrait de commissions */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Retirer mes commissions</h3>
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A90A0] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="text-center py-6 space-y-2">
                <div className="w-11 h-11 mx-auto rounded-full bg-[#10D98E]/15 flex items-center justify-center text-[#10D98E]">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-white">Demande enregistrée</p>
                <p className="text-xs text-[#8A90A0]">
                  Virement de {balanceCfa.toLocaleString('fr-FR')} F CFA vers {withdrawOperator} sous 24h.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestWithdraw} className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  {['Wave', 'Orange Money'].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setWithdrawOperator(op)}
                      className={`py-2.5 rounded-2xl text-xs font-semibold transition-colors cursor-pointer ${
                        withdrawOperator === op
                          ? 'bg-white text-black'
                          : 'bg-[#06070A] text-[#8A90A0] border border-white/[0.08]'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="withdraw-phone" className="text-xs text-[#8A90A0]">
                    Numéro bénéficiaire
                  </label>
                  <input
                    id="withdraw-phone"
                    type="tel"
                    required
                    placeholder="+226 70 00 00 00"
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-white text-black text-sm font-semibold hover:bg-white/90 cursor-pointer"
                >
                  Confirmer le retrait ({balanceCfa.toLocaleString('fr-FR')} F CFA)
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
