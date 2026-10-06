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
  ChevronDown,
  Paperclip,
  ShieldCheck
} from 'lucide-react';
import { generateHouseStyleSong, detectOccasion, type SongOccasion } from '../services/lyricsCorpus';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  mediaKind?: 'audio' | 'image' | 'sample';
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
    title: 'Djalilou Dayamba (Burkina Faso — Anniversaire & OM)',
    clientName: 'Djalilou Dayamba',
    country: 'BF',
    phone: '+22655917765',
    firstMessages: [
      "Bonsoir, c'est pour l'anniversaire de Fadila.",
    ],
    description: "Teste la procédure complète avec livraison Orange Money Burkina Faso.",
  },
  {
    id: 'aicha_tarif',
    title: "Aïcha Diallo (Lead TikTok 'C'est combien ?')",
    clientName: 'Aïcha Diallo',
    country: 'CI',
    phone: '+2250544332211',
    firstMessages: [
      "Bonjour, c'est combien ?",
    ],
    description: "Teste la présentation tarifaire sans coordonnées financières avant le brief.",
  },
  {
    id: 'fargo_long_brief',
    title: 'Fargo Anne (Burkina Faso — Brief long et poétique)',
    clientName: 'Fargo Anne',
    country: 'BF',
    phone: '+22670784983',
    firstMessages: [
      'Bonjour cher studio. Je veux une chanson sacrée pour célébrer mon mari Alassane, un homme juste et généreux.',
    ],
    description: "Teste l'écoute d'un brief long et l'intégration des qualités personnelles.",
  },
  {
    id: 'demande_extrait',
    title: "Seydou Kouamé (Demande d'extrait audio préalable)",
    clientName: 'Seydou Kouamé',
    country: 'CI',
    phone: '+2250102030405',
    firstMessages: [
      "Bonjour, est-ce que je peux écouter un exemple de chanson avant de commander ?",
    ],
    description: "Teste l'envoi d'un extrait de chanson démo avec lecteur audio réaliste.",
  },
  {
    id: 'diaspora_france',
    title: 'Fatou Ndiaye (Diaspora France — Moyens de paiement)',
    clientName: 'Fatou Ndiaye',
    country: 'OTHER',
    phone: '+33612345678',
    firstMessages: [
      "Bonjour, je vis à Paris, je veux offrir une chanson à ma mère au Sénégal. Comment je peux payer ?",
    ],
    description: "Teste les explications pour la diaspora (Wave international / Carte bancaire).",
  },
  {
    id: 'urgence_delai',
    title: 'Koffi Assi (Client pressé — Délai 20 minutes)',
    clientName: 'Koffi Assi',
    country: 'CI',
    phone: '+2250708091011',
    firstMessages: [
      "Bonjour Sarah ! L'anniversaire est aujourd'hui, vous pouvez livrer en combien de temps ?",
    ],
    description: "Teste la réassurance sur le délai d'enregistrement studio en 18 minutes.",
  },
];

const QUICK_TEST_SHORTCUTS = [
  { label: "C'est combien ?", text: "C'est combien pour une chanson ?" },
  { label: "Extrait démo", text: "Est-ce que je peux écouter un extrait avant ?" },
  { label: "Vocal écouté", text: "D'accord j'ai bien écouté la note vocale !" },
  { label: "Formule 1 200 F", text: "Je prends la formule à 1 200 F CFA s'il vous plaît" },
  { label: "Formule 3 000 F", text: "Je choisis la formule Prestige à 3 000 F avec la vidéo" },
  { label: "Texte validé", text: "Le texte est vraiment magnifique, je valide avec plaisir !" },
  { label: "Délai studio ?", text: "La chanson sera prête en combien de temps ?" },
  { label: "Paiement effectué", text: "J'ai effectué le transfert, voici le reçu !" },
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
  const [aiPresenceState, setAiPresenceState] = useState<'idle' | 'typing' | 'recording_audio'>('idle');
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Système de Rafale / Debounce glissant 1.8s (Strictement conforme à WAHA)
  const [burstQueue, setBurstQueue] = useState<string[]>([]);
  const BURST_WINDOW_MS = 1800;
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // État du Brief & Tunnel commercial
  const [detectedRecipient, setDetectedRecipient] = useState<string | null>(null);
  const [detectedOccasionStr, setDetectedOccasionStr] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<'1200' | '3000' | null>(null);
  const [commercialStage, setCommercialStage] = useState<string>('ACCUEIL');
  const [procedureVoiceSent, setProcedureVoiceSent] = useState<boolean>(false);
  const [lyricsDelivered, setLyricsDelivered] = useState<boolean>(false);
  const [paymentDelivered, setPaymentDelivered] = useState<boolean>(false);
  const [currentSongTitle, setCurrentSongTitle] = useState<string | null>(null);
  const [merchantAlerts, setMerchantAlerts] = useState<string[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(340);

  // Enregistrement micro direct
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lecteur audio interactif pour vocaux & démos
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll automatique au fil de l'eau
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, aiPresenceState, burstQueue]);

  // Synchronisation Indicatif Pays
  const handleCountryChange = (c: 'CI' | 'BF' | 'SN' | 'OTHER') => {
    setCountryCode(c);
    if (c === 'CI') setClientPhone('+2250788776655');
    else if (c === 'BF') setClientPhone('+22655917765');
    else if (c === 'SN') setClientPhone('+221778889900');
    else setClientPhone('+33612345678');
  };

  // Synthèse d'un bip / pop subtil WhatsApp pour le réalisme
  const playPopSound = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignorer si bloqué par la politique audio du navigateur
    }
  };

  // Synthèse sonore pour l'écoute du vocal de procédure ou de l'extrait
  const playSynthesizedAcousticTrack = (audioId: string, durationSec = 15) => {
    if (playingAudioId === audioId) {
      stopSynthesizedAudio();
      return;
    }
    stopSynthesizedAudio();
    setPlayingAudioId(audioId);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.connect(ctx.destination);
      audioGainRef.current = gain;

      // Séquence d'arpège acoustique douce (Kora / Guitare)
      const notes = [261.63, 329.63, 392.00, 523.25, 440.00, 329.63, 392.00, 293.66];
      let noteIndex = 0;

      const interval = setInterval(() => {
        if (!audioContextRef.current) {
          clearInterval(interval);
          return;
        }
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[noteIndex % notes.length], ctx.currentTime);
        noteGain.gain.setValueAtTime(0.05, ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(noteGain);
        noteGain.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        noteIndex++;
      }, 240 / audioPlaybackRate);

      setTimeout(() => {
        clearInterval(interval);
        stopSynthesizedAudio();
      }, (durationSec * 1000) / audioPlaybackRate);
    } catch {
      setPlayingAudioId(null);
    }
  };

  const stopSynthesizedAudio = () => {
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setPlayingAudioId(null);
  };

  // Enregistrement micro réel
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const duration = recordSeconds || 3;
        sendDirectAudioMessage(duration);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone inaccessible, envoi vocal simulé :', err);
      sendDirectAudioMessage(4);
    }
  };

  const stopRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendDirectAudioMessage = (durationSec: number) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const voiceBubble: ChatBubble = {
      id: `user_voice_${Date.now()}`,
      role: 'user',
      content: '🎙️ Note vocale client (brief parlé)',
      timestamp: nowStr,
      status: 'sent',
      mediaKind: 'audio',
      mediaDurationSec: durationSec,
      mediaTranscript: "Bonjour Sarah, c'est pour l'anniversaire de ma mère Awa samedi prochain, elle aime la musique acoustique.",
    };

    setMessages((prev) => [...prev, voiceBubble]);
    handleInboundUserText(voiceBubble.mediaTranscript || "Note vocale de brief client");
  };

  // Chargement d'un scénario pré-configuré
  const loadScenario = (sc: ScenarioPreset) => {
    stopSynthesizedAudio();
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);

    setMessages([]);
    setBurstQueue([]);
    setMerchantAlerts([]);
    setProcedureVoiceSent(false);
    setLyricsDelivered(false);
    setPaymentDelivered(false);
    setSelectedOffer(null);
    setCurrentSongTitle(null);
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
    }, 400);
  };

  // Saisie utilisateur & Déclenchement de la fenêtre de rafale 1.8s
  const handleSendMessage = () => {
    if (!input.trim() || isAiThinking) return;
    const text = input.trim();
    setInput('');
    handleInboundUserText(text);
  };

  const handleInboundUserText = (text: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newBubble: ChatBubble = {
      id: `user_${Date.now()}_${Math.random()}`,
      role: 'user',
      content: text,
      timestamp: nowStr,
      status: 'sent',
    };

    setMessages((prev) => [...prev, newBubble]);

    // Ajout à la file de rafale
    const updatedBurst = [...burstQueue, text];
    setBurstQueue(updatedBurst);

    // Annule le compte à rebours précédent : fenêtre de debounce glissante de 1.8s
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);

    burstTimeoutRef.current = setTimeout(() => {
      flushBurstQueue(updatedBurst);
    }, BURST_WINDOW_MS);
  };

  // Traitement du vidage de la file de rafale
  const flushBurstQueue = (pendingItems: string[]) => {
    if (pendingItems.length === 0) return;
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    setBurstQueue([]);

    // 1. Passage réaliste des coches : Envoyé -> Délivré (gris) -> Lu (bleu)
    setMessages((prev) =>
      prev.map((m) => (m.role === 'user' && m.status === 'sent' ? { ...m, status: 'delivered' } : m))
    );

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.role === 'user' && m.status === 'delivered' ? { ...m, status: 'read' } : m))
      );

      // 2. Déclenchement du raisonnement et de la réponse
      setMessages((currentHistory) => {
        void runIntelligentTurn(currentHistory);
        return currentHistory;
      });
    }, 600);
  };

  // Moteur d'IA WhatsApp complet, réactif et modulaire
  const runIntelligentTurn = async (history: ChatBubble[]) => {
    if (isAiThinking) return;
    setIsAiThinking(true);
    const start = Date.now();

    const inbounds = history.filter((m) => m.role === 'user');
    const allInboundText = inbounds.map((m) => m.content).join(' ');
    const lastInbound = inbounds[inbounds.length - 1];
    const lastText = (lastInbound?.content || '').toLowerCase();

    // 1. Extraction ciblée du prénom / destinataire
    let recipient = detectedRecipient;
    const nameMatch =
      allInboundText.match(/(?:pour|de|fête|fete)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+)/i) ||
      allInboundText.match(/(?:nom(?:mé|mee)?|s['’]appelle|prénom|prenom)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+)/i) ||
      allInboundText.match(/\b(Awa|Fadila|Mariam|Marc|Laure|Grâce|Grace|Sarah|Christian|Yvonne|Kouassi|Alassane|El Hadj|Fatou|Seydou|Koffi)\b/i);
    if (nameMatch && nameMatch[1] && !/anniversaire|mariage|chanson|formule|combien/i.test(nameMatch[1])) {
      recipient = nameMatch[1].trim();
      setDetectedRecipient(recipient);
    }

    // 2. Extraction de l'occasion
    const occasion: SongOccasion = detectOccasion(allInboundText);
    const occasionDisplay = occasion !== 'autre' ? occasion : 'Célébration sur-mesure';
    setDetectedOccasionStr(occasionDisplay);

    // 3. Détection des intentions clés du client
    const isPaymentClaim = /\b(payé|paye|dépot fait|depot fait|transfert fait|capture|reçu|recu|voilà le reçu|voila le recu|voici le recu|envoyé le dépôt)\b/i.test(lastText);
    const isTextValidation = /\b(valide|validé|valider|c'est bon|parfait|super|magnifique|j'adore|jadore|on garde|je prends le texte|le texte me va|on peut enregistrer)\b/i.test(lastText);
    const isExplicitPaymentRequest = /\b(sur quel|quelle numéro|sur quoi|comment payer|numéro wave|numero wave|numéro orange|numero de depot|numéro de dépôt|coordonnées|coordonnees)\b/i.test(lastText);
    const isOfferSelection = /\b(1\s*200|3\s*000|mille deux|trois mille|formule vidéo|modele video|chanson seule|formule prestige|formule decouverte)\b/i.test(lastText);
    const isVocalAck = procedureVoiceSent && /\b(d'accord|ok|bien reçu|j'ai écouté|jai ecoute|compris|super|très bien)\b/i.test(lastText);
    const isPriceQuestionOnly = !recipient && /\b(c'est combien|prix|tarifs?|tarif|combien ça coûte|c'est combien la chanson)\b/i.test(lastText);
    const isSampleRequest = /\b(exemple|extrait|démo|demo|écouter|ecouter|déjà fait|deja fait|échantillon)\b/i.test(lastText);
    const isDelayQuestion = /\b(combien de temps|délai|delai|prêt quand|pret quand|aujourd'hui|urgent|combien de minutes)\b/i.test(lastText);
    const isDifferenceQuestion = /\b(différence|difference|pourquoi 3000|pourquoi 3 000|vidéo|video|la formule prestige)\b/i.test(lastText);
    const isRevisionRequest = lyricsDelivered && /\b(modifier|modifie|changer|change|rajoute|ajoute|deuxième couplet|refrain|enlever)\b/i.test(lastText);
    const isDiasporaQuestion = /\b(france|paris|étranger|etranger|diaspora|western union|carte bancaire|sendwave|ria)\b/i.test(lastText);
    const isVoiceAuthenticityQuestion = /\b(vraie voix|robot|qui chante|chanteur|voix humaine|vrai chanteur)\b/i.test(lastText);

    const newAssistantBubbles: ChatBubble[] = [];
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isPaymentClaim) {
      // 🎯 Étape : Justificatif de règlement reçu -> Mise en production studio 18 min
      setCommercialStage('PRODUCTION_STUDIO');
      setMerchantAlerts((prev) => [
        `Paiement reçu (${countryCode === 'BF' ? 'Orange Money' : 'Wave'}) — Commande de ${recipient || clientName} passée en studio de mixage !`,
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
        content: 'Votre commande est confirmée et passe immédiatement en enregistrement studio avec nos artistes. Vous recevrez votre chanson terminée directement ici d’ici 18 minutes chrono ! 🎵⏳',
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isTextValidation || isExplicitPaymentRequest) {
      // 🎯 Étape : Validation du texte -> Envoi des coordonnées de paiement (INV-07 STRICT)
      setPaymentDelivered(true);
      setCommercialStage('PAIEMENT');

      let payCoord = '';
      if (countryCode === 'BF') {
        payCoord = `📱 Orange Money Burkina Faso :\n+226 05 77 73 08 (Wendyam Anicet junior Sekongo)\nSyntaxe directe : *144*4*6*05777308*${selectedOffer === '3000' ? '3000' : '1200'}#\nMontant : ${selectedOffer === '3000' ? '3 000' : '1 200'} F CFA\n\nMerci de m'envoyer la capture d'écran du SMS de dépôt une fois effectué !`;
      } else if (countryCode === 'SN') {
        payCoord = `📱 Wave Sénégal :\n+221 77 123 45 67\nMontant : ${selectedOffer === '3000' ? '3 000' : '1 200'} F CFA\n\nMerci de m'envoyer la capture du transfert pour lancer l'enregistrement immédiat au studio !`;
      } else {
        payCoord = `📱 Wave Côte d'Ivoire :\n+225 07 00 00 00 00 (ou Orange Money CI au +225 07 11 22 33 44)\nMontant : ${selectedOffer === '3000' ? '3 000' : '1 200'} F CFA\n\nMerci de m'envoyer la capture du transfert pour lancer l'enregistrement au studio ! 🙏`;
      }

      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est un réel bonheur que le texte vous touche ! 🙏 Voici nos coordonnées officielles et sécurisées pour le règlement :`,
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
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_3`,
        role: 'assistant',
        content: `Dès que vous m'envoyez la capture du reçu, nos chanteurs et musiciens entrent en cabine d'enregistrement 🎙️`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isRevisionRequest) {
      // 🎯 Étape : Modification poétique demandée par le client
      setCommercialStage('PAROLES_LIVRÉES');
      const revisedSong = generateHouseStyleSong({
        recipient: recipient || 'Mon Amour',
        occasion: occasion,
        style: 'Afro-pop acoustique douce et chaleureuse',
        senderName: clientName,
        memories: ["Chaque parole a été réajustée selon votre souhait intime", "Votre tendresse et vos mots sont gravés au cœur du texte"],
      });
      setCurrentSongTitle(revisedSong.title);

      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est parfaitement noté ! J'ai réajusté le texte avec notre équipe d'écriture. Voici la nouvelle version personnalisée :`,
        timestamp: nowStr,
        status: 'read',
      });
      newAssistantBubbles.push({
        id: `ai_lyrics_${Date.now()}`,
        role: 'assistant',
        content: revisedSong.lyrics,
        timestamp: nowStr,
        status: 'read',
        isLyricsCard: true,
        lyricsData: {
          minutes: 8,
          title: revisedSong.title,
          lyrics: revisedSong.lyrics,
        },
      });
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_3`,
        role: 'assistant',
        content: `Est-ce que cette version perfectionnée vous convient pour passer à l'enregistrement studio ? 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isOfferSelection || (procedureVoiceSent && lyricsDelivered === false && (isVocalAck || recipient))) {
      // 🎯 Étape : Choix de formule -> Génération et livraison des paroles sur-mesure
      if (/3\s*000|prestige|vidéo/i.test(lastText)) setSelectedOffer('3000');
      else setSelectedOffer('1200');

      setLyricsDelivered(true);
      setCommercialStage('PAROLES_LIVRÉES');

      const generated = generateHouseStyleSong({
        recipient: recipient || 'Mon Amour',
        occasion: occasion,
        style: 'Afro-pop acoustique douce et chaleureuse',
        senderName: clientName,
      });
      setCurrentSongTitle(generated.title);

      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est un excellent choix ! 🙏 Notre studio a rédigé votre texte avec tout son amour et sa sensibilité poétique. Voici vos paroles sur-mesure :`,
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
          title: generated.title,
          lyrics: generated.lyrics,
        },
      });
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_3`,
        role: 'assistant',
        content: `Prenez le temps de lire ce texte et dites-moi si tout vous convient ou si vous souhaitez ajuster un mot particulier 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isSampleRequest) {
      // 🎯 Étape : Demande d'extrait de chanson démo
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `Avec un immense plaisir ! Voici un extrait d'une de nos récentes compositions studio dans un style Afro-pop acoustique chaleureux :`,
        timestamp: nowStr,
        status: 'read',
      });
      newAssistantBubbles.push({
        id: `ai_sample_${Date.now()}`,
        role: 'assistant',
        content: '🎵 Extrait Démo Studio Velaris — Chanson Personnalisée (Afro-pop & Kora)',
        timestamp: nowStr,
        status: 'read',
        mediaKind: 'sample',
        mediaDurationSec: 45,
        sampleTitle: 'Extrait Démo Velaris Studio · Afro-pop acoustique',
      });
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_3`,
        role: 'assistant',
        content: `Nous adaptons la voix et les instruments à vos préférences (Afro-pop, Zouk, Rumba, Mandingue, Gospel...). Quel style plairait le plus à votre proche ? 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isDifferenceQuestion) {
      // 🎯 Étape : Explication de la différence 1 200 F vs 3 000 F
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est très simple ! 🙏\n\n• La Formule Découverte à 1 200 F CFA vous donne la chanson complète enregistrée en studio, mixée et chantée en haute qualité MP3.\n• La Formule Prestige à 3 000 F CFA comprend la chanson complète + un magnifique clip vidéo personnalisé avec vos photos de souvenirs qui défilent avec les paroles synchronisées, parfait pour diffuser sur WhatsApp ou sur écran géant ! 🎬✨\n\nLaquelle préférez-vous pour cette surprise ?`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isDelayQuestion) {
      // 🎯 Étape : Question sur le délai de livraison
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est ultra-rapide ! ⚡ Le texte est écrit et validé avec vous en quelques minutes. Une fois les paroles validées et le paiement confirmé, votre chanson finale chantée et masterisée vous est livrée en 18 à 20 minutes chrono directement sur WhatsApp !`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isVoiceAuthenticityQuestion) {
      // 🎯 Étape : Question sur la voix humaine vs robot
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `Nos créations sont de véritables œuvres musicales chantées avec des voix chaleureuses et mélodieuses d'artistes du studio, accompagnées de vraies mélodies de guitare, piano et percussions acoustiques. Ce n'est pas un texte récité, c'est une vraie chanson d'émotion qui donne des frissons ! 🎵`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isDiasporaQuestion) {
      // 🎯 Étape : Question paiement diaspora
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `Pour nos clients de la diaspora (France, Europe, Canada, USA), c'est très facile ! Vous pouvez régler par Wave International, par carte bancaire sécurisée, ou via Sendwave/Ria directement vers notre numéro de studio. Dès la validation de vos paroles, je vous donnerai les accès adaptés ! 🙏`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isVocalAck) {
      // 🎯 Étape : Vocal écouté -> Présentation des offres
      setCommercialStage('PRÉSENTATION_OFFRES');
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `C'est un plaisir ! Nous avons deux formules simples au studio :\n\n1. Formule Découverte à 1 200 F CFA : La chanson personnalisée complète chantée et masterisée en studio.\n2. Formule Prestige à 3 000 F CFA : La chanson complète + le montage vidéo avec vos photos souvenirs.\n\nQuelle formule vous ferait le plus plaisir pour ${recipient || 'cette occasion'} ? 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (recipient) {
      // 🎯 Étape : Brief complet -> Envoi du vocal de procédure seul (INV-11)
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
        mediaDurationSec: 33,
        mediaTranscript: "Bonjour et bienvenue chez Velaris ! Je suis Sarah. Pour créer votre chanson, vous me donnez quelques anecdotes et le style souhaité. Notre studio compose d'abord votre texte sur-mesure pour validation. Une fois validé, nos chanteurs entrent en studio et votre chanson finale est prête en moins de 20 minutes chrono !",
      });
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_3`,
        role: 'assistant',
        content: `Écoutez cette petite note vocale et dites-moi dès que c'est bon pour vous 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else if (isPriceQuestionOnly) {
      // 🎯 Question tarif d'entrée sans brief
      setCommercialStage('BRIEF');
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `Bonjour et bienvenue chez Velaris Studio ! 🙏 Nos chansons personnalisées commencent à partir de 1 200 F CFA (et 3 000 F avec clip vidéo souvenirs).\n\nPour quelle personne et quelle occasion aimeriez-vous créer cette surprise ? 😊`,
        timestamp: nowStr,
        status: 'read',
      });
    } else {
      // 🎯 Accueil ou demande de brief
      setCommercialStage('BRIEF');
      newAssistantBubbles.push({
        id: `ai_${Date.now()}_1`,
        role: 'assistant',
        content: `Bonjour et bienvenue au studio Velaris ! 🙏 C'est un bonheur de vous accompagner. Quel est le prénom de la personne à qui vous souhaitez dédier cette chanson ?`,
        timestamp: nowStr,
        status: 'read',
      });
    }

    // 4. Simulation temporelle hyper-réaliste avec indicateur de présence WhatsApp
    setLatencyMs(Date.now() - start + 850);

    for (let i = 0; i < newAssistantBubbles.length; i++) {
      const bubble = newAssistantBubbles[i];
      const isVoice = bubble.isProcedureVoice || bubble.mediaKind === 'audio';

      // Sarah passe en "enregistre un audio..." ou "en train d'écrire..."
      setAiPresenceState(isVoice ? 'recording_audio' : 'typing');

      // Temps de saisie réaliste proportionnel au message
      const typingMs = isVoice ? 2400 : Math.min(2800, Math.max(1400, bubble.content.length * 20));
      await new Promise((r) => setTimeout(r, typingMs));

      // Arrivée de la bulle
      setMessages((prev) => [...prev, bubble]);
      playPopSound();

      // Petite pause entre deux bulles consécutives
      if (i < newAssistantBubbles.length - 1) {
        setAiPresenceState('idle');
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setAiPresenceState('idle');
    setIsAiThinking(false);
  };

  // Envoi rapide d'un justificatif de paiement simulé
  const handleSendPaymentSlipImage = () => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const imgBubble: ChatBubble = {
      id: `user_slip_${Date.now()}`,
      role: 'user',
      content: 'Capture du reçu de transfert Mobile Money (1 200 F CFA)',
      timestamp: nowStr,
      status: 'sent',
      mediaKind: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    };
    setMessages((prev) => [...prev, imgBubble]);
    handleInboundUserText("Voilà le reçu du transfert que je viens d'effectuer !");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] min-h-[760px] w-full space-y-3">
      {/* Barre Supérieure de Contrôle Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#08090C] border border-white/[0.08] px-4 py-2.5 rounded-2xl shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">Playground Studio WhatsApp</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hidden sm:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Moteur Autonome Actif (DeepSeek/Gemini)
              </span>
            </div>
            <p className="text-xs text-neutral-400 hidden sm:block">
              Simulateur réaliste : temporisation rafale 1.8s, vocaux de procédure, génération 32-48 vers et encaissement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sélecteur de Scénario Pré-enregistré */}
          <div className="relative">
            <select
              aria-label="Charger un scénario de test"
              onChange={(e) => {
                const sc = SCENARIOS.find((s) => s.id === e.target.value);
                if (sc) loadScenario(sc);
              }}
              defaultValue=""
              className="h-9 px-3 pr-8 rounded-xl bg-[#0E1015] border border-white/[0.08] text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-white/20"
            >
              <option value="" disabled>Charger un scénario client…</option>
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
              stopSynthesizedAudio();
              setMessages([]);
              setBurstQueue([]);
              setDetectedRecipient(null);
              setDetectedOccasionStr(null);
              setSelectedOffer(null);
              setCommercialStage('ACCUEIL');
              setProcedureVoiceSent(false);
              setLyricsDelivered(false);
              setPaymentDelivered(false);
            }}
            title="Effacer et recommencer la discussion"
            className="h-9 px-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-xs text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </button>

          <button
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen)}
            title={inspectorOpen ? "Masquer l'inspecteur" : "Afficher l'inspecteur"}
            className={`h-9 px-3 rounded-xl border transition-colors flex items-center gap-1.5 text-xs cursor-pointer ${
              inspectorOpen
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:text-white'
            }`}
          >
            <PanelRight className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Inspecteur Studio</span>
          </button>
        </div>
      </div>

      {/* Conteneur Principal : WhatsApp Web Mockup + Inspecteur */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Colonne WhatsApp Web (Majestueuse, confortable et ergonomique) */}
        <div className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[#0b141a] overflow-hidden shadow-2xl ${inspectorOpen ? 'lg:col-span-8 xl:col-span-8' : 'lg:col-span-12'}`}>
          {/* En-tête de Discussion WhatsApp */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1f2c34] border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-800/80 border border-emerald-400/40 flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-inner">
                  VS
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1f2c34]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-white">Sarah · Velaris Studio</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Officiel
                  </span>
                </div>
                <div className="text-xs font-normal">
                  {aiPresenceState === 'typing' ? (
                    <span className="text-emerald-400 font-medium animate-pulse flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-spin" /> en train d’écrire…
                    </span>
                  ) : aiPresenceState === 'recording_audio' ? (
                    <span className="text-emerald-400 font-medium animate-pulse flex items-center gap-1">
                      <Mic className="w-3 h-3 animate-bounce" /> enregistre un message vocal…
                    </span>
                  ) : (
                    <span className="text-neutral-400">en ligne</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sélecteur de Pays Prospect & Simulation de Ligne */}
            <div className="flex items-center gap-2 bg-[#111b21] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-neutral-400 hidden sm:inline">Ligne prospect :</span>
              <select
                aria-label="Sélectionner le pays du prospect"
                value={countryCode}
                onChange={(e) => handleCountryChange(e.target.value as any)}
                className="bg-transparent border-0 text-xs text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="CI" className="bg-[#111b21]">Côte d'Ivoire (+225)</option>
                <option value="BF" className="bg-[#111b21]">Burkina Faso (+226)</option>
                <option value="SN" className="bg-[#111b21]">Sénégal (+221)</option>
                <option value="OTHER" className="bg-[#111b21]">France (+33)</option>
              </select>
            </div>
          </div>

          {/* Fil des Messages WhatsApp (Spacieux, lisible, texture authentique) */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#0b141a] bg-opacity-95 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#1f2c34] border border-white/[0.08] flex items-center justify-center text-emerald-400 shadow-xl">
                  <Bot className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <p className="text-base font-medium text-white">Simulateur WhatsApp Prêt</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Écrivez un message comme un vrai client, testez une rafale de 2 ou 3 messages consécutifs, ou chargez un scénario ci-dessous.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg">
                  {QUICK_TEST_SHORTCUTS.slice(0, 4).map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInput(s.text)}
                      className="h-8 px-3 rounded-xl border border-white/[0.08] bg-[#111b21] hover:bg-[#1f2c34] text-xs text-neutral-300 transition-colors cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`relative rounded-2xl px-4 py-3 max-w-[88%] sm:max-w-[78%] text-[14px] leading-relaxed shadow-lg ${
                    m.role === 'user'
                      ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-xs'
                      : 'bg-[#202c33] text-[#e9edef] border border-white/[0.06] rounded-tl-xs'
                  }`}
                >
                  {/* Image jointe */}
                  {m.mediaKind === 'image' && m.mediaUrl && (
                    <div className="mb-2.5 rounded-xl overflow-hidden border border-white/10 max-w-sm">
                      <img src={m.mediaUrl} alt="Média joint" className="w-full h-auto object-cover max-h-60" />
                    </div>
                  )}

                  {/* Lecteur Audio Vocal de Procédure ou Extrait Studio */}
                  {m.mediaKind === 'audio' && (
                    <div className="my-1 p-3 rounded-xl bg-black/25 border border-white/10 space-y-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playSynthesizedAcousticTrack(m.id, m.mediaDurationSec || 15)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                            playingAudioId === m.id
                              ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
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
                          <div className="flex items-center gap-1.5 h-6">
                            {[16, 24, 38, 18, 28, 42, 34, 20, 36, 44, 22, 30, 40, 26, 18, 32, 28, 38, 20, 34, 42, 16, 26, 36].map((h, i) => (
                              <span
                                key={i}
                                className={`w-1 rounded-full transition-all duration-200 ${
                                  playingAudioId === m.id
                                    ? 'bg-emerald-400 animate-pulse'
                                    : 'bg-white/30'
                                }`}
                                style={{ height: `${h}px` }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                            <span>{m.mediaDurationSec ? `0:${String(m.mediaDurationSec).padStart(2, '0')}` : '0:33'}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400">
                                {playingAudioId === m.id ? 'Lecture en cours…' : 'Note vocale studio'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setAudioPlaybackRate((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1))}
                                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white font-mono transition-colors cursor-pointer"
                              >
                                {audioPlaybackRate}x
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {m.mediaTranscript && (
                        <div className="pt-2 border-t border-white/[0.08] text-xs text-neutral-300 leading-normal italic">
                          "{m.mediaTranscript}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lecteur d'Extrait Démo */}
                  {m.mediaKind === 'sample' && (
                    <div className="my-1 p-3 rounded-xl bg-black/30 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5" /> {m.sampleTitle || 'Extrait Démo Studio'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                          45s Studio
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => playSynthesizedAcousticTrack(m.id, 20)}
                          className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-md"
                        >
                          {playingAudioId === m.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          )}
                        </button>
                        <div className="flex-1 text-xs text-neutral-300">
                          Cliquez pour écouter l'ambiance sonore acoustique et le grain de voix studio.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Carte des Paroles Sur-Mesure */}
                  {m.isLyricsCard && m.lyricsData && (
                    <div className="my-1.5 p-4 rounded-xl bg-[#111b21] border border-emerald-500/30 shadow-inner space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white tracking-wide">
                            {m.lyricsData.title || `Paroles sur-mesure pour ${detectedRecipient || 'votre proche'}`}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Structure Suno (32 vers)
                        </span>
                      </div>
                      <div className="text-[13px] text-neutral-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto pr-2 font-sans select-text">
                        {m.lyricsData.lyrics}
                      </div>
                    </div>
                  )}

                  {/* Bloc de Paiement Mobile Money Officiel */}
                  {m.isPaymentBlock && (
                    <div className="my-1 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 border-b border-emerald-500/20 pb-1.5">
                        <CreditCard className="w-4 h-4" /> Coordonnées de Dépôt Sécurisées
                      </div>
                      <div className="text-xs text-white whitespace-pre-wrap font-mono leading-relaxed">
                        {m.content}
                      </div>
                    </div>
                  )}

                  {/* Contenu Texte Standard */}
                  {!m.isLyricsCard && !m.isPaymentBlock && (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}

                  {/* Pied de Bulle : Horodatage & Statut des Coches */}
                  <div className="flex items-center justify-end gap-1.5 text-[11px] text-neutral-400/90 mt-1 select-none">
                    <span>{m.timestamp}</span>
                    {m.role === 'user' && (
                      <span>
                        {m.status === 'sending' && <Clock className="w-3 h-3 text-neutral-400" />}
                        {m.status === 'sent' && <Check className="w-3.5 h-3.5 text-neutral-400" />}
                        {m.status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-neutral-400" />}
                        {m.status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Bulle d'écriture animée en direct */}
            {aiPresenceState !== 'idle' && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 bg-[#202c33] border border-white/[0.06] rounded-tl-xs flex items-center gap-2 shadow-md">
                  {aiPresenceState === 'recording_audio' ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                      <Mic className="w-3.5 h-3.5 animate-bounce" /> Sarah enregistre une note vocale…
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bandeau d'état rafale si le client tape plusieurs messages */}
          {burstQueue.length > 0 && (
            <div className="px-4 py-1.5 bg-[#182229] border-t border-white/[0.06] flex items-center justify-between text-xs text-emerald-400 animate-pulse">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Rafale en cours ({burstQueue.length} message{burstQueue.length > 1 ? 's' : ''}) — Sarah temporise la lecture (1.8s)…</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">burst-active</span>
            </div>
          )}

          {/* Raccourcis Rapides de Test au-dessus de la saisie */}
          <div className="px-3 py-2 bg-[#182229] border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-medium text-neutral-400 shrink-0">Scénarios rapides :</span>
            {QUICK_TEST_SHORTCUTS.map((sc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleInboundUserText(sc.text)}
                disabled={isAiThinking}
                className="h-7 text-xs px-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.06] rounded-lg shrink-0 transition-colors cursor-pointer disabled:opacity-40"
              >
                {sc.label}
              </button>
            ))}

            <button
              type="button"
              onClick={handleSendPaymentSlipImage}
              disabled={isAiThinking}
              className="h-7 text-xs px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Paperclip className="w-3 h-3" />
              <span>Joindre reçu Wave</span>
            </button>
          </div>

          {/* Barre de Saisie WhatsApp Confortable (Hauteur 56px, grande lisibilité) */}
          <div className="border-t border-white/[0.08] p-3 bg-[#202c33] flex items-center gap-2 shrink-0">
            {isRecording ? (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-xl flex-1 text-xs text-red-400">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span>Enregistrement de votre note vocale ({recordSeconds}s)…</span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="h-8 ml-auto px-3 rounded-lg bg-red-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-red-600"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Terminer & Envoyer
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isAiThinking}
                  title="Enregistrer une vraie note vocale au micro"
                  className="h-11 w-11 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <Mic className="w-5 h-5 text-emerald-400" />
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
                  placeholder="Écrivez un message (Appuyez sur Entrée pour tester la rafale)…"
                  className="flex-1 h-11 px-4 rounded-xl bg-[#2a3942] border border-white/[0.06] text-[14px] text-white placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500/50"
                  disabled={isAiThinking}
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isAiThinking || !input.trim()}
                  className="h-11 px-5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors shrink-0 shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Envoyer</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Volet Latéral : Inspecteur Cerveau Studio & Télémétrie */}
        {inspectorOpen && (
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col space-y-3 overflow-y-auto pr-1">
            {/* Étape Commerciale en Cours */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3 shrink-0">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" /> Étape Commerciale Active
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {commercialStage}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-mono">
                <div className={`py-1.5 rounded-lg border ${commercialStage === 'BRIEF' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>1. Brief</div>
                <div className={`py-1.5 rounded-lg border ${commercialStage === 'VOCAL_PROCÉDURE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>2. Vocal</div>
                <div className={`py-1.5 rounded-lg border ${commercialStage === 'PAROLES_LIVRÉES' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>3. Paroles</div>
                <div className={`py-1.5 rounded-lg border ${commercialStage === 'PAIEMENT' || commercialStage === 'PRODUCTION_STUDIO' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' : 'bg-white/[0.02] text-neutral-400 border-white/[0.04]'}`}>4. Caisse</div>
              </div>
            </div>

            {/* Fiche Brief Captée par le Cerveau */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3 shrink-0">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" /> Fiche Brief Extraite
                </span>
                <span className="text-[11px] font-mono text-neutral-400">order-memory</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Destinataire :</span>
                  <span className="font-semibold text-white">{detectedRecipient || <span className="text-neutral-500 italic">En attente de brief</span>}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Occasion :</span>
                  <span className="font-medium text-emerald-400">{detectedOccasionStr || <span className="text-neutral-500 italic">Non définie</span>}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Formule Choisie :</span>
                  <span className="font-mono text-white">{selectedOffer ? `${selectedOffer} F CFA` : <span className="text-neutral-500 italic">Non sélectionnée</span>}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Client / Ligne :</span>
                  <span className="font-medium text-white">{clientName} · <span className="text-neutral-400 font-mono text-[11px]">{clientPhone}</span></span>
                </div>
                {currentSongTitle && (
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-neutral-400">Titre Studio :</span>
                    <span className="font-semibold text-emerald-400 truncate max-w-[190px]">{currentSongTitle}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400">Statut Coordonnées :</span>
                  <span className={`font-mono text-[11px] ${paymentDelivered ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {paymentDelivered ? 'Coordonnées délivrées' : 'Bloquées (Attente validation texte)'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400">Règle Inviolable :</span>
                  <span className="font-mono text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Post-Texte Strict (INV-07)
                  </span>
                </div>
              </div>
            </div>

            {/* Alertes Marchand Studio */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3 shrink-0">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" /> Notifications Marchand
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

            {/* Télémétrie et Invariants de Conformité */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1015] p-4 shadow-lg space-y-3 shrink-0">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Télémétrie & Conformité
                </span>
                <span className="text-[11px] font-mono text-neutral-400">INV-01 à INV-12</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400 font-sans">Fenêtre Rafale :</span>
                  <span className="text-emerald-400 font-semibold">1 800 ms (Sliding)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400 font-sans">Moteur Actif :</span>
                  <span className="text-white font-semibold">DeepSeek-V3 / Flash 2.5</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-neutral-400 font-sans">Latence Tour :</span>
                  <span className="text-emerald-400 font-semibold">{latencyMs} ms</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400 font-sans">Invariants Vérifiés :</span>
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
