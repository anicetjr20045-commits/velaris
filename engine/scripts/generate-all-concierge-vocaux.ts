import fs from 'node:fs';
import path from 'node:path';
import { encode } from '@msgpack/msgpack';

const FISH_API_KEY = process.env.FISH_API_KEY;
const REFERENCE_TEXT = "Donc je voulais vous dire merci pour vos commentaires, vos likes, vos partages à tous, ça me fait plaisir. Et puis quand vous m'envoyez des messages là, on me parle comme votre amie et tout, c'est un plaisir sincèrement, j'adore !";
const refAudioPath = path.resolve('/root/projets/velaris/engine/src/assets/sample_sister_reference.mp3');

const welcomeText = "Bonjour et bienvenue chez Djélia ! Nous composons des chansons personnalisées uniques pour toutes les occasions : anniversaire, mariage, déclaration d'amour ou hommage. Je vous transmets juste en dessous une courte vidéo de deux minutes qui vous montre comment créer votre chanson en moins de cinq minutes sur notre studio. Regardez la vidéo, et si vous avez la moindre question ou besoin d'aide pour vos paroles, n'hésitez surtout pas à me demander, je suis là pour vous accompagner !";

const priceText = "Bonjour et bienvenue chez Djélia ! Pour faire composer votre chanson personnalisée, c'est seulement 1 200 francs. Et pour ce tarif, vous recevez deux versions complètes avec vos propres paroles. Je vous transmets juste en dessous une petite vidéo qui vous montre exactement comment faire sur le studio. Regardez la vidéo, et si vous avez la moindre question, n'hésitez pas à me demander ici !";

async function generateAudio(text: string, outFilename: string) {
  console.log(`Generating: ${outFilename}...`);
  const refBuf = fs.readFileSync(refAudioPath);
  const payload = {
    text,
    references: [
      {
        audio: new Uint8Array(refBuf),
        text: REFERENCE_TEXT,
      },
    ],
    format: 'opus',
  };

  const packed = encode(payload);
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
  const outPath = path.resolve('/root/projets/velaris/engine/src/assets', outFilename);
  fs.writeFileSync(outPath, outBuf);
  console.log(`Saved: ${outPath} (${outBuf.length} bytes)`);
}

async function main() {
  await generateAudio(welcomeText, 'vocal_accueil_concierge.opus');
  await generateAudio(priceText, 'vocal_prix_concierge.opus');
  console.log('All concierge vocaux generated successfully!');
}

main().catch(err => {
  console.error('Error generating audio:', err);
  process.exit(1);
});
