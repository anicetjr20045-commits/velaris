import { useState, useRef, useEffect, type FC } from 'react';
import { Play, Pause, Volume2, Sparkles, Music2 } from 'lucide-react';

interface AudioSample {
  id: string;
  title: string;
  style: string;
  recipient: string;
  occasion: string;
  duration: string;
  frequencies: number[]; // melody note frequencies
  color: string;
}

const AUDIO_SAMPLES: AudioSample[] = [
  {
    id: 'afro-love',
    title: 'Mon Évidence (Pour Awa)',
    style: 'Afro-Love Moderne',
    recipient: 'Awa, sa fiancée',
    occasion: 'Demande en Mariage',
    duration: '0:34',
    frequencies: [261.63, 329.63, 392.00, 440.00, 523.25, 392.00, 329.63, 261.63],
    color: '#c5a059',
  },
  {
    id: 'acoustique',
    title: 'Merci Maman Chérie',
    style: 'Acoustique Guitare & Voix',
    recipient: 'Maman Jacqueline',
    occasion: 'Anniversaire 60 ans',
    duration: '0:28',
    frequencies: [220.00, 261.63, 293.66, 349.23, 440.00, 349.23, 293.66, 220.00],
    color: '#60a5fa',
  },
  {
    id: 'gospel',
    title: 'Bénédiction Infinie',
    style: 'Gospel & Célébration',
    recipient: 'Marc & Laure',
    occasion: 'Célébration Nuptiale',
    duration: '0:42',
    frequencies: [293.66, 369.99, 440.00, 587.33, 440.00, 369.99, 293.66, 220.00],
    color: '#34d399',
  },
];

export const StudioAudioShowcase: FC = () => {
  const [activeSampleId, setActiveSampleId] = useState<string>(AUDIO_SAMPLES[0].id);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const noteIndexRef = useRef<number>(0);

  const activeSample = AUDIO_SAMPLES.find((s) => s.id === activeSampleId) || AUDIO_SAMPLES[0];

  // Stop sound synthesizer
  const stopAudio = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Play delicate harmonic acoustic notes via Web Audio API
  const playSample = (sample: AudioSample) => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }

      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      setIsPlaying(true);
      setPlaybackProgress(0);
      noteIndexRef.current = 0;

      const ctx = audioCtxRef.current;
      const playNextNote = () => {
        const freq = sample.frequencies[noteIndexRef.current % sample.frequencies.length];
        noteIndexRef.current++;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle'; // warm warm tone like marimba / acoustic guitar
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.75);

        setPlaybackProgress((prev) => {
          if (prev >= 100) {
            return 0;
          }
          return prev + 6.25;
        });
      };

      playNextNote();
      intervalRef.current = window.setInterval(playNextNote, 600);
    } catch {
      // AudioContext not allowed without interaction
      setIsPlaying(false);
    }
  };

  const handleTogglePlay = (sample: AudioSample) => {
    if (isPlaying && activeSampleId === sample.id) {
      stopAudio();
    } else {
      if (isPlaying) {
        stopAudio();
      }
      setActiveSampleId(sample.id);
      playSample(sample);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl border border-white/[0.08] bg-[#07080a]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.7)] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-white">
            <Music2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
              Atelier d'Écoute Studio
            </h3>
            <p className="text-[11px] text-white/50">
              Qualité audio masterisée livrée à vos clients en 18 minutes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-white/[0.03] border border-white/[0.06] px-3 py-1 text-[11px] text-white/70">
          <Sparkles className="h-3 w-3 text-[#c5a059]" />
          <span>Fidélité Studio 24-bit • Zéro Bruit</span>
        </div>
      </div>

      {/* 3 Interactive Style Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AUDIO_SAMPLES.map((sample) => {
          const isActive = activeSampleId === sample.id;
          const isThisPlaying = isActive && isPlaying;

          return (
            <div
              key={sample.id}
              onClick={() => handleTogglePlay(sample)}
              className={`group relative rounded-2xl p-4 border transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-white/[0.05] border-white/20 shadow-lg'
                  : 'bg-white/[0.015] border-white/[0.06] hover:bg-white/[0.03] hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">
                  {sample.style}
                </span>
                <span className="text-[10px] text-white/40">{sample.duration}</span>
              </div>

              <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-white/90">
                {sample.title}
              </h4>

              <div className="mt-2 text-[10px] text-white/50 flex flex-col gap-0.5">
                <span>Destinataire : <strong className="text-white/80">{sample.recipient}</strong></span>
                <span>Occasion : <strong className="text-white/80">{sample.occasion}</strong></span>
              </div>

              {/* Play / Wave Icon */}
              <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                <button
                  type="button"
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                    isThisPlaying
                      ? 'bg-white text-black shadow-md scale-105'
                      : 'bg-white/[0.08] text-white group-hover:bg-white group-hover:text-black'
                  }`}
                >
                  {isThisPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  )}
                </button>

                {/* Animated Mini Waveform Bars */}
                <div className="flex items-center gap-1 h-5">
                  {[...Array(6)].map((_, i) => (
                    <span
                      key={i}
                      className={`w-0.5 rounded-full transition-all duration-300 ${
                        isThisPlaying
                          ? 'bg-white animate-pulse'
                          : 'bg-white/20 h-1.5'
                      }`}
                      style={{
                        height: isThisPlaying ? `${Math.max(4, (i + 1) * 3.5)}px` : '4px',
                        animationDelay: `${i * 120}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Sound Bar Visualizer */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-white">
            <Volume2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-tight">
                {activeSample.title}
              </span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/60">
                {activeSample.style}
              </span>
            </div>
            <p className="text-[10px] text-white/50">
              Généré et livré en 18 minutes • Encaissé 3 000 FCFA sur Wave
            </p>
          </div>
        </div>

        {/* Dynamic Waveform Simulation */}
        <div className="flex items-center gap-1.5 self-center sm:self-auto h-7 px-4">
          {[...Array(24)].map((_, idx) => {
            const barHeight = isPlaying 
              ? Math.max(6, Math.sin(idx * 0.4 + (playbackProgress / 10)) * 14 + 14)
              : 4;
            return (
              <div
                key={idx}
                className="w-1 rounded-full transition-all duration-150"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: isPlaying ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
