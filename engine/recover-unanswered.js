import { RestDb } from './dist/src/db/rest.js';
import { WahaClient } from './dist/src/send/waha-client.js';

const db = new RestDb({
  url: process.env.SUPABASE_URL,
  secretKey: process.env.SUPABASE_SECRET_KEY,
});

const waha = new WahaClient({
  baseUrl: process.env.WAHA_URL,
  apiKey: process.env.WAHA_API_KEY,
});

const SESSION = 'Test';
const VOICE_URL = 'https://waha.velarisagent.life/qr/assets/vocal_accueil_concierge.opus';
const VIDEO_URL = 'https://waha.velarisagent.life/qr/assets/djelia_tuto_mobile.mp4';

// Liste des 18 clients identifiés avec leurs messages et personnalisation
const CLIENTS = [
  {
    chatId: '237653784822@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237675705209@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '22541585650@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237657610790@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '22595915782@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237676620417@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '22565553882@c.us',
    context: 'demande info + salut',
    text: "Bonjour ! Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237670494541@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237688331942@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237698339325@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237698609370@c.us',
    context: 'chanson anniversaire 15/11/2003',
    text: "Voici le lien de notre site officiel pour composer votre chanson d'anniversaire en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus : vous pourrez renseigner la date du 15 novembre et tous vos souvenirs pour générer vos paroles. Si vous avez la moindre question, écrivez-moi directement ici !"
  },
  {
    chatId: '237694667439@c.us',
    context: 'chanson anniversaire aujourdhui',
    text: "Voici le lien de notre site officiel pour composer votre chanson d'anniversaire immédiatement : https://djelia.store\n\nRegardez la courte vidéo ci-dessus : le studio compose vos paroles et vos 2 versions de chanson sont prêtes en 15-20 minutes. Si vous avez la moindre préoccupation, écrivez-moi directement ici !"
  },
  {
    chatId: '237699401968@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '237677122154@c.us',
    context: 'demande info',
    text: "Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation ou si vous bloquez à une étape, écrivez-moi directement ici, je suis là pour vous accompagner."
  },
  {
    chatId: '22586480511@c.us',
    context: 'chanson pour petite amie',
    text: "Voici le lien de notre site officiel pour composer la chanson pour votre petite amie en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus : vous pourrez choisir le style musical et personnaliser vos paroles d'amour. Écrivez-moi directement ici si vous bloquez !"
  },
  {
    chatId: '2250503399268@c.us',
    context: 'son dansant',
    text: "Voici le lien de notre site officiel pour composer votre chanson dansante en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus : vous pourrez choisir parmi tous les styles disponibles (Afrobeats, Amapiano, etc.). Écrivez-moi directement ici si besoin !"
  },
  {
    chatId: '237695503796@c.us',
    context: 'chanson amour 1 an de relation',
    text: "Voici le lien de notre site officiel pour composer votre chanson d'amour pour vos 1 an de relation : https://djelia.store\n\nRegardez la courte vidéo ci-dessus : vous pourrez personnaliser vos paroles avec votre histoire. Écrivez-moi directement ici si vous avez la moindre question !"
  },
  {
    chatId: '22549521592@c.us',
    context: 'anniversaire 20 novembre',
    text: "Bonjour ! Oui c'est tout à fait possible pour votre anniversaire du 20 novembre. Voici le lien de notre site officiel pour composer votre chanson en quelques clics : https://djelia.store\n\nRegardez la courte vidéo ci-dessus et si vous avez la moindre préoccupation, écrivez-moi directement ici !"
  }
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`🚀 Début de la procédure de réponse aux ${CLIENTS.length} clients en attente...`);

  for (let i = 0; i < CLIENTS.length; i++) {
    const item = CLIENTS[i];
    console.log(`\n[${i + 1}/${CLIENTS.length}] Traitement de ${item.chatId} (${item.context})...`);

    try {
      // 1. Récupération ou vérification de la conversation
      const convRows = await db.queryTable('conversations', `chat_id=eq.${encodeURIComponent(item.chatId)}&limit=1`);
      const conv = convRows?.[0];

      // 2. Réactivation en mode AI et purge du last_merchant_at induit par l'auto-greeting
      if (conv?.id) {
        await db.updateRows('conversations', `id=eq.${conv.id}`, {
          control_mode: 'ai',
          last_merchant_at: null,
          ack_log: {
            ...(conv.ack_log || {}),
            concierge_onboarding_sent: true,
            concierge_onboarding_sent_at: new Date().toISOString(),
            video_tutorial_sent: true,
            video_tutorial_sent_at: new Date().toISOString(),
            recovered_at: new Date().toISOString()
          }
        });
        console.log(`  ✅ Conversation réactivée en mode AI`);
      }

      // 3. Indicateur de saisie WhatsApp
      await waha.typing(SESSION, item.chatId, true).catch(() => undefined);
      await sleep(1500);

      // 4. Envoi de la note vocale (voix soeur Fish Audio)
      const voiceRes = await waha.send(SESSION, item.chatId, {
        kind: 'voice',
        url: VOICE_URL,
        mimetype: 'audio/ogg; codecs=opus'
      });
      console.log(`  🎙️ Vocal envoyé:`, voiceRes.status);
      await sleep(2000);

      // 5. Envoi de la vidéo tutoriel
      const videoRes = await waha.send(SESSION, item.chatId, {
        kind: 'video',
        url: VIDEO_URL,
        filename: 'djelia_tuto_mobile.mp4',
        mimetype: 'video/mp4',
        caption: 'Comment composer votre chanson personnalisée en 2 minutes sur Djélia'
      });
      console.log(`  🎬 Vidéo tutoriel envoyée:`, videoRes.status);
      await sleep(2000);

      // 6. Envoi du message texte
      const textRes = await waha.send(SESSION, item.chatId, {
        kind: 'text',
        text: item.text
      });
      console.log(`  💬 Message texte envoyé:`, textRes.status);

      // 7. Arrêt indicateur de saisie
      await waha.typing(SESSION, item.chatId, false).catch(() => undefined);

      // 8. Enregistrement en base dans la table messages
      if (conv?.id) {
        await db.insertRow('messages', {
          conversation_id: conv.id,
          user_id: conv.user_id,
          role: 'agent',
          direction: 'outbound',
          body: item.text,
          media_kind: null,
          metadata: { recovered: true }
        }).catch(() => undefined);
      }

      console.log(`  ✨ Client ${item.chatId} traité avec succès !`);

      // Pause de sécurité de 3 secondes avant le prochain client
      if (i < CLIENTS.length - 1) {
        await sleep(3000);
      }
    } catch (err) {
      console.error(`  ❌ Erreur sur ${item.chatId}:`, err?.message || err);
    }
  }

  console.log(`\n🎉 Fin du traitement ! Tous les clients ont reçu leur pack d'accueil.`);
}

main().catch(console.error);
