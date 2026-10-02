import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, type LucideIcon } from 'lucide-react';

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  /** Termes supplémentaires pour la recherche (synonymes, anglais…) */
  keywords?: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Score de correspondance : préfixe > mot > sous-séquence. -1 si aucune. */
function score(query: string, text: string): number {
  if (!query) return 0;
  const t = normalize(text);
  const q = normalize(query.trim());
  if (t.startsWith(q)) return 100;
  if (t.includes(` ${q}`)) return 80;
  if (t.includes(q)) return 60;
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    gaps += found - ti;
    ti = found + 1;
  }
  return Math.max(1, 40 - gaps);
}

export const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const CommandPalette: FC<CommandPaletteProps> = ({ open, onOpenChange, commands }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Raccourci global Cmd+K / Ctrl+K (bascule)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Ouverture : réinitialise, mémorise le focus, bloque le défilement de fond
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActive(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      restoreFocus.current?.focus?.();
    };
  }, [open]);

  const results = useMemo(() => {
    return commands
      .map((c) => ({ c, s: Math.max(score(query, c.label), score(query, `${c.group} ${c.keywords ?? ''}`) - 10) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => (query ? b.s - a.s : 0))
      .map((r) => r.c);
  }, [commands, query]);

  // Regroupement en conservant l'ordre des résultats
  const grouped = useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    results.forEach((c) => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    });
    return [...map.entries()];
  }, [results]);
  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const execute = (cmd?: PaletteCommand) => {
    if (!cmd) return;
    onOpenChange(false);
    // Laisse la palette se fermer avant de naviguer (restauration du focus)
    requestAnimationFrame(() => cmd.run());
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((activeIndex + 1) % Math.max(1, flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((activeIndex - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(flat.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(flat[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  let index = -1;

  return (
    <div
      className="vx-palette-backdrop fixed inset-0 z-[80] flex items-start justify-center bg-black/70 backdrop-blur-sm px-3 pt-[12vh] sm:pt-[16vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        onKeyDown={onKeyDown}
        className="vx-palette w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0B0C10]/95 backdrop-blur-xl shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(229,181,79,0.05)]"
      >
        <div className="flex items-center gap-3 px-4 border-b border-white/[0.08]">
          <Search className="h-4 w-4 shrink-0 text-[#E5B54F]" strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Aller à un onglet, lancer une action…"
            role="combobox"
            aria-expanded="true"
            aria-controls="vx-palette-list"
            aria-activedescendant={flat[activeIndex] ? `vx-cmd-${flat[activeIndex].id}` : undefined}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 h-14 bg-transparent text-[15px] text-white placeholder-neutral-500 focus:outline-none"
          />
          <kbd className="vx-kbd">Esc</kbd>
        </div>

        <div ref={listRef} id="vx-palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2 no-scrollbar">
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-neutral-500">
              Aucun résultat pour <span className="text-neutral-300">« {query} »</span>
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="pb-1">
                <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#737373]">
                  {group}
                </div>
                {items.map((cmd) => {
                  index += 1;
                  const i = index;
                  const Icon = cmd.icon;
                  const selected = i === activeIndex;
                  return (
                    <div
                      key={cmd.id}
                      id={`vx-cmd-${cmd.id}`}
                      data-index={i}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => !selected && setActive(i)}
                      onClick={() => execute(cmd)}
                      className="vx-palette-item flex items-center justify-between gap-3 rounded-xl px-3 min-h-[44px] cursor-pointer text-[14px] text-neutral-300"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-[#E5B54F]' : 'text-[#737373]'}`} strokeWidth={1.6} />
                        <span className="truncate">{cmd.label}</span>
                      </span>
                      {cmd.hint && <span className="shrink-0 text-xs font-mono text-neutral-500">{cmd.hint}</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="hidden sm:flex items-center justify-between px-4 h-10 border-t border-white/[0.08] text-[11px] text-neutral-500">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="vx-kbd"><ArrowUp className="h-3 w-3" /></kbd><kbd className="vx-kbd"><ArrowDown className="h-3 w-3" /></kbd> naviguer</span>
            <span className="flex items-center gap-1"><kbd className="vx-kbd"><CornerDownLeft className="h-3 w-3" /></kbd> ouvrir</span>
          </span>
          <span className="font-mono">{flat.length} résultat{flat.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
};
