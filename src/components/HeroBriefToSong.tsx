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
        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] transition-all duration-500 ease-luxury ${
          state === 'done'
            ? 'border-white bg-white text-black'
            : state === 'active'
              ? 'border-[#D6AA60] bg-[#D6AA60]/15 text-[#F1DDB4]'
              : 'border-white/15 text-neutral-600'
        }`}
      >
        {state === 'done' ? <Check className="h-3 w-3" strokeWidth={2.5} /> : String(n).padStart(2, '0')}
      </span>
      {!last && (
        <span className="relative mt-1 w-px flex-1 bg-white/[0.08] overflow-hidden">
          <span
            className={`absolute inset-x-0 top-0 h-full bg-white/50 origin-top transition-transform duration-700 ease-luxury ${
              state === 'done' ? 'scale-y-100' : 'scale-y-0'
            }`}
          />
        </span>
      )}
    </div>
    <div className={`min-w-0 flex-1 ${last ? '' : 'pb-5'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[13px] font-medium transition-colors duration-500 ${state === 'pending' ? 'text-neutral-600' : 'text-white'}`}>
          {title}
        </span>
        <span className="font-mono text-[10px] text-neutral-500">{meta}</span>
      </div>
      {state !== 'pending' && children && <div className="vx-view-enter mt-2.5">{children}</div>}
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
      <div className="vx-hairline relative rounded-[28px] border border-white/[0.09] bg-[#0A0B0F]/90 backdrop-blur-xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-white truncate">Commande d'Aïcha K.</div>
            <div className="text-[11px] text-neutral-500">Anniversaire, zouk, voix femme</div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-xl font-bold tracking-tight transition-colors duration-500 ${finished ? 'text-white' : 'text-[#E9CC94]'}`}>
              {clock}
            </div>
            <div className="text-[10px] text-neutral-500">minutes écoulées</div>
          </div>
        </div>

        <div className="px-5 pt-5 pb-4">
          <Step n={1} state={stateOf(0)} title="Note vocale reçue" meta="WhatsApp">
            <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-[#111319] p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black">
                  <Play className="h-3 w-3 translate-x-px" fill="currentColor" />
                </span>
                <div className="flex h-6 flex-1 items-center gap-[2px]" aria-hidden="true">
                  {WAVE.map((h, i) => (
                    <span
                      key={i}
                      className={`block flex-1 rounded-full transition-colors duration-150 ${i / WAVE.length < voiceProgress ? 'bg-[#D6AA60]' : 'bg-white/20'}`}
                      style={{ height: `${h * 100}%` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-neutral-500">0:24</span>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-neutral-400">
                « C'est pour les 60 ans de ma mère, Mariam. Elle adore le zouk, elle nous a tout donné. »
              </p>
            </div>
          </Step>

          <Step n={2} state={stateOf(1)} title="Paroles écrites" meta="Sonar">
            <div className="space-y-0.5 border-l border-[#D6AA60]/40 pl-3.5">
              {LYRICS.map((line, i) => (
                <p
                  key={line}
                  className={`font-serif text-[16px] leading-snug text-[#F1E6CF] transition-all duration-500 ease-luxury ${
                    i < linesShown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          </Step>

          <Step n={3} state={stateOf(2)} title="Paiement reçu" meta="Mobile Money">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-3 py-1.5 text-[12px] text-sky-200">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Wave
              <span className="font-mono font-semibold text-white">+3 000 F</span>
            </span>
          </Step>

          <Step n={4} state={finished ? 'done' : stateOf(3)} title="Chanson livrée" meta="Master 24-bit" last>
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
              <svg viewBox="0 0 40 40" className={`h-10 w-10 shrink-0 vx-vinyl ${finished ? '' : 'vx-vinyl-live'}`} aria-hidden="true">
                <circle cx="20" cy="20" r="19" fill="#050608" stroke="rgba(255,255,255,0.12)" />
                <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(255,255,255,0.06)" />
                <circle cx="20" cy="20" r="9" fill="none" stroke="rgba(255,255,255,0.06)" />
                <circle cx="20" cy="20" r="5.5" fill="#D6AA60" />
                <circle cx="20" cy="20" r="1.2" fill="#050608" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-white">Mariam, lumière</div>
                <div className="mt-1.5 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                  <span
                    className="block h-full origin-left rounded-full bg-white"
                    style={{ transform: `scaleX(${masterProgress})` } as CSSProperties}
                  />
                </div>
              </div>
              <span className={`font-mono text-[10.5px] shrink-0 ${finished ? 'text-emerald-300' : 'text-neutral-500'}`}>
                {finished ? 'Envoyé' : `${Math.round(masterProgress * 100)} %`}
              </span>
            </div>
          </Step>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-[11px]">
          <span className="text-neutral-500">Démonstration, d'après une commande réelle</span>
          <button
            type="button"
            onClick={play}
            disabled={!finished}
            className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-white disabled:opacity-0 transition-all duration-300 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.75} />
            Rejouer
          </button>
        </div>
      </div>
    </div>
  );
};
