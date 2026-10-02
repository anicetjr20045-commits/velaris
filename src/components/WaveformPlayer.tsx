import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent, type PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';

/* Hash stable pour générer une forme d'onde propre à chaque note */
const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* Forme d'onde pseudo-aléatoire mais stable pour une même note */
export const waveformFor = (seed: string, count = 32) => {
  let h = hashString(seed);
  return Array.from({ length: count }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const envelope = Math.sin((i / (count - 1)) * Math.PI) * 0.55 + 0.35;
    return Math.max(0.18, Math.min(1, envelope * (0.55 + ((h % 1000) / 1000) * 0.75)));
  });
};

/* Ramène une série de niveaux mesurés (0..1) à `count` barres normalisées */
export const resamplePeaks = (peaks: number[], count: number) => {
  if (peaks.length === 0) return Array.from({ length: count }, () => 0.18);
  const out = Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i / count) * peaks.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * peaks.length));
    let max = 0;
    for (let j = from; j < to && j < peaks.length; j++) max = Math.max(max, peaks[j]);
    return max;
  });
  const top = Math.max(...out, 0.001);
  return out.map(v => Math.max(0.12, Math.min(1, v / top)));
};

export const formatClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const RATES = [1, 1.5, 2] as const;

/* Un seul lecteur actif à la fois, comme dans WhatsApp */
let stopActive: (() => void) | null = null;

interface WaveformPlayerProps {
  /** Graine de la forme d'onde quand aucun niveau mesuré n'est fourni */
  seed: string;
  /** Source audio réelle ; sans source, la lecture est une prévisualisation temporelle */
  src?: string;
  /** Niveaux mesurés à l'enregistrement (0..1) */
  peaks?: number[];
  /** Durée connue en secondes (les webm de MediaRecorder n'exposent pas leur durée) */
  durationHint?: number;
  /** `light` pour une bulle blanche (message sortant) */
  tone?: 'dark' | 'light';
  bars?: number;
}

export const WaveformPlayer: FC<WaveformPlayerProps> = ({ seed, src, peaks, durationHint, tone = 'dark', bars = 32 }) => {
  const levels = useMemo(() => (peaks && peaks.length ? resamplePeaks(peaks, bars) : waveformFor(seed, bars)), [peaks, seed, bars]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rateIdx, setRateIdx] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const progressRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const duration = mediaDuration ?? durationHint ?? 15;
  const rate = RATES[rateIdx];

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = 'metadata';
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setMediaDuration(audio.duration);
    };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    if (!playing) return;
    const audio = audioRef.current;
    let frame = 0;
    let last = performance.now();
    const finish = () => {
      progressRef.current = 0;
      setProgress(0);
      setPlaying(false);
    };
    const tick = (now: number) => {
      progressRef.current = audio
        ? Math.min(1, audio.currentTime / duration)
        : Math.min(1, progressRef.current + ((now - last) / 1000) * (rate / duration));
      last = now;
      setProgress(progressRef.current);
      if (progressRef.current >= 1 && !audio) return finish();
      frame = requestAnimationFrame(tick);
    };
    audio?.addEventListener('ended', finish);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      audio?.removeEventListener('ended', finish);
    };
  }, [playing, duration, rate]);

  const [pauseSelf] = useState(() => () => {
    audioRef.current?.pause();
    setPlaying(false);
  });

  useEffect(() => () => {
    if (stopActive === pauseSelf) stopActive = null;
  }, [pauseSelf]);

  const toggle = () => {
    if (playing) return pauseSelf();
    if (stopActive && stopActive !== pauseSelf) stopActive();
    stopActive = pauseSelf;
    const audio = audioRef.current;
    if (audio) {
      if (audio.ended || progressRef.current === 0) audio.currentTime = 0;
      audio.play().catch(() => setPlaying(false));
    }
    setPlaying(true);
  };

  const seekTo = (ratio: number) => {
    const r = Math.max(0, Math.min(0.999, ratio));
    progressRef.current = r;
    setProgress(r);
    if (audioRef.current) audioRef.current.currentTime = r * duration;
  };

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - box.left) / box.width);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') seekTo(progressRef.current + 0.05);
    else if (e.key === 'ArrowLeft') seekTo(progressRef.current - 0.05);
    else return;
    e.preventDefault();
  };

  const light = tone === 'light';
  const shown = playing || progress > 0 ? progress * duration : duration;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Mettre en pause la note vocale' : 'Écouter la note vocale'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-press active:scale-95 cursor-pointer ${
          playing ? 'bg-[#E5B54F] text-black' : light ? 'bg-black text-white hover:bg-neutral-800' : 'bg-white text-black hover:bg-neutral-200'
        }`}
      >
        {playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />}
      </button>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(progress * duration)}
        aria-valuetext={formatClock(progress * duration)}
        onPointerDown={onPointer}
        onKeyDown={onKey}
        className="flex h-8 min-w-0 flex-1 items-center gap-[2px] cursor-pointer outline-none rounded focus-visible:ring-1 focus-visible:ring-[#E5B54F]/60"
      >
        {levels.map((b, i) => {
          const filled = i / levels.length < progress;
          return (
            <span
              key={i}
              className={`block w-[3px] shrink-0 rounded-full transition-colors duration-150 ${
                filled ? (light ? 'bg-[#8A6420]' : 'bg-[#E5B54F]') : light ? 'bg-black/25' : 'bg-white/25'
              }`}
              style={{ height: `${b * 100}%` }}
            />
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`font-mono text-[12.5px] tabular-nums w-9 text-right ${light ? 'text-neutral-600' : 'text-[#A8A29E]'}`}>
          {formatClock(shown)}
        </span>
        <button
          type="button"
          onClick={() => setRateIdx(i => (i + 1) % RATES.length)}
          aria-label={`Vitesse de lecture ${rate}x`}
          className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-colors cursor-pointer ${
            light ? 'bg-black/[0.07] text-neutral-700 hover:bg-black/[0.12]' : 'bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]'
          }`}
        >
          {rate}x
        </button>
      </div>
    </div>
  );
};
