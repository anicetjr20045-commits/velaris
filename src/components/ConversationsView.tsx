import { useState, useEffect, type FC } from 'react';
import { 
  Download, 
  Search, 
  ExternalLink, 
  Send, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageCircle
} from 'lucide-react';
import type { ConversationItem } from '../types';
import { 
  REAL_CONVERSATIONS, 
  REAL_CONVERSATION_MESSAGES 
} from '../data/realProductionData';
import { sendWahaTextMessage } from '../services/waha';
import { useAuth } from '../hooks/useAuth';
import { getLiveConversations } from '../services/supabase';

interface ConversationsViewProps {
  onOpenOrderForStudio?: (name: string) => void;
}

export const ConversationsView: FC<ConversationsViewProps> = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    return user ? [] : REAL_CONVERSATIONS;
  });
  const [selectedId, setSelectedId] = useState<string>(() => {
    return user ? '' : (REAL_CONVERSATIONS[0]?.id || '');
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendFeedback, setSendFeedback] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    getLiveConversations().then((live) => {
      setConversations(live);
      if (live.length > 0) {
        setSelectedId((prev) => prev && live.some(c => c.id === prev) ? prev : live[0].id);
      } else {
        setSelectedId('');
      }
    });
  }, [user]);

  // Historique des messages par conversation
  const [customMessages, setCustomMessages] = useState<Record<string, { role: string; body: string; time: string }[]>>({});

  const selectedConv = conversations.find(c => c.id === selectedId) || conversations[0] || null;

  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.preview.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Messages initiaux réels pour cette conversation
  const initialMessages = (selectedId && REAL_CONVERSATION_MESSAGES[selectedId]) || [
    {
      id: 'default-1',
      role: 'user',
      direction: 'inbound',
      body: selectedConv ? (selectedConv.fullMessage || selectedConv.preview) : '',
      createdAt: selectedConv ? selectedConv.lastExchange : 'Récemment',
    }
  ];

  const currentExtraMessages = (selectedId && customMessages[selectedId]) || [];

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending || !selectedConv) return;
    const textToSend = replyText.trim();
    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    setCustomMessages(prev => ({
      ...prev,
      [selectedId]: [
        ...(prev[selectedId] || []),
        { role: 'human_agent', body: textToSend, time: `Aujourd'hui ${nowTime}` }
      ]
    }));
    setReplyText('');
    setIsSending(true);
    setSendFeedback(null);

    try {
      const sessionName = user ? `studio_${user.id.slice(0, 8)}` : 'Test';
      const res = await sendWahaTextMessage(selectedConv.phone, textToSend, sessionName);
      if (res.success) {
        setSendFeedback({
          success: true,
          message: `Envoyé sur WhatsApp (${selectedConv.phone}) via la session Studio !`,
        });
      } else {
        setSendFeedback({
          success: false,
          message: res.error || 'Erreur WAHA. Vous pouvez aussi ouvrir WhatsApp directement.',
        });
      }
    } catch (err: any) {
      setSendFeedback({
        success: false,
        message: err.message || 'Impossible de joindre le serveur WAHA.',
      });
    } finally {
      setIsSending(false);
      setTimeout(() => setSendFeedback(null), 5000);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(conversations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velaris_conversations_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cleanPhone = selectedConv ? selectedConv.phone.replace(/[^0-9]/g, '') : '';
  const whatsappDirectUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(replyText || '')}` : '#';

  const quickSnippets = [
    { label: 'Brief vocal', text: "Pour démarrer l'écriture de votre chanson sur-mesure, envoyez-nous une note vocale ou décrivez l'occasion et le prénom du destinataire !" },
    { label: 'Grille 3 000 F', text: "Notre formule Best-Seller à 3 000 FCFA comprend les paroles sur-mesure, 2 masters audio HD et la livraison en 18 minutes." },
    { label: 'Reçu paiement', text: "Paiement bien reçu ! Votre commande passe immédiatement en production studio. Livraison du morceau dans 18 minutes." },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. En-tête de la page Conversations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono tracking-wider text-neutral-300 uppercase">
              MESSAGERIE UNIFIÉE
            </span>
            <span className="text-xs font-mono text-neutral-500">Flux WhatsApp Direct WAHA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Discussions WhatsApp Studio
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Répondez en direct aux prospects issus de vos publicités ou suivez les relances automatisées de l'IA.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-mono transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Exporter JSON</span>
        </button>
      </div>

      {/* Dual Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Conversation List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search bar & counter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Rechercher nom, téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#07080B] border border-white/[0.06] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>

          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 px-1">
            {filteredConversations.length} fil{filteredConversations.length > 1 ? 's' : ''} actif{filteredConversations.length > 1 ? 's' : ''}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#07080B] divide-y divide-white/[0.04] overflow-hidden max-h-[540px] overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageCircle className="h-6 w-6 text-neutral-600 mx-auto" />
                <p className="text-xs font-semibold text-neutral-300">Aucune discussion active</p>
                <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                  Dès qu'un client vous écrit sur votre numéro WhatsApp Studio, sa conversation apparaîtra ici.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`p-3.5 transition-all cursor-pointer relative ${
                      isSelected 
                        ? 'bg-white/[0.08]' 
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-white" />
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white truncate">
                            {conv.name}
                          </span>
                          {conv.unread && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-white/[0.04] text-neutral-400 border border-white/[0.06]">
                            {conv.status}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-1">
                          {conv.preview}
                        </p>
                      </div>

                      <div className="text-[10px] text-neutral-500 shrink-0 font-mono">
                        {conv.lastExchange}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Thread & Live Reply (7 cols) */}
        <div className="lg:col-span-7">
          {selectedConv ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#07080B] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold text-white tracking-tight">
                      {selectedConv.name}
                    </span>
                    <span className="font-mono text-xs text-neutral-400">
                      {selectedConv.phone}
                    </span>
                  </div>
                  {selectedConv.facts && (
                    <div className="text-[11px] text-neutral-400 mt-1 font-mono line-clamp-1">
                      {selectedConv.facts}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={whatsappDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-mono transition-all"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>WhatsApp App</span>
                  </a>
                </div>
              </div>

              {/* Message Thread */}
              <div className="space-y-3 min-h-[180px] max-h-[340px] overflow-y-auto p-4 rounded-xl bg-[#0D0F14] border border-white/[0.04]">
                {initialMessages.map((m, idx) => {
                  const isUser = m.role === 'user' || m.direction === 'inbound';
                  return (
                    <div
                      key={m.id || idx}
                      className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                    >
                      <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs ${
                        isUser 
                          ? 'bg-[#12141A] text-neutral-200 border border-white/[0.08] rounded-tl-sm' 
                          : 'bg-white text-black font-medium rounded-tr-sm shadow-sm'
                      }`}>
                        <div className={`text-[10px] mb-1 font-mono ${isUser ? 'text-neutral-500' : 'text-neutral-600'}`}>
                          {isUser ? selectedConv.name : 'Studio Velaris'} • {m.createdAt}
                        </div>
                        <div className="whitespace-pre-line leading-relaxed">
                          {m.body}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {currentExtraMessages.map((em, eidx) => (
                  <div key={`extra-${eidx}`} className="flex flex-col items-end">
                    <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs bg-white text-black font-medium rounded-tr-sm shadow-sm">
                      <div className="text-[10px] text-neutral-600 mb-1 font-mono">
                        Moi (WAHA Direct) • {em.time}
                      </div>
                      <div className="whitespace-pre-line leading-relaxed">
                        {em.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Feedback d'envoi WAHA */}
              {sendFeedback && (
                <div className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                  sendFeedback.success 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {sendFeedback.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{sendFeedback.message}</span>
                </div>
              )}

              {/* Quick Snippets Dock */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 shrink-0 mr-1">Snippets :</span>
                {quickSnippets.map((snip, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => setReplyText(snip.text)}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] font-mono text-neutral-300 hover:text-white transition-all shrink-0 cursor-pointer"
                  >
                    {snip.label}
                  </button>
                ))}
              </div>

              {/* Champ d'envoi rapide via WAHA */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder={`Répondre à ${selectedConv.name} sur WhatsApp...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  className="flex-1 bg-[#0D0F14] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 transition-all font-sans"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-sm shrink-0"
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Envoyer</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] p-12 text-center text-neutral-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Sélectionnez une discussion à gauche pour afficher le fil.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
