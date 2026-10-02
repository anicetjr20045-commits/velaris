import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { AlertCircle, Check, Loader2, Mic, RotateCcw, Square, Trash2 } from 'lucide-react';
import { WaveformPlayer, formatClock } from './WaveformPlayer';

export interface VoiceRecording {
  blob: Blob;
  /** URL objet de prévisualisation ; appartient à l'appelant après `onComplete` */
  url: string;
  mimeType: string;
  durationSec: number;
  /** Niveaux mesurés toutes les 50 ms (0..1) */
  peaks: number[];
}

interface VoiceNoteRecorderProps {
  onComplete: (rec: VoiceRecording) => void | Promise<void>;
  onCancel?: () => void;
  maxSeconds?: number;
  confirmLabel?: string;
  /** Démarre l'enregistrement dès l'ouverture */
  autoStart?: boolean;
}

type Phase = 'idle' | 'requesting' | 'recording' | 'review' | 'error';

const SAMPLE_MS = 50;
const BAR_W = 3;
const BAR_GAP = 2;

/* OGG/Opus d'abord : c'est le format natif des vocaux WhatsApp (Firefox). Chrome produit du webm/opus. */
const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) ?? '';
};

const micErrorMessage = (err: unknown) => {
  const name = (err as DOMException)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Accès au micro refusé. Autorisez le micro pour ce site dans les réglages du navigateur.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucun micro détecté sur cet appareil.';
  if (name === 'NotReadableError') return 'Le micro est déjà utilisé par une autre application.';
  return "Impossible de démarrer l'enregistrement.";
};

export const VoiceNoteRecorder: FC<VoiceNoteRecorderProps> = ({
  onComplete,
  onCancel,
  maxSeconds = 120,
  confirmLabel = 'Utiliser ce vocal',
  autoStart = false,
}) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const frameRef = useRef(0);
  const peaksRef = useRef<number[]>([]);
  const discardRef = useRef(false);
  const ownedUrlRef = useRef<string | null>(null);

  const releaseDevices = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  const revokeOwned = () => {
    if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
    ownedUrlRef.current = null;
  };

  /* Visualiseur : barres qui défilent de droite à gauche, la plus récente en or */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const slots = Math.floor(w / (BAR_W + BAR_GAP));
    const levels = peaksRef.current.slice(-slots);
    const offset = slots - levels.length;
    for (let i = 0; i < slots; i++) {
      const level = i < offset ? 0 : levels[i - offset];
      const barH = Math.max(2, level * (h - 4));
      const age = (slots - i) / slots;
      g.fillStyle = i < offset ? 'rgba(255,255,255,0.08)' : `rgba(229,181,79,${Math.max(0.28, 1 - age * 0.85)})`;
      const x = i * (BAR_W + BAR_GAP);
      g.beginPath();
      g.roundRect(x, (h - barH) / 2, BAR_W, barH, 1.5);
      g.fill();
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    revokeOwned();
    setRecording(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError("Ce navigateur ne permet pas l'enregistrement audio (connexion HTTPS requise).");
      setPhase('error');
      return;
    }
    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      peaksRef.current = [];
      discardRef.current = false;
      const t0 = performance.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        releaseDevices();
        if (discardRef.current) return;
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        const url = URL.createObjectURL(blob);
        ownedUrlRef.current = url;
        setRecording({ blob, url, mimeType: type, durationSec: (performance.now() - t0) / 1000, peaks: peaksRef.current.slice() });
        setPhase('review');
      };

      let lastSample = 0;
      const loop = (now: number) => {
        if (now - lastSample >= SAMPLE_MS) {
          lastSample = now;
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
          peaksRef.current.push(Math.min(1, Math.sqrt(Math.sqrt(sum / buffer.length)) * 1.6));
          const secs = (now - t0) / 1000;
          setElapsed(Math.floor(secs * 10) / 10);
          if (secs >= maxSeconds) {
            draw();
            stop();
            return;
          }
          draw();
        }
        frameRef.current = requestAnimationFrame(loop);
      };

      recorder.start(250);
      setElapsed(0);
      setPhase('recording');
      frameRef.current = requestAnimationFrame(loop);
    } catch (err) {
      releaseDevices();
      setError(micErrorMessage(err));
      setPhase('error');
    }
  }, [draw, maxSeconds, releaseDevices, stop]);

  const discard = () => {
    discardRef.current = true;
    stop();
    releaseDevices();
    revokeOwned();
    setRecording(null);
    setPhase('idle');
    onCancel?.();
  };

  const confirm = async () => {
    if (!recording) return;
    setSubmitting(true);
    ownedUrlRef.current = null; // l'appelant devient propriétaire de l'URL
    try {
      await onComplete(recording);
    } finally {
      setSubmitting(false);
      setRecording(null);
      setPhase('idle');
    }
  };

  const startOnMount = useRef(autoStart);
  useEffect(() => {
    if (startOnMount.current) {
      startOnMount.current = false;
      start();
    }
  }, [start]);

  useEffect(
    () => () => {
      discardRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
      releaseDevices();
      revokeOwned();
    },
    [releaseDevices]
  );

  return (
    <div className="vx-fade-in rounded-2xl border border-white/[0.08] bg-[#08090C] p-3" aria-live="polite">
      {phase === 'recording' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={discard}
            aria-label="Annuler l'enregistrement"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#A3A3A3] hover:text-[#FB7185] hover:bg-[#E11D48]/10 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.6} />
          </button>
          <span className="flex shrink-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#F43F5E] vx-breathe" />
            <span className="font-mono text-[13px] tabular-nums text-white">{formatClock(elapsed)}</span>
            <span className="hidden sm:inline font-mono text-[11.5px] tabular-nums text-neutral-600">/ {formatClock(maxSeconds)}</span>
          </span>
          <canvas ref={canvasRef} className="h-10 min-w-0 flex-1" aria-label="Niveau du micro en temps réel" />
          <button
            type="button"
            onClick={stop}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer"
          >
            <Square className="h-3 w-3" fill="currentColor" />
            Terminer
          </button>
        </div>
      )}

      {phase === 'review' && recording && (
        <div className="space-y-3">
          <WaveformPlayer seed={recording.url} src={recording.url} peaks={recording.peaks} durationHint={recording.durationSec} bars={40} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={discard}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-[#A3A3A3] hover:text-[#FB7185] transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                Supprimer
              </button>
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
                Recommencer
              </button>
            </div>
            <button
              type="button"
              onClick={confirm}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press cursor-pointer disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.2} />}
              {confirmLabel}
            </button>
          </div>
        </div>
      )}

      {(phase === 'idle' || phase === 'requesting' || phase === 'error') && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={phase === 'requesting'}
            aria-label="Démarrer l'enregistrement"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5B54F] text-[#050608] hover:bg-[#F0C068] active:scale-95 transition-all duration-150 ease-press cursor-pointer disabled:opacity-60"
          >
            {phase === 'requesting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" strokeWidth={2} />}
          </button>
          <div className="min-w-0 flex-1">
            {error ? (
              <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-[#FDA4AF]">
                <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                {error}
              </p>
            ) : (
              <>
                <p className="text-[13px] font-medium text-white">{phase === 'requesting' ? 'Autorisation du micro…' : 'Enregistrer une note vocale'}</p>
                <p className="text-[12px] text-neutral-500">{formatClock(maxSeconds)} maximum · réécoute avant envoi</p>
              </>
            )}
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={discard}
              className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
            >
              Fermer
            </button>
          )}
        </div>
      )}
    </div>
  );
};
