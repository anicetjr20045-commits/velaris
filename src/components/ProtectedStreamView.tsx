import { useState, useRef, useEffect, useCallback, type FC } from 'react';
import {
  Play,
  Pause,
  ShieldCheck,
  Disc3,
  Heart,
  ExternalLink,
  Volume2,
  VolumeX,
  ArrowLeft,
  Download,
  Lock,
  Loader2,
} from 'lucide-react';

export interface ProtectedTrackItem {
  index: number;
  title: string;
  streamUrl: string;
  downloadUrl?: string;
}

export interface ProtectedShareData {
  id: string;
  recipient: string;
  occasion: string;
  studioName?: string;
  creatorPhone?: string;
  track1Title: string;
  track1Url: string;
  track2Title?: string;
  track2Url?: string;
  tracks?: ProtectedTrackItem[];
  allowDownload?: boolean;
  createdAt: string;
}

interface ProtectedStreamViewProps {
  data: ProtectedShareData;
  onClose?: () => void;
}

export const ProtectedStreamView: FC<ProtectedStreamViewProps> = ({ data, onClose }) => {
  const trackList: ProtectedTrackItem[] =
    data.tracks && data.tracks.length > 0
      ? data.tracks
      : [
          {
            index: 1,
            title: data.track1Title || 'Version 01',
            streamUrl: data.track1Url,
            downloadUrl: data.allowDownload ? data.track1Url : undefined,
          },
          ...(data.track2Url
            ? [
                {
                  index: 2,
                  title: data.track2Title || 'Version 02',
                  streamUrl: data.track2Url,
                  downloadUrl: data.allowDownload ? data.track2Url : undefined,
                },
              ]
            : []),
        ];

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);

  // Lecteur Web Audio API chiffré (aucune balise <audio src> quand téléchargement interdit)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef<number>(0);
  const offsetSecRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  // Fallback <audio> uniquement si allowDownload === true et URL directe
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeTrack = trackList[selectedIdx] || trackList[0];
  const isProtectedWebAudio = !data.allowDownload && activeTrack?.streamUrl?.startsWith('/api/audio-stream');

  const formatClock = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Blocage des raccourcis clavier d'extraction quand verrouillé
  useEffect(() => {
    if (data.allowDownload) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ['s', 'u', 'p'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [data.allowDownload]);

  const stopWebAudioNode = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
  }, []);

  // Chargement de la piste sélectionnée
  useEffect(() => {
    stopWebAudioNode();
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    offsetSecRef.current = 0;
    audioBufferRef.current = null;

    if (!activeTrack?.streamUrl) return;

    if (isProtectedWebAudio) {
      let cancelled = false;
      setIsLoadingAudio(true);
      fetch(activeTrack.streamUrl, {
        headers: { 'X-Djelia-Player': '1' },
        cache: 'no-store',
      })
        .then((res) => {
          if (!res.ok) throw new Error('Flux protégé indisponible');
          return res.arrayBuffer();
        })
        .then(async (buf) => {
          if (cancelled) return;
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          if (!audioCtxRef.current) {
            audioCtxRef.current = new Ctx();
            gainNodeRef.current = audioCtxRef.current.createGain();
            gainNodeRef.current.connect(audioCtxRef.current.destination);
          }
          const decoded = await audioCtxRef.current.decodeAudioData(buf);
          if (cancelled) return;
          audioBufferRef.current = decoded;
          setDuration(decoded.duration);
          setIsLoadingAudio(false);
        })
        .catch(() => {
          if (!cancelled) setIsLoadingAudio(false);
        });

      return () => {
        cancelled = true;
        stopWebAudioNode();
      };
    } else if (htmlAudioRef.current) {
      setIsLoadingAudio(true);
      htmlAudioRef.current.currentTime = 0;
      htmlAudioRef.current.load();
    }
  }, [selectedIdx, activeTrack?.streamUrl, isProtectedWebAudio, stopWebAudioNode]);

  useEffect(() => {
    return () => {
      stopWebAudioNode();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [stopWebAudioNode]);

  const startWebAudioFrom = useCallback(
    async (startOffset: number) => {
      const ctx = audioCtxRef.current;
      const gain = gainNodeRef.current;
      const buffer = audioBufferRef.current;
      if (!ctx || !gain || !buffer) return;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      stopWebAudioNode();

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      gain.gain.value = isMuted ? 0 : 1;
      src.connect(gain);

      const safeOffset = Math.max(0, Math.min(startOffset, buffer.duration));
      offsetSecRef.current = safeOffset;
      startedAtRef.current = ctx.currentTime - safeOffset;

      src.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        setProgress(0);
        offsetSecRef.current = 0;
        cancelAnimationFrame(rafRef.current);
      };

      src.start(0, safeOffset);
      sourceNodeRef.current = src;
      setIsPlaying(true);

      const tick = () => {
        if (!audioCtxRef.current || !audioBufferRef.current) return;
        const elapsed = audioCtxRef.current.currentTime - startedAtRef.current;
        const dur = audioBufferRef.current.duration;
        if (elapsed <= dur) {
          setCurrentTime(elapsed);
          setProgress(dur > 0 ? (elapsed / dur) * 100 : 0);
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [isMuted, stopWebAudioNode]
  );

  const togglePlay = () => {
    if (isProtectedWebAudio) {
      if (!audioBufferRef.current || !audioCtxRef.current) return;
      if (isPlaying) {
        offsetSecRef.current = audioCtxRef.current.currentTime - startedAtRef.current;
        stopWebAudioNode();
        setIsPlaying(false);
      } else {
        void startWebAudioFrom(offsetSecRef.current);
      }
      return;
    }

    if (!htmlAudioRef.current) return;
    if (isPlaying) {
      htmlAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      htmlAudioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = ratio * duration;

    if (isProtectedWebAudio) {
      offsetSecRef.current = targetSec;
      setCurrentTime(targetSec);
      setProgress(ratio * 100);
      if (isPlaying) {
        void startWebAudioFrom(targetSec);
      }
      return;
    }

    if (htmlAudioRef.current) {
      htmlAudioRef.current.currentTime = targetSec;
      setProgress(ratio * 100);
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = next ? 0 : 1;
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.muted = next;
    }
  };

  const handleValidatePreference = () => {
    if (!data.creatorPhone) return;
    const cleanPhone = data.creatorPhone.replace(/\D/g, '');
    const verName = activeTrack?.title || 'Version 1';
    const msg = `Bonjour ! J'ai écouté la chanson pour ${data.recipient} et je valide mon choix : je préfère la *${verName}* !`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const downloadUrl = activeTrack?.downloadUrl || (data.allowDownload ? activeTrack?.streamUrl : undefined);

  return (
    <div
      onContextMenu={(e) => {
        if (!data.allowDownload) e.preventDefault();
      }}
      onDragStart={(e) => {
        if (!data.allowDownload) e.preventDefault();
      }}
      className="min-h-screen bg-[#050608] text-white flex flex-col justify-between select-none relative overflow-hidden font-sans"
    >
      {/* Halo architectural doré d'arrière-plan */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[560px] rounded-full bg-[#E5B54F]/[0.08] blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-white/[0.02] blur-[100px]"
      />

      {/* Barre supérieure */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-white/[0.08] bg-[#07080B]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors text-neutral-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] sm:text-[12px] uppercase tracking-wider text-neutral-300">
              {data.studioName || 'Djelia Studio'} · Audition Privée
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{data.allowDownload ? 'Téléchargement Actif' : 'Écoute Protégée'}</span>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="relative z-10 max-w-xl w-full mx-auto px-5 sm:px-6 py-8 sm:py-10 flex-1 flex flex-col justify-center">
        {/* Disque Vinyle / Visuel Studio */}
        <div className="text-center space-y-4">
          <div className="relative mx-auto h-44 w-44 sm:h-52 sm:w-52 flex items-center justify-center">
            <div
              className={`h-full w-full rounded-full border border-white/15 bg-gradient-to-tr from-[#0E1015] via-[#16181F] to-[#0A0B0E] flex items-center justify-center shadow-[0_24px_64px_-16px_rgba(229,181,79,0.25)] transition-transform duration-700 ${
                isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
              }`}
            >
              <div className="absolute inset-4 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-8 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-12 rounded-full border border-white/[0.04]" />

              <div className="h-20 w-20 rounded-full border border-white/20 bg-[#E5B54F]/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                <Disc3 className="h-10 w-10 text-[#E5B54F]" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#E5B54F] font-medium">
              {data.occasion || 'Création Sur-Mesure'}
            </span>
            <h1 className="font-serif italic text-2xl sm:text-3xl text-white mt-1">
              Chanson dédiée à {data.recipient}
            </h1>
            <p className="text-[13px] text-neutral-400 mt-1">
              En écoute : <strong className="text-white font-medium">{activeTrack?.title}</strong>
            </p>
          </div>
        </div>

        {/* Sélecteur Multi-Versions (1, 2, ou N pistes) */}
        {trackList.length > 1 && (
          <div className="mt-7 flex flex-wrap justify-center gap-1.5">
            {trackList.map((tr, i) => (
              <button
                key={tr.index}
                type="button"
                onClick={() => setSelectedIdx(i)}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all cursor-pointer border ${
                  selectedIdx === i
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/[0.03] border-white/10 text-neutral-400 hover:text-white'
                }`}
              >
                {i + 1}. {tr.title}
              </button>
            ))}
          </div>
        )}

        {/* Barre de progression & Lecteur */}
        <div className="mt-7 rounded-3xl border border-white/10 bg-[#0B0C10] p-6 space-y-4 shadow-2xl">
          {!isProtectedWebAudio && (
            <audio
              ref={htmlAudioRef}
              src={activeTrack?.streamUrl}
              controlsList={data.allowDownload ? undefined : 'nodownload noplaybackrate'}
              onCanPlay={() => setIsLoadingAudio(false)}
              onTimeUpdate={() => {
                if (!htmlAudioRef.current) return;
                const cur = htmlAudioRef.current.currentTime;
                const dur = htmlAudioRef.current.duration;
                setCurrentTime(cur);
                setDuration(dur);
                if (dur > 0) setProgress((cur / dur) * 100);
              }}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}

          {/* Barre de timeline cliquable */}
          <div
            onClick={handleSeek}
            className="group relative h-3.5 w-full rounded-full bg-white/10 cursor-pointer overflow-hidden transition-all hover:h-4"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#E5B54F] transition-[width] duration-100 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[12px] font-mono text-neutral-400">
            <span>{formatClock(currentTime)}</span>
            <span>{formatClock(duration)}</span>
          </div>

          {/* Boutons de contrôle */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoadingAudio && !duration}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E5B54F] text-[#050608] hover:bg-[#F3CA75] active:scale-95 transition-all shadow-[0_0_24px_rgba(229,181,79,0.35)] cursor-pointer disabled:opacity-50"
            >
              {isLoadingAudio && !duration ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-6 w-6 fill-current" />
              ) : (
                <Play className="h-6 w-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className="p-2.5 rounded-full border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Bouton Télécharger (uniquement si autorisé par le créateur) */}
        {data.allowDownload && downloadUrl && (
          <div className="mt-6">
            <a
              href={`/api/suno?action=download&url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(
                `${data.recipient}_${activeTrack?.title || 'Master'}.mp3`.replace(/\s+/g, '_')
              )}`}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-3.5 text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Télécharger le Master MP3 ({activeTrack?.title})</span>
            </a>
          </div>
        )}

        {/* Bouton de confirmation du choix vers le créateur sur WhatsApp */}
        {data.creatorPhone && (
          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={handleValidatePreference}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3.5 text-sm transition-all shadow-[0_8px_24px_-4px_rgba(16,185,129,0.3)] active:scale-[0.98] cursor-pointer"
            >
              <Heart className="h-4 w-4 fill-current text-black" />
              <span>Valider « {activeTrack?.title} » sur WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </button>
            <p className="text-center text-[11.5px] text-neutral-500">
              Confirmez votre version préférée en un tap sur WhatsApp.
            </p>
          </div>
        )}
      </main>

      {/* Footer architectural de protection */}
      <footer className="relative z-10 px-6 py-4 text-center border-t border-white/[0.08] bg-[#07080B]/60 text-[11.5px] text-neutral-500 flex items-center justify-center gap-2">
        <Lock className="h-3 w-3 text-neutral-400" />
        <span>
          {data.allowDownload
            ? 'Diffusion sous licence studio · Téléchargement autorisé par le créateur'
            : 'Diffusion audio chiffrée exclusive · Téléchargement et capture désactivés'}
        </span>
      </footer>
    </div>
  );
};
