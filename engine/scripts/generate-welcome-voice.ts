import fs from 'node:fs';
import path from 'node:path';
import { encode } from '@msgpack/msgpack';

const FISH_API_KEY = process.env.FISH_API_KEY || 'sk-fish-rqWm8BgYyKZROEpKmgfZYfwpDp6x6cKy6oDCDncbq-w';
const REFERENCE_TEXT = "Donc je voulais vous dire merci pour vos commentaires, vos likes, vos partages à tous, ça me fait plaisir. Et puis quand vous m'envoyez des messages là, on me parle comme votre amie et tout, c'est un plaisir sincèrement, j'adore !";
const refAudioPath = path.resolve('/root/projets/velaris/engine/src/assets/sample_sister_reference.mp3');

const welcomeText = "Bonjour et bienvenue chez Djélia ! Nous composons des chansons personnalisées uniques pour toutes les occasions : anniversaire, mariage, déclaration d'amour ou hommage. Je vous transmets juste en dessous une courte vidéo de deux minutes qui vous montre comment créer votre chanson en quelques clics. Si vous avez la moindre question ou besoin d'aide pour vos paroles, dites-le moi, je suis là pour vous accompagner !";

async function main() {
  console.log('Loading reference audio from:', refAudioPath);
  const refBuf = fs.readFileSync(refAudioPath);
  console.log('Reference buffer size:', refBuf.length);

  const payload = {
    text: welcomeText,
    references: [
      {
        audio: new Uint8Array(refBuf),
        text: REFERENCE_TEXT,
      },
    ],
    format: 'opus',
  };

  console.log('Encoding payload with msgpack...');
  const packed = encode(payload);

  console.log('Calling Fish Audio TTS API...');
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/msgpack',
      model: 's2.1-pro-free',
    },
    body: packed,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Fish Audio HTTP ${res.status}: ${errText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const outBuf = Buffer.from(arrayBuf);
  console.log('Fish Audio generated audio size:', outBuf.length, 'bytes');

  const outPath = path.resolve('/root/projets/velaris/engine/src/assets/vocal_accueil_concierge.opus');
  fs.writeFileSync(outPath, outBuf);
  console.log('Successfully saved to:', outPath);
}

main().catch(err => {
  console.error('Error generating audio:', err);
  process.exit(1);
});
