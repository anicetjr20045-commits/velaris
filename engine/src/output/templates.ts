/**
 * Gabarits par défaut (§ 12.3). Textes sobres, sans emoji, neutres en genre.
 * Un studio peut remplacer n'importe quel gabarit (table studio_templates, même clé).
 * Variables {nom} remplies par le code uniquement ; une variable inconnue rend le gabarit invalide.
 */

export const DEFAULT_TEMPLATES: Readonly<Record<string, string>> = {
  welcome: 'Bonjour et bienvenue chez {studio_name}. Je suis {agent_name}, je vous accompagne pour votre chanson personnalisée.',
  welcome_returning: 'Bonjour{client_first_name_sp}, quel plaisir de vous retrouver chez {studio_name}.',
  present_offers: 'Voici nos formules :\n{offers_list}\n{field_question}',
  explain_process:
    'Nous composons une chanson unique à partir de votre histoire : vous nous parlez de la personne, nous écrivons le texte, vous le validez, puis nous produisons la chanson.\n{offers_list}\n{field_question}',
  ask_offer_for_payment: 'Avec plaisir. Pour quelle formule souhaitez-vous régler ?\n{offers_list}',
  forward_move: 'Nous créons des chansons personnalisées pour vos proches.\n{offers_list}\n{forward_question}',
  ask_next_field: '{field_question}',
  guide_brief: 'Pas d\'inquiétude, on y va doucement. {field_question}',
  confirm_recipient_name: 'Pour bien chanter son prénom : c\'est bien {recipient} ?',
  acknowledge_story: 'Merci de nous confier cette histoire, nous allons en prendre grand soin.{field_question_sp}',
  ack_own_lyrics: 'Merci, j\'ai bien noté votre texte, je le transmets à {manager}.',
  brief_received: 'Merci, j\'ai tout ce qu\'il faut. {manager} commence l\'écriture de votre texte{eta_sp}.',
  lyrics_eta: 'Votre texte est en cours d\'écriture, il sera prêt {eta_phrase}.',
  ack_new_detail: 'C\'est noté, je le transmets à {manager} pour le texte.',
  recap_change_request: 'C\'est bien noté pour ces ajustements. Est-ce bien tout, ou vous souhaitez modifier un autre détail avant la correction ?',
  ack_change_request: 'C\'est noté, {manager} reprend le texte{eta_sp}.',
  deliver_lyrics: 'Voici le texte composé pour {recipient} :\n\n{lyrics}\n\nOn garde ce texte tel quel ?',
  deliver_revised_lyrics: 'Voici votre texte corrigé pour {recipient} :\n\n{lyrics}\n\nOn garde ce texte tel quel ?',
  thank_validation: 'Merci beaucoup, ravi que le texte vous plaise.',
  confirm_keep_lyrics: 'On garde ce texte tel quel ?',
  production_eta: 'Votre chanson est en production, elle sera prête {eta_phrase}.',
  video_eta: 'Le montage vidéo est en cours, il sera prêt {eta_phrase}.',
  ack_photos: 'Merci pour les photos, elles sont bien reçues pour le montage.',
  thank_after_delivery: 'Merci pour votre confiance. À très bientôt chez {studio_name}.',
  decline_discount_politely: 'Nos prix sont déjà au plus juste pour un travail fait sur mesure :\n{offers_list}',
  ack_deferral: 'Pas de souci, faites-le quand le kiosque ouvre. Votre commande{for_recipient_sp} est bien gardée.',
  payment_instructions:
    'Avec plaisir. Pour {orders_list}, le total est de {total} F CFA.\n{payment_lines}\nDès que c\'est fait, envoyez-moi simplement la capture ou le message de confirmation.',
  payment_claim_ack: 'Merci beaucoup. {manager} vérifie la réception et lance la suite tout de suite.',
  'payment_claim_ack.offhours': 'Merci beaucoup. {manager} vérifie la réception {manager_back_phrase} et lance la suite aussitôt.',
  'payment_claim_ack.confirmed': 'Votre paiement est bien confirmé, merci.',
  disambiguate_order: 'C\'est pour la chanson de {candidates} ?',
  confirm_cancel: 'Souhaitez-vous vraiment annuler la commande{for_recipient_sp} ?',
  'confirm_cancel.done': 'C\'est annulé. Si vous changez d\'avis, écrivez-nous simplement.',
  reassure_trust: 'Je comprends votre prudence. {trust_policy}Le dépôt se fait au nom de {holder}, responsable du studio.{trust_sample}',
  send_sample: 'Voici un exemple de ce que nous créons.',
  identity: 'Je suis {agent_name}, l\'assistant du studio de {manager}. C\'est {manager} qui supervise chaque chanson.',
  handoff_ack: 'Je transmets à {manager}, qui vous répond très vite.',
  'handoff_ack.offhours': 'Je transmets à {manager}, qui vous répond {manager_back_phrase}.',
  stop_ack: 'Très bien, je ne vous dérange plus. Si un jour vous souhaitez une chanson, écrivez-nous simplement.',
  'followup.brief_incomplete': 'Je reste disponible pour votre chanson{for_recipient_sp}. {field_question}',
  'followup.lyrics_unanswered': 'Avez-vous pu lire le texte ? Dites-moi simplement s\'il vous plaît tel quel.',
  'followup.payment_pending': 'Je reviens vers vous pour la chanson{for_recipient_sp}. Le dépôt peut se faire quand vous voulez :\n{payment_lines}',
  'followup.payment_after_deferral': 'Bonjour, les kiosques sont ouverts. Le dépôt pour la chanson{for_recipient_sp} peut se faire ici :\n{payment_lines}',
};

export const FIELD_QUESTIONS: Readonly<Record<string, string>> = {
  occasion: 'C\'est pour quelle occasion ?',
  recipient_name: 'Quel est le prénom de la personne à qui la chanson est destinée ?',
  recipient_relation: 'Quel lien avez-vous avec cette personne ?',
  sender_name: 'De la part de qui sera la chanson ?',
  style: 'Quel style de musique aimeriez-vous ?',
  voice: 'Préférez-vous une voix d\'homme, de femme, ou un duo ?',
  language: 'Dans quelle langue souhaitez-vous la chanson ?',
  memories: 'Y a-t-il un message particulier que vous aimeriez transmettre à travers la chanson ?',
  photos: 'Pouvez-vous m\'envoyer quelques photos pour le montage ?',
  offer: 'Quelle formule vous intéresse ?',
};

const PLACEHOLDER = /\{([a-z_]+)\}/g;

export class TemplateError extends Error {}

/** Remplit un gabarit. Toute variable absente ou vide (hors variables « _sp » facultatives) est une erreur. */
export function fillTemplate(template: string, vars: Readonly<Record<string, string | undefined>>): string {
  const out = template.replace(PLACEHOLDER, (_m, name: string) => {
    const v = vars[name];
    if (v === undefined || (v === '' && !name.endsWith('_sp'))) throw new TemplateError(`variable manquante : ${name}`);
    return v;
  });
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Variables utilisées par un gabarit (pour valider un gabarit de studio à l'enregistrement). */
export function templateVariables(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]!);
}
