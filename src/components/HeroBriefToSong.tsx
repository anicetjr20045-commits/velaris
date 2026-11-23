import { useCallback, useEffect, useRef, useState, type CSSProperties, type FC, type ReactNode } from 'react';
import { Check, Play, RotateCcw } from 'lucide-react';

/* Chronologie d'une commande réelle, en millisecondes de démonstration */
const STEPS_AT = [300, 2300, 4300, 5000];
const DONE_AT = 6900;
const LYRICS = [
  'Mariam, lumière de nos matins,',
  'Ta voix berce encore nos chemins,',
  'Soixante ans de tendresse et de foi,',
  'Ce soir, maman, on chante pour toi.',
];
const WAVE = [0.35, 0.6, 0.9, 0.55, 0.75, 1, 0.65, 0.4, 0.8, 0.95, 0.5, 0.7, 0.45, 0.85, 0.6, 0.3, 0.55, 0.75, 0.4, 0.25];

const Step: FC<{ n: number; state: 'pending' | 'active' | 'done'; title: string; meta: string; last?: boolean; children?: ReactNode }> = ({
  n,
  state,
  title,
  meta,
  last,
  children,
}) => (
  <div className="relative flex gap-4">
    <div className="flex flex-col items-center">
      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold transition-all duration-500 ease-luxury ${
          state === 'done'
            ? 'border-white bg-white text-black'
            : state === 'active'
              ? 'border-[#D6AA60] bg-[#D6AA60]/20 text-[#F5D060] shadow-[0_0_12px_rgba(214,170,96,0.3)]'
              : 'border-white/20 text-neutral-500'
        }`}
      >
        {state === 'done' ? <Check className="h-4 w-4" strokeWidth={2.5} /> : String(n).padStart(2, '0')}
      </span>
      {!last && (
        <span className="relative mt-1.5 w-px flex-1 bg-white/[0.1] overflow-hidden">
          <span
            className={`absolute inset-x-0 top-0 h-full bg-white/60 origin-top transition-transform duration-700 ease-luxury ${
              state === 'done' ? 'scale-y-100' : 'scale-y-0'
            }`}
          />
        </span>
      )}
    </div>
    <div className={`min-w-0 flex-1 ${last ? '' : 'pb-6'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm sm:text-base font-semibold transition-colors duration-500 ${state === 'pending' ? 'text-neutral-500' : 'text-white'}`}>
          {title}
        </span>
        <span className="font-mono text-xs text-neutral-400 font-medium">{meta}</span>
      </div>
      {state !== 'pending' && children && <div className="vx-view-enter mt-3">{children}</div>}
    </div>
  </div>
);

/**
 * Démonstration du hero : une note vocale WhatsApp devient une chanson livrée.
 * Un seul moment orchestré au chargement, rejouable à la demande.
 */
export const HeroBriefToSong: FC = () => {
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [elapsed, setElapsed] = useState(reducedMotion ? DONE_AT : 0);
  const [run, setRun] = useState(0);
  const frameRef = useRef(0);

  const play = useCallback(() => setRun(r => r + 1), []);

  useEffect(() => {
    if (reducedMotion) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(DONE_AT, now - start);
      setElapsed(t);
      if (t < DONE_AT) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [run, reducedMotion]);

  const stateOf = (i: number): 'pending' | 'active' | 'done' => {
    const next = i + 1 < STEPS_AT.length ? STEPS_AT[i + 1] : DONE_AT;
    if (elapsed < STEPS_AT[i]) return 'pending';
    return elapsed >= next ? 'done' : 'active';
  };

  /* Horloge accélérée : 6,9 s de démo = 18 minutes réelles */
  const clockSeconds = Math.round((elapsed / DONE_AT) * 18 * 60);
  const clock = `${String(Math.floor(clockSeconds / 60)).padStart(2, '0')}:${String(clockSeconds % 60).padStart(2, '0')}`;
  const finished = elapsed >= DONE_AT;
  const voiceProgress = Math.min(1, Math.max(0, (elapsed - STEPS_AT[0]) / 1600));
  const linesShown = Math.max(0, Math.min(LYRICS.length, Math.floor((elapsed - STEPS_AT[1]) / 380) + 1));
  const masterProgress = Math.min(1, Math.max(0, (elapsed - STEPS_AT[3]) / (DONE_AT - STEPS_AT[3] - 200)));

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(214,170,96,0.14),transparent)] blur-2xl"
      />
      <div className="vx-hairline relative rounded-[28px] border border-white/[0.12] bg-[#0A0B10]/95 backdrop-blur-2xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4 bg-white/[0.02]">
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-bold text-white truncate">Commande en direct · Aïcha K.</div>
            <div className="text-xs text-neutral-400 font-medium">Anniversaire maman, Zouk doux, Voix lead</div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-2xl font-bold tracking-tight transition-colors duration-500 ${finished ? 'text-white' : 'text-[#F5D060]'}`}>
              {clock}
            </div>
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">temps de production</div>
          </div>
        </div>

        <div className="px-6 pt-6 pb-5">
          <Step n={1} state={stateOf(0)} title="Note vocale WhatsApp reçue" meta="0:24 audio">
            <div className="rounded-2xl rounded-tl-md border border-white/[0.1] bg-[#12141D] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md">
                  <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" />
                </span>
                <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
                  {WAVE.map((h, i) => (
                    <span
                      key={i}
                      className={`block flex-1 rounded-full transition-colors duration-150 ${i / WAVE.length < voiceProgress ? 'bg-[#E5B54F]' : 'bg-white/20'}`}
                      style={{ height: `${h * 100}%` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-xs text-neutral-400 font-semibold">0:24</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#CBD2E1] italic">
                « C'est pour les 60 ans de ma mère, Mariam. Elle adore le zouk, elle nous a tout donné. »
              </p>
            </div>
          </Step>

          <Step n={2} state={stateOf(1)} title="Paroles rédigées par l'IA" meta="Rimes riches">
            <div className="space-y-1 border-l-2 border-[#E5B54F]/60 pl-4 py-1">
              {LYRICS.map((line, i) => (
                <p
                  key={line}
                  className={`font-serif text-lg sm:text-xl leading-relaxed text-[#F7F0E1] transition-all duration-500 ease-luxury ${
                    i < linesShown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          </Step>

          <Step n={3} state={stateOf(2)} title="Paiement validé d'avance" meta="Wave Mobile">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-200 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Wave Money
              <span className="font-mono font-bold text-white text-base">+3 000 F CFA</span>
            </span>
          </Step>

          <Step n={4} state={finished ? 'done' : stateOf(3)} title="Chanson masterisée et expédiée" meta="Fichier MP3 24-bit" last>
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
              <svg viewBox="0 0 40 40" className={`h-12 w-12 shrink-0 vx-vinyl ${finished ? '' : 'vx-vinyl-live'}`} aria-hidden="true">
                <circle cx="20" cy="20" r="19" fill="#050608" stroke="rgba(255,255,255,0.15)" />
                <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(255,255,255,0.08)" />
                <circle cx="20" cy="20" r="9" fill="none" stroke="rgba(255,255,255,0.08)" />
                <circle cx="20" cy="20" r="5.5" fill="#E5B54F" />
                <circle cx="20" cy="20" r="1.2" fill="#050608" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm sm:text-base font-semibold text-white">Mariam, lumière de nos matins (Zouk)</div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.1] overflow-hidden">
                  <span
                    className="block h-full origin-left rounded-full bg-gradient-to-r from-[#E5B54F] to-white"
                    style={{ transform: `scaleX(${masterProgress})` } as CSSProperties}
                  />
                </div>
              </div>
              <span className={`font-mono text-xs font-bold shrink-0 ${finished ? 'text-emerald-400' : 'text-neutral-400'}`}>
                {finished ? 'Livré sur WhatsApp' : `${Math.round(masterProgress * 100)} %`}
              </span>
            </div>
          </Step>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-3.5 text-xs bg-white/[0.01]">
          <span className="text-neutral-400 font-medium">Flux réel d'une commande studio</span>
          <button
            type="button"
            onClick={play}
            disabled={!finished}
            className="inline-flex items-center gap-2 text-neutral-300 hover:text-white font-medium disabled:opacity-0 transition-all duration-300 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            Rejouer
          </button>
        </div>
      </div>
    </div>
  );
};
