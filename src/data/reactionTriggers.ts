import {
  CreditCard,
  Flame,
  Hand,
  HandHeart,
  Heart,
  Mic,
  Music2,
  PartyPopper,
  Smile,
  Sparkles,
  Star,
  ThumbsUp,
  Timer,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Catalogue des réactions WhatsApp reconnues par les automatisations.
 * `value` est la donnée envoyée par WhatsApp et stockée dans automation_rules.trigger_value ;
 * l'interface n'affiche jamais le glyphe, seulement l'icône et le nom.
 */
export interface ReactionTrigger {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const REACTION_TRIGGERS: ReactionTrigger[] = [
  { value: '\u26A1', label: 'Éclair', icon: Zap },
  { value: '\u{1F3B5}', label: 'Note de musique', icon: Music2 },
  { value: '\u{1F4B0}', label: 'Sac d’argent', icon: Wallet },
  { value: '\u{1F3A4}', label: 'Micro', icon: Mic },
  { value: '\u23F1\uFE0F', label: 'Chronomètre', icon: Timer },
  { value: '\u{1F4B3}', label: 'Carte de paiement', icon: CreditCard },
  { value: '\u2728', label: 'Étincelles', icon: Sparkles },
  { value: '\u2B50', label: 'Étoile', icon: Star },
  { value: '\u2764\uFE0F', label: 'Cœur', icon: Heart },
  { value: '\u{1F44D}', label: 'Pouce levé', icon: ThumbsUp },
  { value: '\u{1F389}', label: 'Fête', icon: PartyPopper },
  { value: '\u{1F525}', label: 'Flamme', icon: Flame },
  { value: '\u{1F64F}', label: 'Mains jointes', icon: HandHeart },
  { value: '\u{1F60A}', label: 'Sourire', icon: Smile },
  { value: '\u{1F590}\uFE0F', label: 'Main ouverte', icon: Hand },
  { value: '\u{1F596}', label: 'Salut', icon: Hand },
];

/* Variantes (sélecteur de présentation, teinte de peau) ignorées pour la comparaison */
const bare = (s: string) => s.replace(/[\u{FE0E}\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, '').trim();

export function findReactionTrigger(value?: string | null): ReactionTrigger | undefined {
  if (!value) return undefined;
  const v = bare(value);
  return REACTION_TRIGGERS.find(t => bare(t.value) === v);
}

/** Point de code lisible pour une réaction hors catalogue (ex. U+1F44C) */
export function reactionCodepoint(value: string): string {
  return [...bare(value)].map(c => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`).join(' ');
}

export const sameReaction = (a?: string | null, b?: string | null) => !!a && !!b && bare(a) === bare(b);
