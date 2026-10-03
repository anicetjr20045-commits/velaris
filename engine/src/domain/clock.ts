/**
 * Horaires et délais annoncés (§ 16), dans le fuseau du studio.
 * I27 : un délai annoncé est calculé depuis la disponibilité réelle, jamais une constante.
 * I23 : aucune décision ne compare des dates calendaires ; les dates locales ne servent ici
 * qu'à FORMULER une phrase (« demain matin vers 8 h »).
 */

export type Hours = Readonly<Record<string, readonly [string, string] | readonly string[]>>;

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_FR: Readonly<Record<string, string>> = { sun: 'dimanche', mon: 'lundi', tue: 'mardi', wed: 'mercredi', thu: 'jeudi', fri: 'vendredi', sat: 'samedi' };

interface LocalParts { day: string; minutes: number; dateKey: string }

function localParts(ms: number, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('weekday').toLowerCase().slice(0, 3);
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')), dateKey: `${get('year')}-${get('month')}-${get('day')}` };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}

function windowFor(hours: Hours, day: string): readonly [number, number] | null {
  const w = hours[day] ?? hours.all;
  if (!w || w.length < 2) return null;
  return [toMinutes(w[0]!), toMinutes(w[1]!)];
}

export function isWithin(hours: Hours, tz: string, ms: number): boolean {
  const p = localParts(ms, tz);
  const w = windowFor(hours, p.day);
  return w !== null && p.minutes >= w[0] && p.minutes < w[1];
}

/** Prochain instant (par pas de 5 min, sur 8 jours au plus) où l'on est dans les horaires. */
export function nextOpening(hours: Hours, tz: string, ms: number): number | null {
  if (isWithin(hours, tz, ms)) return ms;
  const step = 5 * 60_000;
  let t = Math.ceil(ms / step) * step;
  for (let i = 0; i < (8 * 24 * 60) / 5; i++, t += step) if (isWithin(hours, tz, t)) return t;
  return null;
}

function hourPhrase(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Phrase de délai à partir d'un instant cible (dans le fuseau du studio). */
export function etaPhrase(targetMs: number, nowMs: number, tz: string): string {
  const diffMin = Math.round((targetMs - nowMs) / 60_000);
  if (diffMin <= 5) return 'dans quelques minutes';
  if (diffMin <= 90) return `dans environ ${Math.max(5, Math.round(diffMin / 5) * 5)} minutes`;
  const t = localParts(targetMs, tz);
  const n = localParts(nowMs, tz);
  const rounded = Math.round(t.minutes / 15) * 15;
  if (t.dateKey === n.dateKey) return `vers ${hourPhrase(rounded)}`;
  const tomorrow = localParts(nowMs + 24 * 3600_000, tz);
  const moment = rounded < 12 * 60 ? 'matin' : rounded < 18 * 60 ? 'après-midi' : 'soir';
  if (t.dateKey === tomorrow.dateKey) return `demain ${moment} vers ${hourPhrase(rounded)}`;
  return `${DAY_FR[t.day] ?? ''} ${moment} vers ${hourPhrase(rounded)}`.trim();
}

/** Phrase « quand le gérant sera de retour » (pour les accusés hors horaires). */
export function managerBackPhrase(hours: Hours, tz: string, nowMs: number): string {
  const open = nextOpening(hours, tz, nowMs);
  if (open === null) return 'dès que possible';
  if (open <= nowMs) return 'tout de suite';
  const p = etaPhrase(open, nowMs, tz);
  return p.startsWith('dans ') ? `d'ici ${p.slice(5)}` : p;
}

export interface EtaInput {
  stage: string;
  stageChangedAtMs: number | null;
  lyricsLeadMin: number;
  productionLeadMin: number;
  videoLeadMin: number | null;
}

/**
 * Délais annonçables d'une commande. Une étape qui dépend du gérant démarre à sa prochaine
 * disponibilité ; un délai déjà dépassé de plus de 30 min n'est PAS annoncé (pas de fausse promesse).
 */
export function orderEtas(o: EtaInput, managerHours: Hours, tz: string, nowMs: number): { lyrics?: string; production?: string; video?: string } {
  const out: { lyrics?: string; production?: string; video?: string } = {};
  const since = o.stageChangedAtMs ?? nowMs;
  const humanEta = (leadMin: number): string | undefined => {
    const open = nextOpening(managerHours, tz, Math.max(since, nowMs - 0)) ?? null;
    if (open === null) return undefined;
    const start = open > nowMs ? open : since;
    const target = start + leadMin * 60_000;
    if (target < nowMs - 30 * 60_000) return undefined;
    return etaPhrase(Math.max(target, nowMs), nowMs, tz);
  };
  if (o.stage === 'brief_complete' || o.stage === 'lyrics_in_progress' || o.stage === 'lyrics_sent') {
    const v = humanEta(o.lyricsLeadMin);
    if (v) out.lyrics = v;
  }
  if (o.stage === 'in_production' || o.stage === 'lyrics_validated') {
    const target = since + o.productionLeadMin * 60_000;
    if (target >= nowMs - 30 * 60_000) out.production = etaPhrase(Math.max(target, nowMs), nowMs, tz);
  }
  if ((o.stage === 'audio_delivered' || o.stage === 'video_in_progress') && o.videoLeadMin !== null) {
    const v = humanEta(o.videoLeadMin);
    if (v) out.video = v;
  }
  return out;
}

export { DAYS };
