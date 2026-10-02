import { useState, type CSSProperties, type FC, type PointerEvent } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  Mic,
  PenLine,
  Plus,
  Send,
  type LucideIcon
} from 'lucide-react';
import { StudioAudioShowcase } from './StudioAudioShowcase';
import { HeroBriefToSong } from './HeroBriefToSong';
import { SonarGlyph } from './SonarMascot';
import { VelarisMark } from './VelarisMark';

interface LandingPageProps {
  onOpenStudio?: () => void;
  onOpenCockpit?: () => void;
  onOpenAcademy?: () => void;
  onOpenCopilot?: () => void;
}

const MODULES = [
  { num: '01', title: 'Fondations du studio & grille tarifaire', duration: '45 min' },
  { num: '02', title: 'Acquisition publicitaire à petit budget', duration: '1 h 15' },
  { num: '03', title: 'Psychologie de vente & closing WhatsApp', duration: '55 min' },
  { num: '04', title: 'Production musicale & mastering automatisé', duration: '1 h 05' },
];

const STUDIO_FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Mic, title: 'Transcription vocale assistée', desc: 'Prénoms, sentiments et anecdotes extraits de la note audio du client.' },
  { icon: PenLine, title: 'Paroles poétiques', desc: 'Couplets et refrains en rimes riches, modifiables en direct.' },
  { icon: AudioLines, title: 'Arrangements multi-styles', desc: 'Afro-love, guitare-voix, rumba, zouk et gospel, avec choix de la voix.' },
  { icon: Send, title: 'Livraison dans WhatsApp', desc: 'Texte et master envoyés directement dans la discussion du client.' },
];

const PRINCIPLES = [
  {
    figure: '85 à 95 %',
    title: 'Une demande émotionnelle continue',
    desc: 'Anniversaires, mariages, hommages familiaux. Le client achète une émotion durable : la sensibilité au prix devient secondaire, la marge reste haute.',
  },
  {
    figure: '0 studio',
    title: 'Aucune barrière physique',
    desc: "Ni local d'enregistrement, ni ingénieur du son, ni musiciens au cachet. La suite Velaris prend en charge l'arrangement et le mastering.",
  },
  {
    figure: 'Le jour même',
    title: 'Trésorerie sans intermédiaire',
    desc: 'Les fonds arrivent sur votre numéro Wave ou Orange Money dès la validation des paroles. Aucun délai bancaire.',
  },
];

const FAQS = [
  {
    q: 'Faut-il des compétences en chant, en solfège ou en musique ?',
    a: 'Aucune. La suite Velaris prend en charge toute la chaîne acoustique : paroles, mélodie, instrumentation, voix et mastering. Vous êtes directeur artistique et commerçant : vous recueillez l’histoire du client sur WhatsApp, le système génère le morceau masterisé.',
  },
  {
    q: 'Quel budget faut-il pour démarrer ?',
    a: 'Un smartphone ou un ordinateur suffit. Pour vos premiers clients, un test publicitaire de 5 000 à 10 000 FCFA génère en général 20 à 40 conversations qualifiées.',
  },
  {
    q: 'Comment et quand les clients paient-ils ?',
    a: 'Directement sur vos comptes Mobile Money (Wave, Orange Money, Moov, MTN), dès la validation du texte des paroles envoyé sur WhatsApp. Le risque d’impayé disparaît.',
  },
  {
    q: 'Combien de temps prend une commande ?',
    a: 'Entre la note vocale initiale et la livraison du fichier audio sur WhatsApp, il s’écoule en général 18 minutes. Assez pour traiter 5 à 10 commandes par jour.',
  },
  {
    q: 'Quelle rentabilité nette constate-t-on ?',
    a: 'La marge nette se situe entre 85 % et 95 %. Pour une commande à 3 000 FCFA avec vidéo souvenir, le coût de calcul est de quelques dizaines de francs.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Fatoumata Bâ',
    city: 'Dakar, Sénégal',
    revenue: '620 000',
    quote: 'La formule à 3 000 FCFA avec vidéo souvenir est plébiscitée pour les fêtes de famille. Les clients la partagent sur leur statut WhatsApp : le bouche-à-oreille tourne sans surcoût publicitaire.',
  },
  {
    name: 'Patrick Kouamé',
    city: 'Abidjan, Côte d’Ivoire',
    revenue: '450 000',
    quote: 'Deux semaines après le module d’acquisition, mes campagnes étaient rentables. Je tiens un rythme de 4 à 5 livraisons par jour.',
  },
  {
    name: 'Idrissa Sawadogo',
    city: 'Ouagadougou, Burkina Faso',
    revenue: '380 000',
    quote: 'Je n’avais aucune notion musicale. Le texte offert avant paiement rassure les hésitants : une fois validé, le paiement suit sans négociation.',
  },
];

const trackPointer = (e: PointerEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

const SectionTitle: FC<{ title: string; lead?: string }> = ({ title, lead }) => (
  <div className="max-w-2xl">
    <h2 className="font-heading text-[28px] sm:text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-white">{title}</h2>
    {lead && <p className="mt-3 text-[15px] leading-relaxed text-neutral-400">{lead}</p>}
  </div>
);

export const LandingPage: FC<LandingPageProps> = ({ onOpenAcademy, onOpenCopilot }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const WHATSAPP_ORDER_URL = 'https://wa.me/22656240533?text=' + encodeURIComponent('Bonjour Velaris, je souhaite créer une chanson personnalisée.');

  const scrollToAudio = () => {
    document.getElementById('audio-showcase')?.scrollIntoView({ behavior: 'smooth' });
  };

  const [featured, ...others] = TESTIMONIALS;

  return (
    <div className="pb-24 text-neutral-300 relative z-10 space-y-24 sm:space-y-32">
      {/* 1. Hero */}
      <section className="relative pt-6 sm:pt-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[520px] w-[min(1100px,100vw)] bg-[radial-gradient(closest-side,rgba(214,170,96,0.08),transparent)]"
        />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          <div className="vx-view-enter">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
              Studio ouvert, délai moyen de livraison 18 min
            </div>

            <h1 className="mt-6 font-heading text-[44px] sm:text-6xl lg:text-[76px] font-bold leading-[0.98] tracking-[-0.04em] text-white">
              De la note vocale à la chanson livrée.
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-neutral-400">
              L'académie et la suite logicielle pour lancer votre studio de chansons personnalisées sur WhatsApp. Encaissement direct sur
              Wave et Orange Money, sans intermédiaire.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href={WHATSAPP_ORDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press shadow-[0_0_32px_rgba(255,255,255,0.14)]"
              >
                Commander sur WhatsApp
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={scrollToAudio}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.02] px-6 py-3.5 text-sm font-medium text-white hover:bg-white/[0.06] hover:border-white/30 transition-colors duration-200 cursor-pointer"
              >
                <AudioLines className="h-4 w-4" strokeWidth={1.5} />
                Écouter un exemple
              </button>
            </div>

            {onOpenCopilot && (
              <button
                type="button"
                onClick={onOpenCopilot}
                className="group mt-6 inline-flex items-center gap-3 rounded-full py-1 pr-3 text-left cursor-pointer"
              >
                <SonarGlyph size={32} />
                <span>
                  <span className="block text-[13px] font-medium text-white group-hover:underline underline-offset-4 decoration-white/30">
                    Rencontrer Sonar, le copilot du studio
                  </span>
                  <span className="block text-[12px] text-neutral-500">Ventes, conversations et paroles, sur simple question</span>
                </span>
              </button>
            )}
          </div>

          <div className="vx-view-enter lg:pl-4" style={{ animationDelay: '120ms' }}>
            <HeroBriefToSong />
          </div>
        </div>

        {/* Repères chiffrés */}
        <dl className="relative max-w-6xl mx-auto mt-16 sm:mt-20 grid grid-cols-2 md:grid-cols-4 border-y border-white/[0.08] divide-x divide-white/[0.06]">
          {[
            { label: 'Panier moyen', value: '1 200 à 5 000', unit: 'FCFA', note: 'par commande' },
            { label: 'Cadence', value: '18', unit: 'min', note: 'de la note au master' },
            { label: 'Marge nette', value: '85 à 95', unit: '%', note: 'coûts de calcul minimes' },
            { label: 'Encaissement', value: 'Direct', unit: '', note: 'Wave et Orange Money' },
          ].map((s, i) => (
            <div key={s.label} style={{ '--i': i + 3 } as CSSProperties} className={`vx-stagger px-4 sm:px-6 py-6 ${i >= 2 ? 'border-t md:border-t-0 border-white/[0.06]' : ''}`}>
              <dt className="text-[12px] text-neutral-500">{s.label}</dt>
              <dd className="mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight text-white">
                {s.value}
                {s.unit && <span className="ml-1.5 text-xs font-medium text-neutral-500">{s.unit}</span>}
              </dd>
              <dd className="mt-1 text-[12px] text-neutral-500">{s.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 2. Extraits audio */}
      <section className="max-w-5xl mx-auto">
        <StudioAudioShowcase />
      </section>

      {/* 3. Principes économiques */}
      <section className="max-w-6xl mx-auto space-y-12">
        <SectionTitle
          title="Un studio rentable dès le premier mois."
          lead="Trois raisons structurelles, vérifiées sur des studios en activité à Abidjan, Ouagadougou et Dakar."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.06]">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="bg-[#07080B] p-7 sm:p-8">
              <div className="font-heading text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#E9CC94]">{p.figure}</div>
              <h3 className="mt-6 text-base font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Écosystème */}
      <section className="max-w-6xl mx-auto space-y-12">
        <SectionTitle title="Apprendre la méthode. Disposer de l'outil." />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Académie */}
          <div
            onPointerMove={trackPointer}
            className="vx-spotlight vx-hairline flex flex-col rounded-3xl border border-white/[0.08] bg-[#08090C] p-7 sm:p-9 transition-colors duration-300 hover:border-white/[0.16]"
          >
            <div className="relative flex-1">
              <div className="text-[13px] text-neutral-500">Formation</div>
              <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white">L'Académie du studio</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400 max-w-md">
                Positionner vos offres, acheter de la publicité rentable à petit budget et convertir sur WhatsApp avec des scripts testés.
              </p>
              <ol className="mt-7 border-t border-white/[0.06]">
                {MODULES.map(mod => (
                  <li key={mod.num} className="flex items-baseline gap-4 border-b border-white/[0.06] py-3.5 text-sm">
                    <span className="font-mono text-xs text-[#D6AA60]">{mod.num}</span>
                    <span className="flex-1 text-neutral-200">{mod.title}</span>
                    <span className="font-mono text-xs text-neutral-500 shrink-0">{mod.duration}</span>
                  </li>
                ))}
              </ol>
            </div>
            <button
              type="button"
              onClick={onOpenAcademy}
              className="relative mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.15] py-3 text-xs font-semibold text-white hover:bg-white/[0.05] hover:border-white/30 transition-colors duration-200 cursor-pointer"
            >
              Voir le programme détaillé
            </button>
          </div>

          {/* Studio OS */}
          <div
            onPointerMove={trackPointer}
            className="vx-spotlight vx-hairline flex flex-col rounded-3xl border border-white/[0.08] bg-[#08090C] p-7 sm:p-9 transition-colors duration-300 hover:border-white/[0.16]"
          >
            <div className="relative flex-1">
              <div className="text-[13px] text-neutral-500">Suite logicielle</div>
              <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight text-white">Le Studio OS</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400 max-w-md">
                L'atelier complet, de la note vocale WhatsApp au rendu haute fidélité, piloté depuis un seul écran.
              </p>
              <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {STUDIO_FEATURES.map(f => {
                  const Icon = f.icon;
                  return (
                    <li key={f.title}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-neutral-300">
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </span>
                      <div className="mt-3 text-sm font-medium text-white">{f.title}</div>
                      <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{f.desc}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
            <a
              href={WHATSAPP_ORDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-semibold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all duration-150 ease-press"
            >
              Lancer une commande test sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* 5. Témoignages */}
      <section className="max-w-6xl mx-auto space-y-12">
        <SectionTitle title="Ils ont ouvert leur studio." />
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
          <figure className="vx-hairline relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#08090C] p-8 sm:p-10 flex flex-col justify-between">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_16rem_at_100%_0%,rgba(214,170,96,0.08),transparent_70%)]"
            />
            <blockquote className="relative font-serif text-2xl sm:text-[30px] leading-[1.3] text-[#F1E6CF]">
              « {featured.quote} »
            </blockquote>
            <figcaption className="relative mt-10 flex items-end justify-between gap-4 border-t border-white/[0.06] pt-5">
              <div>
                <div className="text-sm font-semibold text-white">{featured.name}</div>
                <div className="text-[12px] text-neutral-500">{featured.city}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold tracking-tight text-white">{featured.revenue} F</div>
                <div className="text-[11px] text-neutral-500">par mois, en moyenne</div>
              </div>
            </figcaption>
          </figure>

          <div className="grid grid-cols-1 gap-5">
            {others.map(t => (
              <figure key={t.name} className="rounded-3xl border border-white/[0.08] bg-[#08090C] p-6 sm:p-7 flex flex-col justify-between">
                <blockquote className="text-sm leading-relaxed text-neutral-300">« {t.quote} »</blockquote>
                <figcaption className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold text-white">{t.name}</div>
                    <div className="text-[11.5px] text-neutral-500">{t.city}</div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-white">
                    {t.revenue} F<span className="text-neutral-500 font-normal"> / mois</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Questions fréquentes */}
      <section className="max-w-3xl mx-auto space-y-10">
        <SectionTitle title="Questions fréquentes" />
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
                      open ? 'rotate-45 border-white/30 text-white' : 'border-white/[0.12] text-neutral-400'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ease-luxury ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <p className="pb-6 pr-12 text-sm leading-relaxed text-neutral-400">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Appel final */}
      <section className="relative max-w-5xl mx-auto overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#08090C] px-6 py-16 sm:py-20 text-center vx-grain">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_120%,rgba(214,170,96,0.16),transparent_70%)]"
        />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl font-heading text-4xl sm:text-6xl font-bold leading-[1] tracking-[-0.04em] text-white">
            Votre première chanson part aujourd'hui.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-neutral-400">
            Écrivez au studio sur WhatsApp pour offrir un morceau sur mesure, ou pour tester la suite logicielle.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <a
              href={WHATSAPP_ORDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press shadow-[0_0_32px_rgba(255,255,255,0.14)]"
            >
              Commander sur WhatsApp
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={scrollToAudio}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.15] px-7 py-3.5 text-sm font-medium text-white hover:bg-white/[0.05] hover:border-white/30 transition-colors duration-200 cursor-pointer"
            >
              Réécouter les extraits
            </button>
          </div>
        </div>
      </section>

      {/* 8. Pied de page */}
      <footer className="max-w-6xl mx-auto pt-10 border-t border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <VelarisMark className="h-6 w-6 text-white" />
            <span className="font-heading text-base font-bold tracking-tight text-white">Velaris</span>
          </div>
          <p className="text-sm text-neutral-500 max-w-sm">Composition musicale et vente automatisée sur WhatsApp.</p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-2 border-t border-white/[0.05] pt-5 text-xs text-neutral-500">
          <span>© 2026 Velaris. Tous droits réservés.</span>
          <span>Abidjan, Ouagadougou, Dakar</span>
        </div>
      </footer>
    </div>
  );
};
