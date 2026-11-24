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
} from 'lucide-react';
import {
  FISH_VOICES,
  generateFishVoice,
  type FishVoiceItem,
} from '../services/fishVoice';
import { sendWahaVoiceMessage, wahaSessionNameFor } from '../services/waha';
import { saveAutomationRule, uploadAutomationMedia } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { VoiceNoteRecorder, type VoiceRecording } from './VoiceNoteRecorder';
import { transcribeAudioBlob } from '../services/whisper-stt';
import type { Order } from '../types';

interface VoiceLabViewProps {
  orders: Order[];
  onBackToHub: () => void;
  onOpenAutomations?: () => void;
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

  // Écoute des extraits de voix du catalogue
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mode de création : Parler au micro (Speech-to-Speech) ou Rédiger au clavier
  const [creationMode, setCreationMode] = useState<'record' | 'write'>('record');

  // Traitement Speech-to-Speech
  const [isProcessingSpeech, setIsProcessingSpeech] = useState<boolean>(false);
  const [speechStep, setSpeechStep] = useState<'idle' | 'transcribing' | 'synthesizing'>('idle');

  // Texte à synthétiser (vide par défaut, sans templates)
  const [scriptText, setScriptText] = useState<string>('');

  // Génération principale
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedAudio, setGeneratedAudio] = useState<{
    blob: Blob;
    url: string;
    mimeType: string;
    text: string;
    voiceName: string;
  } | null>(null);

  // Lecteur de l'audio généré
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingGenerated, setIsPlayingGenerated] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);

  // Envoi Flash WhatsApp
  const [selectedClientPhone, setSelectedClientPhone] = useState<string>(
    orders[0]?.clientPhone || ''
  );
  const [customPhone, setCustomPhone] = useState<string>('');
  const [useCustomPhone, setUseCustomPhone] = useState<boolean>(orders.length === 0);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

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
      if (mainAudioRef.current) mainAudioRef.current.pause();
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
      const result = await generateFishVoice(voice.sampleText, voice.reference_id, 'mp3');
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

  // Traitement direct de l'enregistrement micro (Speech-to-Speech instantané)
  const handleRecordComplete = async (recording: VoiceRecording) => {
    setIsProcessingSpeech(true);
    setSpeechStep('transcribing');
    setSendSuccess(null);
    setSendError(null);
    setRuleSavedNotice(null);

    try {
      // 1. Transcription Whisper VPS
      const transcription = await transcribeAudioBlob(recording.blob);
      const spokenText = transcription.text.trim();

      if (!spokenText) {
        showToast('Aucun mot distinct détecté. Rapprochez-vous du micro et réessayez.', false);
        setIsProcessingSpeech(false);
        setSpeechStep('idle');
        return;
      }

      setScriptText(spokenText);

      // 2. Synthèse immédiate dans la voix choisie (Fish Audio)
      setSpeechStep('synthesizing');
      const synth = await generateFishVoice(spokenText, selectedVoice.reference_id, 'mp3');

      setGeneratedAudio({
        blob: synth.blob,
        url: synth.url,
        mimeType: synth.mimeType,
        text: spokenText,
        voiceName: selectedVoice.name,
      });

      setRuleName(`Vocal ${selectedVoice.name} · ${spokenText.slice(0, 24)}...`);
      showToast(`Vocal transformé avec succès dans la voix de ${selectedVoice.name} !`, true);
    } catch (err: any) {
      showToast(`Erreur lors de la transformation vocale : ${err.message}`, false);
    } finally {
      setIsProcessingSpeech(false);
      setSpeechStep('idle');
    }
  };

  // Lancement de la synthèse vocale depuis le texte manuel
  const handleGenerateFromText = async () => {
    const clean = scriptText.trim();
    if (!clean) {
      showToast('Veuillez saisir le texte à prononcer.', false);
      return;
    }

    setIsGenerating(true);
    setSendSuccess(null);
    setSendError(null);
    setRuleSavedNotice(null);

    try {
      const result = await generateFishVoice(clean, selectedVoice.reference_id, 'mp3');
      setGeneratedAudio({
        blob: result.blob,
        url: result.url,
        mimeType: result.mimeType,
        text: clean,
        voiceName: selectedVoice.name,
      });
      setRuleName(`Vocal ${selectedVoice.name} · ${clean.slice(0, 24)}...`);
      showToast(`Note vocale générée avec succès (${selectedVoice.name}) !`, true);
    } catch (err: any) {
      showToast(`Erreur de génération : ${err.message}`, false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Envoi Flash direct sur WhatsApp en format PTT natif
  const handleSendFlashWhatsApp = async () => {
    if (!generatedAudio) return;

    const targetPhone = useCustomPhone ? customPhone.trim() : selectedClientPhone.trim();
    if (!targetPhone) {
      setSendError('Veuillez sélectionner un client ou indiquer un numéro WhatsApp.');
      return;
    }

    setIsSendingWhatsApp(true);
    setSendSuccess(null);
    setSendError(null);

    try {
      const res = await sendWahaVoiceMessage(targetPhone, generatedAudio.blob, sessionName);
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
    if (!generatedAudio) return;
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
          generatedAudio.blob,
          `voice_${selectedVoice.id}_${Date.now()}.mp3`
        );
        if ('path' in uploadRes) {
          mediaPath = uploadRes.path;
        }
      }

      await saveAutomationRule({
        name: ruleName.trim(),
        emoji: ruleEmoji.trim() || '🎵',
        action: generatedAudio.text,
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
      {/* Lecteur audio caché pour les extraits de voix */}
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
              <span className="text-xs text-[#8A90A0]">Transformation Vocale & Synthèse Fish Audio</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Studio Vocal & Voix IA
            </h1>
            <p className="text-xs text-[#8A90A0] max-w-xl leading-relaxed">
              Enregistrez directement votre voix au micro pour la métamorphoser dans la voix de votre choix, ou rédigez un texte libre. Vos messages partent sur WhatsApp sous forme de vraies notes vocales natives (PTT).
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
            <h2 className="text-base font-semibold text-white">01. Choisissez la Voix Studio</h2>
            <p className="text-xs text-[#8A90A0]">
              Sélectionnez le timbre qui portera votre message.
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
                onClick={() => setSelectedVoice(voice)}
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

      {/* 3. ATELIER D'ENREGISTREMENT & TRANSFORMATION */}
      <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-white">02. Votre Message Vocal</h2>
            <p className="text-xs text-[#8A90A0]">
              Enregistrez votre voix pour une métamorphose instantanée ou saisissez votre texte au clavier.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-[#E2BD6B] bg-[#E2BD6B]/10 px-3 py-1 rounded-full border border-[#E2BD6B]/20">
            <Radio className="w-3 h-3" />
            <span>Voix active : {selectedVoice.name}</span>
          </div>
        </div>

        {/* SÉLECTEUR DE MODE : MICRO OU CLAVIER */}
        <div className="inline-flex p-1 rounded-2xl bg-[#08090C] border border-white/[0.06] gap-1">
          <button
            type="button"
            onClick={() => setCreationMode('record')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              creationMode === 'record'
                ? 'bg-white text-black shadow-md'
                : 'text-[#8A90A0] hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Enregistrer au micro (Automatique)</span>
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
            <span>Saisir le texte au clavier</span>
          </button>
        </div>

        {/* CONTENU MODE 1 : ENREGISTREMENT MICRO (SPEECH-TO-SPEECH) */}
        {creationMode === 'record' && (
          <div className="space-y-4">
            {isProcessingSpeech ? (
              <div className="p-8 rounded-2xl bg-[#08090C] border border-[#E2BD6B]/30 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-[#E2BD6B]/15 flex items-center justify-center text-[#E2BD6B]">
                    <RotateCw className="w-6 h-6 animate-spin" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {speechStep === 'transcribing'
                      ? 'Transcription de votre voix en cours (Whisper)…'
                      : `Transformation dans la voix de ${selectedVoice.name}…`}
                  </p>
                  <p className="text-xs text-[#8A90A0]">
                    {speechStep === 'transcribing'
                      ? 'Analyse audio haute fidélité…'
                      : 'Synthèse vocale Fish Audio en cours…'}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-[#8A90A0]">
                  <span className={speechStep === 'transcribing' ? 'text-[#E2BD6B] font-bold' : 'text-[#10D98E]'}>
                    01. Transcription
                  </span>
                  <span>→</span>
                  <span className={speechStep === 'synthesizing' ? 'text-[#E2BD6B] font-bold' : ''}>
                    02. Voix {selectedVoice.name}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <VoiceNoteRecorder
                  autoSubmitOnStop={true}
                  maxSeconds={120}
                  confirmLabel={`Transformer avec ${selectedVoice.name}`}
                  onComplete={handleRecordComplete}
                />
                <p className="text-[11px] text-[#8A90A0] flex items-center gap-1.5">
                  <Mic className="w-3 h-3 text-[#E2BD6B]" />
                  <span>Dès que vous cliquez sur <strong>« Terminer »</strong>, votre voix est automatiquement retranscrite et transformée avec le timbre de {selectedVoice.name}.</span>
                </p>
              </div>
            )}

            {/* Aperçu du texte transcrit si disponible */}
            {scriptText && !isProcessingSpeech && (
              <div className="p-4 rounded-2xl bg-[#08090C] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A90A0] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#E2BD6B]" />
                    <span>Texte retranscrit :</span>
                  </span>
                  <span className="text-[11px] font-mono text-white/40">{scriptText.length} caractères</span>
                </div>
                <p className="text-xs text-white leading-relaxed italic bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                  « {scriptText} »
                </p>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleGenerateFromText}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white transition-colors cursor-pointer"
                  >
                    <RotateCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Regénérer avec {selectedVoice.name}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTENU MODE 2 : SAISIE TEXTE CLASSIQUE */}
        {creationMode === 'write' && (
          <div className="space-y-3">
            <textarea
              rows={4}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Tapez le texte exact que vous souhaitez entendre sous forme de note vocale WhatsApp..."
              className="w-full p-4 rounded-2xl bg-[#08090C] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B] leading-relaxed resize-none"
            />
            <div className="flex items-center justify-between text-[11px] text-[#8A90A0]">
              <span>Moteur Fish Audio s2.1 · Rendu PTT WhatsApp</span>
              <span className="font-mono">{scriptText.length} caractères</span>
            </div>

            <button
              type="button"
              disabled={isGenerating || !scriptText.trim()}
              onClick={handleGenerateFromText}
              className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-white/10"
            >
              {isGenerating ? (
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

      {/* 4. RÉSULTAT GÉNÉRÉ & DEUX ACTIONS IMMÉDIATES */}
      {generatedAudio && (
        <section className="rounded-3xl bg-[#08090C] border border-[#E2BD6B]/30 p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          {/* Lecteur de la note vocale générée */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10D98E] animate-pulse" />
                <p className="text-sm font-bold text-white">
                  Note Vocale Prête · {generatedAudio.voiceName}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-[#10D98E]/15 text-[#10D98E] text-[10px] font-mono font-semibold">
                  PTT WhatsApp Natif
                </span>
              </div>

              <a
                href={generatedAudio.url}
                download={`vocal_${selectedVoice.id}.mp3`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger MP3</span>
              </a>
            </div>

            {/* Lecteur HTML5 natif propre */}
            <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (mainAudioRef.current) {
                    if (isPlayingGenerated) {
                      mainAudioRef.current.pause();
                      setIsPlayingGenerated(false);
                    } else {
                      mainAudioRef.current.play();
                      setIsPlayingGenerated(true);
                    }
                  }
                }}
                className="w-11 h-11 rounded-full bg-[#E2BD6B] hover:bg-[#E2BD6B]/90 text-black flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-lg shadow-[#E2BD6B]/20"
              >
                {isPlayingGenerated ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <audio
                ref={mainAudioRef}
                src={generatedAudio.url}
                onTimeUpdate={() => {
                  if (mainAudioRef.current) {
                    const pct =
                      (mainAudioRef.current.currentTime / mainAudioRef.current.duration) * 100 || 0;
                    setPlaybackProgress(pct);
                  }
                }}
                onEnded={() => {
                  setIsPlayingGenerated(false);
                  setPlaybackProgress(0);
                }}
                className="hidden"
              />

              <div className="flex-1 space-y-1.5">
                <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full bg-[#E2BD6B] rounded-full transition-all duration-100"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>
                <p className="text-xs text-[#8A90A0] line-clamp-1 italic">
                  « {generatedAudio.text} »
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
                    <span className="text-[#8A90A0]">Destinataire</span>
                    <button
                      type="button"
                      onClick={() => setUseCustomPhone((v) => !v)}
                      className="text-[#E2BD6B] hover:underline cursor-pointer"
                    >
                      {useCustomPhone ? 'Choisir un client' : 'Numéro personnalisé'}
                    </button>
                  </div>

                  {useCustomPhone || orders.length === 0 ? (
                    <input
                      type="tel"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="+226 70 00 00 00 ou +225..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-xs text-white tabular-nums focus:outline-none focus:border-[#10D98E]"
                    />
                  ) : (
                    <select
                      value={selectedClientPhone}
                      onChange={(e) => setSelectedClientPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#10D98E]"
                    >
                      {orders.map((o) => (
                        <option key={o.id} value={o.clientPhone}>
                          {o.clientName} ({o.clientPhone || 'Sans numéro'}) · {o.occasion}
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
