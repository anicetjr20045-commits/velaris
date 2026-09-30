import { useState, useRef, useEffect, type FC } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioSample {
  id: string;
  trackNumber: string;
  title: string;
  style: string;
  keySignature: string;
  tempo: string;
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
    keySignature: 'Ré majeur',
    tempo: '102 BPM',
    recipient: 'Awa Diallo',
    occasion: 'Demande en fiançailles',
    duration: '0:34',
    frequencies: [261.63, 329.63, 392.00, 440.00, 523.25, 392.00, 329.63, 261.63],
  },
  {
    id: 'acoustique',
    trackNumber: '02',
    title: 'Merci Maman',
    style: 'Guitare Acoustique & Violoncelle',
    keySignature: 'Sol majeur',
    tempo: '78 BPM',
    recipient: 'Maman Jacqueline',
    occasion: 'Anniversaire (60 ans)',
    duration: '0:28',
    frequencies: [220.00, 261.63, 293.66, 349.23, 440.00, 349.23, 293.66, 220.00],
  },
  {
    id: 'gospel',
    trackNumber: '03',
    title: 'Bénédiction Nuptiale',
    style: 'Chœur Gospel Moderne',
    keySignature: 'Mi bémol',
    tempo: '116 BPM',
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
    <div className="w-full max-w-5xl mx-auto border-t border-b border-white/[0.08] py-8 sm:py-12 space-y-8">
      {/* Console Section Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium tracking-widest text-neutral-400 uppercase">
            Écoute studio • Master 24-bit
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-white mt-1">
            Qualité acoustique livrée aux clients
          </h3>
        </div>
        <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
          Chaque morceau est arrangé, interprété et masterisé automatiquement à partir des souvenirs audio partagés par le client sur WhatsApp.
        </p>
      </div>

      {/* Track Selection Table (Refined Architectural List) */}
      <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {AUDIO_SAMPLES.map((sample) => {
          const isActive = activeSampleId === sample.id;
          const isThisPlaying = isActive && isPlaying;

          return (
            <div
              key={sample.id}
              onClick={() => handleTogglePlay(sample)}
              className={`py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-pointer select-none ${
                isActive ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {/* Track ID & Title */}
              <div className="flex items-center gap-4 sm:gap-6 min-w-[240px]">
                <span className="text-xs font-mono text-neutral-400">
                  {sample.trackNumber}
                </span>

                <button
                  type="button"
                  aria-label={isThisPlaying ? "Pause" : "Play"}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                    isThisPlaying
                      ? 'border-white bg-white text-black'
                      : 'border-white/20 bg-white/[0.02] text-white hover:border-white'
                  }`}
                >
                  {isThisPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  )}
                </button>

                <div>
                  <h4 className="text-sm font-semibold tracking-tight text-white font-heading">
                    {sample.title}
                  </h4>
                  <span className="text-[11px] text-neutral-400 block sm:hidden">
                    {sample.style}
                  </span>
                </div>
              </div>

              {/* Style & Details */}
              <div className="hidden sm:flex flex-col text-left text-xs min-w-[180px]">
                <span className="text-neutral-300 font-medium">{sample.style}</span>
                <span className="text-[11px] text-neutral-400">{sample.keySignature} • {sample.tempo}</span>
              </div>

              {/* Recipient & Context */}
              <div className="text-xs text-neutral-400 min-w-[180px]">
                <span className="text-neutral-300 block">{sample.recipient}</span>
                <span className="text-[11px] text-neutral-400">{sample.occasion}</span>
              </div>

              {/* Duration & Wave indicator */}
              <div className="flex items-center justify-between sm:justify-end gap-6 text-xs font-mono text-neutral-400">
                <span className="text-neutral-400">{sample.duration}</span>
                {isThisPlaying ? (
                  <div className="flex items-center gap-0.5 h-3">
                    <span className="w-0.5 bg-white h-full animate-pulse" />
                    <span className="w-0.5 bg-white h-2 animate-pulse" />
                    <span className="w-0.5 bg-white h-3 animate-pulse" />
                  </div>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">Écouter</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Precision Audio Console Status Strip */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          <span>Lecture active : <strong className="text-white font-medium">{activeSample.title}</strong> ({activeSample.style})</span>
        </div>

        {/* Minimalist Scrub Rail */}
        <div className="flex items-center gap-3 w-full sm:w-64">
          <div className="h-[2px] w-full bg-white/[0.1] rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${isPlaying ? playbackProgress : 0}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-neutral-400 shrink-0">
            {isPlaying ? `${Math.round(playbackProgress)}%` : '0%'}
          </span>
        </div>
      </div>
    </div>
  );
};
