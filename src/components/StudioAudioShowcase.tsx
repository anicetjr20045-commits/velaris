import { useState, useRef, useEffect, type FC } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioSample {
  id: string;
  trackNumber: string;
  title: string;
  style: string;
  recipient: string;
  occasion: string;
  duration: string;
  frequencies: number[];
}

const AUDIO_SAMPLES: AudioSample[] = [
  {
    id: 'afro-love',
    trackNumber: '01',
    title: 'Mon Évidence',
    style: 'Afro-Love Contemporain',
    recipient: 'Awa Diallo',
    occasion: 'Demande en mariage',
    duration: '0:34',
    frequencies: [261.63, 329.63, 392.00, 440.00, 523.25, 392.00, 329.63, 261.63],
  },
  {
    id: 'acoustique',
    trackNumber: '02',
    title: 'Merci Maman',
    style: 'Guitare Acoustique & Voix',
    recipient: 'Maman Jacqueline',
    occasion: 'Anniversaire 60 ans',
    duration: '0:28',
    frequencies: [220.00, 261.63, 293.66, 349.23, 440.00, 349.23, 293.66, 220.00],
  },
  {
    id: 'gospel',
    trackNumber: '03',
    title: 'Bénédiction Nuptiale',
    style: 'Chœur Gospel Moderne',
    recipient: 'Marc & Laure',
    occasion: 'Célébration de mariage',
    duration: '0:42',
    frequencies: [293.66, 369.99, 440.00, 587.33, 440.00, 369.99, 293.66, 220.00],
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

  const stopAudio = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

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

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.75);

        setPlaybackProgress((prev) => (prev >= 100 ? 0 : prev + 6.25));
      };

      playNextNote();
      intervalRef.current = window.setInterval(playNextNote, 600);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleTogglePlay = (sample: AudioSample) => {
    if (isPlaying && activeSampleId === sample.id) {
      stopAudio();
    } else {
      if (isPlaying) stopAudio();
      setActiveSampleId(sample.id);
      playSample(sample);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  return (
    <div id="audio-showcase" className="w-full max-w-5xl mx-auto border-t border-b border-white/[0.08] py-8 sm:py-12 space-y-6">
      {/* Console Section Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        <div>
          <div className="text-sm font-medium tracking-widest text-[#c5a059] uppercase">
            Écoute studio
          </div>
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-white mt-1">
            Exemples de chansons produites
          </h3>
        </div>
        <p className="text-sm text-zinc-300 max-w-md leading-relaxed">
          Chaque chanson est composée sur mesure à partir de la note vocale du client, arrangée et livrée directement sur WhatsApp.
        </p>
      </div>

      {/* Track Selection Table (Refined List, No BPM/Key, Single Play button) */}
      <div className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
        {AUDIO_SAMPLES.map((sample) => {
          const isActive = activeSampleId === sample.id;
          const isThisPlaying = isActive && isPlaying;

          return (
            <div
              key={sample.id}
              onClick={() => handleTogglePlay(sample)}
              className={`py-4 sm:py-5 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none ${
                isActive ? 'text-white' : 'text-zinc-300 hover:text-white'
              }`}
            >
              {/* Play Button & Title */}
              <div className="flex items-center gap-4 sm:gap-6 min-w-[200px]">
                <button
                  type="button"
                  aria-label={isThisPlaying ? "Pause" : "Écouter " + sample.title}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all ${
                    isThisPlaying
                      ? 'border-white bg-white text-black'
                      : 'border-white/30 bg-white/[0.04] text-white hover:border-white hover:bg-white hover:text-black'
                  }`}
                >
                  {isThisPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  )}
                </button>

                <div>
                  <h4 className="text-base font-semibold tracking-tight text-white font-heading">
                    {sample.title}
                  </h4>
                  <span className="text-sm text-zinc-400 block sm:hidden">
                    {sample.style}
                  </span>
                </div>
              </div>

              {/* Style Column */}
              <div className="hidden sm:block text-sm text-zinc-300 min-w-[180px]">
                {sample.style}
              </div>

              {/* Recipient & Occasion */}
              <div className="hidden md:block text-sm text-zinc-400 min-w-[180px]">
                <span className="text-zinc-200 block">{sample.recipient}</span>
                <span className="text-sm text-zinc-400">{sample.occasion}</span>
              </div>

              {/* Duration & Wave animation */}
              <div className="flex items-center gap-3 text-sm text-zinc-300 font-mono shrink-0">
                <span>{sample.duration}</span>
                {isThisPlaying && (
                  <div className="flex items-center gap-0.5 h-3">
                    <span className="w-0.5 bg-emerald-400 h-full animate-pulse" />
                    <span className="w-0.5 bg-emerald-400 h-2 animate-pulse" />
                    <span className="w-0.5 bg-emerald-400 h-3 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Strip: ONLY DISPLAYED WHEN PLAYING (Point 6) */}
      {isPlaying && (
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-zinc-300 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>En lecture : <strong className="text-white">{activeSample.title}</strong> ({activeSample.style})</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-60">
            <div className="h-1 w-full bg-white/[0.1] rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${playbackProgress}%` }}
              />
            </div>
            <span className="font-mono text-xs text-zinc-400 shrink-0">
              {Math.round(playbackProgress)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
