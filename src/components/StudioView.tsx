import { useState, useEffect, type FC } from 'react';
import {
  FileText,
  ShieldCheck,
  Scissors,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Save,
  X,
  RefreshCw,
  Send,
  Sparkles,
  Smartphone,
  ExternalLink,
  Mic,
  Sliders,
  CheckCheck
} from 'lucide-react';
import type { Order } from '../types';
import { detectOccasion, generateHouseStyleSong } from '../services/lyricsCorpus';
import { ProtectedAudioShareModal } from './ProtectedAudioShareModal';
import { AudioTrimmerTool } from './AudioTrimmerTool';

interface StudioViewProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  onUpdateOrder: (updated: Order) => void;
}

type StudioSubTool = 'lyrics_queue' | 'protected_share' | 'audio_trimmer';

function extractSection(lyrics: string, sectionName: string): string {
  const regex = new RegExp(`\\[${sectionName}[^\\]]*\\]([\\s\\S]*?)(?=\\n\\[|$)`, 'i');
  const match = lyrics.match(regex);
  return match ? match[1].trim() : '';
}

export const StudioView: FC<StudioViewProps> = ({
  orders,
  selectedOrderId,
  onSelectOrder,
  onUpdateOrder,
}) => {
  const [activeTool, setActiveTool] = useState<StudioSubTool>('lyrics_queue');
  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');

  // Commandes avec brief reçu nécessitant la rédaction de paroles
  const pendingOrders = orders.filter((o) => o.status === 'brief_recu');
  const displayedOrders = filterMode === 'pending'
    ? (pendingOrders.length > 0 ? pendingOrders : orders)
    : orders;

  const currentOrder = displayedOrders.find((o) => o.id === selectedOrderId) || displayedOrders[0] || orders[0];

  // État de l'éditeur de paroles
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editTitle, setEditTitle] = useState(currentOrder?.lyrics?.title || '');
  const [editVerse1, setEditVerse1] = useState(currentOrder?.lyrics?.verse1 || '');
  const [editChorus, setEditChorus] = useState(currentOrder?.lyrics?.chorus || '');
  const [editVerse2, setEditVerse2] = useState(currentOrder?.lyrics?.verse2 || '');
  const [editOutro, setEditOutro] = useState(currentOrder?.lyrics?.outro || '');
  const [customPrompt, setCustomPrompt] = useState('');

  const [lyricsCopied, setLyricsCopied] = useState(false);
  const [confirmedDoneSuccess, setConfirmedDoneSuccess] = useState(false);

  // Synchronisation lors du changement de commande
  useEffect(() => {
    if (currentOrder?.lyrics) {
      setEditTitle(currentOrder.lyrics.title || '');
      setEditVerse1(currentOrder.lyrics.verse1 || '');
      setEditChorus(currentOrder.lyrics.chorus || '');
      setEditVerse2(currentOrder.lyrics.verse2 || '');
      setEditOutro(currentOrder.lyrics.outro || '');
    } else {
      setEditTitle('');
      setEditVerse1('');
      setEditChorus('');
      setEditVerse2('');
      setEditOutro('');
    }
    setIsEditingLyrics(false);
  }, [currentOrder?.id]);

  // Génération IA 1-clic conforme au Golden Corpus Velaris (32 à 48 vers)
  const handleGenerateLyrics = (directive?: string) => {
    if (!currentOrder) return;
    setIsGeneratingLyrics(true);

    setTimeout(() => {
      const occasion = detectOccasion(`${currentOrder.occasion} ${currentOrder.transcription || ''}`);
      const rawPrompt = `${currentOrder.transcription || ''} ${directive || ''}`.trim();
      const house = generateHouseStyleSong({
        recipient: currentOrder.recipient,
        occasion,
        style: currentOrder.style || 'Afro-Love',
        memories: rawPrompt ? [rawPrompt] : [],
        senderName: currentOrder.clientName.split(' ')[0],
      });

      const generated = {
        title: house.title,
        verse1: extractSection(house.lyrics, 'Couplet 1') || `Depuis tant d'années que tu éclaires notre chemin…\nChaque instant à tes côtés est une bénédiction entre nos mains…\n${currentOrder.recipient}, ton rire efface nos peines et chasse nos doutes…\nUne force tranquille qui nous guide sur la route…`,
        chorus: extractSection(house.lyrics, 'Refrain') || `Joyeux anniversaire ${currentOrder.recipient}, reine de nos cœurs…\nQue le Tout-Puissant inonde ta vie de bonheur…\nSanté, longue vie, élévation et prospérité…\n${currentOrder.recipient}, nous chantons ta grandeur et ta générosité…`,
        verse2: extractSection(house.lyrics, 'Couplet 2') || extractSection(house.lyrics, 'Pont') || `Rappelle-toi les épreuves que tu as su surmonter…\nToujours digne et fière, tu ne t'es jamais résignée…\nPour ta famille et pour ceux qui t'aiment, tu es un trésor précieux…`,
        outro: extractSection(house.lyrics, 'Outro') || `Danse et réjouis-toi, ce jour est le tien…\nPour toujours avec toi, ${currentOrder.recipient}…`,
      };

      onUpdateOrder({
        ...currentOrder,
        lyrics: generated,
        status: currentOrder.status,
      });
      setEditTitle(generated.title);
      setEditVerse1(generated.verse1);
      setEditChorus(generated.chorus);
      setEditVerse2(generated.verse2);
      setEditOutro(generated.outro);
      setIsGeneratingLyrics(false);
      setIsEditingLyrics(false);
      setCustomPrompt('');
    }, 850);
  };

  const handleSaveEditedLyrics = () => {
    if (!currentOrder) return;
    onUpdateOrder({
      ...currentOrder,
      lyrics: {
        title: editTitle,
        verse1: editVerse1,
        chorus: editChorus,
        verse2: editVerse2,
        outro: editOutro,
      },
      status: currentOrder.status,
    });
    setIsEditingLyrics(false);
  };

  const handleCopyLyrics = () => {
    if (!currentOrder?.lyrics) return;
    const fullText = `*${currentOrder.lyrics.title}*\n\n[Couplet 1]\n${currentOrder.lyrics.verse1}\n\n[Refrain]\n${currentOrder.lyrics.chorus}\n\n[Couplet 2]\n${currentOrder.lyrics.verse2}\n\n[Outro]\n${currentOrder.lyrics.outro}\n\n*Velaris Studio Musical*`;
    navigator.clipboard.writeText(fullText);
    setLyricsCopied(true);
    setTimeout(() => setLyricsCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!currentOrder?.lyrics) return;
    const cleanPhone = currentOrder.clientPhone.replace(/[^0-9]/g, '');
    const message = `Bonjour ${currentOrder.clientName.split(' ')[0]} ! Voici les paroles personnalisées créées pour ${currentOrder.recipient} :\n\n*${currentOrder.lyrics.title}*\n\n[Couplet 1]\n${currentOrder.lyrics.verse1}\n\n[Refrain]\n${currentOrder.lyrics.chorus}\n\n[Couplet 2]\n${currentOrder.lyrics.verse2}\n\n[Outro]\n${currentOrder.lyrics.outro}\n\nValidons-nous ce texte pour lancer l'enregistrement en studio ?`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Confirmation immédiate : marquer comme fait et retirer de la file des textes à faire
  const handleMarkAsDone = () => {
    if (!currentOrder) return;
    setConfirmedDoneSuccess(true);

    const finalLyrics = currentOrder.lyrics || {
      title: editTitle || `Chanson pour ${currentOrder.recipient}`,
      verse1: editVerse1,
      chorus: editChorus,
      verse2: editVerse2,
      outro: editOutro,
    };

    onUpdateOrder({
      ...currentOrder,
      lyrics: finalLyrics,
      status: 'paroles_pretes',
    });

    // Passer à la commande suivante
    setTimeout(() => {
      setConfirmedDoneSuccess(false);
      const remaining = pendingOrders.filter((o) => o.id !== currentOrder.id);
      if (remaining.length > 0) {
        onSelectOrder(remaining[0].id);
      }
    }, 1200);
  };

  const fieldClass = 'w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white focus:border-[#E5B54F] focus:outline-none transition-colors resize-none leading-relaxed';

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Barre de navigation d'atelier (Onglets maîtres) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Textes & Atelier Créateur
          </h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">
            File de production WhatsApp · Paroles en direct, lien streaming anti-téléchargement et découpe audio.
          </p>
        </div>

        {/* 3 Outils Maîtres */}
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#0B0C10] p-1 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTool('lyrics_queue')}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTool === 'lyrics_queue'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Textes à faire</span>
            {pendingOrders.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-mono font-bold ${
                activeTool === 'lyrics_queue' ? 'bg-[#E5B54F] text-black' : 'bg-[#E5B54F]/20 text-[#E5B54F]'
              }`}>
                {pendingOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('protected_share')}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTool === 'protected_share'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Lien Protégé</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('audio_trimmer')}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTool === 'audio_trimmer'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Scissors className="h-3.5 w-3.5 text-[#E5B54F]" />
            <span>Découpeur Audio</span>
          </button>
        </div>
      </div>

      {/* 1. OUTIL : LIEN D'ÉCOUTE PROTÉGÉ */}
      {activeTool === 'protected_share' && (
        <ProtectedAudioShareModal
          defaultRecipient={currentOrder?.recipient}
          defaultOccasion={currentOrder?.occasion}
          defaultPhone={currentOrder?.clientPhone}
        />
      )}

      {/* 2. OUTIL : DÉCOUPEUR AUDIO EXPRESS */}
      {activeTool === 'audio_trimmer' && (
        <AudioTrimmerTool />
      )}

      {/* 3. VUE PRINCIPALE : FILE DES TEXTES À FAIRE (ÉPURÉE & SANS SURCHARGE) */}
      {activeTool === 'lyrics_queue' && (
        <div className="space-y-5">
          {/* Bandeau sélecteur de commandes en cours */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium text-neutral-400">File en attente :</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterMode('pending')}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
                    filterMode === 'pending'
                      ? 'bg-[#E5B54F] text-black font-bold'
                      : 'border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white'
                  }`}
                >
                  À rédiger ({pendingOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-white text-black font-bold'
                      : 'border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white'
                  }`}
                >
                  Toutes ({orders.length})
                </button>
              </div>
            </div>

            {/* Liste déroulante / pilules des commandes */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {displayedOrders.map((o) => {
                const active = o.id === currentOrder?.id;
                const isPending = o.status === 'brief_recu';
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onSelectOrder(o.id)}
                    className={`shrink-0 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs transition-all cursor-pointer ${
                      active
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'border border-white/[0.08] bg-[#0B0C10] text-neutral-300 hover:text-white'
                    }`}
                  >
                    {isPending && <span className="h-2 w-2 rounded-full bg-[#E5B54F] animate-pulse" />}
                    <span>{o.recipient}</span>
                    <span className={`text-[11px] font-mono ${active ? 'text-black/60' : 'text-neutral-500'}`}>
                      ({o.clientName.split(' ')[0]})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!currentOrder ? (
            <div className="rounded-2xl border border-dashed border-white/12 bg-[#0B0C10] p-12 text-center space-y-3">
              <CheckCheck className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Tous les textes sont à jour !</h3>
              <p className="text-sm text-neutral-400 max-w-md mx-auto">
                Aucune commande n'attend de rédaction de paroles actuellement. Dès qu'un client termine son brief vocal sur WhatsApp, il apparaîtra ici en temps réel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Colonne Gauche (5 cols) : Résumé net et chirurgical du Brief */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-5 space-y-4">
                  {/* Client & Montant */}
                  <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                    <div>
                      <span className="font-mono text-[11px] text-neutral-500 uppercase tracking-wider">Commande {currentOrder.id.slice(0, 8)}</span>
                      <h2 className="text-lg font-bold text-white mt-0.5">{currentOrder.clientName}</h2>
                      <a
                        href={`https://wa.me/${currentOrder.clientPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400 hover:underline mt-0.5"
                      >
                        <Smartphone className="h-3 w-3" />
                        {currentOrder.clientPhone}
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-lg font-bold text-white">{currentOrder.amount.toLocaleString('fr-FR')} F</span>
                      <div className="text-[11px] text-emerald-400 flex items-center justify-end gap-1 mt-0.5 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        {currentOrder.paymentMethod || 'Wave'}
                      </div>
                    </div>
                  </div>

                  {/* Fiche du Destinataire */}
                  <div className="grid grid-cols-2 gap-3 border-b border-white/[0.08] pb-4">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <span className="text-[11.5px] text-neutral-400 block">Pour qui ?</span>
                      <span className="text-sm font-semibold text-white mt-0.5 block truncate">{currentOrder.recipient}</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <span className="text-[11.5px] text-neutral-400 block">Occasion</span>
                      <span className="text-sm font-semibold text-[#E5B54F] mt-0.5 block truncate">{currentOrder.occasion}</span>
                    </div>
                  </div>

                  {/* Souvenirs / Note Vocale Retranscrite */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                      <Mic className="h-3.5 w-3.5 text-[#E5B54F]" />
                      <span>Ce que le client a raconté (Brief & Souvenirs)</span>
                    </div>
                    <blockquote className="rounded-xl border border-white/[0.08] bg-[#07080B] p-4 text-[13.5px] leading-relaxed text-neutral-200 font-serif italic max-h-48 overflow-y-auto">
                      {currentOrder.transcription || 'Le client n\'a pas encore laissé de détails oraux, composez sur l\'occasion.'}
                    </blockquote>
                  </div>

                  {/* Style & Voix souhaités */}
                  <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-white/[0.08]">
                    <span>Style : <strong className="text-white font-medium">{currentOrder.style || 'Afro-Love'}</strong></span>
                    <span>Voix : <strong className="text-white font-medium">{currentOrder.voiceGender || 'Homme'}</strong></span>
                  </div>
                </div>

                {/* Bouton de confirmation Fait / Retirer de la file */}
                <button
                  type="button"
                  onClick={handleMarkAsDone}
                  disabled={confirmedDoneSuccess}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold py-3.5 px-4 text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] active:scale-[0.98] cursor-pointer"
                >
                  {confirmedDoneSuccess ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>Validé ! Retiré de la file des textes à faire</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Confirmer comme fait (Retirer de la file)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Colonne Droite (7 cols) : Zone d'Écriture & Actions 1-Clic */}
              <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-6 space-y-5">
                {/* Barre d'outils du texte */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#E5B54F]" />
                    <h3 className="text-sm font-semibold text-white">Paroles de la Chanson</h3>
                    {currentOrder.lyrics && (
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Prêtes
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!isEditingLyrics && currentOrder.lyrics && (
                      <button
                        type="button"
                        onClick={() => setIsEditingLyrics(true)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300 hover:text-white hover:bg-white/5 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Modifier</span>
                      </button>
                    )}
                    {isEditingLyrics && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveEditedLyrics}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white text-black px-3 py-1 text-xs font-bold hover:bg-neutral-200 cursor-pointer"
                        >
                          <Save className="h-3 w-3" />
                          <span>Enregistrer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingLyrics(false)}
                          className="p-1 text-neutral-400 hover:text-white cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleGenerateLyrics(customPrompt)}
                      disabled={isGeneratingLyrics}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3.5 py-1 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${isGeneratingLyrics ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingLyrics ? 'Composition…' : currentOrder.lyrics ? 'Régénérer' : 'Écrire en 1 clic'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyLyrics}
                      disabled={!currentOrder.lyrics}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {lyricsCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{lyricsCopied ? 'Copié !' : 'Copier'}</span>
                    </button>
                  </div>
                </div>

                {/* Champ de consigne rapide */}
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5">
                  <Sliders className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && customPrompt.trim()) handleGenerateLyrics(customPrompt); }}
                    placeholder="Consigne d'écriture (ex: insister sur la maman, refrain très dansant…)"
                    className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
                  />
                  {customPrompt.trim() && (
                    <button
                      type="button"
                      onClick={() => handleGenerateLyrics(customPrompt)}
                      className="shrink-0 text-xs font-semibold text-[#E5B54F] hover:underline"
                    >
                      Appliquer
                    </button>
                  )}
                </div>

                {/* Affichage des paroles ou éditeur */}
                {isEditingLyrics ? (
                  <div className="space-y-3 vx-fade-in">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Titre de la chanson"
                      className={`${fieldClass} font-serif italic font-bold text-base`}
                    />
                    <div>
                      <span className="text-[11px] font-mono text-neutral-500 block mb-1">COUPLET 1</span>
                      <textarea rows={3} value={editVerse1} onChange={(e) => setEditVerse1(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-[#E5B54F] block mb-1">REFRAIN</span>
                      <textarea rows={3} value={editChorus} onChange={(e) => setEditChorus(e.target.value)} className={`${fieldClass} border-[#E5B54F]/30 font-medium`} />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-neutral-500 block mb-1">COUPLET 2</span>
                      <textarea rows={3} value={editVerse2} onChange={(e) => setEditVerse2(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-neutral-500 block mb-1">OUTRO</span>
                      <input type="text" value={editOutro} onChange={(e) => setEditOutro(e.target.value)} className={fieldClass} />
                    </div>
                  </div>
                ) : currentOrder.lyrics ? (
                  <div className="rounded-xl border border-white/[0.08] bg-[#07080B] p-5 space-y-4 max-h-[420px] overflow-y-auto">
                    <div className="border-b border-white/[0.08] pb-3 text-center">
                      <span className="font-mono text-[10.5px] uppercase tracking-widest text-neutral-500">Paroles Officielles Studio</span>
                      <h4 className="font-serif italic text-2xl text-white mt-1">{currentOrder.lyrics.title}</h4>
                    </div>

                    <div className="space-y-4 font-serif text-[15px] leading-relaxed text-neutral-200">
                      <div>
                        <span className="font-mono text-[10.5px] uppercase tracking-wider text-neutral-500 block mb-1">Couplet 1</span>
                        <p className="whitespace-pre-line pl-2">{currentOrder.lyrics.verse1}</p>
                      </div>

                      <div className="border-l-2 border-[#E5B54F] pl-3 py-1 bg-white/[0.01]">
                        <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#E5B54F] block mb-1">Refrain</span>
                        <p className="whitespace-pre-line text-white font-medium">{currentOrder.lyrics.chorus}</p>
                      </div>

                      <div>
                        <span className="font-mono text-[10.5px] uppercase tracking-wider text-neutral-500 block mb-1">Couplet 2</span>
                        <p className="whitespace-pre-line pl-2">{currentOrder.lyrics.verse2}</p>
                      </div>

                      {currentOrder.lyrics.outro && (
                        <div>
                          <span className="font-mono text-[10.5px] uppercase tracking-wider text-neutral-500 block mb-1">Outro</span>
                          <p className="whitespace-pre-line pl-2 italic text-neutral-400">{currentOrder.lyrics.outro}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-[#07080B] py-12 text-center space-y-3">
                    <Sparkles className="h-8 w-8 text-[#E5B54F] mx-auto" />
                    <h4 className="text-base font-semibold text-white">Prêt à écrire pour {currentOrder.recipient}</h4>
                    <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                      Un clic suffit pour générer un texte poétique complet de 32 à 48 vers basé sur les souvenirs du client.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleGenerateLyrics()}
                      disabled={isGeneratingLyrics}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-bold text-black hover:bg-neutral-200 cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{isGeneratingLyrics ? 'Composition en cours…' : 'Générer les paroles maintenant'}</span>
                    </button>
                  </div>
                )}

                {/* Bouton d'expédition directe sur WhatsApp */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    disabled={!currentOrder.lyrics}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-4 text-xs sm:text-sm transition-all shadow-[0_4px_16px_rgba(16,185,129,0.25)] active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>Envoyer les paroles directement sur WhatsApp à {currentOrder.clientName.split(' ')[0]}</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
