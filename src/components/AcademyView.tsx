import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent, type ReactNode } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Megaphone,
  MessageSquareText,
  Music,
  Pause,
  Play,
  PlayCircle,
  SkipBack,
  SkipForward
} from 'lucide-react';
import type { AcademyModule } from '../types';

interface AcademyViewProps {
  modules: AcademyModule[];
}

/* ------------------------------------------------------------------ */
/* Cursus                                                             */
/* ------------------------------------------------------------------ */

interface Chapter {
  title: string;
  minutes: number;
  points: [string, string, string];
}

const CURRICULUM: Record<string, Chapter[]> = {
  'mod-1': [
    { title: 'Le flux en 18 minutes', minutes: 6, points: ['Brief vocal, paroles, génération, livraison : chaque étape a un temps cible.', 'Préparer ses comptes Suno et Kie.ai avant la première vente.', 'Un dossier par client : brief, paroles validées, masters.'] },
    { title: 'Écrire des paroles qui touchent', minutes: 9, points: ['Partir de trois souvenirs précis plutôt que d’adjectifs génériques.', 'Placer le prénom dans le refrain, deux fois au minimum.', 'Couplet, refrain, pont : c’est le pont qui porte l’émotion.'] },
    { title: 'Les styles africains dans Suno', minutes: 8, points: ['Afro-love, zouk, rumba, mandingue : les tags qui fonctionnent.', 'Toujours préciser le tempo et l’instrument principal.', 'Éviter les tags contradictoires qui brouillent la voix.'] },
    { title: 'Voix : genre, timbre, langue', minutes: 7, points: ['Voix femme, homme ou duo selon l’occasion et le destinataire.', 'Mêler français et langue locale sur le refrain.', 'Régénérer plutôt que corriger une prononciation ratée.'] },
    { title: 'Choisir le bon master', minutes: 8, points: ['Générer deux versions et écouter les 30 premières secondes.', 'Vérifier la prononciation du prénom avant tout le reste.', 'Exporter en MP3 HD, nommer le fichier au prénom du client.'] },
    { title: 'Livrer et faire réagir', minutes: 7, points: ['Envoyer le master en audio et en fichier.', 'Demander une réaction vocale : c’est votre futur témoignage.', 'Proposer la vidéo paroles en montée de gamme.'] },
  ],
  'mod-2': [
    { title: 'Le budget test de 5 000 F', minutes: 8, points: ['Trois publicités, trois jours, un seul objectif : des conversations.', 'Ne rien juger avant 48 heures de diffusion.', 'Garder 20 % du budget pour relancer la gagnante.'] },
    { title: 'L’accroche des 3 premières secondes', minutes: 10, points: ['Commencer par une réaction réelle, jamais par le logo.', 'Un texte à l’écran lisible sans le son.', 'Une seule promesse : la chanson qui porte son prénom.'] },
    { title: 'Montrer la réaction, pas le produit', minutes: 10, points: ['Filmer l’écoute : les larmes vendent mieux que la musique.', 'Demander l’accord écrit avant toute diffusion.', 'Varier les occasions : anniversaire, mariage, hommage.'] },
    { title: 'Ciblage large et événements de vie', minutes: 9, points: ['Laisser l’algorithme trouver : ciblage large d’abord.', 'Anniversaires d’amis proches et fiançailles récentes.', 'Exclure les clients déjà servis.'] },
    { title: 'Publicité clic vers WhatsApp', minutes: 9, points: ['Objectif messages, destination WhatsApp.', 'Message pré-rempli court : prénom et occasion.', 'Un numéro dédié au studio, connecté à l’agent.'] },
    { title: 'TikTok : format natif et sons', minutes: 10, points: ['Vertical, brut, filmé au téléphone.', 'Mettre un extrait de la chanson en son d’origine.', 'Répondre aux commentaires en vidéo.'] },
    { title: 'Lire les chiffres', minutes: 10, points: ['Coût par conversation : la seule métrique du test.', 'Taux de réponse au premier message du studio.', 'Conversion conversation vers paiement sur 7 jours.'] },
    { title: 'Doubler ce qui marche', minutes: 9, points: ['Augmenter de 20 % par jour, jamais plus.', 'Dupliquer la gagnante sur une nouvelle audience.', 'Couper sans état d’âme ce qui dépasse le coût cible.'] },
  ],
  'mod-3': [
    { title: 'Répondre en moins de 5 minutes', minutes: 6, points: ['La vitesse de réponse double le taux de conversion.', 'Message d’accueil prêt, envoyé par l’agent.', 'Une question à la fois, jamais un pavé.'] },
    { title: 'Les questions de découverte', minutes: 7, points: ['Pour qui, quelle occasion, pour quand.', 'Demander une note vocale : le client s’engage.', 'Reformuler le brief avant d’annoncer quoi que ce soit.'] },
    { title: 'Le texte d’abord', minutes: 8, points: ['Écrire les paroles avant le paiement.', 'Le client lit son histoire : la décision est prise.', 'Limiter à une seule série de corrections.'] },
    { title: 'Annoncer le prix sans s’excuser', minutes: 7, points: ['Présenter deux formules, recommander celle du milieu.', 'Le prix suit la valeur : livraison en 18 minutes.', 'Se taire après l’annonce du prix.'] },
    { title: 'Les quatre objections classiques', minutes: 8, points: ['« C’est cher » : comparer à un cadeau ordinaire.', '« Je vais réfléchir » : proposer un extrait.', '« Plus tard » : rappeler la date de l’occasion.'] },
    { title: 'Paiement Wave et Orange Money', minutes: 7, points: ['Envoyer le numéro et le montant exact en un message.', 'Demander la capture du paiement.', 'Confirmer immédiatement et lancer la production.'] },
    { title: 'Relancer sans harceler', minutes: 7, points: ['Une relance à J+1, une dernière à J+3.', 'Apporter du nouveau à chaque relance.', 'Clore poliment : la porte reste ouverte.'] },
  ],
  'mod-4': [
    { title: 'Connecter son numéro par QR code', minutes: 10, points: ['Un numéro dédié au studio, jamais le personnel.', 'Scanner le QR depuis Lignes WhatsApp.', 'Vérifier le statut « Flux WhatsApp actif » dans Discussions.'] },
    { title: 'Règles emoji : répondre en un geste', minutes: 12, points: ['Une réaction posée sur un message déclenche une réponse.', 'Texte, vocal, document ou vidéo selon la règle.', 'Pas plus de 60 envois automatiques par heure.'] },
    { title: 'Vocaux et documents automatiques', minutes: 12, points: ['Le vocal de présentation rassure plus que le texte.', 'La grille tarifaire en PDF évite les allers-retours.', 'La vidéo démo pour la formule à 3 000 F.'] },
    { title: 'Le pilote automatique du suivi client', minutes: 12, points: ['Chaque fiche avance seule selon les échanges et les paiements.', 'Un déplacement manuel reprend la main sur la fiche.', 'Relire le journal des mouvements chaque soir.'] },
    { title: 'Passer à 20 commandes par jour', minutes: 14, points: ['Déléguer l’accueil à l’agent, garder le closing.', 'Produire par lots : paroles le matin, masters l’après-midi.', 'Réinvestir 30 % de la marge en publicité.'] },
  ],
};

/* Cursus de secours si un module n'a pas de chapitres rédigés */
const chaptersOf = (mod: AcademyModule): Chapter[] =>
  CURRICULUM[mod.id] ??
  Array.from({ length: mod.lessonsCount }, (_, i) => ({
    title: `Chapitre ${i + 1}`,
    minutes: 0,
    points: [mod.description, '', ''] as [string, string, string],
  }));

/* ------------------------------------------------------------------ */
/* Boîte à outils                                                     */
/* ------------------------------------------------------------------ */

type ResourceCategory = 'suno' | 'whatsapp' | 'ads';

interface ResourceItem {
  id: string;
  title: string;
  category: ResourceCategory;
  content: string;
}

const CATEGORY_LABEL: Record<ResourceCategory, string> = {
  suno: 'Prompt Suno',
  whatsapp: 'Script WhatsApp',
  ads: 'Publicité',
};

const TOOLBOX_RESOURCES: ResourceItem[] = [
  {
    id: 'suno_afrolove',
    title: 'Afro-love acoustique',
    category: 'suno',
    content: `[Style] Afro-love, acoustic guitar, warm soulful vocal, 85 bpm, emotional, gentle West African percussion, romantic ballad

[Intro - guitare acoustique douce]
[Verse 1 - la rencontre avec {{prenom}}]
[Chorus - refrain avec le prénom {{prenom}}, chœurs]
[Verse 2 - gratitude pour {{occasion}}]
[Bridge - montée en émotion intime]
[Chorus - climax vocal]
[Outro - dédicace et fondu guitare]`,
  },
  {
    id: 'suno_gospel',
    title: 'Gospel de louange',
    category: 'suno',
    content: `[Style] African gospel, choir, organ, hand claps, uplifting, 96 bpm, powerful female lead vocal

[Intro - orgue et chœur a cappella]
[Verse 1 - témoignage de foi de {{prenom}}]
[Chorus - louange collective, prénom {{prenom}} repris par le chœur]
[Verse 2 - bénédiction pour {{occasion}}]
[Bridge - modulation, claps]
[Chorus - final triomphal]`,
  },
  {
    id: 'suno_zouk',
    title: 'Zouk d’anniversaire',
    category: 'suno',
    content: `[Style] Zouk love, smooth synth pads, soft drums, male and female duet, 90 bpm, festive and tender

[Intro - nappes douces]
[Verse 1 - souvenirs partagés avec {{prenom}}]
[Chorus - « joyeux {{occasion}}, {{prenom}} » en duo]
[Verse 2 - vœux pour l’année à venir]
[Chorus - duo et harmonies]
[Outro - rires et applaudissements]`,
  },
  {
    id: 'whatsapp_welcome',
    title: 'Accueil trafic publicitaire',
    category: 'whatsapp',
    content: `Bonjour et bienvenue au Studio.
Nous composons des chansons sur-mesure pour les moments qui comptent : anniversaires, fiançailles, hommages et mariages.

Pour démarrer, dites-nous le prénom de la personne et l’occasion. Une note vocale suffit.`,
  },
  {
    id: 'whatsapp_pricing',
    title: 'Tarif et validation des paroles',
    category: 'whatsapp',
    content: `Merci, nous avons bien noté l’histoire de {{prenom}} pour {{occasion}}.

1. Nous écrivons les paroles et vous les envoyons ici pour validation.
2. Vous choisissez votre formule :
   - 1 200 F : master audio HD
   - 3 000 F : master audio HD + vidéo paroles
3. Livraison sur WhatsApp en moins de 18 minutes après paiement.

On lance l’écriture ?`,
  },
  {
    id: 'whatsapp_followup',
    title: 'Relance à J+1',
    category: 'whatsapp',
    content: `Bonjour, les paroles pour {{prenom}} sont toujours prêtes de notre côté.
Il reste peu de temps avant {{occasion}} : voulez-vous que nous lancions la production aujourd’hui ?`,
  },
  {
    id: 'whatsapp_objection',
    title: 'Objection « c’est cher »',
    category: 'whatsapp',
    content: `Je comprends. Un bouquet ou un gâteau sont oubliés en une semaine.
La chanson de {{prenom}}, elle, sera réécoutée pendant des années, avec son prénom et vos souvenirs dedans.
Et vous ne payez qu’après avoir lu et validé les paroles.`,
  },
  {
    id: 'ads_copy',
    title: 'Texte Facebook et TikTok',
    category: 'ads',
    content: `Le cadeau le plus marquant que vous puissiez offrir pour {{occasion}}.
Une chanson originale, écrite à partir de vos souvenirs, avec son prénom dans le refrain.
Livrée sur WhatsApp en moins de 30 minutes.
Écrivez-nous et écoutez un extrait.`,
  },
  {
    id: 'ads_hook',
    title: 'Script vidéo 15 secondes',
    category: 'ads',
    content: `0-3 s : gros plan sur le visage de la personne qui découvre sa chanson. Texte : « Elle ne s’y attendait pas. »
3-9 s : extrait du refrain, le prénom bien audible.
9-13 s : texte : « Une chanson avec son prénom, livrée en 18 minutes. »
13-15 s : « Écrivez-nous sur WhatsApp. »`,
  },
];

const TOKEN = /(\{\{prenom\}\}|\{\{occasion\}\})/g;

/* Copie avec repli pour les navigateurs sans API Clipboard (HTTP, anciens WebView) */
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
};

/* ------------------------------------------------------------------ */
/* Progression persistée                                              */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'velaris.academy.v1';

interface Progress {
  completed: string[];
  seen: Record<string, number[]>;
}

const loadProgress = (modules: AcademyModule[]): Progress => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* progression illisible : repartir de l'état fourni */
  }
  return {
    completed: modules.filter(m => m.completed).map(m => m.id),
    seen: Object.fromEntries(modules.filter(m => m.completed).map(m => [m.id, chaptersOf(m).map((_, i) => i)])),
  };
};

const CHAPTER_PLAY_MS = 18000;
const RATES = [1, 1.5, 2] as const;

const moduleIcon = (iconName: string) => {
  const cls = 'h-4 w-4';
  switch (iconName) {
    case 'Music2':
      return <Music className={cls} strokeWidth={1.6} />;
    case 'Flame':
      return <Megaphone className={cls} strokeWidth={1.6} />;
    case 'MessageSquareText':
      return <MessageSquareText className={cls} strokeWidth={1.6} />;
    case 'Bot':
      return <Bot className={cls} strokeWidth={1.6} />;
    default:
      return <PlayCircle className={cls} strokeWidth={1.6} />;
  }
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatMinutes = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${pad2(min % 60)}` : `${min} min`);

export const AcademyView: FC<AcademyViewProps> = ({ modules }) => {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(modules));
  const [selectedModuleId, setSelectedModuleId] = useState(modules[0]?.id || '');
  const [chapterIdx, setChapterIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rateIdx, setRateIdx] = useState(0);
  const [category, setCategory] = useState<'all' | ResourceCategory>('all');
  const [fields, setFields] = useState({ prenom: '', occasion: '' });
  const [copied, setCopied] = useState<{ id: string; ok: boolean } | null>(null);
  const elapsedRef = useRef(0);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* stockage indisponible : la progression reste pour la session */
    }
  }, [progress]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const selectedModule = modules.find(m => m.id === selectedModuleId) || modules[0];
  const chapters = selectedModule ? chaptersOf(selectedModule) : [];
  const chapter = chapters[chapterIdx];
  const rate = RATES[rateIdx];
  const seenHere = progress.seen[selectedModule?.id] ?? [];
  const isCompleted = (id: string) => progress.completed.includes(id);

  const totals = useMemo(() => {
    let chaptersTotal = 0;
    let chaptersSeen = 0;
    let minutesLeft = 0;
    for (const m of modules) {
      const list = chaptersOf(m);
      const seen = new Set(progress.seen[m.id] ?? []);
      chaptersTotal += list.length;
      list.forEach((c, i) => {
        if (seen.has(i) || progress.completed.includes(m.id)) chaptersSeen += 1;
        else minutesLeft += c.minutes;
      });
    }
    return { chaptersTotal, chaptersSeen, minutesLeft, modulesDone: modules.filter(m => progress.completed.includes(m.id)).length };
  }, [modules, progress]);

  const overallPercent = totals.chaptersTotal ? Math.round((totals.chaptersSeen / totals.chaptersTotal) * 100) : 0;

  const markSeen = (moduleId: string, idx: number, total: number) => {
    setProgress(p => {
      const seen = Array.from(new Set([...(p.seen[moduleId] ?? []), idx])).sort((a, b) => a - b);
      const done = seen.length >= total && !p.completed.includes(moduleId);
      return { seen: { ...p.seen, [moduleId]: seen }, completed: done ? [...p.completed, moduleId] : p.completed };
    });
  };

  const goToChapter = (idx: number) => {
    elapsedRef.current = 0;
    setElapsed(0);
    setChapterIdx(Math.max(0, Math.min(chapters.length - 1, idx)));
  };

  const selectModule = (id: string) => {
    if (id === selectedModuleId) return;
    setSelectedModuleId(id);
    setPlaying(false);
    elapsedRef.current = 0;
    setElapsed(0);
    const mod = modules.find(m => m.id === id);
    const seen = new Set(progress.seen[id] ?? []);
    const firstUnseen = mod ? chaptersOf(mod).findIndex((_, i) => !seen.has(i)) : 0;
    setChapterIdx(firstUnseen < 0 ? 0 : firstUnseen);
  };

  /* Lecture guidée : chaque chapitre se déroule en ~18 s, les points clés apparaissent au fil de l'eau */
  useEffect(() => {
    if (!playing || !selectedModule) return;
    let frame = 0;
    let last = performance.now();
    const total = chapters.length;
    const tick = (now: number) => {
      elapsedRef.current = Math.min(1, elapsedRef.current + ((now - last) * rate) / CHAPTER_PLAY_MS);
      last = now;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= 1) {
        markSeen(selectedModule.id, chapterIdx, total);
        if (chapterIdx < total - 1) {
          elapsedRef.current = 0;
          setElapsed(0);
          setChapterIdx(chapterIdx + 1);
        } else {
          setPlaying(false);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, chapterIdx, rate, selectedModule?.id]);

  const togglePlay = () => {
    if (!playing && elapsedRef.current >= 1) goToChapter(chapterIdx);
    setPlaying(p => !p);
  };

  const onPlayerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'k') togglePlay();
    else if (e.key === 'ArrowRight') goToChapter(chapterIdx + 1);
    else if (e.key === 'ArrowLeft') goToChapter(chapterIdx - 1);
    else return;
    e.preventDefault();
  };

  const toggleModuleCompleted = (id: string) => {
    setProgress(p => {
      if (p.completed.includes(id)) return { ...p, completed: p.completed.filter(c => c !== id) };
      const mod = modules.find(m => m.id === id);
      const all = mod ? chaptersOf(mod).map((_, i) => i) : [];
      return { completed: [...p.completed, id], seen: { ...p.seen, [id]: all } };
    });
  };

  const fill = (text: string) =>
    text
      .replace(/\{\{prenom\}\}/g, fields.prenom.trim() || '[Prénom]')
      .replace(/\{\{occasion\}\}/g, fields.occasion.trim() || '[occasion]');

  const renderWithTokens = (text: string): ReactNode[] =>
    text.split(TOKEN).map((part, i) => {
      if (part === '{{prenom}}' || part === '{{occasion}}') {
        const value = part === '{{prenom}}' ? fields.prenom.trim() || 'Prénom' : fields.occasion.trim() || 'occasion';
        return (
          <span key={i} className="rounded bg-[#E5B54F]/[0.12] px-1 text-[#F3CA75]">
            {value}
          </span>
        );
      }
      return part;
    });

  const handleCopy = async (res: ResourceItem) => {
    const ok = await copyText(fill(res.content));
    setCopied({ id: res.id, ok });
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 2000);
  };

  const resources = TOOLBOX_RESOURCES.filter(r => category === 'all' || r.category === category);

  if (!selectedModule) return null;

  const pointsShown = chapter ? chapter.points.filter(Boolean).filter((_, i) => elapsed >= [0.08, 0.38, 0.68][i] || seenHere.includes(chapterIdx)) : [];
  const moduleChapterMinutes = chapters.reduce((s, c) => s + c.minutes, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-6xl mx-auto vx-view-enter">
      {/* En-tête du cursus */}
      <header className="rounded-[22px] border border-[#2D261E] bg-[#0E0C0A] p-6 sm:p-7 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-xs font-mono uppercase tracking-[0.14em] text-[#A8A29E]">Académie du studio</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight mt-2">
              Formation et maîtrise du studio WhatsApp
            </h1>
            <p className="text-sm sm:text-base text-[#A8A29E] mt-2 leading-relaxed">
              De zéro à vos premières ventes quotidiennes de chansons personnalisées, avec Facebook Ads et Suno.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[#2D261E] bg-[#2D261E] shrink-0">
            {[
              { label: 'Modules', value: `${totals.modulesDone}/${modules.length}` },
              { label: 'Chapitres', value: `${totals.chaptersSeen}/${totals.chaptersTotal}` },
              { label: 'Restant', value: formatMinutes(totals.minutesLeft) },
            ].map(s => (
              <div key={s.label} className="bg-[#13110E] px-4 py-3 min-w-[6.5rem]">
                <dt className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#78716C]">{s.label}</dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Barre de progression studio : un segment par module, proportionnel à ses chapitres */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-[#A8A29E]">Progression du cursus</span>
            <span className="font-mono font-semibold tabular-nums text-[#F3CA75]">{overallPercent} %</span>
          </div>
          <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallPercent} aria-label="Progression du cursus">
            {modules.map(m => {
              const list = chaptersOf(m);
              const seen = isCompleted(m.id) ? list.length : (progress.seen[m.id] ?? []).length;
              return (
                <div key={m.id} className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" style={{ flexGrow: list.length, flexBasis: 0 }}>
                  <div
                    className="h-full rounded-full bg-[#E5B54F] transition-[width] duration-700 ease-luxury"
                    style={{ width: `${(seen / Math.max(1, list.length)) * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Parcours */}
        <nav className="lg:col-span-4 space-y-2.5" aria-label="Modules du cursus">
          <div className="text-xs font-mono uppercase tracking-[0.12em] text-[#78716C] px-1">Parcours · {modules.length} modules</div>
          {modules.map((mod, index) => {
            const active = mod.id === selectedModule.id;
            const list = chaptersOf(mod);
            const done = isCompleted(mod.id);
            const seen = done ? list.length : (progress.seen[mod.id] ?? []).length;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => selectModule(mod.id)}
                aria-current={active ? 'true' : undefined}
                className={`w-full text-left rounded-2xl border p-4 transition-colors duration-200 cursor-pointer ${
                  active ? 'border-[#E5B54F]/50 bg-[#1A1713]' : 'border-[#2D261E] bg-[#0E0C0A] hover:bg-[#13110E] hover:border-[#3A3022]'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <span className={`font-mono text-sm tabular-nums pt-0.5 ${active ? 'text-[#F3CA75]' : 'text-[#78716C]'}`}>{pad2(index + 1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#A8A29E]">{mod.level}</span>
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Validé
                        </span>
                      ) : (
                        <span className={active ? 'text-[#E5B54F]' : 'text-[#78716C]'}>{moduleIcon(mod.icon)}</span>
                      )}
                    </div>
                    <h3 className="mt-1 text-[15px] font-semibold leading-snug text-white">{mod.title}</h3>
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-[#E5B54F] transition-[width] duration-500 ease-luxury" style={{ width: `${(seen / Math.max(1, list.length)) * 100}%` }} />
                      </div>
                      <span className="font-mono text-[11.5px] tabular-nums text-[#78716C]">
                        {seen}/{list.length}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-[#78716C]">
                        <Clock className="h-3 w-3" /> {mod.duration}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Lecteur */}
        <section className="lg:col-span-8 space-y-4" aria-label="Lecteur de cours">
          <div
            tabIndex={0}
            onKeyDown={onPlayerKey}
            className="overflow-hidden rounded-[22px] border border-[#2D261E] bg-[#0E0C0A] outline-none focus-visible:border-[#E5B54F]/60"
          >
            {selectedModule.videoUrl ? (
              <video key={selectedModule.id} src={selectedModule.videoUrl} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
            ) : (
              <div className="relative aspect-video w-full overflow-hidden bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(229,181,79,0.10),transparent_60%),linear-gradient(180deg,#13110E,#0C0A09)]">
                <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-8">
                  <div className="flex items-center justify-between font-mono text-xs tabular-nums text-[#A8A29E]">
                    <span>
                      Chapitre {pad2(chapterIdx + 1)} <span className="text-[#57534E]">/ {pad2(chapters.length)}</span>
                    </span>
                    <span>{chapter?.minutes ? `${chapter.minutes} min de cours` : selectedModule.duration}</span>
                  </div>

                  <div key={`${selectedModule.id}-${chapterIdx}`} className="vx-fade-in max-w-xl">
                    <h2 className="font-display text-2xl sm:text-[34px] font-bold leading-tight text-white">{chapter?.title}</h2>
                    <ol className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                      {pointsShown.map((pt, i) => (
                        <li key={i} className="vx-fade-in flex gap-3 text-sm sm:text-base leading-snug text-[#E7E5E4]">
                          <span className="font-mono text-xs tabular-nums text-[#E5B54F] pt-1">{pad2(i + 1)}</span>
                          {pt}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {!playing && elapsed === 0 && !seenHere.includes(chapterIdx) ? (
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="self-start inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
                    >
                      <Play className="h-4 w-4" fill="currentColor" />
                      Lancer le chapitre
                    </button>
                  ) : (
                    <span className="h-10" aria-hidden="true" />
                  )}
                </div>
              </div>
            )}

            {/* Barre de contrôle */}
            {!selectedModule.videoUrl && (
              <div className="border-t border-[#2D261E] px-4 sm:px-5 py-3 space-y-3">
                <div className="flex gap-1" aria-hidden="true">
                  {chapters.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      tabIndex={-1}
                      onClick={() => goToChapter(i)}
                      className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08] cursor-pointer"
                    >
                      <span
                        className="block h-full rounded-full bg-[#E5B54F]"
                        style={{ width: `${i < chapterIdx || seenHere.includes(i) ? 100 : i === chapterIdx ? elapsed * 100 : 0}%` }}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToChapter(chapterIdx - 1)}
                    disabled={chapterIdx === 0}
                    aria-label="Chapitre précédent"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#D6D3D1] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <SkipBack className="h-4 w-4" fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause' : 'Lecture'}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 ease-press active:scale-95 cursor-pointer ${
                      playing ? 'bg-[#E5B54F] text-black' : 'bg-white text-black hover:bg-neutral-200'
                    }`}
                  >
                    {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 translate-x-px" fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => goToChapter(chapterIdx + 1)}
                    disabled={chapterIdx >= chapters.length - 1}
                    aria-label="Chapitre suivant"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#D6D3D1] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <SkipForward className="h-4 w-4" fill="currentColor" />
                  </button>
                  <span className="ml-1 truncate text-sm text-[#A8A29E]">Résumé guidé du chapitre</span>
                  <button
                    type="button"
                    onClick={() => setRateIdx(i => (i + 1) % RATES.length)}
                    aria-label={`Vitesse ${rate}x`}
                    className="ml-auto rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-xs tabular-nums text-[#D6D3D1] hover:bg-white/[0.12] transition-colors cursor-pointer"
                  >
                    {rate}x
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Détails du module */}
          <div className="rounded-[22px] border border-[#2D261E] bg-[#0E0C0A] p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[#A8A29E]">
                  <span>{selectedModule.level}</span>
                  <span className="text-[#57534E]">/</span>
                  <span className="font-mono tabular-nums">{moduleChapterMinutes ? formatMinutes(moduleChapterMinutes) : selectedModule.duration}</span>
                </div>
                <h2 className="mt-1 text-lg font-semibold text-white leading-snug">{selectedModule.title}</h2>
                <p className="mt-1.5 text-sm text-[#A8A29E] leading-relaxed">{selectedModule.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleModuleCompleted(selectedModule.id)}
                aria-pressed={isCompleted(selectedModule.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-150 ease-press active:scale-[0.97] cursor-pointer ${
                  isCompleted(selectedModule.id)
                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'bg-white text-black hover:bg-neutral-200'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isCompleted(selectedModule.id) ? 'Module validé' : 'Marquer comme validé'}
              </button>
            </div>

            <ol className="divide-y divide-[#2D261E] border-t border-[#2D261E]">
              {chapters.map((c, i) => {
                const seen = seenHere.includes(i) || isCompleted(selectedModule.id);
                const current = i === chapterIdx;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        goToChapter(i);
                        setPlaying(true);
                      }}
                      className={`w-full flex items-center gap-3.5 py-3 text-left transition-colors cursor-pointer ${current ? 'text-white' : 'text-[#D6D3D1] hover:text-white'}`}
                    >
                      <span className={`font-mono text-xs tabular-nums w-5 ${current ? 'text-[#E5B54F]' : 'text-[#78716C]'}`}>{pad2(i + 1)}</span>
                      <span className={`min-w-0 flex-1 truncate text-sm ${current ? 'font-semibold' : ''}`}>{c.title}</span>
                      {c.minutes > 0 && <span className="font-mono text-xs tabular-nums text-[#78716C]">{c.minutes} min</span>}
                      <span className="flex h-5 w-5 items-center justify-center">
                        {seen ? (
                          <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.2} aria-label="Vu" />
                        ) : current && playing ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#E5B54F] vx-breathe" />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>

      {/* Boîte à outils */}
      <section className="rounded-[22px] border border-[#2D261E] bg-[#0E0C0A] p-5 sm:p-7 space-y-5" aria-label="Boîte à outils">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Boîte à outils</h2>
            <p className="mt-1 text-sm text-[#A8A29E]">Scripts de vente et prompts Suno, personnalisés puis copiés en un clic.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:w-[26rem]">
            <label className="block space-y-1">
              <span className="text-xs text-[#78716C]">Prénom du destinataire</span>
              <input
                type="text"
                value={fields.prenom}
                onChange={e => setFields(f => ({ ...f, prenom: e.target.value }))}
                placeholder="Awa"
                className="w-full rounded-xl border border-[#2D261E] bg-[#13110E] px-3 py-2 text-sm text-white placeholder:text-[#57534E] outline-none focus:border-[#E5B54F]/60 transition-colors"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[#78716C]">Occasion</span>
              <input
                type="text"
                value={fields.occasion}
                onChange={e => setFields(f => ({ ...f, occasion: e.target.value }))}
                placeholder="son anniversaire"
                className="w-full rounded-xl border border-[#2D261E] bg-[#13110E] px-3 py-2 text-sm text-white placeholder:text-[#57534E] outline-none focus:border-[#E5B54F]/60 transition-colors"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Catégories">
          {(['all', 'suno', 'whatsapp', 'ads'] as const).map(c => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-200 cursor-pointer ${
                category === c ? 'bg-white text-black font-medium' : 'text-[#A8A29E] hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {c === 'all' ? 'Tout' : CATEGORY_LABEL[c]}
              <span className={`ml-1.5 font-mono text-[11px] ${category === c ? 'text-neutral-500' : 'text-[#57534E]'}`}>
                {c === 'all' ? TOOLBOX_RESOURCES.length : TOOLBOX_RESOURCES.filter(r => r.category === c).length}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {resources.map(res => {
            const state = copied?.id === res.id ? copied : null;
            return (
              <article key={res.id} className="vx-fade-in flex flex-col rounded-2xl border border-[#2D261E] bg-[#13110E] p-4 hover:border-[#3A3022] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#78716C]">{CATEGORY_LABEL[res.category]}</div>
                    <h3 className="mt-0.5 text-[15px] font-semibold text-white">{res.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(res)}
                    aria-label={`Copier ${res.title}`}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      state?.ok
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : state
                          ? 'bg-rose-500/10 text-rose-300'
                          : 'bg-white text-black hover:bg-neutral-200'
                    }`}
                  >
                    {state?.ok ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <Copy className="h-3.5 w-3.5" />}
                    {state?.ok ? 'Copié' : state ? 'Échec' : 'Copier'}
                  </button>
                </div>
                <pre className="mt-3 flex-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#2D261E]/70 bg-black/30 p-3 font-mono text-[12.5px] leading-relaxed text-[#A8A29E]">
                  {renderWithTokens(res.content)}
                </pre>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
