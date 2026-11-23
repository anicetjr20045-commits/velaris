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
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4A017]/30 bg-[#D4A017]/[0.06] px-3.5 py-1.5 text-xs text-[#D4A017] font-mono">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Académie Officielle · Business Rentable en Afrique & Diaspora</span>
            </div>

            {/* Titre H1 percutant */}
            <h1 className="mt-6 font-heading text-[42px] sm:text-6xl lg:text-[72px] font-bold leading-[1] tracking-[-0.04em] text-white">
              Lancez votre Studio Musical IA.
              <span className="block text-[#D4A017] mt-2 font-normal italic font-serif">
                Zéro talent. Zéro stock. 100% sur WhatsApp.
              </span>
            </h1>

            {/* Texte sous-titre de conversion directe */}
            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#8E94A3]">
              Vous en avez assez des business en ligne compliqués qui ne marchent jamais (e-commerce bloqué par les colis rejetés, trading risqué, agences saturées) ?
              La chanson personnalisée est l’opportunité la plus rentable du continent : <span className="text-white font-medium">90% de marge nette</span>, 0 livraison physique, et des clients qui paient d'avance par <span className="text-white font-medium">Wave et Orange Money</span>.
            </p>

            {/* Boutons d'Action Principaux */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D4A017] hover:bg-[#F5D060] px-8 py-4 text-sm font-semibold text-[#0A0A0F] shadow-[0_0_32px_rgba(212,160,23,0.35)] active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <span>Rejoindre l'Académie & Lancer mon Studio</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={scrollToAudio}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.03] px-6 py-4 text-sm font-medium text-white hover:bg-white/[0.08] hover:border-white/30 transition-colors duration-200 cursor-pointer"
              >
                <AudioLines className="h-4 w-4 text-[#D4A017]" strokeWidth={1.5} />
                <span>Écouter les démos créées par l'IA</span>
              </button>
            </div>

            {/* Preuve de réassurance */}
            <div className="mt-6 flex items-center gap-3 text-xs text-[#8E94A3]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>0 F CFA de matériel requis</span>
              </div>
              <span className="text-white/20">·</span>
              <span>Encaissement direct sur votre mobile</span>
            </div>
          </div>

          {/* Démonstration visuelle de la transformation Note vocale -> Chanson */}
          <div className="vx-view-enter lg:pl-4" style={{ animationDelay: '120ms' }}>
            <HeroBriefToSong />
          </div>
        </div>

        {/* Repères chiffrés & métriques d'autorité */}
        <dl className="relative max-w-6xl mx-auto mt-16 sm:mt-20 grid grid-cols-2 md:grid-cols-4 border-y border-white/[0.08] divide-x divide-white/[0.06] bg-[#12121A]/40 rounded-2xl">
          {[
            { label: 'Marge bénéficiaire nette', value: '85 à 95', unit: '%', note: 'Coût de calcul négligeable' },
            { label: 'Vitesse de composition', value: '15', unit: 'min', note: 'De la note au master MP3' },
            { label: 'Investissement matériel', value: '0', unit: 'FCFA', note: 'Un simple smartphone suffit' },
            { label: 'Mode d\'encaissement', value: 'Direct', unit: '', note: 'Wave, Orange Money & MTN' },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{ '--i': i + 3 } as CSSProperties}
              className={`px-5 sm:px-6 py-6 ${i >= 2 ? 'border-t md:border-t-0 border-white/[0.06]' : ''}`}
            >
              <dt className="text-xs text-[#8E94A3] font-mono uppercase tracking-wider">{s.label}</dt>
              <dd className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {s.value}
                {s.unit && <span className="ml-1 text-sm font-sans text-[#D4A017]">{s.unit}</span>}
              </dd>
              <dd className="mt-1 text-xs text-[#8E94A3]">{s.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ========================================================================= */}
      {/* 2. LE DIAGNOSTIC DU PROBLÈME : POURQUOI VOS ANCIENS BUSINESS ONT ÉCHOUÉ */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-[#D4A017] uppercase">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span>Le Constat Sans Concession</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Vous avez déjà essayé d'autres business en ligne ?
          </h2>
          <p className="text-sm sm:text-base text-[#8E94A3] leading-relaxed">
            La majorité des personnes qui échouent sur internet ne manquent pas de volonté. Elles choisissent simplement des modèles inadaptés au contexte africain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COMPARISONS.map((comp) => (
            <div
              key={comp.title}
              className="rounded-3xl border border-white/[0.08] bg-[#141420]/80 p-7 space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold uppercase text-rose-400 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20">
                  {comp.failureRate}
                </span>
              </div>
              <h3 className="text-lg font-heading font-semibold text-white">{comp.title}</h3>
              <p className="text-xs sm:text-sm text-[#8E94A3] leading-relaxed">{comp.pain}</p>
            </div>
          ))}
        </div>

        {/* Le Pivot Djelia Academy */}
        <div className="rounded-3xl border border-[#D4A017]/30 bg-gradient-to-br from-[#161622] via-[#141420] to-[#0A0A0F] p-8 sm:p-10 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#D4A017] uppercase tracking-wider">
                <Zap className="h-4 w-4" />
                <span>Pourquoi la Chanson Personnalisée avec Djelia change tout</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
                Le seul business où le client paie avant la livraison et ne négocie jamais.
              </h3>
              <p className="text-sm text-[#8E94A3] leading-relaxed">
                Quand un homme commande une chanson pour demander sa femme en mariage, ou quand une fille veut surprendre sa mère pour ses 60 ans, <strong className="text-white font-medium">ce n'est pas un gadget qu'ils achètent : c'est un souvenir pour la vie.</strong>
                Le taux de retour est de 0%. Vous livrez un fichier audio MP3 de 3 minutes sur WhatsApp, vous encaissez votre argent le jour même.
              </p>
            </div>

            <div className="space-y-3 bg-[#0A0A0F]/80 border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center gap-3 text-sm text-white font-medium">
                <Check className="h-4 w-4 text-[#D4A017] shrink-0" />
                <span>0 F CFA de stock immobilisé ou périssable</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white font-medium">
                <Check className="h-4 w-4 text-[#D4A017] shrink-0" />
                <span>0 livreur à moto, 0 colis retourné</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white font-medium">
                <Check className="h-4 w-4 text-[#D4A017] shrink-0" />
                <span>Paiement immédiat sur votre Wave ou Orange Money</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white font-medium">
                <Check className="h-4 w-4 text-[#D4A017] shrink-0" />
                <span>L'IA rédige et arrange la musique à votre place</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. L'OFFRE IRRESISTIBLE : ON VOUS OFFRE TOUT SUR UN PLATEAU */}
      {/* ========================================================================= */}
      <section id="offre-complete" className="max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-[#D4A017] uppercase">
            <Layers className="h-3.5 w-3.5" />
            <span>L'Écosystème Clé en Main</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Nous avons éliminé toutes les barrières.
          </h2>
          <p className="text-sm sm:text-base text-[#8E94A3] leading-relaxed">
            Vous n'avez pas à deviner comment vendre ni comment créer de la musique. Vous disposez de la formation, de la technologie, des automatisations et de votre propre vitrine en ligne.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BENTO_OFFERS.map((offer) => {
            const Icon = offer.icon;
            return (
              <div
                key={offer.num}
                onPointerMove={trackPointer}
                className="vx-spotlight rounded-3xl border border-white/[0.08] bg-[#141420] p-8 sm:p-9 flex flex-col justify-between hover:border-[#D4A017]/40 transition-all duration-300 relative group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#D4A017] tracking-widest uppercase">
                      {offer.num} · {offer.badge}
                    </span>
                    <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#D4A017] group-hover:bg-[#D4A017]/10 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight">
                    {offer.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#8E94A3] leading-relaxed">
                    {offer.desc}
                  </p>
                </div>

                <div className="mt-8 pt-5 border-t border-white/[0.06] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-white text-sm block">{offer.stat}</span>
                    <span className="text-[#8E94A3] text-[11px]">{offer.statLabel}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#D4A017] font-medium text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
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
            className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-neutral-200 px-8 py-3.5 text-xs font-semibold text-[#0A0A0F] shadow-[0_0_24px_rgba(255,255,255,0.2)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{checkoutLoading ? 'Initialisation sécurisée…' : 'Activer mon Pass Créateur (4 900 F CFA / mois)'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. PREUVE PAR L'AUDIO : ECOUTEZ CE QUE LE SYSTEME PRODUIT EN 15 MIN */}
      {/* ========================================================================= */}
      <section id="audio-showcase" className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#D4A017] uppercase tracking-wider">
            <Music2 className="h-3.5 w-3.5" />
            <span>Preuve Musicale en Direct</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white">
            Écoutez le rendu produit par nos membres
          </h2>
          <p className="text-sm text-[#8E94A3] max-w-xl mx-auto">
            Chaque morceau est arrangé et masterisé avec la suite Djelia en moins de 15 minutes.
          </p>
        </div>
        <StudioAudioShowcase />
      </section>

      {/* ========================================================================= */}
      {/* 5. LES MATHEMATIQUES DU BUSINESS : SIMULATION DE REVENUS REELS */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-[#D4A017] uppercase">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Simulateur de Rentabilité</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Combien pouvez-vous réellement gagner chaque mois ?
          </h2>
          <p className="text-sm sm:text-base text-[#8E94A3] leading-relaxed">
            Pas de fausses promesses de millions en un jour. Voici les calculs mathématiques réels basés sur le panier moyen de nos studios actifs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {REVENUE_TIERS.map((tier) => (
            <div
              key={tier.tier}
              className={`rounded-3xl border p-8 flex flex-col justify-between relative transition-all duration-200 ${
                tier.isPopular
                  ? 'bg-[#161626] border-[#D4A017] shadow-[0_0_35px_-5px_rgba(212,160,23,0.3)]'
                  : 'bg-[#141420] border-white/[0.08]'
              }`}
            >
              {tier.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#D4A017] text-[#0A0A0F] font-mono text-[10px] font-bold uppercase tracking-wider">
                  Recommandé · Rythme Idéal
                </div>
              )}

              <div className="space-y-4">
                <span className="font-mono text-xs text-[#8E94A3] uppercase">{tier.tier}</span>
                <div className="font-heading text-2xl font-bold text-white">{tier.cadence}</div>
                <div className="text-xs text-[#8E94A3]">
                  Tarif facturé au client : <strong className="text-white font-mono">{tier.price}</strong>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0A0F] border border-white/[0.06] space-y-2 mt-4">
                  <div className="text-[11px] text-[#8E94A3] font-mono uppercase">Revenu Net Mensuel Estimé</div>
                  <div className="font-mono text-3xl font-bold text-[#D4A017]">
                    {tier.monthlyNet}
                  </div>
                  <div className="text-[10px] text-[#8E94A3]">
                    CA Brut : {tier.monthlyGross} (hors budget pub léger)
                  </div>
                </div>

                <p className="text-xs text-[#8E94A3] leading-relaxed pt-2">
                  {tier.highlight}
                </p>
              </div>

              <button
                type="button"
                onClick={handlePrimaryAction}
                className={`w-full py-3 rounded-full font-semibold text-xs transition-colors cursor-pointer mt-8 ${
                  tier.isPopular
                    ? 'bg-[#D4A017] hover:bg-[#F5D060] text-[#0A0A0F]'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08]'
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
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-[#D4A017] uppercase">
            <Users className="h-3.5 w-3.5" />
            <span>Retours d'Expérience Réels</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white">
            Ils ont lancé leur studio en Afrique
          </h2>
          <p className="text-sm text-[#8E94A3]">
            Témoignages de membres ayant démarré sans aucune compétence musicale préalable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-3xl border border-white/[0.08] bg-[#141420] p-7 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm font-bold text-[#D4A017]">{t.revenue} / mois</div>
                  <span className="text-[10px] text-[#8E94A3] font-mono px-2 py-0.5 rounded bg-white/[0.05]">
                    {t.city}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#F0F0F5] leading-relaxed italic">
                  « {t.quote} »
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.06]">
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-[11px] text-[#8E94A3]">{t.context}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FAQ STRATEGIQUE : ELIMINATION RADICALE DES FREINS */}
      {/* ========================================================================= */}
      <section className="max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white">
            Questions Fréquentes
          </h2>
          <p className="text-sm text-[#8E94A3]">
            Toutes les réponses pour démarrer en toute sérénité.
          </p>
        </div>

        <div className="border-t border-white/[0.08]">
          {FAQS.map((faq, index) => {
            const open = openFaqIndex === index;
            return (
              <div key={faq.q} className="border-b border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(open ? null : index)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left text-[15px] sm:text-base font-medium text-white cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-luxury ${
                      open ? 'rotate-45 border-[#D4A017] text-[#D4A017]' : 'border-white/[0.12] text-neutral-400'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-luxury ${
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-6 pr-6 text-sm leading-relaxed text-[#8E94A3]">{faq.a}</p>
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
      <section className="relative max-w-5xl mx-auto overflow-hidden rounded-[32px] border border-[#D4A017]/30 bg-gradient-to-b from-[#161624] to-[#0A0A0F] px-6 py-16 sm:py-20 text-center vx-grain">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_120%,rgba(212,160,23,0.18),transparent_70%)]"
        />
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4A017]/30 bg-[#D4A017]/10 px-3.5 py-1.5 text-xs text-[#D4A017] font-mono">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Accès Immédiat · Démarrage dès Aujourd'hui</span>
          </div>

          <h2 className="mx-auto max-w-3xl font-heading text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight text-white">
            Arrêtez de chercher le business parfait.
            <span className="block text-[#D4A017] mt-2">Il est sous vos yeux.</span>
          </h2>

          <p className="mx-auto max-w-xl text-sm sm:text-base leading-relaxed text-[#8E94A3]">
            Rejoignez Djelia Academy dès aujourd'hui. Configurez votre studio en 10 minutes, accédez à tous les modules de formation et commencez à encaisser vos premières commandes sur votre Wave ou Orange Money.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D4A017] hover:bg-[#F5D060] px-9 py-4 text-sm font-semibold text-[#0A0A0F] shadow-[0_0_32px_rgba(212,160,23,0.35)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Accéder à l'Académie & Lancer mon Studio</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={scrollToOffer}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.04] px-7 py-4 text-sm font-medium text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <span>Revoir l'offre détaillée</span>
            </button>
          </div>

          <p className="text-[11px] text-[#8E94A3] pt-2">
            Formule Start à 5 000 F CFA / mois · Formule Pro à 10 000 F CFA / mois · Annulation libre à tout moment
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. PIED DE PAGE SOBRE */}
      {/* ========================================================================= */}
      <footer className="max-w-6xl mx-auto pt-10 border-t border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <VelarisMark className="h-6 w-6 text-[#D4A017]" />
            <span className="font-heading text-base font-bold tracking-tight text-white">Djelia Academy</span>
          </div>
          <p className="text-xs text-[#8E94A3] max-w-sm">
            Plateforme et académie pour lancer et piloter votre studio de chansons personnalisées avec l'IA en Afrique.
          </p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-2 border-t border-white/[0.05] pt-5 text-xs text-[#8E94A3]">
          <span>© 2026 Djelia Academy. Tous droits réservés.</span>
          <span>Abidjan · Dakar · Ouagadougou · Douala</span>
        </div>
      </footer>
    </div>
  );
};
