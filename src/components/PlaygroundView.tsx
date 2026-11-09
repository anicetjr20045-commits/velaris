import { useEffect, useRef, useState, type FC } from 'react';
import {
  RotateCcw,
  Send,
  Mic,
  Square,
  Play,
  Pause,
  FileText,
  CreditCard,
  PanelRight,
  Sparkles,
  Paperclip,
  Check,
  Cpu,
  UserCheck,
  Video,
  Image as ImageIcon,
  CheckCheck,
  Clock,
  Lock,
  X,
  Sliders,
  Zap,
  Copy,
} from 'lucide-react';
import { transcribeAudioBlob } from '../services/whisper-stt';
import {
  processSimulationTurn,
  type SimulationState,
} from '../services/simulator-fsm';

export interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  mediaKind?: 'audio' | 'image' | 'sample' | 'video';
  mediaUrl?: string;
  mediaTranscript?: string;
  mediaDurationSec?: number;
  sampleTitle?: string;
  isProcedureVoice?: boolean;
  isPaymentBlock?: boolean;
  isLyricsCard?: boolean;
  lyricsData?: {
    minutes?: number;
    lyrics?: string;
    title?: string;
  };
  attachmentKind?: 'photo' | 'receipt' | 'link';
}

export interface ScenarioPreset {
  id: string;
  title: string;
  clientName: string;
  country: 'CI' | 'BF' | 'SN' | 'OTHER';
  phone: string;
  firstMessages: string[];
  description: string;
  clientProfile?: 'new' | 'returning';
}

export interface AgentConfig {
  agentName: string;
  studioName: string;
  role: string;
  burstWindowMs: number;
  tariffs: {
    decouvertePrice: string;
    prestigePrice: string;
  };
  payment: {
    orangeMoneyBf: string;
    waveCi: string;
    waveSn: string;
    accountHolder: string;
  };
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  agentName: 'Alex',
  studioName: 'Velaris Studio',
  role: 'Conseiller Vente WhatsApp',
  burstWindowMs: 40000,
  tariffs: {
    decouvertePrice: '1 200',
    prestigePrice: '3 000',
  },
  payment: {
    orangeMoneyBf: '+226 05 77 73 08 (Wendyam Anicet junior Sekongo)',
    waveCi: '+226 05 77 73 08 (Sekongo Anicet)',
    waveSn: '+226 05 77 73 08',
    accountHolder: 'Wendyam Anicet junior Sekongo',
  },
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'nouveau_mari_ouaga',
    title: 'Aminata (Burkina Faso — Anniversaire de son mari Alassane)',
    clientName: 'Aminata Traoré',
    country: 'BF',
    phone: '+22656240533',
    clientProfile: 'new',
    firstMessages: [
      'Bonjour cher studio, je veux commander une chanson pour l’anniversaire de mon mari Alassane ce samedi.',
    ],
    description: 'Teste le protocole 2 vocaux, le cadrage du brief, le vocal de procédure de 33s et Orange Money.',
  },
  {
    id: 'mariam_abidjan_rafale',
    title: 'Koffi (Côte d’Ivoire — Rafale de messages + Wave)',
    clientName: 'Koffi Yao',
    country: 'CI',
    phone: '+2250708091011',
    clientProfile: 'new',
    firstMessages: [
      'Bonjour',
      'Je veux une chanson pour ma mère',
      'C’est pour son 60e anniversaire le 25 novembre',
    ],
    description: 'Teste l’absorption de messages en rafale (coalescing) et le paiement Wave CI.',
  },
  {
    id: 'fidele_reviens',
    title: 'Fatou Ndiaye (Ancienne cliente fidèle — Zéro vocal de procédure)',
    clientName: 'Fatou Ndiaye',
    country: 'OTHER',
    phone: '+33612345678',
    clientProfile: 'returning',
    firstMessages: [
      'Bonjour Alex ! Je reviens vers vous, vous aviez composé la chanson pour mon mariage en mai. Je veux une chanson pour le baptême de ma fille Inès dimanche.',
    ],
    description: 'Teste la reconnaissance d’une cliente fidèle : accueil direct, aucun vocal de procédure.',
  },
  {
    id: 'demande_demo_video',
    title: 'Moussa (Demande d’aperçu du montage vidéo)',
    clientName: 'Moussa Cissé',
    country: 'BF',
    phone: '+22670112233',
    clientProfile: 'new',
    firstMessages: [
      'Bonjour, j’ai vu que vous faites un montage vidéo à 3 000 F CFA. Est-ce que je peux voir un exemple de vidéo ?',
    ],
    description: 'Teste l’envoi physique de la vidéo montage_sample.mp4 et le pont conversationnel.',
  },
];

function playWhatsAppChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // Audio context restriction ignore
  }
}

export const PlaygroundView: FC = () => {
  // Configuration
  const [config] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG);
  const [responseDelaySec, setResponseDelaySec] = useState<number>(40);

  // Tablet & Desktop Drawer / Panneau Diagnostic
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'fsm' | 'tariffs' | 'log'>('fsm');

  // Ligne Client simulée
  const [clientPhone, setClientPhone] = useState('+22656240533');
  const [clientName, setClientName] = useState('Aminata Traoré');
  const [countryCode, setCountryCode] = useState<'CI' | 'BF' | 'SN' | 'OTHER'>('BF');
  const [clientProfile, setClientProfile] = useState<'new' | 'returning'>('new');

  // État FSM
  const [fsmState, setFsmState] = useState<SimulationState>({
    stage: 'GREETING',
    pillars: {
      recipientName: null,
      occasion: null,
      senderName: null,
      storyAndMemories: null,
    },
    locks: {
      vocal1Sent: false,
      vocal2Sent: false,
      videoSampleSent: false,
      paymentBlockSent: false,
    },
    country: 'BF',
    clientProfile: 'new',
    selectedOffer: null,
    isHumanTakeover: false,
    lastTurnAt: Date.now(),
  });

  // Conversation
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiPresenceState, setAiPresenceState] = useState<'idle' | 'typing' | 'recording_audio'>('idle');
  const [merchantAlerts, setMerchantAlerts] = useState<string[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(320);

  // Rafale / Debounce
  const [burstQueue, setBurstQueue] = useState<string[]>([]);
  const [burstSecondsLeft, setBurstSecondsLeft] = useState<number>(0);
  const burstTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio & Microphone Réel
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lecteur Audio Native
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Pièces Jointes
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingAttachType, setPendingAttachType] = useState<'photo' | 'receipt'>('photo');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyConversation = async () => {
    const transcript = messages
      .map((m) => `[${m.timestamp}] ${m.role === 'user' ? 'Client' : 'Studio (Alex)'}: ${m.content}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll automatique au fil de l'eau
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, aiPresenceState, burstQueue, burstSecondsLeft]);

  // Synchronisation Pays
  const handleCountryChange = (c: 'CI' | 'BF' | 'SN' | 'OTHER') => {
    setCountryCode(c);
    setFsmState((prev) => ({ ...prev, country: c }));
    if (c === 'CI') setClientPhone('+2250788776655');
    else if (c === 'BF') setClientPhone('+22656240533');
    else if (c === 'SN') setClientPhone('+221778889900');
    else setClientPhone('+33612345678');
  };

  // Synchronisation Profil
  const handleProfileChange = (p: 'new' | 'returning') => {
    setClientProfile(p);
    setFsmState((prev) => ({ ...prev, clientProfile: p }));
  };

  // Lecture Audio Native
  const playNativeAudio = (audioId: string, url: string) => {
    if (playingAudioId === audioId && activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
      activeAudioElementRef.current = null;
    }

    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    activeAudioElementRef.current = audio;
    setPlayingAudioId(audioId);

    audio.onended = () => {
      setPlayingAudioId(null);
      activeAudioElementRef.current = null;
    };

    audio.onerror = () => {
      setPlayingAudioId(null);
      activeAudioElementRef.current = null;
    };

    audio.play().catch((err) => {
      console.warn('Lecture audio bloquée :', err);
      setPlayingAudioId(null);
    });
  };

  const togglePlaybackRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.playbackRate = nextRate;
    }
  };

  // Microphone PTT Réel & Transcription Whisper VPS
  const startRecording = async () => {
    try {
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
        setPlayingAudioId(null);
      }

      // Suspendre le compte à rebours de réponse pendant l'enregistrement pour ne pas couper le client
      if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
      if (burstTimerRef.current) clearInterval(burstTimerRef.current);
      setBurstSecondsLeft(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioRecordingFinished(audioBlob, recordSeconds);
      };

      setIsRecording(true);
      setRecordSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      mr.start(250);
    } catch (err) {
      console.warn('Microphone inaccessible ou refusé :', err);
      const duration = 4;
      const fakeBlob = new Blob(['simulated-audio'], { type: 'audio/ogg' });
      void handleAudioRecordingFinished(fakeBlob, duration, "Bonjour, c'est pour l'anniversaire de mon mari samedi.");
    }
  };

  const stopRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleAudioRecordingFinished = async (blob: Blob, durationSec: number, fallbackText?: string) => {
    const audioUrl = URL.createObjectURL(blob);
    const bubbleId = `user_voice_${Date.now()}`;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newVoiceBubble: ChatBubble = {
      id: bubbleId,
      role: 'user',
      content: '🎙️ Note vocale client',
      timestamp: nowStr,
      status: 'sent',
      mediaKind: 'audio',
      mediaUrl: audioUrl,
      mediaDurationSec: Math.max(1, durationSec),
      mediaTranscript: 'Transcription Whisper VPS en cours…',
    };

    setMessages((prev) => [...prev, newVoiceBubble]);
    setIsTranscribing(true);

    let finalTranscript = fallbackText || '';
    if (!fallbackText) {
      try {
        const result = await transcribeAudioBlob(blob);
        finalTranscript = result.text || 'Message vocal reçu';
        setMerchantAlerts((prev) => [
          `Whisper VPS (${result.durationMs}ms) : « ${finalTranscript} »`,
          ...prev.slice(0, 8),
        ]);
      } catch (err: any) {
        finalTranscript = "Bonjour, c'est pour une chanson personnalisée.";
        setMerchantAlerts((prev) => [
          `Alerte Whisper (${err?.message || 'timeout'}) : repli appliqué`,
          ...prev.slice(0, 8),
        ]);
      }
    }

    setIsTranscribing(false);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === bubbleId ? { ...m, mediaTranscript: finalTranscript, content: `🎙️ ${finalTranscript}` } : m
      )
    );

    enqueueInboundText(finalTranscript);
  };

  // Système de Rafale / Debounce
  const handleSendMessage = () => {
    if (!input.trim() || isAiThinking) return;
    const text = input.trim();
    setInput('');
    enqueueInboundText(text);
  };

  const enqueueInboundText = (text: string, attachmentKind?: 'photo' | 'receipt', attachmentUrl?: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newBubble: ChatBubble = {
      id: `user_${Date.now()}_${Math.random()}`,
      role: 'user',
      content: text,
      timestamp: nowStr,
      status: 'sent',
      mediaKind: attachmentKind === 'photo' || attachmentKind === 'receipt' ? 'image' : undefined,
      mediaUrl: attachmentUrl,
      attachmentKind,
    };

    setMessages((prev) => [...prev, newBubble]);

    const updatedBurst = [...burstQueue, text];
    setBurstQueue(updatedBurst);

    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    if (burstTimerRef.current) clearInterval(burstTimerRef.current);

    const burstDurationMs = responseDelaySec * 1000;
    setBurstSecondsLeft(responseDelaySec);

    burstTimerRef.current = setInterval(() => {
      setBurstSecondsLeft((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    burstTimeoutRef.current = setTimeout(() => {
      flushBurstQueue(updatedBurst, attachmentKind);
    }, burstDurationMs);
  };

  const flushBurstQueue = (pendingItems: string[], attachmentKind?: 'photo' | 'receipt') => {
    if (pendingItems.length === 0) return;
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    if (burstTimerRef.current) clearInterval(burstTimerRef.current);

    setBurstQueue([]);
    setBurstSecondsLeft(0);

    // 1. Double coche grise : Reçu par le serveur WhatsApp
    setMessages((prev) =>
      prev.map((m) => (m.role === 'user' && m.status === 'sent' ? { ...m, status: 'delivered' } : m))
    );

    // 2. Double coche bleue : Lu par le conseiller après 1s
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.role === 'user' && m.status === 'delivered' ? { ...m, status: 'read' } : m))
      );
    }, 1000);

    const mergedTurnText = pendingItems.join('\n');
    void executeAgentTurn(mergedTurnText, attachmentKind);
  };

  const forceFlushNow = () => {
    if (burstQueue.length > 0) {
      flushBurstQueue(burstQueue);
    }
  };

  // Exécution du Tour Agent (FSM)
  const executeAgentTurn = async (inboundText: string, attachmentKind?: 'photo' | 'receipt') => {
    setIsAiThinking(true);
    const startMs = performance.now();

    const turnResult = processSimulationTurn(
      inboundText,
      fsmState,
      Boolean(attachmentKind),
      attachmentKind
    );

    setFsmState(turnResult.newState);
    setLatencyMs(Math.round(performance.now() - startMs));

    if (turnResult.bubbles.length === 0) {
      setIsAiThinking(false);
      setAiPresenceState('idle');
      return;
    }

    setAiPresenceState(turnResult.presenceState);
    await new Promise((resolve) => setTimeout(resolve, turnResult.presenceDurationMs));

    for (let i = 0; i < turnResult.bubbles.length; i++) {
      const b = turnResult.bubbles[i];
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newAgentBubble: ChatBubble = {
        id: `agent_${Date.now()}_${i}`,
        role: 'assistant',
        content: b.content,
        timestamp: nowStr,
        status: 'delivered',
        mediaKind: b.mediaKind,
        mediaUrl: b.mediaUrl,
        mediaDurationSec: b.mediaDurationSec,
        isProcedureVoice: b.isProcedureVoice,
        isPaymentBlock: b.isPaymentBlock,
        isLyricsCard: b.isLyricsCard,
        lyricsData: b.lyricsData,
      };

      setMessages((prev) => [...prev, newAgentBubble]);
      playWhatsAppChime();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(35);
        } catch {
          // ignore
        }
      }

      if (i < turnResult.bubbles.length - 1) {
        setAiPresenceState('typing');
        await new Promise((resolve) => setTimeout(resolve, turnResult.interBubbleDelayMs));
      }
    }

    setAiPresenceState('idle');
    setIsAiThinking(false);

    setMerchantAlerts((prev) => [
      `FSM Tour : ${turnResult.fsmExplanation}`,
      ...prev.slice(0, 8),
    ]);
  };

  // Chargement Scénario
  const loadScenario = (sc: ScenarioPreset) => {
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
      activeAudioElementRef.current = null;
    }
    setPlayingAudioId(null);
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    if (burstTimerRef.current) clearInterval(burstTimerRef.current);

    setMessages([]);
    setBurstQueue([]);
    setBurstSecondsLeft(0);
    setMerchantAlerts([]);
    setClientName(sc.clientName);
    setCountryCode(sc.country);
    setClientPhone(sc.phone);
    setClientProfile(sc.clientProfile || 'new');

    const initialState: SimulationState = {
      stage: 'GREETING',
      pillars: {
        recipientName: null,
        occasion: null,
        senderName: null,
        storyAndMemories: null,
      },
      locks: {
        vocal1Sent: false,
        vocal2Sent: sc.clientProfile === 'returning',
        videoSampleSent: false,
        paymentBlockSent: false,
      },
      country: sc.country,
      clientProfile: sc.clientProfile || 'new',
      selectedOffer: null,
      isHumanTakeover: false,
      lastTurnAt: Date.now(),
    };

    setFsmState(initialState);

    const initialBubbles: ChatBubble[] = sc.firstMessages.map((msg, i) => ({
      id: `init_${Date.now()}_${i}`,
      role: 'user',
      content: msg,
      timestamp: new Date(Date.now() - (sc.firstMessages.length - i) * 1200).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'read',
    }));

    setMessages(initialBubbles);

    setTimeout(() => {
      void executeAgentTurn(sc.firstMessages.join('\n'));
    }, 400);
  };

  // Intervention Humaine
  const toggleHumanTakeover = () => {
    setFsmState((prev) => {
      const next = !prev.isHumanTakeover;
      setMerchantAlerts((log) => [
        next
          ? 'Intervention Commerçant : L’agent IA se tait immédiatement.'
          : 'Reprise IA : L’agent reprend la supervision du dossier.',
        ...log.slice(0, 8),
      ]);
      return { ...prev, isHumanTakeover: next };
    });
  };

  // Réinitialisation
  const handleResetChat = () => {
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
      activeAudioElementRef.current = null;
    }
    setPlayingAudioId(null);
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    if (burstTimerRef.current) clearInterval(burstTimerRef.current);

    setMessages([]);
    setBurstQueue([]);
    setBurstSecondsLeft(0);
    setMerchantAlerts([]);

    setFsmState({
      stage: 'GREETING',
      pillars: {
        recipientName: null,
        occasion: null,
        senderName: null,
        storyAndMemories: null,
      },
      locks: {
        vocal1Sent: false,
        vocal2Sent: false,
        videoSampleSent: false,
        paymentBlockSent: false,
      },
      country: countryCode,
      clientProfile,
      selectedOffer: null,
      isHumanTakeover: false,
      lastTurnAt: Date.now(),
    });
  };

  // Envoi Fichier
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const caption =
      pendingAttachType === 'receipt'
        ? 'Voici le reçu de mon transfert de paiement'
        : 'Voici mes photos pour le montage vidéo souvenir';

    enqueueInboundText(caption, pendingAttachType, objectUrl);
    setIsAttachModalOpen(false);
  };

  const completedPillarsCount = Object.values(fsmState.pillars).filter(Boolean).length;

  return (
    <div className="w-full h-[100dvh] bg-[#050608] text-neutral-100 flex overflow-hidden font-sans select-none antialiased">
      {/* ── ZONE GAUCHE / PRINCIPALE : Interface WhatsApp Authentique (Plein Écran sur Tablette & Mobile) ── */}
      <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative overflow-hidden">
        {/* Entête WhatsApp Authentique */}
        <div className="h-16 px-3 sm:px-4 bg-[#202c33] border-b border-black/20 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-700/70 border border-emerald-400/40 flex items-center justify-center text-white text-sm font-semibold shadow-inner">
                {config.agentName.slice(0, 2).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#202c33]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-semibold text-sm sm:text-base text-[#e9edef] leading-tight">
                  {config.agentName}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/25 hidden xs:inline">
                  Velaris Studio
                </span>
              </div>
              <div className="text-[11px] text-[#8696a0] flex items-center gap-1.5 font-mono">
                {aiPresenceState === 'typing' ? (
                  <span className="text-emerald-400 animate-pulse font-sans font-medium">en train d’écrire…</span>
                ) : aiPresenceState === 'recording_audio' ? (
                  <span className="text-emerald-400 animate-pulse flex items-center gap-1 font-sans font-medium">
                    <Mic className="w-3 h-3 animate-bounce" /> enregistre un audio…
                  </span>
                ) : fsmState.isHumanTakeover ? (
                  <span className="text-amber-400 font-medium">Commerçant aux commandes</span>
                ) : (
                  <span>en ligne</span>
                )}
              </div>
            </div>
          </div>

          {/* Outils & Commandes d'Entête (Adaptés Tablette) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Badge d'État FSM & Brief (Cliquable pour ouvrir le Diagnostic sur Tablette/Mobile) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
              title="Ouvrir le panneau diagnostic FSM"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold hidden sm:inline">{fsmState.stage}</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-200 text-[10px] font-bold">
                {completedPillarsCount}/4
              </span>
            </button>

            {/* Mode Conseiller Humain */}
            <button
              onClick={toggleHumanTakeover}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                fsmState.isHumanTakeover
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.08]'
              }`}
              title="Simule le marchand qui prend le téléphone (l'IA se tait)"
            >
              <UserCheck className="w-4 h-4" />
              <span className="hidden md:inline">{fsmState.isHumanTakeover ? 'Commerçant actif' : 'Conseiller'}</span>
            </button>

            {/* Sélecteur de Scénario Rapide */}
            <div className="relative">
              <select
                onChange={(e) => {
                  const sc = SCENARIO_PRESETS.find((s) => s.id === e.target.value);
                  if (sc) loadScenario(sc);
                }}
                defaultValue=""
                className="bg-[#111b21] border border-white/[0.1] text-xs text-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500/50 max-w-[110px] sm:max-w-[160px] truncate"
              >
                <option value="" disabled>
                  Scénario…
                </option>
                {SCENARIO_PRESETS.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Copier la conversation */}
            <button
              onClick={handleCopyConversation}
              className={`p-2 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                isCopied
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border-white/[0.08]'
              }`}
              title="Copier toute la discussion pour analyse"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden lg:inline text-[11px]">{isCopied ? 'Copié !' : 'Copier'}</span>
            </button>

            {/* Réinitialiser */}
            <button
              onClick={handleResetChat}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.08] text-xs transition-colors"
              title="Réinitialiser la discussion"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Bouton Ouvrir Volet Diagnostic (visible sur Tablette & Desktop) */}
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`p-2 rounded-lg border text-xs transition-colors ${
                isDrawerOpen
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white'
              }`}
              title="Afficher/Masquer le panneau d'inspection"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zone des Messages (WhatsApp Stream) */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 bg-[#0b141a] bg-radial-[at_top] from-[#0f1d24] to-[#0b141a]"
        >
          {/* Bannière Déterministe */}
          <div className="flex justify-center my-1 sm:my-2">
            <div className="bg-[#182229] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-center max-w-md shadow-sm">
              <span className="text-[11px] text-emerald-200/90 font-mono flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                Simulateur Déterministe Velaris · FSM Active
              </span>
            </div>
          </div>

          {/* Liste des bulles de chat */}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[78%] md:max-w-[70%] rounded-2xl p-3 sm:p-3.5 shadow-md text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-xs border border-emerald-400/20'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-xs border border-white/[0.06]'
                }`}
              >
                {/* Image jointe */}
                {m.mediaKind === 'image' && m.mediaUrl && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                    <img src={m.mediaUrl} alt="Fichier joint" className="w-full max-h-64 object-cover" />
                    {m.attachmentKind && (
                      <div className="px-2.5 py-1 bg-black/60 text-[10px] font-mono text-emerald-300">
                        {m.attachmentKind === 'receipt' ? 'Reçu de paiement Wave / OM' : 'Photos pour le montage vidéo'}
                      </div>
                    )}
                  </div>
                )}

                {/* Vidéo Sample (Exemple Démo 3 000 F) */}
                {m.mediaKind === 'video' && m.mediaUrl && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-emerald-500/40 bg-black/80">
                    <video
                      src={m.mediaUrl}
                      controls
                      className="w-full max-h-80 rounded-lg bg-black"
                      preload="metadata"
                    />
                    <div className="p-2 bg-[#111b21] flex items-center justify-between text-xs text-neutral-300">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-emerald-400" /> Aperçu Montage Vidéo (Prestige)
                      </span>
                      <a
                        href={m.mediaUrl}
                        download="montage_sample.mp4"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        Télécharger
                      </a>
                    </div>
                  </div>
                )}

                {/* Lecteur Audio Natif WhatsApp */}
                {m.mediaKind === 'audio' && m.mediaUrl && (
                  <div className="my-1.5 p-3 rounded-xl bg-black/30 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => playNativeAudio(m.id, m.mediaUrl!)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                          playingAudioId === m.id
                            ? 'bg-emerald-400 text-black'
                            : 'bg-emerald-500 text-white hover:bg-emerald-400'
                        }`}
                      >
                        {playingAudioId === m.id ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5 fill-current" />
                        )}
                      </button>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1 h-6">
                          {[24, 38, 18, 44, 28, 36, 48, 22, 34, 42, 30, 20, 46, 32, 26, 40, 36, 24, 44, 30].map(
                            (h, idx) => (
                              <span
                                key={idx}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  playingAudioId === m.id ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'
                                }`}
                                style={{ height: `${h}px` }}
                              />
                            )
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                          <span>
                            {m.mediaDurationSec ? `0:${m.mediaDurationSec.toString().padStart(2, '0')}` : '0:33'}
                          </span>
                          <button
                            onClick={togglePlaybackRate}
                            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-emerald-300 text-[10px] font-bold"
                          >
                            {playbackRate}x
                          </button>
                        </div>
                      </div>
                    </div>

                    {m.isProcedureVoice && (
                      <div className="text-[10px] text-emerald-300 font-mono pt-1 border-t border-white/[0.08]">
                        Note vocale officielle de 33s (procédure studio)
                      </div>
                    )}
                  </div>
                )}

                {/* Transcription Whisper pour les vocaux utilisateurs */}
                {m.mediaTranscript && (
                  <details className="mt-1.5 text-xs text-neutral-300 bg-black/20 p-2 rounded-lg border border-white/[0.04]">
                    <summary className="cursor-pointer text-emerald-300 font-mono text-[11px] hover:underline">
                      Transcription Whisper VPS
                    </summary>
                    <p className="mt-1 text-neutral-200 font-sans italic">{m.mediaTranscript}</p>
                  </details>
                )}

                {/* Bloc Paiement Mobile Money */}
                {m.isPaymentBlock && (
                  <div className="my-2 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs font-mono space-y-1.5">
                    <div className="font-semibold text-emerald-300 flex items-center gap-1.5 text-[13px]">
                      <CreditCard className="w-4 h-4" /> Coordonnées Officielles
                    </div>
                    <p className="whitespace-pre-line text-neutral-200 font-sans text-xs pt-1">{m.content}</p>
                  </div>
                )}

                {/* Texte de la bulle */}
                {!m.isPaymentBlock && !m.mediaTranscript && (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}

                {/* Horodatage & Statut d'envoi */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-neutral-400 font-mono">
                  <span>{m.timestamp}</span>
                  {m.role === 'user' && (
                    <span className="inline-flex items-center ml-0.5">
                      {m.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      ) : m.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-neutral-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Bulle de présence en direct de l'agent */}
          {aiPresenceState !== 'idle' && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 bg-[#202c33] text-[#e9edef] border border-white/[0.06] rounded-tl-xs flex items-center gap-2 text-xs">
                {aiPresenceState === 'recording_audio' ? (
                  <>
                    <Mic className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                    <span className="text-emerald-400 font-medium font-mono">
                      {config.agentName} enregistre un message vocal…
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse delay-100" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse delay-200" />
                    </span>
                    <span className="text-neutral-300 font-mono text-[11px]">
                      {config.agentName} est en train d’écrire…
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── BARRE DE RAFALE EN COURS (Visual Debounce 40s) ── */}
        {burstQueue.length > 0 && (
          <div className="h-11 bg-[#182229] border-t border-emerald-500/30 px-3 sm:px-4 flex items-center justify-between text-xs shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-emerald-400 font-mono truncate mr-2">
              <Clock className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
              <span className="truncate">
                Délai de réponse WhatsApp : <strong>{burstSecondsLeft}s</strong> ({burstQueue.length} msg)
              </span>
            </div>
            <button
              onClick={forceFlushNow}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
              title="Court-circuiter le délai et obtenir la réponse de suite"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Répondre de suite</span>
            </button>
          </div>
        )}

        {/* ── BARRE INFÉRIEURE : Saisie, Micro PTT & Trombone ── */}
        <div className="p-2.5 sm:p-3 bg-[#202c33] border-t border-black/20 flex items-center gap-2 shrink-0 pb-safe">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            className="hidden"
          />

          <button
            onClick={() => setIsAttachModalOpen(true)}
            className="p-2.5 rounded-full text-[#8696a0] hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Joindre une photo ou un reçu de paiement"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isRecording ? 'Enregistrement en cours…' : 'Écrire un message…'}
              disabled={isRecording || isAiThinking}
              className="w-full h-11 px-4 rounded-xl bg-[#2a3942] border border-transparent focus:border-emerald-500/40 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none transition-all font-sans"
            />
          </div>

          {input.trim() ? (
            <button
              onClick={handleSendMessage}
              disabled={isAiThinking}
              className="w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              <Send className="w-5 h-5 ml-0.5 fill-current" />
            </button>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="h-11 px-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 shrink-0 animate-pulse shadow-lg cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span className="font-mono text-xs font-bold">0:{recordSeconds.toString().padStart(2, '0')}</span>
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={isAiThinking || isTranscribing}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                isTranscribing
                  ? 'bg-neutral-700 text-neutral-400 cursor-wait'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
              }`}
              title="Enregistrer un message vocal réel (Whisper VPS)"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── ZONE DROITE : Cockpit Diagnostic Réactif (Slide-over sur Tablette / Fixe sur Grand Écran) ── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 lg:static lg:inset-auto z-50 flex justify-end">
          {/* Backdrop sombre sur Tablette / Mobile */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs lg:hidden"
          />

          {/* Panneau Latéral Cockpit */}
          <div className="relative w-full sm:w-[400px] lg:w-96 h-full bg-[#08090C] border-l border-white/[0.08] flex flex-col shadow-2xl z-10 overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header Cockpit */}
            <div className="h-16 border-b border-white/[0.08] bg-[#0E1015] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-sm text-white">Diagnostic & État FSM</span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Onglets Navigation Cockpit */}
            <div className="h-11 border-b border-white/[0.06] bg-[#0A0C10] px-3 flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setInspectorTab('fsm')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  inspectorTab === 'fsm'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" /> FSM & Brief
              </button>
              <button
                onClick={() => setInspectorTab('tariffs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  inspectorTab === 'tariffs'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Tarifs
              </button>
              <button
                onClick={() => setInspectorTab('log')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  inspectorTab === 'log'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Journal
              </button>
            </div>

            {/* Contenu Défilant Cockpit */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* ── ONGLET 1 : FSM & Les 4 Invariants ── */}
              {inspectorTab === 'fsm' && (
                <div className="space-y-4">
                  {/* Badge Étape FSM */}
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/[0.08] space-y-1.5">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Étape Machine à États
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-emerald-400">{fsmState.stage}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Déterministe
                      </span>
                    </div>
                  </div>

                  {/* Checklist des 4 Invariants */}
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Les 4 Invariants du Brief
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">{completedPillarsCount}/4 Validés</span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-400 block">1. Personne à célébrer</span>
                          <span className="font-medium text-white">
                            {fsmState.pillars.recipientName || (
                              <span className="text-amber-400/80 italic font-mono text-[11px]">En attente…</span>
                            )}
                          </span>
                        </div>
                        {fsmState.pillars.recipientName ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-400 block">2. Occasion / Date</span>
                          <span className="font-medium text-white">
                            {fsmState.pillars.occasion || (
                              <span className="text-amber-400/80 italic font-mono text-[11px]">En attente…</span>
                            )}
                          </span>
                        </div>
                        {fsmState.pillars.occasion ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-400 block">3. Expéditeur</span>
                          <span className="font-medium text-white">
                            {fsmState.pillars.senderName || (
                              <span className="text-amber-400/80 italic font-mono text-[11px]">En attente…</span>
                            )}
                          </span>
                        </div>
                        {fsmState.pillars.senderName ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-400 block">4. Anecdotes / Paroles</span>
                          <span className="font-medium text-white truncate max-w-[170px] block">
                            {fsmState.pillars.storyAndMemories || (
                              <span className="text-amber-400/80 italic font-mono text-[11px]">En attente…</span>
                            )}
                          </span>
                        </div>
                        {fsmState.pillars.storyAndMemories ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Verrous d'Unicité Matériels */}
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/[0.08] space-y-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" /> Verrous d'Unicité Matériels
                    </span>

                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-400">Vocal 1 (Cadrage d'accueil) :</span>
                        <span className={fsmState.locks.vocal1Sent ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                          {fsmState.locks.vocal1Sent ? 'Délivré' : 'En attente'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                        <span className="text-neutral-400">Vocal 2 (Procédure 33s) :</span>
                        <span className={fsmState.locks.vocal2Sent ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                          {fsmState.locks.vocal2Sent ? 'Verrouillé (Unique)' : 'En attente 4/4'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-neutral-400">Vidéo Sample Démo :</span>
                        <span
                          className={fsmState.locks.videoSampleSent ? 'text-emerald-400 font-bold' : 'text-neutral-500'}
                        >
                          {fsmState.locks.videoSampleSent ? 'Envoyé' : 'Non demandé'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Paramètres de Ligne Client */}
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Ligne Client du Test</span>
                      <span className="text-[11px] font-mono text-emerald-400">{clientPhone}</span>
                    </div>
                    <div className="text-[11px] text-neutral-300 font-medium pb-1 border-b border-white/[0.04]">
                      {clientName}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-1">Pays / Indicatif</label>
                        <select
                          value={countryCode}
                          onChange={(e) => handleCountryChange(e.target.value as any)}
                          className="w-full bg-[#111b21] border border-white/[0.08] text-xs text-white rounded-lg p-2 focus:outline-none"
                        >
                          <option value="BF">🇧🇫 Burkina Faso (+226 Orange Money)</option>
                          <option value="CI">🇨🇮 Côte d’Ivoire (+225 Wave)</option>
                          <option value="SN">🇸🇳 Sénégal (+221 Wave)</option>
                          <option value="OTHER">🌍 International / Diaspora (Chariow)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-1">Profil Client</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleProfileChange('new')}
                            className={`p-2 rounded-lg text-xs font-semibold border ${
                              clientProfile === 'new'
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-black/30 border-white/[0.06] text-neutral-400'
                            }`}
                          >
                            Nouveau Client
                          </button>
                          <button
                            onClick={() => handleProfileChange('returning')}
                            className={`p-2 rounded-lg text-xs font-semibold border ${
                              clientProfile === 'returning'
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-black/30 border-white/[0.06] text-neutral-400'
                            }`}
                          >
                            Ancien Client 😊
                          </button>
                        </div>
                      </div>

                      {/* Délai de Réponse WhatsApp */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-neutral-400">Délai de Réponse Conseiller</label>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">{responseDelaySec}s</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { sec: 40, label: '40s Réel' },
                            { sec: 20, label: '20s Modéré' },
                            { sec: 5, label: '5s Express' },
                          ].map((d) => (
                            <button
                              key={d.sec}
                              onClick={() => setResponseDelaySec(d.sec)}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-colors cursor-pointer ${
                                responseDelaySec === d.sec
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold'
                                  : 'bg-black/30 border-white/[0.06] text-neutral-400 hover:text-white'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ONGLET 2 : Tarifs & Coordonnées ── */}
              {inspectorTab === 'tariffs' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/[0.08] space-y-3">
                    <span className="font-semibold text-white">Grille Tarifaire Velaris</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                        <span className="text-[10px] text-neutral-400 block">Formule Découverte</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">1 200 F CFA</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">2 versions audio HD</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                        <span className="text-[10px] text-neutral-400 block">Formule Prestige</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">3 000 F CFA</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">Audio + Montage Vidéo</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/[0.08] space-y-3">
                    <span className="font-semibold text-white">Coordonnées Mobile Money</span>
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1">
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                          🇧🇫 Orange Money Burkina
                        </span>
                        <p className="text-xs text-white font-mono">{config.payment.orangeMoneyBf}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1">
                        <span className="text-[10px] text-sky-400 font-semibold uppercase">🇨🇮 Wave Côte d’Ivoire</span>
                        <p className="text-xs text-white font-mono">{config.payment.waveCi}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1">
                        <span className="text-[10px] text-amber-400 font-semibold uppercase">
                          🌍 Chariow (International)
                        </span>
                        <p className="text-[11px] text-neutral-300 font-mono break-all">
                          https://chansons-perso.mychariow.shop/digital-starter/checkout
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ONGLET 3 : Journal des Décisions ── */}
              {inspectorTab === 'log' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#0E1015] border border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Journal du Banc d'Essai</span>
                      <span className="text-[11px] font-mono text-emerald-400">{latencyMs} ms</span>
                    </div>

                    {merchantAlerts.length === 0 ? (
                      <p className="text-neutral-500 italic text-[11px]">Aucun événement pour l'instant.</p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {merchantAlerts.map((alt, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-[11px] text-neutral-300 leading-relaxed"
                          >
                            {alt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE PIÈCES JOINTES ── */}
      {isAttachModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0E1015] border border-white/[0.08] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="font-semibold text-sm text-white">Envoyer une pièce jointe</span>
              <button
                onClick={() => setIsAttachModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setPendingAttachType('photo');
                  fileInputRef.current?.click();
                }}
                className="w-full p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center gap-3 text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium text-white block">Photos souvenirs</span>
                  <span className="text-[11px] text-neutral-400">Pour le montage vidéo à 3 000 F</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setPendingAttachType('receipt');
                  fileInputRef.current?.click();
                }}
                className="w-full p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center gap-3 text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium text-white block">Reçu de paiement</span>
                  <span className="text-[11px] text-neutral-400">Capture d'écran Wave ou Orange Money</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
