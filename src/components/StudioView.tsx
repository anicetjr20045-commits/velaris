import { useState, type FC } from 'react';
import { 
  Sparkles, 
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
  UserCheck
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
    { id: 'acoustique', label: 'Guitare Acoustique', desc: 'Doux, intime & émouvant' },
    { id: 'rumba', label: 'Rumba Congolaise', desc: 'Mélodique & festif' },
    { id: 'zouk', label: 'Zouk Rétro', desc: 'Sensuel & enveloppant' },
    { id: 'gospel', label: 'Gospel & Louange', desc: 'Puissant & reconnaissant' },
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

  // 1-Click Music Production & WhatsApp Delivery Trigger
  const handleLaunchProduction = () => {
    setIsLaunchingProduction(true);
    setProductionStep('Connexion Studio Suno IA...');

    setTimeout(() => {
      setProductionStep(`Composition ${selectedVoice.toUpperCase()} & Mastering audio (~18 min en réel)...`);
    }, 1200);

    setTimeout(() => {
      setProductionStep('Finalisation du master HD & Encodage WhatsApp...');
    }, 2600);

    setTimeout(() => {
      setProductionStep(`Livraison automatique sur ${currentOrder.clientPhone}...`);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#d4af37]/20 px-2 py-0.5 text-[11px] font-bold text-[#e5c158]">
              STUDIO IA
            </span>
            <span className="text-xs text-white/50">Automatisation & Production 1-Clic</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-extrabold text-white mt-1">
            Atelier de Production
          </h1>
        </div>

        {/* Client quick switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => onSelectOrder(o.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all border ${
                o.id === currentOrder.id
                  ? 'bg-[#d4af37] text-black border-[#d4af37] shadow-lg shadow-[#d4af37]/20'
                  : 'bg-white/[0.04] text-white/70 border-white/[0.08] hover:bg-white/[0.08]'
              }`}
            >
              <span>{o.clientName.split(' ')[0]}</span>
              <span className="text-[10px] opacity-70">({o.amount.toLocaleString()} F)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Client Info & Voice Transcription (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Client Brief Card */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div>
                <span className="text-[11px] uppercase font-bold text-white/40 tracking-wider">
                  Détails Commande ({currentOrder.id})
                </span>
                <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">
                  {currentOrder.clientName}
                </h3>
                <p className="text-xs text-[#e5c158] font-medium">{currentOrder.clientPhone}</p>
              </div>
              <div className="text-right">
                <span className="font-['Space_Grotesk'] text-lg font-extrabold text-white">
                  {currentOrder.amount.toLocaleString()} FCFA
                </span>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center justify-end gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {currentOrder.paymentMethod}
                </p>
              </div>
            </div>

            {/* Target & Occasion */}
            <div className="grid grid-cols-2 gap-3 py-3 border-b border-white/[0.06] text-xs">
              <div>
                <span className="text-white/40 block text-[11px]">Destinataire</span>
                <span className="font-semibold text-white">{currentOrder.recipient}</span>
              </div>
              <div>
                <span className="text-white/40 block text-[11px]">Occasion</span>
                <span className="font-semibold text-white">{currentOrder.occasion}</span>
              </div>
            </div>

            {/* WhatsApp Voice Note Transcription Module */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                  <Mic className="h-3.5 w-3.5 text-[#e5c158]" />
                  <span>Note Vocale Transcrite par l'IA</span>
                </div>
                <span className="text-[10px] text-white/40">WhatsApp Audio • 0:48</span>
              </div>

              {/* Simulated Waveform Player */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#07080c] p-3.5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#d4af37] text-black shadow-md hover:scale-105 transition-transform"
                  >
                    {isPlayingAudio ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Audio Bars */}
                  <div className="flex flex-1 items-center gap-1 h-6">
                    {[6, 12, 18, 14, 24, 8, 16, 22, 12, 18, 10, 15, 25, 20, 14, 8, 12, 19, 11, 7].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${isPlayingAudio ? Math.min(26, h + (i % 3) * 3) : h}px` }}
                        className={`w-1 rounded-full transition-all duration-200 ${
                          isPlayingAudio ? 'bg-[#e5c158]' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>

                  <span className="text-[11px] font-mono text-white/60">0:48</span>
                </div>

                {/* Transcription Text */}
                <div className="text-xs text-white/70 italic bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04] leading-relaxed">
                  « {currentOrder.transcription} »
                </div>
              </div>
            </div>

            {/* Musical Style Selector */}
            <div className="pt-4">
              <label className="text-xs font-semibold text-white/70 block mb-2">
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
                    className={`rounded-xl border p-2 text-left transition-all ${
                      currentOrder.style === style.id
                        ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f3e5ab]'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="font-bold text-xs">{style.label}</div>
                    <div className="text-[10px] opacity-70 line-clamp-1">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Vocal Gender Selector */}
            <div className="pt-4 border-t border-white/[0.06]">
              <label className="text-xs font-semibold text-white/70 block mb-2 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-[#e5c158]" /> Timbre Vocal Studio
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
                    className={`rounded-xl border p-2 text-center transition-all ${
                      selectedVoice === v.id
                        ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#e5c158]'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="text-xs font-bold">{v.label}</div>
                    <div className="text-[9px] opacity-70">{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Lyrics Editor & 1-Click Launch (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 backdrop-blur-md space-y-5">
            {/* Lyrics Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#e5c158]" />
                  <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">
                    Paroles de la Chanson
                  </h3>
                </div>
                <p className="text-xs text-white/50">
                  Générées sur-mesure par l'IA et modifiables en direct avant envoi.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {currentOrder.lyrics && !isEditingLyrics && (
                  <button
                    onClick={() => setIsEditingLyrics(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.08] transition-all"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#e5c158]" />
                    <span>Modifier</span>
                  </button>
                )}
                {isEditingLyrics && (
                  <>
                    <button
                      onClick={handleSaveEditedLyrics}
                      className="flex items-center gap-1.5 rounded-xl bg-[#d4af37] text-black px-3 py-1.5 text-xs font-bold hover:bg-[#e5c158] transition-all"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Enregistrer</span>
                    </button>
                    <button
                      onClick={() => setIsEditingLyrics(false)}
                      className="flex items-center gap-1 rounded-xl border border-white/[0.08] px-2.5 py-1.5 text-xs text-white/60 hover:text-white transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleGenerateLyrics(customPrompt)}
                  disabled={isGeneratingLyrics}
                  className="flex items-center gap-1.5 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-3 py-1.5 text-xs font-semibold text-[#e5c158] hover:bg-[#d4af37]/20 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingLyrics ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingLyrics ? 'Génération...' : 'Réécrire'}</span>
                </button>
                <button
                  onClick={copyLyrics}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white"
                >
                  {lyricsCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{lyricsCopied ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Quick Directive / Custom Retouch Input */}
            <div className="flex items-center gap-2 bg-[#07080c] p-2 rounded-2xl border border-white/[0.06]">
              <Sliders className="h-3.5 w-3.5 text-[#e5c158] ml-2 shrink-0" />
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Consigne de retouche (ex: insister sur le mariage ce samedi, ajouter un clin d'œil à Ouaga...)"
                className="w-full bg-transparent px-2 text-xs text-white placeholder-white/30 focus:outline-none"
              />
              <button
                onClick={() => handleGenerateLyrics(customPrompt)}
                disabled={isGeneratingLyrics || !customPrompt.trim()}
                className="rounded-xl bg-white/[0.08] px-3 py-1 text-xs font-medium text-[#e5c158] hover:bg-[#d4af37]/20 disabled:opacity-40 transition-all shrink-0"
              >
                Appliquer
              </button>
            </div>

            {/* Lyrics Content: Display vs Inline Edit */}
            {currentOrder.lyrics ? (
              isEditingLyrics ? (
                /* Inline Editor Mode */
                <div className="space-y-3 rounded-2xl border border-[#d4af37]/30 bg-[#07080c] p-4 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#e5c158] block mb-1">
                      Titre de la chanson
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-white focus:border-[#d4af37] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">
                      Couplet 1
                    </label>
                    <textarea
                      rows={3}
                      value={editVerse1}
                      onChange={(e) => setEditVerse1(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-white focus:border-[#d4af37] focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#e5c158] block mb-1">
                      Refrain
                    </label>
                    <textarea
                      rows={3}
                      value={editChorus}
                      onChange={(e) => setEditChorus(e.target.value)}
                      className="w-full rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/[0.05] px-2.5 py-1.5 text-xs text-white focus:border-[#d4af37] focus:outline-none resize-none leading-relaxed font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">
                      Couplet 2
                    </label>
                    <textarea
                      rows={3}
                      value={editVerse2}
                      onChange={(e) => setEditVerse2(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-white focus:border-[#d4af37] focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">
                      Outro
                    </label>
                    <input
                      type="text"
                      value={editOutro}
                      onChange={(e) => setEditOutro(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-white focus:border-[#d4af37] focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                /* Standard Display Mode */
                <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-[#07080c] p-4 font-sans text-xs leading-relaxed max-h-[360px] overflow-y-auto">
                  <div className="text-center pb-2 border-b border-white/[0.06]">
                    <span className="font-heading text-sm font-bold text-white tracking-wider">
                      {currentOrder.lyrics.title}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">
                      Couplet 1
                    </span>
                    <p className="text-white/90 whitespace-pre-line pl-3 border-l-2 border-[#d4af37]/40">
                      {currentOrder.lyrics.verse1}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#d4af37]/[0.08] p-3 border border-[#d4af37]/20">
                    <span className="text-[10px] font-bold text-[#e5c158] uppercase tracking-widest block mb-1">
                      Refrain
                    </span>
                    <p className="text-white font-medium whitespace-pre-line">
                      {currentOrder.lyrics.chorus}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">
                      Couplet 2
                    </span>
                    <p className="text-white/90 whitespace-pre-line pl-3 border-l-2 border-white/20">
                      {currentOrder.lyrics.verse2}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">
                      Outro
                    </span>
                    <p className="text-white/70 italic pl-3 border-l-2 border-purple-500/40">
                      {currentOrder.lyrics.outro}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-white/[0.1] bg-[#07080c]">
                <Music className="h-10 w-10 text-white/20 mb-3" />
                <p className="text-xs font-semibold text-white/70">Aucune parole rédigée pour l'instant</p>
                <p className="text-[11px] text-white/40 max-w-xs mt-1 mb-4">
                  Cliquez sur le bouton ci-dessous pour que l'IA transforme la note vocale en texte en rimes.
                </p>
                <button
                  onClick={() => handleGenerateLyrics()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5c158] px-4 py-2 text-xs font-bold text-black"
                >
                  <Sparkles className="h-4 w-4" />
                  Générer les Paroles IA
                </button>
              </div>
            )}

            {/* Action Bar: Send Lyrics for Validation & The Master 1-Click Launch Button */}
            <div className="space-y-3 pt-2">
              <button
                onClick={openWhatsAppChat}
                disabled={!currentOrder.lyrics}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
              >
                {lyricsSentToWhatsApp ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>WhatsApp ouvert pour {currentOrder.clientName.split(' ')[0]} !</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" />
                    <span>Envoyer les paroles sur WhatsApp pour validation</span>
                    <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
                  </>
                )}
              </button>

              {/* The Grand 1-Click Trigger */}
              <div className="rounded-2xl border border-[#d4af37]/30 bg-gradient-to-r from-[#17140a] via-[#1f1b0c] to-[#121008] p-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-[#e5c158]" />
                      <span className="font-['Space_Grotesk'] text-sm font-bold text-white">
                        Production & Expédition 1-Clic
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-0.5">
                      Génère le morceau en studio, masterise et l'envoie directement en MP3 sur WhatsApp.
                    </p>
                  </div>

                  <button
                    onClick={handleLaunchProduction}
                    disabled={isLaunchingProduction || !currentOrder.lyrics}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f0ce6b] to-[#c59e2b] px-6 py-3.5 text-xs font-extrabold text-black shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <Music className="h-4 w-4" />
                    <span>
                      {isLaunchingProduction ? 'Production en cours...' : 'Produire & Livrer'}
                    </span>
                  </button>
                </div>

                {/* Progress Animation during Production */}
                {isLaunchingProduction && (
                  <div className="mt-4 pt-3 border-t border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#e5c158] font-semibold animate-pulse flex items-center gap-1.5">
                        <Radio className="h-3 w-3 animate-spin" />
                        {productionStep}
                      </span>
                      <span className="font-mono text-white/50">IA Suno v4 • {selectedVoice}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#d4af37] to-emerald-400 animate-pulse w-full transition-all duration-500" />
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
                    <span className="text-[10px] text-white/50 font-mono">100% Automatisé</span>
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
