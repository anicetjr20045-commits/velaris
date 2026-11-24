import { useState, useEffect, type FC, type FormEvent } from 'react';
import {
  FileText,
  Check,
  Copy,
  Edit3,
  Save,
  X,
  RefreshCw,
  Send,
  Sparkles,
  Plus
} from 'lucide-react';
import type { Order } from '../types';
import { detectOccasion, generateHouseStyleSong } from '../services/lyricsCorpus';

interface StudioViewProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  onUpdateOrder: (updated: Order) => void;
}

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
  const pendingOrders = orders.filter((o) => o.status === 'brief_recu');
  const currentOrder = orders.find((o) => o.id === selectedOrderId) || pendingOrders[0] || orders[0];

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

  // Formulaire de composition libre immédiate
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickRecipient, setQuickRecipient] = useState('');
  const [quickOccasion, setQuickOccasion] = useState('Anniversaire');
  const [quickStyle, setQuickStyle] = useState('Afro-Love');
  const [quickDetails, setQuickDetails] = useState('');

  const handleQuickCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!quickRecipient.trim()) return;
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      clientName: 'Création Studio',
      clientPhone: '+225 00 00 00 00',
      recipient: quickRecipient.trim(),
      occasion: quickOccasion,
      style: quickStyle,
      amount: 3500,
      paymentMethod: 'Wave',
      status: 'brief_recu',
      transcription: quickDetails.trim() || `Chanson pour ${quickRecipient.trim()} pour son ${quickOccasion}.`,
      createdAt: new Date().toISOString(),
    };
    onUpdateOrder(newOrder);
    onSelectOrder(newOrder.id);
    setShowQuickForm(false);
    setQuickRecipient('');
    setQuickDetails('');
  };

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

  const fieldClass = 'w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white focus:border-[#E5B54F] focus:outline-none transition-colors resize-none leading-relaxed';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* En-tête épuré */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">Studio IA</h2>
          {pendingOrders.length > 0 && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#E5B54F]/15 text-[#E5B54F] border border-[#E5B54F]/30 font-semibold">
              {pendingOrders.length} à faire
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowQuickForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold hover:bg-[#F5EDD7] transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Nouvelle Chanson</span>
        </button>
      </div>

      {/* Sélecteur de commande horizontal compact */}
      {orders.length > 0 && !showQuickForm && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {orders.map((o) => {
            const active = o.id === currentOrder?.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setShowQuickForm(false);
                  onSelectOrder(o.id);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer ${
                  active
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'border border-white/[0.08] bg-[#0B0C10] text-[#C7CAD4] hover:text-white'
                }`}
              >
                <span>{o.recipient}</span>
                <span className={`text-[10px] font-mono ${active ? 'text-black/60' : 'text-neutral-500'}`}>
                  ({o.occasion})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Formulaire de création rapide OU espace de travail des paroles */}
      {showQuickForm || !currentOrder ? (
        <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#08090D] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h3 className="text-base font-bold text-white">Composer une Chanson</h3>
            {currentOrder && (
              <button
                type="button"
                onClick={() => setShowQuickForm(false)}
                className="text-xs text-[#8E94A3] hover:text-white px-2 py-1 rounded-lg border border-white/10"
              >
                Fermer
              </button>
            )}
          </div>

          <form onSubmit={handleQuickCreate} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[#C7CAD4] font-medium mb-1">
                Destinataire *
              </label>
              <input
                type="text"
                required
                value={quickRecipient}
                onChange={(e) => setQuickRecipient(e.target.value)}
                placeholder="Ex: Mariam, Maman Awa, Marc..."
                className="w-full bg-[#040507] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#C7CAD4] font-medium mb-1">Occasion</label>
                <select
                  value={quickOccasion}
                  onChange={(e) => setQuickOccasion(e.target.value)}
                  className="w-full bg-[#040507] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                >
                  <option>Anniversaire</option>
                  <option>Demande en mariage</option>
                  <option>Déclaration d'amour</option>
                  <option>Hommage aux parents</option>
                  <option>Célébration / Diplôme</option>
                  <option>Réconciliation</option>
                </select>
              </div>

              <div>
                <label className="block text-[#C7CAD4] font-medium mb-1">Style Musical</label>
                <select
                  value={quickStyle}
                  onChange={(e) => setQuickStyle(e.target.value)}
                  className="w-full bg-[#040507] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                >
                  <option>Afro-Love Contemporain</option>
                  <option>Guitare Acoustique & Voix</option>
                  <option>Chœur Gospel Moderne</option>
                  <option>Zouk Romantique</option>
                  <option>Rumba Douce</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#C7CAD4] font-medium mb-1">
                Détails ou souvenirs clés
              </label>
              <textarea
                rows={2}
                value={quickDetails}
                onChange={(e) => setQuickDetails(e.target.value)}
                placeholder="Souvenirs, qualités ou anecdotes..."
                className="w-full bg-[#040507] border border-white/10 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-[#D4AF37] leading-relaxed resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-neutral-200 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>Générer les Paroles</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-5 sm:p-6 space-y-4">
          {/* Fiche destinataire compacte */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <span className="text-base font-bold text-white">{currentOrder.recipient}</span>
              <span className="text-xs text-[#E5B54F] ml-2">({currentOrder.occasion})</span>
            </div>

            <div className="flex items-center gap-1.5">
              {!isEditingLyrics && currentOrder.lyrics && (
                <button
                  type="button"
                  onClick={() => setIsEditingLyrics(true)}
                  className="p-2 rounded-lg text-[#8E94A3] hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                  title="Modifier"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              {isEditingLyrics && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveEditedLyrics}
                    className="p-2 rounded-lg bg-white text-black hover:bg-neutral-200 transition cursor-pointer"
                    title="Enregistrer"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingLyrics(false)}
                    className="p-2 rounded-lg text-[#8E94A3] hover:text-white transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => handleGenerateLyrics(customPrompt)}
                disabled={isGeneratingLyrics}
                className="p-2 rounded-lg text-[#8E94A3] hover:text-white hover:bg-white/[0.06] transition cursor-pointer disabled:opacity-50"
                title={currentOrder.lyrics ? 'Régénérer' : 'Générer'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingLyrics ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleCopyLyrics}
                disabled={!currentOrder.lyrics}
                className="p-2 rounded-lg text-[#8E94A3] hover:text-white hover:bg-white/[0.06] transition cursor-pointer disabled:opacity-40"
                title="Copier"
              >
                {lyricsCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Consigne d'écriture rapide */}
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customPrompt.trim()) handleGenerateLyrics(customPrompt);
            }}
            placeholder="Consigne rapide (ex: couplet très émouvant, refrain dansant...)"
            className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]/50"
          />

          {/* Éditeur ou affichage des paroles */}
          {isEditingLyrics ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titre de la chanson"
                className={`${fieldClass} font-bold`}
              />
              <div>
                <span className="text-[10px] font-mono text-neutral-500 block mb-1">COUPLET 1</span>
                <textarea rows={3} value={editVerse1} onChange={(e) => setEditVerse1(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#E5B54F] block mb-1">REFRAIN</span>
                <textarea rows={3} value={editChorus} onChange={(e) => setEditChorus(e.target.value)} className={`${fieldClass} border-[#E5B54F]/30 font-medium`} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-500 block mb-1">COUPLET 2</span>
                <textarea rows={3} value={editVerse2} onChange={(e) => setEditVerse2(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-500 block mb-1">OUTRO</span>
                <input type="text" value={editOutro} onChange={(e) => setEditOutro(e.target.value)} className={fieldClass} />
              </div>
            </div>
          ) : currentOrder.lyrics ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 space-y-4 max-h-[400px] overflow-y-auto">
              <div className="border-b border-white/[0.06] pb-2 text-center">
                <h4 className="italic text-xl text-white font-bold">{currentOrder.lyrics.title}</h4>
              </div>

              <div className="space-y-3.5 text-sm leading-relaxed text-neutral-200">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 block mb-1">Couplet 1</span>
                  <p className="whitespace-pre-line pl-2">{currentOrder.lyrics.verse1}</p>
                </div>

                <div className="border-l-2 border-[#E5B54F] pl-3 py-1 bg-white/[0.01]">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#E5B54F] block mb-1">Refrain</span>
                  <p className="whitespace-pre-line text-white font-medium">{currentOrder.lyrics.chorus}</p>
                </div>

                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 block mb-1">Couplet 2</span>
                  <p className="whitespace-pre-line pl-2">{currentOrder.lyrics.verse2}</p>
                </div>

                {currentOrder.lyrics.outro && (
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 block mb-1">Outro</span>
                    <p className="whitespace-pre-line pl-2 italic text-neutral-400">{currentOrder.lyrics.outro}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#07080B] py-10 text-center space-y-3">
              <FileText className="h-6 w-6 text-[#E5B54F] mx-auto" />
              <p className="text-xs text-neutral-400">
                Aucune parole pour {currentOrder.recipient}. Cliquez sur Générer pour créer le texte.
              </p>
              <button
                type="button"
                onClick={() => handleGenerateLyrics()}
                disabled={isGeneratingLyrics}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-black hover:bg-neutral-200 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span>{isGeneratingLyrics ? 'Génération…' : 'Générer les paroles'}</span>
              </button>
            </div>
          )}

          {/* Bouton envoi WhatsApp */}
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={!currentOrder.lyrics}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(16,185,129,0.2)]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Envoyer sur WhatsApp à {currentOrder.clientName.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
