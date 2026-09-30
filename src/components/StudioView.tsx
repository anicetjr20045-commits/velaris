import { useState, type FC } from 'react';
import { 
  Check, 
  Play, 
  Pause, 
  Copy, 
  Mic, 
  RefreshCw, 
  Music, 
  CheckCircle2, 
  Smartphone, 
  Zap, 
  Radio,
  Edit3,
  Save,
  X,
  ExternalLink,
  Sliders,
  UserCheck,
  Disc,
  FileText
} from 'lucide-react';
import type { Order } from '../types';

interface StudioViewProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  onUpdateOrder: (updated: Order) => void;
}

export const StudioView: FC<StudioViewProps> = ({
  orders,
  selectedOrderId,
  onSelectOrder,
  onUpdateOrder,
}) => {
  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isLaunchingProduction, setIsLaunchingProduction] = useState(false);
  const [productionStep, setProductionStep] = useState<string | null>(null);
  const [lyricsCopied, setLyricsCopied] = useState(false);
  const [lyricsSentToWhatsApp, setLyricsSentToWhatsApp] = useState(false);

  // Lyrics inline editor state
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editTitle, setEditTitle] = useState(currentOrder.lyrics?.title || '');
  const [editVerse1, setEditVerse1] = useState(currentOrder.lyrics?.verse1 || '');
  const [editChorus, setEditChorus] = useState(currentOrder.lyrics?.chorus || '');
  const [editVerse2, setEditVerse2] = useState(currentOrder.lyrics?.verse2 || '');
  const [editOutro, setEditOutro] = useState(currentOrder.lyrics?.outro || '');
  const [customPrompt, setCustomPrompt] = useState('');

  // Voice selector state
  const [selectedVoice, setSelectedVoice] = useState<'femme' | 'homme' | 'duo'>(
    (currentOrder.voiceGender as 'femme' | 'homme' | 'duo') || 'homme'
  );

  // Styles list
  const STYLES = [
    { id: 'afro_love', label: 'Afro-Love', desc: 'Chaud, rythmé & romantique' },
    { id: 'acoustique', label: 'Guitare Acoustique', desc: 'Doux, intime & sobre' },
    { id: 'rumba', label: 'Rumba Congolaise', desc: 'Mélodique & festif' },
    { id: 'zouk', label: 'Zouk Rétro', desc: 'Sensuel & enveloppant' },
    { id: 'gospel', label: 'Gospel & Célébration', desc: 'Harmonique & majestueux' },
    { id: 'mandingue', label: 'Mandingue Kora', desc: 'Traditionnel & envoûtant' },
  ];

  // 1-Click AI Lyrics Generation
  const handleGenerateLyrics = (directive?: string) => {
    setIsGeneratingLyrics(true);
    setTimeout(() => {
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
    }, 1100);
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
    if (!currentOrder.lyrics) return;
    setIsLaunchingProduction(true);
    setProductionStep('Initialisation du pipeline de composition...');

    setTimeout(() => {
      setProductionStep(`Arrangement audio ${selectedVoice.toUpperCase()} & Mastering (Simulation 18 min)...`);
    }, 1200);

    setTimeout(() => {
      setProductionStep('Finalisation du master 24-bit & Encodage WhatsApp...');
    }, 2600);

    setTimeout(() => {
      setProductionStep(`Expédition sur ${currentOrder.clientPhone}...`);
    }, 3900);

    setTimeout(() => {
      setIsLaunchingProduction(false);
      setProductionStep(null);
      onUpdateOrder({
        ...currentOrder,
        status: 'livre',
        voiceGender: selectedVoice,
        deliveryDate: `Livré sur WhatsApp à ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        audioTrackUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
      });
    }, 4800);
  };

  const copyLyrics = () => {
    if (!currentOrder.lyrics) return;
    const fullText = `*${currentOrder.lyrics.title}*\n\n[Couplet 1]\n${currentOrder.lyrics.verse1}\n\n[Refrain]\n${currentOrder.lyrics.chorus}\n\n[Couplet 2]\n${currentOrder.lyrics.verse2}\n\n[Outro]\n${currentOrder.lyrics.outro}\n\n*Velaris Studio Musical*`;
    navigator.clipboard.writeText(fullText);
    setLyricsCopied(true);
    setTimeout(() => setLyricsCopied(false), 2000);
  };

  const openWhatsAppChat = () => {
    if (!currentOrder.lyrics) return;
    const cleanPhone = currentOrder.clientPhone.replace(/[^0-9]/g, '');
    const message = `Bonjour ${currentOrder.clientName.split(' ')[0]}, voici les paroles personnalisées conçues pour ${currentOrder.recipient} :\n\n*${currentOrder.lyrics.title}*\n\n[Couplet 1]\n${currentOrder.lyrics.verse1}\n\n[Refrain]\n${currentOrder.lyrics.chorus}\n\n[Couplet 2]\n${currentOrder.lyrics.verse2}\n\n[Outro]\n${currentOrder.lyrics.outro}\n\nSouhaitez-vous un ajustement ou validons-nous ce texte pour le passage au mixage studio ?`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setLyricsSentToWhatsApp(true);
    setTimeout(() => setLyricsSentToWhatsApp(false), 3000);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono tracking-wider text-neutral-300 uppercase">
              STUDIO OS • ENGINE V4
            </span>
            <span className="text-xs font-mono text-neutral-500">Pipeline Audio 18 Min</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Atelier de Création Audio & Paroles
          </h1>
        </div>

        {/* Client quick switcher strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => onSelectOrder(o.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono whitespace-nowrap transition-all border cursor-pointer ${
                o.id === currentOrder.id
                  ? 'bg-white text-black font-semibold border-white shadow-sm'
                  : 'bg-white/[0.02] text-neutral-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <span>{o.clientName.split(' ')[0]}</span>
              <span className="text-[10px] opacity-60">({o.amount.toLocaleString()} F)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Client Info & Voice Transcription (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Client Brief Card */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#07080B] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  Détails Commande ({currentOrder.id})
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                  {currentOrder.clientName}
                </h3>
                <p className="text-xs font-mono text-neutral-400">{currentOrder.clientPhone}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-bold text-white">
                  {currentOrder.amount.toLocaleString()} FCFA
                </span>
                <p className="text-[10px] font-mono text-emerald-400 flex items-center justify-end gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {currentOrder.paymentMethod}
                </p>
              </div>
            </div>

            {/* Target & Occasion */}
            <div className="grid grid-cols-2 gap-3 py-1 text-xs">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-neutral-500 block text-[10px] font-mono uppercase tracking-wider">Destinataire</span>
                <span className="font-semibold text-white mt-0.5 block">{currentOrder.recipient}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-neutral-500 block text-[10px] font-mono uppercase tracking-wider">Occasion</span>
                <span className="font-semibold text-white mt-0.5 block">{currentOrder.occasion}</span>
              </div>
            </div>

            {/* WhatsApp Voice Note Transcription Module */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                  <Mic className="h-3.5 w-3.5 text-white" />
                  <span>Transcription Note Vocale</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">Audio WhatsApp • 0:48</span>
              </div>

              {/* Hardware Waveform Player */}
              <div className="rounded-xl border border-white/[0.06] bg-[#0D0F14] p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                  >
                    {isPlayingAudio ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Audio Bars */}
                  <div className="flex flex-1 items-center gap-1 h-6">
                    {[6, 12, 18, 14, 24, 8, 16, 22, 12, 18, 10, 15, 25, 20, 14, 8, 12, 19, 11, 7].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${isPlayingAudio ? Math.min(26, h + (i % 3) * 3) : h}px` }}
                        className={`w-1 rounded-full transition-all duration-200 ${
                          isPlayingAudio ? 'bg-white' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>

                  <span className="text-[11px] font-mono text-neutral-400">0:48</span>
                </div>

                {/* Transcription Text */}
                <div className="text-xs text-neutral-300 italic bg-white/[0.02] p-3 rounded-lg border border-white/[0.04] leading-relaxed">
                  « {currentOrder.transcription} »
                </div>
              </div>
            </div>

            {/* Musical Style Selector */}
            <div className="pt-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block mb-2">
                Style Musical Souhaité
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() =>
                      onUpdateOrder({
                        ...currentOrder,
                        style: style.id,
                      })
                    }
                    className={`rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                      currentOrder.style === style.id
                        ? 'border-white/30 bg-white/[0.08] text-white shadow-sm'
                        : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">{style.label}</div>
                    <div className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Vocal Gender Selector */}
            <div className="pt-3 border-t border-white/[0.06]">
              <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block mb-2 flex items-center gap-1.5">
                <UserCheck className="h-3 w-3 text-neutral-300" />
                <span>Timbre Vocal Studio</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'femme', label: 'Voix Femme', desc: 'Douce & Sensuelle' },
                  { id: 'homme', label: 'Voix Homme', desc: 'Chaud & Puissant' },
                  { id: 'duo', label: 'Duo Mixte', desc: 'Harmonies Riches' },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVoice(v.id as 'femme' | 'homme' | 'duo');
                      onUpdateOrder({ ...currentOrder, voiceGender: v.id as 'femme' | 'homme' | 'duo' });
                    }}
                    className={`rounded-lg border p-2 text-center transition-all cursor-pointer ${
                      selectedVoice === v.id
                        ? 'border-white/30 bg-white text-black font-semibold'
                        : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">{v.label}</div>
                    <div className={`text-[9px] mt-0.5 ${selectedVoice === v.id ? 'text-neutral-700' : 'text-neutral-500'}`}>{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Lyrics Editor & 1-Click Launch (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl border border-white/[0.06] bg-[#07080B] p-5 sm:p-6 space-y-5">
            {/* Lyrics Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-white" />
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Paroles de la Chanson
                  </h3>
                </div>
                <p className="text-xs text-neutral-400">
                  Générées à partir du brief vocal et éditables en direct.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {currentOrder.lyrics && !isEditingLyrics && (
                  <button
                    onClick={() => setIsEditingLyrics(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Modifier</span>
                  </button>
                )}
                {isEditingLyrics && (
                  <>
                    <button
                      onClick={handleSaveEditedLyrics}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white text-black px-3 py-1.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer"
                    >
                      <Save className="h-3 w-3" />
                      <span>Enregistrer</span>
                    </button>
                    <button
                      onClick={() => setIsEditingLyrics(false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white transition-all cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleGenerateLyrics(customPrompt)}
                  disabled={isGeneratingLyrics}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-mono text-white hover:bg-white/[0.08] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isGeneratingLyrics ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingLyrics ? 'Génération...' : 'Régénérer'}</span>
                </button>
                <button
                  onClick={copyLyrics}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-mono text-neutral-400 hover:text-white cursor-pointer"
                >
                  {lyricsCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{lyricsCopied ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Quick Directive / Custom Retouch Input */}
            <div className="flex items-center gap-2 bg-[#0D0F14] p-2 rounded-xl border border-white/[0.06]">
              <Sliders className="h-3.5 w-3.5 text-neutral-400 ml-2 shrink-0" />
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Consigne de retouche (ex: insister sur le mariage ce samedi, ajouter un clin d'œil à Ouaga...)"
                className="w-full bg-transparent px-2 text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
              <button
                onClick={() => handleGenerateLyrics(customPrompt)}
                disabled={isGeneratingLyrics || !customPrompt.trim()}
                className="rounded-lg bg-white/[0.08] px-3 py-1 text-xs font-medium text-white hover:bg-white/[0.15] disabled:opacity-40 transition-all shrink-0 cursor-pointer"
              >
                Appliquer
              </button>
            </div>

            {/* Lyrics Content: Display vs Inline Edit */}
            {currentOrder.lyrics ? (
              isEditingLyrics ? (
                /* Inline Editor Mode */
                <div className="space-y-3 rounded-xl border border-white/[0.1] bg-[#0D0F14] p-4 text-xs font-mono">
                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-400 block mb-1">
                      Titre de la chanson
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-400 block mb-1">
                      Couplet 1
                    </label>
                    <textarea
                      rows={3}
                      value={editVerse1}
                      onChange={(e) => setEditVerse1(e.target.value)}
                      className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-400 block mb-1">
                      Refrain
                    </label>
                    <textarea
                      rows={3}
                      value={editChorus}
                      onChange={(e) => setEditChorus(e.target.value)}
                      className="w-full rounded-md border border-white/[0.15] bg-white/[0.05] px-2.5 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none resize-none leading-relaxed font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-400 block mb-1">
                      Couplet 2
                    </label>
                    <textarea
                      rows={3}
                      value={editVerse2}
                      onChange={(e) => setEditVerse2(e.target.value)}
                      className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-mono text-neutral-400 block mb-1">
                      Outro
                    </label>
                    <input
                      type="text"
                      value={editOutro}
                      onChange={(e) => setEditOutro(e.target.value)}
                      className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                /* Standard Display Mode — Vinyl Lyric Sheet */
                <div className="space-y-4 rounded-xl border border-white/[0.06] bg-[#0D0F14] p-4 text-xs leading-relaxed max-h-[360px] overflow-y-auto font-sans">
                  <div className="text-center pb-2 border-b border-white/[0.06]">
                    <span className="text-sm font-bold text-white tracking-tight">
                      {currentOrder.lyrics.title}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">
                      [Couplet 1]
                    </span>
                    <p className="text-neutral-300 whitespace-pre-line pl-3 border-l-2 border-white/20">
                      {currentOrder.lyrics.verse1}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white/[0.03] p-3.5 border border-white/[0.08]">
                    <span className="text-[10px] font-mono text-white font-semibold uppercase tracking-widest block mb-1">
                      [Refrain]
                    </span>
                    <p className="text-white font-medium whitespace-pre-line">
                      {currentOrder.lyrics.chorus}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">
                      [Couplet 2]
                    </span>
                    <p className="text-neutral-300 whitespace-pre-line pl-3 border-l-2 border-white/20">
                      {currentOrder.lyrics.verse2}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">
                      [Outro]
                    </span>
                    <p className="text-neutral-400 italic pl-3 border-l-2 border-white/10">
                      {currentOrder.lyrics.outro}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-white/[0.08] bg-[#0D0F14]">
                <Music className="h-8 w-8 text-neutral-600 mb-3" />
                <p className="text-xs font-semibold text-neutral-300">Aucune parole rédigée pour l'instant</p>
                <p className="text-[11px] text-neutral-500 max-w-xs mt-1 mb-4">
                  Cliquez sur le bouton ci-dessous pour transformer le brief vocal en texte rimé.
                </p>
                <button
                  onClick={() => handleGenerateLyrics()}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition-all cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Générer les Paroles</span>
                </button>
              </div>
            )}

            {/* Action Bar: Send Lyrics for Validation & The Master 1-Click Launch Button */}
            <div className="space-y-3 pt-2">
              <button
                onClick={openWhatsAppChat}
                disabled={!currentOrder.lyrics}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40 cursor-pointer"
              >
                {lyricsSentToWhatsApp ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>WhatsApp ouvert pour {currentOrder.clientName.split(' ')[0]}</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" />
                    <span>Envoyer les paroles sur WhatsApp pour validation client</span>
                    <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
                  </>
                )}
              </button>

              {/* The Grand 1-Click Master Control */}
              <div className="rounded-xl border border-white/[0.1] bg-[#0D0F14] p-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-white" />
                      <span className="text-sm font-bold text-white tracking-tight">
                        Production & Expédition 1-Clic
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Génère le master en studio Suno et l'envoie directement en MP3 sur WhatsApp.
                    </p>
                  </div>

                  <button
                    onClick={handleLaunchProduction}
                    disabled={isLaunchingProduction || !currentOrder.lyrics}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-semibold text-black hover:bg-neutral-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-40 cursor-pointer"
                  >
                    <Disc className={`h-4 w-4 ${isLaunchingProduction ? 'animate-spin' : ''}`} />
                    <span>
                      {isLaunchingProduction ? 'Production en cours...' : 'Produire & Livrer'}
                    </span>
                  </button>
                </div>

                {/* Progress Animation during Production */}
                {isLaunchingProduction && (
                  <div className="mt-4 pt-3 border-t border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white font-mono font-medium flex items-center gap-1.5">
                        <Radio className="h-3 w-3 text-emerald-400 animate-spin" />
                        {productionStep}
                      </span>
                      <span className="font-mono text-neutral-500">Suno Engine • {selectedVoice}</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full bg-white animate-pulse w-full transition-all duration-500" />
                    </div>
                  </div>
                )}

                {/* Delivery Success Notification */}
                {currentOrder.status === 'livre' && (
                  <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{currentOrder.deliveryDate || 'Morceau livré au client avec succès !'}</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">Pipeline Terminé</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
