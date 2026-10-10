# Bac à sable à scénarios

Rejoue des conversations client complètes contre le vrai moteur (`runTurn`),
avec un LLM simulé. Ça teste la **machine** — états, transitions, gardes
anti-doublon, debounce, emojis, relais — pas la qualité littéraire du prompt.

```bash
npm run test:scenarios   # ~1 min, 12 scénarios
```

## Ajouter un scénario (2 minutes, le workflow bug → test)

1. Le gérant signale un bug : *texte du client / réponse du bot / réponse attendue*.
2. Copier `s01.ts` vers `s13-mon-cas.ts` : décrire les étapes
   (`client`, `merchant`, `react`, `pump`) et les `expect`.
3. Scripter le LLM simulé avec `U()` (classifieur) et `S()` (sales brain).
   Les `quote` des champs doivent apparaître dans le message client (le code les vérifie).
4. L'importer dans `index.ts`. Lancer : **rouge** → corriger → **vert**.
   Le scénario reste : non-régression garantie.

## Étapes disponibles

| Étape | Effet |
|---|---|
| `{ client: "…" }` / `{ client: ["…", "…"] }` | message(s) client ; un tableau = une rafale |
| `{ merchant: "…" }` | le gérant écrit → il prend la main, l'outbox agent est annulée |
| `{ react: { emoji: '✨'│'🎵'│'🎉'│'📝', on: 'last_client'│'last_merchant' } }` | réaction emoji du gérant |
| `{ pump: true }` | exécute les tours en attente (saute les 20 s du debounce) |
| `{ exec: async (db, { convId }) => … }` | échappatoire SQL directe |
| `{ expect: … }` | assertions (voir `types.ts`) |

## Ce que ça ne teste pas (V2)

- La qualité du prompt lui-même → mode « LLM réel » à venir.
- Le replay automatique depuis les conversations de prod → extracteur à venir.
- Les variantes chaos (fautes, nouchi, ordre mélangé) → générateur à venir.
