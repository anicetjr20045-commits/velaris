import { useState, type FC } from 'react';
import { LiquidSoundOrb } from './LiquidSoundOrb';
import { StudioAudioShowcase } from './StudioAudioShowcase';

interface LandingPageProps {
  onOpenStudio?: () => void;
  onOpenCockpit?: () => void;
  onOpenAcademy?: () => void;
}

const MODULES = [
  {
    num: '01',
    title: 'Fondations du Studio & Grille Tarifaire',
    duration: '45 min',
    desc: 'Positionnement de marque, structuration des 3 offres (1 200, 3 000 et 5 000 FCFA) et configuration de la ligne WhatsApp professionnelle pour inspirer confiance.',
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
    desc: 'Maîtrise complète de la suite logicielle : transcription des notes vocales, poétisation des rimes, arrangements multi-styles et livraison directe.',
  },
];

const FAQS = [
  {
    q: 'Faut-il des compétences en chant, en solfège ou en musique ?',
    a: 'Aucune compétence musicale n’est requise. La suite logicielle Velaris prend en charge l’intégralité de la chaîne acoustique (paroles, mélodie, instrumentation, voix et mastering). Vous agissez en tant que directeur artistique et commerçant : vous recueillez l’histoire de votre client sur WhatsApp, et le système génère le morceau masterisé en un clic.',
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
    a: 'La marge nette moyenne oscille entre 85 % et 95 %. Pour une commande vendue 3 000 FCFA avec vidéo souvenir, le coût direct de calcul logiciel est de quelques dizaines de francs. Le solde constitue votre bénéfice net immédiat.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Patrick Kouamé',
    city: 'Abidjan, Côte d’Ivoire',
    revenue: '450 000',
    quote: 'Deux semaines après avoir suivi le module d’acquisition publicitaire, mes campagnes étaient rentabilisées. Je maintiens un rythme régulier de 4 à 5 livraisons quotidiennes. L’atelier me fait gagner plusieurs heures par morceau composé.',
  },
  {
    name: 'Idrissa Sawadogo',
    city: 'Ouagadougou, Burkina Faso',
    revenue: '380 000',
    quote: 'Je n’avais aucune notion musicale préalable. Le protocole de validation du texte gratuit sur WhatsApp rassure les clients les plus hésitants. Dès que les paroles sont validées, le paiement par Mobile Money se fait sans négociation.',
  },
  {
    name: 'Fatoumata Bâ',
    city: 'Dakar, Sénégal',
    revenue: '620 000',
    quote: 'La formule personnalisée à 3 000 FCFA avec vidéo souvenir est plébiscitée pour les célébrations familiales. Les clients partagent la vidéo sur leur statut WhatsApp, générant un bouche-à-oreille continu sans surcoût publicitaire.',
  },
];

export const LandingPage: FC<LandingPageProps> = ({ onOpenAcademy }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const WHATSAPP_ORDER_URL = 'https://wa.me/22656240533?text=' + encodeURIComponent('Bonjour Velaris, je souhaite créer une chanson personnalisée.');

  const scrollToAudio = () => {
    const el = document.getElementById('audio-showcase');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-28 text-zinc-300 relative z-10">
      {/* 1. HERO SECTION */}
      <section className="pt-6 sm:pt-14 pb-2 max-w-5xl mx-auto text-center space-y-6">
        {/* Subtle Architectural Tag */}
        <div className="inline-block text-xs uppercase tracking-widest text-[#c5a059] font-medium">
          Suite logicielle de composition & Académie WhatsApp
        </div>

        {/* Master Headline */}
        <div className="space-y-4">
          <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05] max-w-4xl mx-auto">
            L’Atelier de Création Musicale sur WhatsApp.
          </h1>

          <p className="text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed font-normal">
            De la note vocale WhatsApp au master studio haute fidélité, avec encaissement direct sans intermédiaire sur Wave et Orange Money.
          </p>
        </div>

        {/* Call to Actions (Point 5: wa.me primary CTA, scroll to player secondary CTA) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a
            href={WHATSAPP_ORDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto rounded-full bg-white text-black hover:bg-neutral-200 px-8 py-3.5 text-sm font-semibold tracking-tight transition-all active:scale-95 shadow-[0_0_25px_rgba(255,255,255,0.12)]"
          >
            Commander sur WhatsApp
          </a>

          <button
            type="button"
            onClick={scrollToAudio}
            className="w-full sm:w-auto rounded-full border border-white/20 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/40 px-7 py-3.5 text-sm font-medium text-white transition-all cursor-pointer"
          >
            Écouter un exemple
          </button>
        </div>

        {/* 3D Visual Piece (with cards cleanly separated below, Point 7) */}
        <LiquidSoundOrb />

        {/* 4 Architectural Columns Strip (Point 4: French number formatting & non-breaking spaces, Point 8: >= 14px captions) */}
        <div className="pt-8 border-t border-white/[0.08] grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-left">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#c5a059] font-medium">
              Panier moyen
            </div>
            <div className="font-sans text-xl font-bold text-white mt-1">
              1&nbsp;200 à 5&nbsp;000 <span className="whitespace-nowrap">FCFA</span>
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">Par commande client</p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-[#c5a059] font-medium">
              Cadence studio
            </div>
            <div className="font-sans text-xl font-bold text-white mt-1">
              18 minutes
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">De la note au master HD</p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-[#c5a059] font-medium">
              Marge nette
            </div>
            <div className="font-sans text-xl font-bold text-white mt-1">
              85 à 95 %
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">Coûts de calcul minimaux</p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-[#c5a059] font-medium">
              Encaissement
            </div>
            <div className="font-sans text-xl font-bold text-white mt-1">
              Direct & immédiat
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">Wave & Orange Money</p>
          </div>
        </div>
      </section>

      {/* 2. AUDIO SHOWCASE PLAYER (Point 6: Placed directly below the hero) */}
      <section className="max-w-5xl mx-auto">
        <StudioAudioShowcase />
      </section>

      {/* 3. BUSINESS FOUNDATIONS (ARCHITECTURAL 3-COLUMN EDITORIAL) */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="max-w-xl space-y-2">
          <div className="text-xs uppercase tracking-widest text-[#c5a059] font-medium">
            Principes économiques
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Les trois piliers d'un studio rentabilisé dès le premier mois
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 border-t border-white/[0.08] pt-8">
          <div className="space-y-3">
            <span className="text-sm font-mono text-[#c5a059]">01</span>
            <h3 className="font-heading text-lg font-bold text-white">
              Une demande émotionnelle continue
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Anniversaires, fiançailles, mariages, hommages familiaux. Les clients recherchent un cadeau intime qui suscite une émotion durable, rendant la sensibilité au prix secondaire.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-mono text-[#c5a059]">02</span>
            <h3 className="font-heading text-lg font-bold text-white">
              Suppression des barrières physiques
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Plus besoin de locaux d’enregistrement, d’ingénieurs du son ni de musiciens payés au cachet. La suite logicielle Velaris prend en charge l’arrangement musical et le mastering en direct.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-mono text-[#c5a059]">03</span>
            <h3 className="font-heading text-lg font-bold text-white">
              Trésorerie instantanée sans intermédiaire
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Les fonds arrivent directement sur votre propre numéro Wave ou Orange Money dès validation des paroles. Vous disposez de vos bénéfices le jour même sans délai bancaire.
            </p>
          </div>
        </div>
      </section>

      {/* 4. THE TWO CORE PILLARS (ACADEMY + ENGINE) */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="max-w-xl space-y-2">
          <div className="text-xs uppercase tracking-widest text-[#c5a059] font-medium">
            L'Écosystème Velaris
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Deux fondations indissociables pour réussir
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Pillar 1: Syllabus Académie */}
          <div className="border border-white/[0.08] bg-[#0c0d11]/80 rounded-2xl p-7 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-xs uppercase font-mono tracking-wider text-[#c5a059]">
                Volet 01 • Formation & Méthode
              </div>
              <h3 className="font-heading text-xl font-bold text-white">
                L'Académie du Studio
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Le parcours pas-à-pas pour positionner vos offres, maîtriser la publicité rentable à petit budget et convertir vos prospects sur WhatsApp avec nos scripts de closing.
              </p>

              <div className="divide-y divide-white/[0.06] border-t border-white/[0.06] pt-2">
                {MODULES.map((mod) => (
                  <div key={mod.num} className="py-3 text-sm flex items-baseline justify-between gap-4">
                    <div>
                      <span className="font-mono text-[#c5a059] mr-2">{mod.num}</span>
                      <span className="font-medium text-white">{mod.title}</span>
                    </div>
                    <span className="font-mono text-xs text-zinc-400 shrink-0">{mod.duration}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenAcademy}
              className="w-full rounded-full border border-white/20 bg-white/[0.02] hover:bg-white/[0.08] py-3 text-xs font-semibold text-white transition-colors"
            >
              Consulter le programme détaillé
            </button>
          </div>

          {/* Pillar 2: Studio OS */}
          <div className="border border-white/[0.1] bg-[#0c0d11]/80 rounded-2xl p-7 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-xs uppercase font-mono tracking-wider text-[#c5a059]">
                Volet 02 • Suite Logicielle
              </div>
              <h3 className="font-heading text-xl font-bold text-white">
                Le Studio OS
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                L’atelier complet de fabrication : de la transcription de l’audio WhatsApp à l’arrangement et au rendu acoustique haute fidélité en un clic.
              </p>

              <div className="space-y-3 pt-2 border-t border-white/[0.06] text-sm">
                <div className="py-2 border-b border-white/[0.04]">
                  <strong className="text-white block font-medium">Transcription vocale assistée</strong>
                  <span className="text-zinc-400 text-xs">Analyse des sentiments, prénoms et anecdotes depuis la note audio du client.</span>
                </div>

                <div className="py-2 border-b border-white/[0.04]">
                  <strong className="text-white block font-medium">Composition de paroles poétiques</strong>
                  <span className="text-zinc-400 text-xs">Couplets et refrains structurés en rimes riches, modifiables en direct.</span>
                </div>

                <div className="py-2 border-b border-white/[0.04]">
                  <strong className="text-white block font-medium">Arrangements acoustiques multi-styles</strong>
                  <span className="text-zinc-400 text-xs">Afro-Love, Guitare & Voix, Rumba, Zouk et Gospel avec sélection de voix.</span>
                </div>

                <div className="py-2">
                  <strong className="text-white block font-medium">Liaison WhatsApp directe</strong>
                  <span className="text-zinc-400 text-xs">Envoi du texte et du master musical directement dans la discussion du client.</span>
                </div>
              </div>
            </div>

            <a
              href={WHATSAPP_ORDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center rounded-full bg-white hover:bg-neutral-200 py-3 text-xs font-semibold text-black transition-all active:scale-95"
            >
              Lancer une commande test sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* 5. TESTIMONIALS (Point 12: Verified names, cities, complete sentences) */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="max-w-xl space-y-2">
          <div className="text-xs uppercase tracking-widest text-[#c5a059] font-medium">
            Retours d'expérience
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Créateurs en activité
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-white/[0.08] pt-8 text-sm">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="space-y-4">
              <p className="text-zinc-300 leading-relaxed italic">
                « {t.quote} »
              </p>
              <div className="border-t border-white/[0.06] pt-3 flex items-baseline justify-between">
                <div>
                  <span className="font-semibold text-white block">{t.name}</span>
                  <span className="text-xs text-zinc-400">{t.city}</span>
                </div>
                <span className="font-sans text-xs text-emerald-400 font-semibold">
                  ~{t.revenue}&nbsp;<span className="whitespace-nowrap">FCFA</span>&nbsp;/&nbsp;mois
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. ARCHITECTURAL FAQ ACCORDION */}
      <section className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-[#c5a059] font-medium">
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
                type="button"
                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                className="w-full flex items-baseline justify-between text-left text-sm sm:text-base font-semibold text-white hover:text-neutral-200 transition-colors gap-4 cursor-pointer"
              >
                <span>{faq.q}</span>
                <span className="font-mono text-sm text-[#c5a059] shrink-0">
                  {openFaqIndex === index ? '−' : '+'}
                </span>
              </button>
              {openFaqIndex === index && (
                <div className="mt-3 text-sm text-zinc-300 leading-relaxed max-w-2xl">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 7. FINAL CALL TO ACTION */}
      <section className="max-w-4xl mx-auto text-center border-t border-white/[0.08] pt-14 space-y-6">
        <div className="space-y-3">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Prêt à créer votre première chanson ?
          </h2>
          <p className="text-sm text-zinc-300 max-w-lg mx-auto">
            Discutez directement avec notre studio WhatsApp pour concevoir un morceau sur mesure pour un proche ou tester la suite logicielle.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a
            href={WHATSAPP_ORDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto rounded-full bg-white text-black hover:bg-neutral-200 px-8 py-3.5 text-sm font-semibold tracking-tight transition-all active:scale-95 shadow-[0_0_25px_rgba(255,255,255,0.1)]"
          >
            Commander sur WhatsApp
          </a>

          <button
            type="button"
            onClick={scrollToAudio}
            className="w-full sm:w-auto rounded-full border border-white/20 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/40 px-7 py-3.5 text-sm font-medium text-white transition-all cursor-pointer"
          >
            Réécouter les extraits
          </button>
        </div>
      </section>

      {/* 8. FOOTER COLOPHON */}
      <footer className="pt-10 border-t border-white/[0.08] text-sm text-zinc-400 space-y-4">
        <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-white tracking-tight text-base">VELARIS</span>
            <span className="text-xs uppercase tracking-widest text-[#c5a059]">Studio Musical</span>
          </div>

          <p className="text-sm text-zinc-400">
            Plateforme de composition et d’automatisation commerciale sur WhatsApp.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2 text-xs text-zinc-400 border-t border-white/[0.04] pt-4">
          <span>© 2026 Velaris Platform. Tous droits réservés.</span>
          <span>Abidjan • Ouagadougou • Dakar</span>
        </div>
      </footer>
    </div>
  );
};
