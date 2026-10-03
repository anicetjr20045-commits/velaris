/**
 * Corpus de référence de la compréhension (§ 2.4, § 9.5, § 20.3).
 * Tournures réelles du terrain ouest-africain (dossier Alex) : chaque ligne est À LA FOIS
 * un exemple du prompt DeepSeek (FEW_SHOT = true) et un cas du jeu d'évaluation.
 * Aucune donnée client réelle : formulations reconstituées, prénoms d'exemple.
 *
 * Règle (§ 21.1) : une tournure mal comprise en production devient une ligne ici, jamais une regex.
 */

export interface CorpusCase {
  id: string;
  context: { stage: string; pendingQuestion?: string; paymentStatus?: string };
  text: string;
  expect: {
    primary_intent: string;
    payment_kind?: string;
    negated?: boolean;
    emotional_weight?: string;
    fields?: Readonly<Record<string, string>>;
  };
  fewShot: boolean;
}

export const CORPUS: readonly CorpusCase[] = [
  // Paiement : toutes les formulations du « numéro de dépôt » (cas Fargo, Djalilou)
  { id: 'pay-01', context: { stage: 'lyrics_sent', paymentStatus: 'unpaid' }, text: 'Le numéro de dépôt', expect: { primary_intent: 'ask_payment_method', payment_kind: 'asks_how_to_pay' }, fewShot: true },
  { id: 'pay-02', context: { stage: 'collecting_brief', paymentStatus: 'unpaid' }, text: 'Le dépôt c’est sur quelle numéro ?', expect: { primary_intent: 'ask_payment_method', payment_kind: 'asks_how_to_pay' }, fewShot: true },
  { id: 'pay-03', context: { stage: 'lyrics_validated', paymentStatus: 'unpaid' }, text: 'C sur kel numero je depose', expect: { primary_intent: 'ask_payment_method', payment_kind: 'asks_how_to_pay' }, fewShot: false },
  { id: 'pay-04', context: { stage: 'lyrics_validated', paymentStatus: 'unpaid' }, text: 'OM ou Wave ?', expect: { primary_intent: 'ask_payment_method', payment_kind: 'asks_how_to_pay' }, fewShot: true },
  { id: 'pay-05', context: { stage: 'lyrics_validated', paymentStatus: 'instructions_sent' }, text: 'Mais dépôt là si c’est demain je ne peux pas vous faire ça la nuit', expect: { primary_intent: 'payment_deferral', payment_kind: 'defers' }, fewShot: true },
  { id: 'pay-06', context: { stage: 'lyrics_validated', paymentStatus: 'instructions_sent' }, text: 'C’est fait, j’ai envoyé sur Orange Money', expect: { primary_intent: 'payment_claim', payment_kind: 'claims_paid' }, fewShot: true },
  { id: 'pay-07', context: { stage: 'lyrics_validated', paymentStatus: 'instructions_sent' }, text: 'Je n’ai pas encore payé, je fais ça ce soir', expect: { primary_intent: 'payment_deferral', payment_kind: 'defers', negated: true }, fewShot: true },
  { id: 'pay-08', context: { stage: 'lyrics_validated', paymentStatus: 'instructions_sent' }, text: 'Transfert effectué', expect: { primary_intent: 'payment_claim', payment_kind: 'claims_paid' }, fewShot: false },
  { id: 'pay-09', context: { stage: 'lyrics_validated', paymentStatus: 'instructions_sent' }, text: 'Je suis pas encore à la maison, je dépose en rentrant', expect: { primary_intent: 'payment_deferral', payment_kind: 'defers' }, fewShot: false },

  // Accusés et attente : jamais un paiement, jamais un refus (cas Djalilou, Adeline)
  { id: 'ack-01', context: { stage: 'lyrics_in_progress', paymentStatus: 'unpaid' }, text: 'Bien reçu', expect: { primary_intent: 'acknowledgement', payment_kind: 'none' }, fewShot: true },
  { id: 'ack-02', context: { stage: 'lyrics_in_progress' }, text: 'D’accord pas de soucis j’attends alors', expect: { primary_intent: 'patient_wait', payment_kind: 'none' }, fewShot: true },
  { id: 'ack-03', context: { stage: 'lyrics_in_progress' }, text: 'Ok merci beaucoup', expect: { primary_intent: 'acknowledgement' }, fewShot: false },
  { id: 'ack-04', context: { stage: 'lyrics_in_progress' }, text: 'J’attends hein', expect: { primary_intent: 'patient_wait' }, fewShot: false },
  { id: 'ack-05', context: { stage: 'lyrics_validated', pendingQuestion: 'avez-vous fait le dépôt ?', paymentStatus: 'instructions_sent' }, text: 'Non pas encore', expect: { primary_intent: 'confirm_no', payment_kind: 'none' }, fewShot: true },
  { id: 'ack-06', context: { stage: 'lyrics_in_progress' }, text: 'C’est pour quand ?', expect: { primary_intent: 'ask_status' }, fewShot: false },

  // Paroles : validation, appréciation, retouche
  { id: 'lyr-01', context: { stage: 'lyrics_sent', pendingQuestion: 'le texte vous plaît-il ?' }, text: 'C’est validé', expect: { primary_intent: 'validate_lyrics' }, fewShot: true },
  { id: 'lyr-02', context: { stage: 'lyrics_sent' }, text: 'C’est propre', expect: { primary_intent: 'positive_feedback' }, fewShot: true },
  { id: 'lyr-03', context: { stage: 'lyrics_sent' }, text: 'Ça me va, on peut continuer', expect: { primary_intent: 'validate_lyrics' }, fewShot: false },
  { id: 'lyr-04', context: { stage: 'lyrics_sent' }, text: 'Il faut ajouter que c’est elle qui m’a soutenu quand j’étais malade', expect: { primary_intent: 'request_lyrics_change' }, fewShot: true },
  { id: 'lyr-05', context: { stage: 'lyrics_sent' }, text: 'Waouh c’est doux, ça m’a touché', expect: { primary_intent: 'positive_feedback' }, fewShot: false },

  // Accueil, nouchi, exemples (cas 5)
  { id: 'acc-01', context: { stage: 'none' }, text: 'Kpata là voyons voir le son', expect: { primary_intent: 'ask_sample' }, fewShot: true },
  { id: 'acc-02', context: { stage: 'none' }, text: 'Bonjour je veux une chanson', expect: { primary_intent: 'order_song' }, fewShot: true },
  { id: 'acc-03', context: { stage: 'none' }, text: 'C’est combien ?', expect: { primary_intent: 'ask_price' }, fewShot: true },
  { id: 'acc-04', context: { stage: 'none' }, text: 'Je veux en savoir plus sur vos chansons', expect: { primary_intent: 'ask_how_it_works' }, fewShot: false },
  { id: 'acc-05', context: { stage: 'none' }, text: 'Envoyez un exemple d’abord', expect: { primary_intent: 'ask_sample' }, fewShot: false },
  { id: 'acc-06', context: { stage: 'collecting_brief' }, text: 'On va s’enjailler, mets un son qui bouge', expect: { primary_intent: 'give_brief_info', fields: { style: 'festif' } }, fewShot: true },

  // Brief, récits, guidage (cas Sylvie, Fargo, Djalilou)
  { id: 'brf-01', context: { stage: 'collecting_brief' }, text: 'C’est pour l’anniversaire de ma femme Awa', expect: { primary_intent: 'give_brief_info', fields: { occasion: 'anniversaire', recipient_name: 'Awa' } }, fewShot: true },
  { id: 'brf-02', context: { stage: 'collecting_brief' }, text: 'Vraiment je ne sais même pas ce que je vais dire', expect: { primary_intent: 'needs_guidance' }, fewShot: true },
  {
    id: 'brf-03', context: { stage: 'collecting_brief' },
    text: 'En fait je ne sais pas quoi lui dire. Stevens a 24 ans, depuis la mort de son père c’est lui qui soutient toute la famille, il est courageux, c’est notre lumière.',
    expect: { primary_intent: 'shares_story', emotional_weight: 'high', fields: { recipient_name: 'Stevens' } }, fewShot: true,
  },
  { id: 'brf-04', context: { stage: 'collecting_brief', pendingQuestion: 'c’est bien Awa ?' }, text: 'Oui c’est ça', expect: { primary_intent: 'confirm_yes' }, fewShot: false },
  { id: 'brf-05', context: { stage: 'collecting_brief' }, text: 'Voici les paroles que j’ai écrites moi-même : Maman tu es ma lumière…', expect: { primary_intent: 'provides_own_lyrics' }, fewShot: true },

  // Confiance, identité, arrêt, humain
  { id: 'trs-01', context: { stage: 'collecting_brief' }, text: 'C’est pas arnaque ça ? Comment je sais que c’est vrai', expect: { primary_intent: 'trust_concern' }, fewShot: true },
  { id: 'trs-02', context: { stage: 'collecting_brief' }, text: 'Vous êtes un robot ?', expect: { primary_intent: 'asks_if_bot' }, fewShot: true },
  { id: 'stp-01', context: { stage: 'collecting_brief' }, text: 'Laissez-moi tranquille, je ne suis pas intéressé', expect: { primary_intent: 'stop_contact' }, fewShot: true },
  { id: 'hum-01', context: { stage: 'collecting_brief' }, text: 'Je veux parler au responsable', expect: { primary_intent: 'ask_human' }, fewShot: false },
  { id: 'mul-01', context: { stage: 'lyrics_sent' }, text: 'Je veux aussi une chanson pour ma mère', expect: { primary_intent: 'order_song' }, fewShot: true },
];
