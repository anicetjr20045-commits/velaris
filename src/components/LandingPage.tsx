import { useState, type FC, type PointerEvent } from 'react';
import {
  ArrowRight,
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
import { useAuth } from '../hooks/useAuth';
import { initiateChariowCheckout } from '../services/chariow';

interface LandingPageProps {
  onOpenStudio?: () => void;
  onOpenCockpit?: () => void;
  onOpenAcademy?: () => void;
  onOpenCopilot?: () => void;
}

// 1. Les anciens business vs Le modèle Velaris
const COMPARISONS = [
  {
    title: 'E-commerce & Dropshipping',
    pain: 'Colis rejetés par les clients, livreurs à moto injoignables, stock bloqué et marges dévorées par la publicité.',
    failureRate: "80% d'échec",
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
    title: "L'Académie Vidéo Pas-à-Pas",
    desc: 'La méthode exacte pour générer 20 à 40 conversations qualifiées par jour avec 5 000 F CFA de publicité TikTok et Facebook. Nous vous donnons les scripts de vente WhatsApp mot à mot : vous savez exactement quoi répondre pour que le client paie sans hésiter.',
    icon: GraduationCap,
    stat: '4 Modules Clés',
    statLabel: 'Vente, Pub, Closing, Production',
  },
  {
    num: '02',
    badge: 'Technologie & Moteur Suno V6',
    title: 'Le Studio IA de Composition',
    desc: "Vous n'avez jamais écrit de poème ni joué d'un instrument ? L'intelligence artificielle analyse l'histoire du client, rédige des couplets poétiques en rimes riches et génère 2 versions MP3 complètes masterisées en 15 minutes chrono.",
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
    badge: 'Vitrine Personnalisée & Affiliation 50%',
    title: 'Votre Site & 50% de Commission Nette',
    desc: 'Chaque membre dispose de sa vitrine officielle djelia.store/s/{votre-nom} personnalisée à ses couleurs et son nom. Partagez simplement votre lien : vous encaissez 50% de commission nette (600 F CFA par commande) virés directement sur votre Mobile Money.',
    icon: Wallet,
    stat: '50% Net',
    statLabel: 'Soit 600 F CFA par commande reversés direct',
  },
];

// 3. Témoignages orientés Business & Résultats
const TESTIMONIALS = [
  {
    name: 'Aïcha Diarra',
    city: 'Abidjan, Côte d’Ivoire',
    revenue: '380 000 F',
    context: 'Ancienne vendeuse de mèches en ligne',
    quote: "J'avais perdu près de 200 000 F dans le e-commerce classique avec des colis refusés et des livreurs perdus. Avec Velaris, je n'ai aucun colis physique : dès que la chanson est prête, elle part en 10 secondes sur WhatsApp. Les clients paient d'avance par Wave. C'est le business le plus propre que j'ai testé.",
  },
  {
    name: 'Mamadou Seck',
    city: 'Dakar, Sénégal',
    revenue: '540 000 F',
    context: 'Étudiant & créateur de contenu',
    quote: "Je ne connais rien au solfège et je ne sais pas chanter. Mais les gens commandent parce que c'est l'anniversaire de leur mère ou une déclaration d'amour. Le client pleure d'émotion en écoutant sa chanson. Sur un produit aussi fort, personne ne discute le prix.",
  },
  {
    name: 'Christian N\'Goran',
    city: 'Yamoussoukro, Côte d’Ivoire',
    revenue: '290 000 F',
    context: 'Salarié dans le commerce',
    quote: "Le Concierge WhatsApp répond aux clients quand je suis au bureau. Le soir en rentrant, je valide simplement les paroles et la génération musicale. En moins d'un mois, mes revenus du studio ont dépassé mon salaire.",
  },
];

// 4. FAQ Stratégique & Traitement des Freins
const FAQS = [
  {
    q: 'Faut-il avoir des connaissances en musique ou savoir chanter ?',
    a: "Absolument aucune. La plateforme Velaris prend en charge 100% de la chaîne de création : l'écriture des rimes, la mélodie, les instruments, la voix chantée et le mastering studio. Vous êtes le gestionnaire du studio : vous dialoguez avec le client sur WhatsApp, notre technologie produit le morceau complet.",
  },
  {
    q: 'Pourquoi ce business est-il plus facile que le e-commerce classique ?',
    a: "Dans le e-commerce physique, vous achetez du stock à l'avance, vous payez des livreurs à moto qui se perdent, et 30% des clients refusent le colis à la livraison. Avec la chanson personnalisée, votre produit est un fichier audio MP3 de haute fidélité envoyé directement sur WhatsApp. Vous n'avez aucun stock, aucun retour de colis et 0 frais de livraison.",
  },
  {
    q: 'Comment et quand suis-je payé par les clients ?',
    a: "Le client vous paie directement sur votre numéro personnel Wave, Orange Money, MTN ou Moov dès qu'il valide le texte des paroles sur WhatsApp. L'argent arrive sur votre téléphone avant même que vous n'expédiiez le fichier musical final. Le risque d'impayé est nul.",
  },
  {
    q: 'Combien de temps par jour dois-je y consacrer ?',
    a: "Entre 1 et 2 heures par jour suffisent largement pour démarrer. Grâce à notre Concierge IA qui accueille automatiquement les prospects sur WhatsApp, vous n'avez pas besoin d'être scotché à votre écran toute la journée.",
  },
  {
    q: "Combien me coûte la création d'une chanson sur Velaris ?",
    a: 'La génération d’une chanson complète (avec 2 versions MP3 différentes) vous coûte seulement quelques dizaines de francs en ressources de calcul. Lorsque vous facturez 2 500 F, 3 500 F ou 5 000 F CFA à votre client, votre marge nette reste comprise entre 85% et 95%.',
  },
  {
    q: 'Quel matériel faut-il pour démarrer ?',
    a: "Un simple smartphone connecté à internet avec WhatsApp suffit. Vous n'avez besoin d'aucun micro professionnel, d'aucune carte son ni d'ordinateur puissant.",
  },
];

export const LandingPage: FC<LandingPageProps> = ({
  onOpenStudio,
  onOpenAcademy,
  onOpenCopilot: _onOpenCopilot,
}) => {
  const { user, openAuthModal } = useAuth();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Dynamic Cashflow Simulator State
  const [basketPrice, setBasketPrice] = useState<number>(3500);
  const [dailySales, setDailySales] = useState<number>(8);

  const monthlyNetCashflow = basketPrice * dailySales * 30;
  const monthlyTotalTransactions = dailySales * 30;

  const handlePrimaryAction = async () => {
    if (user) {
      setCheckoutLoading(true);
      const res = await initiateChariowCheckout({
        userId: user.id,
        email: user.email || '',
        fullName:
          (user.user_metadata?.studio_name as string) ||
          (user.user_metadata?.full_name as string) ||
          'Créateur Velaris',
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

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSpotlightMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div className="pb-24 text-[#E2E4E9] relative z-10 space-y-24 sm:space-y-32">
      
      {/* ========================================================================= */}
      {/* VIEW 1: HERO SECTION CINÉMATIQUE (TITRE SYNE + MONOLITHE CORE)             */}
      {/* ========================================================================= */}
      <section id="hero-section" className="pt-6 sm:pt-14 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Editorial & Mathematical Precision Copy */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]"></span>
              <span className="text-[11px] font-mono tracking-wider text-[#C7CAD4] uppercase font-semibold">
                Architecture de Commerce Autonome · Chansons & E-books WhatsApp
              </span>
            </div>

            <h1 className="font-heading text-5xl sm:text-6xl lg:text-[74px] font-extrabold tracking-tight leading-[1.0] text-white">
              Vendez sans interruption.<br />
              <span className="text-gradient-gold">Encaissés directement chez vous.</span>
            </h1>

            <p className="text-[#C7CAD4] text-base sm:text-lg max-w-2xl font-light leading-relaxed mx-auto lg:mx-0">
              Déployez une infrastructure commerciale privée. Vos agents autonomes qualifient chaque prospect WhatsApp, rédigent les paroles, composent la musique et déclenchent l'encaissement direct sur vos comptes <span className="text-white font-medium">Wave</span> et <span className="text-white font-medium">Orange Money</span> avec livraison instantanée chiffrée.
            </p>

            {/* Dual Flagship Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={checkoutLoading}
                className="w-full sm:w-auto btn-apple-pro px-8 py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <span>{checkoutLoading ? 'Initialisation sécurisée…' : 'Déployer mon Studio — 4 900 F'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('cashflow-simulator')}
                className="w-full sm:w-auto btn-titanium-gold px-7 py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                <span>Simuler mon Cash-Flow</span>
              </button>
            </div>

            {/* 3 Institutional Guarantees */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.06] text-center lg:text-left">
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-[#8E94A3]">Règlement</div>
                <div className="font-heading text-xl sm:text-2xl text-white font-bold mt-0.5">T+0 Direct</div>
                <div className="text-[11px] text-[#8E94A3]">Zéro intermédiaire de garde</div>
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-[#8E94A3]">Marge Nette</div>
                <div className="font-heading text-xl sm:text-2xl text-[#E0C583] font-bold mt-0.5">100 %</div>
                <div className="text-[11px] text-[#8E94A3]">Vos prix, vos gains intacts</div>
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-[#8E94A3]">Exécution</div>
                <div className="font-heading text-xl sm:text-2xl text-white font-bold mt-0.5">&lt; 15 min</div>
                <div className="text-[11px] text-[#8E94A3]">Du lead à la livraison</div>
              </div>
            </div>
          </div>

          {/* Right Monolith Core (Spotlight Card with BriefToSong Animation) */}
          <div className="lg:col-span-5 relative">
            <div
              onPointerMove={handleSpotlightMove}
              className="spotlight-card rounded-3xl p-6 sm:p-7 border border-white/[0.1] relative flex flex-col justify-between min-h-[480px]"
            >
              {/* Top Telemetry Header */}
              <div className="flex items-center justify-between relative z-10 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]"></span>
                  <span className="font-mono text-xs text-white font-semibold tracking-wider">VELARIS BLACK CORE #001</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md font-mono text-[10px] bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/25 uppercase font-medium">
                  Autonome 24/7
                </span>
              </div>

              {/* Floating Card Telemetry Node 1 (Top Right) */}
              <div className="absolute top-16 right-4 z-20 p-3 rounded-xl bg-[#040507]/95 border border-[#D4AF37]/40 backdrop-blur-xl shadow-2xl pointer-events-none hidden sm:block">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#8E94A3]">
                  <span>ENCAISSEMENT VÉRIFIÉ</span>
                  <span className="text-[#00E599]">● WAVE</span>
                </div>
                <div className="font-mono font-bold text-white text-sm mt-0.5">+12 500 F</div>
              </div>

              {/* Floating Card Telemetry Node 2 (Bottom Left) */}
              <div className="absolute bottom-20 left-4 z-20 p-3 rounded-xl bg-[#040507]/95 border border-white/15 backdrop-blur-xl shadow-2xl pointer-events-none hidden sm:block">
                <div className="text-[10px] font-mono text-[#8E94A3]">ORCHESTRATEUR WHATSAPP</div>
                <div className="text-xs text-neutral-200 font-medium font-mono">Session #WA-8842 clôturée</div>
              </div>

              {/* The Hero Brief To Song interactive engine */}
              <div className="my-2 relative z-10">
                <HeroBriefToSong />
              </div>

              {/* Bottom Controls Hint */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[11px] font-mono text-[#8E94A3] relative z-10">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Audio Haute-Fidélité 24/7 · Moteur Suno V6</span>
                </span>
                <span className="text-[#E0C583]">GPU Accéléré</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* VIEW 2: INTERACTIVE CASH-FLOW SIMULATOR (CALCULATEUR DYNAMIQUE REEL)       */}
      {/* ========================================================================= */}
      <section id="cashflow-simulator" className="pt-6 max-w-7xl mx-auto px-4 sm:px-8">
        <div
          onPointerMove={handleSpotlightMove}
          className="spotlight-card rounded-3xl p-8 sm:p-12 border border-[#D4AF37]/20 bg-gradient-to-b from-[#0D0F15]/80 via-[#08090D] to-[#020204]"
        >
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-10">
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#D4AF37] font-semibold">
              Calculateur Dynamique de Rendement
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl text-white font-bold">
              Simulez votre encaissement mensuel
            </h2>
            <p className="text-sm text-[#C7CAD4]">
              Vos agents négocient et livrent sans fatigue. Définissez vos paramètres commerciaux :
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Controls Left */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Slider 1: Average Basket Price */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.06]">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="text-xs font-semibold text-white">Prix moyen par vente / chanson</div>
                    <div className="text-[11px] text-[#8E94A3]">Fixé librement sans commission Velaris</div>
                  </div>
                  <span className="font-mono text-lg font-bold text-[#E0C583] px-3 py-1 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                    {basketPrice.toLocaleString()} F
                  </span>
                </div>
                <input
                  type="range"
                  min="1500"
                  max="25000"
                  step="500"
                  value={basketPrice}
                  onChange={(e) => setBasketPrice(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#1A1E29] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#8E94A3] mt-2">
                  <span>1 500 F</span>
                  <span>12 500 F</span>
                  <span>25 000 F</span>
                </div>
              </div>

              {/* Slider 2: Daily Conversions */}
              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.06]">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="text-xs font-semibold text-white">Commandes quotidiennes conclues par les Agents</div>
                    <div className="text-[11px] text-[#8E94A3]">Flux automatisé WhatsApp 24h/24</div>
                  </div>
                  <span className="font-mono text-lg font-bold text-white px-3 py-1 rounded-lg bg-white/[0.05] border border-white/10">
                    {dailySales} {dailySales > 1 ? 'commandes' : 'commande'} / jour
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="1"
                  value={dailySales}
                  onChange={(e) => setDailySales(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#1A1E29] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#8E94A3] mt-2">
                  <span>1 / jour</span>
                  <span>20 / jour</span>
                  <span>40 / jour</span>
                </div>
              </div>

            </div>

            {/* Computed Projection Output Right */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl p-7 bg-gradient-to-b from-[#D4AF37]/15 via-[#08090D] to-black border border-[#D4AF37]/40 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E0C583] to-transparent"></div>
                
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#C7CAD4] mb-2">
                  Cash-Flow Net Encaissé / Mois
                </div>
                <div className="font-heading text-5xl sm:text-6xl text-gradient-gold font-bold tracking-tight py-2 tabular-nums">
                  {monthlyNetCashflow.toLocaleString()} F
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-mono text-[#00E599] mt-2 bg-[#00E599]/10 px-3 py-1 rounded-full border border-[#00E599]/25">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>100% crédité sur votre Mobile Money</span>
                </div>

                <div className="mt-6 pt-5 border-t border-white/[0.08] text-left space-y-2 text-xs text-[#C7CAD4]">
                  <div className="flex justify-between">
                    <span>Commandes mensuelles générées :</span>
                    <span className="font-mono text-white">{monthlyTotalTransactions} transactions</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frais de commission Velaris :</span>
                    <span className="font-mono text-[#E0C583] font-semibold">0.00 % (Zéro)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="w-full mt-6 py-3.5 rounded-xl btn-apple-pro text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Activer mon infrastructure →
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* VIEW 3: WHATSAPP AUTONOMOUS ENGINE (PIPELINE 4 ÉTAPES + TERMINAL DIRECT)   */}
      {/* ========================================================================= */}
      <section id="pipeline-engine" className="max-w-7xl mx-auto px-4 sm:px-8 space-y-10">
        <div className="pb-6 border-b border-white/[0.06]">
          <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/25">
            PIPELINE AUTONOME TEMPS RÉEL
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl text-white font-bold mt-2">
            WhatsApp Autonomous Execution Engine
          </h2>
          <p className="text-sm text-[#C7CAD4] mt-1">
            Flux de données sans rupture de l'accroche prospect jusqu'à l'encaissement et la livraison chiffrée.
          </p>
        </div>

        {/* Visual Node Architecture */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          
          {/* Step 1 */}
          <div
            onPointerMove={handleSpotlightMove}
            className="spotlight-card p-6 border-t-2 border-t-[#D4AF37]"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8E94A3] mb-4">
              <span>ÉTAPE 01</span>
              <span className="text-[#E0C583] font-semibold">INGESTION</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#E0C583] font-mono font-bold mb-4">
              WA
            </div>
            <h3 className="font-heading text-base text-white font-bold">Prospect WhatsApp</h3>
            <p className="text-xs text-[#C7CAD4] mt-1 leading-relaxed">
              Le prospect clique sur votre pub ou scanne votre lien vitrine. L'agent détecte son intention d'achat en moins de 300ms.
            </p>
          </div>

          {/* Step 2 */}
          <div
            onPointerMove={handleSpotlightMove}
            className="spotlight-card p-6 border-t-2 border-t-white/40"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8E94A3] mb-4">
              <span>ÉTAPE 02</span>
              <span className="text-white font-semibold">NÉGOCIATION & TEXTES</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/20 flex items-center justify-center text-white font-mono font-bold mb-4">
              AI
            </div>
            <h3 className="font-heading text-base text-white font-bold">Qualification & Paroles</h3>
            <p className="text-xs text-[#C7CAD4] mt-1 leading-relaxed">
              L'agent répond en langage naturel soigné, capture l'histoire intime du client et compose les paroles en rimes riches.
            </p>
          </div>

          {/* Step 3 */}
          <div
            onPointerMove={handleSpotlightMove}
            className="spotlight-card p-6 border-t-2 border-t-[#00E599]"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8E94A3] mb-4">
              <span>ÉTAPE 03</span>
              <span className="text-[#00E599] font-semibold">ENCAISSEMENT</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 border border-[#00E599]/30 flex items-center justify-center text-[#00E599] font-mono font-bold mb-4">
              PAY
            </div>
            <h3 className="font-heading text-base text-white font-bold">Règlement Direct</h3>
            <p className="text-xs text-[#C7CAD4] mt-1 leading-relaxed">
              Lien Wave / Orange Money injecté. Le client valide sur son téléphone. Les fonds arrivent immédiatement chez vous.
            </p>
          </div>

          {/* Step 4 */}
          <div
            onPointerMove={handleSpotlightMove}
            className="spotlight-card p-6 border-t-2 border-t-[#D4AF37]"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8E94A3] mb-4">
              <span>ÉTAPE 04</span>
              <span className="text-[#E0C583] font-semibold">CLÔTURE</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center text-[#E0C583] font-mono font-bold mb-4">
              MP3
            </div>
            <h3 className="font-heading text-base text-white font-bold">Livraison Chiffrée</h3>
            <p className="text-xs text-[#C7CAD4] mt-1 leading-relaxed">
              Dès confirmation bancaire, le master audio haute fidélité est généré et expédié directement sur WhatsApp avec message personnalisé.
            </p>
          </div>

        </div>

        {/* Live Simulation Console */}
        <div
          onPointerMove={handleSpotlightMove}
          className="spotlight-card p-6 sm:p-8 bg-[#040507] font-mono text-xs border border-white/[0.08]"
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4 text-[#8E94A3]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00E599] animate-pulse"></span>
              <span className="text-white font-semibold">TERMINAL DE CONVERSATION EN DIRECT</span>
            </div>
            <span>SESSION #WA-8842</span>
          </div>

          <div className="space-y-3 text-[#C7CAD4] max-w-3xl leading-relaxed">
            <div className="text-[#8E94A3]">[14:27:48] Client: Bonjour, je souhaite commander une chanson surprise pour les 60 ans de ma mère.</div>
            <div className="text-[#E0C583]">[14:27:50] Agent #01: Parfaitement ! Racontez-moi en 2 phrases ses qualités et votre plus beau souvenir ensemble. Souhaitez-vous le morceau complet masterisé pour 3 500 F ?</div>
            <div className="text-[#8E94A3]">[14:28:01] Client: Oui, c'est magnifique. Je règle par Wave tout de suite.</div>
            <div className="text-[#E0C583]">[14:28:02] Agent #01: Voici votre lien sécurisé direct : wave.me/pay/velaris-8831. Notre studio commence la composition dès validation.</div>
            <div className="text-[#00E599] font-semibold">[14:28:05] SYSTEM: Webhook reçu. +3 500 F crédités sur votre compte principal Wave.</div>
            <div className="text-[#E0C583]">[14:28:06] Agent #01: Paiement bien reçu ! Le morceau est en cours de mixage studio. Livraison WhatsApp dans 15 minutes.</div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* VIEW 4: STUDIO DES CRÉATIONS & DEMOS (3D HARDCOVER CARDS + AUDIO SHOWCASE) */}
      {/* ========================================================================= */}
      <section id="showcase-creations" className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
          <div>
            <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest bg-white/[0.06] text-[#E0C583] border border-white/10">
              CATALOGUE ÉDITORIAL & MUSICAL PRIVÉ
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl text-white font-bold mt-2">
              Studio Ouvrages & Chansons
            </h2>
            <p className="text-sm text-[#C7CAD4] mt-1">
              Édition haute-définition et packaging prêts à être déployés sur WhatsApp.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrimaryAction}
            className="btn-apple-pro px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span>Déployer mon Studio</span>
          </button>
        </div>

        {/* 3D Realistic Tilt Hardcover Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <div className="card-3d-wrap group">
            <div
              onPointerMove={handleSpotlightMove}
              className="card-3d-target spotlight-card p-6 flex flex-col justify-between h-full border border-[#D4AF37]/30"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20">
                    Prêt à vendre
                  </span>
                  <span className="text-xs font-mono text-[#E0C583] font-bold">3 500 F</span>
                </div>

                {/* 3D Luxury Hardcover Canvas Presentation */}
                <div className="my-6 flex justify-center">
                  <div className="w-48 h-64 rounded-r-xl bg-gradient-to-br from-[#1A1E29] via-[#040507] to-[#13110C] border-l-4 border-l-[#D4AF37] border-y border-r border-white/20 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent pointer-events-none"></div>
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Édition Masterclass</div>
                    <div>
                      <div className="w-6 h-0.5 bg-[#D4AF37] mb-2"></div>
                      <h3 className="font-heading text-lg text-white font-bold leading-snug">Mon Évidence (Afro-Love)</h3>
                      <p className="text-[10px] text-[#C7CAD4] mt-1">Arrangement Guitare & Saxo</p>
                    </div>
                    <div className="text-[9px] font-mono text-[#8E94A3] border-t border-white/10 pt-2 flex justify-between">
                      <span>VELARIS MUSIC</span>
                      <span>2026</span>
                    </div>
                  </div>
                </div>

                <h4 className="font-heading text-lg text-white font-semibold">Mon Évidence · Afro-Love</h4>
                <p className="text-xs text-[#C7CAD4] mt-1">Formule romantique pour fiançailles et demandes en mariage.</p>
              </div>

              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between mt-4">
                <div className="text-[11px] font-mono text-[#8E94A3]">142 commandes livrées</div>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="btn-titanium-gold px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Déployer ↗
                </button>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="card-3d-wrap group">
            <div
              onPointerMove={handleSpotlightMove}
              className="card-3d-target spotlight-card p-6 flex flex-col justify-between h-full border border-white/15"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20">
                    Prêt à vendre
                  </span>
                  <span className="text-xs font-mono text-[#E0C583] font-bold">5 000 F</span>
                </div>

                <div className="my-6 flex justify-center">
                  <div className="w-48 h-64 rounded-r-xl bg-gradient-to-br from-[#1C1F2B] via-black to-[#0A0D14] border-l-4 border-l-[#C7CAD4] border-y border-r border-white/20 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#C7CAD4]">Hommage & Fêtes</div>
                    <div>
                      <div className="w-6 h-0.5 bg-white mb-2"></div>
                      <h3 className="font-heading text-lg text-white font-bold leading-snug">Merci Maman (Acoustique)</h3>
                      <p className="text-[10px] text-[#C7CAD4] mt-1">Émotion Pure & Chœurs</p>
                    </div>
                    <div className="text-[9px] font-mono text-[#8E94A3] border-t border-white/10 pt-2 flex justify-between">
                      <span>VELARIS MUSIC</span>
                      <span>2026</span>
                    </div>
                  </div>
                </div>

                <h4 className="font-heading text-lg text-white font-semibold">Merci Maman · Acoustique</h4>
                <p className="text-xs text-[#C7CAD4] mt-1">Script de vente optimisé pour les anniversaires de parents.</p>
              </div>

              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between mt-4">
                <div className="text-[11px] font-mono text-[#8E94A3]">88 commandes livrées</div>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="btn-titanium-gold px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Déployer ↗
                </button>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="card-3d-wrap group">
            <div
              onPointerMove={handleSpotlightMove}
              className="card-3d-target spotlight-card p-6 flex flex-col justify-between h-full border border-[#D4AF37]/30"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/20">
                    Masterclass Vidéo
                  </span>
                  <span className="text-xs font-mono text-[#E0C583] font-bold">4 900 F</span>
                </div>

                <div className="my-6 flex justify-center">
                  <div className="w-48 h-64 rounded-r-xl bg-gradient-to-br from-[#141522] via-[#08090D] to-[#040507] border-l-4 border-l-[#D4AF37] border-y border-r border-white/20 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Académie Complète</div>
                    <div>
                      <div className="w-6 h-0.5 bg-[#D4AF37] mb-2"></div>
                      <h3 className="font-heading text-lg text-white font-bold leading-snug">Vendre sur WhatsApp 2026</h3>
                      <p className="text-[10px] text-[#C7CAD4] mt-1">Scripts & Publicité Ciblée</p>
                    </div>
                    <div className="text-[9px] font-mono text-[#8E94A3] border-t border-white/10 pt-2 flex justify-between">
                      <span>ACADÉMIE VELARIS</span>
                      <span>2026</span>
                    </div>
                  </div>
                </div>

                <h4 className="font-heading text-lg text-white font-semibold">Le Guide Officiel du Closing</h4>
                <p className="text-xs text-[#C7CAD4] mt-1">Méthode de vente étape par étape incluse avec le Pass Créateur.</p>
              </div>

              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between mt-4">
                <div className="text-[11px] font-mono text-[#8E94A3]">Accès instantané</div>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="btn-apple-pro px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Accéder ↗
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Real Audio Player Synthesizer Showcase */}
        <div className="pt-6">
          <StudioAudioShowcase />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* VIEW 5: CRYPTOGRAPHICALLY VERIFIED LIVE TRANSACTION LEDGER TABLE          */}
      {/* ========================================================================= */}
      <section id="ledger-table" className="max-w-7xl mx-auto px-4 sm:px-8">
        <div
          onPointerMove={handleSpotlightMove}
          className="spotlight-card p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-heading text-xl sm:text-2xl text-white font-bold">
                Journal des Règlements Autonomes
              </h2>
              <p className="text-xs text-[#8E94A3] mt-0.5">
                Dernières livraisons exécutées sans aucune intervention humaine.
              </p>
            </div>
            <span className="text-xs font-mono text-[#00E599] flex items-center gap-1.5 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-[#00E599] animate-pulse"></span>
              SYNC EN DIRECT
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-[#8E94A3] border-b border-white/[0.08] pb-3">
                  <th className="py-3 font-medium">HORODATAGE / ID</th>
                  <th className="py-3 font-medium">CLIENT / CANAL</th>
                  <th className="py-3 font-medium">PRODUIT LIVRÉ</th>
                  <th className="py-3 font-medium">PASSERELLE</th>
                  <th className="py-3 font-medium text-right">MONTANT NET</th>
                  <th className="py-3 font-medium text-right">STATUT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-neutral-200">
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="py-3.5 text-[#8E94A3]">14:28:02 <span className="text-zinc-600">· #8831</span></td>
                  <td className="py-3.5 text-white font-medium">+221 77 ••• 4410 (WhatsApp)</td>
                  <td className="py-3.5 text-[#E0C583]">Chanson Anniversaire Personnalisée</td>
                  <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Wave Mobile</span></td>
                  <td className="py-3.5 text-right font-bold text-[#00E599] tabular-nums">+3 500 F</td>
                  <td className="py-3.5 text-right"><span className="text-[#00E599] font-medium">● LIVRÉ 100%</span></td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="py-3.5 text-[#8E94A3]">14:19:44 <span className="text-zinc-600">· #8830</span></td>
                  <td className="py-3.5 text-white font-medium">+225 07 ••• 9122 (WhatsApp)</td>
                  <td className="py-3.5 text-[#E0C583]">Chanson Romantique Mariage</td>
                  <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Orange Money</span></td>
                  <td className="py-3.5 text-right font-bold text-[#00E599] tabular-nums">+5 000 F</td>
                  <td className="py-3.5 text-right"><span className="text-[#00E599] font-medium">● LIVRÉ 100%</span></td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="py-3.5 text-[#8E94A3]">13:58:11 <span className="text-zinc-600">· #8829</span></td>
                  <td className="py-3.5 text-white font-medium">+237 69 ••• 1045 (WhatsApp)</td>
                  <td className="py-3.5 text-[#E0C583]">Pack Duo Anniversaire & Clôture</td>
                  <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">MTN MoMo</span></td>
                  <td className="py-3.5 text-right font-bold text-[#00E599] tabular-nums">+7 000 F</td>
                  <td className="py-3.5 text-right"><span className="text-[#00E599] font-medium">● LIVRÉ 100%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. LE DIAGNOSTIC DU PROBLÈME : POURQUOI VOS ANCIENS BUSINESS ONT ÉCHOUÉ */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#D4AF37] uppercase font-semibold">
            <ShieldAlert className="h-4.5 w-4.5 text-amber-400" />
            <span>Le Constat Sans Concession</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Vous avez déjà essayé d'autres business en ligne ?
          </h2>
          <p className="text-base sm:text-lg text-[#C7CAD4] leading-relaxed">
            La majorité des personnes qui échouent sur internet ne manquent pas de volonté. Elles choisissent simplement des modèles inadaptés au contexte africain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COMPARISONS.map((comp) => (
            <div
              key={comp.title}
              onPointerMove={handleSpotlightMove}
              className="spotlight-card p-8 space-y-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-mono font-bold uppercase text-rose-400 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  {comp.failureRate}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-heading font-bold text-white">{comp.title}</h3>
              <p className="text-sm sm:text-base text-[#C7CAD4] leading-relaxed">{comp.pain}</p>
            </div>
          ))}
        </div>

        {/* Le Pivot Velaris Academy */}
        <div
          onPointerMove={handleSpotlightMove}
          className="spotlight-card border border-[#D4AF37]/30 bg-gradient-to-br from-[#0D0F15] via-[#08090D] to-[#020204] p-8 sm:p-12 relative overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-mono text-[#D4AF37] uppercase tracking-wider font-semibold">
                <Zap className="h-5 w-5" />
                <span>Pourquoi la Chanson Personnalisée avec Velaris change tout</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-heading font-extrabold text-white tracking-tight leading-snug">
                Le seul business où le client paie avant la livraison et ne négocie jamais.
              </h3>
              <p className="text-base sm:text-lg text-[#C7CAD4] leading-relaxed">
                Quand un homme commande une chanson pour demander sa femme en mariage, ou quand une fille veut surprendre sa mère pour ses 60 ans, <strong className="text-white font-semibold">ce n'est pas un gadget qu'ils achètent : c'est un souvenir pour la vie.</strong>
                Le taux de retour est de 0%. Vous livrez un fichier audio MP3 de 3 minutes sur WhatsApp, vous encaissez votre argent le jour même.
              </p>
            </div>

            <div className="space-y-4 bg-black/40 border border-white/[0.08] rounded-2xl p-7">
              <div className="flex items-center gap-3.5 text-base text-white font-medium">
                <Check className="h-5 w-5 text-[#D4AF37] shrink-0" strokeWidth={2.5} />
                <span>0 F CFA de stock immobilisé ou périssable</span>
              </div>
              <div className="flex items-center gap-3.5 text-base text-white font-medium">
                <Check className="h-5 w-5 text-[#D4AF37] shrink-0" strokeWidth={2.5} />
                <span>0 livreur à moto, 0 colis retourné</span>
              </div>
              <div className="flex items-center gap-3.5 text-base text-white font-medium">
                <Check className="h-5 w-5 text-[#D4AF37] shrink-0" strokeWidth={2.5} />
                <span>Paiement immédiat sur Wave ou Orange Money</span>
              </div>
              <div className="flex items-center gap-3.5 text-base text-white font-medium">
                <Check className="h-5 w-5 text-[#D4AF37] shrink-0" strokeWidth={2.5} />
                <span>L'IA rédige et arrange la musique à votre place</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. L'OFFRE IRRESISTIBLE : BENTO GRID DES 4 ATOUTS                          */}
      {/* ========================================================================= */}
      <section id="offre-complete" className="max-w-7xl mx-auto px-4 sm:px-8 space-y-14">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#D4AF37] uppercase font-semibold">
            <Layers className="h-4.5 w-4.5" />
            <span>L'Écosystème Clé en Main</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
            Nous avons éliminé toutes les barrières.
          </h2>
          <p className="text-base sm:text-lg text-[#C7CAD4] leading-relaxed">
            Vous n'avez pas à deviner comment vendre ni comment créer de la musique. Vous disposez de la formation, de la technologie, des automatisations et de votre propre vitrine en ligne.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {BENTO_OFFERS.map((offer) => {
            const Icon = offer.icon;
            return (
              <div
                key={offer.num}
                onPointerMove={handleSpotlightMove}
                className="spotlight-card p-8 sm:p-10 flex flex-col justify-between"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs sm:text-sm text-[#D4AF37] tracking-widest uppercase font-semibold">
                      {offer.num} · {offer.badge}
                    </span>
                    <div className="h-12 w-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
                    {offer.title}
                  </h3>

                  <p className="text-sm sm:text-base text-[#C7CAD4] leading-relaxed">
                    {offer.desc}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-white text-base sm:text-lg block">{offer.stat}</span>
                    <span className="text-[#8E94A3] text-xs sm:text-sm font-medium">{offer.statLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#D4AF37] font-semibold text-sm">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    <span>Inclus dans l'accès</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center pt-4">
          <button
            type="button"
            disabled={checkoutLoading}
            onClick={handlePrimaryAction}
            className="btn-apple-pro px-10 py-4.5 rounded-xl text-base sm:text-lg font-bold cursor-pointer disabled:opacity-50"
          >
            <span>{checkoutLoading ? 'Initialisation sécurisée…' : 'Activer mon Pass Créateur (4 900 F CFA / mois)'}</span>
            <ArrowRight className="h-5 w-5 ml-3 inline" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. TEMOIGNAGES CONCRETS & HISTOIRES DE REUSSITE                            */}
      {/* ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-[#D4AF37] uppercase font-semibold">
            <Users className="h-4.5 w-4.5" />
            <span>Retours d'Expérience Réels</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ils ont lancé leur studio en Afrique
          </h2>
          <p className="text-base sm:text-lg text-[#C7CAD4]">
            Témoignages de membres ayant démarré sans aucune compétence musicale préalable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              onPointerMove={handleSpotlightMove}
              className="spotlight-card p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-lg sm:text-xl font-extrabold text-[#D4AF37]">{t.revenue} / mois</div>
                  <span className="text-xs sm:text-sm text-[#8E94A3] font-mono px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                    {t.city}
                  </span>
                </div>
                <p className="text-base sm:text-lg text-neutral-200 leading-relaxed italic">
                  « {t.quote} »
                </p>
              </div>

              <div className="pt-5 border-t border-white/[0.08]">
                <div className="text-base sm:text-lg font-bold text-white">{t.name}</div>
                <div className="text-xs sm:text-sm text-[#8E94A3] font-medium">{t.context}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FAQ STRATEGIQUE : ELIMINATION RADICALE DES FREINS                       */}
      {/* ========================================================================= */}
      <section className="max-w-3xl mx-auto px-4 sm:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="font-heading text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Questions Fréquentes
          </h2>
          <p className="text-base sm:text-lg text-[#C7CAD4]">
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
                      open ? 'rotate-45 border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/[0.15] text-neutral-300 hover:text-white'
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
                    <p className="pb-7 pr-6 text-base sm:text-lg leading-relaxed text-[#C7CAD4]">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. APPEL FINAL A L'ACTION : IL SERAIT IRRESPONSABLE DE DIRE NON            */}
      {/* ========================================================================= */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-8">
        <div
          onPointerMove={handleSpotlightMove}
          className="spotlight-card rounded-[36px] border border-[#D4AF37]/40 bg-gradient-to-b from-[#181C26]/90 via-[#0B0D13] to-[#020204] p-8 sm:p-16 text-center shadow-2xl relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_120%,rgba(212,175,55,0.15),transparent_70%)]"
          />
          <div className="relative space-y-7">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-5 py-2 text-xs sm:text-sm text-[#D4AF37] font-mono font-medium shadow-[0_0_20px_rgba(212,175,55,0.15)]">
              <Sparkles className="h-4 w-4" />
              <span>Accès Immédiat · Démarrage dès Aujourd'hui</span>
            </div>

            <h2 className="mx-auto max-w-3xl font-heading text-4xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white">
              Arrêtez d'attendre.<br />
              <span className="text-gradient-gold">Votre infrastructure est prête.</span>
            </h2>

            <p className="mx-auto max-w-2xl text-base sm:text-lg md:text-xl leading-relaxed text-[#C7CAD4]">
              Rejoignez Velaris Academy dès aujourd'hui. Configurez votre studio en 10 minutes, accédez à tous les modules de formation et commencez à encaisser vos premières commandes sur votre Wave ou Orange Money.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={checkoutLoading}
                className="btn-apple-pro px-10 py-5 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <span>Accéder à l'Académie & Lancer mon Studio</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('cashflow-simulator')}
                className="btn-titanium-gold px-8 py-5 rounded-xl text-base sm:text-lg font-semibold flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>Simuler mes gains</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#8E94A3] pt-2 font-mono">
              Pass Créateur à 4 900 F CFA / mois · 30 crédits de composition inclus · Annulation libre
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. PIED DE PAGE SOBRE HAUTE-HORLOGERIE                                     */}
      {/* ========================================================================= */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 border-t border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1A1E29] via-[#0D0F15] to-[#040507] border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.18)]">
              <svg className="w-4 h-4 text-[#E0C583]" viewBox="0 0 24 24" fill="none">
                <path d="M4 6L12 20L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.5 6L12 14L16.5 6" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="font-heading text-lg font-extrabold tracking-wider text-white">VELARIS</span>
              <span className="text-[8px] font-mono tracking-[0.25em] text-[#8E94A3] uppercase block">ACADEMY</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#C7CAD4] max-w-md">
            Architecture privée de commerce autonome et studio de chansons personnalisées par IA en Afrique.
          </p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-2 border-t border-white/[0.04] pt-6 text-xs text-[#8E94A3] font-mono">
          <span>© 2026 Velaris Institutional. Tous droits réservés.</span>
          <span>Abidjan · Dakar · Ouagadougou · Douala · Paris</span>
        </div>
      </footer>

    </div>
  );
};
