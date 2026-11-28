import { useState, type FC } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export interface LandingPageProps {
  onOpenStudio: () => void;
  onOpenCockpit?: () => void;
  onOpenAcademy?: () => void;
  onOpenCopilot?: () => void;
}

interface ProofItem {
  id: string;
  tag: string;
  metric: string;
  title: string;
  caption: string;
  img: string;
}

const PROOFS: ProofItem[] = [
  {
    id: 'dashboard',
    tag: 'Dashboard réel',
    metric: '1 285 000 F CFA',
    title: '779 clients sur WhatsApp. Et 71 qui ont racheté.',
    caption:
      'Capture réelle du tableau de bord Velaris. Panier moyen constaté : 1 650 F CFA. 27 % du chiffre d’affaires vient de clients qui reviennent commander une 2e ou 3e chanson.',
    img: '/proofs/proof_dashboard.jpg',
  },
  {
    id: 'ads',
    tag: 'Meta Ads réel',
    metric: '0,16 $ la discussion',
    title: '100 F CFA pour qu’un client t’écrive. Il paie 1 200 F.',
    caption:
      '2 086,86 $ investis en publicité Meta. Entre 0,16 $ et 0,19 $ par conversation démarrée sur WhatsApp. Pas besoin de 10 000 abonnés : la pub t’amène des acheteurs dès le jour 1.',
    img: '/proofs/proof_ads.jpg',
  },
  {
    id: 'whatsapp',
    tag: 'Vente WhatsApp',
    metric: '1 200 F en 12 min',
    title: 'Il paie d’abord sur Wave. Tu génères ensuite.',
    caption:
      'Vente réelle du 27 novembre 2026 à 11h08. Le client demande le numéro, envoie sa capture Wave de 1 200 F, choisit le style (« touchant un peu gospel ») et reçoit sa chanson 3 minutes plus tard.',
    img: '/proofs/proof_whatsapp.jpg',
  },
  {
    id: 'wave',
    tag: 'Solde Wave',
    metric: '355 620 F CFA',
    title: 'De l’argent réel sur ton téléphone. Pas des promesses.',
    caption:
      'Pas de compte Stripe bloqué, pas de PayPal impossible à retirer. Les clients paient directement sur ton Wave ou ton Orange Money.',
    img: '/proofs/proof_wave.jpg',
  },
];

const FAQS = [
  {
    q: 'J’ai déjà payé des formations qui n’ont rien donné. Pourquoi celle-ci marcherait ?',
    a: 'Parce qu’ici tu ne vends pas un produit compliqué à 45 000 F à des inconnus méfiants. Tu vends un cadeau émotionnel unique à 1 200 F CFA — le prix d’un plat. En décembre, tout le monde veut faire plaisir à un proche. Et tu ne repars pas avec des vidéos seulement : tu as l’outil de production, le pilote WhatsApp et 30 crédits déjà inclus.',
  },
  {
    q: 'Je n’ai qu’un téléphone et pas un gros budget pub…',
    a: 'Tout a été conçu pour tourner sur un simple smartphone. Avec 2 000 F à 3 000 F CFA de pub par jour, tu déclenches déjà 15 à 25 conversations WhatsApp quotidiennes. Et tu peux aussi commencer gratuitement avec tes statuts WhatsApp, TikTok et ton mini-site.',
  },
  {
    q: 'Je ne sais ni chanter, ni écrire, ni composer.',
    a: 'Aucun créateur sur Velaris n’est musicien. Le client te donne un prénom, une occasion et 2 ou 3 détails. Tu les colles dans le Studio IA, et la chanson complète sort en 3 minutes.',
  },
  {
    q: 'Et si je veux arrêter après décembre ?',
    a: 'Aucun engagement. Tu paies 4 900 F CFA pour 30 jours. Si tu ne veux pas renouveler le mois suivant, tu ne paies rien de plus. Ton risque maximum est littéralement de 4 900 F CFA.',
  },
];

const formatFCFA = (n: number) =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} F CFA`;

export const LandingPage: FC<LandingPageProps> = ({
  onOpenStudio,
  onOpenCockpit,
}) => {
  const { user, openAuthModal } = useAuth();
  const [activeProofId, setActiveProofId] = useState<string>('dashboard');
  const [dailySales, setDailySales] = useState<number>(7);
  const [priceMode, setPriceMode] = useState<1200 | 1650>(1200);
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const activeProof = PROOFS.find((p) => p.id === activeProofId) || PROOFS[0];
  const monthlyRevenue = dailySales * priceMode * 30;
  const salesToBreakEven = Math.ceil(4900 / priceMode);

  const handlePrimaryAction = () => {
    if (!user) {
      openAuthModal('signup');
      return;
    }
    if (onOpenCockpit) {
      onOpenCockpit();
    } else {
      onOpenStudio();
    }
  };

  const handleLoginAction = () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (onOpenCockpit) {
      onOpenCockpit();
    } else {
      onOpenStudio();
    }
  };

  const scrollToOffer = () => {
    const el = document.getElementById('velaris-offer');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased selection:bg-white/20 selection:text-white">
      {/* NAV APPLE ULTRA-FINE */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/[0.08] px-5 sm:px-10 h-12 flex items-center">
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <span className="font-semibold text-sm tracking-tight text-white">Velaris</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleLoginAction}
              className="text-xs text-[#86868B] hover:text-white transition-colors cursor-pointer"
            >
              {user ? 'Mon Studio' : 'Connexion'}
            </button>
            <button
              type="button"
              onClick={scrollToOffer}
              className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors cursor-pointer"
            >
              Rejoindre · 4 900 F
            </button>
          </div>
        </div>
      </header>

      {/* 1. HERO : EMPATHIE BRUTALE + PROMESSE DÉCEMBRE → 2027 */}
      <section className="max-w-5xl mx-auto px-5 sm:px-10 pt-14 sm:pt-20 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs sm:text-sm font-medium text-[#86868B]">
            Tu as essayé le dropshipping, le trading, les vidéos miracles. Rien n’a marché.
            <br className="hidden sm:inline" /> Tu commences à croire que tu n’es pas fait pour ça.
          </p>

          <h1 className="font-bold text-white text-[38px] sm:text-5xl lg:text-[68px] tracking-[-0.04em] leading-[1.04]">
            Ce n’est pas toi.
            <br />
            <span className="text-[#86868B]">C’était le mauvais business.</span>
          </h1>

          <p className="text-base sm:text-xl text-white/85 max-w-2xl mx-auto leading-snug tracking-[-0.02em]">
            Décembre commence dans 3 jours. Rentre en 2027 avec un vrai business sur ton téléphone :
            des chansons personnalisées vendues <strong className="text-white font-semibold">1 200 F CFA</strong> sur WhatsApp.
            Objectif : <strong className="text-white font-semibold">250 000 F CFA minimum</strong> dès ce mois.
          </p>

          <div className="pt-3 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={scrollToOffer}
              className="w-full sm:w-auto sm:px-8 py-4 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
            >
              Commencer maintenant · 4 900 F CFA
            </button>
            <p className="text-xs text-[#86868B]">
              4 ventes remboursent ton mois entier · 30 crédits offerts dès l’inscription
            </p>
          </div>
        </div>

        {/* Hardware Hero : Dashboard réel */}
        <div className="mt-12 sm:mt-16 max-w-md mx-auto">
          <div className="p-2 rounded-[34px] bg-gradient-to-b from-[#2C2C2E] via-[#141416] to-[#0A0A0C] shadow-[0_30px_90px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
            <div className="rounded-[26px] overflow-hidden bg-black relative">
              <button
                type="button"
                onClick={() => setLightboxSrc(PROOFS[0].img)}
                className="block w-full text-left relative cursor-pointer"
                aria-label="Agrandir la capture du dashboard"
              >
                <img
                  src={PROOFS[0].img}
                  alt="Dashboard Velaris 1 285 000 F CFA"
                  className="w-full h-auto block"
                />
                <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-medium text-white border border-white/15">
                  Agrandir
                </span>
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-[#86868B] mt-4">
            Mon propre tableau de bord Velaris · 1 285 000 F CFA encaissés sur 779 clients WhatsApp.
          </p>
        </div>
      </section>

      {/* 2. GALERIE DES 4 PREUVES RÉELLES */}
      <section className="bg-[#0B0B0D] border-y border-white/[0.08] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-5 sm:px-10 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E5C170]">
              Zéro théorie. Mes vrais chiffres.
            </p>
            <h2 className="font-bold text-white text-3xl sm:text-4xl lg:text-5xl tracking-[-0.04em] leading-[1.06]">
              Je ne te vends pas un rêve. Je te donne la machine qui tourne déjà.
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {PROOFS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProofId(p.id)}
                className={`px-3 sm:px-4 py-2.5 rounded-2xl sm:rounded-full text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer truncate ${
                  p.id === activeProof.id
                    ? 'bg-white text-black'
                    : 'bg-[#141416] text-[#86868B] hover:text-white border border-white/[0.08]'
                }`}
              >
                {p.tag} · {p.metric}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="p-2 rounded-[34px] bg-gradient-to-b from-[#2C2C2E] via-[#141416] to-[#0A0A0C] shadow-[0_30px_90px_rgba(0,0,0,0.9)] ring-1 ring-white/10 max-w-[340px] mx-auto">
                <div className="rounded-[26px] overflow-hidden bg-black relative">
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(activeProof.img)}
                    className="block w-full relative cursor-pointer"
                    aria-label="Agrandir cette preuve"
                  >
                    <img src={activeProof.img} alt={activeProof.tag} className="w-full h-auto block" />
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-medium text-white border border-white/15">
                      Voir en grand
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <span className="inline-block text-xs font-semibold text-[#30D158]">{activeProof.tag}</span>
              <div className="font-bold text-white text-4xl sm:text-5xl tracking-[-0.04em] leading-[1.04] tabular-nums">
                {activeProof.metric}
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white/95 leading-snug">
                {activeProof.title}
              </h3>
              <p className="text-sm sm:text-base text-[#86868B] leading-relaxed">
                {activeProof.caption}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LE CALCUL QUI REND LE REFUS ABSURDE */}
      <section className="max-w-5xl mx-auto px-5 sm:px-10 py-16 sm:py-24 space-y-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#E5C170]">Fais le calcul</p>
          <h2 className="font-bold text-white text-3xl sm:text-4xl lg:text-5xl tracking-[-0.04em] leading-[1.06]">
            4 900 F pour entrer.
            <br />
            <span className="text-[#86868B]">4 ventes et tu es déjà en bénéfice.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10">
          <div className="border-t border-white/[0.12] pt-5 space-y-1.5">
            <span className="text-xs text-[#86868B]">Ton ticket d’entrée</span>
            <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">4 900 F</div>
            <p className="text-xs text-[#86868B] leading-relaxed">
              Moins cher qu’une sortie du weekend. Sans engagement.
            </p>
          </div>

          <div className="border-t border-white/[0.12] pt-5 space-y-1.5">
            <span className="text-xs text-[#86868B]">Offerts dès ce soir</span>
            <div className="text-3xl sm:text-4xl font-bold text-[#E5C170] tabular-nums">30 crédits</div>
            <p className="text-xs text-[#86868B] leading-relaxed">
              De quoi encaisser 36 000 F CFA avant de recharger 1 seul franc.
            </p>
          </div>

          <div className="border-t border-white/[0.12] pt-5 space-y-1.5">
            <span className="text-xs text-[#86868B]">Objectif Décembre</span>
            <div className="text-3xl sm:text-4xl font-bold text-[#30D158] tabular-nums">250 000 F+</div>
            <p className="text-xs text-[#86868B] leading-relaxed">
              7 chansons par jour en plein mois des fêtes (Noël, Nouvel An).
            </p>
          </div>
        </div>

        {/* Calculateur Décembre */}
        <div className="rounded-[28px] bg-[#141416] border border-white/[0.08] p-6 sm:p-9 space-y-7">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs text-[#86868B]">Simule ton mois de décembre</span>
              <div className="flex gap-2">
                {([1200, 1650] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriceMode(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      priceMode === p
                        ? 'bg-white text-black'
                        : 'bg-black text-[#86868B] border border-white/10'
                    }`}
                  >
                    {p === 1200 ? '1 200 F (base)' : '1 650 F (panier réel)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:text-right">
              <span className="block text-xs text-[#86868B]">Chiffre d’affaires sur 30 jours</span>
              <div className="text-3xl sm:text-5xl font-bold text-white tabular-nums tracking-tight">
                {formatFCFA(monthlyRevenue)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <label htmlFor="velaris-sim-sales" className="text-[#86868B]">
                Chansons vendues par jour
              </label>
              <span className="font-semibold text-white tabular-nums">
                {dailySales} chansons / jour
              </span>
            </div>
            <input
              id="velaris-sim-sales"
              type="range"
              min={3}
              max={20}
              step={1}
              value={dailySales}
              onChange={(e) => setDailySales(Number(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
            <p className="text-xs text-[#30D158] pt-1">
              Abonnement de 4 900 F remboursé en {salesToBreakEven} ventes seulement.
            </p>
          </div>
        </div>
      </section>

      {/* 4. CE QUI EST INCLUS */}
      <section className="bg-[#0B0B0D] border-y border-white/[0.08] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-5 sm:px-10 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E5C170]">Tout est inclus</p>
            <h2 className="font-bold text-white text-3xl sm:text-4xl lg:text-5xl tracking-[-0.04em] leading-[1.06]">
              On ne te laisse pas te débrouiller seul.
            </h2>
          </div>

          <div className="divide-y divide-white/[0.1]">
            {[
              [
                '01',
                'L’Académie pas-à-pas',
                '4 modules courts faits pour être suivis ce weekend : comment lancer ta pub Meta à 0,16 $, quoi répondre sur WhatsApp et comment encaisser sur Wave/OM.',
              ],
              [
                '02',
                'Le Studio Musical IA',
                'Tu entres le prénom, l’occasion et le style du client. En 3 minutes, tu as une chanson qualité studio prête à livrer. Aucune compétence musicale.',
              ],
              [
                '03',
                'Le Pilote WhatsApp 24/7',
                'Tu scannes ton QR Code une seule fois. Tes réponses automatiques et relances tournent même quand tu es en cours, au travail ou en train de dormir.',
              ],
              [
                '04',
                'Ton site /s/ton-nom & l’Affiliation',
                'Un site public à ton nom prêt à partager sur TikTok et tes statuts WhatsApp, plus 50 % de commission nette (600 F CFA) sur chaque vente affiliée.',
              ],
              [
                '05',
                '30 crédits offerts immédiatement',
                'Tu peux encaisser tes premiers 36 000 F CFA avant même d’avoir besoin de recharger tes crédits.',
              ],
            ].map(([num, title, desc]) => (
              <div key={num} className="py-6 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-6 items-baseline">
                <div className="md:col-span-5 flex items-baseline gap-4">
                  <span className="text-xs font-semibold text-[#86868B] tabular-nums">{num}</span>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                </div>
                <p className="pl-8 md:pl-0 md:col-span-7 text-sm text-[#86868B] leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. DEUX CHOIX POUR DÉCEMBRE + OFFRE FINALE */}
      <section id="velaris-offer" className="max-w-5xl mx-auto px-5 sm:px-10 py-16 sm:py-24 space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-bold text-white text-3xl sm:text-4xl lg:text-5xl tracking-[-0.04em] leading-[1.06]">
            Le 1er janvier 2027, tu seras dans l’un de ces deux camps.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[28px] bg-[#0B0B0D] border border-white/[0.06] p-6 sm:p-8 space-y-4">
            <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">
              Option 1 · Ne rien faire
            </span>
            <p className="text-sm text-[#86868B] leading-relaxed">
              Tu fermes cette page. Tu gardes tes 4 900 F ce soir. Tu passes décembre à scroller en te
              disant que tu lanceras « un truc en janvier ». Le 1er janvier 2027, ton compte Wave est
              exactement au même niveau.
            </p>
          </div>

          <div className="rounded-[28px] bg-[#141416] border border-white/20 p-6 sm:p-8 space-y-4">
            <span className="text-xs font-semibold text-[#30D158] uppercase tracking-wider">
              Option 2 · Prendre ta place ce soir
            </span>
            <p className="text-sm text-white/90 leading-relaxed">
              Ce weekend tu termines les 4 modules. Lundi tu lances ta première pub à 0,16 $. En 4 ventes
              ton mois est payé. Tu rentres en 2027 avec un vrai business qui encaisse sur ton téléphone.
            </p>
          </div>
        </div>

        <div className="max-w-xl mx-auto rounded-[32px] bg-[#141416] border border-white/[0.14] p-7 sm:p-10 text-center space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#E5C170]">
              Pass Créateur Velaris
            </span>
            <div className="font-bold text-white text-5xl tracking-[-0.04em] tabular-nums">
              4 900 <span className="text-lg font-medium text-[#86868B]">F CFA / mois</span>
            </div>
            <p className="text-xs text-[#86868B]">
              Accès immédiat · 30 crédits offerts · Sans engagement
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full py-4 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
          >
            Rejoindre maintenant et encaisser dès décembre
          </button>

          <p className="text-[11px] text-[#86868B]">
            Paiement instantané par Wave, Orange Money, Moov, MTN ou Carte bancaire.
          </p>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-10 pb-20 space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center tracking-[-0.03em]">
          Questions directes.
        </h2>
        <div className="divide-y divide-white/[0.1]">
          {FAQS.map((item, idx) => {
            const open = openFaq === idx;
            return (
              <div key={item.q} className="py-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? -1 : idx)}
                  aria-expanded={open}
                  className="w-full text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-sm sm:text-base font-medium text-white">{item.q}</span>
                  <Plus
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      open ? 'rotate-45 text-white' : 'text-[#86868B]'
                    }`}
                  />
                </button>
                {open && (
                  <p className="text-sm text-[#86868B] leading-relaxed pt-3 pr-6">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>

        <footer className="pt-10 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#86868B]">
          <span className="font-semibold text-white">Velaris</span>
          <span>© 2026 Velaris · Studio Musical IA</span>
        </footer>
      </section>

      {/* LIGHTBOX AGRANDISSEMENT PREUVE */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            aria-label="Fermer l'aperçu"
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Preuve agrandie"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl border border-white/10"
          />
        </div>
      )}
    </div>
  );
};
