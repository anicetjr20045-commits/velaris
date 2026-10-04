import { useState, useRef, useEffect, type FC } from 'react';
import {
  Play,
  Pause,
  ShieldCheck,
  Disc3,
  Heart,
  ExternalLink,
  Volume2,
  VolumeX,
  ArrowLeft
} from 'lucide-react';

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
  createdAt: string;
}

interface ProtectedStreamViewProps {
  data: ProtectedShareData;
  onClose?: () => void;
}

export const ProtectedStreamView: FC<ProtectedStreamViewProps> = ({ data, onClose }) => {
  const [selectedTrack, setSelectedTrack] = useState<1 | 2>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentUrl = selectedTrack === 1 ? data.track1Url : data.track2Url;
  const currentTitle = selectedTrack === 1 ? data.track1Title : (data.track2Title || 'Version 2');

  const formatClock = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
  }, [selectedTrack]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration;
    setCurrentTime(cur);
    setDuration(dur);
    if (dur > 0) {
      setProgress((cur / dur) * 100);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setProgress(ratio * 100);
  };

  const handleValidatePreference = (versionNum: 1 | 2) => {
    if (!data.creatorPhone) return;
    const cleanPhone = data.creatorPhone.replace(/\D/g, '');
    const verName = versionNum === 1 ? data.track1Title : (data.track2Title || 'Version 2');
    const msg = `Bonjour ! J'ai écouté la chanson pour ${data.recipient} et je valide mon choix : je préfère la *${verName}* ! ✨`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen bg-[#050608] text-white flex flex-col justify-between select-none relative overflow-hidden"
    >
      {/* Halo de fond doré */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-[#E5B54F]/[0.08] blur-[120px]"
      />

      {/* Barre supérieure */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-[#07080B]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[12px] uppercase tracking-wider text-neutral-400">
              {data.studioName || 'Studio Velaris'} · Écoute Privée Sécurisée
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Diffusion Protégée</span>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="relative z-10 max-w-xl w-full mx-auto px-6 py-10 flex-1 flex flex-col justify-center">
        {/* Disque Vinyle / Visuel */}
        <div className="text-center space-y-4">
          <div className="relative mx-auto h-48 w-48 sm:h-56 sm:w-56 flex items-center justify-center">
            <div className={`h-full w-full rounded-full border border-white/15 bg-gradient-to-tr from-[#0E1015] to-[#1A1813] flex items-center justify-center shadow-[0_20px_60px_-15px_rgba(229,181,79,0.25)] ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
              <div className="h-20 w-20 rounded-full border border-white/20 bg-[#E5B54F]/20 flex items-center justify-center">
                <Disc3 className="h-10 w-10 text-[#E5B54F]" />
              </div>
            </div>
          </div>

          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#E5B54F]">
              {data.occasion}
            </span>
            <h1 className="font-serif italic text-2xl sm:text-3xl text-white mt-1">
              Chanson personnalisée pour {data.recipient}
            </h1>
            <p className="text-[13px] text-neutral-400 mt-1">
              Actuellement en écoute : <strong className="text-white font-medium">{currentTitle}</strong>
            </p>
          </div>
        </div>

        {/* Sélecteur de Version (si 2 morceaux) */}
        {data.track2Url && (
          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 gap-1">
              <button
                type="button"
                onClick={() => setSelectedTrack(1)}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all cursor-pointer ${
                  selectedTrack === 1 ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'
                }`}
              >
                1. {data.track1Title}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTrack(2)}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all cursor-pointer ${
                  selectedTrack === 2 ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-white'
                }`}
              >
                2. {data.track2Title || 'Version 2'}
              </button>
            </div>
          </div>
        )}

        {/* Barre de progression & Lecteur */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0B0C10] p-6 space-y-4 shadow-xl">
          <audio
            ref={audioRef}
            src={currentUrl}
            controlsList="nodownload noplaybackrate"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          {/* Barre de timeline cliquable */}
          <div
            onClick={handleSeek}
            className="group relative h-3 w-full rounded-full bg-white/10 cursor-pointer overflow-hidden"
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
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E5B54F] text-[#050608] hover:bg-[#F3CA75] active:scale-95 transition-all shadow-[0_0_24px_rgba(229,181,79,0.35)] cursor-pointer"
            >
              {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-2 rounded-full border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Bouton de confirmation du choix vers le créateur */}
        {data.creatorPhone && (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => handleValidatePreference(selectedTrack)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3.5 text-sm transition-all shadow-[0_8px_24px_-4px_rgba(16,185,129,0.3)] active:scale-[0.98] cursor-pointer"
            >
              <Heart className="h-4 w-4 fill-current text-black" />
              <span>Valider la {currentTitle} sur WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </button>
            <p className="text-center text-[11.5px] text-neutral-500">
              Un message pré-rempli s'ouvrira sur WhatsApp pour confirmer votre choix au studio.
            </p>
          </div>
        )}
      </main>

      {/* Footer de protection */}
      <footer className="relative z-10 px-6 py-4 text-center border-t border-white/[0.08] bg-[#07080B]/60 text-[11.5px] text-neutral-500">
        🔒 Diffusion sous licence privée exclusive · Téléchargement et extraction numérique désactivés
      </footer>
    </div>
  );
};
