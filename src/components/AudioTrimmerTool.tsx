import { useState, useRef, useEffect, type FC } from 'react';
import {
  Scissors,
  Play,
  Pause,
  Download,
  Upload,
  Check
} from 'lucide-react';

function formatSeconds(sec: number): string {
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
  let sampleRate = abuffer.sampleRate;
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  // Initialisation de l'AudioContext
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

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

  const stopPlayback = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      activeSourceRef.current = null;
    }
    if (playbackTimerRef.current) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsPlaying(false);
  };

  const playSelection = () => {
    if (!audioBuffer) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const playDuration = Math.max(0.1, endTime - startTime);
    source.start(0, startTime, playDuration);
    activeSourceRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      activeSourceRef.current = null;
    };

    playbackTimerRef.current = window.setTimeout(() => {
      stopPlayback();
    }, playDuration * 1000);
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

  const handlePresetTeaser = (sec: number) => {
    if (!duration) return;
    setStartTime(0);
    setEndTime(Math.min(sec, duration));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scissors className="h-5 w-5 text-[#E5B54F]" />
            Découpeur Audio Express (Waveform Studio)
          </h2>
          <p className="text-[13px] text-neutral-400 mt-1">
            Isolez en 1 seconde un teaser de 30s pour WhatsApp ou coupez l'intro d'une chanson directement dans votre navigateur.
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
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
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
              <span className="text-[12px] font-mono text-neutral-500 uppercase tracking-wider">Durée totale</span>
              <div className="font-mono text-base font-bold text-white mt-0.5">{formatSeconds(duration)}</div>
            </div>
          </div>

          {/* Forme d'onde Canvas */}
          <div className="relative rounded-xl border border-white/[0.08] bg-[#07080B] p-4">
            <canvas ref={canvasRef} className="h-28 w-full block cursor-crosshair" />
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 mt-2 px-1">
              <span>0:00</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* Contrôles Début / Fin */}
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

          {/* Durée de l'extrait */}
          <div className="flex items-center justify-between px-2 text-[13px]">
            <span className="text-neutral-400">Durée de l'extrait découpé :</span>
            <span className="font-mono font-bold text-white text-base">
              {formatSeconds(Math.max(0, endTime - startTime))}
            </span>
          </div>

          {/* Actions : Play & Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={playSelection}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                <span>{isPlaying ? 'Pause' : 'Écouter l\'extrait'}</span>
              </button>

              <label className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer">
                <Upload className="h-4 w-4" />
                Changer de fichier
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
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
              <span>{isExporting ? 'Découpe en cours…' : 'Découper & Générer le fichier'}</span>
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
