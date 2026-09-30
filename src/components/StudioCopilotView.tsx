import { useState, useRef, useEffect, type FC } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Copy, 
  Check, 
  RotateCcw, 
  TrendingUp, 
  MessageSquare, 
  Music, 
  ArrowUpRight, 
  Loader2, 
  CheckCircle2, 
  Database,
  FileText
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { 
  askCopilot, 
  sendCopilotWhatsAppMessage, 
  type CopilotMessage 
} from '../services/copilot';

interface StudioCopilotViewProps {
  sessionName?: string;
  onNavigateToStudio?: () => void;
}

export const StudioCopilotView: FC<StudioCopilotViewProps> = ({
  sessionName: propSessionName,
  onNavigateToStudio
}) => {
  const { user } = useAuth();
  const sessionName = propSessionName || (user ? `studio_${user.id.slice(0, 8)}` : 'Test');

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 
`### Copilot & Analyste Studio Velaris
Je suis votre analyste d'affaires et assistant de production privé. J'ai accès en direct à :
- **Vos encaissements & commandes** enregistrés en base PostgreSQL.
- **Vos conversations WhatsApp & briefs clients** captés par votre passerelle WAHA.
- **Vos automatisations & tarifs studio** (1 200 F / 3 000 F / 5 000 F).

Posez-moi une question sur vos ventes, demandez-moi de retrouver un client, ou laissez-moi rédiger vos paroles et messages de relance.`,
      timestamp: 'En direct',
      toolsExecuted: ['sync_studio_database', 'waha_gateway_ready']
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingMessageMap, setSendingMessageMap] = useState<Record<string, boolean>>({});
  const [sentSuccessMap, setSentSuccessMap] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMessage: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await askCopilot(query, messages, sessionName, user);
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: "Une erreur est survenue lors de l'interrogation du Copilot. Veuillez réessayer.",
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDirectWhatsAppSend = async (cardId: string, phone?: string, content?: string, convId?: string) => {
    if (!phone || !content) return;
    setSendingMessageMap(prev => ({ ...prev, [cardId]: true }));

    const res = await sendCopilotWhatsAppMessage(phone, content, sessionName, convId);
    setSendingMessageMap(prev => ({ ...prev, [cardId]: false }));

    if (res.success) {
      setSentSuccessMap(prev => ({ ...prev, [cardId]: true }));
      setTimeout(() => {
        setSentSuccessMap(prev => ({ ...prev, [cardId]: false }));
      }, 6000);
    } else {
      alert(`Erreur d'envoi WhatsApp : ${res.error || 'Vérifiez la connexion de votre passerelle WAHA'}`);
    }
  };

  const suggestions = [
    { label: "Synthèse de mes encaissements", icon: TrendingUp, query: "Combien ai-je encaissé cette semaine et quel est mon chiffre d'affaires total ?" },
    { label: "Rappeler le dernier brief client", icon: MessageSquare, query: "Rappelle-moi la discussion avec le dernier client WhatsApp et ce qu'il a demandé." },
    { label: "Rédiger des paroles personnalisées", icon: Music, query: "Rédige les paroles d'une chanson d'anniversaire romantique pour une cliente." },
    { label: "Relancer les briefs non payés", icon: ArrowUpRight, query: "Rédige-moi un message WhatsApp persuasif pour relancer un client qui hésite." },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Meta Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#8f6d14] text-black shadow-md shadow-[#d4af37]/10">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Copilot & Analyste Studio
            </h1>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Intelligence augmentée sur vos ventes, vos discussions WhatsApp et vos paroles de chansons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-[11px] font-mono text-stone-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Passerelle : <strong className="text-white font-mono">{sessionName}</strong></span>
          </div>
          <button
            onClick={() => setMessages([messages[0]])}
            title="Réinitialiser l'échange"
            className="p-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Suggested Quick Queries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {suggestions.map((s, idx) => {
          const Icon = s.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(s.query)}
              disabled={isLoading}
              className="flex items-center gap-2.5 p-3 rounded-2xl border border-white/[0.06] bg-[#0c0d12] hover:bg-[#12141c] hover:border-white/[0.12] text-left transition-all group cursor-pointer disabled:opacity-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-[#d4af37] group-hover:scale-105 transition-transform">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium text-stone-300 group-hover:text-white line-clamp-1">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Terminal / Chat History */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#08090d] shadow-2xl overflow-hidden flex flex-col min-h-[460px]">
        {/* Messages Stream */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[600px]">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4af37] to-[#8f6d14] text-black shadow-md">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[78%] space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-white text-black font-medium shadow-lg'
                        : 'bg-[#0f1118] border border-white/[0.08] text-stone-200 shadow-md'
                    }`}
                  >
                    <div className="prose prose-invert prose-xs max-w-none space-y-2 whitespace-pre-wrap font-sans">
                      {m.text}
                    </div>

                    {/* Tool Badges */}
                    {m.toolsExecuted && m.toolsExecuted.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                        <Database className="h-3 w-3 text-emerald-400" />
                        <span>Outils exécutés :</span>
                        {m.toolsExecuted.map((t, tidx) => (
                          <span
                            key={tidx}
                            className="px-1.5 py-0.5 rounded-md bg-white/[0.03] text-stone-400 border border-white/[0.04]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interactive Action Card if generated by the tool */}
                  {m.actionCard && (
                    <div className="rounded-2xl border border-[#d4af37]/30 bg-[#12131a] p-4 shadow-xl space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <div className="flex items-center gap-2">
                          {m.actionCard.type === 'lyrics' ? (
                            <Music className="h-4 w-4 text-[#d4af37]" />
                          ) : m.actionCard.type === 'client_brief' ? (
                            <FileText className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-[#d4af37]" />
                          )}
                          <span className="text-xs font-bold text-white tracking-wide">
                            {m.actionCard.title}
                          </span>
                        </div>
                        {m.actionCard.phone && (
                          <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            {m.actionCard.phone}
                          </span>
                        )}
                      </div>

                      {/* Content Preview */}
                      <div className="text-xs text-stone-300 bg-black/40 rounded-xl p-3 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-white/[0.04]">
                        {m.actionCard.content}
                      </div>

                      {/* Interactive Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyText(m.id, m.actionCard!.content)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-stone-200 transition-colors cursor-pointer"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>

                        {/* Send directly to WhatsApp if client card */}
                        {m.actionCard.phone && (
                          <button
                            type="button"
                            disabled={sendingMessageMap[m.id]}
                            onClick={() =>
                              handleDirectWhatsAppSend(
                                m.id,
                                m.actionCard?.phone,
                                m.actionCard?.content,
                                m.actionCard?.metadata?.convId
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5c158] hover:opacity-95 text-xs font-bold text-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                          >
                            {sendingMessageMap[m.id] ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Envoi WAHA en cours...</span>
                              </>
                            ) : sentSuccessMap[m.id] ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-black" />
                                <span>Envoyé sur WhatsApp</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5" />
                                <span>Envoyer sur WhatsApp</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Navigate to Suno Studio if lyrics */}
                        {m.actionCard.type === 'lyrics' && onNavigateToStudio && (
                          <button
                            type="button"
                            onClick={onNavigateToStudio}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-xs font-bold text-black transition-all cursor-pointer shadow-md"
                          >
                            <span>Injecter dans le Studio Suno</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`text-[10px] text-stone-500 font-mono px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {m.timestamp}
                  </div>
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-stone-400 animate-pulse">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#d4af37]/20 text-[#d4af37]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <span>Recherche dans la base de données du studio et génération de l'analyse...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-[#0a0b0f] border-t border-white/[0.08]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ex: Rappelle-moi ce que j'ai dit au dernier client, ou analyse mes ventes..."
              disabled={isLoading}
              className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-[#d4af37]/60 focus:bg-white/[0.05] rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="flex items-center justify-center h-11 w-11 rounded-2xl bg-white hover:bg-neutral-200 text-black transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500 px-1">
            <span>Rappels de conversations • Chiffre d'affaires en direct • Ghostwriting poétique</span>
            <span className="hidden sm:inline font-mono">Velaris Intelligence v2.4</span>
          </div>
        </div>
      </div>
    </div>
  );
};
