import { useState, type FC } from 'react';
import { 
  MessagesSquare, 
  Download, 
  Search, 
  ExternalLink, 
  Send, 
  FileText
} from 'lucide-react';
import type { ConversationItem } from '../types';
import { MOCK_CONVERSATIONS } from '../data/mockData';

interface ConversationsViewProps {
  onOpenOrderForStudio?: (name: string) => void;
}

export const ConversationsView: FC<ConversationsViewProps> = () => {
  const [conversations] = useState<ConversationItem[]>(MOCK_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string>(MOCK_CONVERSATIONS[0].id);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [messagesHistory, setMessagesHistory] = useState<Record<string, string[]>>({
    'conv-1': [
      'Bonjour, je viens pour l\'hommage de mon frère et de son épouse.',
      'Bonjour et bienvenue chez Velaris Studio. Nous sommes de tout cœur avec vous. Donnez-nous simplement les prénoms et votre message de cœur.',
      '(a) FAITS CONCRETS : Frère = Gaudens, Défunte épouse = Prisca, Décès le 28 septembre. Je souhaite une chanson d\'espérance chrétienne.',
      'Et qu\'il te donne la force quand la vie devient forte.\nReste béni, mon frère,\nQue le Seigneur veille sur toi'
    ]
  });

  const selectedConv = conversations.find(c => c.id === selectedId) || conversations[0];

  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.preview.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    setMessagesHistory(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), replyText]
    }));
    setReplyText('');
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
            Toutes tes discussions WhatsApp. Tu réponds toi-même ; les automatisations envoient seulement ce que tu as préparé.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141310] hover:bg-[#1e1c17] text-stone-200 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5 text-stone-400" />
          <span>Exporter</span>
        </button>
      </div>

      {/* Barre de recherche et compteur */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs uppercase tracking-widest font-bold text-stone-400">
          200 CONVERSATIONS
        </div>
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#12110e] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#c5a059]/50"
          />
        </div>
      </div>

      {/* 2. Liste des conversations (Card master) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e0d0b] divide-y divide-white/[0.05] overflow-hidden shadow-xl">
        {filteredConversations.map((conv) => {
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
                  </div>
                  <p className="text-xs text-stone-400 mt-1 line-clamp-1 font-mono">
                    {conv.preview}
                  </p>
                </div>

                <div className="text-[11px] text-stone-400 shrink-0 font-mono">
                  {conv.lastExchange}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Volet d'inspection de la discussion active (Exactement comme en bas de Photo 1) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
          <div>
            <div className="font-serif text-xl font-bold text-[#f3f4f6]">
              {selectedConv.name}
            </div>
            <div className="text-xs text-stone-400 mt-0.5">
              Étape : <span className="text-emerald-400 font-semibold">En discussion</span> · {selectedConv.phone}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${selectedConv.phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1e7e34] hover:bg-[#218838] text-white text-xs font-semibold transition-all shadow-sm"
            >
              <ExternalLink className="h-3 w-3" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={() => alert(`Fiche Client : ${selectedConv.name}\nTéléphone : ${selectedConv.phone}\nFaits : ${selectedConv.facts || 'Non renseigné'}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c1914] text-stone-300 hover:text-white border border-white/[0.08] text-xs font-medium transition-all cursor-pointer"
            >
              <FileText className="h-3 w-3 text-stone-400" />
              <span>Fiche</span>
            </button>

            <button
              onClick={handleExport}
              className="p-1.5 rounded-full bg-[#1c1914] text-stone-400 hover:text-white border border-white/[0.08] text-xs transition-all cursor-pointer"
              title="Télécharger l'historique"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Fil des messages WhatsApp simulé */}
        <div className="space-y-3 min-h-[160px] max-h-[320px] overflow-y-auto pr-1">
          {(messagesHistory[selectedId] || [selectedConv.fullMessage || selectedConv.preview]).map((msg, index) => {
            const isClient = index % 2 === 0;
            return (
              <div 
                key={index}
                className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
              >
                <div 
                  className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs sm:text-sm whitespace-pre-line leading-relaxed shadow-md ${
                    isClient
                      ? 'bg-[#1a1814] text-stone-200 border border-white/[0.06] rounded-tl-sm'
                      : 'bg-[#005c4b] text-[#e9edef] rounded-tr-sm'
                  }`}
                >
                  {msg}
                  <div className={`text-[10px] mt-1 text-right ${isClient ? 'text-stone-400' : 'text-emerald-200/70'} font-mono`}>
                    29 sept., 16:4{index}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Barre de réponse manuelle */}
        <div className="pt-2 flex items-center gap-2 border-t border-white/[0.06]">
          <input
            type="text"
            placeholder="Écrire une réponse directe WhatsApp..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
            className="flex-1 bg-[#0b0a08] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#c5a059]"
          />
          <button
            onClick={handleSendReply}
            className="p-2 rounded-xl bg-[#c5a059] hover:bg-[#d4af37] text-black font-semibold transition-all cursor-pointer shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
