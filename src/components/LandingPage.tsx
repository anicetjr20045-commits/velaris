import { useState, type CSSProperties, type FC, type PointerEvent } from 'react';
import {
  ArrowRight,
  AudioLines,
  Bot,
  Check,
  CheckCircle2,
  GraduationCap,
  Layers,
  Music2,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { StudioAudioShowcase } from './StudioAudioShowcase';
import { HeroBriefToSong } from './HeroBriefToSong';
import { VelarisMark } from './VelarisMark';
import { useAuth } from '../hooks/useAuth';
import { initiateChariowCheckout } from '../services/chariow';

interface LandingPageProps {
  onOpenStudio?: () => void;
  onOpenCockpit?: () => void;
  onOpenAcademy?: () => void;
  onOpenCopilot?: () => void;
}

// 1. Les anciens business vs Le modèle Djelia
const COMPARISONS = [
  {
    title: 'E-commerce & Dropshipping',
    pain: 'Colis rejetés par les clients, livreurs à moto injoignables, stock bloqué et marges dévorées par la publicité.',
    failureRate: '80% d\'échec',
  },
  {
    title: 'Trading, Forex & Crypto',
    pain: 'Capital perdu en quelques jours, formation théorique complexe de plusieurs mois, stress permanent devant les écrans.',
    failureRate: '90% de pertes',
  },
  {
    title: 'Freelance & Agences classiques',
    pain: 'Prospection à froid épuisante, clients capricieux qui négocient les prix à la baisse et retards de paiement constants.',
    failureRate: 'Épuisement rapide',
  },
];

// 2. Bento Grid des 4 Atouts Imbattables (L'Offre Irrésistible)
const BENTO_OFFERS = [
  {
    num: '01',
    badge: 'Formation Pratique & Concrète',
    title: 'L\'Académie Vidéo Pas-à-Pas',
    desc: 'La méthode exacte pour générer 20 à 40 conversations qualifiées par jour avec 5 000 F CFA de publicité TikTok et Facebook. Nous vous donnons les scripts de vente WhatsApp mot à mot : vous savez exactement quoi répondre pour que le client paie sans hésiter.',
    icon: GraduationCap,
    stat: '4 Modules Clés',
    statLabel: 'Vente, Pub, Closing, Production',
  },
  {
    num: '02',
    badge: 'Technologie & Moteur Suno V6',
    title: 'Le Studio IA de Composition',
    desc: 'Vous n\'avez jamais écrit de poème ni joué d\'un instrument ? L\'intelligence artificielle analyse l\'histoire du client, rédige des couplets poétiques en rimes riches et génère 2 versions MP3 complètes masterisées en 15 minutes chrono.',
    icon: Music2,
    stat: '15 Minutes',
    statLabel: 'De la commande au fichier master',
  },
  {
    num: '03',
    badge: 'Automatisation WhatsApp 24/7',
    title: 'Le Concierge IA Infatigable',
    desc: 'Pendant que vous dormez ou travaillez, votre agent WhatsApp officiel accueille vos prospects, répond instantanément aux questions sur les tarifs et prépare les commandes. Vous ne perdez plus aucun client impatient.',
    icon: Bot,
    stat: '24h / 24',
    statLabel: 'Accueil et qualification automatique',
  },
  {
    num: '04',
    badge: 'Vitrine Personnalisée & Affiliation',
    title: 'Votre Mini-Site & 25% de Commission',
    desc: 'Chaque membre dispose de sa vitrine officielle djelia.store/s/{votre-nom}. Et si vous ne souhaitez pas gérer de clients au début ? Partagez simplement votre lien unique : vous encaissez 25% de commission nette (300 F CFA par commande) directement sur votre compte.',
    icon: Wallet,
    stat: '25% Net',
    statLabel: 'Par vente générée sur votre lien',
  },
];

// 3. Paliers de Rentabilité Mensuelle
const REVENUE_TIERS = [
  {
    tier: 'Niveau 01 · Démarrage',
    cadence: '2 chansons / jour',
    price: '2 000 F CFA',
    monthlyGross: '120 000 F CFA',
    monthlyNet: '105 000 F CFA',
    highlight: 'Accessible dès votre première semaine avec 1 heure par jour.',
    isPopular: false,
  },
  {
    tier: 'Niveau 02 · Studio Régulier',
    cadence: '5 chansons / jour',
    price: '2 500 F CFA',
    monthlyGross: '375 000 F CFA',
    monthlyNet: '330 000 F CFA',
    highlight: 'Le rythme moyen de nos membres actifs à Abidjan et Dakar.',
    isPopular: true,
  },
  {
    tier: 'Niveau 03 · Studio Pro & Vidéos',
    cadence: '10 chansons / jour',
    price: '3 500 F CFA',
    monthlyGross: '1 050 000 F CFA',
    monthlyNet: '920 000 F CFA',
    highlight: 'Formule complète avec options montages photos pour mariages et cérémonies.',
    isPopular: false,
  },
];

// 4. Témoignages orientés Business & Résultats
const TESTIMONIALS = [
  {
    name: 'Aïcha Diarra',
    city: 'Abidjan, Côte d’Ivoire',
    revenue: '380 000 F',
    context: 'Ancienne vendeuse de mèches en ligne',
    quote: 'J\'avais perdu près de 200 000 F dans le e-commerce classique avec des colis refusés et des livreurs perdus. Avec Djelia, je n\'ai aucun colis physique : dès que la chanson est prête, elle part en 10 secondes sur WhatsApp. Les clients paient d\'avance par Wave. C\'est le business le plus propre que j\'ai testé.',
  },
  {
    name: 'Mamadou Seck',
    city: 'Dakar, Sénégal',
    revenue: '540 000 F',
    context: 'Étudiant & créateur de contenu',
    quote: 'Je ne connais rien au solfège et je ne sais pas chanter. Mais les gens commandent parce que c\'est l\'anniversaire de leur mère ou une déclaration d\'amour. Le client pleure d\'émotion en écoutant sa chanson. Sur un produit aussi fort, personne ne discute le prix.',
  },
  {
    name: 'Christian N\'Goran',
    city: 'Yamoussoukro, Côte d’Ivoire',
    revenue: '290 000 F',
    context: 'Salarié dans le commerce',
    quote: 'Le Concierge WhatsApp répond aux clients quand je suis au bureau. Le soir en rentrant, je valide simplement les paroles et la génération musicale. En moins d\'un mois, mes revenus du studio ont dépassé mon salaire.',
  },
];

// 5. FAQ Stratégique & Traitement des Freins
const FAQS = [
  {
    q: 'Faut-il avoir des connaissances en musique ou savoir chanter ?',
    a: 'Absolument aucune. La plateforme Djelia prend en charge 100% de la chaîne de création : l\'écriture des rimes, la mélodie, les instruments, la voix chantée et le mastering studio. Vous êtes le gestionnaire du studio : vous dialoguez avec le client sur WhatsApp, notre technologie produit le morceau complet.',
  },
  {
    q: 'Pourquoi ce business est-il plus facile que le e-commerce classique ?',
    a: 'Dans le e-commerce physique, vous achetez du stock à l\'avance, vous payez des livreurs à moto qui se perdent, et 30% des clients refusent le colis à la livraison. Avec la chanson personnalisée, votre produit est un fichier audio MP3 de haute fidélité envoyé directement sur WhatsApp. Vous n\'avez aucun stock, aucun retour de colis et 0 frais de livraison.',
  },
  {
    q: 'Comment et quand suis-je payé par les clients ?',
    a: 'Le client vous paie directement sur votre numéro personnel Wave, Orange Money, MTN ou Moov dès qu\'il valide le texte des paroles sur WhatsApp. L\'argent arrive sur votre téléphone avant même que vous n\'expédiiez le fichier musical final. Le risque d\'impayé est nul.',
  },
  {
    q: 'Combien de temps par jour dois-je y consacrer ?',
    a: 'Entre 1 et 2 heures par jour suffisent largement pour démarrer. Grâce à notre Concierge IA qui accueille automatiquement les prospects sur WhatsApp, vous n\'avez pas besoin d\'être scotché à votre écran toute la journée.',
  },
  {
    q: 'Combien me coûte la création d\'une chanson sur Djelia ?',
    a: 'La génération d\'une chanson complète (avec 2 versions MP3 différentes) vous coûte seulement quelques dizaines de francs en ressources de calcul. Lorsque vous facturez 1 200 F, 2 500 F ou 3 500 F CFA à votre client, votre marge nette reste comprise entre 85% et 95%.',
  },
  {
    q: 'Quel matériel faut-il pour démarrer ?',
    a: 'Un simple smartphone connecté à internet avec WhatsApp suffit. Vous n\'avez besoin d\'aucun micro professionnel, d\'aucune carte son ni d\'ordinateur puissant.',
  },
];

const trackPointer = (e: PointerEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

export const LandingPage: FC<LandingPageProps> = ({
  onOpenStudio,
  onOpenAcademy,
  onOpenCopilot: _onOpenCopilot,
}) => {
  const { user, openAuthModal } = useAuth();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handlePrimaryAction = async () => {
    if (user) {
      setCheckoutLoading(true);
      const res = await initiateChariowCheckout({
        userId: user.id,
        email: user.email || '',
        fullName:
          (user.user_metadata?.studio_name as string) ||
          (user.user_metadata?.full_name as string) ||
          'Créateur Djelia',
        phone: (user.user_metadata?.phone as string) || '',
      });
      setCheckoutLoading(false);
      if (res.success && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
      } else {
        if (onOpenAcademy) {
          onOpenAcademy();
        } else if (onOpenStudio) {
          onOpenStudio();
        }
      }
    } else {
      openAuthModal('signup');
    }
  };

  const scrollToAudio = () => {
    document.getElementById('audio-showcase')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToOffer = () => {
    document.getElementById('offre-complete')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="pb-24 text-[#F0F0F5] relative z-10 space-y-24 sm:space-y-32">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION : L'ACCROCHE IRRESISTIBLE & RECADRAGE DU PUBLIC CIBLE */}
      {/* ========================================================================= */}
      <section className="relative pt-6 sm:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-[560px] w-[min(1200px,100vw)] bg-[radial-gradient(closest-side,rgba(212,160,23,0.12),transparent)]"
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          <div className="vx-view-enter">
            {/* Badge de positionnement */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#E5B54F]/30 bg-gradient-to-r from-[#F5D060]/10 to-[#E5B54F]/5 px-5 py-2.5 text-xs sm:text-sm text-[#F5D060] font-mono font-medium shadow-[0_0_20px_rgba(245,208,96,0.15)]">
              <Sparkles className="h-4 w-4" />
              <span>Académie Officielle · Business Rentable en Afrique & Diaspora</span>
            </div>

            {/* Titre H1 percutant */}
            <h1 className="mt-7 font-heading text-4xl sm:text-6xl lg:text-[76px] font-black leading-[1.02] tracking-[-0.04em] text-white">
              Lancez votre Studio Musical IA.
              <span className="block bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] bg-clip-text text-transparent mt-3 font-normal italic font-serif">
                Zéro talent. Zéro stock. 100% sur WhatsApp.
              </span>
            </h1>

            {/* Texte sous-titre de conversion directe */}
            <p className="mt-7 max-w-2xl text-lg sm:text-xl leading-relaxed text-[#D2D7E5]">
              Vous en avez assez des business en ligne compliqués qui ne marchent jamais (e-commerce bloqué par les colis rejetés, trading risqué, agences saturées) ?
              La chanson personnalisée est l’opportunité la plus rentable du continent : <span className="text-white font-semibold">90% de marge nette</span>, 0 livraison physique, et des clients qui paient d'avance par <span className="text-[#F5D060] font-semibold">Wave et Orange Money</span>.
            </p>

            {/* Boutons d'Action Principaux */}
            <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 px-9 py-4.5 text-base sm:text-lg font-bold text-[#0A0A0F] shadow-[0_0_36px_rgba(245,208,96,0.4)] active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <span>Rejoindre l'Académie & Lancer mon Studio</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={scrollToAudio}
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/[0.18] bg-white/[0.05] hover:bg-white/[0.1] px-7 py-4.5 text-base sm:text-lg font-semibold text-white hover:border-white/40 transition-colors duration-200 cursor-pointer"
              >
                <AudioLines className="h-5 w-5 text-[#F5D060]" strokeWidth={2} />
                <span>Écouter les démos créées par l'IA</span>
              </button>
            </div>

            {/* Preuve de réassurance */}
            <div className="mt-7 flex flex-wrap items-center gap-4 text-sm sm:text-base text-[#BAC0D4]">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>0 F CFA de matériel requis</span>
              </div>
              <span className="text-white/30 hidden sm:inline">·</span>
              <div className="flex items-center gap-2 text-[#CBD2E1] font-medium">
                <CheckCircle2 className="h-4.5 w-4.5 text-[#F5D060]" />
                <span>Encaissement direct sur votre mobile Wave / OM</span>
              </div>
            </div>
          </div>

          {/* Démonstration visuelle de la transformation Note vocale -> Chanson */}
          <div className="vx-view-enter lg:pl-4" style={{ animationDelay: '120ms' }}>
            <HeroBriefToSong />
          </div>
        </div>

        {/* Repères chiffrés & métriques d'autorité */}
        <dl className="relative max-w-6xl mx-auto mt-20 sm:mt-24 grid grid-cols-2 md:grid-cols-4 border border-white/[0.1] divide-y md:divide-y-0 md:divide-x divide-white/[0.08] bg-[#0E0F17]/70 backdrop-blur-xl rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {[
            { label: 'Marge bénéficiaire nette', value: '85 à 95', unit: '%', note: 'Coût de calcul négligeable' },
            { label: 'Vitesse de composition', value: '15', unit: 'min', note: 'De la note vocale au master MP3' },
            { label: 'Investissement matériel', value: '0', unit: 'FCFA', note: 'Un simple smartphone suffit' },
            { label: 'Mode d\'encaissement', value: 'Direct', unit: '', note: 'Wave, Orange Money & MTN' },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{ '--i': i + 3 } as CSSProperties}
              className="p-6 sm:p-8"
            >
              <dt className="text-xs sm:text-sm text-[#A0A5B5] font-mono uppercase tracking-wider font-semibold">{s.label}</dt>
              <dd className="mt-3 font-mono text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                {s.value}
                {s.unit && <span className="ml-1 text-lg sm:text-2xl font-sans text-[#F5D060]">{s.unit}</span>}
              </dd>
              <dd className="mt-2 text-xs sm:text-sm text-[#BAC0D4]">{s.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ========================================================================= */}
      {/* 2. LE DIAGNOSTIC DU PROBLÈME : POURQUOI VOS ANCIENS BUSINESS ONT ÉCHOUÉ */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#F5D060] uppercase font-semibold">
            <ShieldAlert className="h-4.5 w-4.5 text-amber-400" />
            <span>Le Constat Sans Concession</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Vous avez déjà essayé d'autres business en ligne ?
          </h2>
          <p className="text-base sm:text-lg text-[#CBD2E1] leading-relaxed">
            La majorité des personnes qui échouent sur internet ne manquent pas de volonté. Elles choisissent simplement des modèles inadaptés au contexte africain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COMPARISONS.map((comp) => (
            <div
              key={comp.title}
              className="rounded-3xl border border-white/[0.1] bg-[#11121C] p-8 space-y-5 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-mono font-bold uppercase text-rose-400 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  {comp.failureRate}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-heading font-bold text-white">{comp.title}</h3>
              <p className="text-sm sm:text-base text-[#BAC0D4] leading-relaxed">{comp.pain}</p>
            </div>
          ))}
        </div>

        {/* Le Pivot Djelia Academy */}
        <div className="rounded-3xl border border-[#F5D060]/30 bg-gradient-to-br from-[#161726] via-[#12131F] to-[#0A0A0F] p-8 sm:p-12 relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(245,208,96,0.15)]">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-mono text-[#F5D060] uppercase tracking-wider font-semibold">
                <Zap className="h-5 w-5" />
                <span>Pourquoi la Chanson Personnalisée avec Djelia change tout</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-heading font-extrabold text-white tracking-tight leading-snug">
                Le seul business où le client paie avant la livraison et ne négocie jamais.
              </h3>
              <p className="text-base sm:text-lg text-[#CBD2E1] leading-relaxed">
                Quand un homme commande une chanson pour demander sa femme en mariage, ou quand une fille veut surprendre sa mère pour ses 60 ans, <strong className="text-white font-semibold">ce n'est pas un gadget qu'ils achètent : c'est un souvenir pour la vie.</strong>
                Le taux de retour est de 0%. Vous livrez un fichier audio MP3 de 3 minutes sur WhatsApp, vous encaissez votre argent le jour même.
              </p>
            </div>

            <div className="space-y-4 bg-[#08090E]/90 border border-white/[0.1] rounded-3xl p-7">
              <div className="flex items-center gap-3.5 text-base sm:text-lg text-white font-medium">
                <Check className="h-5 w-5 text-[#F5D060] shrink-0" strokeWidth={2.5} />
                <span>0 F CFA de stock immobilisé ou périssable</span>
              </div>
              <div className="flex items-center gap-3.5 text-base sm:text-lg text-white font-medium">
                <Check className="h-5 w-5 text-[#F5D060] shrink-0" strokeWidth={2.5} />
                <span>0 livreur à moto, 0 colis retourné</span>
              </div>
              <div className="flex items-center gap-3.5 text-base sm:text-lg text-white font-medium">
                <Check className="h-5 w-5 text-[#F5D060] shrink-0" strokeWidth={2.5} />
                <span>Paiement immédiat sur Wave ou Orange Money</span>
              </div>
              <div className="flex items-center gap-3.5 text-base sm:text-lg text-white font-medium">
                <Check className="h-5 w-5 text-[#F5D060] shrink-0" strokeWidth={2.5} />
                <span>L'IA rédige et arrange la musique à votre place</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. L'OFFRE IRRESISTIBLE : ON VOUS OFFRE TOUT SUR UN PLATEAU */}
      {/* ========================================================================= */}
      <section id="offre-complete" className="max-w-6xl mx-auto space-y-14">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#F5D060] uppercase font-semibold">
            <Layers className="h-4.5 w-4.5" />
            <span>L'Écosystème Clé en Main</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
            Nous avons éliminé toutes les barrières.
          </h2>
          <p className="text-base sm:text-lg text-[#CBD2E1] leading-relaxed">
            Vous n'avez pas à deviner comment vendre ni comment créer de la musique. Vous disposez de la formation, de la technologie, des automatisations et de votre propre vitrine en ligne.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {BENTO_OFFERS.map((offer) => {
            const Icon = offer.icon;
            return (
              <div
                key={offer.num}
                onPointerMove={trackPointer}
                className="vx-spotlight rounded-3xl border border-white/[0.1] bg-[#11121C] p-8 sm:p-10 flex flex-col justify-between hover:border-[#F5D060]/50 transition-all duration-300 relative group shadow-[0_15px_40px_rgba(0,0,0,0.4)]"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs sm:text-sm text-[#F5D060] tracking-widest uppercase font-semibold">
                      {offer.num} · {offer.badge}
                    </span>
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#F5D060]/20 to-[#E5B54F]/5 border border-[#F5D060]/30 flex items-center justify-center text-[#F5D060] group-hover:scale-105 group-hover:bg-[#F5D060]/25 transition-all shadow-[0_0_20px_rgba(245,208,96,0.15)]">
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
                    {offer.title}
                  </h3>

                  <p className="text-sm sm:text-base text-[#CBD2E1] leading-relaxed">
                    {offer.desc}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-white text-base sm:text-lg block">{offer.stat}</span>
                    <span className="text-[#A0A5B5] text-xs sm:text-sm font-medium">{offer.statLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#F5D060] font-semibold text-sm">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    <span>Inclus dans l'accès</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            type="button"
            disabled={checkoutLoading}
            onClick={handlePrimaryAction}
            className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 px-10 py-4.5 text-base sm:text-lg font-bold text-[#0A0A0F] shadow-[0_0_36px_rgba(245,208,96,0.4)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{checkoutLoading ? 'Initialisation sécurisée…' : 'Activer mon Pass Créateur (4 900 F CFA / mois)'}</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. PREUVE PAR L'AUDIO : ECOUTEZ CE QUE LE SYSTEME PRODUIT EN 15 MIN */}
      {/* ========================================================================= */}
      <section id="audio-showcase" className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono text-[#F5D060] uppercase tracking-wider font-semibold">
            <Music2 className="h-4.5 w-4.5" />
            <span>Preuve Musicale en Direct</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Écoutez le rendu produit par nos membres
          </h2>
          <p className="text-base sm:text-lg text-[#CBD2E1] max-w-2xl mx-auto">
            Chaque morceau est arrangé et masterisé avec la suite Djelia en moins de 15 minutes.
          </p>
        </div>
        <StudioAudioShowcase />
      </section>

      {/* ========================================================================= */}
      {/* 5. LES MATHEMATIQUES DU BUSINESS : SIMULATION DE REVENUS REELS */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto space-y-14">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#F5D060] uppercase font-semibold">
            <TrendingUp className="h-4.5 w-4.5" />
            <span>Simulateur de Rentabilité</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Combien pouvez-vous réellement gagner chaque mois ?
          </h2>
          <p className="text-base sm:text-lg text-[#CBD2E1] leading-relaxed">
            Pas de fausses promesses de millions en un jour. Voici les calculs mathématiques réels basés sur le panier moyen de nos studios actifs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 items-stretch">
          {REVENUE_TIERS.map((tier) => (
            <div
              key={tier.tier}
              className={`rounded-3xl border p-8 sm:p-9 flex flex-col justify-between relative transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.4)] ${
                tier.isPopular
                  ? 'bg-[#151628] border-[#F5D060] shadow-[0_0_40px_-5px_rgba(245,208,96,0.35)]'
                  : 'bg-[#11121C] border-white/[0.1] hover:border-white/[0.2]'
              }`}
            >
              {tier.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#F5D060] to-[#E5B54F] text-[#0A0A0F] font-mono text-xs font-extrabold uppercase tracking-wider shadow-lg">
                  Recommandé · Rythme Idéal
                </div>
              )}

              <div className="space-y-5">
                <span className="font-mono text-xs sm:text-sm text-[#A0A5B5] uppercase font-semibold tracking-wider">{tier.tier}</span>
                <div className="font-heading text-2xl sm:text-3xl font-extrabold text-white">{tier.cadence}</div>
                <div className="text-sm sm:text-base text-[#BAC0D4]">
                  Tarif facturé au client : <strong className="text-white font-mono font-bold">{tier.price}</strong>
                </div>

                <div className="p-5 rounded-2xl bg-[#08090E] border border-white/[0.08] space-y-2.5 mt-5">
                  <div className="text-xs text-[#A0A5B5] font-mono uppercase font-semibold">Revenu Net Mensuel Estimé</div>
                  <div className="font-mono text-4xl sm:text-5xl font-black text-[#F5D060]">
                    {tier.monthlyNet}
                  </div>
                  <div className="text-xs sm:text-sm text-[#BAC0D4]">
                    CA Brut : {tier.monthlyGross} (hors budget pub léger)
                  </div>
                </div>

                <p className="text-sm sm:text-base text-[#CBD2E1] leading-relaxed pt-2">
                  {tier.highlight}
                </p>
              </div>

              <button
                type="button"
                onClick={handlePrimaryAction}
                className={`w-full py-4 rounded-full font-bold text-sm sm:text-base transition-all cursor-pointer mt-8 ${
                  tier.isPopular
                    ? 'bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 text-[#0A0A0F] shadow-[0_0_24px_rgba(245,208,96,0.3)]'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1]'
                }`}
              >
                Viser cet objectif
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. TEMOIGNAGES CONCRETS & HISTOIRES DE REUSSITE */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#F5D060] uppercase font-semibold">
            <Users className="h-4.5 w-4.5" />
            <span>Retours d'Expérience Réels</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ils ont lancé leur studio en Afrique
          </h2>
          <p className="text-base sm:text-lg text-[#CBD2E1]">
            Témoignages de membres ayant démarré sans aucune compétence musicale préalable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-3xl border border-white/[0.1] bg-[#11121C] p-8 flex flex-col justify-between space-y-6 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-lg sm:text-xl font-extrabold text-[#F5D060]">{t.revenue} / mois</div>
                  <span className="text-xs sm:text-sm text-[#A0A5B5] font-mono px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                    {t.city}
                  </span>
                </div>
                <p className="text-base sm:text-lg text-[#F0F2FA] leading-relaxed italic">
                  « {t.quote} »
                </p>
              </div>

              <div className="pt-5 border-t border-white/[0.08]">
                <div className="text-base sm:text-lg font-bold text-white">{t.name}</div>
                <div className="text-xs sm:text-sm text-[#BAC0D4] font-medium">{t.context}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FAQ STRATEGIQUE : ELIMINATION RADICALE DES FREINS */}
      {/* ========================================================================= */}
      <section className="max-w-3xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <h2 className="font-heading text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Questions Fréquentes
          </h2>
          <p className="text-base sm:text-lg text-[#CBD2E1]">
            Toutes les réponses pour démarrer en toute sérénité.
          </p>
        </div>

        <div className="border-t border-white/[0.1]">
          {FAQS.map((faq, index) => {
            const open = openFaqIndex === index;
            return (
              <div key={faq.q} className="border-b border-white/[0.1]">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(open ? null : index)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-base sm:text-xl font-semibold text-white cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-luxury ${
                      open ? 'rotate-45 border-[#F5D060] bg-[#F5D060]/10 text-[#F5D060]' : 'border-white/[0.15] text-neutral-300 hover:text-white'
                    }`}
                  >
                    <Plus className="h-5 w-5" />
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-luxury ${
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-7 pr-6 text-base sm:text-lg leading-relaxed text-[#CBD2E1]">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. APPEL FINAL A L'ACTION : IL SERAIT IRRESPONSABLE DE DIRE NON */}
      {/* ========================================================================= */}
      <section className="relative max-w-5xl mx-auto overflow-hidden rounded-[36px] border border-[#F5D060]/30 bg-gradient-to-b from-[#181928] via-[#12131F] to-[#0A0A0F] px-8 py-16 sm:py-24 text-center vx-grain shadow-[0_20px_80px_rgba(245,208,96,0.15)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_120%,rgba(245,208,96,0.2),transparent_70%)]"
        />
        <div className="relative space-y-7">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#F5D060]/30 bg-[#F5D060]/10 px-5 py-2 text-xs sm:text-sm text-[#F5D060] font-mono font-medium shadow-[0_0_20px_rgba(245,208,96,0.15)]">
            <Sparkles className="h-4 w-4" />
            <span>Accès Immédiat · Démarrage dès Aujourd'hui</span>
          </div>

          <h2 className="mx-auto max-w-3xl font-heading text-4xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white">
            Arrêtez de chercher le business parfait.
            <span className="block bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] bg-clip-text text-transparent mt-3 font-normal italic font-serif">
              Il est sous vos yeux.
            </span>
          </h2>

          <p className="mx-auto max-w-2xl text-base sm:text-lg md:text-xl leading-relaxed text-[#CBD2E1]">
            Rejoignez Djelia Academy dès aujourd'hui. Configurez votre studio en 10 minutes, accédez à tous les modules de formation et commencez à encaisser vos premières commandes sur votre Wave ou Orange Money.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 px-10 py-5 text-base sm:text-lg font-bold text-[#0A0A0F] shadow-[0_0_36px_rgba(245,208,96,0.4)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Accéder à l'Académie & Lancer mon Studio</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={scrollToOffer}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-white/[0.18] bg-white/[0.05] hover:bg-white/[0.1] px-8 py-5 text-base sm:text-lg font-semibold text-white hover:border-white/40 transition-colors cursor-pointer"
            >
              <span>Revoir l'offre détaillée</span>
            </button>
          </div>

          <p className="text-xs sm:text-sm text-[#A0A5B5] pt-2">
            Pass Créateur à 4 900 F CFA / mois · 30 crédits inclus · Annulation libre à tout moment
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. PIED DE PAGE SOBRE */}
      {/* ========================================================================= */}
      <footer className="max-w-6xl mx-auto pt-12 border-t border-white/[0.1]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <VelarisMark className="h-8 w-8 text-[#F5D060]" />
            <span className="font-heading text-lg sm:text-xl font-extrabold tracking-tight text-white">Djelia Academy</span>
          </div>
          <p className="text-sm text-[#CBD2E1] max-w-md">
            Plateforme et académie pour lancer et piloter votre studio de chansons personnalisées avec l'IA en Afrique.
          </p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-2 border-t border-white/[0.06] pt-6 text-xs sm:text-sm text-[#A0A5B5]">
          <span>© 2026 Djelia Academy. Tous droits réservés.</span>
          <span>Abidjan · Dakar · Ouagadougou · Douala · Paris</span>
        </div>
      </footer>
    </div>
  );
};
