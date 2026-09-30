import { useState, type FC } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  GraduationCap, 
  TrendingUp, 
  ChevronDown, 
  BookOpen
} from 'lucide-react';
import { LiquidSoundOrb } from './LiquidSoundOrb';
import { StudioAudioShowcase } from './StudioAudioShowcase';

interface LandingPageProps {
  onOpenStudio: () => void;
  onOpenCockpit: () => void;
  onOpenAcademy?: () => void;
}

const MODULES = [
  {
    num: '01',
    title: 'Fondations du Studio & Offres Irrésistibles',
    duration: '45 min • 5 leçons',
    desc: 'Configurer son WhatsApp Business de studio, structurer ses 3 formules (1 200 F / 3 000 F / 5 000 F) et positionner sa marque pour inspirer une confiance immédiate.',
  },
  {
    num: '02',
    title: 'Acquisition Ads Rentable (Facebook & TikTok)',
    duration: '1h 15 min • 8 leçons',
    desc: 'Lancer des campagnes publicitaires rentables avec seulement 5 000 F CFA de budget de test. Les visuels exacts, les ciblages ouest-africains et les accroches qui génèrent 30 à 50 leads WhatsApp qualifiés.',
  },
  {
    num: '03',
    title: 'Scripts de Vente & Psychologie du Closing WhatsApp',
    duration: '55 min • 6 leçons',
    desc: 'Nos scripts mot-à-mot pour accueillir un lead ads, extraire son brief émotionnel en 2 questions et convertir 4 prospects sur 10 avec la promesse du texte gratuit avant paiement.',
  },
  {
    num: '04',
    title: 'Production Musicale IA & Livraison en 18 Min',
    duration: '1h 05 min • 7 leçons',
    desc: 'Maîtriser le Studio OS : transcription automatique des vocaux, génération de rimes poétiques, styles studio (Afro, Acoustique, Rumba) et livraison vidéo karaoké.',
  },
];

const FAQS = [
  {
    q: 'Dois-je savoir chanter, jouer d’un instrument ou composer ?',
    a: 'Absolument pas. Velaris Studio OS prend en charge l’intégralité de la chaîne musicale. Vous agissez comme le directeur artistique et le gérant de votre boutique : vous écoutez le besoin du client sur WhatsApp, l’outil rédige les paroles poétiques et produit le morceau audio HD masterisé en 1 clic.',
  },
  {
    q: 'Combien d’argent me faut-il pour démarrer ce business ?',
    a: 'La barrière à l’entrée est quasiment nulle. Vous n’avez besoin d’aucun matériel coûteux (un smartphone ou un ordinateur suffit). Pour trouver vos premiers clients, un budget de 5 000 à 10 000 F CFA sur Facebook Ads est suffisant pour générer vos 20 à 40 premières conversations WhatsApp qualifiées.',
  },
  {
    q: 'Comment et quand mes clients me paient-ils ?',
    a: 'Vous encaissez 100% des fonds directement sur votre propre numéro Mobile Money (Wave, Orange Money, Moov Money, MTN). Les clients paient immédiatement après avoir validé le texte de leurs paroles que vous leur envoyez sur WhatsApp.',
  },
  {
    q: 'Combien de temps faut-il pour traiter une commande de A à Z ?',
    a: 'Entre la réception de la note vocale du client et la livraison du fichier final sur WhatsApp, il s’écoule généralement 15 à 20 minutes. Vous pouvez ainsi traiter 5 à 10 commandes par jour sur vos heures libres ou à plein temps.',
  },
  {
    q: 'Quelle est la marge bénéficiaire réelle ?',
    a: 'La marge brute est comprise entre 85% et 95%. Pour une chanson vendue 3 000 F CFA avec vidéo, votre coût de production avec nos outils est de quelques dizaines de francs. Le reste est votre marge nette directe.',
  },
];

export const LandingPage: FC<LandingPageProps> = ({ onOpenStudio, onOpenCockpit, onOpenAcademy }) => {
  const [dailyOrders, setDailyOrders] = useState<number>(4);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Revenue simulator calculation (based on average basket of 3 000 FCFA)
  const averageBasket = 3000;
  const monthlyRevenue = dailyOrders * averageBasket * 30;
  const estimatedAdCost = Math.round(monthlyRevenue * 0.15);
  const netProfit = monthlyRevenue - estimatedAdCost;

  return (
    <div className="space-y-32 sm:space-y-40 pb-36 text-[#e5e7eb] relative z-10">
      {/* 1. HERO SECTION (LIQUID OBSIDIAN ELEGANCE) */}
      <section className="relative pt-6 sm:pt-14 pb-4 max-w-5xl mx-auto text-center space-y-8">
        {/* Subtle Tag Capsule */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-2xl px-4 py-1.5 text-xs font-medium text-white/80 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-white/70" />
          <span>Plateforme & Académie • Studio Musical WhatsApp</span>
        </div>

        {/* Master Monumental Headline */}
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] max-w-4xl mx-auto font-['Plus_Jakarta_Sans',sans-serif]">
            L'Infrastructure Complète pour Vendre vos Chansons sur WhatsApp.
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed font-normal">
            La méthode et la suite logicielle pour créer, vendre et livrer des chansons personnalisées d'exception en moins de 18 minutes. Sans savoir chanter et en encaissant 100% directement sur Wave et Orange Money.
          </p>
        </div>

        {/* Action Buttons: Pure White Pill */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-1">
          <button
            onClick={onOpenStudio}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-white text-black hover:bg-neutral-200 px-8 py-3.5 text-sm font-semibold shadow-[0_0_35px_rgba(255,255,255,0.22)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Ouvrir l'Atelier Studio OS</span>
            <span className="text-xs">↗</span>
          </button>

          <button
            onClick={onOpenCockpit}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.08] px-6 py-3.5 text-sm font-medium text-white/80 hover:text-white transition-all"
          >
            <TrendingUp className="h-4 w-4 text-white/60" />
            <span>Cockpit des Ventes</span>
          </button>
        </div>

        {/* THE 3D LIQUID SOUND ORB (BENCHMARK LIQUID BROKERS) */}
        <LiquidSoundOrb />

        {/* Key Business Pillars (Hairline Minimalist Cards) */}
        <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-white/12 p-4 transition-all">
            <span className="text-[11px] text-white/40 block font-medium">Panier Moyen</span>
            <span className="text-base sm:text-lg font-bold text-white mt-1 block font-['Plus_Jakarta_Sans',sans-serif]">1 200 à 5 000 F</span>
            <span className="text-[10px] text-white/50">Par commande client</span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-white/12 p-4 transition-all">
            <span className="text-[11px] text-white/40 block font-medium">Cadence Studio</span>
            <span className="text-base sm:text-lg font-bold text-white mt-1 block font-['Plus_Jakarta_Sans',sans-serif]">~18 Minutes</span>
            <span className="text-[10px] text-emerald-400">Livraison WhatsApp HD</span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-white/12 p-4 transition-all">
            <span className="text-[11px] text-white/40 block font-medium">Marge Nette</span>
            <span className="text-base sm:text-lg font-bold text-white mt-1 block font-['Plus_Jakarta_Sans',sans-serif]">85% à 95%</span>
            <span className="text-[10px] text-blue-400">Coûts de prod minimes</span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-white/12 p-4 transition-all">
            <span className="text-[11px] text-white/40 block font-medium">Encaissement</span>
            <span className="text-base sm:text-lg font-bold text-white mt-1 block font-['Plus_Jakarta_Sans',sans-serif]">100% Direct</span>
            <span className="text-[10px] text-emerald-400">Wave / Orange Money</span>
          </div>
        </div>
      </section>

      {/* 2. AUDIO EXPERIENCE (HAUTE FIDÉLITÉ STUDIO) */}
      <section className="space-y-6 max-w-5xl mx-auto pt-2">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Démonstration Audio
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Écoutez la puissance émotionnelle du studio
          </h2>
          <p className="text-xs sm:text-sm text-white/50">
            Cliquez sur un style ci-dessous pour tester le rendu sonore haute définition généré par le Studio OS.
          </p>
        </div>

        <StudioAudioShowcase />
      </section>

      {/* 3. THE BUSINESS MODEL BREAKDOWN (3 CLEAN PILLARS) */}
      <section className="space-y-8 max-w-5xl mx-auto pt-2">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Opportunité de Marché
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Pourquoi le business des chansons personnalisées cartonne
          </h2>
          <p className="text-xs sm:text-sm text-white/50">
            L'émotion est le bien de consommation le plus rentable et le plus intemporel sur le marché africain et dans la diaspora.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/15 p-6 space-y-3 transition-all">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white font-bold text-xs">
              01
            </div>
            <h3 className="text-base font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
              Une Demande Continue & Émotionnelle
            </h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Anniversaires, mariages, dots coutumières, hommages pour la fête des mères ou déclarations d'amour. Les gens cherchent désespérément un cadeau original qui fait pleurer de joie.
            </p>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/15 p-6 space-y-3 transition-all">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white font-bold text-xs">
              02
            </div>
            <h3 className="text-base font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
              Zéro Barrière Musicale Technique
            </h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Autrefois, il fallait un studio d'enregistrement, un ingénieur son et des musiciens. Aujourd'hui, notre Studio OS transforme une simple note vocale WhatsApp en hit masterisé en 18 minutes.
            </p>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/15 p-6 space-y-3 transition-all">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white font-bold text-xs">
              03
            </div>
            <h3 className="text-base font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
              Trésorerie Immédiate en Mobile Money
            </h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Vous êtes payé avant même la livraison studio. Les fonds arrivent immédiatement sur votre propre compte Wave, Orange Money ou Moov Money. Vous disposez de votre argent le jour même.
            </p>
          </div>
        </div>
      </section>

      {/* 4. LIVE INTERACTIVE REVENUE SIMULATOR */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#07080a]/80 backdrop-blur-2xl p-6 sm:p-10 max-w-4xl mx-auto space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Simulateur Financier</span>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Calculez votre potentiel de revenus mensuels
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Basé sur un panier moyen éprouvé de 3 000 FCFA (formule vidéo karaoké + MP3).
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-white/40 block">Bénéfice net estimé</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-white font-['Plus_Jakarta_Sans',sans-serif]">
              {netProfit.toLocaleString()} F
            </span>
            <span className="text-[11px] text-emerald-400 font-medium block">/ mois net en poche</span>
          </div>
        </div>

        {/* Interactive Slider */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-white/70">Commandes livrées par jour :</span>
            <span className="rounded-full bg-white/[0.08] text-white px-3 py-1 font-bold text-sm">
              {dailyOrders} commande{dailyOrders > 1 ? 's' : ''} / jour
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={15}
            step={1}
            value={dailyOrders}
            onChange={(e) => setDailyOrders(Number(e.target.value))}
            className="w-full h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-white"
          />

          <div className="flex justify-between text-[11px] text-white/40">
            <span>1 commande (Débutant)</span>
            <span>5 commandes (Rythme standard)</span>
            <span>15 commandes (Studio Pro)</span>
          </div>
        </div>

        {/* Detailed Financial Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.06]">
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-4">
            <span className="text-[11px] text-white/40 block font-medium">Chiffre d'Affaires Brut</span>
            <span className="text-lg font-bold text-white mt-0.5 block font-['Plus_Jakarta_Sans',sans-serif]">
              {monthlyRevenue.toLocaleString()} FCFA
            </span>
            <span className="text-[10px] text-white/40">{dailyOrders * 30} ventes / mois</span>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-4">
            <span className="text-[11px] text-white/40 block font-medium">Budget Pubs Estimé (15%)</span>
            <span className="text-lg font-bold text-white/70 mt-0.5 block font-['Plus_Jakarta_Sans',sans-serif]">
              -{estimatedAdCost.toLocaleString()} FCFA
            </span>
            <span className="text-[10px] text-white/40">Facebook & TikTok Ads</span>
          </div>

          <div className="rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 p-4">
            <span className="text-[11px] text-emerald-400 block font-medium">Bénéfice Net Retirable</span>
            <span className="text-lg font-bold text-white mt-0.5 block font-['Plus_Jakarta_Sans',sans-serif]">
              {netProfit.toLocaleString()} FCFA
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Directement sur Wave / OM</span>
          </div>
        </div>
      </section>

      {/* 5. THE TWO CORE PILLARS (ACADEMY + STUDIO OS) */}
      <section className="space-y-8 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            L'Écosystème Velaris
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Deux piliers pour réussir votre lancement
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Une formation pas-à-pas pour maîtriser la vente et une suite logicielle pour automatiser la production.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Pillar 1: L'Académie */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#07080a]/80 backdrop-blur-2xl p-7 space-y-6 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] border border-white/10 text-white font-bold">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">Pilier 1</span>
                  <h3 className="text-xl font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">L'Académie du Studio</h3>
                </div>
              </div>

              <p className="text-xs text-white/70 leading-relaxed">
                Apprenez à structurer vos offres, lancer des publicités rentables à petit budget et closer vos prospects sur WhatsApp avec nos scripts éprouvés.
              </p>

              <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                {MODULES.map((mod) => (
                  <div key={mod.num} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-xs">
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>Module {mod.num} — {mod.title}</span>
                      <span className="text-[10px] text-white/40">{mod.duration.split('•')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={onOpenAcademy || onOpenCockpit}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] py-3 text-xs font-semibold text-white transition-all"
            >
              <BookOpen className="h-4 w-4 text-white/70" />
              <span>Consulter les Modules de Formation</span>
            </button>
          </div>

          {/* Pillar 2: Le Studio OS */}
          <div className="rounded-3xl border border-white/[0.1] bg-white/[0.03] backdrop-blur-2xl p-7 space-y-6 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black font-bold">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">Pilier 2</span>
                  <h3 className="text-xl font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">La Suite Logicielle Studio OS</h3>
                </div>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                L'atelier complet pour produire vos chansons en 1 clic. Vous n'avez qu'à coller le vocal du client, valider les paroles et lancer le studio.
              </p>

              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className="flex items-start gap-3 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-white shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Transcription Vocale IA :</strong>
                    <span className="text-white/60 ml-1">Analyse des souvenirs et émotions depuis les notes vocales WhatsApp.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-white shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Générateur de Paroles Poétiques :</strong>
                    <span className="text-white/60 ml-1">Écriture instantanée de couplets et refrains en rimes riches, modifiables en direct.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-white shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Moteur Musical Multi-Styles :</strong>
                    <span className="text-white/60 ml-1">Afro-Love, Guitare Acoustique, Rumba Congolaise, Zouk et Gospel avec choix de voix.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-white shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Liaison WhatsApp Directe :</strong>
                    <span className="text-white/60 ml-1">Exportation des paroles et envoi du fichier audio au client en 1 clic.</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onOpenStudio}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-white hover:bg-neutral-200 py-3 text-xs font-bold text-black transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Tester l'Atelier Studio 1-Clic</span>
              <span className="text-xs">↗</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. TESTIMONIALS FROM STUDIO CREATORS */}
      <section className="space-y-6 max-w-5xl mx-auto pt-2">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Retours d'Expérience
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Ils ont lancé leur studio avec Velaris
          </h2>
          <p className="text-xs sm:text-sm text-white/50">
            Des entrepreneurs ordinaires qui génèrent un revenu quotidien grâce aux chansons personnalisées.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/15 p-6 space-y-3 transition-all">
            <p className="text-xs text-white/70 leading-relaxed italic">
              « En 2 semaines après avoir appliqué le module sur Facebook Ads, j'ai rentabilisé mes premiers tests. Je tourne à 4-5 chansons livrées par jour. Le Studio 1-clic me fait gagner des heures de travail. »
            </p>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-white block">Patrick K.</span>
                <span className="text-[10px] text-white/40">Abidjan, Côte d'Ivoire</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-400">~450k F / mois</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/15 p-6 space-y-3 transition-all">
            <p className="text-xs text-white/70 leading-relaxed italic">
              « Je n’avais jamais touché à la musique. Les scripts WhatsApp de closing sont redoutables : le fait de donner le texte gratuitement rassure tout le monde. Dès que le client lit les paroles, la vente est pliée. »
            </p>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-white block">Idrissa S.</span>
                <span className="text-[10px] text-white/40">Ouagadougou, Burkina</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-400">~380k F / mois</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/15 p-6 space-y-3 transition-all">
            <p className="text-xs text-white/70 leading-relaxed italic">
              « La formule vidéo à 3 000 F cartonne avec les anniversaires de mamans et les mariages. Mes clients partagent la vidéo sur leur statut WhatsApp et leurs amis me contactent directement. »
            </p>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-white block">Fatoumata B.</span>
                <span className="text-[10px] text-white/40">Dakar, Sénégal</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-400">~620k F / mois</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ (ENTREPRENEUR-FOCUSED) */}
      <section className="space-y-6 max-w-3xl mx-auto pt-2">
        <div className="text-center space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Questions Fréquentes
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Tout ce que vous devez savoir avant de commencer
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-semibold text-white hover:text-white/80 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-white/50 transition-transform ${
                    openFaqIndex === index ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>
              {openFaqIndex === index && (
                <div className="px-4 pb-4 text-xs text-white/60 leading-relaxed border-t border-white/[0.04] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 8. FINAL CALL TO ACTION */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#07080a]/80 backdrop-blur-2xl p-8 sm:p-12 text-center max-w-4xl mx-auto space-y-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        <div className="space-y-3">
          <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Prêt à lancer votre propre studio musical rentable ?
          </h2>
          <p className="text-xs sm:text-sm text-white/60 max-w-xl mx-auto">
            Accédez immédiatement à l'Atelier Studio OS et découvrez comment produire votre premier morceau en moins de 18 minutes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            onClick={onOpenStudio}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-white hover:bg-neutral-200 px-8 py-3.5 text-sm font-semibold text-black shadow-[0_0_35px_rgba(255,255,255,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Démarrer avec l'Atelier Studio OS</span>
            <span className="text-xs">↗</span>
          </button>

          <button
            onClick={onOpenCockpit}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl px-6 py-3.5 text-xs font-medium text-white/80 hover:bg-white/[0.08] transition-all"
          >
            <span>Accéder au Cockpit des Ventes</span>
          </button>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="pt-8 border-t border-white/[0.06] text-center text-xs text-white/40 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="font-semibold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">Velaris</span>
          <span>—</span>
          <span>Académie & Suite Logicielle Studio</span>
        </div>
        <p className="text-[11px] text-white/40">
          Plateforme dédiée aux créateurs et entrepreneurs indépendants sur WhatsApp.
        </p>
        <p className="text-[10px] text-white/30 pt-1">
          © 2026 Velaris Platform. Tous droits réservés.
        </p>
      </footer>
    </div>
  );
};
