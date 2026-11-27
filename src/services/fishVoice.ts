/**
 * Service Client Fish Audio pour le Studio Vocal & Synthèse IA Velaris
 * Génère des notes vocales réalistes et des audios WhatsApp PTT (Opus / MP3).
 */

export interface FishVoiceItem {
  id: string;
  name: string;
  gender: 'Femme' | 'Homme';
  accent: string;
  reference_id: string;
  description: string;
  tag: string;
  sampleText: string;
}

export const FISH_VOICES: FishVoiceItem[] = [
  {
    id: 'awa',
    name: 'Awa',
    gender: 'Femme',
    accent: 'Ivoirienne Chaleureuse',
    reference_id: '9bdcf5be57564499848e4ac474f365d5',
    description: 'Voix féminine ivoirienne bienveillante et naturelle. Idéale pour l’accueil des clients et le vocal de procédure.',
    tag: 'Signature Studio',
    sampleText: 'Bonjour et bienvenue chez notre studio de chansons personnalisées. Dites-moi, pour qui souhaitez-vous créer cette belle surprise ?',
  },
  {
    id: 'koffi',
    name: 'Koffi',
    gender: 'Homme',
    accent: 'Ivoirien Posé',
    reference_id: '040a6f49f8574f478b2241353771ffe3',
    description: 'Voix masculine posée, digne et rassurante. Parfaite pour confirmer les détails de commande et les tarifs.',
    tag: 'Confiance & Devis',
    sampleText: 'Parfait, nous avons bien noté vos détails. Notre équipe de compositeurs prépare votre chanson avec le plus grand soin.',
  },
  {
    id: 'fatou',
    name: 'Fatou',
    gender: 'Femme',
    accent: 'Africaine Énergique',
    reference_id: '30651563d9094145a199660bdb5b870a',
    description: 'Voix féminine souriante, vive et entraînante. Excellente pour relancer les clients indécis avec sympathie.',
    tag: 'Relance Souriante',
    sampleText: 'Coucou ! Je voulais juste prendre de vos nouvelles pour savoir si vous vouliez qu’on compose votre chanson pour votre célébration !',
  },
  {
    id: 'samba',
    name: 'Samba',
    gender: 'Homme',
    accent: 'Conteur Chaleureux',
    reference_id: 'a283f5bba90f43b29d8c0acdbf885c9e',
    description: 'Voix masculine expressive et chaleureuse. Idéale pour raconter une histoire ou présenter un concept émouvant.',
    tag: 'Storytelling & Émotion',
    sampleText: 'Chaque chanson raconte une histoire unique. Racontez-nous la vôtre, et nous la transformerons en chef-d’œuvre musical.',
  },
  {
    id: 'celeste',
    name: 'Céleste',
    gender: 'Femme',
    accent: 'Studio Douceur',
    reference_id: 'a9bd89d93bd24c91aa18fe2be835d07d',
    description: 'Voix féminine douce, calme et très émouvante. Parfaite pour les chansons d’hommage, de déclaration et de mariage.',
    tag: 'Douceur & Mariage',
    sampleText: 'Votre chanson personnalisée est prête et masterisée. Voici votre lien d’écoute confidentiel pour découvrir le résultat.',
  },
  {
    id: 'adrien',
    name: 'Adrien',
    gender: 'Homme',
    accent: 'Studio Prestige',
    reference_id: '76d65c1e73774db69683a553b30b414f',
    description: 'Voix masculine radio, profonde et élégante. Apporte une autorité et une touche de luxe à vos vocaux officiels.',
    tag: 'Élégance & Radio',
    sampleText: 'Votre règlement a été validé avec succès par notre direction. La production studio démarre immédiatement.',
  },
];

export interface VoiceScriptTemplate {
  id: string;
  title: string;
  badge: string;
  text: string;
}

export const VOICE_SCRIPT_TEMPLATES: VoiceScriptTemplate[] = [
  {
    id: 'procedure',
    title: 'Vocal de Procédure Officiel',
    badge: 'Recommandé Vente',
    text: "Alors, pour la commande de votre chanson, c'est super simple ! Vous nous donnez juste le prénom et les anecdotes clés de la personne. Nos musiciens composent 2 versions exclusives et on vous envoie le lien d'écoute dès que c'est prêt.",
  },
  {
    id: 'welcome',
    title: 'Accueil & Prise de Brief',
    badge: 'Premier Contact',
    text: "Bonjour et bienvenue dans notre studio de chansons personnalisées ! Dites-moi, pour qui souhaitez-vous créer cette belle surprise et quelle est l'occasion ?",
  },
  {
    id: 'payment_received',
    title: 'Validation de Paiement',
    badge: 'Après Paiement',
    text: "Reçu de paiement bien validé ! Merci infiniment pour votre confiance. Nos compositeurs démarrent la production immédiatement au studio.",
  },
  {
    id: 'ready_for_delivery',
    title: 'Avis de Livraison Prête',
    badge: 'Livraison Chanson',
    text: "Excellente nouvelle ! Votre chanson personnalisée est prête et masterisée au studio. Je vous partage votre lien d'écoute sécurisé dès maintenant !",
  },
  {
    id: 'followup',
    title: 'Relance Bienveillante',
    badge: 'Relance Client',
    text: "Coucou ! Je prenais juste de vos nouvelles pour savoir si vous souhaitiez qu'on lance la création de votre chanson personnalisée pour votre événement ?",
  },
];

import { supabase } from './supabase';
import { refreshBilling } from './billing';

/**
 * Synthétise un texte avec la voix Fish Audio choisie via l'API serverless `/api/fish-voice`.
 */
export async function generateFishVoice(
  text: string,
  referenceId: string,
  format: 'mp3' | 'opus' = 'mp3',
  isSample: boolean = false,
): Promise<{ blob: Blob; url: string; mimeType: string }> {
  const clean = text.trim();
  if (!clean) throw new Error('Le texte est requis');

  // 1. Essai prioritaire via l'endpoint serveur du projet (avec débit sécurisé des crédits)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const res = await fetch('/api/fish-voice', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: clean,
        reference_id: referenceId,
        format,
        isSample,
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!res.ok) {
      const errJson: any = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Échec de synthèse vocale (${res.status}).`);
    }

    const mimeType = format === 'opus' ? 'audio/ogg; codecs=opus' : 'audio/mpeg';
    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    if (!isSample) void refreshBilling();
    return { blob, url, mimeType };
  } catch (err: any) {
    throw new Error(err?.message || 'Service de synthèse vocale indisponible.');
  }
}
