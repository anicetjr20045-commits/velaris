import { useState, type FC } from 'react';
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
    title: 'Fondations du Studio & Grille Tarifaire',
    duration: '45 min',
    desc: 'Positionnement de marque, structuration des 3 offres (1 200 F / 3 000 F / 5 000 F) et configuration de la ligne WhatsApp professionnelle pour inspirer confiance.',
  },
  {
    num: '02',
    title: 'Acquisition Publicitaire à Petit Budget',
    duration: '1h 15 min',
    desc: 'Lancer des campagnes rentables dès 5 000 FCFA sur TikTok et Facebook Ads. Créatifs exacts, ciblages géographiques ouest-africains et gestion des flux de messages entrants.',
  },
  {
    num: '03',
    title: 'Psychologie de Vente & Closing WhatsApp',
    duration: '55 min',
    desc: 'Protocoles de discussion mot-à-mot pour extraire le brief émotionnel en deux questions et sécuriser le paiement avant composition.',
  },
  {
    num: '04',
    title: 'Production Musicale & Mastering Automatisé',
    duration: '1h 05 min',
    desc: 'Maîtrise complète de la suite logicielle : transcription des notes vocales, poétisation des rimes, arrangements multi-styles et livraison en 18 minutes.',
  },
];

const FAQS = [
  {
    q: 'Faut-il des compétences en chant, en solfège ou en musique ?',
    a: 'Aucune compétence musicale n’est requise. La suite logicielle Velaris prend en charge l’intégralité de la chaîne acoustique (paroles, mélodie, instrumentation, voix et mastering). Vous agissez en tant que directeur artistique et commerçant : vous recueillez l’histoire de votre client sur WhatsApp, et le système génère le morceau masterisé en 1 clic.',
  },
  {
    q: 'Quel est le budget nécessaire pour démarrer ce studio ?',
    a: 'La barrière à l’entrée est minimale. Un simple smartphone ou un ordinateur suffit. Pour acquérir vos premiers clients, un budget de test publicitaire de 5 000 à 10 000 FCFA permet de générer entre 20 et 40 conversations qualifiées prêtes à commander.',
  },
  {
    q: 'Comment et à quel moment les clients paient-ils ?',
    a: 'Les clients règlent directement sur vos propres comptes Mobile Money (Wave, Orange Money, Moov, MTN). Les fonds sont perçus dès la validation du texte des paroles que vous leur transmettez sur WhatsApp, éliminant tout risque d’impayé.',
  },
  {
    q: 'Quel est le temps moyen de traitement d’une commande ?',
    a: 'Entre la note vocale initiale et la livraison du fichier audio haute définition au client sur WhatsApp, il s’écoule généralement 18 minutes. Cela permet de traiter 5 à 10 commandes par jour sur vos heures libres ou à plein temps.',
  },
  {
    q: 'Quelle est la rentabilité nette constatée ?',
    a: 'La marge brute moyenne oscille entre 85% et 95%. Pour une commande vendue 3 000 FCFA avec vidéo souvenir, le coût direct de génération logicielle est de quelques dizaines de francs. Le solde constitue votre bénéfice net immédiat.',
  },
];

export const LandingPage: FC<LandingPageProps> = ({ onOpenStudio, onOpenCockpit, onOpenAcademy }) => {
  const [dailyOrders, setDailyOrders] = useState<number>(5);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Unit economics calculation (average 3 000 FCFA per order)
  const averageBasket = 3000;
  const monthlyRevenue = dailyOrders * averageBasket * 30;
  const estimatedAdCost = Math.round(monthlyRevenue * 0.15);
  const netProfit = monthlyRevenue - estimatedAdCost;

  return (
    <div className="space-y-28 sm:space-y-36 pb-32 text-[#d1d5db] relative z-10">
      {/* 1. HERO SECTION */}
      <section className="pt-6 sm:pt-16 pb-4 max-w-5xl mx-auto text-center space-y-8">
        {/* Subtle Architectural Tag */}
        <div className="inline-block text-[11px] uppercase tracking-widest text-neutral-400 font-medium">
          Suite logicielle de composition & Académie WhatsApp
        </div>

        {/* Master Monumental Headline */}
        <div className="space-y-5">
          <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.04] max-w-4xl mx-auto">
            L'Atelier de Création Musicale sur WhatsApp.
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed font-normal">
            Une suite d'automatisation conçue pour les créateurs et entrepreneurs indépendants. De la note vocale WhatsApp au master studio en 18 minutes, avec encaissement direct sans intermédiaire.
          </p>
        </div>

        {/* Minimalist Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={onOpenStudio}
            className="w-full sm:w-auto rounded-full bg-white text-black hover:bg-neutral-200 px-8 py-3.5 text-xs font-semibold tracking-tight transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.12)]"
          >
            Ouvrir l'atelier studio
          </button>

          <button
            onClick={onOpenCockpit}
            className="w-full sm:w-auto rounded-full border border-white/15 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/30 px-7 py-3.5 text-xs font-medium text-neutral-300 hover:text-white transition-all"
          >
            Cockpit des ventes
          </button>
        </div>

        {/* 3D Liquid Sound Orb Central Asset */}
        <LiquidSoundOrb />

        {/* 4 Architectural Columns Strip */}
        <div className="pt-8 border-t border-white/[0.08] grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-left">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              Panier moyen
            </div>
            <div className="font-heading text-lg sm:text-xl font-bold text-white mt-1">
              1 200 à 5 000 F
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">Par commande client</p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              Cadence studio
            </div>
            <div className="font-heading text-lg sm:text-xl font-bold text-white mt-1">
              18 minutes
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">De la note au master HD</p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              Marge nette
            </div>
            <div className="font-heading text-lg sm:text-xl font-bold text-white mt-1">
              85% à 95%
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">Coûts de calcul minimaux</p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              Encaissement
            </div>
            <div className="font-heading text-lg sm:text-xl font-bold text-white mt-1">
              Direct & immédiat
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">Wave & Orange Money</p>
          </div>
        </div>
      </section>

      {/* 2. ACOUSTIC EXPERIENCE SHOWCASE */}
      <section className="max-w-5xl mx-auto">
        <StudioAudioShowcase />
      </section>

      {/* 3. BUSINESS FOUNDATIONS (ARCHITECTURAL 3-COLUMN EDITORIAL) */}
      <section className="max-w-5xl mx-auto space-y-10">
        <div className="max-w-xl space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium">
            Principes économiques
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Les trois piliers d'un studio rentabilisé dès le premier mois
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 border-t border-white/[0.08] pt-8">
          <div className="space-y-3">
            <span className="text-xs font-mono text-neutral-400">01</span>
            <h3 className="font-heading text-base font-bold text-white">
              Une demande émotionnelle inépuisable
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Anniversaires, fiançailles, mariages, hommages familiaux. Les clients recherchent un cadeau intime qui suscite une émotion durable, rendant la sensibilité au prix secondaire.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-mono text-neutral-400">02</span>
            <h3 className="font-heading text-base font-bold text-white">
              Suppression des barrières physiques
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Plus besoin de locaux d'enregistrement, d'ingénieurs du son ni de musiciens payés au cachet. La suite logicielle Velaris prend en charge l'arrangement musical et le mastering en 18 minutes.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-mono text-neutral-400">03</span>
            <h3 className="font-heading text-base font-bold text-white">
              Trésorerie instantanée sans intermédiaire
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Les fonds arrivent directement sur votre propre numéro Wave ou Orange Money dès validation des paroles. Vous disposez de vos bénéfices le jour même sans délai bancaire.
            </p>
          </div>
        </div>
      </section>

      {/* 4. REVENUE SIMULATOR (CONSOLE FADER DESIGN) */}
      <section className="max-w-4xl mx-auto border border-white/[0.08] bg-[#050608] rounded-xl p-6 sm:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
              Simulation financière
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-white mt-1">
              Potentiel de bénéfice net mensuel
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Basé sur un panier moyen de 3 000 FCFA (chanson complète + vidéo karaoké).
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-neutral-400 block">Bénéfice net estimé</span>
            <span className="font-heading text-2xl sm:text-3xl font-extrabold text-white">
              {netProfit.toLocaleString()} FCFA
            </span>
            <span className="text-[11px] text-neutral-400 block font-mono">/ mois en poche</span>
          </div>
        </div>

        {/* Mixing Console Slider */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-neutral-300">Volume de production quotidien :</span>
            <span className="font-mono text-white text-sm bg-white/[0.06] border border-white/10 px-3 py-1 rounded">
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
            className="w-full h-1.5 bg-neutral-800 rounded-none appearance-none cursor-pointer accent-white"
          />

          <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
            <span>1 commande (Temps partiel)</span>
            <span>5 commandes (Rythme établi)</span>
            <span>15 commandes (Studio professionnel)</span>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.08] text-xs">
          <div className="border border-white/[0.06] bg-white/[0.01] p-4 rounded-lg">
            <span className="text-neutral-400 block text-[11px]">Chiffre d'affaires brut</span>
            <span className="font-heading text-lg font-bold text-white mt-1 block">
              {monthlyRevenue.toLocaleString()} FCFA
            </span>
            <span className="text-neutral-400 text-[10px] mt-0.5 block">{dailyOrders * 30} commandes / mois</span>
          </div>

          <div className="border border-white/[0.06] bg-white/[0.01] p-4 rounded-lg">
            <span className="text-neutral-400 block text-[11px]">Budget publicitaire (15%)</span>
            <span className="font-heading text-lg font-bold text-neutral-300 mt-1 block">
              -{estimatedAdCost.toLocaleString()} FCFA
            </span>
            <span className="text-neutral-400 text-[10px] mt-0.5 block">TikTok & Facebook Ads</span>
          </div>

          <div className="border border-white/[0.15] bg-white/[0.04] p-4 rounded-lg">
            <span className="text-white block text-[11px] font-semibold">Bénéfice net retirable</span>
            <span className="font-heading text-lg font-extrabold text-white mt-1 block">
              {netProfit.toLocaleString()} FCFA
            </span>
            <span className="text-neutral-300 text-[10px] mt-0.5 block">Directement sur vos comptes Wave/OM</span>
          </div>
        </div>
      </section>

      {/* 5. THE TWO PILLARS (ACADEMY + ENGINE) */}
      <section className="max-w-5xl mx-auto space-y-10">
        <div className="max-w-xl space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium">
            L'Écosystème
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Deux fondations indissociables pour réussir
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Pillar 1: Syllabus Académie */}
          <div className="border border-white/[0.08] bg-[#050608] rounded-xl p-7 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Volet 01 • Formation & Méthode
              </div>
              <h3 className="font-heading text-xl font-bold text-white">
                L'Académie du Studio
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Le parcours pas-à-pas pour positionner vos offres, maîtriser la publicité rentable à petit budget et convertir vos prospects sur WhatsApp avec nos scripts de closing.
              </p>

              <div className="divide-y divide-white/[0.06] border-t border-white/[0.06] pt-2">
                {MODULES.map((mod) => (
                  <div key={mod.num} className="py-3 text-xs flex items-baseline justify-between gap-4">
                    <div>
                      <span className="font-mono text-neutral-400 mr-2">{mod.num}</span>
                      <span className="font-semibold text-white">{mod.title}</span>
                    </div>
                    <span className="font-mono text-[11px] text-neutral-400 shrink-0">{mod.duration}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={onOpenAcademy || onOpenCockpit}
              className="w-full rounded-full border border-white/15 bg-white/[0.02] hover:bg-white/[0.06] py-3 text-xs font-semibold text-white transition-colors"
            >
              Consulter le programme détaillé
            </button>
          </div>

          {/* Pillar 2: Studio OS */}
          <div className="border border-white/[0.12] bg-[#07080a] rounded-xl p-7 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Volet 02 • Suite Logicielle
              </div>
              <h3 className="font-heading text-xl font-bold text-white">
                Le Studio OS
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                L'atelier complet de fabrication : de la transcription de l'audio WhatsApp à l'arrangement et au rendu acoustique 24-bit en 1 clic.
              </p>

              <div className="space-y-3 pt-2 border-t border-white/[0.06] text-xs">
                <div className="py-2 border-b border-white/[0.04]">
                  <strong className="text-white block font-medium">Transcription vocale assistée</strong>
                  <span className="text-neutral-400">Analyse des sentiments, prénoms et anecdotes depuis la note audio du client.</span>
                </div>

                <div className="py-2 border-b border-white/[0.04]">
                  <strong className="text-white block font-medium">Composition de paroles poétiques</strong>
                  <span className="text-neutral-400">Couplets et refrains structurés en rimes riches, modifiables en direct.</span>
                </div>

                <div className="py-2 border-b border-white/[0.04]">
                  <strong className="text-white block font-medium">Arrangements acoustiques multi-styles</strong>
                  <span className="text-neutral-400">Afro-Love, Guitare & Voix, Rumba, Zouk et Gospel avec sélection de timbre vocal.</span>
                </div>

                <div className="py-2">
                  <strong className="text-white block font-medium">Liaison WhatsApp directe</strong>
                  <span className="text-neutral-400">Envoi du texte et du master musical directement dans la conversation client.</span>
                </div>
              </div>
            </div>

            <button
              onClick={onOpenStudio}
              className="w-full rounded-full bg-white hover:bg-neutral-200 py-3 text-xs font-semibold text-black transition-all active:scale-95"
            >
              Accéder à l'atelier de composition
            </button>
          </div>
        </div>
      </section>

      {/* 6. TESTIMONIALS & CASE STUDIES */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="max-w-xl space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium">
            Retours d'expérience
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Créateurs en activité
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-white/[0.08] pt-8 text-xs">
          <div className="space-y-4">
            <p className="text-neutral-300 leading-relaxed italic">
              « Deux semaines après avoir suivi le module d'acquisition, mes campagnes étaient amorties. Je maintiens une cadence de 4 à 5 livraisons quotidiennes. L'atelier me fait gagner plusieurs heures par morceau. »
            </p>
            <div className="border-t border-white/[0.06] pt-3 flex items-baseline justify-between">
              <div>
                <span className="font-semibold text-white block">Patrick K.</span>
                <span className="text-[11px] text-neutral-400">Abidjan, Côte d'Ivoire</span>
              </div>
              <span className="font-mono text-white text-[11px]">~450k F / mois</span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-neutral-300 leading-relaxed italic">
              « Je n'avais aucune notion musicale. Le protocole de vente gratuit sur WhatsApp rassure les clients les plus hésitants. Dès que le texte est validé, l'encaissement se fait sans négociation. »
            </p>
            <div className="border-t border-white/[0.06] pt-3 flex items-baseline justify-between">
              <div>
                <span className="font-semibold text-white block">Idrissa S.</span>
                <span className="text-[11px] text-neutral-400">Ouagadougou, Burkina Faso</span>
              </div>
              <span className="font-mono text-white text-[11px]">~380k F / mois</span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-neutral-300 leading-relaxed italic">
              « La formule 3 000 FCFA avec vidéo souvenir est plébiscitée pour les célébrations familiales. Les clients partagent la vidéo sur leur statut WhatsApp, générant un bouche-à-oreille continu sans surcoût publicitaire. »
            </p>
            <div className="border-t border-white/[0.06] pt-3 flex items-baseline justify-between">
              <div>
                <span className="font-semibold text-white block">Fatoumata B.</span>
                <span className="text-[11px] text-neutral-400">Dakar, Sénégal</span>
              </div>
              <span className="font-mono text-white text-[11px]">~620k F / mois</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. ARCHITECTURAL FAQ ACCORDION */}
      <section className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium">
            Précisions
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Questions fréquentes
          </h2>
        </div>

        <div className="divide-y divide-white/[0.08] border-t border-b border-white/[0.08]">
          {FAQS.map((faq, index) => (
            <div key={index} className="py-4">
              <button
                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                className="w-full flex items-baseline justify-between text-left text-xs sm:text-sm font-semibold text-white hover:text-neutral-300 transition-colors gap-4"
              >
                <span>{faq.q}</span>
                <span className="font-mono text-sm text-neutral-400 shrink-0">
                  {openFaqIndex === index ? '−' : '+'}
                </span>
              </button>
              {openFaqIndex === index && (
                <div className="mt-3 text-xs text-neutral-400 leading-relaxed max-w-2xl">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 8. FINAL CALL TO ACTION */}
      <section className="max-w-4xl mx-auto text-center border-t border-white/[0.08] pt-16 space-y-6">
        <div className="space-y-3">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Prêt à lancer votre studio ?
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto">
            Accédez à la suite logicielle et découvrez comment composer et livrer un morceau complet en moins de 18 minutes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={onOpenStudio}
            className="w-full sm:w-auto rounded-full bg-white text-black hover:bg-neutral-200 px-8 py-3.5 text-xs font-semibold tracking-tight transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            Ouvrir l'atelier studio
          </button>

          <button
            onClick={onOpenCockpit}
            className="w-full sm:w-auto rounded-full border border-white/15 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/30 px-7 py-3.5 text-xs font-medium text-neutral-300 hover:text-white transition-all"
          >
            Consulter le cockpit des ventes
          </button>
        </div>
      </section>

      {/* 9. FOOTER COLOPHON */}
      <footer className="pt-12 border-t border-white/[0.08] text-xs text-neutral-400 space-y-4">
        <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-white tracking-tight text-sm">VELARIS</span>
            <span className="text-[10px] uppercase tracking-widest text-neutral-400">Studio OS</span>
          </div>

          <p className="text-[11px] text-neutral-400">
            Plateforme de composition & d'automatisation commerciale sur WhatsApp.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2 text-[10px] text-neutral-400 border-t border-white/[0.04] pt-4">
          <span>© 2026 Velaris Platform. Tous droits réservés.</span>
          <span>Abidjan • Ouagadougou • Dakar</span>
        </div>
      </footer>
    </div>
  );
};
