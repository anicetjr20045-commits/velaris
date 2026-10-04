import { useState, useRef, useEffect, useCallback, type FC } from 'react';
import {
  Scissors,
  Play,
  Pause,
  Download,
  Upload,
  Check,
  RotateCcw,
  Bookmark
} from 'lucide-react';

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
}

/** Encode un AudioBuffer en fichier WAV stéréo 16-bit PCM standard */
function bufferToWave(abuffer: AudioBuffer, offset: number, len: number): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = abuffer.sampleRate;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  out.setUint8(0, 0x52); out.setUint8(1, 0x49); out.setUint8(2, 0x46); out.setUint8(3, 0x46); pos = 4;
  setUint32(length - 8); // file length - 8
  out.setUint8(pos++, 0x57); out.setUint8(pos++, 0x41); out.setUint8(pos++, 0x56); out.setUint8(pos++, 0x45); // WAVE
  out.setUint8(pos++, 0x66); out.setUint8(pos++, 0x6d); out.setUint8(pos++, 0x74); out.setUint8(pos++, 0x20); // fmt 
  setUint32(16); // subchunk1size (16 for PCM)
  setUint16(1); // PCM format
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample
  out.setUint8(pos++, 0x64); out.setUint8(pos++, 0x61); out.setUint8(pos++, 0x74); out.setUint8(pos++, 0x61); // data
  setUint32(length - pos - 4); // data length

  for (let i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  const startIdx = Math.floor(offset);
  const endIdx = startIdx + len;

  for (let i = startIdx; i < endIdx; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
  }

  return new Blob([out], { type: 'audio/wav' });
}

export const AudioTrimmerTool: FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(30);
  const [cursorTime, setCursorTime] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playMode, setPlayMode] = useState<'selection' | 'cursor'>('selection');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playbackStartCtxTimeRef = useRef<number>(0);
  const playbackStartOffsetRef = useRef<number>(0);
  const playbackEndOffsetRef = useRef<number>(0);

  // Initialisation de l'AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stopPlayback = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      activeSourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleFileUpload = async (uploadedFile: File) => {
    stopPlayback();
    setFile(uploadedFile);
    setExportedUrl(null);

    try {
      const ctx = getAudioContext();
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decoded);
      setDuration(decoded.duration);
      setStartTime(0);
      setEndTime(Math.min(30, decoded.duration));
      setCursorTime(0);
    } catch (err) {
      console.error('Erreur de décodage audio:', err);
    }
  };

  // Dessin de la forme d'onde sur le Canvas
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Dessin du fond et des crêtes
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const currentSec = (i / width) * duration;
      const isSelected = currentSec >= startTime && currentSec <= endTime;

      ctx.fillStyle = isSelected ? '#E5B54F' : 'rgba(255, 255, 255, 0.2)';
      const barHeight = Math.max(2, (max - min) * amp * 0.9);
      ctx.fillRect(i, amp - barHeight / 2, 1.5, barHeight);
    }
  }, [audioBuffer, duration, startTime, endTime]);

  // Boucle d'animation fluide à 60 FPS pour le curseur de lecture
  const updatePlayhead = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const elapsed = ctx.currentTime - playbackStartCtxTimeRef.current;
    const current = playbackStartOffsetRef.current + elapsed;
    const endTarget = playbackEndOffsetRef.current;

    if (current >= endTarget) {
      setCursorTime(endTarget);
      stopPlayback();
      return;
    }

    setCursorTime(current);
    animFrameRef.current = requestAnimationFrame(updatePlayhead);
  }, [stopPlayback]);

  // Démarre la lecture audio depuis fromTime jusqu'à toTime
  const startPlaybackRange = (fromTime: number, toTime: number, mode: 'selection' | 'cursor') => {
    if (!audioBuffer) return;
    stopPlayback();

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const boundedFrom = Math.max(0, Math.min(fromTime, duration));
    const boundedTo = Math.max(boundedFrom + 0.05, Math.min(toTime, duration));
    const playDuration = boundedTo - boundedFrom;

    playbackStartCtxTimeRef.current = ctx.currentTime;
    playbackStartOffsetRef.current = boundedFrom;
    playbackEndOffsetRef.current = boundedTo;

    source.start(0, boundedFrom, playDuration);
    activeSourceRef.current = source;
    setIsPlaying(true);
    setPlayMode(mode);
    setCursorTime(boundedFrom);

    source.onended = () => {
      // Déclenché soit à la fin soit lors du stop
    };

    animFrameRef.current = requestAnimationFrame(updatePlayhead);
  };

  const togglePlaySelection = () => {
    if (isPlaying && playMode === 'selection') {
      stopPlayback();
    } else {
      startPlaybackRange(startTime, endTime, 'selection');
    }
  };

  const togglePlayFromCursor = () => {
    if (isPlaying && playMode === 'cursor') {
      stopPlayback();
    } else {
      const from = cursorTime >= duration ? 0 : cursorTime;
      startPlaybackRange(from, duration, 'cursor');
    }
  };

  // Clic sur la forme d'onde : déplace le curseur et lit si en cours
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformContainerRef.current || !duration) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;
    setCursorTime(newTime);

    if (isPlaying) {
      // Si la lecture était en cours, on la relance immédiatement depuis ce point
      startPlaybackRange(newTime, duration, 'cursor');
    }
  };

  const handleSetStartAtCursor = () => {
    const newStart = Math.min(cursorTime, Math.max(0, endTime - 0.5));
    setStartTime(newStart);
  };

  const handleSetEndAtCursor = () => {
    const newEnd = Math.max(cursorTime, Math.min(duration, startTime + 0.5));
    setEndTime(newEnd);
  };

  const handlePresetTeaser = (sec: number) => {
    if (!duration) return;
    stopPlayback();
    setStartTime(0);
    const end = Math.min(sec, duration);
    setEndTime(end);
    setCursorTime(0);
  };

  const handleExportTrimmed = () => {
    if (!audioBuffer) return;
    stopPlayback();
    setIsExporting(true);

    try {
      const sampleRate = audioBuffer.sampleRate;
      const startOffset = Math.floor(startTime * sampleRate);
      const sampleLength = Math.floor((endTime - startTime) * sampleRate);

      const wavBlob = bufferToWave(audioBuffer, startOffset, sampleLength);
      const url = URL.createObjectURL(wavBlob);
      setExportedUrl(url);
    } catch (err) {
      console.error('Erreur export découpe:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const cursorPercent = duration > 0 ? (cursorTime / duration) * 100 : 0;
  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scissors className="h-5 w-5 text-[#E5B54F]" />
            Découpeur Audio Express (Waveform Studio avec Curseur Live)
          </h2>
          <p className="text-[13px] text-neutral-400 mt-1">
            Visualisez la forme d'onde, suivez le curseur dynamique qui défile en temps réel pendant l'écoute et découpez au millième de seconde votre teaser ou extrait WhatsApp.
          </p>
        </div>
        {duration > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePresetTeaser(30)}
              className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[12px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              Teaser 30s
            </button>
            <button
              type="button"
              onClick={() => handlePresetTeaser(15)}
              className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[12px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              Extrait 15s
            </button>
          </div>
        )}
      </div>

      {!audioBuffer ? (
        <div className="rounded-2xl border-2 border-dashed border-white/[0.12] bg-[#0B0C10] p-10 text-center hover:border-white/[0.24] transition-colors">
          <Upload className="h-10 w-10 mx-auto text-[#E5B54F]" strokeWidth={1.5} />
          <h3 className="mt-4 text-base font-semibold text-white">Glissez votre chanson ou cliquez pour uploader</h3>
          <p className="mt-1 text-[13px] text-neutral-400 max-w-md mx-auto">
            Formats acceptés : MP3, WAV, AAC, M4A. Le traitement est 100% instantané en mémoire locale.
          </p>
          <label className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[13px] font-semibold text-black hover:bg-neutral-200 transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            Sélectionner une chanson
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) void handleFileUpload(e.target.files[0]);
              }}
            />
          </label>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider">Fichier source</span>
              <h3 className="text-base font-semibold text-white truncate mt-0.5">{file?.name}</h3>
            </div>
            <div className="text-right">
              <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider">Position du curseur</span>
              <div className="font-mono text-base font-bold text-[#E5B54F] mt-0.5">
                {formatSeconds(cursorTime)} <span className="text-neutral-500 text-xs">/ {formatSeconds(duration)}</span>
              </div>
            </div>
          </div>

          {/* Forme d'onde Canvas avec Curseur de Lecture Live */}
          <div className="space-y-2">
            <div
              ref={waveformContainerRef}
              onClick={handleWaveformClick}
              className="group relative rounded-xl border border-white/[0.08] bg-[#07080B] p-4 cursor-crosshair overflow-hidden select-none"
            >
              <canvas ref={canvasRef} className="h-32 w-full block pointer-events-none" />

              {/* Voile sombre pour la zone avant le début */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-black/40 pointer-events-none transition-all"
                style={{ width: `${startPercent}%` }}
              />

              {/* Voile sombre pour la zone après la fin */}
              <div
                className="absolute top-0 bottom-0 right-0 bg-black/40 pointer-events-none transition-all"
                style={{ width: `${100 - endPercent}%` }}
              />

              {/* Marqueur Début (Ligne émeraude) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 pointer-events-none z-10"
                style={{ left: `${startPercent}%` }}
              >
                <div className="absolute top-1 -left-2 bg-emerald-400 text-black text-[9px] font-mono font-bold px-1 rounded shadow">
                  IN
                </div>
              </div>

              {/* Marqueur Fin (Ligne dorée) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#E5B54F] pointer-events-none z-10"
                style={{ left: `${endPercent}%` }}
              >
                <div className="absolute top-1 -right-2 bg-[#E5B54F] text-black text-[9px] font-mono font-bold px-1 rounded shadow">
                  OUT
                </div>
              </div>

              {/* Curseur de Lecture Live (Ligne blanche éclatante avec tête de lecture animée) */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-white pointer-events-none z-20 shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-none"
                style={{ left: `${cursorPercent}%` }}
              >
                <div className="absolute top-1.5 -translate-x-1/2 left-1/2 bg-white text-black font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1">
                  <span>{formatSeconds(cursorTime)}</span>
                </div>
                <div className="absolute bottom-1 -translate-x-1/2 left-1/2 w-2 h-2 bg-white rotate-45" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 px-1">
              <span>0:00.0</span>
              <span className="text-neutral-400">Cliquez n'importe où sur l'onde pour placer le curseur</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* Boutons d'assignation rapide par rapport au curseur */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.015]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Marqueurs rapides :</span>
              <button
                type="button"
                onClick={handleSetStartAtCursor}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
              >
                <Bookmark className="h-3 w-3" />
                <span>Poser Début ici [{formatSeconds(cursorTime)}]</span>
              </button>
              <button
                type="button"
                onClick={handleSetEndAtCursor}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5B54F]/30 bg-[#E5B54F]/10 px-2.5 py-1 text-xs font-medium text-[#E5B54F] hover:bg-[#E5B54F]/20 transition-colors cursor-pointer"
              >
                <Bookmark className="h-3 w-3" />
                <span>Poser Fin ici [{formatSeconds(cursorTime)}]</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setStartTime(0);
                setEndTime(duration);
                setCursorTime(0);
              }}
              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Réinitialiser</span>
            </button>
          </div>

          {/* Sliders Début / Fin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-neutral-400">Point de départ (Début)</span>
                <span className="font-mono text-sm font-bold text-emerald-400">{formatSeconds(startTime)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, endTime - 0.5)}
                step={0.1}
                value={startTime}
                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-neutral-400">Point d'arrêt (Fin)</span>
                <span className="font-mono text-sm font-bold text-[#E5B54F]">{formatSeconds(endTime)}</span>
              </div>
              <input
                type="range"
                min={startTime + 0.5}
                max={duration}
                step={0.1}
                value={endTime}
                onChange={(e) => setEndTime(parseFloat(e.target.value))}
                className="w-full accent-[#E5B54F] cursor-pointer"
              />
            </div>
          </div>

          {/* Durée de l'extrait découpé */}
          <div className="flex items-center justify-between px-2 text-[13px] border-t border-white/[0.06] pt-3">
            <span className="text-neutral-400">Durée totale de l'extrait découpé :</span>
            <span className="font-mono font-bold text-white text-base">
              {formatSeconds(Math.max(0, endTime - startTime))}
            </span>
          </div>

          {/* Actions de lecture & Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-2">
              {/* Écouter la sélection [Début -> Fin] */}
              <button
                type="button"
                onClick={togglePlaySelection}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                {isPlaying && playMode === 'selection' ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                <span>{isPlaying && playMode === 'selection' ? 'Pause' : 'Écouter l\'extrait'}</span>
              </button>

              {/* Écouter depuis le curseur */}
              <button
                type="button"
                onClick={togglePlayFromCursor}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-neutral-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                {isPlaying && playMode === 'cursor' ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>{isPlaying && playMode === 'cursor' ? 'Pause' : 'Écouter depuis le curseur'}</span>
              </button>

              <label className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-2.5 text-[12.5px] font-medium text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Changer fichier
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void handleFileUpload(e.target.files[0]);
                  }}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleExportTrimmed}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-full bg-[#E5B54F] px-6 py-2.5 text-[13px] font-bold text-[#050608] hover:bg-[#F3CA75] transition-colors cursor-pointer shadow-[0_0_20px_rgba(229,181,79,0.3)] disabled:opacity-50"
            >
              <Scissors className="h-4 w-4" />
              <span>{isExporting ? 'Découpe en cours…' : 'Découper & Générer le master WAV'}</span>
            </button>
          </div>

          {/* Résultat du fichier découpé */}
          {exportedUrl && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 vx-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Extrait prêt à l'emploi</h4>
                  <p className="text-[12px] text-neutral-400 mt-0.5">
                    Format WAV Stéréo HD · {formatSeconds(endTime - startTime)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={exportedUrl}
                  download={`extrait_${file?.name?.replace(/\.[^/.]+$/, '') || 'chanson'}_${Math.round(endTime - startTime)}s.wav`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-neutral-200 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger le teaser
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
