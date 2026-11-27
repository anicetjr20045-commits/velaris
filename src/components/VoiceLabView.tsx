import { useState, useRef, useEffect, type FC } from 'react';
import {
  ArrowLeft,
  Mic,
  Sparkles,
  Play,
  Pause,
  Send,
  Download,
  RotateCw,
  Check,
  AlertCircle,
  MessageCircle,
  Volume2,
  BookmarkPlus,
  PenLine,
  CheckCircle2,
  Radio,
  FileText,
  RotateCcw,
  AudioLines,
} from 'lucide-react';
import {
  FISH_VOICES,
  generateFishVoice,
  type FishVoiceItem,
} from '../services/fishVoice';
import { sendWahaVoiceMessage, wahaSessionNameFor } from '../services/waha';
import { saveAutomationRule, uploadAutomationMedia, supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { VoiceNoteRecorder, type VoiceRecording } from './VoiceNoteRecorder';
import { transcribeAudioBlob } from '../services/whisper-stt';
import type { Order } from '../types';

interface VoiceLabViewProps {
  orders: Order[];
  onBackToHub: () => void;
  onOpenAutomations?: () => void;
}

interface StoredTake {
  blob: Blob;
  url: string;
  durationSec: number;
}

export const VoiceLabView: FC<VoiceLabViewProps> = ({
  orders,
  onBackToHub,
  onOpenAutomations,
}) => {
  const { user } = useAuth();
  const sessionName = wahaSessionNameFor(user?.id);

  // Voix sélectionnée (Awa par défaut)
  const [selectedVoice, setSelectedVoice] = useState<FishVoiceItem>(FISH_VOICES[0]);
  const selectedVoiceRef = useRef<FishVoiceItem>(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  // Écoute des extraits de voix du catalogue
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mode de travail : Transformation Vocale directe (Voice-to-Voice) ou Saisie Texte
  const [creationMode, setCreationMode] = useState<'voice2voice' | 'write'>('voice2voice');

  // Enregistrement original conservé (la voix brute de l'utilisateur)
  const [originalTake, setOriginalTake] = useState<StoredTake | null>(null);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState<boolean>(false);
  const [originalProgress, setOriginalProgress] = useState<number>(0);

  // Transformation vocale en cours
  const [isTransforming, setIsTransforming] = useState<boolean>(false);
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [showTextDetails, setShowTextDetails] = useState<boolean>(false);

  // Audio transformé dans la voix Fish Audio cible
  const [transformedAudio, setTransformedAudio] = useState<{
    blob: Blob;
    url: string;
    mimeType: string;
    text: string;
    voiceName: string;
    voiceReferenceId: string;
  } | null>(null);

  // Lecteur de l'audio transformé
  const transformedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingTransformed, setIsPlayingTransformed] = useState<boolean>(false);
  const [transformedProgress, setTransformedProgress] = useState<number>(0);

  // Mode Texte Manuel
  const [manualText, setManualText] = useState<string>('');
  const [isGeneratingManual, setIsGeneratingManual] = useState<boolean>(false);

  // Envoi Flash WhatsApp : saisie directe par défaut (indicatif + numéro) ou choix parmi les contacts récents
  const [countryCode, setCountryCode] = useState<string>('+226');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [useRecentContact, setUseRecentContact] = useState<boolean>(false);
  const [recentContacts, setRecentContacts] = useState<Array<{ name: string; phone: string }>>([]);
  const [selectedClientPhone, setSelectedClientPhone] = useState<string>('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const merged = new Map<string, { name: string; phone: string }>();
      for (const o of orders) {
        const p = String(o.clientPhone || '').trim();
        const d = p.replace(/\D/g, '');
        if (d.length >= 8 && !merged.has(d.slice(-8))) {
          merged.set(d.slice(-8), { name: o.clientName || p, phone: p });
        }
      }
      if (user) {
        const { data } = await supabase
          .from('contacts')
          .select('name, phone')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);
        for (const c of data || []) {
          const p = String(c.phone || '').trim();
          const d = p.replace(/\D/g, '');
          if (d.length >= 8 && !merged.has(d.slice(-8))) {
            merged.set(d.slice(-8), { name: String(c.name || p).trim(), phone: p });
          }
        }
      }
      if (!cancelled) {
        const list = [...merged.values()].slice(0, 25);
        setRecentContacts(list);
        if (list.length > 0 && !selectedClientPhone) setSelectedClientPhone(list[0].phone);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, orders.length]);

  // Sauvegarde comme Règle d'Automatisation
  const [ruleEmoji, setRuleEmoji] = useState<string>('🎵');
  const [ruleName, setRuleName] = useState<string>('Vocal de procédure');
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);
  const [ruleSavedNotice, setRuleSavedNotice] = useState<string | null>(null);

  // Notification globale
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const showToast = (text: string, ok = true) => {
    setToast(text ? { text, ok } : null);
    if (text) setTimeout(() => setToast(null), 3800);
  };

  // Arrêt des audios au démontage
  useEffect(() => {
    return () => {
      if (sampleAudioRef.current) sampleAudioRef.current.pause();
      if (originalAudioRef.current) originalAudioRef.current.pause();
      if (transformedAudioRef.current) transformedAudioRef.current.pause();
    };
  }, []);

  // Lecture / Pause d'un extrait de voix du catalogue
  const handlePlaySample = async (voice: FishVoiceItem) => {
    if (playingSampleId === voice.id) {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        setPlayingSampleId(null);
      }
      return;
    }

    setSampleLoading(voice.id);
    try {
      const result = await generateFishVoice(voice.sampleText, voice.reference_id, 'mp3', true);
      if (sampleAudioRef.current) {
        sampleAudioRef.current.src = result.url;
        sampleAudioRef.current.onended = () => setPlayingSampleId(null);
        await sampleAudioRef.current.play();
        setPlayingSampleId(voice.id);
      }
    } catch (e: any) {
      showToast(`Impossible de lire l’extrait : ${e.message}`, false);
    } finally {
      setSampleLoading(null);
    }
  };

  // Transformation vocale directe d'un blob audio vers la voix cible
  const transformAudioToVoice = async (audioBlob: Blob, voice: FishVoiceItem) => {
    setIsTransforming(true);
    setSendSuccess(null);
    setSendError(null);
    setRuleSavedNotice(null);

    try {
      // 1. Analyse et empreinte du contenu vocal
      const transcription = await transcribeAudioBlob(audioBlob);
      const spokenText = transcription.text.trim();

      if (!spokenText) {
        showToast('Aucun son distinct détecté dans votre prise. Rapprochez-vous du micro et réessayez.', false);
        setIsTransforming(false);
        return;
      }

      setTranscribedText(spokenText);

      // 2. Métamorphose vers la voix Fish Audio cible
      const synth = await generateFishVoice(spokenText, voice.reference_id, 'mp3');

      setTransformedAudio({
        blob: synth.blob,
        url: synth.url,
        mimeType: synth.mimeType,
        text: spokenText,
        voiceName: voice.name,
        voiceReferenceId: voice.reference_id,
      });

      setRuleName(`Vocal ${voice.name} · ${spokenText.slice(0, 24)}...`);
      showToast(`Votre voix a été transformée avec succès en ${voice.name} !`, true);
    } catch (err: any) {
      showToast(`Erreur de transformation vocale : ${err.message}`, false);
    } finally {
      setIsTransforming(false);
    }
  };

  // Réception de la prise vocale brute au micro : ON GARDE LA VOIX ORIGINALE
  const handleVoiceRecorded = async (recording: VoiceRecording) => {
    // Sauvegarde et conservation de la voix brute originale
    setOriginalTake({
      blob: recording.blob,
      url: recording.url,
      durationSec: recording.durationSec,
    });

    // Lancement de la métamorphose vocale vers la voix active (via ref pour éviter toute closure obsolète)
    await transformAudioToVoice(recording.blob, selectedVoiceRef.current);
  };

  // Retransformer la même prise originale avec une autre voix du catalogue
  const handleRetransformSameTake = async (voice: FishVoiceItem) => {
    if (!originalTake) return;
    setSelectedVoice(voice);
    await transformAudioToVoice(originalTake.blob, voice);
  };

  // Réinitialiser la prise originale pour en refaire une nouvelle
  const handleResetTake = () => {
    if (originalAudioRef.current) originalAudioRef.current.pause();
    if (transformedAudioRef.current) transformedAudioRef.current.pause();
    setOriginalTake(null);
    setTransformedAudio(null);
    setTranscribedText('');
    setIsPlayingOriginal(false);
    setIsPlayingTransformed(false);
  };

  // Synthèse depuis le mode texte manuel
  const handleGenerateManualText = async () => {
    const clean = manualText.trim();
    if (!clean) {
      showToast('Veuillez saisir votre texte.', false);
      return;
    }

    setIsGeneratingManual(true);
    setSendSuccess(null);
    setSendError(null);
    setRuleSavedNotice(null);

    try {
      const result = await generateFishVoice(clean, selectedVoice.reference_id, 'mp3');
      setTransformedAudio({
        blob: result.blob,
        url: result.url,
        mimeType: result.mimeType,
        text: clean,
        voiceName: selectedVoice.name,
        voiceReferenceId: selectedVoice.reference_id,
      });
      setRuleName(`Vocal ${selectedVoice.name} · ${clean.slice(0, 24)}...`);
      showToast(`Note vocale générée avec succès (${selectedVoice.name}) !`, true);
    } catch (err: any) {
      showToast(`Erreur de génération : ${err.message}`, false);
    } finally {
      setIsGeneratingManual(false);
    }
  };

  // Recharger le lecteur audio transformé dès qu'une nouvelle voix est générée
  useEffect(() => {
    if (transformedAudioRef.current && transformedAudio?.url) {
      transformedAudioRef.current.pause();
      setIsPlayingTransformed(false);
      setTransformedProgress(0);
      transformedAudioRef.current.load();
    }
  }, [transformedAudio?.url]);

  // Envoi Flash direct sur WhatsApp en format PTT natif (OGG/Opus)
  const handleSendFlashWhatsApp = async () => {
    if (!transformedAudio) return;

    let targetPhone = '';
    if (useRecentContact) {
      targetPhone = selectedClientPhone.trim();
    } else {
      const raw = customPhone.trim();
      if (raw.startsWith('+') || raw.startsWith('00')) {
        targetPhone = raw.replace(/^00/, '+');
      } else {
        const digits = raw.replace(/\D/g, '');
        if (digits) {
          targetPhone = `${countryCode}${digits}`;
        }
      }
    }

    if (!targetPhone || targetPhone.replace(/\D/g, '').length < 8) {
      setSendError('Veuillez saisir un numéro WhatsApp valide (avec indicatif) ou choisir un contact récent.');
      return;
    }

    setIsSendingWhatsApp(true);
    setSendSuccess(null);
    setSendError(null);

    try {
      // Envoi direct du blob déjà synthétisé (WAHA convertit en OGG/Opus PTT natif sans re-consommer de crédit)
      const blobToSend = transformedAudio.blob;

      const res = await sendWahaVoiceMessage(targetPhone, blobToSend, sessionName);
      if (res.success) {
        setSendSuccess(`Note vocale expédiée en format PTT natif au ${targetPhone} !`);
        showToast(`Envoyé en note vocale native au ${targetPhone}`, true);
      } else {
        setSendError(res.error || 'Erreur lors de l’envoi WhatsApp.');
      }
    } catch (err: any) {
      setSendError(err?.message || 'Impossible de joindre la passerelle WhatsApp.');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Enregistrement comme Règle d'Automatisation
  const handleSaveAsAutomation = async () => {
    if (!transformedAudio) return;
    if (!ruleName.trim()) {
      showToast('Veuillez donner un titre à votre automatisation.', false);
      return;
    }

    setIsSavingRule(true);
    setRuleSavedNotice(null);

    try {
      let mediaPath: string | undefined;

      if (user) {
        const uploadRes = await uploadAutomationMedia(
          transformedAudio.blob,
          `voice_${selectedVoice.id}_${Date.now()}.mp3`
        );
        if ('path' in uploadRes) {
          mediaPath = uploadRes.path;
        }
      }

      await saveAutomationRule({
        name: ruleName.trim(),
        emoji: ruleEmoji.trim() || '🎵',
        action: transformedAudio.text,
        active: true,
        kind: 'voice',
        mediaPath,
      });

      setRuleSavedNotice(`Automatisation « ${ruleName} » enregistrée avec la réaction ${ruleEmoji} !`);
      showToast(`Règle enregistrée avec l'emoji ${ruleEmoji} !`, true);
    } catch (err: any) {
      showToast(`Erreur d'enregistrement : ${err.message}`, false);
    } finally {
      setIsSavingRule(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">
      {/* Lecteur audio caché pour les extraits de voix du catalogue */}
      <audio ref={sampleAudioRef} className="hidden" />

      {/* Toast de confirmation */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#0D0F14] border border-white/[0.12] text-sm text-white shadow-2xl animate-in fade-in slide-in-from-top-2">
          {toast.ok ? (
            <Check className="w-4 h-4 text-[#10D98E]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* 1. EN-TÊTE ÉPURÉ & RETOUR AU HUB */}
      <header className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#E2BD6B] font-semibold">
                Studio Régie IA · Pôle 04
              </span>
              <span className="text-white/20">·</span>
              <span className="text-xs text-[#8A90A0]">Transformation Vocale Directe (Voice-to-Voice)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Studio Vocal & Voix IA
            </h1>
            <p className="text-xs text-[#8A90A0] max-w-xl leading-relaxed">
              Enregistrez votre propre voix au micro : votre prise originale est conservée et directement transformée dans la voix de votre choix (Awa, Koffi, Fatou...). Expédiez-la ensuite sur WhatsApp sous forme de véritable note vocale native (PTT).
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToHub}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white transition-colors cursor-pointer border border-white/[0.06]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour au Studio</span>
          </button>
        </div>
      </header>

      {/* 2. CATALOGUE DES VOIX DISPONIBLES (FISH AUDIO) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-white">01. Choisissez la Voix Cible</h2>
            <p className="text-xs text-[#8A90A0]">
              Sélectionnez le timbre vers lequel votre voix sera métamorphosée.
            </p>
          </div>
          <span className="text-xs font-mono text-[#E2BD6B]">
            {FISH_VOICES.length} voix disponibles
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {FISH_VOICES.map((voice) => {
            const isSelected = selectedVoice.id === voice.id;
            const isPlaying = playingSampleId === voice.id;
            const isLoading = sampleLoading === voice.id;

            return (
              <div
                key={voice.id}
                onClick={() => {
                  setSelectedVoice(voice);
                  // Si l'utilisateur a déjà une prise enregistrée, il peut retransformer directement
                  if (originalTake && !isTransforming) {
                    transformAudioToVoice(originalTake.blob, voice);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 text-left ${
                  isSelected
                    ? 'bg-[#E2BD6B]/10 border-[#E2BD6B] shadow-lg shadow-[#E2BD6B]/5'
                    : 'bg-[#0D0F14] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isSelected
                            ? 'bg-[#E2BD6B] text-black font-extrabold'
                            : 'bg-white/[0.06] text-white'
                        }`}
                      >
                        {voice.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{voice.name}</p>
                        <p className="text-[11px] text-[#8A90A0]">{voice.accent}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                        isSelected
                          ? 'bg-[#E2BD6B]/20 text-[#E2BD6B]'
                          : 'bg-white/[0.06] text-[#8A90A0]'
                      }`}
                    >
                      {voice.tag}
                    </span>
                  </div>

                  <p className="text-xs text-[#8A90A0] leading-relaxed line-clamp-2">
                    {voice.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-[11px] font-mono text-white/40">
                    {voice.gender}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaySample(voice);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      isPlaying
                        ? 'bg-[#E2BD6B] text-black'
                        : 'bg-white/[0.07] hover:bg-white/[0.12] text-white'
                    }`}
                  >
                    {isLoading ? (
                      <RotateCw className="w-3 h-3 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    <span>{isPlaying ? 'Pause' : 'Échantillon'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. ATELIER VOICE-TO-VOICE (CONSERVATION DE LA VOIX ORIGINALE & TRANSFORMATION DIRECTE) */}
      <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-white">02. Enregistrement & Métamorphose de Voix</h2>
            <p className="text-xs text-[#8A90A0]">
              Parlez au micro : votre voix est enregistrée, conservée et transformée dans la voix de {selectedVoice.name}.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-[#E2BD6B] bg-[#E2BD6B]/10 px-3 py-1 rounded-full border border-[#E2BD6B]/20">
            <Radio className="w-3 h-3" />
            <span>Cible active : {selectedVoice.name}</span>
          </div>
        </div>

        {/* SÉLECTEUR DE MODE : VOICE-TO-VOICE OU SAISIE TEXTE */}
        <div className="inline-flex p-1 rounded-2xl bg-[#08090C] border border-white/[0.06] gap-1">
          <button
            type="button"
            onClick={() => setCreationMode('voice2voice')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              creationMode === 'voice2voice'
                ? 'bg-white text-black shadow-md'
                : 'text-[#8A90A0] hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice-to-Voice (Enregistrer ma voix)</span>
          </button>

          <button
            type="button"
            onClick={() => setCreationMode('write')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              creationMode === 'write'
                ? 'bg-white text-black shadow-md'
                : 'text-[#8A90A0] hover:text-white'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Saisie texte au clavier</span>
          </button>
        </div>

        {/* CONTENU MODE 1 : VOICE-TO-VOICE DIRECT AVEC VOIX ORIGINALE CONSERVÉE */}
        {creationMode === 'voice2voice' && (
          <div className="space-y-5">
            {/* A. Si aucune prise vocale n'est encore faite */}
            {!originalTake && !isTransforming && (
              <div className="space-y-3">
                <VoiceNoteRecorder
                  autoSubmitOnStop={true}
                  maxSeconds={120}
                  confirmLabel="Transformer ma voix"
                  onComplete={handleVoiceRecorded}
                />
                <div className="p-3.5 rounded-2xl bg-[#08090C] border border-white/[0.04] flex items-center gap-3 text-xs text-[#8A90A0]">
                  <AudioLines className="w-4 h-4 text-[#E2BD6B] shrink-0" />
                  <span>
                    Votre voix originale sera conservée. Vous pourrez l'écouter, la comparer avec la version transformée ou la basculer vers une autre voix d'un simple clic.
                  </span>
                </div>
              </div>
            )}

            {/* B. Pendant la métamorphose vocale */}
            {isTransforming && (
              <div className="p-8 rounded-2xl bg-[#08090C] border border-[#E2BD6B]/30 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in">
                <div className="w-14 h-14 rounded-full bg-[#E2BD6B]/15 flex items-center justify-center text-[#E2BD6B]">
                  <RotateCw className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    Métamorphose vocale en cours vers la voix de {selectedVoice.name}…
                  </p>
                  <p className="text-xs text-[#8A90A0]">
                    Conversion Voice-to-Voice haute fidélité sans altérer vos intentions.
                  </p>
                </div>
              </div>
            )}

            {/* C. Dès que la voix originale a été enregistrée : ON L'AFFICHE ET ON LA CONSERVE ! */}
            {originalTake && (
              <div className="space-y-4">
                {/* 1. CARTE DE LA VOIX ORIGINALE CONSERVÉE */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#08090C] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-white/60" />
                      <p className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        01. Votre Voix Originale (Enregistrement conservé)
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetTake}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[11px] text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Nouvelle prise micro</span>
                    </button>
                  </div>

                  {/* Lecteur de la voix originale */}
                  <div className="p-3 rounded-xl bg-[#0D0F14] border border-white/[0.06] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (originalAudioRef.current) {
                          if (isPlayingOriginal) {
                            originalAudioRef.current.pause();
                            setIsPlayingOriginal(false);
                          } else {
                            if (transformedAudioRef.current) transformedAudioRef.current.pause();
                            setIsPlayingTransformed(false);
                            originalAudioRef.current.play();
                            setIsPlayingOriginal(true);
                          }
                        }
                      }}
                      className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shrink-0 cursor-pointer hover:bg-white/90"
                    >
                      {isPlayingOriginal ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <audio
                      ref={originalAudioRef}
                      src={originalTake.url}
                      onTimeUpdate={() => {
                        if (originalAudioRef.current) {
                          const pct =
                            (originalAudioRef.current.currentTime / originalAudioRef.current.duration) * 100 || 0;
                          setOriginalProgress(pct);
                        }
                      }}
                      onEnded={() => {
                        setIsPlayingOriginal(false);
                        setOriginalProgress(0);
                      }}
                      className="hidden"
                    />

                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-100"
                          style={{ width: `${originalProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[#8A90A0]">
                        <span>Votre voix brute</span>
                        <span>{originalTake.durationSec.toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BOUTON RAPIDE DE BASCULE VERS UNE AUTRE VOIX SANS RÉ-ENREGISTRER */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[#8A90A0]">
                    Tester cet enregistrement avec une autre voix :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FISH_VOICES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isTransforming || selectedVoice.id === v.id}
                        onClick={() => handleRetransformSameTake(v)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selectedVoice.id === v.id
                            ? 'bg-[#E2BD6B] text-black font-semibold'
                            : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1] hover:text-white'
                        }`}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. DÉTAIL DU TEXTE (REPLIABLE) */}
                {transcribedText && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowTextDetails((v) => !v)}
                      className="text-[11px] text-[#8A90A0] hover:text-white underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      <span>{showTextDetails ? 'Masquer le texte' : 'Afficher le texte détecté'}</span>
                    </button>

                    {showTextDetails && (
                      <div className="mt-2 text-left p-3 rounded-xl bg-[#08090C] border border-white/[0.06] text-xs text-[#8A90A0] italic leading-relaxed">
                        « {transcribedText} »
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CONTENU MODE 2 : SAISIE TEXTE CLASSIQUE AU CLAVIER */}
        {creationMode === 'write' && (
          <div className="space-y-3">
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Tapez le texte exact que vous souhaitez entendre sous forme de note vocale WhatsApp..."
              className="w-full p-4 rounded-2xl bg-[#08090C] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B] leading-relaxed resize-none"
            />
            <div className="flex items-center justify-between text-[11px] text-[#8A90A0]">
              <span>Moteur Fish Audio s2.1 · Rendu PTT WhatsApp</span>
              <span className="font-mono">{manualText.length} caractères</span>
            </div>

            <button
              type="button"
              disabled={isGeneratingManual || !manualText.trim()}
              onClick={handleGenerateManualText}
              className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-white/10"
            >
              {isGeneratingManual ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Génération de la note vocale en cours…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Générer la Note Vocale ({selectedVoice.name})</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* 4. RÉSULTAT DU VOCAL TRANSFORMÉ & DEUX ACTIONS IMMÉDIATES */}
      {transformedAudio && (
        <section className="rounded-3xl bg-[#08090C] border border-[#E2BD6B]/30 p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          {/* Lecteur de la note vocale transformée */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10D98E] animate-pulse" />
                <p className="text-sm font-bold text-white">
                  02. Voix Transformée · {transformedAudio.voiceName}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-[#10D98E]/15 text-[#10D98E] text-[10px] font-mono font-semibold">
                  PTT WhatsApp Natif
                </span>
              </div>

              <a
                href={transformedAudio.url}
                download={`vocal_${selectedVoice.id}.mp3`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger MP3</span>
              </a>
            </div>

            {/* Lecteur HTML5 transformé */}
            <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (transformedAudioRef.current) {
                    if (isPlayingTransformed) {
                      transformedAudioRef.current.pause();
                      setIsPlayingTransformed(false);
                    } else {
                      if (originalAudioRef.current) originalAudioRef.current.pause();
                      setIsPlayingOriginal(false);
                      transformedAudioRef.current.play();
                      setIsPlayingTransformed(true);
                    }
                  }
                }}
                className="w-11 h-11 rounded-full bg-[#E2BD6B] hover:bg-[#E2BD6B]/90 text-black flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-lg shadow-[#E2BD6B]/20"
              >
                {isPlayingTransformed ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <audio
                ref={transformedAudioRef}
                src={transformedAudio.url}
                onTimeUpdate={() => {
                  if (transformedAudioRef.current) {
                    const pct =
                      (transformedAudioRef.current.currentTime / transformedAudioRef.current.duration) * 100 || 0;
                    setTransformedProgress(pct);
                  }
                }}
                onEnded={() => {
                  setIsPlayingTransformed(false);
                  setTransformedProgress(0);
                }}
                className="hidden"
              />

              <div className="flex-1 space-y-1.5">
                <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full bg-[#E2BD6B] rounded-full transition-all duration-100"
                    style={{ width: `${transformedProgress}%` }}
                  />
                </div>
                <p className="text-xs text-[#8A90A0] line-clamp-1 italic">
                  « {transformedAudio.text} »
                </p>
              </div>

              <Volume2 className="w-4 h-4 text-white/30 shrink-0" />
            </div>
          </div>

          {/* GRILLE DES DEUX DÉBOUCHÉS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
            {/* ACTION A : ENVOI FLASH WHATSAPP */}
            <div className="p-5 rounded-2xl bg-[#0D0F14] border border-white/[0.06] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#10D98E]/15 text-[#10D98E] flex items-center justify-center">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Action A : Envoi Flash WhatsApp</h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#10D98E] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>PTT Natif</span>
                  </span>
                </div>

                <p className="text-xs text-[#8A90A0] leading-relaxed">
                  Expédiez cette note vocale immédiatement sur le WhatsApp d’un client sous forme de vraie note vocale WhatsApp avec forme d'onde verte.
                </p>

                {/* Choix du destinataire */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#8A90A0]">Destinataire WhatsApp</span>
                    {recentContacts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUseRecentContact((v) => !v)}
                        className="text-[#E2BD6B] hover:underline cursor-pointer"
                      >
                        {useRecentContact ? 'Taper un numéro' : `Contacts récents (${recentContacts.length})`}
                      </button>
                    )}
                  </div>

                  {!useRecentContact ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="px-2.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-xs text-white font-mono focus:outline-none focus:border-[#10D98E] shrink-0"
                      >
                        <option value="+226">🇧🇫 +226</option>
                        <option value="+225">🇨🇮 +225</option>
                        <option value="+221">🇸🇳 +221</option>
                        <option value="+223">🇲🇱 +223</option>
                        <option value="+228">🇹🇬 +228</option>
                        <option value="+229">🇧🇯 +229</option>
                        <option value="+227">🇳🇪 +227</option>
                        <option value="+224">🇬🇳 +224</option>
                        <option value="+237">🇨🇲 +237</option>
                        <option value="+241">🇬🇦 +241</option>
                        <option value="+242">🇨🇬 +242</option>
                        <option value="+243">🇨🇩 +243</option>
                        <option value="+33">🇫🇷 +33</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="">Autre</option>
                      </select>
                      <input
                        type="tel"
                        value={customPhone}
                        onChange={(e) => setCustomPhone(e.target.value)}
                        placeholder="70 00 00 00"
                        className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-xs text-white tabular-nums focus:outline-none focus:border-[#10D98E]"
                      />
                    </div>
                  ) : (
                    <select
                      value={selectedClientPhone}
                      onChange={(e) => setSelectedClientPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#10D98E]"
                    >
                      {recentContacts.map((c) => (
                        <option key={c.phone} value={c.phone}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {sendSuccess && (
                  <div className="p-3 rounded-xl bg-[#10D98E]/15 border border-[#10D98E]/30 text-xs text-[#10D98E] flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{sendSuccess}</span>
                  </div>
                )}

                {sendError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{sendError}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isSendingWhatsApp}
                onClick={handleSendFlashWhatsApp}
                className="w-full py-2.5 rounded-xl bg-[#10D98E] hover:bg-[#10D98E]/90 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSendingWhatsApp ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Expédition WhatsApp PTT en cours…</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Expédier la Note Vocale Native</span>
                  </>
                )}
              </button>
            </div>

            {/* ACTION B : CRÉER UNE AUTOMATISATION */}
            <div className="p-5 rounded-2xl bg-[#0D0F14] border border-white/[0.06] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#E2BD6B]/15 text-[#E2BD6B] flex items-center justify-center">
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Action B : Automatisation par Emoji</h3>
                </div>
                <p className="text-xs text-[#8A90A0] leading-relaxed">
                  Liez ce vocal à une réaction WhatsApp. Dès que vous réagissez avec cet emoji, le vocal partira automatiquement.
                </p>

                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#8A90A0] mb-1">
                        Emoji de réaction
                      </label>
                      <input
                        type="text"
                        value={ruleEmoji}
                        onChange={(e) => setRuleEmoji(e.target.value)}
                        placeholder="Ex : 🎵 ou 🎙️"
                        className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-white/[0.08] text-center text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#8A90A0] mb-1">
                        Nom de la règle
                      </label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        placeholder="Titre de la règle..."
                        className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                      />
                    </div>
                  </div>
                </div>

                {ruleSavedNotice && (
                  <div className="p-3 rounded-xl bg-[#E2BD6B]/15 border border-[#E2BD6B]/30 text-xs text-[#E2BD6B] flex items-center justify-between gap-2">
                    <span className="truncate">{ruleSavedNotice}</span>
                    {onOpenAutomations && (
                      <button
                        type="button"
                        onClick={onOpenAutomations}
                        className="underline text-white font-semibold shrink-0 cursor-pointer"
                      >
                        Voir
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isSavingRule}
                onClick={handleSaveAsAutomation}
                className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-white/[0.08] disabled:opacity-50"
              >
                {isSavingRule ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sauvegarde en cours…</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Enregistrer comme Automatisation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
