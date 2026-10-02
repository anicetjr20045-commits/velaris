import { useEffect, useRef, useState, type CSSProperties, type FC } from 'react';
import {
  Check,
  Play,
  Pause,
  Copy,
  Mic,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Edit3,
  Save,
  X,
  ExternalLink,
  Sliders,
  Disc3,
  FileText
} from 'lucide-react';
import type { Order } from '../types';

interface StudioViewProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  onUpdateOrder: (updated: Order) => void;
}

type Voice = 'femme' | 'homme' | 'duo';

const STYLES = [
  { id: 'afro_love', label: 'Afro-Love', desc: 'Chaud, rythmé & romantique', bpm: 102 },
  { id: 'acoustique', label: 'Guitare acoustique', desc: 'Doux, intime & sobre', bpm: 84 },
  { id: 'rumba', label: 'Rumba congolaise', desc: 'Mélodique & festif', bpm: 118 },
  { id: 'zouk', label: 'Zouk rétro', desc: 'Sensuel & enveloppant', bpm: 92 },
  { id: 'gospel', label: 'Gospel & célébration', desc: 'Harmonique & majestueux', bpm: 76 },
  { id: 'mandingue', label: 'Mandingue kora', desc: 'Traditionnel & envoûtant', bpm: 96 },
];

const VOICES: { id: Voice; label: string; desc: string }[] = [
  { id: 'femme', label: 'Femme', desc: 'Douce & sensuelle' },
  { id: 'homme', label: 'Homme', desc: 'Chaud & puissant' },
  { id: 'duo', label: 'Duo mixte', desc: 'Harmonies riches' },
];

/* Profil de la note vocale (amplitudes normalisées 0–1) */
const WAVE = [
  0.3, 0.5, 0.8, 0.6, 0.9, 0.4, 0.7, 1, 0.55, 0.75, 0.35, 0.6, 0.95, 0.8, 0.5,
  0.3, 0.45, 0.85, 0.6, 0.4, 0.7, 0.9, 0.65, 0.35, 0.55, 0.8, 0.5, 0.3, 0.6, 0.75,
  0.45, 0.85, 0.7, 0.4, 0.55, 0.3, 0.5, 0.35, 0.25, 0.2,
];
const VOICE_NOTE_SECONDS = 48;

/* Étapes réelles du pipeline de mastering, avec leur instant de déclenchement (ms) */
const PRODUCTION_TIMELINE = [0, 1200, 2600, 3900];
const PRODUCTION_DONE_AT = 4800;

const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* Disque vinyle : les sillons tournent, le reflet reste fixe */
const Vinyl: FC<{ spinning: boolean; done: boolean; title?: string }> = ({ spinning, done, title }) => (
  <div className="relative h-36 w-36 sm:h-40 sm:w-40 shrink-0">
    <svg viewBox="0 0 200 200" className={`vx-vinyl ${spinning ? 'vx-vinyl-live' : ''} h-full w-full`} aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#141210" stroke="rgba(255,255,255,0.10)" />
      {[90, 82, 76, 70, 63, 57, 50].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.75" />
      ))}
      <circle cx="100" cy="100" r="32" fill={done ? '#E5B54F' : '#1F1B16'} stroke="rgba(255,255,255,0.12)" />
      <path d="M100 74 a26 26 0 0 1 26 26" stroke={done ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)'} strokeWidth="1" fill="none" />
      <text x="100" y="96" textAnchor="middle" fontSize="7" letterSpacing="1.5" fill={done ? '#1A1408' : 'rgba(255,255,255,0.55)'} fontFamily="ui-monospace, monospace">
        VELARIS
      </text>
      <text x="100" y="112" textAnchor="middle" fontSize="6" fill={done ? 'rgba(26,20,8,0.7)' : 'rgba(255,255,255,0.35)'} fontFamily="ui-monospace, monospace">
        {done ? 'MASTER' : 'FACE A'}
      </text>
      <circle cx="100" cy="100" r="2.5" fill="#0C0A09" />
    </svg>
    {/* Reflet spéculaire fixe */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,transparent_0deg,rgba(255,255,255,0.09)_40deg,transparent_80deg,transparent_180deg,rgba(255,255,255,0.05)_220deg,transparent_260deg)]"
    />
    {/* Bras de lecture */}
    <svg
      viewBox="0 0 60 120"
      aria-hidden="true"
      style={{ transformOrigin: '48px 10px' }}
      className={`absolute -right-6 -top-3 h-28 w-14 transition-transform duration-700 ease-luxury ${
        spinning ? 'rotate-0' : '-rotate-[28deg]'
      }`}
    >
      <circle cx="48" cy="10" r="7" fill="#1F1B16" stroke="rgba(255,255,255,0.18)" />
      <path d="M48 10 L40 80 L22 104" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x="14" y="100" width="12" height="8" rx="1.5" transform="rotate(-35 20 104)" fill="#E5B54F" />
    </svg>
    {title && <span className="sr-only">{title}</span>}
  </div>
);

export const StudioView: FC<StudioViewProps> = ({
  orders,
  selectedOrderId,
  onSelectOrder,
  onUpdateOrder,
}) => {
  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [productionStep, setProductionStep] = useState<number | null>(null);
  const [lyricsCopied, setLyricsCopied] = useState(false);
  const [lyricsSentToWhatsApp, setLyricsSentToWhatsApp] = useState(false);

  // Lyrics inline editor state
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editTitle, setEditTitle] = useState(currentOrder?.lyrics?.title || '');
  const [editVerse1, setEditVerse1] = useState(currentOrder?.lyrics?.verse1 || '');
  const [editChorus, setEditChorus] = useState(currentOrder?.lyrics?.chorus || '');
  const [editVerse2, setEditVerse2] = useState(currentOrder?.lyrics?.verse2 || '');
  const [editOutro, setEditOutro] = useState(currentOrder?.lyrics?.outro || '');
  const [customPrompt, setCustomPrompt] = useState('');

  const [selectedVoice, setSelectedVoice] = useState<Voice>(currentOrder?.voiceGender || 'homme');

  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Lecture simulée de la note vocale
  useEffect(() => {
    if (!isPlayingAudio) return;
    const id = window.setInterval(() => {
      setElapsed((prev) => Math.min(VOICE_NOTE_SECONDS, prev + 0.1));
    }, 100);
    return () => window.clearInterval(id);
  }, [isPlayingAudio]);

  useEffect(() => {
    if (elapsed < VOICE_NOTE_SECONDS) return;
    setIsPlayingAudio(false);
    setElapsed(0);
  }, [elapsed]);

  if (!currentOrder) {
    return (
      <div className="rounded-2xl border border-dashed border-[#3A3022] bg-[#13110E] p-12 text-center">
        <Disc3 className="h-8 w-8 mx-auto text-neutral-600" strokeWidth={1.25} />
        <p className="mt-4 text-sm text-neutral-200">Aucune commande dans l'atelier</p>
        <p className="mt-1 text-[13px] text-neutral-500">Créez un lead depuis le cockpit pour commencer une chanson.</p>
      </div>
    );
  }

  const isLaunchingProduction = productionStep !== null;
  const activeStyle = STYLES.find((s) => s.id === currentOrder.style);

  const productionSteps = [
    { label: 'Composition', detail: 'Initialisation du pipeline Suno' },
    { label: 'Arrangement', detail: `Voix ${VOICES.find((v) => v.id === selectedVoice)?.label.toLowerCase()} · ${activeStyle?.label ?? currentOrder.style}` },
    { label: 'Mastering', detail: 'Master 24-bit · encodage WhatsApp' },
    { label: 'Livraison', detail: `Expédition sur ${currentOrder.clientPhone}` },
  ];

  // 1-Click AI Lyrics Generation
  const handleGenerateLyrics = (directive?: string) => {
    setIsGeneratingLyrics(true);
    timers.current.push(window.setTimeout(() => {
      const generated = {
        title: `${currentOrder.recipient}, Notre Chanson Sacrée`,
        verse1: directive
          ? `Sous le ciel étoilé de notre rencontre,\nChaque seconde avec toi arrête la montre.\n(${directive})\nTon rire est un remède qui guérit ma douleur.`
          : `Sous le ciel étoilé de notre rencontre,\nChaque seconde avec toi arrête la montre.\nTu as séché mes peines, ranimé la lueur,\nTon rire est un remède qui guérit ma douleur.`,
        chorus: `${currentOrder.recipient}, mon amour précieux et béni,\nÀ tes côtés je veux passer ma vie.\nQue la mélodie chante ce qu’on a traversé,\nNotre amour est gravé pour l’éternité.`,
        verse2: `À travers chaque épreuve, tu es restée fidèle,\nPlus le temps avance, et plus tu es belle.\nReçois ce doux refrain comme un baiser d’amour,\nJe te promets mon cœur pour toujours et toujours.`,
        outro: `Pour toujours avec toi, ${currentOrder.recipient}…`,
      };

      onUpdateOrder({
        ...currentOrder,
        lyrics: generated,
        status: 'paroles_pretes',
      });
      setEditTitle(generated.title);
      setEditVerse1(generated.verse1);
      setEditChorus(generated.chorus);
      setEditVerse2(generated.verse2);
      setEditOutro(generated.outro);
      setIsGeneratingLyrics(false);
      setIsEditingLyrics(false);
      setCustomPrompt('');
    }, 1100));
  };

  const handleSaveEditedLyrics = () => {
    onUpdateOrder({
      ...currentOrder,
      lyrics: {
        title: editTitle,
        verse1: editVerse1,
        chorus: editChorus,
        verse2: editVerse2,
        outro: editOutro,
      },
      status: 'paroles_pretes',
    });
    setIsEditingLyrics(false);
  };

  const handleLaunchProduction = () => {
    if (!currentOrder.lyrics || isLaunchingProduction) return;
    PRODUCTION_TIMELINE.forEach((at, index) => {
      timers.current.push(window.setTimeout(() => setProductionStep(index), at));
    });
    timers.current.push(window.setTimeout(() => {
      setProductionStep(null);
      onUpdateOrder({
        ...currentOrder,
        status: 'livre',
        voiceGender: selectedVoice,
        deliveryDate: `Livré sur WhatsApp à ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        audioTrackUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
      });
    }, PRODUCTION_DONE_AT));
  };

  const copyLyrics = () => {
    if (!currentOrder.lyrics) return;
    const fullText = `*${currentOrder.lyrics.title}*\n\n[Couplet 1]\n${currentOrder.lyrics.verse1}\n\n[Refrain]\n${currentOrder.lyrics.chorus}\n\n[Couplet 2]\n${currentOrder.lyrics.verse2}\n\n[Outro]\n${currentOrder.lyrics.outro}\n\n*Velaris Studio Musical*`;
    navigator.clipboard.writeText(fullText);
    setLyricsCopied(true);
    timers.current.push(window.setTimeout(() => setLyricsCopied(false), 2000));
  };

  const openWhatsAppChat = () => {
    if (!currentOrder.lyrics) return;
    const cleanPhone = currentOrder.clientPhone.replace(/[^0-9]/g, '');
    const message = `Bonjour ${currentOrder.clientName.split(' ')[0]}, voici les paroles personnalisées conçues pour ${currentOrder.recipient} :\n\n*${currentOrder.lyrics.title}*\n\n[Couplet 1]\n${currentOrder.lyrics.verse1}\n\n[Refrain]\n${currentOrder.lyrics.chorus}\n\n[Couplet 2]\n${currentOrder.lyrics.verse2}\n\n[Outro]\n${currentOrder.lyrics.outro}\n\nSouhaitez-vous un ajustement ou validons-nous ce texte pour le passage au mixage studio ?`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setLyricsSentToWhatsApp(true);
    timers.current.push(window.setTimeout(() => setLyricsSentToWhatsApp(false), 3000));
  };

  // Livret : sections + numérotation continue des vers
  const lyricSections = currentOrder.lyrics
    ? [
        { name: 'Couplet I', text: currentOrder.lyrics.verse1, kind: 'verse' as const },
        { name: 'Refrain', text: currentOrder.lyrics.chorus, kind: 'chorus' as const },
        { name: 'Couplet II', text: currentOrder.lyrics.verse2, kind: 'verse' as const },
        { name: 'Coda', text: currentOrder.lyrics.outro, kind: 'outro' as const },
      ]
    : [];
  let lineCounter = 0;

  const playhead = elapsed / VOICE_NOTE_SECONDS;
  const isDelivered = currentOrder.status === 'livre';
  const progress = productionStep === null ? (isDelivered ? 1 : 0) : (productionStep + 1) / productionSteps.length;

  const fieldClass = 'w-full rounded-lg border border-[#2D261E] bg-white/[0.02] px-3 py-2 text-sm text-white focus:border-white/[0.24] focus:bg-white/[0.04] focus:outline-none transition-colors duration-200 resize-none leading-relaxed';

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-[#A8A29E]">
            <span className="font-mono text-neutral-500">{currentOrder.id}</span>
            <span className="text-neutral-700">·</span>
            <span>Pipeline audio 18 min</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-[1.08] mt-2">
            Atelier
          </h1>
        </div>

        {/* Sélecteur de commande */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-[#2D261E] bg-white/[0.02] p-0.5 max-w-full">
          {orders.map((o) => {
            const active = o.id === currentOrder.id;
            return (
              <button
                key={o.id}
                onClick={() => onSelectOrder(o.id)}
                className={`shrink-0 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors duration-150 ease-press cursor-pointer ${
                  active ? 'bg-white text-black font-semibold' : 'text-[#A8A29E] hover:text-white'
                }`}
              >
                <span>{o.clientName.split(' ')[0]}</span>
                <span className={`font-mono text-[11.5px] ${active ? 'text-black/50' : 'text-neutral-600'}`}>
                  {o.amount.toLocaleString('fr-FR')} F
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Colonne gauche : console d'atelier */}
        <div className="lg:col-span-5 space-y-5">
          <section className="vx-hairline vx-stagger rounded-2xl border border-[#2D261E] bg-[#13110E] overflow-hidden" style={{ '--i': 0 } as CSSProperties}>
            {/* Fiche client */}
            <div className="p-5 flex items-start justify-between gap-4 border-b border-[#2D261E]">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white tracking-tight truncate">{currentOrder.clientName}</h2>
                <p className="text-[13px] font-mono text-neutral-500 mt-0.5">{currentOrder.clientPhone}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-lg font-bold text-white">
                  {currentOrder.amount.toLocaleString('fr-FR')} <span className="text-[13px] font-normal text-neutral-500">F</span>
                </div>
                <p className="text-[12.5px] text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                  {currentOrder.paymentMethod}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 divide-x divide-[#2D261E] border-b border-[#2D261E]">
              <div className="px-5 py-3.5">
                <dt className="text-[12.5px] text-neutral-500">Destinataire</dt>
                <dd className="text-sm font-medium text-white mt-0.5 truncate">{currentOrder.recipient}</dd>
              </div>
              <div className="px-5 py-3.5">
                <dt className="text-[12.5px] text-neutral-500">Occasion</dt>
                <dd className="text-sm font-medium text-white mt-0.5 truncate">{currentOrder.occasion}</dd>
              </div>
            </dl>

            {/* Note vocale */}
            <div className="p-5 space-y-3 border-b border-[#2D261E]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-medium text-neutral-200">
                  <Mic className="h-3.5 w-3.5 text-[#A8A29E]" strokeWidth={1.5} />
                  Note vocale du client
                </div>
                <span className="text-[12.5px] font-mono text-neutral-500">WhatsApp · {formatClock(VOICE_NOTE_SECONDS)}</span>
              </div>

              <div className="rounded-xl border border-[#2D261E] bg-[#1A1713] p-3.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlayingAudio((p) => !p)}
                    aria-label={isPlayingAudio ? 'Mettre en pause' : 'Écouter la note vocale'}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all duration-150 ease-press cursor-pointer"
                  >
                    {isPlayingAudio ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className={`flex flex-1 items-center gap-[3px] h-8 ${isPlayingAudio ? 'vx-wave-live' : ''}`}>
                    {WAVE.map((amp, i) => (
                      <span
                        key={i}
                        style={{
                          height: `${Math.round(8 + amp * 24)}px`,
                          animationDelay: `${(-i * 0.07).toFixed(2)}s`,
                          animationDuration: `${(0.8 + (i % 5) * 0.12).toFixed(2)}s`,
                        }}
                        className={`vx-wave-bar flex-1 max-w-[4px] rounded-full transition-colors duration-150 ${
                          i / WAVE.length < playhead ? 'bg-white' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>

                  <span className="w-9 text-right text-[12.5px] font-mono text-[#A8A29E]">
                    {formatClock(isPlayingAudio || elapsed > 0 ? elapsed : VOICE_NOTE_SECONDS)}
                  </span>
                </div>

                <blockquote className="mt-3 border-l border-white/15 pl-3 font-serif italic text-[15px] leading-relaxed text-neutral-300">
                  {currentOrder.transcription || 'Transcription en attente.'}
                </blockquote>
              </div>
            </div>

            {/* Style musical */}
            <div className="p-5 space-y-2.5 border-b border-[#2D261E]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-neutral-200">Style musical</span>
                {activeStyle && <span className="text-[12.5px] font-mono text-neutral-500">{activeStyle.bpm} BPM</span>}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLES.map((style) => {
                  const active = currentOrder.style === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => onUpdateOrder({ ...currentOrder, style: style.id })}
                      aria-pressed={active}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ease-press cursor-pointer ${
                        active
                          ? 'border-white/[0.28] bg-white/[0.07]'
                          : 'border-[#2D261E] bg-white/[0.015] hover:border-white/[0.14] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className={`text-[13px] font-medium ${active ? 'text-white' : 'text-neutral-300'}`}>{style.label}</div>
                      <div className="text-[11.5px] text-neutral-500 truncate mt-0.5">{style.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timbre vocal */}
            <div className="p-5 space-y-2.5">
              <span className="text-[13px] font-medium text-neutral-200">Timbre vocal</span>
              <div className="grid grid-cols-3 gap-0.5 rounded-xl border border-[#2D261E] bg-white/[0.02] p-0.5">
                {VOICES.map((v) => {
                  const active = selectedVoice === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedVoice(v.id);
                        onUpdateOrder({ ...currentOrder, voiceGender: v.id });
                      }}
                      className={`rounded-[10px] px-2 py-2 text-center transition-colors duration-150 ease-press cursor-pointer ${
                        active ? 'bg-white text-black' : 'text-[#A8A29E] hover:text-white'
                      }`}
                    >
                      <div className="text-[13px] font-semibold">{v.label}</div>
                      <div className={`text-[11.5px] mt-0.5 ${active ? 'text-black/55' : 'text-neutral-600'}`}>{v.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Colonne droite : livret & mastering */}
        <div className="lg:col-span-7 space-y-5">
          <section className="vx-hairline vx-stagger rounded-2xl border border-[#2D261E] bg-[#13110E] overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
            {/* Barre d'outils du livret */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#2D261E]">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#A8A29E]" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-white tracking-tight">Livret de paroles</h3>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {currentOrder.lyrics && !isEditingLyrics && (
                  <button
                    onClick={() => setIsEditingLyrics(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#2D261E] px-3 py-1.5 text-[13px] text-neutral-300 hover:text-white hover:border-white/[0.18] transition-colors duration-150 cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" strokeWidth={1.5} />
                    Modifier
                  </button>
                )}
                {isEditingLyrics && (
                  <>
                    <button
                      onClick={handleSaveEditedLyrics}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white text-black px-3 py-1.5 text-[13px] font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      <Save className="h-3 w-3" />
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setIsEditingLyrics(false)}
                      aria-label="Annuler"
                      className="inline-flex items-center rounded-full border border-[#2D261E] p-1.5 text-[#A8A29E] hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleGenerateLyrics(customPrompt)}
                  disabled={isGeneratingLyrics}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2D261E] px-3 py-1.5 text-[13px] text-neutral-300 hover:text-white hover:border-white/[0.18] transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isGeneratingLyrics ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  {isGeneratingLyrics ? 'Écriture…' : 'Régénérer'}
                </button>
                <button
                  onClick={copyLyrics}
                  disabled={!currentOrder.lyrics}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2D261E] px-3 py-1.5 text-[13px] text-neutral-300 hover:text-white hover:border-white/[0.18] transition-colors duration-150 disabled:opacity-40 cursor-pointer"
                >
                  {lyricsCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
                  {lyricsCopied ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>

            {/* Consigne de retouche */}
            <div className="px-5 sm:px-6 pt-4">
              <div className="flex items-center gap-2 rounded-full border border-[#2D261E] bg-white/[0.02] pl-3.5 pr-1 py-1 focus-within:border-white/[0.22] transition-colors duration-200">
                <Sliders className="h-3.5 w-3.5 text-neutral-500 shrink-0" strokeWidth={1.5} />
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && customPrompt.trim()) handleGenerateLyrics(customPrompt); }}
                  placeholder="Consigne de retouche : insister sur le mariage ce samedi, clin d'œil à Ouaga…"
                  className="w-full bg-transparent py-1 text-[13px] text-white placeholder-neutral-500 focus:outline-none"
                />
                <button
                  onClick={() => handleGenerateLyrics(customPrompt)}
                  disabled={isGeneratingLyrics || !customPrompt.trim()}
                  className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-[13px] font-medium text-white hover:bg-white/[0.14] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Appliquer
                </button>
              </div>
            </div>

            {/* Livret / éditeur */}
            <div className="p-5 sm:p-6">
              {currentOrder.lyrics ? (
                isEditingLyrics ? (
                  <div className="space-y-4 vx-fade-in">
                    <label className="block">
                      <span className="text-[12.5px] text-neutral-500 block mb-1.5">Titre</span>
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`${fieldClass} font-serif italic text-base`} />
                    </label>
                    <label className="block">
                      <span className="text-[12.5px] text-neutral-500 block mb-1.5">Couplet I</span>
                      <textarea rows={4} value={editVerse1} onChange={(e) => setEditVerse1(e.target.value)} className={fieldClass} />
                    </label>
                    <label className="block">
                      <span className="text-[12.5px] text-[#E5B54F] block mb-1.5">Refrain</span>
                      <textarea rows={4} value={editChorus} onChange={(e) => setEditChorus(e.target.value)} className={`${fieldClass} border-[#E5B54F]/25 font-medium`} />
                    </label>
                    <label className="block">
                      <span className="text-[12.5px] text-neutral-500 block mb-1.5">Couplet II</span>
                      <textarea rows={4} value={editVerse2} onChange={(e) => setEditVerse2(e.target.value)} className={fieldClass} />
                    </label>
                    <label className="block">
                      <span className="text-[12.5px] text-neutral-500 block mb-1.5">Coda</span>
                      <input type="text" value={editOutro} onChange={(e) => setEditOutro(e.target.value)} className={fieldClass} />
                    </label>
                  </div>
                ) : (
                  /* Livret vinyle */
                  <article
                    key={currentOrder.lyrics.title}
                    className={`vx-fade-in relative rounded-xl border border-[#2D261E] bg-[radial-gradient(120%_80%_at_50%_0%,rgba(229,181,79,0.05),transparent_60%),#141210] px-5 sm:px-10 py-8 max-h-[460px] overflow-y-auto transition-opacity duration-300 ${
                      isGeneratingLyrics ? 'opacity-40' : ''
                    }`}
                  >
                    <header className="text-center pb-6 mb-6 border-b border-[#2D261E]">
                      <div className="text-[11.5px] font-mono tracking-[0.3em] text-neutral-500">
                        FACE A · {(activeStyle?.label ?? currentOrder.style).toUpperCase()}
                      </div>
                      <h4 className="mt-3 font-serif italic text-3xl sm:text-[34px] leading-tight text-white" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
                        {currentOrder.lyrics.title}
                      </h4>
                      <div className="mt-2 text-[13px] text-neutral-500">
                        Pour {currentOrder.recipient} · de la part de {currentOrder.clientName.split(' ')[0]}
                      </div>
                    </header>

                    <div className="space-y-7">
                      {lyricSections.map((section) => {
                        const lines = section.text.split('\n').filter(Boolean);
                        return (
                          <section key={section.name} className={section.kind === 'chorus' ? 'relative pl-4 border-l border-[#E5B54F]/40' : ''}>
                            <div className={`text-[11.5px] font-mono tracking-[0.2em] mb-2 ${section.kind === 'chorus' ? 'text-[#E5B54F]' : 'text-neutral-500'}`}>
                              {section.name.toUpperCase()}
                            </div>
                            <ol className="space-y-1">
                              {lines.map((line) => {
                                lineCounter += 1;
                                return (
                                  <li key={`${section.name}-${lineCounter}`} className="grid grid-cols-[1.75rem_1fr] items-baseline gap-2">
                                    <span className="text-[11.5px] font-mono text-neutral-700 text-right select-none">
                                      {lineCounter % 4 === 0 || lineCounter === 1 ? lineCounter : ''}
                                    </span>
                                    <span
                                      className={`font-serif text-[17px] leading-[1.6] ${
                                        section.kind === 'chorus'
                                          ? 'text-white'
                                          : section.kind === 'outro'
                                            ? 'italic text-[#A8A29E]'
                                            : 'text-neutral-300'
                                      }`}
                                    >
                                      {line}
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                          </section>
                        );
                      })}
                    </div>

                    <footer className="mt-8 pt-4 border-t border-[#2D261E] flex items-center justify-between text-[11.5px] font-mono text-neutral-600">
                      <span>Velaris Studio</span>
                      <span>{lineCounter} vers</span>
                    </footer>
                  </article>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-center rounded-xl border border-dashed border-[#2D261E] bg-[#141210]">
                  <p className="font-serif italic text-xl text-neutral-300">La page est encore blanche</p>
                  <p className="text-[13px] text-neutral-500 max-w-xs mt-2 mb-5 leading-relaxed">
                    Le brief vocal sera transformé en texte rimé, prêt à être validé par le client.
                  </p>
                  <button
                    onClick={() => handleGenerateLyrics()}
                    disabled={isGeneratingLyrics}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingLyrics ? 'animate-spin' : 'hidden'}`} />
                    {isGeneratingLyrics ? 'Écriture en cours…' : 'Écrire les paroles'}
                  </button>
                </div>
              )}

              <button
                onClick={openWhatsAppChat}
                disabled={!currentOrder.lyrics}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-2.5 text-[13px] font-medium text-emerald-300 hover:bg-emerald-400/[0.12] hover:border-emerald-400/40 transition-colors duration-200 disabled:opacity-40 cursor-pointer"
              >
                {lyricsSentToWhatsApp ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                    WhatsApp ouvert pour {currentOrder.clientName.split(' ')[0]}
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" strokeWidth={1.5} />
                    Envoyer les paroles au client pour validation
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Console de mastering */}
          <section
            style={{ '--i': 2 } as CSSProperties}
            className={`vx-hairline vx-stagger relative overflow-hidden rounded-2xl border bg-[#13110E] p-5 sm:p-6 transition-colors duration-500 ease-luxury ${
              isLaunchingProduction ? 'border-white/[0.18]' : 'border-[#2D261E]'
            }`}
          >
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -left-16 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-[#E5B54F]/[0.08] blur-3xl transition-opacity duration-700 ${
                isLaunchingProduction || isDelivered ? 'opacity-100' : 'opacity-0'
              }`}
            />

            <div className="relative flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <Vinyl spinning={isLaunchingProduction} done={isDelivered && !isLaunchingProduction} title={currentOrder.lyrics?.title} />

              <div className="flex-1 w-full min-w-0 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white tracking-tight">Production & livraison</h3>
                  <p className="text-[13px] text-[#A8A29E] mt-1 leading-relaxed">
                    Master Suno généré puis envoyé en MP3 directement sur le WhatsApp du client.
                  </p>
                </div>

                {/* Étapes */}
                <ol className="grid grid-cols-4 gap-2">
                  {productionSteps.map((step, index) => {
                    const done = isDelivered && productionStep === null ? true : productionStep !== null && index < productionStep;
                    const active = productionStep === index;
                    return (
                      <li key={step.label} className="min-w-0">
                        <div className="relative h-0.5 rounded-full bg-white/[0.08] overflow-hidden">
                          <span
                            className={`absolute inset-0 origin-left transition-transform duration-[1100ms] ease-luxury ${
                              done ? 'bg-white' : active ? 'bg-[#E5B54F]' : 'bg-white'
                            }`}
                            style={{ transform: `scaleX(${done || active ? 1 : 0})` }}
                          />
                        </div>
                        <div className={`mt-2 flex items-center gap-1 text-[12.5px] font-medium truncate transition-colors duration-300 ${
                          active ? 'text-white' : done ? 'text-neutral-300' : 'text-neutral-600'
                        }`}>
                          {done && <Check className="h-3 w-3 shrink-0 text-emerald-400" />}
                          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5B54F] vx-breathe" />}
                          <span className="truncate">{step.label}</span>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="min-h-[18px] text-[12.5px] font-mono">
                  {isLaunchingProduction && productionStep !== null && (
                    <div key={productionStep} className="vx-fade-in flex items-center justify-between gap-3 text-[#A8A29E]">
                      <span className="truncate">{productionSteps[productionStep].detail}</span>
                      <span className="shrink-0 text-neutral-500">{Math.round(progress * 100)} %</span>
                    </div>
                  )}
                  {!isLaunchingProduction && isDelivered && (
                    <div className="vx-fade-in flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span className="truncate">{currentOrder.deliveryDate || 'Morceau livré au client'}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLaunchProduction}
                  disabled={isLaunchingProduction || !currentOrder.lyrics}
                  className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-6 py-3 text-[13px] font-semibold text-black hover:bg-neutral-100 active:scale-[0.97] transition-all duration-150 ease-press shadow-[0_10px_40px_-10px_rgba(229,181,79,0.55)] disabled:opacity-40 disabled:shadow-none cursor-pointer"
                >
                  {isLaunchingProduction && (
                    <span aria-hidden="true" className="vx-scan absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.08] to-transparent" />
                  )}
                  <Disc3 className={`relative h-4 w-4 ${isLaunchingProduction ? 'animate-spin' : ''}`} strokeWidth={1.75} />
                  <span className="relative">
                    {isLaunchingProduction ? 'Mastering en cours…' : isDelivered ? 'Relancer la production' : 'Produire & livrer'}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
