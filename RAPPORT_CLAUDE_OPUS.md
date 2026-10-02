# Rapport d'audit et de consolidation — Velaris Studio OS

**Auteur** : Claude Opus 5.5 (Claude Code) · **Date** : 2 octobre 2026 · **Dépôt** : `/root/projets/velaris` (branche `main`, non commité)

Ce rapport couvre les 8 points de `CLAUDE_MISSION.md` : constat, corrections apportées, ce qui reste à faire pour la mise en production, et l'étude technique sur l'agent WhatsApp autonome par utilisateur (point 8).

---

## 0. Synthèse

| Domaine | Constat avant intervention | État après intervention |
|---|---|---|
| Secrets | Clés **live** SasPay (`sk_live_…`), Kie.ai et WAHA en clair dans le bundle JavaScript public (GitHub Pages) | Plus aucune clé dans le code client. Quatre Edge Functions portent les secrets côté serveur |
| Paiements | Crédits ajoutés **avant** paiement (recharge libre), abonnement activé **avant** paiement, « 50 crédits » codés en dur à la vérification, solde en `localStorage` modifiable par l'utilisateur | Solde en base, crédité uniquement par le webhook signé, idempotent par référence de transaction |
| Webhook SasPay | Signature ignorée si le secret était absent (*fail open*), comparaison non constante, double crédit possible en cas de rejeu, incrément non atomique | *Fail closed*, comparaison en temps constant, fonction SQL atomique et idempotente, contrôle montant ↔ formule |
| Kie.ai | Échec de l'API → **morceau de démonstration livré au client comme s'il était le sien**, crédit débité quand même | Débit atomique côté serveur, remboursement automatique en cas d'échec, aucune piste de substitution, suivi réel de la tâche |
| WAHA | N'importe quel visiteur pouvait arrêter/redémarrer/envoyer depuis n'importe quelle session (y compris `anicet2`) ; clé API dans l'URL de l'image QR | Proxy authentifié : un studio n'agit que sur sa session ; `anicet2` en lecture seule à tous les niveaux ; QR récupéré en Blob validé |
| Quotas Supabase | Recherche du Copilot = téléchargement de tables entières à chaque question ; listes sans limite ; requêtes concurrentes empilées | Filtrage `ilike` côté Postgres, toutes les listes bornées, une seule requête en vol par hook, espacement exponentiel sur erreur |
| Automatisations | Deux règles pouvaient partager la même réaction (double envoi au client) ; émojis dans l'interface | Unicité vérifiée dans l'interface et par index unique en base ; sélecteur à icônes |
| Console admin | Accessible à tout visiteur, sondes avec clés client, chiffres partiellement simulés | Accès vérifié par `profiles.is_admin`, sondes serveur, métriques réelles du parc via RPC |

**Validation** : `npx tsc -p tsconfig.app.json --noEmit` → **0 erreur** ; `npm run build` → **succès, 0 erreur** ; aucune clé secrète dans le bundle `dist/`.
**Non vérifié** : aucun test en navigateur réel, aucune Edge Function déployée, migration SQL non appliquée (je n'ai pas d'accès au projet Supabase depuis cette machine). Voir § 10 pour la procédure de mise en production : **sans elle, les paiements, la génération Kie.ai et les lignes WhatsApp des studios connectés ne fonctionnent pas.**

---

## 1. Design intérieur et élimination des émojis (point 1)

### Corrections
- **`AutomationsView.tsx`** (cible principale) :
  - La barre de 12 émojis et le champ « Emoji déclencheur » sont remplacés par une grille de **réactions nommées avec icônes lucide** (`Éclair`, `Note de musique`, `Micro`, `Chronomètre`…). Catalogue unique : `src/data/reactionTriggers.ts`.
  - Le glyphe n'est **jamais affiché** : il reste une donnée (`automation_rules.trigger_value`), conformément à la note de la mission. Une réaction hors catalogue s'affiche par son point de code (`U+1F44C`) via la saisie avancée.
  - Les 4 modèles 1-clic ne contiennent plus d'émojis (ni dans les boutons ni dans le texte des tarifs).
  - Le bloc « Génération Chansons Kie.ai » est passé en graphite, interrupteurs `vx-switch`, numérotation `01 → 02 → 03` pour les étapes du test.
- **Balayage complet de `src/`** : les seuls caractères pictographiques restants sont des **données** (messages réels de clients dans `realProductionData.ts`, réactions WhatsApp stockées) ou de la typographie (`⌘K`, `→`). Les littéraux d'émojis dans le code de service ont été convertis en séquences d'échappement (`'\u{1F3B5}'`).
- `copilot.ts` : suppression des pictogrammes dans les réponses (`👉`, `ℹ️`).

### Harmonisation de la palette
- 17 composants internes du Studio : surfaces brunes (`#0C0A09`, `#13110E`, `#171512`…) remplacées par la gamme graphite (`#050608`, `#08090C`, `#0B0C10`, `#0E1015`), bordures `#2D261E`/`#3A3022` remplacées par `white/[0.08]`/`white/[0.12]`, gris chauds (`stone-*`, `#A8A29E`) par des gris neutres. Variables `--vx-*` de `index.css` alignées.
- Le site public (Landing, Navbar, Hero…) n'a pas été touché (déjà graphite).
- **Choix assumé** : l'or champagne (`#E5B54F`) est conservé comme **unique accent** (états actifs, chiffres clés). La console admin et les vues réécrites sont, elles, strictement monochromes (boutons pilule blancs). Si vous voulez retirer totalement l'or, c'est un remplacement mécanique de 6 valeurs, mais cela change l'identité validée au jalon 19 : décision à prendre de votre côté.

---

## 2. Copilot Studio (point 2)

`src/services/copilot.ts`, `src/components/StudioCopilotView.tsx`

### Défauts constatés
1. **Routage d'intentions par sous-chaîne** : « cout » matchait « é*cout*e », « dit » matchait « cré*dit* », « stat » matchait « in*stal*… ». Une question « écoute la chanson » partait en facturation.
2. **Lancement de production sans validation** : « lance la chanson » générait immédiatement (1 crédit), pour le client « Client » si aucun dossier n'était trouvé, avec des paroles génériques.
3. **Négation ignorée** : « ne lance pas la chanson » déclenchait la production.
4. **Débit du micro-crédit avant la réponse**, y compris quand la réponse échouait.
5. Paroles identiques pour tous les clients d'une même occasion (seul le prénom changeait).
6. Envoi WhatsApp réel depuis le Copilot en **mode démo**, vers les numéros de vrais clients des données de démonstration.

### Corrections
- Correspondance **en début de mot** (`termRe`) pour toutes les listes de mots-clés et la base de connaissance ; vocabulaire de facturation resserré (`credit`, `abonnement`, `recharge`, `saspay`…) — les tarifs clients relèvent de la base de connaissance.
- Détection de **négation** avant toute intention d'action.
- **Validation humaine avant action irréversible** : l'intention « lancer la chanson » exige un client identifié et produit une **carte de paroles à relire** (destinataire, occasion, style, coût, solde). La production ne part qu'au clic sur « Lancer la production · 1 crédit ».
- **Paroles personnalisées** : extraction des souvenirs du client dans ses propres messages (phrases contenant *toujours, souvenir, ensemble, soutenu…*, sans montants ni numéros), insérés dans un **pont** avant l'outro. Mise au format Suno (`[Verse 1]`, `[Chorus]`, métadonnées retirées, 3 000 caractères max) par `formatLyricsForSuno`.
- Micro-crédit débité **après** la réponse, via une fonction SQL atomique pour un studio connecté.
- Production suivie en direct : carte « Production en cours » qui se met à jour seule (`waitForKieSong`, sondage 10 s, 6 min max), statut `Échec · crédit remboursé` le cas échéant. Livraison possible uniquement pour un morceau réellement produit.
- `alert()` remplacé par un message d'état dans la carte ; envoi simulé en mode démo.

### Limite assumée
Le Copilot reste un moteur **déterministe** (intentions + extraction + gabarits). C'est fiable et gratuit, mais ce n'est pas un modèle de langage : la qualité poétique plafonne. La voie recommandée est décrite au § 9.6 (génération par LLM avec sortie structurée, validée par le même pipeline).

---

## 3. Chaîne VPS ↔ WAHA ↔ plateforme ↔ WhatsApp (point 3)

`src/services/waha.ts`, `src/hooks/useWaha.ts`, `QrConnectModal.tsx`, `WhatsAppLinesView.tsx`, `supabase/functions/waha-proxy/`

### Défauts constatés
- Clé `X-Api-Key` WAHA dans le bundle **et** dans l'URL de l'image QR (donc dans l'historique navigateur, les journaux du proxy, les en-têtes `Referer`).
- `WhatsAppLinesView` sondait et pilotait `Test` et `anicet2` pour **tout visiteur** : bouton « Déconnecter » actif sur `Test`, aucune protection de `anicet2` au niveau du service.
- `App.tsx` sondait WAHA toutes les 6 s pour **chaque visiteur anonyme** du site public (charge inutile sur le VPS).
- `QrConnectModal` sondait même fermée.
- `useWahaSession` réécrivait `wa_sessions` dans Supabase **toutes les 6 s** quand la ligne était connectée (une écriture par onglet ouvert).
- Session bloquée en `STARTING` jamais relancée ; `FAILED` traité par `start` au lieu de `restart`.
- Envois sans régulation : une rafale (relances, livraisons) partait en parallèle, ce que WhatsApp sanctionne.

### Corrections
- **Proxy `waha-proxy`** (Edge Function) : JWT obligatoire, liste blanche des chemins WAHA utilisés, un studio n'agit que sur `studio_<8 caractères de son id>`, liste des sessions réservée aux administrateurs, sessions protégées (`WAHA_PROTECTED_SESSIONS`, défaut `anicet2`) **jamais** arrêtées, redémarrées ni utilisées pour envoyer. La configuration de création de session est imposée côté serveur (webhooks `message`, `message.reaction`, `message.ack`, `session.status`).
- **Service client** : transport `proxy` par défaut ; mode `direct` uniquement si `VITE_WAHA_API_KEY` est fourni explicitement (transition). Garde `isProtectedSession` sur toutes les actions et tous les envois.
- **Envois** : file par session (2 envois simultanés maximum), reprise automatique **uniquement** sur 429/502/503 (message non accepté) avec espacement exponentiel ; aucune reprise sur délai dépassé (le message a pu partir : éviter le doublon).
- **Heartbeat** : intervalle 20 s avec gigue ±10 % (évite que tous les onglets sondent à la même milliseconde), relance d'une session bloquée en `STARTING` plus de 90 s, `restart` sur `FAILED`, provisionnement automatique sur 404.
- **`useWahaSession`** : sondage adaptatif (6 s en appairage, 30 s connecté, suspendu onglet masqué), une seule requête en vol, écriture `wa_sessions` **seulement au changement d'état** (upsert), QR en Blob validé renouvelé toutes les 18 s et URL objet libérée.
- **Vues** : chaque studio voit **sa** ligne (QR, latence, statut, déconnexion avec confirmation, console de test d'envoi sans numéro prérempli). Les lignes `Test` et `anicet2` n'apparaissent qu'aux administrateurs ; `anicet2` affichée « Préservée », sans aucune action.

### Ce qui garantit la tenue en charge
La synchronisation des messages entrants **ne dépend pas du navigateur** : WAHA pousse vers le moteur `velaris-agent` (webhook), qui écrit dans Supabase ; le Studio lit via Realtime + sondage de secours borné. Le navigateur ne fait que de l'affichage et des envois ponctuels. Le point dur restant est côté moteur (file d'attente et verrou par conversation), traité au § 9.

---

## 4. Moteur d'automatisations (point 4)

`src/services/automation.ts` n'existe pas dans le dépôt : l'exécution des règles est faite par le moteur serveur `velaris-agent` (`src/lib/automations.server.ts`), que j'ai lu sans le modifier (projet distinct). Le Studio gère la configuration et le déclenchement manuel.

### Défauts constatés et corrections
| Défaut | Correction |
|---|---|
| Deux règles actives sur la même réaction → le moteur exécute **les deux** (il filtre toutes les règles correspondantes) : double envoi au client | Refus à l'enregistrement et à l'activation dans l'interface ; **index unique partiel** `(user_id, trigger_type, trigger_value) WHERE enabled` dans la migration |
| Comparaison d'émojis stricte : `❤` ≠ `❤️`, teintes de peau | `sameReaction` / `sameEmoji` ignorent sélecteurs de variante et teintes |
| Bouton « Tester la réaction » : appel Kie.ai **réel**, 1 crédit débité, envoi WhatsApp vers `+226 79 29 64 99` (un vrai numéro de client) | **Test à blanc** : la chaîne est vérifiée étape par étape (réaction, paroles, solde, client, livraison) sans débit, sans appel ni envoi |
| Même brief déclenché deux fois en parallèle → deux productions | Verrou par identifiant de commande (`inFlight`) |
| « Nouveau client » = 0 ou 1 commande (un client avec une commande en cours était « nouveau » mais aussi parfois « ancien ») | Client fidèle = au moins une commande livrée |
| `text_body NOT NULL` dans le schéma initial alors que les règles vocal/média n'ont pas de texte | `DROP NOT NULL` + colonnes `action_type`, `media_path`, `caption` garanties par la migration |

### Recommandation pour `velaris-agent` (non appliquée, hors périmètre de ce dépôt)
- Dédoublonner l'événement `message.reaction` par `(message_id, emoji, sender)` : WhatsApp renvoie parfois la même réaction (retrait puis remise).
- Le budget horaire (`MAX_AUTOMATION_SENDS_PER_HOUR`) est lu puis décrémenté en mémoire : deux webhooks simultanés peuvent le dépasser. Utiliser un compteur atomique (fonction SQL `UPDATE … RETURNING`) comme pour les crédits.

---

## 5. Paiements SasPay, webhooks et Kie.ai (point 5)

### Failles constatées (par gravité)
1. **Clé secrète SasPay live dans le bundle public** : quiconque ouvre les outils de développement du site peut créer des sessions de paiement, lire les transactions et, selon les droits de la clé, effectuer des opérations sur le compte marchand. **Cette clé doit être révoquée**, elle est aussi dans l'historique Git et dans `ACTIVE_STATE.md` (ce dernier a été expurgé).
2. **Crédits accordés sans paiement** : `StudioProfileView` appelait `rechargeCredits()` **avant** la redirection vers SasPay ; il suffisait d'ouvrir le paiement et de fermer l'onglet. Idem `activateSubscription()` pour l'abonnement.
3. **Solde dans `localStorage`** : modifiable en une ligne de console. Aucune vérification serveur avant une génération Kie.ai (coût réel).
4. **Webhook *fail open*** : sans `SASPAY_WEBHOOK_SECRET`, aucune signature n'était vérifiée → n'importe qui pouvait créditer n'importe quel compte avec un `POST`.
5. **Double crédit** : aucune idempotence ; un rejeu dans la fenêtre de 300 s ou une relivraison SasPay créditait deux fois. Incrément lecture-puis-écriture non atomique.
6. Le montant de l'abonnement était choisi par le navigateur (`metadata.type = 'subscription'` en minuscules, alors que le webhook attendait `SUBSCRIPTION` : les abonnements payés étaient en réalité **traités comme des recharges**).
7. `verifyAndApplySasPayPayment` créditait **50 crédits fixes** quel que soit le montant payé.
8. Kie.ai : sur erreur ou solde Kie nul, le service renvoyait `success: true` avec un **morceau de démonstration** (`mariam_afrolove.mp3`), ensuite livrable au client comme sa chanson.

### Architecture corrigée
```
Navigateur ──JWT──▶ saspay-checkout ──clé──▶ SasPay (montant, type et userId fixés côté serveur)
                                              │
SasPay ──signé HMAC──▶ saspay-webhook ──▶ velaris_apply_payment()  (idempotent sur la référence)
                                              │
Navigateur ◀── lecture seule ── profiles.credits / credit_transactions (RLS)

Navigateur ──JWT──▶ kie-generate ──▶ velaris_consume_credits_for() ──▶ Kie.ai
                         │ échec Kie ─▶ velaris_refund_credits()   (idempotent)
                         └ suivi ─▶ song_generations (statut, audio, remboursement si échec Suno)
```
- **`saspay-checkout`** : abonnement 3 000 F / 30 j ou 7 000 F / 90 j (prix imposés), recharge libre 200 F à 500 000 F, `return_url` HTTPS uniquement, action `status` en lecture seule.
- **`saspay-webhook`** : secret obligatoire (503 sinon), anti-rejeu 300 s, HMAC-SHA256 sur `timestamp.corps`, comparaison en temps constant, devise XOF, `userId` UUID valide, application via `velaris_apply_payment` ; 500 en cas d'erreur pour que SasPay relivre (sans risque grâce à l'idempotence).
- **`velaris_apply_payment`** : insertion du grand livre `ON CONFLICT DO NOTHING` sur la référence unique, contrôle montant ↔ formule, **prolongation** d'un abonnement en cours (au lieu de l'écraser), crédits = montant / 85 arrondi à 2 décimales (même calcul que l'interface).
- **Retour de paiement** : le Profil vérifie le statut de la session puis relit le solde pendant que le webhook l'applique ; message clair si le paiement n'a pas abouti.
- **Lien universel montant libre** : conservé, mais signalé comme **non rattaché** à un compte (réconciliation manuelle) — SasPay ne transmet pas d'identifiant studio sur ce lien.
- **Résiliation** : SasPay encaisse des paiements ponctuels, il n'existe aucun prélèvement automatique à annuler. Le bouton devient « Ne pas renouveler » (préférence locale) et le texte ne promet plus une résiliation fictive.
- **Copilot** : 0,05 crédit via `velaris_consume_credits` (restreint au type `ai_prompt`, l'utilisateur ne peut débiter que lui-même).
- Le mode démo conserve une simulation locale explicitement étiquetée « démonstration ».

---

## 6. Base Supabase et protection des quotas (point 6)

### Constats
- `searchStudioData` (appelé jusqu'à 4 fois par question Copilot) téléchargeait **toutes** les lignes de `contacts`, `orders`, `conversations` puis filtrait en JavaScript : coût linéaire en taille de base, multiplié par le nombre de questions.
- `findConversationByPhone` téléchargeait tous les contacts.
- `getLiveConversations`, `getLiveOrders`, `getLiveAutomationRules` : aucune limite.
- `getLiveStudioMetrics` lançait les requêtes **même pour un visiteur** (résultat jeté ensuite) ; taux de conversion codé à 100 %.
- `useStudioLive` : rafales Realtime → plusieurs requêtes concurrentes identiques ; aucun ralentissement sur erreurs répétées (boucle de 20 s contre une base saturée).
- Politiques RLS `user_id = auth.uid()` sans sous-requête dans le script initial (corrigé partiellement par le pack du jalon 25) ; aucune politique d'écriture pour `wa_sessions`.

### Corrections
- Recherche **côté Postgres** (`ilike`, `or`), 20 résultats par table, caractères réservés PostgREST neutralisés ; recherche par numéro pré-filtrée sur les 4 derniers chiffres.
- Limites : 300 conversations, 500 commandes, 200 règles, 50 messages.
- Métriques : aucune requête pour un visiteur ; conversion réelle = commandes payées / discussions (comptage `head: true`, sans transfert de lignes).
- `useStudioLive` : une seule requête en vol (les événements reçus pendant ce temps sont fusionnés en un rechargement), espacement x2 par erreur jusqu'à 2 min, aucune requête onglet masqué, rechargement dérebondi au retour.
- Migration `supabase/migrations/20261002_billing_admin_hardening.sql` (idempotente) :
  - création automatique du profil à l'inscription (15 crédits de bienvenue tracés) + rattrapage des comptes existants ;
  - grand livre : référence unique, colonnes `kind`, `reason`, `balance_after`, écritures directes révoquées pour `anon`/`authenticated` ;
  - fonctions atomiques `velaris_consume_credits[_for]`, `velaris_refund_credits`, `velaris_apply_payment` (`SECURITY DEFINER`, `search_path` fixé, exécution révoquée pour le public) ;
  - table `song_generations` (RLS lecture propriétaire) ;
  - index composites `(user_id, last_message_at)`, `(conversation_id, created_at)`, `(user_id, created_at)` ;
  - politiques `automation_rules` et `wa_sessions` en `(SELECT auth.uid())`, écriture `wa_sessions` limitée au nom de session du studio ;
  - RPC de direction (`velaris_admin_kpis`, `velaris_admin_studios`, `velaris_admin_transactions`) refusant tout non-administrateur.

**Point d'attention** : `profiles` n'a volontairement **aucune** politique `UPDATE`. N'en ajoutez pas une large (`id = auth.uid()`) : l'utilisateur pourrait alors modifier son propre solde ou `is_admin`. Pour éditer le nom du studio, le Studio utilise déjà `auth.updateUser` (métadonnées).

---

## 7. Console de direction (point 7)

`src/components/AdminConsoleView.tsx` (réécrit), `src/hooks/useAdmin.ts`, `supabase/functions/admin-health/`

- **Accès** : `profiles.is_admin` via la RPC `velaris_is_admin` (ou `VITE_ADMIN_EMAILS` en complément). Un studio sans droit voit un écran « réservé à la direction ». Tant qu'aucun administrateur n'est configuré, la console reste ouverte **avec une alerte** explicite (pour ne pas vous verrouiller dehors avant la migration).
- **Indicateurs de direction** (bande de 4 tuiles monospace) :
  - **MRR** = abonnés mensuels × 3 000 + abonnés trimestriels × 7 000 / 3 ;
  - **encaissé SasPay cumulé** et sur 30 jours ;
  - **crédits vendus / consommés**, crédits en circulation et passif correspondant (× 85 F) ;
  - **conversion brief → chanson** (chansons produites / discussions).
- **Économie** : répartition des abonnements, cycle des crédits (consommés / disponibles, offerts, remboursés), entonnoir en 4 étapes (briefs → payés → produits → livrés).
- **Télémétrie** des 4 sous-systèmes, sondage toutes les 30 s, histogramme de latence 24 points, étiquette **Serveur** (sonde `admin-health` avec les vraies clés : WAHA `/ping` + sessions, Kie.ai solde de crédits, SasPay authentifié, présence du secret webhook) ou **Navigateur** (repli public sans clé si la fonction n'est pas déployée).
- **Gestion des studios** : table recherchable (email, nom, identifiant), pass et échéance, crédits, chansons, état de la ligne WhatsApp.
- **Audit des transactions** : 200 dernières écritures du grand livre, filtres Entrées / Débits, **export CSV** (séparateur `;`, BOM UTF-8 pour Excel).
- **Posture de sécurité** (6 contrôles réels) et **journal des événements et erreurs** filtrable.
- Design : graphite `#0B0C10`, micro-bordures `white/[0.08]`, chiffres tabulaires, boutons pilule blancs, aucune couleur décorative, aucun emoji.

---

## 8. Fichiers modifiés et créés

| Fichier | Nature |
|---|---|
| `supabase/migrations/20261002_billing_admin_hardening.sql` | nouveau |
| `supabase/functions/_shared/http.ts` | nouveau |
| `supabase/functions/saspay-webhook/index.ts` | réécrit |
| `supabase/functions/saspay-checkout/index.ts` | nouveau |
| `supabase/functions/kie-generate/index.ts` | nouveau |
| `supabase/functions/waha-proxy/index.ts` | nouveau |
| `supabase/functions/admin-health/index.ts` | nouveau |
| `src/services/waha.ts`, `saspay.ts`, `billing.ts`, `kie.ts`, `songAutomation.ts` | réécrits |
| `src/services/copilot.ts`, `supabase.ts` | corrigés |
| `src/hooks/useWaha.ts`, `useStudioLive.ts` | réécrits |
| `src/hooks/useAdmin.ts`, `src/data/reactionTriggers.ts` | nouveaux |
| `src/components/AdminConsoleView.tsx`, `QrConnectModal.tsx`, `WhatsAppLinesView.tsx` | réécrits |
| `src/components/AutomationsView.tsx`, `StudioCopilotView.tsx`, `StudioProfileView.tsx`, `App.tsx` | corrigés |
| `src/types/billing.ts`, `src/index.css`, 17 composants (palette) | ajustés |

---

## 9. Étude technique — un agent IA autonome sur WhatsApp pour chaque utilisateur (point 8)

> *« Est-ce techniquement possible que chaque utilisateur ait son propre agent IA qui répond directement à ses clients sur WhatsApp — répondre aux questions, savoir quand s'arrêter, passer la main à l'humain, connaître toutes les règles sans s'embrouiller ? Pourquoi les tentatives précédentes basées sur une accumulation de règles ont échoué, et quelle architecture faut-il ? »*

### 9.1 Réponse courte

**Oui, c'est faisable, et à un coût raisonnable** — à une condition : arrêter de demander au modèle de langage de *retenir et d'appliquer* les règles. Le modèle doit **comprendre et rédiger** ; le **code** doit **décider, vérifier et agir**. Toutes les règles qui comptent pour l'argent, la commande ou la confiance du client deviennent des états et des vérifications programmées, pas des phrases dans un prompt.

« Un agent par utilisateur » ne veut pas dire « un programme par utilisateur ». C'est **un seul moteur**, identique pour tous, paramétré par une **fiche studio** (catalogue, prix, ton, horaires, numéro de paiement, seuils de passation). 1 000 studios = 1 000 lignes de configuration, pas 1 000 agents à maintenir.

### 9.2 Pourquoi l'accumulation de règles a échoué

L'inventaire `velaris-agent/INVENTAIRE-REGLES.md` le montre chiffres à l'appui : **120 marqueurs de correctifs** dans trois fichiers de 2 500 à 6 000 lignes, une même règle écrite **jusqu'à 6 fois**, une règle remplacée mais jamais retirée, et le `ARCHITECTURE_BLUEPRINT.md` décrit « la guerre des 4 cerveaux concurrents ». Les causes de fond :

1. **Le prompt n'est pas un programme.** Plus on ajoute d'instructions, moins chacune est suivie : le modèle pondère, il n'exécute pas. Au-delà de quelques dizaines de règles, des règles se contredisent (« une seule question par tour » vs « confirmer l'orthographe du prénom ») et le modèle arbitre au hasard selon le contexte. C'est le « s'embrouiller ».
2. **L'état de la commande vivait dans le texte.** Pour savoir si le client avait payé, choisi sa formule ou validé ses paroles, le système relisait l'historique (regex, mots-clés). Un « ok » ambigu, une négation (« je n'ai pas encore payé »), un vocal mal transcrit, et l'état est faux. Les correctifs INTEL-5, INTEL-7, INTEL-8, B12 traitent tous ce symptôme.
3. **Correction par rustine locale.** Chaque bug corrigé à l'endroit où il est apparu → la même règle dans 6 fichiers → « corrigé ici, pas là ». Aucun test ne garantissait l'absence de régression.
4. **Plusieurs décideurs sur un même message.** Webhook, cron de relance, réponse IA et automatisation emoji pouvaient répondre au même client en parallèle : doubles réponses, bulles « zombies », pauses écrasées.
5. **Pas de frontière claire IA / humain.** La passation était décidée par des mots-clés et réversible par n'importe quel écho, d'où les pauses fantômes (PAUSE-3, PAUSE-4, TEMPS-2).
6. **Marqueurs techniques dans le texte** (`[HANDOFF_TEXT]`, `[NOTIFY_OWNER]`) : le modèle les recopiait parfois dans la réponse au client.

Conclusion : le problème n'est pas l'intelligence du modèle, c'est qu'on lui a confié des responsabilités qui relèvent du code (mémoire d'état, contrôle, exclusivité).

### 9.3 Architecture recommandée

```
WhatsApp ─▶ WAHA ─▶ [1] Réception idempotente ─▶ [2] File par conversation (verrou FIFO)
                                                        │
                                                        ▼
                         [3] Lecture de l'état de commande (Postgres, source de vérité)
                                                        │
                                                        ▼
                    [4] Compréhension : LLM en sortie STRUCTURÉE (JSON schéma strict)
                        { intention, champs extraits, confiance, sentiment, demande_humain }
                                                        │
                                                        ▼
                    [5] Machine à états (code) : transition autorisée ? actions permises ?
                                                        │
                         ┌──────────────────────────────┼─────────────────────────┐
                         ▼                              ▼                         ▼
               [6] Outils (code validé)      [7] Rédaction (LLM, ton du       [8] Passation humaine
               prix, paiement, prod.,            studio, faits fournis)           pause + alerte + reprise
               relance programmée                    │
                                                     ▼
                                    [9] Garde-fous de sortie (code) ─▶ envoi WAHA ─▶ journal
```

**[1] Réception idempotente.** Chaque événement WAHA est inséré avec une clé unique (`message_id`). Doublon = ignoré. Les échos de nos propres envois sont filtrés ici, une fois pour toutes.

**[2] Une conversation = une file, un seul traitement à la fois.** Verrou par conversation (`pg_advisory_xact_lock(hash(conversation_id))` ou file Redis/pg-boss). Les messages arrivés pendant le traitement sont **regroupés** dans le tour suivant (le client qui envoie 4 bulles d'affilée reçoit une réponse, pas quatre). Tous les producteurs de messages (IA, relance programmée, automatisation emoji, humain) passent par cette même file : il n'existe plus deux décideurs simultanés. *C'est ce qui supprime définitivement les doubles réponses.*

**[3] État de commande explicite en base.** Une table `orders` (une ligne par chanson) avec des colonnes typées, pas du texte :
`stage`, `formule`, `prix_convenu`, `destinataire`, `prenom_confirme`, `occasion`, `style`, `voix`, `souvenirs[]`, `paroles_validees`, `paiement_preuve`, `paiement_confirme_par`, `livre_at`, `pause_humaine_jusqua`. Le modèle **lit** cet état ; il ne le **déduit** jamais de l'historique.

**[4] Compréhension en sortie structurée.** Un appel LLM court dont la seule tâche est de classer et d'extraire, avec un schéma JSON strict (fonctionnalité native des API récentes) :
```json
{ "intent": "choose_offer | give_brief | ask_price | ask_delay | send_payment_proof | validate_lyrics | request_change | complaint | ask_human | smalltalk | other",
  "fields": { "formule": "3000", "destinataire": "Awa", "occasion": "anniversaire" },
  "negated": false, "confidence": 0.92, "sentiment": "neutral", "wants_human": false }
```
Une seule intention principale par tour, un score de confiance, la négation explicite. Pas de règles métier dans ce prompt.

**[5] Machine à états finie (FSM).** Le cœur, écrit en code, testé unitairement :

| État | Transitions autorisées | Actions permises |
|---|---|---|
| `accueil` | → `qualification` | présenter les formules |
| `qualification` | → `brief`, → `humain` | poser **une** question manquante |
| `brief` | → `paroles_a_valider` quand les champs obligatoires sont complets | demander un champ manquant, confirmer le prénom |
| `paroles_a_valider` | → `attente_paiement` sur validation explicite, → `brief` sur modification | envoyer les paroles, appliquer une correction |
| `attente_paiement` | → `paiement_a_verifier` sur preuve reçue | envoyer le numéro de paiement **seulement dans cet état** |
| `paiement_a_verifier` | → `production` sur confirmation (marchand ou SasPay) | accuser réception, jamais affirmer « paiement reçu » sans preuve |
| `production` | → `livre` | annoncer le délai |
| `livre` | → `apres_vente`, → `qualification` (nouvelle commande, jour différent) | remercier, proposer la vidéo |
| `humain` (pause) | → état précédent sur reprise explicite | aucune réponse IA, accusé unique |

Chaque règle de l'inventaire « B. Invariants métier » devient **une transition ou une précondition** : « coordonnées de paiement uniquement sur demande explicite » = l'outil `envoyer_paiement` n'existe pas hors de l'état `attente_paiement` ; « un merci après livraison ne relance pas de commande » = depuis `livre`, l'intention `smalltalk` ne mène à aucune transition. Une règle, un endroit, un test.

**[6] Outils (tool calling) validés par le code.** Le modèle peut *proposer* un appel d'outil, le code vérifie que l'état l'autorise et que les paramètres sont valides :
`get_catalogue()`, `quote_price(formule)` (prix lu en base, jamais généré), `save_brief_fields(...)`, `send_lyrics_for_validation(order_id)`, `send_payment_instructions(order_id)`, `register_payment_proof(order_id, media)`, `schedule_followup(order_id, delay)`, `request_human(reason)`. Les outils retournent des faits ; le modèle ne peut pas inventer un prix, un délai ou un statut.

**[7] Rédaction.** Un second appel LLM reçoit : la fiche studio (ton, nom, signature), l'état courant, les **faits** retournés par les outils, l'objectif du tour (« demander l'occasion »), et les 10 derniers messages. Consigne courte : « Rédige 1 à 2 bulles, une seule question, en t'appuyant uniquement sur les faits fournis. » C'est ici que l'IA apporte la chaleur et la souplesse.

**[8] Passation humaine (human-in-the-loop).** Déclencheurs **programmés**, pas suggérés :
- intention `ask_human` ou `complaint` ;
- confiance < 0,6 deux tours de suite, ou même question posée 3 fois ;
- 2ᵉ insistance sur une remise ;
- sujet hors catalogue (devis spécial, événement) ;
- sentiment négatif fort ;
- toute contestation de paiement.
Effet : `pause_humaine_jusqua` posé (expiration 2 h par défaut), **une** bulle d'accusé au client (« Je transmets à [prénom du gérant], il vous répond très vite »), alerte au gérant sur sa ligne avec résumé structuré + boutons « Je reprends » / « Rendre à l'IA ». Toute réponse manuelle du gérant prolonge la pause. Fin de pause **explicite** ou par expiration, jamais par un écho.

**[9] Garde-fous de sortie (code, après la rédaction).** Vérifications déterministes avant envoi :
- tout montant présent dans la bulle doit appartenir au catalogue du studio (sinon régénération puis passation) ;
- aucun crochet, marqueur ou JSON dans le texte ;
- pas de numéro de paiement hors état `attente_paiement` ;
- aucune affirmation d'état non prouvée en base (« paiement reçu », « chanson envoyée ») ;
- longueur maximale, une seule question ;
- anti-répétition : similarité avec les bulles des dernières 24 h.
Échec d'un garde-fou → une régénération, puis passation humaine. Jamais d'envoi « faute de mieux ».

### 9.4 « Savoir quand s'arrêter »

C'est le point le plus important pour la confiance des clients. Le système s'arrête par **construction** :
- l'IA ne parle que si l'état l'y autorise (pas en `humain`, pas en `production` hors question directe) ;
- une seule réponse par tour grâce au verrou ;
- budget de relances par commande (ex. 2 relances maximum, espacées de 24 h, jamais la nuit, annulées dès qu'un message client arrive) ;
- fermeture propre en `livre` : remerciement unique, puis silence jusqu'à une nouvelle intention commerciale ;
- respect immédiat de « stop », « laissez-moi », « je ne suis pas intéressé » (état `clos`).

### 9.5 Multi-tenant : un agent par studio

| Élément | Partagé (moteur) | Propre à chaque studio |
|---|---|---|
| Code, FSM, garde-fous, outils | oui | — |
| Catalogue, prix, délais, moyens de paiement | — | table `studio_catalogue` |
| Ton, prénom du gérant, signature, langue (français, dioula, mooré pour les tournures courantes) | — | `studio_persona` |
| Horaires de réponse, seuils de passation, nombre de relances | valeurs par défaut | surcharge possible |
| Session WhatsApp | — | `studio_<id>` (déjà en place) |
| Données clients | — | isolées par RLS `user_id` (déjà en place) |

Le gérant configure son agent depuis le Studio par un formulaire (pas par un prompt libre) : ce qu'il ne peut pas casser, il ne le cassera pas.

### 9.6 Coûts et faisabilité

- **Coût IA** : 2 appels par tour client (compréhension courte + rédaction). Avec un modèle rapide de la famille récente (ex. Claude Haiku 4.5) et la mise en cache du préfixe système, l'ordre de grandeur est de **quelques francs CFA par tour**, soit typiquement 50 à 150 F CFA pour une conversation complète jusqu'à la livraison. À rapprocher d'une vente à 1 200 – 5 000 F. Mesurer sur 100 conversations réelles avant de figer le prix du micro-crédit.
- **Latence** : 2 à 5 s par tour, compatible avec WhatsApp (un humain met plus longtemps), à condition de regrouper les rafales (étape 2).
- **Charge** : le moteur est sans état en mémoire (tout est en base) ; il se met à l'échelle horizontalement. Le vrai plafond est WAHA : une instance tient confortablement quelques dizaines de sessions ; au-delà, plusieurs instances derrière le proxy (le nom de session détermine l'instance).
- **Risque WhatsApp** : un numéro qui envoie trop vite ou à des inconnus peut être banni. L'agent ne fait que **répondre** à des clients qui écrivent en premier, avec la régulation déjà ajoutée côté envoi ; ne jamais l'utiliser pour de la prospection à froid.

### 9.7 Garantir qu'il ne régresse pas

1. **Jeu de conversations de référence** (50 puis 200) tirées des vraies discussions anonymisées, chacune avec le résultat attendu (état final, outils appelés, interdits). Rejouées automatiquement à chaque modification du moteur ou du prompt.
2. **Tests unitaires de la FSM** : chaque invariant de l'inventaire = un test.
3. **Journal par tour** : intention, confiance, transition, outils, garde-fous déclenchés, texte envoyé. Tableau de bord des passations humaines et de leur cause : c'est la boussole des améliorations.
4. **Mode ombre** au démarrage : l'agent propose, le gérant valide en un clic ; on passe en autonomie par étape (accueil et qualification d'abord, paiement et production en dernier) — ce qui correspond au « niveau 2 recommandé » déjà proposé dans l'inventaire.

### 9.8 Plan de mise en œuvre

| Phase | Durée indicative | Contenu | Critère de sortie |
|---|---|---|---|
| 1 | 1 semaine | Réception idempotente + file/verrou par conversation + journal | Zéro double réponse sur 1 semaine de trafic |
| 2 | 1 à 2 semaines | Table d'état `orders`, FSM, tests des 31 invariants | Tous les tests verts, rejeu des conversations de référence |
| 3 | 1 semaine | Compréhension structurée + outils + garde-fous de sortie, en **mode ombre** | ≥ 90 % des propositions validées sans retouche |
| 4 | 1 semaine | Passation humaine complète (pause, alerte, reprise) | Aucune réponse IA pendant une pause |
| 5 | continu | Autonomie progressive par état, puis ouverture aux studios avec fiche de configuration | Taux de passation stable, aucun incident de paiement |

**En résumé** : la fiabilité ne viendra pas d'un prompt plus long, mais d'une séparation stricte — le modèle **comprend et rédige**, la machine à états **décide**, les outils **agissent**, les garde-fous **vérifient**, et l'humain **reprend la main** sur des déclencheurs définis. C'est l'architecture qui permet de donner à chaque studio son propre vendeur WhatsApp sans qu'il ne s'embrouille.

---

## 10. Mise en production — actions requises de votre côté

Je n'ai rien déployé (pas d'accès au projet Supabase ni au VPS depuis cette session, et ce sont des actions à valider par vous).

1. **Révoquer et régénérer les clés exposées** (elles sont dans l'historique Git public) : clé SasPay live, clé Kie.ai, clé WAHA. Prioritaire même si rien d'autre n'est fait.
2. **Appliquer la migration** : SQL Editor Supabase → `supabase/migrations/20261002_billing_admin_hardening.sql`.
3. **Désigner l'administrateur** : `update public.profiles set is_admin = true where email = 'votre-email';`
4. **Secrets des Edge Functions** : `supabase secrets set SASPAY_API_KEY=… SASPAY_WEBHOOK_SECRET=… KIE_API_KEY=… WAHA_API_KEY=… WAHA_BASE_URL=https://waha.velarisagent.life VELARIS_ALLOWED_ORIGIN=https://anicetjr20045-commits.github.io`
5. **Déployer** : `supabase functions deploy saspay-webhook --no-verify-jwt` (appelé par SasPay, sans JWT) puis `supabase functions deploy saspay-checkout kie-generate waha-proxy admin-health`.
6. **SasPay** : vérifier que l'URL webhook enregistrée pointe vers l'Edge Function et que le secret est le même que `SASPAY_WEBHOOK_SECRET`. Vérifier aussi le format exact de l'en-tête de signature : le code accepte une signature hexadécimale, avec ou sans préfixe `sha256=`.
7. **Recette** dans cet ordre : inscription (profil + 15 crédits) → QR et connexion de sa ligne → envoi d'un message → recharge de 200 F → crédit visible après retour → production d'une chanson → livraison → console admin.
8. **Transition** : si vous devez garder l'ancien fonctionnement WAHA quelques jours, définir `VITE_WAHA_API_KEY` au build active le mode direct (signalé en alerte dans la console).

---

## 11. Validation

- `npx tsc -p tsconfig.app.json --noEmit` : **0 erreur**.
- `npm run build` (`tsc -b` + `vite build`) : **succès en 2,99 s, 0 erreur**. Seul avertissement : bundle JS de 925 kB (> 500 kB, préexistant ; découpage par `import()` recommandé).
- Non exécuté : tests navigateur, Edge Functions (Deno non installé ici), migration. ESLint/oxlint non lancés.
