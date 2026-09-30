import { useState, useEffect, type FC } from 'react';
import { 
  MessagesSquare, 
  Download, 
  Search, 
  ExternalLink, 
  Send, 
  FileText,
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

    // Ajout instantané à l'interface locale
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* 1. En-tête de la page Conversations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <MessagesSquare className="h-6 w-6 text-[#c5a059]" />
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#f3f4f6]">
              Conversations
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xl">
            Toutes tes discussions WhatsApp réelles. Tu réponds toi-même en direct via WAHA ; Sarah qualifie les briefs et les automatisations envoient ce que tu as préparé.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141310] hover:bg-[#1e1c17] text-stone-200 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5 text-stone-400" />
          <span>Exporter JSON</span>
        </button>
      </div>

      {/* Barre de recherche et compteur */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs uppercase tracking-widest font-bold text-stone-400 font-mono">
          {conversations.length} CONVERSATION{conversations.length > 1 ? 'S' : ''} ACTIVE{conversations.length > 1 ? 'S' : ''}
        </div>
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher nom, téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#12110e] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#c5a059]/50"
          />
        </div>
      </div>

      {/* 2. Liste des conversations (Card master) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e0d0b] divide-y divide-white/[0.05] overflow-hidden shadow-xl max-h-[380px] overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <MessageCircle className="h-6 w-6 text-stone-500 mx-auto" />
            <p className="text-xs font-semibold text-stone-300">Aucune discussion WhatsApp active</p>
            <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
              Dès qu'un client vous écrit sur votre numéro WhatsApp Studio, sa conversation et ses commandes s'afficheront ici en direct.
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`p-4 sm:p-5 transition-all cursor-pointer relative ${
                  isSelected 
                    ? 'bg-[#181612] border-l-4 border-[#c5a059]' 
                    : 'hover:bg-[#14120f]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#f3f4f6] truncate">
                        {conv.name}
                      </span>
                      {conv.unread && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      )}
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/[0.06] text-stone-400 font-mono">
                        {conv.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 line-clamp-1 font-sans">
                      {conv.preview}
                    </p>
                  </div>

                  <div className="text-[11px] text-stone-400 shrink-0 font-mono">
                    {conv.lastExchange}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Volet d'inspection de la discussion active */}
      {selectedConv && (
      <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-serif text-xl font-bold text-[#f3f4f6]">
                {selectedConv.name}
              </span>
              <span className="font-mono text-xs text-stone-400">
                {selectedConv.phone}
              </span>
            </div>
            {selectedConv.facts && (
              <div className="text-xs text-[#c5a059] mt-1 font-mono line-clamp-2">
                {selectedConv.facts}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1e7e34] hover:bg-[#218838] text-white text-xs font-semibold transition-all shadow-sm"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Ouvrir WhatsApp</span>
            </a>

            <button
              onClick={() => {
                alert(`Fiche client : ${selectedConv.name}\nTéléphone : ${selectedConv.phone}\nFaits : ${selectedConv.facts || 'Non spécifié'}`);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#181612] hover:bg-[#201d18] text-stone-300 border border-white/[0.08] text-xs font-medium cursor-pointer"
            >
              <FileText className="h-3 w-3 text-stone-400" />
              <span>Fiche client</span>
            </button>
          </div>
        </div>

        {/* Fil des messages authentiques */}
        <div className="space-y-3 min-h-[140px] max-h-[320px] overflow-y-auto p-4 rounded-xl bg-[#0a0907] border border-white/[0.04]">
          {initialMessages.map((m, idx) => {
            const isUser = m.role === 'user' || m.direction === 'inbound';
            return (
              <div
                key={m.id || idx}
                className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                  isUser 
                    ? 'bg-[#1a1814] text-stone-200 border border-white/[0.06] rounded-tl-sm' 
                    : 'bg-[#223326] text-emerald-100 border border-emerald-500/20 rounded-tr-sm'
                }`}>
                  <div className="text-[10px] text-stone-400 mb-1 font-mono">
                    {isUser ? selectedConv.name : 'Studio Velaris'} • {m.createdAt}
                  </div>
                  <div className="whitespace-pre-line leading-relaxed font-sans">
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Messages ajoutés en direct */}
          {currentExtraMessages.map((em, eidx) => (
            <div key={`extra-${eidx}`} className="flex flex-col items-end">
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-md bg-[#223326] text-emerald-100 border border-emerald-500/20 rounded-tr-sm">
                <div className="text-[10px] text-stone-400 mb-1 font-mono">
                  Moi (Envoi direct WAHA) • {em.time}
                </div>
                <div className="whitespace-pre-line leading-relaxed font-sans">
                  {em.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Feedback d'envoi WAHA */}
        {sendFeedback && (
          <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
            sendFeedback.success 
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' 
              : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
          }`}>
            {sendFeedback.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{sendFeedback.message}</span>
          </div>
        )}

        {/* Champ d'envoi rapide via WAHA */}
        <div className="flex items-center gap-2 pt-2">
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
            className="flex-1 bg-[#0e0d0a] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#c5a059]/60"
          />
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim() || isSending}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#c5a059] hover:bg-[#d4af37] text-black text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-md shrink-0"
          >
            {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>Envoyer WAHA</span>
          </button>
        </div>
      </div>
      )}
    </div>
  );
};
