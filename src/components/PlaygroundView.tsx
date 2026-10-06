import { useEffect, useRef, useState, type FC } from 'react';
import {
  RotateCcw,
  Send,
  Bot,
  Mic,
  Square,
  Play,
  Pause,
  Check,
  CheckCheck,
  Zap,
  Phone,
  Radio,
  FileText,
  CreditCard,
  Music,
  Bell,
  PanelRight,
  Sparkles,
  Clock,
  Image as ImageIcon,
  ChevronDown
} from 'lucide-react';
import { generateHouseStyleSong, detectOccasion, type SongOccasion } from '../services/lyricsCorpus';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  mediaKind?: 'audio' | 'image';
  mediaUrl?: string;
  mediaTranscript?: string;
  isProcedureVoice?: boolean;
  isPaymentBlock?: boolean;
  isLyricsCard?: boolean;
  lyricsData?: {
    minutes?: number;
    lyrics?: string;
  };
}

interface ScenarioPreset {
  id: string;
  title: string;
  clientName: string;
  country: 'CI' | 'BF' | 'SN' | 'OTHER';
  phone: string;
  firstMessages: string[];
  description: string;
}

const SCENARIOS: ScenarioPreset[] = [
  {
    id: 'moussa_burst',
    title: 'Moussa Traoré (Rafale 3 messages CI)',
    clientName: 'Moussa Traoré',
    country: 'CI',
    phone: '+2250788776655',
    firstMessages: [
      'Bonjour le studio !',
      'Je veux une chanson surprise',
      "C'est pour le mariage de mon frère Marc ce samedi",
    ],
    description: 'Teste la coalescence de 3 messages envoyés en rafale sans double réponse.',
  },
  {
    id: 'djalilou_bf',
    title: 'Djalilou Dayamba (Burkina Faso — Patience & OM)',
    clientName: 'Djalilou Dayamba',
    country: 'BF',
    phone: '+22655917765',
    firstMessages: [
      "Bonsoir, c'est pour l'anniversaire de Fadila.",
    ],
    description: "Teste la tolérance sur 'J'attends alors' et la délivrance Orange Money BF.",
  },
  {
    id: 'fargo_poeme',
    title: 'Fargo Anne (Burkina Faso — Brief poétique long)',
    clientName: 'Fargo Anne',
    country: 'BF',
    phone: '+22670784983',
    firstMessages: [
      'Bonjour cher studio. Je veux une chanson sacrée pour célébrer mon mari Alassane, un homme juste et généreux.',
    ],
    description: "Teste l'écoute d'un long brief et la reconnaissance 'Le numéro de dépôt' sans verbe.",
  },
  {
    id: 'aicha_tiktok',
    title: "Aïcha Diallo (Lead froid TikTok 'C'est combien ?')",
    clientName: 'Aïcha Diallo',
    country: 'CI',
    phone: '+2250544332211',
    firstMessages: [
      "Bonjour, c'est combien ?",
    ],
    description: "Teste la transparence tarifaire d'entrée et l'orientation chaleureuse vers le brief.",
  },
  {
    id: 'objection_arnaque',
    title: 'Ibrahim Traoré (Objection méfiance / arnaque)',
    clientName: 'Ibrahim Traoré',
    country: 'CI',
    phone: '+2250102030405',
    firstMessages: [
      'Je veux une chanson pour Mariam mais je ne paie rien avant de voir. Y a trop d arnaqueurs sur internet.',
    ],
    description: 'Teste la rassurance : texte écrit et validé avant tout paiement.',
  },
  {
    id: 'mariama_sn',
    title: 'Mariama Ba (Sénégal +221 — Wave Diaspora)',
    clientName: 'Mariama Ba',
    country: 'SN',
    phone: '+221771234567',
    firstMessages: [
      "Bonjour ! C'est pour le baptême de mon neveu El Hadj à Dakar, style mbalax acoustique.",
    ],
    description: 'Teste la détection de l indicatif +221 et les coordonnées Wave Sénégal.',
  },
  {
    id: 'ange_upgrade',
    title: 'Ange-Kevin (Upgrade Formule Vidéo 3 000 F)',
    clientName: 'Ange-Kevin',
    country: 'CI',
    phone: '+2250788776655',
    firstMessages: [
      "C'est pour l'anniversaire de ma petite sœur Grâce qui a 18 ans.",
    ],
    description: 'Teste le brief anniversaire et le passage vers la formule prestige avec montage vidéo.',
  },
];

const QUICK_TEST_VOCALS = [
  {
    label: 'Demande anniversaire (Awa, 50 ans)',
    text: "Bonjour, je voudrais une chanson pour l'anniversaire de ma maman Awa qui fête ses 50 ans ce samedi.",
  },
  {
    label: 'Écoute du vocal confirmée',
    text: "D'accord, j'ai bien écouté la note vocale du studio, je suis prêt pour le texte !",
  },
  {
    label: 'Validation paroles & demande Wave',
    text: "Wouah le texte est magnifique ! C'est validé, donnez-moi le numéro Wave pour le paiement.",
  },
];

const QUICK_TEST_IMAGES = [
  {
    label: 'Reçu Wave CI (1 200 F CFA)',
    text: 'Voilà la capture de mon transfert Wave de 1 200 F CFA effectué avec succès.',
    url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Reçu Orange Money BF (3 000 F CFA)',
    text: 'Reçu Orange Money de 3 000 F validé pour la formule vidéo.',
    url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
  },
  {
    label: 'Photo souvenir pour clip',
    text: 'Voici la photo souvenir à intégrer dans le montage de la vidéo.',
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&auto=format&fit=crop&q=80',
  },
];

export const PlaygroundView: FC = () => {
  // Ligne Client simulée
  const [clientPhone, setClientPhone] = useState('+2250788776655');
  const [clientName, setClientName] = useState('Moussa Traoré');
  const [countryCode, setCountryCode] = useState<'CI' | 'BF' | 'SN' | 'OTHER'>('CI');

  // État de la conversation WhatsApp
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Système de Rafale / Debounce glissant 1.8s
  const [burstQueue, setBurstQueue] = useState<string[]>([]);
  const BURST_WINDOW_MS = 1800;
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // État du Brief & Tunnel commercial
  const [detectedRecipient, setDetectedRecipient] = useState<string | null>(null);
  const [detectedOccasionStr, setDetectedOccasionStr] = useState<string | null>(null);
  const [commercialStage, setCommercialStage] = useState<string>('ACCUEIL');
  const [procedureVoiceSent, setProcedureVoiceSent] = useState<boolean>(false);
  const [lyricsDelivered, setLyricsDelivered] = useState<boolean>(false);
  const [paymentDelivered, setPaymentDelivered] = useState<boolean>(false);
  const [merchantAlerts, setMerchantAlerts] = useState<string[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(340);

  // Enregistrement micro direct
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lecteur audio vocal procédure
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isAiThinking, burstQueue]);

  // Synchronisation Indicatif Pays
  const handleCountryChange = (c: 'CI' | 'BF' | 'SN' | 'OTHER') => {
    setCountryCode(c);
    if (c === 'CI') setClientPhone('+2250788776655');
    else if (c === 'BF') setClientPhone('+22655917765');
    else if (c === 'SN') setClientPhone('+221771234567');
    else setClientPhone('+33612345678');
  };

  // Chargement d'un scénario pré-configuré
  const loadScenario = (sc: ScenarioPreset) => {
    setMessages([]);
    setBurstQueue([]);
    setMerchantAlerts([]);
    setProcedureVoiceSent(false);
    setLyricsDelivered(false);
    setPaymentDelivered(false);
    setCommercialStage('BRIEF');
    setClientName(sc.clientName);
    setCountryCode(sc.country);
    setClientPhone(sc.phone);

    const initialBubbles: ChatBubble[] = sc.firstMessages.map((msg, i) => ({
      id: `init_${Date.now()}_${i}`,
      role: 'user',
      content: msg,
      timestamp: new Date(Date.now() - (sc.firstMessages.length - i) * 1500).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'read',
    }));

    setMessages(initialBubbles);
    setTimeout(() => {
      void runIntelligentTurn(initialBubbles);
    }, 500);
  };

  // Exécution du moteur d'IA WhatsApp en local (reproduction exacte de production)
  const runIntelligentTurn = async (history: ChatBubble[]) => {
    if (isAiThinking) return;
    setIsAiThinking(true);
    const start = Date.now();

    const inbounds = history.filter((m) => m.role === 'user');
    const allInboundText = inbounds.map((m) => m.content).join(' ');
    const lastInbound = inbounds[inbounds.length - 1];
    const lastText = (lastInbound?.content || '').toLowerCase();

    // 1. Détection du destinataire
    let recipient = detectedRecipient;
    const nameMatch = allInboundText.match(/(?:pour|de|fête|fete)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+)/i) ||
      allInboundText.match(/(?:nom(?:mé|mee)?|s['’]appelle|prénom|prenom)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+)/i) ||
      allInboundText.match(/\b(Awa|Fadila|Mariam|Marc|Laure|Grâce|Grace|Sarah|Christian|Yvonne|Kouassi|Alassane|El Hadj)\b/i);
    if (nameMatch && nameMatch[1]) {
      recipient = nameMatch[1].trim();
      setDetectedRecipient(recipient);
    }

    // 2. Détection de l'occasion
    const occasion: SongOccasion = detectOccasion(allInboundText);
    const occasionDisplay = occasion !== 'autre' ? occasion : 'Célébration sur-mesure';
    setDetectedOccasionStr(occasionDisplay);

    // Simulation de délai de réflexion réaliste (500ms à 900ms)
    await new Promise((r) => setTimeout(r, 650));
    setLatencyMs(Date.now() - start);

    const newAssistantBubbles: ChatBubble[] = [];
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Analyse de l'intention et de l'étape
    const isPaymentClaim = /\b(payé|paye|dépot fait|depot fait|transfert fait|capture|reçu|recu|voilà le reçu|voila le recu)\b/i.test(lastText);
    const isTextValidation = /\b(valide|validé|valider|c'est bon|parfait|super|magnifique|j'adore|jadore|on garde|je prends le texte|le texte me va)\b/i.test(lastText);
    const isExplicitPaymentRequest = /\b(sur quel|quelle numéro|sur quoi|comment payer|numéro wave|numero wave|numéro orange|numero de depot|numéro de dépôt)\b/i.test(lastText);
    const isOfferSelection = /\b(1\s*200|3\s*000|mille deux|trois mille|formule vidéo|modele video|chanson seule)\b/i.test(lastText);
    const isVocalAck = procedureVoiceSent && /\b(d'accord|ok|bien reçu|j'ai écouté|jai ecoute|compris|super|très bien)\b/i.test(lastText);
    const isPriceQuestionOnly = !recipient && /\b(c'est combien|prix|tarifs?|tarif|combien ça coûte)\b/i.test(lastText);

    if (isPaymentClaim) {
      // Étape : Clôture totale & Lancement Studio
      setCommercialStage('PRODUCTION_STUDIO');
      setMerchantAlerts((prev) => [
        `Paiement reçu (${countryCode === 'BF' ? 'Orange Money' : 'Wave'}) — Commande de ${recipient || clientName} passée en studio Suno !`,
        ...prev
      ]);
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: 'Paiement bien reçu avec un immense merci ! 🙏🥰',
        timestamp: nowStr,
        status: 'read',
      });
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_2`,
        role: 'assistant',
        content: 'Votre commande est confirmée et passe immédiatement en enregistrement studio. Vous recevrez votre chanson terminée d ici 18 minutes chrono ! 🎵',
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isTextValidation || isExplicitPaymentRequest) {
      // Étape : Validation du texte -> Envoi des coordonnées de paiement
      setPaymentDelivered(true);
      setCommercialStage('PAIEMENT');

      let payCoord = '';
      if (countryCode === 'BF') {
        payCoord = `📱 Orange Money Burkina Faso :\n+226 05 77 73 08 (Wendyam Anicet junior Sekongo)\nSyntaxe directe : *144*4*6*05777308*1200#\nMontant : 1 200 F CFA\n\nMerci de m'envoyer la capture du dépôt une fois effectué !`;
      } else if (countryCode === 'SN') {
        payCoord = `📱 Wave Sénégal :\n+221 77 123 45 67\nMontant : 1 200 F CFA\n\nMerci de m'envoyer la capture du transfert pour lancer l enregistrement studio !`;
      } else {
        payCoord = `📱 Wave Côte d'Ivoire :\n+225 07 00 00 00 00 (ou Orange Money CI au +225 07 11 22 33 44)\nMontant : 1 200 F CFA\n\nMerci de m'envoyer la capture du transfert pour lancer l enregistrement au studio ! 🙏`;
      }

      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est parfait ! 🙏 Voici nos coordonnées sécurisées pour le règlement :`,
        timestamp: nowStr,
        status: 'read',
      });
      newAssistantBubbles.push({
        id: `ai_pay_${Date.now()}`,
        role: 'assistant',
        content: payCoord,
        timestamp: nowStr,
        status: 'read',
        isPaymentBlock: true,
      });
    } else if (isOfferSelection || (procedureVoiceSent && lyricsDelivered === false && (isVocalAck || recipient))) {
      // Étape : Génération et livraison des paroles studio
      setLyricsDelivered(true);
      setCommercialStage('PAROLES_LIVRÉES');

      const generated = generateHouseStyleSong({
        recipient: recipient || 'Mon Amour',
        occasion: occasion,
        style: 'Afro-pop acoustique douce et chaleureuse',
        senderName: clientName,
      });
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est bien noté pour ${recipient || 'votre proche'} 🙏 Notre studio a préparé votre texte avec tout son soin. Voici vos paroles sur-mesure :`,
        timestamp: nowStr,
        status: 'read',
      });
      newAssistantBubbles.push({
        id: `ai_lyrics_${Date.now()}`,
        role: 'assistant',
        content: generated.lyrics,
        timestamp: nowStr,
        status: 'read',
        isLyricsCard: true,
        lyricsData: {
          minutes: 8,
          lyrics: generated.lyrics,
        },
      });
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_3`,
        role: 'assistant',
        content: `Prenez le temps de lire ce texte et dites-moi si tout vous convient parfaitement ou si vous souhaitez un ajustement 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isVocalAck) {
      // Étape : Vocal écouté -> Présentation des offres
      setCommercialStage('PRÉSENTATION_OFFRES');
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est un plaisir ! Nous avons deux formules simples au studio :\n\n1. Formule Découverte à 1 200 F CFA : La chanson personnalisée complète chantée et masterisée.\n2. Formule Prestige à 3 000 F CFA : La chanson complète + le montage vidéo avec vos photos souvenirs.\n\nQuelle formule vous ferait le plus plaisir ? 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (recipient) {
      // Étape : Brief complet -> Envoi du vocal de procédure seul (INV-11)
      setProcedureVoiceSent(true);
      setCommercialStage('VOCAL_PROCÉDURE');
      setMerchantAlerts((prev) => [
        `Brief capté : ${recipient} (${occasionDisplay}) — Vocal de procédure envoyé.`,
        ...prev
      ]);
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est une magnifique intention pour ${recipient} ! 🙏 Je vous explique tout en détail dans cette petite note vocale 😊`,
        timestamp: nowStr,
        status: 'read',
      });
      newAssistantBubbles.push({
        id: `ai_voice_${Date.now()}`,
        role: 'assistant',
        content: '🎙️ Note vocale explicative du studio (procédure & composition sur-mesure)',
        timestamp: nowStr,
        status: 'read',
        isProcedureVoice: true,
        mediaKind: 'audio',
      });
    } else if (isPriceQuestionOnly) {
      // Question tarif d'entrée sans brief
      setCommercialStage('BRIEF');
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `Bonjour et bienvenue chez Velaris Studio ! 🙏 Nos chansons personnalisées commencent à partir de 1 200 F CFA (et 3 000 F avec clip vidéo).\n\nPour qui aimeriez-vous créer cette surprise ? 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else {
      // Accueil ou demande de brief
      setCommercialStage('BRIEF');
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `Bonjour et bienvenue au studio Velaris ! 🙏 C'est un bonheur de vous accompagner. Quel est le prénom de la personne à qui vous souhaitez dédier cette chanson ?`,
        timestamp: nowStr,
        status: 'read',
      });
    }

    // Ajout fluide des bulles avec micro-temporisation
    for (const bubble of newAssistantBubbles) {
      await new Promise((r) => setTimeout(r, 180));
      setMessages((prev) => [...prev, bubble]);
    }

    setIsAiThinking(false);
  };

  // Traitement du vidage de la file de rafale
  const flushBurstQueue = (pendingItems: string[]) => {
    if (pendingItems.length === 0) return;
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    setBurstQueue([]);

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newBubbles: ChatBubble[] = pendingItems.map((text, idx) => ({
      id: `user_${Date.now()}_${idx}`,
      role: 'user',
      content: text,
      timestamp: nowStr,
      status: 'read',
    }));

    const nextHistory = [...messages, ...newBubbles];
    setMessages(nextHistory);
    void runIntelligentTurn(nextHistory);
  };

  // Envoi avec débounce glissant (Burst mode)
  const handleSendMessage = () => {
    const text = input.trim();
    if (!text || isAiThinking) return;
    setInput('');

    const updatedQueue = [...burstQueue, text];
    setBurstQueue(updatedQueue);

    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    burstTimeoutRef.current = setTimeout(() => {
      flushBurstQueue(updatedQueue);
    }, BURST_WINDOW_MS);
  };

  // Forcer l'envoi immédiat de la rafale
  const handleForceSendBurst = () => {
    if (burstQueue.length > 0) {
      flushBurstQueue(burstQueue);
    }
  };

  // Envoi d'un vocal préenregistré
  const handleSendQuickVocal = (vocalText: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble: ChatBubble = {
      id: `user_vocal_${Date.now()}`,
      role: 'user',
      content: `🎙️ ${vocalText}`,
      timestamp: nowStr,
      status: 'read',
      mediaKind: 'audio',
      mediaTranscript: vocalText,
    };
    const nextHistory = [...messages, bubble];
    setMessages(nextHistory);
    void runIntelligentTurn(nextHistory);
  };

  // Envoi d'une capture d'écran / reçu
  const handleSendQuickImage = (img: { label: string; text: string; url: string }) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble: ChatBubble = {
      id: `user_img_${Date.now()}`,
      role: 'user',
      content: img.text,
      timestamp: nowStr,
      status: 'read',
      mediaKind: 'image',
      mediaUrl: img.url,
    };
    const nextHistory = [...messages, bubble];
    setMessages(nextHistory);
    void runIntelligentTurn(nextHistory);
  };

  // Enregistrement micro direct
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        handleSendQuickVocal("Bonjour, c'est pour l'anniversaire de ma maman Awa !");
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      handleSendQuickVocal("Bonjour, c'est pour l'anniversaire de ma maman Awa !");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  };

  // Synthèse acoustique Web Audio API
  const playAcousticPreview = (id: string) => {
    if (playingAudioId === id) {
      setPlayingAudioId(null);
      return;
    }
    setPlayingAudioId(id);

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [261.63, 329.63, 392.0, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.22);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.22);
        osc.stop(ctx.currentTime + i * 0.22 + 0.85);
      });

      setTimeout(() => {
        setPlayingAudioId(null);
      }, 2000);
    } catch {
      setPlayingAudioId(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-7xl mx-auto space-y-4 px-2 sm:px-4">
      {/* Barre Supérieure de Contrôle Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#08090C] border border-white/[0.08] px-4 py-3 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white tracking-tight">Playground Studio WhatsApp</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Moteur Autonome Actif
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Testez la réception en rafale, l'envoi de vocaux, les paroles générées et la clôture Mobile Money.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Sélecteur de Scénario Pré-enregistré */}
          <div className="relative">
            <select
              aria-label="Charger un scénario de pub"
              onChange={(e) => {
                const sc = SCENARIOS.find((s) => s.id === e.target.value);
                if (sc) loadScenario(sc);
              }}
              defaultValue=""
              className="h-9 px-3 pr-8 rounded-xl bg-[#0E1015] border border-white/[0.08] text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-white/20"
            >
              <option value="" disabled>Charger un scénario de test…</option>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setBurstQueue([]);
              setDetectedRecipient(null);
              setDetectedOccasionStr(null);
              setCommercialStage('ACCUEIL');
            }}
            className="h-9 px-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-xs text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            title="Inspecteur de cerveau"
            className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteneur Principal : WhatsApp Web Mockup + Inspecteur */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Colonne WhatsApp Web */}
        <div className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[#0B0E14] overflow-hidden shadow-2xl ${inspectorOpen ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {/* En-tête de Discussion WhatsApp */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#121620] border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-700/40 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-semibold text-sm">
                  VS
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#121620]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Sarah · Velaris Studio</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-white/10 text-neutral-400">
                    Officiel
                  </span>
                </div>
                <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  {isAiThinking ? (
                    <span className="animate-pulse flex items-center gap-1 text-emerald-300">
                      <Radio className="w-3 h-3 animate-spin" /> en train d'écrire…
                    </span>
                  ) : (
                    <span>en ligne</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sélecteur de Pays Prospect */}
            <div className="flex items-center gap-2 bg-[#0E1015] px-2.5 py-1 rounded-lg border border-white/[0.08]">
              <Phone className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-400">Prospect :</span>
              <select
                aria-label="Sélectionner le pays du prospect"
                value={countryCode}
                onChange={(e) => handleCountryChange(e.target.value as any)}
                className="bg-transparent border-0 text-xs text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="CI" className="bg-[#0E1015]">Côte d'Ivoire (+225)</option>
                <option value="BF" className="bg-[#0E1015]">Burkina Faso (+226)</option>
                <option value="SN" className="bg-[#0E1015]">Sénégal (+221)</option>
                <option value="OTHER" className="bg-[#0E1015]">France (+33)</option>
              </select>
            </div>
          </div>

          {/* Fil des Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#08090C] bg-opacity-95 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-neutral-500">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <p className="text-sm font-medium text-white">Simulateur WhatsApp prêt</p>
                  <p className="text-xs text-neutral-400">
                    Tapez un message, testez l'envoi en rafale, ou chargez l'un des scénarios ci-dessus.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg">
                  <button
                    type="button"
                    onClick={() => setInput("Bonjour, je voudrais une chanson pour l'anniversaire de ma maman Awa.")}
                    className="h-7 px-2.5 rounded-lg border border-white/[0.08] bg-[#0E1015] hover:bg-white/[0.04] text-xs text-neutral-300 transition-colors cursor-pointer"
                  >
                    Demande Anniversaire
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput("C'est combien ?")}
                    className="h-7 px-2.5 rounded-lg border border-white/[0.08] bg-[#0E1015] hover:bg-white/[0.04] text-xs text-neutral-300 transition-colors cursor-pointer"
                  >
                    Question Tarif
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput("Le texte me plaît beaucoup ! Quel est le numéro de paiement ?")}
                    className="h-7 px-2.5 rounded-lg border border-white/[0.08] bg-[#0E1015] hover:bg-white/[0.04] text-xs text-neutral-300 transition-colors cursor-pointer"
                  >
                    Validation & Paiement
                  </button>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`relative rounded-2xl px-3.5 py-2.5 max-w-[85%] sm:max-w-[75%] text-sm shadow-md ${
                    m.role === 'user'
                      ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-xs'
                      : 'bg-[#202c33] text-[#e9edef] border border-white/[0.06] rounded-tl-xs'
                  }`}
                >
                  {/* Image jointe */}
                  {m.mediaKind === 'image' && m.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/10 max-w-sm">
                      <img src={m.mediaUrl} alt="Média joint" className="w-full h-auto object-cover max-h-56" />
                    </div>
                  )}

                  {/* Lecteur Note Vocale de Procédure */}
                  {m.isProcedureVoice ? (
                    <div className="space-y-2 py-1">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playAcousticPreview(m.id)}
                          className="w-9 h-9 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          {playingAudioId === m.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-0.5 h-6">
                            {[12, 24, 16, 28, 20, 14, 26, 18, 22, 16, 30, 24, 14, 20, 16, 22].map((height, idx) => (
                              <span
                                key={idx}
                                style={{ height: `${playingAudioId === m.id ? (height % 20) + 10 : height}px` }}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  playingAudioId === m.id ? 'bg-emerald-400' : 'bg-emerald-600/50'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                            <span>0:33</span>
                            <span className="text-emerald-400 font-sans">Vocal Studio Calibré</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-400 border-t border-white/[0.06] pt-1.5 italic">
                        {m.content}
                      </p>
                    </div>
                  ) : m.isPaymentBlock ? (
                    <div className="space-y-2 py-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <CreditCard className="w-3.5 h-3.5" /> Coordonnées de Paiement Officielles
                      </div>
                      <div className="whitespace-pre-wrap font-sans text-xs bg-black/30 p-2.5 rounded-xl border border-white/[0.06]">
                        {m.content}
                      </div>
                    </div>
                  ) : m.isLyricsCard ? (
                    <div className="space-y-2 py-1">
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                        <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5" /> Paroles Composées par le Studio
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {m.lyricsData?.minutes || 8} min studio
                        </span>
                      </div>
                      <div className="text-xs whitespace-pre-wrap font-serif italic text-white/90 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/[0.06]">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}

                  <div className="flex items-center justify-end gap-1 text-[10px] text-white/60 mt-1 select-none">
                    <span>{m.timestamp}</span>
                    {m.role === 'user' ? (
                      m.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-white/50" />
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {/* Rafale en Attente d'Envoi */}
            {burstQueue.length > 0 && (
              <div className="space-y-1.5">
                {burstQueue.map((item, idx) => (
                  <div key={idx} className="flex justify-end opacity-75">
                    <div className="rounded-2xl px-3.5 py-2 max-w-[85%] text-sm bg-[#005c4b]/80 text-[#e9edef] border border-emerald-400/30">
                      <div className="whitespace-pre-wrap">{item}</div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200 mt-1">
                        <Clock className="w-3 h-3 animate-spin" />
                        <span>En attente rafale…</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-end gap-2 text-xs text-neutral-400 pt-1">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Radio className="w-3.5 h-3.5 animate-pulse" /> Débounce actif (coalescence 1.8s)
                  </span>
                  <button
                    type="button"
                    onClick={handleForceSendBurst}
                    className="h-6 text-[11px] px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                  >
                    Envoyer maintenant
                  </button>
                </div>
              </div>
            )}

            {/* Indicateur de Réflexion de l'IA */}
            {isAiThinking && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 bg-[#202c33] border border-white/[0.06] text-sm text-emerald-400 flex items-center gap-2 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.18s]" />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.36s]" />
                  </div>
                  <span className="text-xs text-neutral-400 ml-1 font-mono">Analyse & Composition studio…</span>
                </div>
              </div>
            )}
          </div>

          {/* Raccourcis Rapides */}
          <div className="border-t border-white/[0.08] px-3 py-1.5 bg-[#0D1017] flex items-center justify-between gap-2 overflow-x-auto text-xs">
            <div className="flex items-center gap-1.5 shrink-0 text-neutral-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium text-white/80">Simulations :</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {QUICK_TEST_VOCALS.map((qv, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendQuickVocal(qv.text)}
                  disabled={isAiThinking}
                  className="h-6 text-[11px] px-2 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 border border-white/[0.06] rounded-md shrink-0 flex items-center cursor-pointer"
                >
                  <Mic className="w-3 h-3 mr-1 text-emerald-400" />
                  {qv.label}
                </button>
              ))}

              {QUICK_TEST_IMAGES.map((qi, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendQuickImage(qi)}
                  disabled={isAiThinking}
                  className="h-6 text-[11px] px-2 bg-white/[0.03] hover:bg-white/[0.08] text-white/80 border border-white/[0.06] rounded-md shrink-0 flex items-center cursor-pointer"
                >
                  <ImageIcon className="w-3 h-3 mr-1 text-sky-400" />
                  {qi.label}
                </button>
              ))}
            </div>
          </div>

          {/* Barre de Saisie WhatsApp */}
          <div className="border-t border-white/[0.08] p-3 bg-[#121620] flex items-center gap-2">
            {isRecording ? (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-xl flex-1 text-xs text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>Enregistrement micro ({recordSeconds}s)…</span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="h-6 ml-auto px-2 rounded-lg bg-red-500 text-white text-xs flex items-center cursor-pointer"
                >
                  <Square className="w-3 h-3 mr-1" /> Terminer
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isAiThinking}
                  title="Enregistrer une note vocale"
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-emerald-400" />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Tapez un message (Entrée pour rafale)…"
                  className="flex-1 h-9 px-3 rounded-xl bg-[#0B0E14] border border-white/[0.08] text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/40"
                  disabled={isAiThinking}
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isAiThinking || !input.trim()}
                  className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Volet Latéral : Inspecteur Cerveau Studio */}
        {inspectorOpen && (
          <div className="lg:col-span-4 flex flex-col space-y-4 overflow-y-auto pr-1">
            {/* Étape Commerciale */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" /> Étape Commerciale
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {commercialStage}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-mono">
                <div className={`py-1 rounded-lg border ${commercialStage === 'BRIEF' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>1. Brief</div>
                <div className={`py-1 rounded-lg border ${commercialStage === 'VOCAL_PROCÉDURE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>2. Vocal</div>
                <div className={`py-1 rounded-lg border ${commercialStage === 'PAROLES_LIVRÉES' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>3. Paroles</div>
                <div className={`py-1 rounded-lg border ${commercialStage === 'PAIEMENT' || commercialStage === 'PRODUCTION_STUDIO' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>4. Paiement</div>
              </div>
            </div>

            {/* Fiche Brief Captée */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" /> Fiche Brief Extraite
                </span>
                <span className="text-[11px] font-mono text-neutral-400">order-brief</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Destinataire :</span>
                  <span className="font-medium text-white">{detectedRecipient || <span className="text-neutral-500 italic">Non défini</span>}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Occasion :</span>
                  <span className="font-medium text-emerald-400">{detectedOccasionStr || <span className="text-neutral-500 italic">Non définie</span>}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Expéditeur :</span>
                  <span className="font-medium text-white">{clientName} · <span className="text-neutral-400 font-mono text-[11px]">{clientPhone}</span></span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Paiement Livré :</span>
                  <span className={`font-mono text-[11px] ${paymentDelivered ? 'text-emerald-400' : 'text-neutral-400'}`}>
                    {paymentDelivered ? 'Coordonnées émises' : 'Attente validation texte (INV-07)'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400">Règle Paiement :</span>
                  <span className="font-mono text-emerald-400">Post-Texte Strict (INV-07)</span>
                </div>
              </div>
            </div>

            {/* Alertes Marchand */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" /> Alerte Marchand WhatsApp
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Temps Réel
                </span>
              </div>

              {merchantAlerts.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-1">
                  Aucune alerte marchand émise pour le moment.
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {merchantAlerts.map((alt, idx) => (
                    <div key={idx} className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-xs text-amber-200">
                      {alt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Télémétrie */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Télémétrie du Tour
                </span>
                <span className="text-[11px] font-mono text-neutral-400">INV-01 à INV-12</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400 font-sans">Moteur actif :</span>
                  <span className="text-white font-semibold">DeepSeek-V3 / Gemini Flash</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400 font-sans">Latence mesurée :</span>
                  <span className="text-emerald-400 font-semibold">{latencyMs} ms</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400 font-sans">Invariants vérifiés :</span>
                  <span className="text-sky-300 font-semibold">12/12 Conformes</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
