# ARCHITECTURE DÉFINITIVE — AGENT DE VENTE WHATSAPP · VELARIS STUDIO OS

**Version 2** · 3 octobre 2026 · Claude Opus 5.5 (Claude Code)
**Statut :** spécification de référence, prête à coder. Aucune ligne de production n'a été modifiée pour produire ce document.

**Sources :**
- `DOSSIER_AGENT_IA_CLAUDE.md` (cycle de vente, autopsie de `velaris-agent`, mission) ;
- `DOSSIER_AGENT_ALEX_REALITE_TERRAIN.md` (Alex, les 5 cas réels, psychologie client) ;
- la question stratégique d'Anicet du 3 octobre (commandes parallèles, anciens et nouveaux clients, vocaux et textes personnalisables par gérant, vidéo souvenir, stabilité à toutes les couches) ;
- `RAPPORT_CLAUDE_OPUS.md` § 9 ;
- le code de `velaris-agent` (HEAD `6ca0fe2d`) : `webhook-handler.ts`, `pause-policy.ts`, `in-memory-debouncer.ts`, `echo-detect.ts`, `reaction-launch-song.server.ts`, `automations.server.ts`, routes `waha-webhook.ts` et `cron/drain.ts`, dernière version de `receptionist.server.ts` (historique Git, `3cd6fe7f^`), migrations Supabase ;
- côté `velaris` : `supabase_schema_init.sql`, `supabase_auth_multitenant.sql`, `supabase/migrations/20261002_billing_admin_hardening.sql`, `supabase/functions/waha-proxy/index.ts`.

**Ce qui change par rapport à la version 1 :**

| Changement | Pourquoi |
|---|---|
| Paiement = **seconde piste** indépendante du parcours créatif | Le client africain demande « le numéro de dépôt » à n'importe quel moment ; la v1 l'aurait laissé sans réponse hors de l'étape prévue (cas Fargo). |
| **Plusieurs commandes ouvertes** par conversation, résolution de la commande visée | Exigence d'Anicet (deux chansons en parallèle). |
| **Politique de sortie par étape** (texte IA, texte fixe, vocal du gérant, silence) | Exigence d'Anicet : certains gérants ne veulent aucun texte rédigé par l'IA. |
| « Brief complet » ne met plus l'agent en silence total : il **restreint** ce qu'il peut dire | Gel nocturne du cas Djalilou. |
| **Mode relais** sécurisé pendant une prise de main du gérant | Même cas : le gérant dort, le client veut payer. |
| **Lecture des messages du gérant** et réconciliation à la reprise | Amnésie des paroles déjà envoyées (cas Adeline). |
| Accueil émotionnel, interdiction des aveux d'incompréhension, honnêteté d'identité | Cas Fargo, cas 5, méfiance anti-arnaque. |
| Étapes vidéo souvenir | Étape 8 du métier. |
| Section **stabilité couche par couche** et **discipline anti-complexité** | Question d'Anicet : « incassable de bout en bout », sans retomber dans l'accumulation. |

---

## Sommaire

0. Réponse courte et décisions structurantes
1. Le métier, tel qu'il se vit sur WhatsApp
2. Réalité terrain : Alex et les cas réels
3. Audit de l'existant
4. Invariants non négociables
5. Topologie et stabilité couche par couche
6. Schéma de données (SQL prêt à appliquer)
7. Ingestion, regroupement des rafales, verrou par conversation
8. Modèle de commande : deux pistes, plusieurs commandes, vidéo
9. Compréhension
10. Résolution de la commande visée
11. Décision
12. Sortie : politiques d'étape, gabarits, vocaux, rédaction
13. Garde-fous de sortie
14. Passation, relais, délai de prise en charge, réconciliation
15. Lecture des messages du gérant
16. Temps, horaires, délais annoncés
17. Relances
18. Réactions du gérant
19. Configuration studio et préréglages
20. Tests, scénarios de référence, non-régression
21. Discipline anti-complexité
22. Arborescence de code
23. Plan de construction
24. Décisions à trancher par Anicet
25. Risques résiduels
26. Analyse lucide

---

## 0. Réponse courte et décisions structurantes

**Le principe :** un système où chaque responsabilité a **un seul propriétaire**, et où toute règle métier est **une donnée** (une ligne de table) avec **un test**, jamais une phrase de prompt ni une regex.

| Responsabilité | Propriétaire unique | Ce qu'il n'a pas le droit de faire |
|---|---|---|
| Recevoir WhatsApp sans perte ni doublon | Ingestion + `inbound_events` (Postgres) | Décider quoi que ce soit |
| Une seule réponse à la fois, rafales regroupées | File de tours + bail de verrou (Postgres) | Rien d'autre |
| Comprendre ce que dit le client | Modèle de langage, sortie JSON stricte avec citation | Décider, agir, écrire au client |
| Savoir où en est chaque commande | Colonnes typées de `orders`, deux pistes | Être déduit du texte |
| Décider quoi faire | Fonction pure `decide()` + tables de transitions | Appeler le réseau |
| Agir (prix, paiement, production) | Outils du moteur, idempotents | Être appelés par le modèle |
| Choisir **comment** parler | Politique d'étape du studio (texte IA, texte fixe, vocal, silence) | Changer ce qui est dit |
| Rédiger les bulles conversationnelles | Modèle de langage, sur faits fournis | Citer un montant, un numéro, un statut non fourni |
| Vérifier avant envoi | Garde-fous déterministes | Laisser partir un texte « faute de mieux » |
| Reprendre la main | Le gérant, par geste explicite | — |

**Décisions structurantes :**
1. Le modèle **comprend** et **rédige** ; le code **décide** et **agit**. Le modèle n'a aucun accès aux outils.
2. L'état vit en base : deux pistes par commande (création, paiement), plusieurs commandes possibles par client.
3. L'exclusivité est garantie par Postgres (bail avec jeton de clôture), pas par la mémoire d'un processus.
4. Toute sortie passe par une boîte d'envoi : nos échos ne sont plus jamais confondus avec le gérant.
5. **Ce qui est dit** (décision) est séparé de **comment c'est dit** (politique d'étape du studio) : un gérant peut exiger zéro texte généré, des vocaux à la place, ou le silence à une étape, sans toucher au moteur.
6. Les messages qui engagent (paiement, passation, arrêt, livraison) sont des **gabarits** ; seules les bulles conversationnelles sont générées.
7. Le moteur tourne sur le VPS, à côté de WAHA, et remplace `waha-bridge`. Postgres Supabase est l'unique source de vérité ; un VPS neuf peut reprendre le travail sans perte.
8. Chaque couche a un mode dégradé défini (§ 5). Le système ne « plante » pas : il se tait, prévient le gérant, et rattrape.

---

## 1. Le métier, tel qu'il se vit sur WhatsApp

### 1.1 Les 8 étapes d'Anicet et leur traduction

| # | Étape métier | Piste | États du système | Sortie par défaut |
|---|---|---|---|---|
| 1 | Prise de contact et découverte | Conversation | accueil (aucune commande), puis `collecting_brief` | texte IA |
| 2 | Présentation des offres | Conversation | faits lus dans `studio_catalogues` | gabarit ou vocal du gérant |
| 3 | Explication de la procédure | Création | `brief_complete` → `lyrics_in_progress` | vocal du gérant, **seul** |
| 4 | Recueil du brief et livraison du texte | Création | `collecting_brief` → `lyrics_in_progress` → `lyrics_sent` | texte IA (questions), paroles du gérant ou brouillon IA approuvé, **seules** |
| 5 | Validation des paroles | Création | `lyrics_sent` → `lyrics_validated` | texte IA |
| 6 | Paiement Mobile Money | **Paiement** (indépendante) | `unpaid` → `instructions_sent` → `claimed` → `confirmed` | gabarit uniquement |
| 7 | Réalisation (Kie.ai / Suno) | Création | `lyrics_validated` + `confirmed` → `in_production` | gabarit |
| 8 | Livraison audio, puis vidéo souvenir | Création | `delivered` ou `audio_delivered` → `video_in_progress` → `delivered` | gabarit + fichier |

### 1.2 Ce que le terrain impose à l'architecture

| Réalité du terrain | Conséquence de conception |
|---|---|
| Le client écrit en rafales de 2 à 4 bulles | Tampon de regroupement en base (§ 7.3), réponse unique |
| Il demande le numéro de dépôt quand il veut, parfois avant d'avoir vu les paroles | Piste paiement indépendante (§ 8), répondue à toute étape dès qu'un prix est fixé |
| Les kiosques Orange Money / Wave ferment la nuit | Report de paiement compris, relance programmée à l'ouverture, jamais en boucle (§ 11, § 17) |
| La méfiance envers les arnaques est maximale | Paiement après validation des paroles par défaut, nom du titulaire du compte affiché, exemples audio disponibles, aucune pression (§ 11.5, G15) |
| Le brief est souvent une confidence douloureuse (deuil, maladie, excuses) | Accueil émotionnel obligatoire, aucune question administrative dans ce tour (I29, G14) |
| Langue orale, fautes, nouchi, phrases sans verbe | Compréhension par modèle sur corpus réel ; **aucune** regex dans la décision (I22, § 21) |
| Clients anciens et nouveaux, plusieurs chansons à la fois | Faits client calculés en base (§ 6.9), plusieurs commandes ouvertes (§ 10) |
| Le gérant dort, voyage, vend en parallèle | Mode relais, délai de prise en charge, annonces de délai honnêtes (§ 14, § 16) |
| Chaque gérant a sa façon de vendre | Politiques d'étape, gabarits, vocaux, catalogue par studio (§ 12, § 19) |

---

## 2. Réalité terrain : Alex et les cas réels

### 2.1 Qui était Alex, et ce que cela implique

Alex n'était pas un bot de support : c'était **l'avatar commercial** du fondateur, vendant en direct à des clients du Burkina Faso, de Côte d'Ivoire, du Sénégal et du Mali, venus de publicités TikTok et Facebook. Trois implications d'architecture en découlent :

1. **Chaque erreur coûte une vente et une réputation**, pas un ticket de support. Le système doit préférer le silence signalé au gérant plutôt qu'une phrase fausse (I17).
2. **Le client ne doit jamais sentir la machine.** Ça ne veut pas dire mentir : ça veut dire ne jamais être robotique. Pas d'aveu d'incompréhension, pas de question dont la réponse est en base, pas de répétition en boucle, pas de question administrative face à une confidence.
3. **Velaris multiplie Alex par le nombre de studios.** Une faille qui coûtait une vente à Anicet coûtera mille ventes à mille gérants. D'où des préréglages prudents par défaut et un mode ombre obligatoire avant l'autonomie.

**Sur l'« illusion humaine » (position recommandée, décision 12) :** l'agent porte le prénom choisi par le gérant et parle comme un membre du studio. En revanche, il **n'affirme jamais être humain** et ne le nie pas quand un client le demande sincèrement. Il répond par un gabarit du type « Je suis Alex, l'assistant du studio d'Anicet ; c'est Anicet qui supervise chaque chanson ». Raison commerciale autant qu'éthique : dans un marché où la peur de l'arnaque domine, un mensonge découvert détruit la confiance, et une capture d'écran circule vite.

### 2.2 Les cas réels : cause racine et mécanisme correctif

Les faits ci-dessous viennent du dossier terrain ; je ne les ai pas revérifiés dans les journaux. Les numéros des clients ne sont volontairement pas repris ici.

#### Cas 1 — Djalilou, chanson pour Fadila (Burkina Faso)

| Symptôme | Cause racine dans l'ancien système | Mécanisme correctif (v2) | Test |
|---|---|---|---|
| « Mais dépôt là si c'est demain je ne peux pas vous faire ça la nuit » → bulle d'attente répétée toutes les 37 s | Une règle `client_defers` déclenchée sur le mot « demain », rejouée par un cron | Signal `payment_deferral` (raison : kiosque fermé, moment : demain) compris par le modèle ; **une** réponse d'accord, relance programmée à l'ouverture des kiosques ; une même attente ne produit qu'une réponse par étape (I26) ; disjoncteur de débit (I31) ; les tours ne naissent que d'un message client, d'une relance planifiée ou d'un geste du gérant (§ 7) | GS-01 |
| « D'accord pas de soucis j'attends alors » → brief effacé, « Je vous écoute, dites-m'en plus » | Regex `\battends\b` → `clientChangedMind = true` → effacement | Intention `patient_wait` ; **aucune décision destructive par inférence** (I20) : un champ du brief ne s'efface que par une nouvelle valeur explicite avec citation, par un « non » à une question de confirmation, ou par le gérant | GS-02 |
| « Le dépôt c'est sur quelle numéro ? » → coordonnées censurées | Regex `quel numéro` ; filtre anti-paiement prématuré | Intention `ask_payment_method` comprise par le modèle quelle que soit l'orthographe ; piste paiement disponible **à toute étape** dès qu'un prix est fixé (I21) ; les coordonnées ne viennent **que** du gabarit (G3), donc rien à censurer dans un texte généré | GS-03 |
| Gel de 8 h 35 : pause « le gérant écrit le texte » posée à minuit, vente sauvée à la main le matin | Pause dure sans notion d'horaires ni de délai de prise en charge | Brief complet = **restriction** du discours, pas silence (§ 11.4) ; mode relais pendant une prise de main (§ 14.4) : coordonnées de paiement, accusé de preuve, délai honnête, uniquement par gabarit ; alerte au gérant avec relance si non traitée (§ 14.3) ; délai annoncé calculé sur les horaires réels du gérant (I27) | GS-04 |
| « Vraiment je ne sais même pas ce que je vais dire » | Le client a été perdu par l'effacement | Intention `needs_guidance` → objectif `guide_brief` : une seule question simple et concrète (« Dites-moi juste une qualité de Fadila qui vous touche ») | GS-05 |

#### Cas 2 — Sylvie, chanson pour son fils Stevens (Côte d'Ivoire)

| Symptôme | Cause racine | Mécanisme correctif | Test |
|---|---|---|---|
| Récit de vie (4 lignes ou plus, 160 caractères ou plus) pris pour des paroles fournies par la cliente | `looksLikeLyricsBubble` = longueur et nombre de lignes | Un texte du client n'est **jamais** classé « paroles » sans déclaration explicite (« voici mes paroles », intention `provides_own_lyrics` avec citation) (I30). Le récit alimente `orders.memories`, matière première des paroles. **Aucune** heuristique de longueur nulle part, y compris côté gérant (correction de la v1, § 18.1) | GS-06 |
| Prospect venu d'une publicité 2 mois plus tôt, traité en « cliente existante », vocal de procédure refusé | « Ancien client » déduit de la date de création du contact | « Ancien client » = au moins une commande **livrée** ; « a déjà reçu le vocal » = un envoi `procedure_voice` réussi dans la boîte d'envoi pour ce contact. Ce sont des **faits** calculés (§ 6.9), jamais des dates (I23, I24) | GS-07 |

#### Cas 3 — Fargo, chanson pour Sanfo (Burkina Faso)

| Symptôme | Cause racine | Mécanisme correctif | Test |
|---|---|---|---|
| Confidence de 530 caractères sur sa santé, ses enfants, sa prière → « Avez-vous déjà commandé une chanson chez nous ? » | Un filet de qualification automatique, insensible au contexte | `emotional_weight = high` → objectif `acknowledge_story` en priorité (I29) : accueil chaleureux qui reprend un élément concret du récit, puis au plus la question créative manquante la plus naturelle ; **interdiction** de toute question dont la réponse est en base (I24, G18) et de toute question administrative dans ce tour (G14) ; cohérence de ton (G12) | GS-08 |
| « Le numéro de dépôt » (sans verbe) → coordonnées détruites | Filtre de paiement fondé sur la syntaxe | Comme au cas 1 : compréhension par le modèle, piste paiement indépendante, gabarit seul porteur des numéros | GS-09 |

#### Cas 4 — Adeline, chanson pour Rita (Côte d'Ivoire)

| Symptôme | Cause racine | Mécanisme correctif | Test |
|---|---|---|---|
| Message à 23 h 51 UTC, 9 minutes plus tard la date change → traitée en ancienne cliente | Comparaison calendaire `slice(0, 10)` | **Interdiction** de toute comparaison de dates calendaires dans le moteur (règle de lint, § 21) ; le « cycle de commande » est une ligne de `orders`, pas une journée ; les horaires sont calculés dans le fuseau du studio (I23) | GS-10 |
| « Non pas encore » → revirement négatif décrété | Le filtre attrape « non pas » | Un « non » n'est interprété **que** relativement à la question en attente (`pending_question`) et n'agit que sur le champ concerné (I20, § 9.3) | GS-11 |
| Paroles écrites dans la discussion non reconnues ; l'agent promet « votre texte vous sera envoyé » alors qu'il est sous les yeux de la cliente | L'état « paroles envoyées » n'existait que via une table de cron | **Lecture des messages du gérant** (§ 15) : un message classé `lyrics` fait passer la commande en `lyrics_sent` ; réconciliation à la reprise (§ 14.6) ; garde-fou de cohérence des promesses (G17) | GS-12 |

#### Cas 5 — Les aveux d'impuissance robotiques

| Symptôme | Cause racine | Mécanisme correctif | Test |
|---|---|---|---|
| « Kpata là voyons voir le son », « c'est propre », « enjaillement » → « Je n'ai pas bien compris, pouvez-vous reformuler ? » | Absence de stratégie face à l'incertitude ; réponse par défaut d'incompréhension | Phrases d'aveu **interdites** (G13, I22) ; confiance faible → **pas en avant** propre à l'étape (§ 11.6), puis passation discrète au second échec ; lexique ouest-africain dans le corpus d'évaluation (§ 9.5) ; « voyons voir le son » → `ask_sample` → envoi d'un exemple audio du studio | GS-13, GS-14 |

### 2.3 Ce que la version 1 aurait fait (autocritique)

| Situation | Comportement de la v1 | Verdict |
|---|---|---|
| « Le numéro de dépôt » pendant le brief | Combinaison absente de la matrice → silence + journal `unmapped` | **Échec** : reproduit le cas Fargo |
| Brief complet à 23 h, gérant endormi | Niveau 1 : passation `brief_completed` + verrou dur jusqu'au réveil | **Échec** : reproduit le gel du cas Djalilou |
| Paroles tapées par le gérant sur son téléphone, puis `✨` | La commande reste en `lyrics_in_progress` (seuls le Studio et `🎵` enregistraient les paroles) | **Échec** : reproduit l'amnésie du cas Adeline |
| Réaction `🎵` sur un message du gérant | Message de 80 caractères ou plus considéré comme des paroles | **Faute de méthode** : heuristique de longueur, de la même famille que le cas Sylvie |
| Confiance faible à l'accueil | Passation avec « je transmets à… » | Acceptable mais coûteux sur trafic froid : remplacé par le pas en avant |
| Sylvie (prospect dormant), Adeline (minuit UTC) | Faits en base, aucune logique calendaire | Correct, mais non garanti par une règle : désormais garanti par lint et tests |
| « Bien reçu », « J'attends alors » | Compris par le modèle, vérifié par le code | Correct pour le paiement ; « j'attends » sans réponse définie → désormais explicite |

Ces cinq corrections justifient à elles seules la version 2. Elles ont un point commun : la v1 couplait encore des choses que le terrain découple (paiement et paroles, silence et inaction, qui écrit et qui sait).

### 2.4 Lexique de référence (extrait du corpus obligatoire)

Chaque ligne est un cas du jeu d'évaluation (§ 20.3) **et** un exemple du prompt de compréhension. Aucune n'est une regex.

| Expression du client | Contexte | Intention attendue | Comportement attendu |
|---|---|---|---|
| « Le numéro de dépôt » | prix fixé | `ask_payment_method` | gabarit de paiement |
| « Le dépôt c'est sur quelle numéro ? » | prix fixé | `ask_payment_method` | gabarit de paiement |
| « C'est sur quel numéro je dépose ? », « OM ou Wave ? » | prix fixé | `ask_payment_method` | gabarit de paiement |
| « Le numéro de dépôt » | aucune formule choisie, une seule offre active | `ask_payment_method` | formule fixée automatiquement, puis gabarit |
| « Le numéro de dépôt » | aucune formule, plusieurs offres | `ask_payment_method` | une question : la formule, puis gabarit |
| « Mais dépôt là si c'est demain je ne peux pas vous faire ça la nuit » | instructions envoyées | `payment_deferral` (kiosque fermé, demain) | une réponse d'accord, relance à l'ouverture |
| « D'accord pas de soucis j'attends alors » | paroles en cours | `patient_wait` | délai honnête une fois, sinon silence |
| « Bien reçu » | après un vocal | `acknowledgement` | jamais un paiement ; délai une fois si non donné |
| « C'est validé », « c'est bon », « ça me va » | paroles envoyées | `validate_lyrics` | validation |
| « C'est propre », « c'est doux » | paroles envoyées | `positive_feedback` | validation si confiance ≥ 0,8, sinon « On garde ce texte tel quel ? » |
| « Non pas encore » | question : « avez-vous fait le dépôt ? » | `confirm_no` | aucun changement d'état |
| « Kpata là voyons voir le son » | accueil | `ask_sample` | exemple audio du studio |
| « Enjaillement », « on va s'enjailler » | brief | `give_brief_info` (style festif) | `style` avec citation |
| « Vraiment je ne sais même pas ce que je vais dire » | brief | `needs_guidance` | une question simple et concrète |
| « C'est pas arnaque ça ? », « comment je sais que c'est vrai » | toute étape | `trust_concern` | réassurance factuelle, aucune pression |
| « Vous êtes un robot ? » | toute étape | `asks_if_bot` | gabarit d'identité honnête |
| Récit de vie de 500 caractères | brief | `shares_story`, `emotional_weight = high` | accueil émotionnel, souvenirs enregistrés |
| « Voici les paroles que j'ai écrites : … » | brief | `provides_own_lyrics` | texte client enregistré, gérant alerté |
| « Je veux aussi une pour ma mère » | une commande en cours | `order_song` (nouvelle) | seconde commande ouverte |

---

## 3. Audit de l'existant

### 3.1 État réel de `velaris-agent`

- `src/lib/receptionist/receptionist.server.ts` (Sarah) a été **supprimé** le 26/09/2026 à 13:42 UTC par le commit Lovable `3cd6fe7f` (« Changes »), avec `agent.functions.ts` (−5 573 lignes).
- Le `webhook-handler.ts` actuel (892 lignes) est un « Agent Silencieux » : il ne répond jamais au client.
- `velaris-agent/ACTIVE_STATE.md` (jalons 63 à 67) affirme le contraire.
- Leçon : un outil de synchronisation peut réécrire le cœur sans revue. Le nouveau moteur vit hors de ce périmètre (§ 22).

### 3.2 Sarah (dernière version)

| # | Défaut | Conséquence |
|---|---|---|
| S1 | Fin de brief signalée par le marqueur `[BRIEF_COMPLETE: …]` reconnu par regex | Variation → marqueur envoyé au client et brief jamais clos |
| S2 | Tarifs dans le prompt (1 200 F audio / 3 000 F vidéo) | Trois grilles contradictoires coexistent (dossier, prompt, automatisations) |
| S3 | Bulle texte avant le vocal | Le vocal ne part pas seul |
| S4 | Pause vérifiée au début du tour seulement, deux appels LLM jusqu'à 15 s chacun | Parle par-dessus le gérant |
| S5 | Message entrant injecté deux fois dans le prompt | Le modèle voit le client se répéter |
| S6 | Envoi enregistré sans identifiant WhatsApp | Écho pris pour le gérant → pause fantôme |
| S7 | Alerte gérant sans puce `•` | `looksLikeOwnerAlertEcho` ne la reconnaît pas |
| S8 | Commande à 1 200 F en dur, premier produit trouvé, erreurs avalées | Données de caisse fausses |
| S9 | Vocal « déjà envoyé » détecté par `ilike` sur un libellé | Fragile |
| S10 | « Velaris Studio » et emoji en dur | Non multi-tenant |
| S11 | Vouvoiement, une question, pas de numéro : consignes de prompt non vérifiées | Aucune garantie |

### 3.3 Ingestion et file

| # | Emplacement | Défaut |
|---|---|---|
| Q1 | `waha-webhook.ts` 165-198, `in-memory-debouncer.ts` | Le « mutex » est une `Map` en mémoire sur Cloudflare Workers : chaque isolat a la sienne, aucune exclusivité réelle |
| Q2 | `webhook-handler.ts` 669-698 | Réservation de file non atomique (lecture puis mise à jour sans condition) : webhook et cron peuvent traiter la même ligne |
| Q3 | `cron/drain.ts` 51-56 | Tout traitement de plus de 45 s est remis en file pendant qu'il tourne encore |
| Q4 | `webhook-handler.ts` 654-667 | `deadlineAt` ignoré |
| Q5 | `webhook-handler.ts` 816-891 | Index uniques présents en base, mais l'erreur d'insertion n'est pas lue : les automatisations `first_message` / `keyword` repartent sur un doublon |
| Q6 | `velaris/supabase/functions/waha-proxy/index.ts` 81 | Abonnement à `message` **et** `message.any` : chaque message client arrive deux fois |
| Q7 | `webhook-handler.ts` 836-857 | Téléchargement et transcription dans le chemin du webhook |
| Q8 | `webhook-handler.ts` 861 | Emoji `🎙️` préfixé aux transcriptions en base |

### 3.4 Gérant, échos, automatisations

| # | Emplacement | Défaut |
|---|---|---|
| E1 | `webhook-handler.ts` 458 | Réaction acceptée si `fromMe` est absent : un client pourrait déclencher `🎵` |
| E2 | `webhook-handler.ts` 430-437 + `automations.server.ts` | Identifiant court à l'envoi, long à l'écho : chaque envoi automatique est enregistré deux fois |
| E3 | `automations.server.ts` 85-91 | `send_media` non enregistré : son écho passe pour le gérant |
| E4 | `automations.server.ts` 132-166 | Budget horaire non atomique |
| E5 | `echo-detect.ts` | Détection d'écho par heuristiques de texte, faute d'*outbox* |

### 3.5 `pause-policy.ts`

Trois politiques contradictoires dans un seul fichier : expiration rapide (en-tête), aucune reprise sans geste du gérant (décision 3/5), reprise automatique au bout de 2 h (`isMerchantReplyPauseStale`). Deux drapeaux sur cinq n'existent que pour compenser l'absence d'*outbox* et de verrou.

### 3.6 `reaction-launch-song.server.ts`

- **À garder** : idempotence par message réagi, refus d'inventer style et voix, alerte précise au gérant.
- **Faiblesses** :
  - recherche du message réagi sans filtre `user_id` (l. 173-179) ;
  - style et voix déduits de 400 messages (versions V1 à V6 de rustines) ;
  - `🎵` lance la production sans enregistrer de paiement.

### 3.7 Base Velaris

- `messages` sans `wa_message_id` ni `metadata` dans les scripts versionnés.
- `waha-bridge` non versionné : le schéma réel est à relever en base.
- `orders.status` limité à 4 valeurs.
- `amount_cents = 120000` pour 1 200 F (le franc CFA n'a pas de centimes).
- Les politiques `USING (true)` du script initial doivent avoir été supprimées par `supabase_auth_multitenant.sql` : à vérifier.

### 3.8 Ce que l'on garde

`normalizeWaMessageId`, `waMessageIdKey`, vérification HMAC WAHA, `sameEmoji`, transcription avec repli, idempotence et alerte de `reaction-launch-song`, RPC de crédits, `song_generations`, `kie-generate`, `waha-proxy` et sessions protégées. Tout le reste est réécrit.

---

## 4. Invariants non négociables

Chaque invariant a un identifiant et au moins un test (§ 20).

**Exclusivité et intégrité**

| ID | Invariant | Garanti par |
|---|---|---|
| I1 | Au plus un tour actif par conversation, quel que soit le nombre de processus | `automation_locks`, `agent_claim_turn` |
| I2 | Un événement WhatsApp = une ligne en base | `inbound_events` + index uniques |
| I3 | Aucun envoi de l'agent si bail perdu, nouveau message client depuis le début du tour, ou contrôle non autorisé | `agent_begin_send` au moment de l'envoi |
| I4 | Un écho de nos envois n'est jamais pris pour le gérant | Rapprochement par la boîte d'envoi |
| I5 | Un message du gérant passe la conversation en mode `human` avant tout envoi suivant de l'agent | Ingestion `fromMe` → `agent_set_control` |
| I6 | Une prise de main du gérant ne se lève que par son geste explicite | `agent_set_control` |
| I7 | Aucune transition hors de `order_transitions` | FSM TypeScript et SQL |
| I8 | `payment_status = 'confirmed'` uniquement par `merchant` ou `saspay` | `allowed_actors` |
| I19 | Une seule instance de moteur parlante par session WhatsApp | `wa_sessions.engine_owner` |

**Contenu envoyé**

| ID | Invariant | Garanti par |
|---|---|---|
| I9 | Tout montant envoyé appartient au catalogue actif ou au prix figé d'une commande du client | G2 |
| I10 | Les coordonnées de paiement ne sortent que par le gabarit de paiement | G3 + outil unique |
| I11 | Aucun crochet, accolade, chevron, JSON, identifiant technique | G1 |
| I12 | Au plus une question et deux bulles par tour | G5, G6 |
| I13 | Le vocal de procédure part seul dans son tour | Planificateur |
| I25 | Les paroles partent seules, en un message | Planificateur |
| I14 | Aucune affirmation d'état non prouvée en base | G4 |
| I22 | Aucun aveu d'incompréhension ni formule robotique | G13 + pas en avant |
| I24 | On ne demande jamais au client ce que la base sait (ancien client, vocal déjà reçu, commande passée) | G18 + faits client |
| I29 | Face à une confidence à forte charge émotionnelle : accueil personnalisé d'abord, aucune question administrative | Décision P7 + G14 |
| I28 | L'agent n'affirme jamais être humain et ne nie pas être un assistant quand on le lui demande sincèrement | Gabarit `identity` + G13 |

**Comportement**

| ID | Invariant | Garanti par |
|---|---|---|
| I15 | Une passation produit au plus un accusé au client | `handoffs.ack_sent_at` |
| I16 | « Stop » → un message de clôture puis silence total | Décision P2 |
| I17 | Échec d'un garde-fou après une régénération → pas d'envoi, passation | Boucle de rédaction |
| I18 | Aucun envoi sur une session protégée ou non activée | Liste blanche |
| I20 | Aucune décision destructive par inférence : un champ du brief ne s'efface ou ne se remplace que par une valeur explicite avec citation, un « non » à une question de confirmation, ou le gérant | `agent_patch_order_fields` (`p_allow_clear`) |
| I21 | Une question de paiement ne reste jamais sans réponse, y compris pendant une prise de main (mode relais) | Décision P8, § 14.4 |
| I23 | Aucune comparaison de dates calendaires ; durées et lignes de commande seulement ; horaires dans le fuseau du studio | Lint + § 16 |
| I26 | Une même attente (« j'attends », report de paiement) produit au plus une réponse par étape et par commande | `conversations.ack_log` |
| I27 | Tout délai annoncé est calculé depuis la disponibilité réelle du gérant et du studio | § 16, G16 |
| I30 | Un texte du client n'est jamais classé « paroles » sans déclaration explicite | § 9.3 |
| I31 | Au plus N messages de l'agent par conversation et par heure (6 par défaut), sinon passation | `agent_begin_send` |
| I32 | Aucune heuristique de longueur, de mot-clé ou de date dans le chemin de décision | Lint (§ 21) |

---

## 5. Topologie et stabilité couche par couche

### 5.1 Schéma

```
                         VPS (Docker, réseau interne)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ WhatsApp ◀──▶ WAHA (studio_<id>)                                             │
 │                 │ webhooks HMAC : message.any, message.reaction,             │
 │                 │                 message.ack, session.status                │
 │                 ▼                                                            │
 │     ┌───────────────────────┐  insert idempotent    ┌──────────────────────┐ │
 │     │ engine-ingest (HTTP)  │ ────────────────────▶ │ Postgres Supabase    │ │
 │     │ 200 en moins de 300 ms│  (secours : spool     │ vérité + file +      │ │
 │     └───────────────────────┘   disque local)       │ verrous + journal    │ │
 │                 │ média, STT asynchrones            └──────────┬───────────┘ │
 │                 ▼                                              │             │
 │     ┌───────────────────────┐   agent_claim_turn (SKIP LOCKED) │             │
 │     │ engine-worker (x N)   │ ◀────────────────────────────────┘             │
 │     │ comprendre → résoudre │ ──▶ LLM (fournisseur principal / secours)      │
 │     │ → décider → agir      │                                                │
 │     │ → politique d'étape   │                                                │
 │     │ → garde-fous → outbox │ ──▶ WAHA sendText / sendVoice / sendFile       │
 │     └───────────────────────┘                                                │
 │     ┌───────────────────────┐                                                │
 │     │ engine-sweeper        │ baux expirés, relances, délais de prise en     │
 │     │                       │ charge, rattrapage WAHA, purges                │
 │     └───────────────────────┘                                                │
 └──────────────────────────────────────────────────────────────────────────────┘
        ▲ Realtime / RPC (JWT, RLS)                ▲ Edge Functions existantes
 Studio OS (React) : discussions, fiches de commande, mode ombre, réglages,
 reprise, confirmation de paiement
```

### 5.2 Pourquoi le VPS

| Critère | Cloudflare Workers / Edge Functions | Processus Node sur le VPS |
|---|---|---|
| Durée d'un tour (STT + 2 appels LLM + envoi) | Contrainte par la requête ; tâches coupées après la réponse | Aucune limite |
| Exclusivité | Impossible en mémoire | Assurée par Postgres |
| Latence vers WAHA | Internet | Réseau Docker interne |
| Existant | — | `waha-bridge` y écrit déjà dans la même base |

### 5.3 Stabilité : modes de défaillance et parades, couche par couche

« 100 % stable » ne veut pas dire « rien ne tombe jamais ». Ça veut dire que **chaque panne a un comportement défini, sans perte ni doublon, et que le client n'est jamais exposé à un comportement absurde.**

**Couche 1 — WhatsApp / WAHA**

| Défaillance | Parade |
|---|---|
| Session déconnectée (téléphone éteint, déconnexion) | `session.status` suivi ; relance auto `restart` sur `FAILED`, relance d'un `STARTING` bloqué plus de 90 s (déjà dans `waha-proxy`) ; alerte au gérant ; l'agent n'envoie rien tant que la session n'est pas `WORKING` (les envois restent `pending`, avec expiration) |
| Webhooks perdus pendant un arrêt du moteur | Nouvel essai WAHA configuré ; **rattrapage** au démarrage puis toutes les 10 min : lecture des derniers messages des discussions actives des 48 dernières heures et ingestion idempotente (même clé de déduplication) |
| Doublons (`message` + `message.any`, nouveaux essais) | `inbound_events` unique + abonnement ramené à `message.any` |
| Ordre d'arrivée inversé | Tri du tampon par horodatage WhatsApp, pas par heure de réception |
| Envoi accepté mais réponse perdue | Statut `unknown`, **jamais** de nouvel essai ; rapprochement par l'écho |
| Débit excessif, risque de bannissement | File par session (un envoi à la fois par discussion), rythme humain, disjoncteur I31, aucune prospection à froid |

**Couche 2 — VPS / moteur**

| Défaillance | Parade |
|---|---|
| Plantage d'un processus | Docker `restart: always` ; bail de 90 s ; le balayeur reprend le tour s'il n'a rien envoyé, sinon passation (§ 7.5) |
| Redéploiement | Arrêt propre : plus de nouvelle réservation, fin des tours en cours (60 s maximum), libération des baux |
| VPS perdu | Aucun état local hors spool ; un VPS neuf reprend depuis Postgres ; sauvegarde quotidienne du spool et de la configuration |
| Fuite mémoire, blocage | Limites mémoire Docker, sonde `/health` (boucle vivante + base joignable), alerte direction si le battement du moteur s'arrête 2 minutes |

**Couche 3 — Postgres / Supabase**

| Défaillance | Parade |
|---|---|
| Base injoignable | L'ingestion écrit dans un **spool disque** (JSONL en ajout seul, `fsync`) et répond 200 ; rejoué dans l'ordre au retour de la base. Les travailleurs se mettent en pause. Aucun envoi. |
| Saturation des connexions | Pool borné (10 par processus), `statement_timeout` 5 s sur les fonctions du moteur, opérations critiques en une requête |
| Croissance des tables | Purges bornées (événements traités 30 j, journaux de tours 180 j, tours terminés 30 j) |
| Migration risquée | Migrations idempotentes, en avant seulement, testées sur une branche, jamais modifiées après application |

**Couche 4 — Modèle de langage**

| Défaillance | Parade |
|---|---|
| Panne ou lenteur | Délai par appel (8 s compréhension, 12 s rédaction), un nouvel essai, puis fournisseur de secours |
| Les deux fournisseurs en panne | Le tour est retenu et retenté pendant 3 minutes, puis : à l'accueil, gabarit d'accueil ; ailleurs, silence et alerte au gérant. Les gabarits et les vocaux continuent de fonctionner. |
| Sortie invalide | Validation par schéma, un nouvel essai, puis `unclear` (pas en avant ou passation) |
| Changement de modèle | Versions figées ; tout changement passe par le jeu d'évaluation et les scénarios de référence |
| Coût | Plafond quotidien par studio ; au-delà, mode gabarits seuls et alerte |
| Injection dans un message client | Le texte client n'agit que via le schéma de compréhension ; la rédaction n'a ni outils ni données sensibles |

**Couche 5 — Décision**

| Défaillance | Parade |
|---|---|
| Bogue de logique | Fonction pure, tables de données, tests exhaustifs (produit cartésien), test de parité SQL/TypeScript |
| Situation non prévue | `none` + journal `unmapped` + alerte : le silence signalé plutôt que l'improvisation. **Exception** : les questions de paiement ont toujours une réponse (I21). |
| Régression | Scénarios de référence rejoués à chaque modification ; versions de politique enregistrées dans chaque journal de tour |
| Incident en production | Interrupteur global et par studio (`engine_flags`, `studio_personas.agent_enabled`) : retour immédiat en mode suivi seul |

### 5.4 Règle du locuteur unique (I19)

`wa_sessions.engine_owner IN ('none','velaris_engine','legacy_agent')`. Le moteur n'envoie rien sur une session qui ne lui appartient pas. Une bascule = changer **à la fois** l'URL de webhook WAHA et cette colonne, selon la procédure de l'étape 5.1 du plan.

### 5.5 Connexion à Postgres

Pooler en mode transaction (port 6543). Aucune fonctionnalité de session : c'est pourquoi le verrou est une table de bail et non un `pg_advisory_lock`. Toutes les opérations critiques sont des fonctions SQL appelées en une requête.

---

## 6. Schéma de données

Fichier cible : `supabase/migrations/20261004_agent_core.sql`. Idempotent. À appliquer d'abord sur une base de test, **après** le relevé du schéma réel (étape 0.3).

### 6.1 Studio : fiche, catalogue, politiques d'étape, gabarits, médias

```sql
-- ============================================================================
-- VELARIS — CŒUR DE L'AGENT WHATSAPP (20261004_agent_core.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.studio_personas (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_enabled         BOOLEAN NOT NULL DEFAULT FALSE,           -- interrupteur du studio
  studio_name           TEXT NOT NULL CHECK (char_length(studio_name) BETWEEN 2 AND 60),
  agent_name            TEXT NOT NULL DEFAULT 'Alex' CHECK (char_length(agent_name) BETWEEN 2 AND 30),
  manager_first_name    TEXT NOT NULL CHECK (char_length(manager_first_name) BETWEEN 2 AND 30),
  tone                  TEXT NOT NULL DEFAULT 'chaleureux' CHECK (tone IN ('chaleureux','sobre','enjoue')),
  formal_address        BOOLEAN NOT NULL DEFAULT TRUE,
  emoji_policy          TEXT NOT NULL DEFAULT 'none' CHECK (emoji_policy IN ('none','sparing')),
  timezone              TEXT NOT NULL DEFAULT 'Africa/Ouagadougou',
  agent_hours           JSONB NOT NULL DEFAULT '{"mon":["00:00","24:00"],"tue":["00:00","24:00"],"wed":["00:00","24:00"],"thu":["00:00","24:00"],"fri":["00:00","24:00"],"sat":["00:00","24:00"],"sun":["00:00","24:00"]}',
  manager_hours         JSONB NOT NULL DEFAULT '{"mon":["07:30","22:00"],"tue":["07:30","22:00"],"wed":["07:30","22:00"],"thu":["07:30","22:00"],"fri":["07:30","22:00"],"sat":["08:00","22:00"],"sun":["09:00","21:00"]}',
  followup_hours        JSONB NOT NULL DEFAULT '{"all":["08:00","20:30"]}',
  payment_window_hours  JSONB NOT NULL DEFAULT '{"all":["07:00","21:00"]}',  -- ouverture habituelle des kiosques
  alert_phone           TEXT CHECK (alert_phone ~ '^[0-9]{8,15}$'),
  agent_session_name    TEXT,
  -- Capacités (préréglages § 19.2)
  cap_reception         BOOLEAN NOT NULL DEFAULT FALSE,
  cap_procedure_voice   BOOLEAN NOT NULL DEFAULT FALSE,
  cap_lyrics_followup   BOOLEAN NOT NULL DEFAULT FALSE,
  cap_payment           BOOLEAN NOT NULL DEFAULT FALSE,
  cap_lyrics_draft      BOOLEAN NOT NULL DEFAULT FALSE,   -- brouillon IA toujours soumis au gérant
  cap_auto_production   BOOLEAN NOT NULL DEFAULT FALSE,
  cap_video             BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_mode         TEXT NOT NULL DEFAULT 'shadow' CHECK (delivery_mode IN ('shadow','live')),
  relay_mode            TEXT NOT NULL DEFAULT 'safe_templates' CHECK (relay_mode IN ('off','safe_templates')),
  -- Rythme et limites
  quiet_window_ms       INT NOT NULL DEFAULT 4000  CHECK (quiet_window_ms BETWEEN 1500 AND 15000),
  max_batch_wait_ms     INT NOT NULL DEFAULT 12000 CHECK (max_batch_wait_ms BETWEEN 3000 AND 30000),
  handoff_sla_minutes   SMALLINT NOT NULL DEFAULT 15 CHECK (handoff_sla_minutes BETWEEN 5 AND 240),
  max_agent_msgs_per_hour SMALLINT NOT NULL DEFAULT 6 CHECK (max_agent_msgs_per_hour BETWEEN 2 AND 20),
  max_open_orders       SMALLINT NOT NULL DEFAULT 3 CHECK (max_open_orders BETWEEN 1 AND 5),
  max_followups         SMALLINT NOT NULL DEFAULT 2 CHECK (max_followups BETWEEN 0 AND 3),
  followup_delay_hours  SMALLINT NOT NULL DEFAULT 24 CHECK (followup_delay_hours BETWEEN 6 AND 72),
  max_free_revisions    SMALLINT NOT NULL DEFAULT 2 CHECK (max_free_revisions BETWEEN 0 AND 5),
  agent_handoff_expiry_minutes INT CHECK (agent_handoff_expiry_minutes IS NULL OR agent_handoff_expiry_minutes BETWEEN 30 AND 2880),
  procedure_voice_validity_days INT CHECK (procedure_voice_validity_days IS NULL OR procedure_voice_validity_days BETWEEN 30 AND 3650),
  brief_field_order     TEXT[] NOT NULL DEFAULT ARRAY['occasion','recipient_name','offer'],
  lyrics_author         TEXT NOT NULL DEFAULT 'manager' CHECK (lyrics_author IN ('manager','ai_draft_approved')),
  payment_methods       JSONB NOT NULL DEFAULT '[]',   -- [{"provider":"orange_money","number":"…","holder":"…","country":"BF"}]
  reaction_commands     JSONB NOT NULL DEFAULT '{"🎵":"confirm_and_produce","✨":"resume_ai","📝":"mark_as_lyrics"}',
  daily_llm_budget_xof  INT NOT NULL DEFAULT 1500 CHECK (daily_llm_budget_xof BETWEEN 0 AND 100000),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.studio_catalogues (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code               TEXT NOT NULL CHECK (code ~ '^[a-z0-9_]{2,32}$'),
  label              TEXT NOT NULL CHECK (char_length(label) BETWEEN 2 AND 60),
  description        TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 280),
  price_xof          INT  NOT NULL CHECK (price_xof BETWEEN 100 AND 1000000),
  deliverable        TEXT NOT NULL CHECK (deliverable IN ('lyrics','audio','audio_video')),
  lyrics_lead_minutes     INT NOT NULL DEFAULT 8  CHECK (lyrics_lead_minutes BETWEEN 1 AND 2880),
  production_lead_minutes INT NOT NULL DEFAULT 18 CHECK (production_lead_minutes BETWEEN 1 AND 2880),
  video_lead_minutes      INT CHECK (video_lead_minutes IS NULL OR video_lead_minutes BETWEEN 10 AND 10080),
  payment_policy     TEXT NOT NULL DEFAULT 'after_lyrics_validation'
                     CHECK (payment_policy IN ('after_lyrics_validation','before_lyrics')),
  required_fields    TEXT[] NOT NULL DEFAULT ARRAY['occasion','recipient_name'],
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order         SMALLINT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code),
  CONSTRAINT chk_required_fields CHECK (required_fields <@ ARRAY[
    'occasion','recipient_name','recipient_relation','sender_name','style','voice','language','memories','photos'])
);
CREATE INDEX IF NOT EXISTS idx_catalogue_user_active ON public.studio_catalogues (user_id) WHERE is_active;

-- Comment parler à chaque étape : la personnalisation demandée par les gérants
CREATE TABLE IF NOT EXISTS public.studio_step_policies (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step        TEXT NOT NULL CHECK (step IN (
                'welcome','offers','procedure','brief_question','story_ack','lyrics_wait',
                'lyrics_delivery','lyrics_feedback','payment','payment_ack','payment_deferral',
                'production','delivery','video_photos','after_sales','trust','sample','identity',
                'handoff_ack','stop_ack')),
  channel     TEXT NOT NULL CHECK (channel IN ('ai_text','template','voice','voice_then_template','silent')),
  asset_id    UUID,         -- vocal du gérant si channel ∈ (voice, voice_then_template)
  template_key TEXT,        -- gabarit si channel ∈ (template, voice_then_template)
  PRIMARY KEY (user_id, step),
  -- Les coordonnées de paiement sont toujours écrites (un numéro dicté se recopie mal)
  CONSTRAINT chk_payment_written CHECK (step <> 'payment' OR channel IN ('template','voice_then_template')),
  -- Les messages de protection ne peuvent pas être rendus silencieux
  CONSTRAINT chk_protective_not_silent CHECK (step NOT IN ('handoff_ack','stop_ack','identity') OR channel <> 'silent')
);

CREATE TABLE IF NOT EXISTS public.studio_templates (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key          TEXT NOT NULL CHECK (key ~ '^[a-z0-9_.]{2,64}$'),
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 2 AND 1000),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS public.studio_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('voice','sample_audio','sample_video','image')),
  purpose      TEXT NOT NULL,             -- procedure | offers | welcome | sample | …
  occasion     TEXT,                      -- pour les exemples par occasion
  storage_path TEXT NOT NULL,             -- bucket privé product-files
  duration_s   INT,
  caption      TEXT CHECK (caption IS NULL OR char_length(caption) <= 200),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_user_purpose ON public.studio_assets (user_id, purpose) WHERE is_active;

-- Interrupteurs globaux de la direction
CREATE TABLE IF NOT EXISTS public.engine_flags (
  key        TEXT PRIMARY KEY,           -- ex. 'agent_global_enabled', 'llm_provider_override'
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.engine_flags (key, value) VALUES ('agent_global_enabled', 'true') ON CONFLICT DO NOTHING;
```

### 6.2 Sessions, conversations, messages

```sql
ALTER TABLE public.wa_sessions ADD COLUMN IF NOT EXISTS engine_owner TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.wa_sessions DROP CONSTRAINT IF EXISTS chk_engine_owner;
ALTER TABLE public.wa_sessions ADD CONSTRAINT chk_engine_owner
  CHECK (engine_owner IN ('none','velaris_engine','legacy_agent'));

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS control_mode        TEXT NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS control_reason      TEXT,
  ADD COLUMN IF NOT EXISTS control_actor       TEXT,
  ADD COLUMN IF NOT EXISTS control_set_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS control_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS focus_order_id      UUID,
  ADD COLUMN IF NOT EXISTS pending_question    JSONB,     -- {"key":"confirm_recipient_name","order_id":"…","value":"Awa","asker":"agent|merchant","text":"…","asked_at":"…"}
  ADD COLUMN IF NOT EXISTS ack_log             JSONB NOT NULL DEFAULT '{}',  -- I26 : {"<order>:<stage>:patient_wait":"<ts>", …}
  ADD COLUMN IF NOT EXISTS low_conf_streak     SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_question_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_requests   SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followups_sent      SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supersede_streak    SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_inbound_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_merchant_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_agent_outbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_name        TEXT,
  ADD COLUMN IF NOT EXISTS chat_id             TEXT;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS chk_control_mode;
ALTER TABLE public.conversations ADD CONSTRAINT chk_control_mode CHECK (control_mode IN ('ai','human','closed'));
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS chk_control_actor;
ALTER TABLE public.conversations ADD CONSTRAINT chk_control_actor
  CHECK (control_actor IS NULL OR control_actor IN ('merchant','agent','system'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_user_contact ON public.conversations (user_id, contact_id);

CREATE OR REPLACE FUNCTION public.agent_sync_legacy_pause() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.ai_paused    := (NEW.control_mode <> 'ai');
  NEW.pause_reason := CASE WHEN NEW.control_mode = 'ai' THEN NULL ELSE NEW.control_reason END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_agent_sync_legacy_pause ON public.conversations;
CREATE TRIGGER trg_agent_sync_legacy_pause
  BEFORE INSERT OR UPDATE OF control_mode, control_reason ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.agent_sync_legacy_pause();

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS wa_message_id     TEXT,
  ADD COLUMN IF NOT EXISTS wa_message_key    TEXT,
  ADD COLUMN IF NOT EXISTS wa_timestamp      TIMESTAMPTZ,     -- horodatage WhatsApp (ordre réel)
  ADD COLUMN IF NOT EXISTS media_kind        TEXT,
  ADD COLUMN IF NOT EXISTS media_path        TEXT,
  ADD COLUMN IF NOT EXISTS transcript        TEXT,
  ADD COLUMN IF NOT EXISTS transcript_status TEXT,
  ADD COLUMN IF NOT EXISTS merchant_kind     TEXT,            -- § 15 : lyrics | price_quote | payment_details | …
  ADD COLUMN IF NOT EXISTS outbox_id         UUID,
  ADD COLUMN IF NOT EXISTS turn_id           UUID,
  ADD COLUMN IF NOT EXISTS metadata          JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS chk_media_kind;
ALTER TABLE public.messages ADD CONSTRAINT chk_media_kind
  CHECK (media_kind IS NULL OR media_kind IN ('audio','image','video','document','sticker'));
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS chk_transcript_status;
ALTER TABLE public.messages ADD CONSTRAINT chk_transcript_status
  CHECK (transcript_status IS NULL OR transcript_status IN ('pending','done','failed'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_user_wakey
  ON public.messages (user_id, wa_message_key) WHERE wa_message_key IS NOT NULL;
```

### 6.3 Journal d'ingestion, file de tours, verrou

```sql
CREATE TABLE IF NOT EXISTS public.inbound_events (
  id            BIGSERIAL PRIMARY KEY,
  session_name  TEXT NOT NULL,
  user_id       UUID,
  event_type    TEXT NOT NULL,
  dedup_key     TEXT NOT NULL,
  payload       JSONB NOT NULL,
  source        TEXT NOT NULL DEFAULT 'webhook' CHECK (source IN ('webhook','catch_up','spool_replay')),
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','ignored','failed')),
  reason        TEXT,
  processed_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbound_events_dedup ON public.inbound_events (session_name, event_type, dedup_key);
CREATE INDEX IF NOT EXISTS idx_inbound_events_pending ON public.inbound_events (received_at) WHERE status = 'received';

CREATE TABLE IF NOT EXISTS public.conversation_turns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  conversation_id    UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  trigger            TEXT NOT NULL CHECK (trigger IN ('client_message','merchant_message','merchant_reaction',
                       'merchant_command','followup','payment_event','production_event','relay_check','sla_check')),
  status             TEXT NOT NULL CHECK (status IN ('collecting','scheduled','running','done','superseded','failed','cancelled')),
  inbound_message_ids UUID[] NOT NULL DEFAULT '{}',
  trigger_data       JSONB NOT NULL DEFAULT '{}',
  first_event_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at           TIMESTAMPTZ NOT NULL,
  lock_token         BIGINT,
  started_at         TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  attempts           SMALLINT NOT NULL DEFAULT 0,
  outcome            TEXT,
  error              TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_turn_collecting ON public.conversation_turns (conversation_id) WHERE status = 'collecting';
CREATE INDEX IF NOT EXISTS idx_turns_ready ON public.conversation_turns (ready_at) WHERE status IN ('collecting','scheduled');
CREATE INDEX IF NOT EXISTS idx_turns_running ON public.conversation_turns (conversation_id) WHERE status = 'running';

CREATE SEQUENCE IF NOT EXISTS public.agent_lock_token_seq;
CREATE TABLE IF NOT EXISTS public.automation_locks (
  conversation_id  UUID PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,
  holder           TEXT NOT NULL,
  token            BIGINT NOT NULL,
  turn_id          UUID,
  lease_until      TIMESTAMPTZ NOT NULL,
  acquired_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.4 Boîte d'envoi

```sql
CREATE TABLE IF NOT EXISTS public.outbound_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  conversation_id  UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  order_id         UUID,
  turn_id          UUID,
  origin           TEXT NOT NULL CHECK (origin IN ('agent','merchant_ui','automation','system_alert','delivery')),
  kind             TEXT NOT NULL CHECK (kind IN ('text','voice','file','image','video')),
  purpose          TEXT NOT NULL CHECK (purpose IN ('reply','handoff_ack','stop_ack','identity','payment_instructions',
                     'payment_claim_ack','procedure_voice','offers_voice','sample','lyrics','song','video','status_eta',
                     'owner_alert','followup','merchant')),
  is_relay         BOOLEAN NOT NULL DEFAULT FALSE,   -- envoi autorisé pendant une prise de main (§ 14.4)
  session_name     TEXT NOT NULL,
  chat_id          TEXT NOT NULL,
  body             TEXT,
  media_path       TEXT,
  caption          TEXT,
  body_hash        TEXT,
  idempotency_key  TEXT NOT NULL UNIQUE,
  lock_token       BIGINT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('proposed','pending','sending','sent','unknown','failed','cancelled','rejected','expired')),
  not_before       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  wa_message_id    TEXT,
  wa_message_key   TEXT,
  attempts         SMALLINT NOT NULL DEFAULT 0,
  error            TEXT,
  decided_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sending_at       TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbound_messages (not_before) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_outbox_echo ON public.outbound_messages (session_name, chat_id, created_at DESC)
  WHERE status IN ('sending','sent','unknown');
CREATE INDEX IF NOT EXISTS idx_outbox_rate ON public.outbound_messages (conversation_id, sending_at)
  WHERE origin = 'agent';
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_wakey ON public.outbound_messages (user_id, wa_message_key) WHERE wa_message_key IS NOT NULL;
```

### 6.5 Commandes : deux pistes, plusieurs commandes, vidéo

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stage                    TEXT NOT NULL DEFAULT 'collecting_brief',
  ADD COLUMN IF NOT EXISTS payment_status           TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS version                  INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS catalogue_code           TEXT,
  ADD COLUMN IF NOT EXISTS price_xof                INT CHECK (price_xof IS NULL OR price_xof > 0),
  ADD COLUMN IF NOT EXISTS price_source             TEXT,
  ADD COLUMN IF NOT EXISTS deliverable              TEXT,
  ADD COLUMN IF NOT EXISTS payment_policy           TEXT,
  ADD COLUMN IF NOT EXISTS occasion                 TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name           TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recipient_relation       TEXT,
  ADD COLUMN IF NOT EXISTS sender_name              TEXT,
  ADD COLUMN IF NOT EXISTS style                    TEXT,
  ADD COLUMN IF NOT EXISTS voice                    TEXT,
  ADD COLUMN IF NOT EXISTS language                 TEXT,
  ADD COLUMN IF NOT EXISTS memories                 JSONB NOT NULL DEFAULT '[]',   -- [{"text":"…","quote":"…","message_id":"…"}]
  ADD COLUMN IF NOT EXISTS sensitive_topic          TEXT,                          -- grief | illness | apology | none …
  ADD COLUMN IF NOT EXISTS field_evidence           JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_own_lyrics        TEXT,
  ADD COLUMN IF NOT EXISTS lyrics                   TEXT,
  ADD COLUMN IF NOT EXISTS lyrics_source            TEXT,
  ADD COLUMN IF NOT EXISTS lyrics_version           SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_count           SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lyrics_message_id        UUID,
  ADD COLUMN IF NOT EXISTS lyrics_sent_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lyrics_validated_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_requests          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS payment_instructions_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_instructions_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_deferral         JSONB,       -- {"reason":"kiosk_closed","when":"tomorrow","quote":"…","at":"…"}
  ADD COLUMN IF NOT EXISTS payment_claimed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_claim_message_id UUID,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by     TEXT,
  ADD COLUMN IF NOT EXISTS song_generation_id       UUID,
  ADD COLUMN IF NOT EXISTS audio_delivered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_message_id     UUID,
  ADD COLUMN IF NOT EXISTS inferred_fields          JSONB NOT NULL DEFAULT '{}',  -- valeurs déduites des messages du gérant, à confirmer
  ADD COLUMN IF NOT EXISTS stage_changed_at         TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_order_stage;
ALTER TABLE public.orders ADD CONSTRAINT chk_order_stage CHECK (stage IN (
  'collecting_brief','brief_complete','lyrics_in_progress','lyrics_sent','lyrics_validated',
  'in_production','audio_delivered','video_in_progress','delivered','closed','cancelled'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE public.orders ADD CONSTRAINT chk_payment_status CHECK (payment_status IN (
  'unpaid','instructions_sent','claimed','confirmed','refunded'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_order_voice;
ALTER TABLE public.orders ADD CONSTRAINT chk_order_voice CHECK (voice IS NULL OR voice IN ('male','female','duo'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_price_source;
ALTER TABLE public.orders ADD CONSTRAINT chk_price_source CHECK (price_source IS NULL OR price_source IN ('catalogue','merchant'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_payment_confirmed_by;
ALTER TABLE public.orders ADD CONSTRAINT chk_payment_confirmed_by
  CHECK (payment_confirmed_by IS NULL OR payment_confirmed_by IN ('merchant','saspay'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_lyrics_source;
ALTER TABLE public.orders ADD CONSTRAINT chk_lyrics_source CHECK (lyrics_source IS NULL OR lyrics_source IN
  ('merchant_whatsapp','merchant_studio','ai_draft_approved'));
CREATE INDEX IF NOT EXISTS idx_orders_conversation_open ON public.orders (conversation_id)
  WHERE stage NOT IN ('delivered','closed','cancelled');

-- Pièces jointes de commande : photos souvenir, preuves de paiement
CREATE TABLE IF NOT EXISTS public.order_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  order_id      UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  message_id    UUID NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('photo','payment_proof','unclassified')),
  classifier_confidence NUMERIC(3,2),
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id)
);

-- Compatibilité interface (status, montant, entonnoir)
CREATE OR REPLACE FUNCTION public.agent_sync_order_legacy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.stage = 'cancelled'                 THEN 'cancelled'
    WHEN NEW.stage IN ('delivered','closed')     THEN 'delivered'
    WHEN NEW.payment_status = 'confirmed'        THEN 'validated'
    ELSE 'pending' END;
  IF NEW.price_xof IS NOT NULL THEN NEW.amount_cents := NEW.price_xof * 100; END IF;
  IF NEW.payment_status = 'confirmed' AND NEW.validated_at IS NULL THEN NEW.validated_at := now(); END IF;
  IF NEW.stage = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_agent_sync_order_legacy ON public.orders;
CREATE TRIGGER trg_agent_sync_order_legacy
  BEFORE INSERT OR UPDATE OF stage, payment_status, price_xof ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.agent_sync_order_legacy();

-- L'entonnoir de la conversation suit la commande la plus avancée encore ouverte
CREATE OR REPLACE FUNCTION public.agent_sync_funnel_stage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v TEXT;
BEGIN
  SELECT CASE
           WHEN bool_or(stage IN ('delivered','closed'))                 THEN 'delivered'
           WHEN bool_or(payment_status = 'confirmed')                     THEN 'paid'
           WHEN bool_or(payment_status IN ('instructions_sent','claimed')) THEN 'payment_pending'
           WHEN bool_or(stage NOT IN ('collecting_brief','cancelled'))    THEN 'presenting'
           WHEN bool_or(stage = 'collecting_brief')                       THEN 'qualifying'
           ELSE 'lost' END
    INTO v
    FROM orders
   WHERE conversation_id = NEW.conversation_id
     AND (stage NOT IN ('cancelled') OR NOT EXISTS (
          SELECT 1 FROM orders o2 WHERE o2.conversation_id = NEW.conversation_id AND o2.stage <> 'cancelled'));
  UPDATE conversations SET funnel_stage = COALESCE(v, funnel_stage) WHERE id = NEW.conversation_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_agent_sync_funnel_stage ON public.orders;
CREATE TRIGGER trg_agent_sync_funnel_stage
  AFTER INSERT OR UPDATE OF stage, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.agent_sync_funnel_stage();
```

> Vérifier en base les valeurs autorisées de `funnel_stage` (l'interface utilise `new`, `qualifying`, `presenting`, `payment_pending`, `paid`, `delivered`, `objection`, `lost`) et la contrainte `NOT NULL` éventuelle de `orders.product_id` héritée de `velaris-agent` avant d'appliquer.

### 6.6 Transitions autorisées et historique

```sql
CREATE TABLE IF NOT EXISTS public.order_transitions (
  track           TEXT NOT NULL CHECK (track IN ('creative','payment')),
  from_state      TEXT NOT NULL,
  event           TEXT NOT NULL,
  to_state        TEXT NOT NULL,
  allowed_actors  TEXT[] NOT NULL,
  PRIMARY KEY (track, from_state, event)
);

INSERT INTO public.order_transitions (track, from_state, event, to_state, allowed_actors) VALUES
  -- Piste créative
  ('creative','collecting_brief',  'brief_completed',      'brief_complete',     ARRAY['agent','merchant']),
  ('creative','brief_complete',    'procedure_voice_sent', 'lyrics_in_progress', ARRAY['agent','system']),
  ('creative','brief_complete',    'lyrics_work_started',  'lyrics_in_progress', ARRAY['agent','merchant','system']),
  ('creative','collecting_brief',  'lyrics_sent',          'lyrics_sent',        ARRAY['merchant']),
  ('creative','brief_complete',    'lyrics_sent',          'lyrics_sent',        ARRAY['merchant']),
  ('creative','lyrics_in_progress','lyrics_sent',          'lyrics_sent',        ARRAY['agent','merchant']),
  ('creative','lyrics_sent',       'lyrics_sent',          'lyrics_sent',        ARRAY['merchant']),          -- nouvelle version
  ('creative','lyrics_sent',       'change_requested',     'lyrics_in_progress', ARRAY['agent','merchant']),
  ('creative','lyrics_sent',       'lyrics_validated',     'lyrics_validated',   ARRAY['agent','merchant']),
  ('creative','lyrics_validated',  'production_started',   'in_production',      ARRAY['agent','merchant','system']),
  ('creative','lyrics_validated',  'delivery_sent',        'delivered',          ARRAY['merchant','system']),  -- formule texte
  ('creative','in_production',     'delivery_sent',        'delivered',          ARRAY['merchant','system']),  -- formule audio
  ('creative','in_production',     'audio_delivered',      'audio_delivered',    ARRAY['merchant','system']),  -- formule audio + vidéo
  ('creative','in_production',     'production_failed',    'lyrics_validated',   ARRAY['system']),
  ('creative','audio_delivered',   'video_started',        'video_in_progress',  ARRAY['merchant','system']),
  ('creative','video_in_progress', 'delivery_sent',        'delivered',          ARRAY['merchant','system']),
  ('creative','delivered',         'after_sales_closed',   'closed',             ARRAY['agent','merchant','system']),
  ('creative','collecting_brief',  'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','brief_complete',    'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','lyrics_in_progress','order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','lyrics_sent',       'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','lyrics_validated',  'order_cancelled',      'cancelled',          ARRAY['agent','merchant']),
  ('creative','in_production',     'order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','audio_delivered',   'order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','video_in_progress', 'order_cancelled',      'cancelled',          ARRAY['merchant']),
  ('creative','collecting_brief',  'abandoned',            'cancelled',          ARRAY['system']),
  -- Piste paiement (indépendante de la piste créative)
  ('payment','unpaid',            'instructions_sent',  'instructions_sent', ARRAY['agent','merchant','system']),
  ('payment','instructions_sent', 'instructions_sent',  'instructions_sent', ARRAY['agent','merchant','system']),
  ('payment','unpaid',            'payment_claimed',    'claimed',           ARRAY['agent','merchant']),
  ('payment','instructions_sent', 'payment_claimed',    'claimed',           ARRAY['agent','merchant']),
  ('payment','claimed',           'payment_claimed',    'claimed',           ARRAY['agent','merchant']),
  ('payment','unpaid',            'payment_confirmed',  'confirmed',         ARRAY['merchant','saspay']),
  ('payment','instructions_sent', 'payment_confirmed',  'confirmed',         ARRAY['merchant','saspay']),
  ('payment','claimed',           'payment_confirmed',  'confirmed',         ARRAY['merchant','saspay']),
  ('payment','claimed',           'payment_rejected',   'instructions_sent', ARRAY['merchant']),
  ('payment','confirmed',         'payment_refunded',   'refunded',          ARRAY['merchant'])
ON CONFLICT (track, from_state, event) DO UPDATE
  SET to_state = EXCLUDED.to_state, allowed_actors = EXCLUDED.allowed_actors;

CREATE TABLE IF NOT EXISTS public.order_events (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  track       TEXT NOT NULL,
  from_state  TEXT NOT NULL,
  to_state    TEXT NOT NULL,
  event       TEXT NOT NULL,
  actor       TEXT NOT NULL,
  inferred    BOOLEAN NOT NULL DEFAULT FALSE,     -- déduit d'un message du gérant (§ 15)
  turn_id     UUID,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON public.order_events (order_id, created_at);
```

### 6.7 Passations et journal des tours

```sql
CREATE TABLE IF NOT EXISTS public.handoffs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  order_id         UUID,
  origin           TEXT NOT NULL CHECK (origin IN ('merchant','agent')),
  reason           TEXT NOT NULL,
  detail           TEXT,
  summary          JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','returned','expired')),
  ack_sent_at      TIMESTAMPTZ,
  alert_sent_at    TIMESTAMPTZ,
  sla_alerts       SMALLINT NOT NULL DEFAULT 0,
  last_sla_alert_at TIMESTAMPTZ,
  relay_log        JSONB NOT NULL DEFAULT '{}',     -- {"payment_instructions":"<ts>", …}
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ,
  closed_by        TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_handoff_open ON public.handoffs (conversation_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.agent_turn_logs (
  id               BIGSERIAL PRIMARY KEY,
  turn_id          UUID NOT NULL,
  user_id          UUID NOT NULL,
  conversation_id  UUID NOT NULL,
  policy_version   TEXT NOT NULL,         -- version des tables et prompts utilisés
  orders_before    JSONB,
  orders_after     JSONB,
  understanding    JSONB,
  target_resolution JSONB,
  decision         JSONB,
  actions          JSONB,
  draft            JSONB,
  guard_results    JSONB,
  final_outbox_ids UUID[],
  outcome          TEXT NOT NULL,
  models           JSONB,
  tokens           JSONB,
  cost_xof         NUMERIC(8,2),
  latency_ms       INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_turn_logs_user ON public.agent_turn_logs (user_id, created_at DESC);
```

### 6.8 Fonctions atomiques

```sql
-- Tampon de regroupement des rafales
CREATE OR REPLACE FUNCTION public.agent_buffer_inbound(
  p_user UUID, p_conversation UUID, p_message UUID,
  p_quiet_ms INT, p_max_wait_ms INT, p_hold BOOLEAN DEFAULT FALSE
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_turn UUID;
BEGIN
  UPDATE conversation_turns SET status = 'cancelled', outcome = 'client_wrote', finished_at = now()
   WHERE conversation_id = p_conversation AND status = 'scheduled' AND trigger = 'followup';

  INSERT INTO conversation_turns AS t
    (user_id, conversation_id, trigger, status, inbound_message_ids, first_event_at, last_event_at, ready_at)
  VALUES (p_user, p_conversation, 'client_message', 'collecting', ARRAY[p_message], now(), now(),
          now() + make_interval(secs => (CASE WHEN p_hold THEN p_max_wait_ms ELSE p_quiet_ms END) / 1000.0))
  ON CONFLICT (conversation_id) WHERE status = 'collecting'
  DO UPDATE SET
    inbound_message_ids = t.inbound_message_ids || EXCLUDED.inbound_message_ids,
    last_event_at = now(),
    ready_at = LEAST(now() + make_interval(secs => p_quiet_ms / 1000.0),
                     t.first_event_at + make_interval(secs => p_max_wait_ms / 1000.0))
  RETURNING t.id INTO v_turn;

  UPDATE conversations SET last_inbound_at = now() WHERE id = p_conversation;
  RETURN v_turn;
END $$;

-- Réservation d'un tour prêt + verrou de la conversation
CREATE OR REPLACE FUNCTION public.agent_claim_turn(p_worker TEXT, p_lease_seconds INT DEFAULT 90)
RETURNS TABLE (turn_id UUID, conversation_id UUID, user_id UUID, lock_token BIGINT, trigger TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_token BIGINT; v_got BIGINT;
BEGIN
  FOR r IN
    SELECT t.id, t.conversation_id, t.user_id, t.trigger
      FROM conversation_turns t
     WHERE t.status IN ('collecting','scheduled')
       AND t.ready_at <= now()
       AND NOT EXISTS (SELECT 1 FROM messages m
                        WHERE m.id = ANY (t.inbound_message_ids) AND m.transcript_status = 'pending'
                          AND t.first_event_at > now() - interval '45 seconds')
     ORDER BY t.ready_at
     LIMIT 20
     FOR UPDATE OF t SKIP LOCKED
  LOOP
    v_token := nextval('agent_lock_token_seq');
    v_got := NULL;
    INSERT INTO automation_locks AS l (conversation_id, user_id, holder, token, turn_id, lease_until, acquired_at)
    VALUES (r.conversation_id, r.user_id, p_worker, v_token, r.id, now() + make_interval(secs => p_lease_seconds), now())
    ON CONFLICT (conversation_id) DO UPDATE
       SET holder = EXCLUDED.holder, token = EXCLUDED.token, turn_id = EXCLUDED.turn_id,
           lease_until = EXCLUDED.lease_until, acquired_at = EXCLUDED.acquired_at
     WHERE l.lease_until <= now()
    RETURNING l.token INTO v_got;

    IF v_got IS NOT NULL THEN
      UPDATE conversation_turns SET status = 'running', lock_token = v_got, started_at = now(), attempts = attempts + 1
       WHERE id = r.id;
      turn_id := r.id; conversation_id := r.conversation_id; user_id := r.user_id;
      lock_token := v_got; trigger := r.trigger;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
  RETURN;
END $$;

CREATE OR REPLACE FUNCTION public.agent_renew_lease(p_conversation UUID, p_token BIGINT, p_lease_seconds INT DEFAULT 90)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE automation_locks SET lease_until = now() + make_interval(secs => p_lease_seconds)
   WHERE conversation_id = p_conversation AND token = p_token AND lease_until > now()
  RETURNING TRUE;
$$;

CREATE OR REPLACE FUNCTION public.agent_finish_turn(p_turn UUID, p_conversation UUID, p_token BIGINT,
  p_status TEXT, p_outcome TEXT, p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE conversation_turns SET status = p_status, outcome = p_outcome, error = p_error, finished_at = now()
   WHERE id = p_turn AND lock_token = p_token AND status = 'running';
  DELETE FROM automation_locks WHERE conversation_id = p_conversation AND token = p_token;
END $$;

-- Garde d'envoi (I3, I31, mode relais)
CREATE OR REPLACE FUNCTION public.agent_begin_send(p_outbox UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; c RECORD; v_max SMALLINT; v_recent INT;
BEGIN
  SELECT * INTO o FROM outbound_messages WHERE id = p_outbox FOR UPDATE;
  IF NOT FOUND OR o.status <> 'pending' THEN RETURN 'not_pending'; END IF;
  IF o.not_before > now() THEN RETURN 'too_early'; END IF;
  IF o.expires_at IS NOT NULL AND o.expires_at < now() THEN
    UPDATE outbound_messages SET status = 'expired' WHERE id = p_outbox; RETURN 'expired';
  END IF;

  IF o.origin = 'agent' THEN
    IF NOT EXISTS (SELECT 1 FROM automation_locks
                    WHERE conversation_id = o.conversation_id AND token = o.lock_token AND lease_until > now()) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'lost_lock' WHERE id = p_outbox; RETURN 'lost_lock';
    END IF;
    IF EXISTS (SELECT 1 FROM conversation_turns WHERE conversation_id = o.conversation_id AND status = 'collecting') THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'superseded' WHERE id = p_outbox; RETURN 'superseded';
    END IF;

    SELECT control_mode, control_reason INTO c FROM conversations WHERE id = o.conversation_id;
    IF c.control_mode = 'closed' AND o.purpose <> 'stop_ack' THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'control_closed' WHERE id = p_outbox; RETURN 'paused';
    END IF;
    IF c.control_mode = 'human' AND NOT (
         o.purpose IN ('handoff_ack','identity')
         OR (o.is_relay AND o.purpose IN ('payment_instructions','payment_claim_ack','status_eta')
             AND COALESCE(c.control_reason,'') NOT IN ('handoff:complaint','handoff:payment_dispute','handoff:very_negative'))
       ) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'control_human' WHERE id = p_outbox; RETURN 'paused';
    END IF;

    SELECT max_agent_msgs_per_hour INTO v_max FROM studio_personas WHERE user_id = o.user_id;
    SELECT count(*) INTO v_recent FROM outbound_messages
     WHERE conversation_id = o.conversation_id AND origin = 'agent'
       AND status IN ('sending','sent','unknown') AND sending_at > now() - interval '1 hour';
    IF v_recent >= COALESCE(v_max, 6) THEN
      UPDATE outbound_messages SET status = 'cancelled', error = 'rate_limited' WHERE id = p_outbox; RETURN 'rate_limited';
    END IF;
  END IF;

  UPDATE outbound_messages SET status = 'sending', sending_at = now(), attempts = attempts + 1 WHERE id = p_outbox;
  RETURN 'ok';
END $$;

-- Contrôle de la conversation (I5, I6)
CREATE OR REPLACE FUNCTION public.agent_set_control(
  p_conversation UUID, p_mode TEXT, p_reason TEXT, p_actor TEXT, p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD;
BEGIN
  SELECT id, user_id, control_mode, control_actor INTO c FROM conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF c.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
    p_actor := 'merchant';
  END IF;
  IF p_mode = 'ai' AND c.control_mode = 'human' AND c.control_actor = 'merchant' AND p_actor <> 'merchant' THEN
    RETURN 'merchant_lock';
  END IF;
  IF c.control_mode = 'closed' AND p_mode <> 'closed' AND p_actor <> 'merchant' THEN RETURN 'closed_lock'; END IF;

  UPDATE conversations
     SET control_mode = p_mode, control_reason = p_reason, control_actor = p_actor,
         control_set_at = now(), control_expires_at = p_expires_at,
         low_conf_streak = CASE WHEN p_mode = 'ai' THEN 0 ELSE low_conf_streak END,
         pending_question = CASE WHEN p_mode = 'ai' THEN NULL ELSE pending_question END
   WHERE id = p_conversation;
  IF p_mode = 'ai' THEN
    UPDATE handoffs SET status = 'returned', closed_at = now(), closed_by = p_actor
     WHERE conversation_id = p_conversation AND status = 'open';
  END IF;
  RETURN 'ok';
END $$;

-- Ouverture d'une commande (plusieurs possibles, plafond par studio)
CREATE OR REPLACE FUNCTION public.agent_open_order(p_conversation UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; v_open INT; v_max SMALLINT; v_id UUID;
BEGIN
  SELECT id, user_id, contact_id INTO c FROM conversations WHERE id = p_conversation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  SELECT max_open_orders INTO v_max FROM studio_personas WHERE user_id = c.user_id;
  SELECT count(*) INTO v_open FROM orders
   WHERE conversation_id = p_conversation AND stage NOT IN ('delivered','closed','cancelled');
  IF v_open >= COALESCE(v_max, 3) THEN RAISE EXCEPTION 'too_many_open_orders'; END IF;
  INSERT INTO orders (user_id, contact_id, conversation_id, stage, payment_status, amount_cents)
  VALUES (c.user_id, c.contact_id, p_conversation, 'collecting_brief', 'unpaid', 0)
  RETURNING id INTO v_id;
  UPDATE conversations SET focus_order_id = v_id WHERE id = p_conversation;
  RETURN v_id;
END $$;

-- Transition d'une piste (I7, I8), concurrence optimiste
CREATE OR REPLACE FUNCTION public.agent_transition_order(
  p_order UUID, p_expected_version INT, p_track TEXT, p_event TEXT, p_actor TEXT,
  p_turn UUID DEFAULT NULL, p_data JSONB DEFAULT '{}', p_inferred BOOLEAN DEFAULT FALSE
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; tr RECORD; v_from TEXT;
BEGIN
  SELECT id, user_id, stage, payment_status, deliverable, version INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF o.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
    p_actor := 'merchant';
  END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;

  v_from := CASE p_track WHEN 'creative' THEN o.stage WHEN 'payment' THEN o.payment_status END;
  IF v_from IS NULL THEN RETURN 'unknown_track'; END IF;
  SELECT * INTO tr FROM order_transitions WHERE track = p_track AND from_state = v_from AND event = p_event;
  IF NOT FOUND THEN RETURN 'transition_forbidden'; END IF;
  IF NOT (p_actor = ANY (tr.allowed_actors)) THEN RETURN 'actor_forbidden'; END IF;

  -- Portes croisées entre pistes (le gérant peut passer outre : c'est son studio)
  IF p_track = 'creative' AND p_actor <> 'merchant' THEN
    IF p_event IN ('production_started','delivery_sent','audio_delivered','video_started')
       AND o.payment_status <> 'confirmed' THEN RETURN 'payment_not_confirmed'; END IF;
    IF p_event = 'delivery_sent' AND v_from = 'in_production' AND o.deliverable = 'audio_video' THEN RETURN 'video_pending'; END IF;
    IF p_event = 'audio_delivered' AND o.deliverable <> 'audio_video' THEN RETURN 'not_video_offer'; END IF;
    IF p_event = 'order_cancelled' AND o.payment_status IN ('claimed','confirmed') THEN RETURN 'payment_lock'; END IF;
  END IF;

  IF p_track = 'creative' THEN
    UPDATE orders SET stage = tr.to_state, version = version + 1, stage_changed_at = now(),
           lyrics_sent_at      = CASE WHEN p_event = 'lyrics_sent'      THEN now() ELSE lyrics_sent_at END,
           lyrics_validated_at = CASE WHEN p_event = 'lyrics_validated' THEN now() ELSE lyrics_validated_at END,
           audio_delivered_at  = CASE WHEN p_event = 'audio_delivered'  THEN now() ELSE audio_delivered_at END,
           revision_count      = revision_count + CASE WHEN p_event = 'change_requested' THEN 1 ELSE 0 END
     WHERE id = p_order;
  ELSE
    UPDATE orders SET payment_status = tr.to_state, version = version + 1,
           payment_instructions_at    = CASE WHEN p_event = 'instructions_sent' THEN now() ELSE payment_instructions_at END,
           payment_instructions_count = payment_instructions_count + CASE WHEN p_event = 'instructions_sent' THEN 1 ELSE 0 END,
           payment_claimed_at         = CASE WHEN p_event = 'payment_claimed' THEN now() ELSE payment_claimed_at END,
           payment_confirmed_at       = CASE WHEN tr.to_state = 'confirmed' THEN now() ELSE payment_confirmed_at END,
           payment_confirmed_by       = CASE WHEN tr.to_state = 'confirmed' THEN p_actor ELSE payment_confirmed_by END
     WHERE id = p_order;
  END IF;

  INSERT INTO order_events (order_id, user_id, track, from_state, to_state, event, actor, inferred, turn_id, data)
  VALUES (p_order, o.user_id, p_track, v_from, tr.to_state, p_event, p_actor, p_inferred, p_turn, p_data);
  RETURN 'ok';
END $$;

-- Écriture des champs du brief : aucune suppression par inférence (I20)
CREATE OR REPLACE FUNCTION public._agent_pick(p JSONB, k TEXT, cur TEXT, allow_clear BOOLEAN)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN NOT (p ? k) THEN cur
              WHEN jsonb_typeof(p->k) = 'null' THEN CASE WHEN allow_clear THEN NULL ELSE cur END
              ELSE p->>k END
$$;

CREATE OR REPLACE FUNCTION public.agent_patch_order_fields(
  p_order UUID, p_expected_version INT, p_patch JSONB, p_allow_clear BOOLEAN DEFAULT FALSE
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD;
BEGIN
  SELECT id, user_id, stage, version, recipient_name INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF auth.uid() IS NOT NULL AND o.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;
  IF o.stage IN ('delivered','closed','cancelled') THEN RETURN 'order_closed'; END IF;

  UPDATE orders SET
    occasion           = public._agent_pick(p_patch, 'occasion',           occasion,           p_allow_clear),
    recipient_name     = public._agent_pick(p_patch, 'recipient_name',     recipient_name,     p_allow_clear),
    recipient_relation = public._agent_pick(p_patch, 'recipient_relation', recipient_relation, p_allow_clear),
    sender_name        = public._agent_pick(p_patch, 'sender_name',        sender_name,        p_allow_clear),
    style              = public._agent_pick(p_patch, 'style',              style,              p_allow_clear),
    voice              = public._agent_pick(p_patch, 'voice',              voice,              p_allow_clear),
    language           = public._agent_pick(p_patch, 'language',           language,           p_allow_clear),
    sensitive_topic    = public._agent_pick(p_patch, 'sensitive_topic',    sensitive_topic,    p_allow_clear),
    client_own_lyrics  = public._agent_pick(p_patch, 'client_own_lyrics',  client_own_lyrics,  p_allow_clear),
    recipient_name_confirmed = CASE
      WHEN p_patch ? 'recipient_name_confirmed' THEN (p_patch->>'recipient_name_confirmed')::boolean
      WHEN public._agent_pick(p_patch, 'recipient_name', recipient_name, p_allow_clear) IS DISTINCT FROM recipient_name THEN FALSE
      ELSE recipient_name_confirmed END,
    memories           = CASE WHEN p_patch ? 'memories' THEN memories || (p_patch->'memories') ELSE memories END,
    field_evidence     = field_evidence || COALESCE(p_patch->'field_evidence', '{}'::jsonb),
    version            = version + 1
  WHERE id = p_order;
  RETURN 'ok';
END $$;

-- Prix : depuis le catalogue (agent) ou annoncé par le gérant
CREATE OR REPLACE FUNCTION public.agent_choose_offer(p_order UUID, p_expected_version INT, p_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; c RECORD;
BEGIN
  SELECT id, user_id, stage, payment_status, version INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;
  IF o.payment_status <> 'unpaid' THEN RETURN 'payment_started'; END IF;
  IF o.stage NOT IN ('collecting_brief','brief_complete','lyrics_in_progress','lyrics_sent') THEN RETURN 'offer_locked'; END IF;
  SELECT * INTO c FROM studio_catalogues WHERE user_id = o.user_id AND code = p_code AND is_active;
  IF NOT FOUND THEN RETURN 'unknown_offer'; END IF;
  UPDATE orders SET catalogue_code = c.code, price_xof = c.price_xof, price_source = 'catalogue',
                    deliverable = c.deliverable, payment_policy = c.payment_policy, version = version + 1
   WHERE id = p_order;
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.agent_set_merchant_price(p_order UUID, p_expected_version INT, p_price INT, p_inferred BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD;
BEGIN
  SELECT id, user_id, version, payment_status INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF auth.uid() IS NOT NULL AND o.user_id <> auth.uid() THEN RETURN 'forbidden'; END IF;
  IF o.version <> p_expected_version THEN RETURN 'version_conflict'; END IF;
  IF p_price IS NULL OR p_price < 100 OR p_price > 1000000 THEN RETURN 'invalid_price'; END IF;
  IF o.payment_status = 'confirmed' THEN RETURN 'payment_confirmed'; END IF;
  UPDATE orders SET price_xof = p_price, price_source = 'merchant', version = version + 1,
         inferred_fields = CASE WHEN p_inferred THEN inferred_fields || jsonb_build_object('price_xof', p_price)
                                ELSE inferred_fields - 'price_xof' END
   WHERE id = p_order;
  RETURN 'ok';
END $$;

-- Droits
REVOKE ALL ON FUNCTION public.agent_buffer_inbound(UUID,UUID,UUID,INT,INT,BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_claim_turn(TEXT,INT)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_renew_lease(UUID,BIGINT,INT)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_finish_turn(UUID,UUID,BIGINT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_begin_send(UUID)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_open_order(UUID)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_choose_offer(UUID,INT,TEXT)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_set_control(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agent_transition_order(UUID,INT,TEXT,TEXT,TEXT,UUID,JSONB,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agent_patch_order_fields(UUID,INT,JSONB,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agent_set_merchant_price(UUID,INT,INT,BOOLEAN)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_set_control(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_transition_order(UUID,INT,TEXT,TEXT,TEXT,UUID,JSONB,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_patch_order_fields(UUID,INT,JSONB,BOOLEAN)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_merchant_price(UUID,INT,INT,BOOLEAN)                   TO authenticated;
```

### 6.9 Faits client (anciens et nouveaux clients, sans aucune date calendaire)

```sql
CREATE OR REPLACE FUNCTION public.agent_contact_facts(p_contact UUID)
RETURNS TABLE (delivered_orders INT, open_orders INT, procedure_voice_received_at TIMESTAMPTZ,
               last_delivered_at TIMESTAMPTZ, known_sender_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM orders WHERE contact_id = p_contact AND stage IN ('delivered','closed')),
    (SELECT count(*)::int FROM orders WHERE contact_id = p_contact AND stage NOT IN ('delivered','closed','cancelled')),
    (SELECT max(COALESCE(o.sent_at, o.sending_at)) FROM outbound_messages o
       JOIN conversations c ON c.id = o.conversation_id
      WHERE c.contact_id = p_contact AND o.purpose = 'procedure_voice' AND o.status IN ('sent','unknown')),
    (SELECT max(delivered_at) FROM orders WHERE contact_id = p_contact),
    (SELECT sender_name FROM orders WHERE contact_id = p_contact AND sender_name IS NOT NULL
      ORDER BY created_at DESC LIMIT 1);
$$;
REVOKE ALL ON FUNCTION public.agent_contact_facts(UUID) FROM PUBLIC, anon, authenticated;
```

Définitions qui en découlent (I23, I24) :
- **ancien client** = `delivered_orders >= 1`. Jamais « contact créé avant aujourd'hui » (cas Sylvie, cas Adeline) ;
- **vocal de procédure déjà reçu** = `procedure_voice_received_at` non nul, et plus récent que `procedure_voice_validity_days` si ce réglage est défini ;
- **prospect dormant** (contact ancien, aucune commande livrée, aucun vocal reçu) = **nouveau client**.

### 6.10 Sécurité au niveau des lignes

```sql
ALTER TABLE public.studio_personas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_catalogues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_step_policies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_flags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_turns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_locks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_transitions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoffs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_turn_logs         ENABLE ROW LEVEL SECURITY;

-- Configuration : propriétaire en lecture et écriture
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['studio_personas','studio_catalogues','studio_step_policies','studio_templates','studio_assets'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))', t || '_own', t);
  END LOOP;
  -- Journaux et file : lecture seule pour le propriétaire
  FOREACH t IN ARRAY ARRAY['conversation_turns','outbound_messages','order_assets','order_events','handoffs','agent_turn_logs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                    USING (user_id = (SELECT auth.uid()))', t || '_read_own', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS order_transitions_read ON public.order_transitions;
CREATE POLICY order_transitions_read ON public.order_transitions FOR SELECT TO authenticated USING (TRUE);
-- inbound_events, automation_locks, engine_flags : aucune politique → service_role uniquement.
```

> Point d'attention : `studio_personas` contient des réglages sensibles (moyens de paiement, interrupteur). La politique ci-dessus permet au propriétaire de les modifier, ce qui est voulu. Les **contrôles de format** (numéros, prix) sont dans les contraintes `CHECK` et dans l'écran de configuration ; une modification des moyens de paiement déclenche en plus une alerte au numéro du gérant (protection contre un compte Velaris compromis qui détournerait les dépôts).

---

## 7. Ingestion, regroupement des rafales, verrou par conversation

### 7.1 Chemin d'un webhook (moins de 300 ms)

```
POST /webhooks/waha
 1. HMAC (X-Webhook-Hmac, sha512) sur le corps brut → 401 sinon
 2. Normalisation → { session, type, waKey, waTimestamp, chatId, fromMe, body, media?, reaction? }
 3. Rejet : groupes, statuts, session inconnue ou protégée
 4. INSERT inbound_events ON CONFLICT DO NOTHING (doublon → 200)
    Base injoignable → ajout au spool disque (fsync) → 200
 5. 200 immédiat ; traitement asynchrone dans le processus ; balayeur pour tout 'received' de plus de 10 s
```

### 7.2 Traitement par type

| Type | Traitement (une transaction) |
|---|---|
| Message client | Contact et conversation (upsert) → `messages` (`ON CONFLICT DO NOTHING`, **résultat lu** : doublon = arrêt) → audio : `transcript_status = 'pending'` + STT asynchrone ; image : Storage + classement photo/preuve (§ 8.5) → `agent_buffer_inbound(…, p_hold => audio)` |
| Message `fromMe` | Rapprochement d'écho (§ 7.7). Écho → lien avec la boîte d'envoi. Sinon → `messages` (`human_agent`), `last_merchant_at`, `agent_set_control('human','merchant_reply','merchant')`, passation `merchant` si absente, **tour `merchant_message`** (lecture du message du gérant, § 15) |
| Réaction | Acceptée **seulement si `fromMe === true`**. Commande de `reaction_commands` → tour `merchant_reaction`. Sinon → automatisations, via la même file |
| Accusé de lecture | Mise à jour de l'accusé, aucun tour |
| Statut de session | `wa_sessions` (au changement), alerte de déconnexion |

### 7.3 Tampon des rafales

Le tour `collecting` **est** le tampon. Chaque bulle repousse `ready_at` de `quiet_window_ms` (4 s), plafonné à `first_event_at + max_batch_wait_ms` (12 s). Un vocal retient le tour jusqu'à la fin de sa transcription (45 s au maximum). Les bulles sont assemblées dans l'ordre de leur **horodatage WhatsApp**.

Pourquoi 4 s et 12 s : à 1,2 s (ancienne valeur), on répondait à la moitié de la pensée d'un client qui tape sur mobile ; à 4 s de silence, « Bonjour » + « c'est pour un anniversaire » + « pour ma femme Awa » forment un seul tour, et la réponse arrive en 6 à 16 s, plus vite qu'un humain. Les deux valeurs sont réglables par studio.

### 7.4 Boucle du travailleur

```ts
export async function workerLoop(ctx: WorkerCtx): Promise<never> {
  for (;;) {
    if (!(await ctx.flags.agentGlobalEnabled())) { await sleep(5_000); continue; }
    const claim = await db.claimTurn(ctx.workerId, LEASE_SECONDS);
    if (!claim) { await sleep(jitter(400)); continue; }

    const heartbeat = setInterval(() => {
      void db.renewLease(claim.conversationId, claim.lockToken, LEASE_SECONDS)
        .then((ok) => { if (!ok) ctx.abort(claim.turnId); });
    }, HEARTBEAT_MS);

    try {
      const outcome = await runTurn(claim, ctx.abortSignal(claim.turnId));
      await db.finishTurn(claim, outcome.status, outcome.label);
    } catch (err) {
      await db.finishTurn(claim, 'failed', 'exception', String(err));
      await raiseOwnerAlertIfRepeated(claim, err);      // jamais d'envoi client depuis ce chemin
    } finally {
      clearInterval(heartbeat);
    }
  }
}
```

### 7.5 Reprise après plantage

Le balayeur traite les tours `running` dont le bail a expiré :
- aucune ligne d'envoi du tour en `sending`, `sent` ou `unknown` → le tour repasse en `collecting` (fusion avec un tampon plus récent) ;
- sinon → `failed` + passation `agent_crash`. On ne régénère **jamais** un tour qui a peut-être parlé.

### 7.6 Supersession

Un message client qui arrive pendant un tour crée un nouveau tampon. `agent_begin_send` annule alors l'envoi (`superseded`), et le tour suivant traite toutes les bulles ensemble. Après 3 supersessions consécutives (`supersede_streak`), le tour suivant est envoyé même si le client écrit encore ; l'événement est journalisé.

### 7.7 Envoi et échos

```
Envoi :
 1. agent_begin_send → ok | superseded | paused | lost_lock | rate_limited | expired
 2. « en train d'écrire » + délai humain = clamp(1,5 s ; 25 ms × caractères ; 6 s) ; « en train d'enregistrer » pour un vocal
 3. WAHA : un envoi à la fois par discussion, deux par session, nouvel essai seulement sur 429/502/503
 4. Succès → sent + identifiant ; délai dépassé → unknown (aucun nouvel essai)

Écho fromMe :
 a. par (user_id, wa_message_key) → écho certain
 b. sinon par (session, chat_id, body_hash) parmi sending/sent/unknown des 10 dernières minutes → écho probable
 c. sinon → message du gérant
```

Tous les envois du Studio OS, des automatisations et des alertes passent par la boîte d'envoi.

### 7.8 Rattrapage WAHA

Au démarrage puis toutes les 10 minutes, pour chaque session active : lecture des derniers messages des discussions ayant eu de l'activité dans les 48 h, et ingestion avec `source = 'catch_up'` et la même clé de déduplication. Un message raté pendant une coupure est rattrapé ; un message déjà vu est ignoré.

---

## 8. Modèle de commande : deux pistes, plusieurs commandes, vidéo

### 8.1 Pourquoi deux pistes

Le terrain le montre : le client peut vouloir payer **avant** d'avoir vu les paroles (il a confiance, il est pressé, il a le numéro d'une publicité), **pendant** (il demande le numéro de dépôt en plein brief), ou **après** (cas standard). Il peut reporter (« demain, les kiosques sont fermés »). Un parcours unique qui place le paiement après la validation fait mécaniquement tomber ces cas dans les trous de la matrice : c'est exactement le cas Fargo. Les deux pistes avancent donc **indépendamment** et ne se rejoignent qu'aux **portes** :

| Porte | Condition |
|---|---|
| Lancer la production | `stage = lyrics_validated` **et** `payment_status = confirmed` (sauf geste du gérant) |
| Livrer la formule texte | `stage = lyrics_validated` **et** `payment_status = confirmed` |
| Envoyer les paroles (formule `before_lyrics`) | `payment_status = confirmed` (pour l'agent ; le gérant reste libre) |
| Démarrer la vidéo | `stage = audio_delivered` (paiement déjà confirmé par construction) |

### 8.2 Piste créative

```
collecting_brief ──brief_completed──▶ brief_complete ──procedure_voice_sent / lyrics_work_started──▶ lyrics_in_progress
       │                                     │                                                          │
       └──────────── lyrics_sent (gérant) ───┴──────────────────────────────────────────────────────────▶ lyrics_sent ◀─┐
                                                                                                             │          │
                                                                    change_requested ◀──────────────────────┤          │
                                                                    (retour en lyrics_in_progress)          │   lyrics_sent
                                                                                                             ▼  (nouvelle version)
                                                                                                    lyrics_validated
                                                    ┌──────────── delivery_sent (formule texte) ─────────────┤
                                                    ▼                                                        ▼ production_started
                                                delivered ◀── delivery_sent (audio) ─── in_production ──production_failed──▶ lyrics_validated
                                                    ▲                                       │ audio_delivered (audio + vidéo)
                                                    │                                       ▼
                                                    └──── delivery_sent ── video_in_progress ◀── video_started ── audio_delivered
                                                delivered ──after_sales_closed──▶ closed
```

### 8.3 Piste paiement

```
unpaid ──instructions_sent──▶ instructions_sent ──payment_claimed──▶ claimed ──payment_confirmed (gérant / SasPay)──▶ confirmed
   │                              ▲      │ (renvoi)                    │  ▲                                              │
   │                              └──────┘                             │  └── payment_claimed (preuve supplémentaire)    │
   ├──payment_claimed (le client avait déjà le numéro)──▶ claimed      └── payment_rejected (gérant) ──▶ instructions_sent
   └──payment_confirmed (gérant / SasPay)──▶ confirmed                                              confirmed ──payment_refunded──▶ refunded
```

### 8.4 Plusieurs commandes

- Une conversation peut avoir jusqu'à `max_open_orders` commandes ouvertes (3 par défaut).
- `conversations.focus_order_id` désigne la commande dont on parle en ce moment.
- Une nouvelle intention `order_song` avec un **destinataire ou une occasion différents** de la commande ouverte → nouvelle commande ; avec les mêmes → c'est la même (le client se répète).
- Paiement groupé : le gabarit de paiement liste chaque commande ouverte non payée et le total. Une preuve reçue est rattachée à **toutes** les commandes en `instructions_sent` / `claimed` de la conversation, sauf si le client en désigne une. Le gérant confirme en un geste (« tout confirmer » dans le Studio, ou `🎵` sur chaque paroles).
- Les relances, les délais annoncés et les accusés tiennent compte de toutes les commandes ouvertes, mais ne parlent que d'une seule à la fois.

### 8.5 Vidéo souvenir et images reçues

- Formule `audio_video` : les photos peuvent arriver à tout moment. Chaque image reçue est **classée** par un appel de vision court : `photo`, `payment_proof` ou `unclassified`, avec une confiance.
- Une capture Orange Money / Wave est visuellement distincte d'une photo de famille, mais l'erreur reste possible. Donc :
  - `payment_proof` → événement `payment_claimed`, jamais `payment_confirmed` ;
  - `photo` → `order_assets` de la commande visée ;
  - `unclassified` → les deux listes, et une alerte au gérant.
- `audio_delivered` → `video_in_progress` quand le gérant (ou un outil de montage futur) démarre. La livraison de la vidéo passe `delivered`.
- Si aucune photo n'est arrivée au moment de `audio_delivered`, le gabarit `video_photos` les demande, une seule fois.

### 8.6 Types TypeScript

```ts
export const CREATIVE_STAGES = ['collecting_brief','brief_complete','lyrics_in_progress','lyrics_sent','lyrics_validated',
  'in_production','audio_delivered','video_in_progress','delivered','closed','cancelled'] as const;
export type CreativeStage = (typeof CREATIVE_STAGES)[number];

export const PAYMENT_STATES = ['unpaid','instructions_sent','claimed','confirmed','refunded'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export type Track = 'creative' | 'payment';
export type Actor = 'agent' | 'merchant' | 'system' | 'saspay';
export type ControlMode = 'ai' | 'human' | 'closed';

export interface Transition { track: Track; from: string; event: string; to: string; actors: readonly Actor[] }

// transitions.ts : copie exacte de order_transitions (test de parité, § 20.1)
export const TRANSITIONS: readonly Transition[] = [ /* … */ ];

export function next(track: Track, from: string, event: string, actor: Actor): string | null {
  const t = TRANSITIONS.find((x) => x.track === track && x.from === from && x.event === event);
  return t && t.actors.includes(actor) ? t.to : null;
}
```

---

## 9. Compréhension

### 9.1 Contrat

- **Entrée :**
  - les bulles du tour, dans l'ordre WhatsApp (texte et transcriptions) ;
  - les 8 derniers messages étiquetés `client` / `studio` / `gérant` ;
  - les commandes ouvertes (étiquette, étapes des deux pistes) ;
  - la question en attente, **y compris si c'est le gérant qui l'a posée** ;
  - les codes et libellés du catalogue.
- **Sortie :** JSON strict validé par Zod, température 0. Aucune règle métier dans ce prompt.
- **Échec de validation** → un essai ; second échec → `unclear`, confiance 0.

### 9.2 Schéma

```json
{
  "$id": "velaris/understanding.v2",
  "type": "object", "additionalProperties": false,
  "required": ["primary_intent","secondary_intents","negated","confidence","fields","payment_signal",
               "emotional_weight","sensitive_topic","sentiment","wants_human","stop_request","language",
               "order_reference","gist"],
  "properties": {
    "primary_intent": { "enum": [
      "greeting","ask_price","ask_delay","ask_how_it_works","ask_sample",
      "order_song","give_brief_info","shares_story","needs_guidance","choose_offer",
      "confirm_yes","confirm_no","acknowledgement","patient_wait","positive_feedback",
      "validate_lyrics","request_lyrics_change","provides_own_lyrics",
      "ask_payment_method","payment_claim","payment_deferral",
      "ask_status","trust_concern","asks_if_bot","ask_human","complaint","discount_request",
      "cancel_order","stop_contact","thanks_closing","smalltalk","off_topic","unclear" ] },
    "secondary_intents": { "type": "array", "maxItems": 2, "items": { "$ref": "#/properties/primary_intent" } },
    "negated":    { "type": "boolean" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "fields": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "offer_code":         { "$ref": "#/$defs/x" },
        "occasion":           { "$ref": "#/$defs/x" },
        "recipient_name":     { "$ref": "#/$defs/x" },
        "recipient_relation": { "$ref": "#/$defs/x" },
        "sender_name":        { "$ref": "#/$defs/x" },
        "style":              { "$ref": "#/$defs/x" },
        "voice": { "type": "object", "additionalProperties": false, "required": ["value","quote"],
                   "properties": { "value": { "enum": ["male","female","duo"] }, "quote": { "type": "string", "maxLength": 160 } } },
        "language":           { "$ref": "#/$defs/x" },
        "memories":           { "type": "array", "maxItems": 6, "items": { "$ref": "#/$defs/x" } },
        "change_request":     { "$ref": "#/$defs/x" },
        "own_lyrics":         { "$ref": "#/$defs/x_long" }
      }
    },
    "payment_signal": {
      "type": "object", "additionalProperties": false, "required": ["kind"],
      "properties": {
        "kind":     { "enum": ["none","asks_how_to_pay","claims_paid","defers","disputes_payment"] },
        "provider": { "enum": ["wave","orange_money","moov","mtn","other","unknown"] },
        "deferral_reason": { "enum": ["kiosk_closed","no_money_now","traveling","waiting_someone","other","unknown"] },
        "deferral_when":   { "enum": ["later_today","tonight","tomorrow","this_week","unknown"] },
        "quote":    { "type": "string", "maxLength": 160 }
      }
    },
    "emotional_weight": { "enum": ["none","moderate","high"] },
    "sensitive_topic":  { "enum": ["none","grief","illness","apology","hardship","love","celebration","faith"] },
    "sentiment":        { "enum": ["positive","neutral","negative","very_negative"] },
    "wants_human":      { "type": "boolean" },
    "stop_request":     { "type": "boolean" },
    "language":         { "enum": ["fr","fr_nouchi","en","dioula","moore","wolof","other"] },
    "order_reference":  { "type": "object", "additionalProperties": false,
                          "properties": { "recipient_name": { "type": "string" }, "occasion": { "type": "string" },
                                          "is_new_order": { "type": "boolean" }, "quote": { "type": "string" } } },
    "gist":             { "type": "string", "maxLength": 200, "description": "Reformulation neutre en français standard, pour le journal et la rédaction. Jamais utilisée pour décider." }
  },
  "$defs": {
    "x":      { "type": "object", "additionalProperties": false, "required": ["value","quote"],
                "properties": { "value": { "type": "string", "minLength": 1, "maxLength": 120 },
                                "quote": { "type": "string", "minLength": 1, "maxLength": 200 } } },
    "x_long": { "type": "object", "additionalProperties": false, "required": ["value","quote"],
                "properties": { "value": { "type": "string", "minLength": 1, "maxLength": 3000 },
                                "quote": { "type": "string", "minLength": 1, "maxLength": 200 } } }
  }
}
```

### 9.3 Vérifications du code sur la sortie

1. **Citation obligatoire** : chaque champ porte un extrait ; le code vérifie que l'extrait normalisé (minuscules, accents retirés, espaces réduits) est **contenu** dans le texte du tour. Sinon le champ est jeté.
2. `recipient_name` doit apparaître dans sa citation ; `offer_code` doit exister dans le catalogue actif.
3. `claims_paid` n'est retenu que si `negated = false` et que la citation n'est pas un simple accusé (« bien reçu », « ok », « d'accord », « merci » seuls ne portent jamais un paiement : vérification par une liste fermée d'accusés, dans le **seul** module de vérification de sortie, jamais dans la décision).
4. `confirm_yes` / `confirm_no` n'ont de sens que si `pending_question` existe ; sinon ils sont requalifiés en `acknowledgement`. Ils n'agissent **que** sur le champ ou l'action de la question (I20). « Non pas encore » à « Avez-vous fait le dépôt ? » ne change rien d'autre (cas Adeline).
5. `own_lyrics` n'est retenu que si `primary_intent = provides_own_lyrics` (déclaration explicite) (I30). Un long récit reste dans `memories`.
6. Confiance < 0,6 → `low_conf_streak + 1` ; sinon remise à 0.

### 9.4 Squelette du prompt (versionné `understand.v2.md`)

```
Tu analyses des messages WhatsApp envoyés par un client à un studio de chansons personnalisées
en Afrique de l'Ouest. Tu ne réponds pas au client. Tu produis uniquement l'objet JSON demandé.

Les clients écrivent comme ils parlent : fautes, phrases sans verbe, nouchi ivoirien, mots de dioula
ou de mooré, abréviations. Comprends le sens, pas la forme.

Contexte : étape(s) des commandes ouvertes, question posée juste avant (par le studio ou le gérant),
formules du studio.

Définitions courtes des intentions (une ligne chacune) …
- acknowledgement : accusé neutre (« ok », « bien reçu », « d'accord », « merci »). Jamais un paiement.
- patient_wait : le client accepte d'attendre (« j'attends alors »). Jamais un refus ni un changement d'avis.
- payment_deferral : le client paiera plus tard ; précise la raison et le moment si dits.
- ask_payment_method : le client demande où ou comment payer, quelle que soit la formulation
  (« le numéro de dépôt », « c'est sur quelle numéro », « OM ou Wave »).
- shares_story : le client raconte une histoire, des souvenirs, une épreuve. Ce ne sont PAS des paroles.
- provides_own_lyrics : le client dit explicitement qu'il fournit ses propres paroles.
…

Règles d'extraction : citation exacte pour chaque valeur ; rien qui ne figure pas dans les messages
du client de ce tour ; « gist » reformule sans juger.

Exemples (40 à 60, tirés du corpus réel anonymisé, § 2.4 et § 20.3) …
```

### 9.5 Corpus et langue

La compréhension du nouchi, des phrases sans verbe et des transcriptions approximatives est une **question de mesure**, pas de prompt. Le jeu d'évaluation (§ 20.3) contient au départ **toutes** les tournures du § 2.4, les messages réels des 5 cas, et 300 messages anonymisés tirés des conversations de production. Il croît à chaque incident (§ 21). Le modèle est choisi, et changé, uniquement sur ce jeu.

---

## 10. Résolution de la commande visée

Étape déterministe entre la compréhension et la décision :

```
commandes_ouvertes = orders ouvertes de la conversation
si aucune                         → cible = null (accueil), sauf intention commerciale → ouverture
si une                            → cible = elle, sauf order_reference.is_new_order avec un destinataire ou une occasion différents
                                     → nouvelle commande (si plafond non atteint, sinon passation 'too_many_orders')
si plusieurs :
   order_reference.recipient_name / occasion correspond à une seule → cible
   intention de paiement            → toutes les commandes non payées (gabarit groupé)
   question en attente liée à une commande → cette commande
   sinon focus_order_id             → cible, si l'intention concerne l'étape de cette commande
   sinon                            → une question de désambiguïsation (« C'est pour la chanson d'Awa ou celle de Fadila ? »)
```

La désambiguïsation est la seule question « technique » autorisée ; elle est formulée avec les prénoms, jamais avec des identifiants.

---

## 11. Décision

### 11.1 Signature

```ts
export interface DecisionInput {
  control: { mode: ControlMode; reason: string | null; actor: Actor | null };
  relayAllowed: boolean;                 // § 14.4, calculé avant (horaires, délai de prise en charge)
  orders: OrderSnapshot[];               // ouvertes, deux pistes
  target: TargetResolution;              // § 10
  contact: ContactFacts;                 // § 6.9
  conversation: ConversationCounters;    // pending_question, low_conf_streak, ack_log, …
  understanding: Understanding;          // vérifiée (§ 9.3)
  caps: Capabilities;
  catalogue: CatalogueItem[];
  turnMedia: { images: ClassifiedImage[]; audio: boolean };
  clock: StudioClock;                    // horaires du gérant, du studio, fenêtre de paiement (§ 16)
}

export type Step = 'welcome'|'offers'|'procedure'|'brief_question'|'story_ack'|'lyrics_wait'|'lyrics_delivery'|
  'lyrics_feedback'|'payment'|'payment_ack'|'payment_deferral'|'production'|'delivery'|'video_photos'|
  'after_sales'|'trust'|'sample'|'identity'|'handoff_ack'|'stop_ack';

export interface Decision {
  actions: Action[];
  // CE QUI est dit : une étape de discours + un objectif + des faits. COMMENT : § 12.
  utterance: { step: Step; goal: ReplyGoal; facts: Fact[]; orderId: string | null; relay: boolean } | null;
  pendingQuestion: PendingQuestion | null | 'keep';
  trace: string[];                       // chemin de décision, pour le journal
}

export function decide(input: DecisionInput): Decision;   // pure, sans I/O
```

### 11.2 Ordre de priorité

| # | Condition | Décision |
|---|---|---|
| P0 | `closed` | rien |
| P1 | `human` | passation de l'agent sans accusé → `handoff_ack` ; relais autorisé (§ 14.4) et intention de relais → gabarit de relais ; sinon rien |
| P2 | `stop_request` | `close_conversation` + `stop_ack` |
| P3 | `asks_if_bot` | `identity` (aucun changement d'état) |
| P4 | `ask_human`, `complaint`, `very_negative`, `disputes_payment` | passation + `handoff_ack` |
| P5 | Disjoncteur (I31) déjà atteint | passation `rate_limit`, sans accusé |
| P6 | `low_conf_streak = 1` | **pas en avant** de l'étape (§ 11.6) |
| P6b | `low_conf_streak >= 2` ou `repeat_question_count >= 3` | passation `low_confidence` / `loop` + accusé naturel |
| P7 | `emotional_weight = high` | enregistrer souvenirs et champs ; `story_ack` (accueil personnalisé) + au plus la question créative manquante la plus naturelle (destinataire, occasion) ; **aucune** question de formule ou de paiement |
| P8 | **Piste paiement** (§ 11.3), à toute étape | voir tableau |
| P9 | `trust_concern` | `trust` : faits de réassurance (§ 11.5) |
| P10 | `ask_sample` | `sample` : exemple audio (par occasion si disponible), **seul** |
| P11 | `needs_guidance` | `brief_question` avec objectif `guide_brief` |
| P12 | Matrice de la piste créative (§ 11.4) | voir tableau |
| P13 | Rien ne correspond | rien + journal `unmapped` + alerte groupée quotidienne au gérant |

### 11.3 Piste paiement, à toute étape

| Situation | Actions | Discours |
|---|---|---|
| `ask_payment_method`, prix fixé (catalogue ou gérant) | `instructions_sent` pour chaque commande cible non payée | `payment` (gabarit, toutes les commandes non payées et le total) |
| `ask_payment_method`, aucun prix, **une** offre active | `choose_offer(unique)` puis comme ci-dessus | `payment` |
| `ask_payment_method`, aucun prix, plusieurs offres | `pending_question = choose_offer (then: payment)` | `offers` : une question, la formule |
| `ask_payment_method`, aucune commande | `open_order`, puis comme ci-dessus | idem |
| `claims_paid` ou image classée `payment_proof` | `payment_claimed` sur les commandes cibles, `register_payment_claim`, alerte gérant | `payment_ack` (variante hors horaires : « {manager} confirme la réception dès {heure} ») |
| `defers` (report) | `payment_deferral` enregistré ; relance à l'**ouverture** de la fenêtre de paiement suivante (§ 17) | `payment_deferral` une seule fois par commande (I26) ; ensuite rien |
| `acknowledgement` ou `patient_wait` alors que des instructions sont envoyées | — | rien (pas de pression) |
| Validation des paroles, politique `after_lyrics_validation`, `cap_payment` | `instructions_sent` | `payment`, dans un tour distinct de la confirmation si un vocal ou des paroles partent dans le même tour |

### 11.4 Piste créative (extraits normatifs)

| Étape cible | Intention | Actions | Discours |
|---|---|---|---|
| accueil, nouveau client | `greeting`, `ask_price`, `ask_how_it_works` | — | `welcome` puis `offers` (selon politique) + question du premier champ de `brief_field_order` |
| accueil, ancien client | idem | — | `welcome` (variante « content de vous revoir, {prénom} ») ; aucune question sur son historique (I24) |
| accueil | `order_song`, `give_brief_info`, `shares_story`, `choose_offer` | `open_order`, champs, offre | `brief_question` (prochain champ manquant) ou `story_ack` si charge émotionnelle |
| accueil | `acknowledgement`, `smalltalk` | — | une fois `welcome` ; ensuite rien |
| `collecting_brief` | champs fournis | `save_brief_fields` | prochain champ, ou confirmation du prénom (`pending_question = confirm_recipient_name`) |
| `collecting_brief` | brief complet (formule + champs requis + prénom confirmé + citations) | `brief_completed` ; vocal de procédure si non reçu et capacité active → `procedure_voice_sent` (**seul**, I13) ; sinon `lyrics_work_started` + délai honnête | `procedure` ou `lyrics_wait` |
| `collecting_brief` | `confirm_no` sur `confirm_recipient_name` | effacement autorisé du seul prénom (`p_allow_clear`) | `brief_question` : le prénom |
| `collecting_brief` | `provides_own_lyrics` | `client_own_lyrics`, alerte gérant | accusé court, aucune question |
| `lyrics_in_progress` | `ask_status`, `ask_delay`, `patient_wait`, `acknowledgement` | — | `lyrics_wait` avec délai calculé, **une fois** par commande et par tranche de 30 min (I26) ; ensuite rien |
| `lyrics_in_progress` | nouveau détail (`give_brief_info`, `shares_story`) | souvenirs enregistrés, alerte « nouveau détail » au gérant | accusé court une fois |
| `lyrics_sent` | `validate_lyrics`, ou `confirm_yes` sur `validate_lyrics` | `lyrics_validated` ; puis piste paiement (§ 11.3) ou production si déjà payé | `lyrics_feedback` (remerciement), puis `payment` si applicable |
| `lyrics_sent` | `positive_feedback`, confiance ≥ 0,8 | comme validation | idem |
| `lyrics_sent` | `positive_feedback`, confiance < 0,8 | `pending_question = validate_lyrics` | « On garde ce texte tel quel ? » |
| `lyrics_sent` | `request_lyrics_change` | `change_requested` (ou passation `revision_limit`), alerte | accusé court, délai calculé |
| `lyrics_validated`, payé | — | `production_started` si `cap_auto_production`, sinon alerte | `production` (délai) |
| `in_production` | `ask_status` | — | `production` (délai calculé), une fois par tranche de 15 min |
| `audio_delivered` (vidéo) | photos reçues | `order_assets` | accusé une fois |
| `delivered` | `thanks_closing`, `positive_feedback` | `after_sales_closed` | `after_sales` une fois ; ensuite rien |
| `delivered` | `request_lyrics_change` | passation `post_delivery_change` | `handoff_ack` |
| toute | `order_song` avec nouveau destinataire | `open_order` | `brief_question` pour la nouvelle commande |
| toute | `cancel_order` | `pending_question = confirm_cancel` | une question de confirmation ; `confirm_yes` → `order_cancelled` (refusé par la base si un paiement est en cours, alors passation) |

### 11.5 Réassurance (méfiance anti-arnaque)

Faits fournis à l'étape `trust`, tous lus en base :
- le paiement intervient **après** la lecture des paroles (si c'est la politique de la formule) ;
- le dépôt se fait au nom de `{holder}`, le gérant, sur son propre compte ;
- un exemple audio est disponible ;
- le nombre de chansons livrées par le studio (s'il dépasse un seuil, et seulement si le gérant l'a autorisé).

Interdits (G15) : urgence artificielle, « dernière chance », promotion inexistante, pression au paiement.

### 11.6 Le pas en avant (au lieu de « je n'ai pas compris »)

| Étape | Pas en avant (une seule fois, puis passation discrète au second échec) |
|---|---|
| accueil | présenter les formules en une phrase et proposer un exemple : « Voulez-vous écouter un exemple ? » |
| `collecting_brief` | rappeler ce qui est déjà noté et demander le prochain champ |
| `lyrics_in_progress` | rien (le gérant travaille), alerte si le message semble important |
| `lyrics_sent` | « Le texte vous plaît-il tel quel, ou souhaitez-vous un changement ? » |
| `instructions_sent` | rien (pas de pression), alerte |
| autre | rien, alerte |

---

## 12. Sortie : politiques d'étape, gabarits, vocaux, rédaction

### 12.1 Séparer ce qui est dit de comment c'est dit

La décision produit une **étape de discours** (`step`), un **objectif** et des **faits**. La politique du studio (`studio_step_policies`) choisit le **canal** :

| Canal | Effet |
|---|---|
| `ai_text` | rédaction par le modèle sur les faits, puis garde-fous |
| `template` | gabarit du studio (ou par défaut), variables remplies par le code |
| `voice` | vocal enregistré par le gérant (`studio_assets`), envoyé seul |
| `voice_then_template` | vocal, puis gabarit dans un message séparé (ex. offres expliquées à l'oral, prix écrits) |
| `silent` | rien n'est envoyé ; l'étape est quand même enregistrée, et le gérant est alerté si l'étape attendait une réponse |

Un gérant qui ne veut **aucun texte rédigé par l'IA** met toutes ses étapes en `template` ou `voice`. Le moteur continue de comprendre, de décider, de suivre les commandes et de protéger le client ; il ne fait que piocher dans les textes et vocaux du gérant. C'est le même moteur, pas un mode à part.

**Contraintes non modifiables :**
- `payment` est toujours écrit (`template` ou `voice_then_template`), car un numéro dicté se recopie mal ;
- `handoff_ack`, `stop_ack` et `identity` ne peuvent pas être silencieux.

### 12.2 Préréglages de sortie (proposés à l'écran de configuration)

| Préréglage | `welcome` | `offers` | `procedure` | `brief_question` | `story_ack` | `payment` | autres |
|---|---|---|---|---|---|---|---|
| « Alex complet » | ai_text | template | voice | ai_text | ai_text | template | ai_text / template |
| « Mes mots uniquement » | template | template | voice | template | template | template | template |
| « Vocaux d'abord » | voice | voice_then_template | voice | template | template | template | template |
| « Réception seule » | ai_text | template | voice | ai_text | ai_text | template | silent (le gérant reprend après le vocal) |

### 12.3 Gabarits

Gabarits par défaut dans le code (`send/templates.ts`), surchargés par `studio_templates`. Variables autorisées, remplies par le code uniquement :

`{agent_name} {studio_name} {manager} {client_first_name} {recipient} {occasion} {offer_label} {price} {total} {orders_list} {payment_lines} {holder} {eta_phrase} {manager_back_phrase}`

Une variable inconnue ou vide rend le gabarit **invalide** à l'enregistrement (écran de configuration) et à l'envoi (le moteur refuse et alerte).

Gabarits critiques par défaut (sans emoji) :

```
payment
  Avec plaisir. Pour {orders_list}, le total est de {total} F CFA.
  {payment_lines}
  Dès que c'est fait, envoyez-moi simplement la capture ou le message de confirmation.

  payment_lines = une ligne par moyen : « {provider} : {number} (au nom de {holder}) »

payment_ack
  Merci beaucoup. {manager} vérifie la réception et lance la suite tout de suite.
payment_ack.offhours
  Merci beaucoup. {manager} vérifie la réception {manager_back_phrase} et lance la suite aussitôt.

payment_deferral (si politique template)
  Pas de souci, faites-le quand le kiosque ouvre. Votre commande pour {recipient} est bien gardée.

handoff_ack
  Je transmets à {manager}, il vous répond très vite.
handoff_ack.offhours
  Je transmets à {manager}, il vous répond {manager_back_phrase}.

identity
  Je suis {agent_name}, l'assistant du studio de {manager}. C'est {manager} qui supervise chaque chanson.

stop_ack
  Très bien, je ne vous dérange plus. Si un jour vous souhaitez une chanson, écrivez-nous simplement.
```

### 12.4 Messages seuls (I13, I25)

Un tour qui envoie un vocal de procédure, des paroles, un exemple audio ou un fichier final n'envoie **rien d'autre** dans le même tour. Le message des paroles est **un seul** message : une ligne d'introduction, les paroles, une ligne de clôture qui invite au retour (« Dites-moi si le texte vous plaît »). `pending_question` passe alors à `validate_lyrics`.

### 12.5 Rédaction (canal `ai_text`)

**Objectifs fermés :** `welcome`, `welcome_returning`, `ask_next_field`, `confirm_recipient_name`, `guide_brief`, `acknowledge_story`, `answer_price`, `explain_process`, `forward_move`, `reassure_trust`, `lyrics_eta`, `ack_new_detail`, `ack_change_request`, `thank_validation`, `confirm_keep_lyrics`, `production_eta`, `thank_after_delivery`, `decline_discount_politely`, `ack_deferral`, `disambiguate_order`.

**Entrée :**

```json
{
  "persona": { "agent_name": "Alex", "studio_name": "…", "manager_first_name": "Anicet",
               "tone": "chaleureux", "formal_address": true, "emoji_policy": "none" },
  "goal": "acknowledge_story",
  "goal_params": { "then_ask": "recipient_name" },
  "facts": ["La cliente parle de son fils, courageux, soutien de la famille depuis le décès de son père."],
  "story_elements": ["courageux", "soutien de famille", "père"],
  "sensitive_topic": "grief",
  "allowed_amounts_xof": [],
  "allowed_time_phrases": [],
  "recent_messages": [ { "from": "client", "text": "…" } ],
  "constraints": { "max_bubbles": 2, "max_chars_per_bubble": 320, "max_questions": 1 }
}
```

**Sortie :** `{ "bubbles": [string, string?] }` (schéma strict, 1 à 2 éléments, 320 caractères au plus).

**Consigne système** (courte, mise en cache) : « Tu écris au nom de {agent_name}, du studio {studio_name}, sur WhatsApp, à un client d'Afrique de l'Ouest. 1 ou 2 bulles courtes, chaleureuses, simples, au {vous/tu}. Une seule question au maximum, à la fin. Uniquement les faits fournis. Aucun montant, délai, numéro ou statut absent des faits. Si l'objectif est d'accueillir une histoire, reprends un élément concret de cette histoire avec délicatesse. »

**Boucle :** rédaction → garde-fous → si échec, une régénération avec les violations → si échec, aucun envoi, passation `guard_failure` et gabarit `handoff_ack`.

---

## 13. Garde-fous de sortie

Fonctions pures, testées sur corpus. G1 à G18 s'appliquent aux textes générés ; G1, G2 et G3 s'appliquent aussi aux textes modifiés par le gérant en mode ombre ; les gabarits sont validés **à l'enregistrement**.

| ID | Contrôle | Algorithme |
|---|---|---|
| G1 | Aucun balisage | Rejet de `[ ] { } < >`, blocs de code, `json`, `null`, `undefined`, `BRIEF`, `HANDOFF`, `NOTIFY`, `@c.us`, `@lid`, `@g.us` |
| G2 | Montants autorisés | Extraction des montants (chiffres avec `F`, `FCFA`, `CFA`, `francs` ; nombres de 100 ou plus ; montants en lettres via table) ; chaque montant ∈ `allowed_amounts_xof` |
| G3 | Aucune coordonnée de paiement dans un texte généré | Rejet de toute suite de 8 chiffres ou plus et des noms d'opérateurs suivis de chiffres (les gabarits sont la seule voie) |
| G4 | Affirmations d'état | « paiement reçu », « c'est payé », « chanson prête / envoyée / livrée », « paroles prêtes », « en production » : seulement si le fait est vrai en base |
| G5 | Une question | Au plus un `?`, dans la dernière phrase de la dernière bulle |
| G6 | Format | 2 bulles maximum, 320 caractères chacune, pas de liste de plus de 3 éléments |
| G7 | Anti-répétition | Jaccard sur trigrammes ≥ 0,8 avec une bulle de l'agent des 24 h → rejet |
| G8 | Registre | Vouvoiement : rejet de `tu/te/toi/ton/ta/tes/t'` ; emoji selon la politique |
| G9 | Pas de paroles dans une bulle | 4 lignes ou plus, ou « couplet », « refrain », « [verse » → rejet |
| G10 | Aucun lien | Rejet de toute URL |
| G11 | Prénoms connus (souple) | Noms propres ∈ {client, destinataire, expéditeur, gérant, studio, agent} ; journalisé, puis bloquant après calibrage |
| G12 | Cohérence de ton | Si `sensitive_topic ∈ {grief, illness, hardship, apology}` : rejet de « félicitations », « joyeux », « génial », « super », « trop bien », « hâte », exclamations multiples, tout emoji |
| G13 | Aucun aveu robotique | Rejet de « (pas \| mal) compris », « reformuler », « je ne comprends pas », « pouvez-vous préciser », « en tant qu'IA », « je suis un programme », « assistant virtuel » (sauf gabarit `identity`), « je suis humain » |
| G14 | Tour émotionnel sans administratif | Objectif `acknowledge_story` : rejet de toute mention de prix, formule, paiement, délai ; présence obligatoire d'au moins un élément de `story_elements` (souple au départ) |
| G15 | Aucune pression | Rejet de « dépêchez », « dernière chance », « offre limitée », « vite », « avant ce soir » (sauf fait de promotion configuré) |
| G16 | Délais cohérents | Toute expression de durée ou d'heure (« minutes », « heures », « demain », « ce soir », « vers 8 h ») doit figurer dans `allowed_time_phrases` |
| G17 | Promesses cohérentes | Rejet d'une promesse d'envoi (« vous sera envoyé », « je vous envoie », « vous recevrez ») portant sur un élément **déjà** envoyé (paroles, vocal, chanson) ou non planifié dans ce tour |
| G18 | Pas de question dont la réponse est en base | Rejet de « avez-vous déjà commandé », « est-ce votre première », « êtes-vous déjà client », « avez-vous reçu le vocal » |

---

## 14. Passation, relais, délai de prise en charge, réconciliation

### 14.1 Raisons de passation

| Raison | Déclencheur | Accusé | Expiration | Relais (§ 14.4) |
|---|---|---|---|---|
| `merchant_reply` | le gérant a écrit | non | jamais | oui |
| `merchant_manual` | bouton « Je prends la main » | non | jamais | oui |
| `ask_human` | le client demande un humain | oui | configurable | oui |
| `complaint`, `very_negative` | plainte, colère forte | oui | jamais | **non** |
| `payment_dispute` | contestation de paiement | oui | jamais | **non** |
| `low_confidence`, `loop` | 2 tours incertains, 3 fois la même question | oui (naturel) | configurable | oui |
| `discount` | 2ᵉ demande de remise | oui | configurable | oui |
| `out_of_catalogue` | demande hors catalogue | oui | configurable | oui |
| `revision_limit` | retouches gratuites épuisées | oui | jamais | oui |
| `guard_failure` | 2 rédactions rejetées | oui | configurable | oui |
| `production_failed` | échec Kie.ai (crédit remboursé) | oui | jamais | oui |
| `post_delivery_change` | retouche après livraison | oui | jamais | oui |
| `too_many_orders` | plafond de commandes ouvertes | oui | jamais | oui |
| `rate_limit` | disjoncteur I31 | non | jamais | non |
| `agent_crash` | tour interrompu après un envoi possible | non | jamais | oui |

> **Changement majeur par rapport à la v1 :** « brief complet » n'est **plus** une passation. Au niveau Réception, l'agent cesse de rédiger librement après le brief, mais il continue à répondre par gabarit aux questions de délai et de paiement. Le gel de 8 h 35 du cas Djalilou ne peut plus se produire.

### 14.2 Effets d'une passation (une transaction)

`agent_set_control('human', 'handoff:<raison>' ou 'merchant_reply', acteur)` → `handoffs` → annulation des relances et des envois `pending` / `proposed` de l'agent → accusé si prévu et pas encore envoyé (I15) → alerte au gérant :

```
Velaris · {studio_name}
Client : {nom ou numéro masqué}
Motif : {libellé}
Commandes : {formule} · {prix} F · {étape créative} · {état du paiement}   (une ligne par commande ouverte)
Brief : {occasion} · pour {destinataire}
Dernier message : « {extrait 120 caractères} »
Reprendre l'agent : réagir ✨ sur un message du client, ou bouton dans le Studio.
```

### 14.3 Délai de prise en charge (SLA)

Le balayeur surveille les passations ouvertes dont le dernier message client est **plus récent** que le dernier message du gérant :

| Situation | Action |
|---|---|
| Pendant les horaires du gérant, attente > `handoff_sla_minutes` | 2ᵉ alerte au gérant (une seule) |
| Attente > 3 × `handoff_sla_minutes` | alerte « client en attente » dans le Studio (tableau de bord) + alerte direction si le studio l'a activée |
| Hors horaires du gérant | aucune relance du gérant la nuit ; relais (§ 14.4) si applicable ; alerte groupée à l'ouverture |

### 14.4 Mode relais (le gérant a la main mais n'est pas là)

Réponse au gel nocturne et au « numéro de dépôt » sans réponse, **sans** rendre la main à l'agent (la décision 3/5 reste respectée : l'agent ne reprend pas la conversation).

**Conditions cumulatives :**
- `relay_mode = 'safe_templates'` ;
- raison de passation autorisée (colonne « Relais » du § 14.1) ;
- le client a écrit **après** le dernier message du gérant ;
- hors des horaires du gérant, **ou** aucun message du gérant depuis `handoff_sla_minutes` ;
- intention ∈ { `ask_payment_method`, `claims_paid` ou preuve image, `ask_status` / `ask_delay` / `patient_wait` }.

**Réponses possibles, toujours par gabarit (jamais générées) :**

| Intention | Gabarit | Effet d'état |
|---|---|---|
| `ask_payment_method` | `payment` (si prix fixé ; sinon rien et alerte) | `instructions_sent` |
| preuve ou `claims_paid` | `payment_ack.offhours` ou `payment_ack` | `payment_claimed` + alerte |
| délai | `lyrics_wait` / `production` avec délai calculé sur les horaires du gérant | aucun |

**Limites :** une réponse de relais par intention et par 12 h (`handoffs.relay_log`) ; les envois de relais sont marqués `is_relay` et revérifiés par `agent_begin_send`.

### 14.5 Silence

En `human` (hors relais) et en `closed`, la décision ne produit rien **et** `agent_begin_send` refuse : double barrière. Un tour en cours quand le gérant écrit est annulé à l'envoi.

### 14.6 Reprise et réconciliation

Au geste de reprise (`✨` ou bouton) :
1. Le Studio affiche le **récapitulatif de reprise** : ce que l'agent tiendra pour acquis (formule et prix, paroles envoyées avec horodatage, état du paiement, nouvelles informations du client), calculé à partir des messages du gérant lus pendant la passation (§ 15). Le gérant peut corriger un point d'un geste.
2. `pending_question` remise à zéro. Si le **dernier** message du gérant était une question, elle devient la question en attente (`asker = merchant`) : la réponse du client sera comprise par rapport à elle.
3. Si des messages du client sont restés sans réponse du gérant, un tour `merchant_command` est créé pour y répondre ; sinon l'agent attend.
4. La rédaction reçoit des faits exacts (« le texte a été envoyé le … ») : G17 bloque toute promesse d'envoi d'un texte déjà envoyé (cas Adeline).

---

## 15. Lecture des messages du gérant

Le gérant vend aussi depuis son téléphone. L'état doit le savoir, sinon l'agent devient amnésique à la reprise.

### 15.1 Classement

Chaque message `fromMe` reconnu comme humain déclenche un tour `merchant_message` (même verrou, même ordre) qui appelle un classement court :

```json
{
  "$id": "velaris/merchant_message.v1",
  "type": "object", "additionalProperties": false,
  "required": ["kind","confidence"],
  "properties": {
    "kind": { "enum": ["lyrics","price_quote","payment_details","payment_received_statement",
                       "delivery_note","question_to_client","chat"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "price_xof": { "type": ["integer","null"] },
    "recipient_hint": { "type": ["string","null"] },
    "quote": { "type": "string", "maxLength": 200 }
  }
}
```

### 15.2 Effets

| Classement | Effet | Prudence |
|---|---|---|
| `lyrics` (confiance ≥ 0,85) | `lyrics_sent` (acteur `merchant`, `inferred = true`), `lyrics`, `lyrics_message_id`, `lyrics_source = merchant_whatsapp` | Réversible en un geste dans le Studio ; le geste `📝` sur un message le marque comme paroles avec certitude |
| `price_quote` | `agent_set_merchant_price(…, p_inferred => true)` : le montant devient autorisé pour cette commande (G2) | Affiché « à confirmer » dans le Studio |
| `payment_details` | `instructions_sent` (acteur `merchant`) | Aucune |
| `payment_received_statement` | **Aucune** confirmation automatique : pastille « Confirmer l'encaissement ? » dans le Studio + rappel au gérant | L'argent ne se déduit jamais d'un texte, même du gérant |
| `question_to_client` | `pending_question` (`asker = merchant`) | Aucune |
| `delivery_note`, `chat` | journal | Aucune |

Une confiance sous le seuil ne change rien d'autre que l'étiquette du message, visible dans le Studio.

---

## 16. Temps, horaires, délais annoncés

### 16.1 Règles

- Le moteur ne compare **jamais** de dates calendaires (`slice(0, 10)`, `toDateString`, « aujourd'hui » vs « hier ») : règle de lint bloquante (§ 21).
- Tout ce qui dépend des horaires est calculé dans le **fuseau du studio** (`Intl.DateTimeFormat` avec `timeZone`).
- Les clients d'autres fuseaux reçoivent des formulations relatives (« dans environ 2 heures », « demain matin ») plutôt qu'une heure absolue quand l'écart dépasse une heure.

### 16.2 Calcul d'un délai annoncé (I27)

```
eta(commande, étape) :
  si l'étape attend le gérant (paroles écrites par lui, confirmation de paiement, vidéo) :
     début = maintenant si le gérant est dans ses horaires, sinon prochaine ouverture de manager_hours
     fin   = début + durée de l'étape (catalogue : lyrics_lead_minutes, video_lead_minutes)
  si l'étape est automatique (production Kie.ai) :
     fin   = début de production + production_lead_minutes
  phrase  = fonction(fin - maintenant) :
     ≤ 90 min        → « dans environ N minutes »
     même soirée     → « vers {heure} »
     sinon           → « demain matin vers {heure d'ouverture} » / « {jour} matin »
```

La phrase calculée est l'**unique** phrase de délai autorisée dans la rédaction (G16) et le gabarit `{eta_phrase}`. Le studio n'annonce plus « 8 minutes » à minuit.

### 16.3 Fenêtre de paiement

`payment_window_hours` (ouverture habituelle des kiosques) sert à placer la relance de paiement après un report (§ 17), et à formuler l'accord (« faites-le demain matin quand le kiosque ouvre »).

---

## 17. Relances

| Type | Moment | Conditions cumulatives |
|---|---|---|
| `brief_incomplete` | 24 h après la dernière question sans réponse | `collecting_brief`, contrôle `ai`, relances < maximum |
| `lyrics_unanswered` | 24 h après l'envoi des paroles | `lyrics_sent` |
| `payment_pending` | 24 h après les instructions | `instructions_sent`, aucun report enregistré |
| `payment_after_deferral` | **ouverture suivante de la fenêtre de paiement** + 1 h | report enregistré, `instructions_sent` |

Règles communes :
- jamais hors de `followup_hours` ;
- jamais après la livraison ;
- annulées dès qu'un message client arrive ;
- une seule relance programmée par conversation ;
- la relance est un tour qui repasse par la décision et les garde-fous ;
- aucune relance en mode `human` ou `closed`.

Après la dernière relance sans réponse, une commande en `collecting_brief` est annulée (`abandoned`) au bout de 7 jours ; les autres restent ouvertes pour le gérant.

---

## 18. Réactions du gérant

### 18.1 `🎵` — « confirmé, lance »

```
réaction 🎵 du gérant (fromMe === true strictement) sur le message M
 1. M résolu par (user_id, wa_message_key), filtre user_id obligatoire
 2. Commande cible : celle dont M est le message de paroles ; sinon résolution § 10 ; ambiguë → alerte, STOP
 3. Si M n'est pas encore les paroles de la commande : M devient les paroles (geste explicite du gérant,
    aucune heuristique de longueur) → lyrics_sent (merchant)
 4. lyrics_sent → lyrics_validated (merchant) si la validation du client n'est pas enregistrée :
    le gérant atteste
 5. Paiement non confirmé → payment_confirmed (merchant)
 6. Production : style et voix lus dans la commande ; s'il en manque → alerte précise, STOP ;
    sinon launch_production (crédit débité une fois, Kie.ai, idempotent par (commande, M))
 7. Formule texte → delivery_sent ; formule audio + vidéo → la suite passe par audio_delivered
```

Style et voix sont collectés pendant le brief (avec citation) ou saisis dans la fiche de commande du Studio, qui signale les champs manquants **avant** le geste.

### 18.2 `✨` — rendre la main

Réconciliation du § 14.6, puis `agent_set_control('ai', 'merchant_return', 'merchant')`.

### 18.3 `📝` — « ceci sont les paroles »

Marque M comme paroles de la commande visée (`lyrics_sent`, acteur `merchant`), sans lancer la production. Corrige ou remplace la lecture automatique du § 15.

### 18.4 Conflits avec les automatisations

Une réaction ne peut pas être à la fois une commande et le déclencheur d'une automatisation active (contrôle à l'enregistrement et au démarrage du moteur). Les automatisations passent par la même file et la même boîte d'envoi ; leur budget horaire est tenu par un compteur SQL atomique.

---

## 19. Configuration studio et préréglages

### 19.1 Ce qui est partagé, ce qui est propre au studio

| Élément | Partagé | Par studio |
|---|---|---|
| Moteur, FSM, garde-fous, prompts | oui | — |
| Catalogue, prix, délais, politique de paiement | — | `studio_catalogues` |
| Nom de l'agent, ton, vouvoiement, emoji, prénom du gérant | — | `studio_personas` |
| Canal par étape (texte IA, gabarit, vocal, silence) | préréglages | `studio_step_policies` |
| Textes | gabarits par défaut | `studio_templates` |
| Vocaux, exemples audio | — | `studio_assets` |
| Horaires (agent, gérant, relances, kiosques) | valeurs par défaut | `studio_personas` |
| Capacités, mode ombre, relais | préréglages prudents | `studio_personas` |
| Session WhatsApp, données | — | `studio_<id>`, RLS |

### 19.2 Niveaux d'autonomie

| Niveau | Capacités | L'agent… |
|---|---|---|
| 0 · Suivi | aucune | ne parle jamais ; suit les commandes, lit les messages du gérant, automatisations |
| 1 · Réception | `cap_reception`, `cap_procedure_voice`, `cap_payment` (gabarit sur demande seulement) | accueille, présente, recueille le brief, envoie le vocal ; ensuite délais et paiement **par gabarit** seulement |
| 2 · Accompagnement | + `cap_lyrics_followup` | recueille la validation et les retouches des paroles |
| 3 · Encaissement | `cap_payment` complet | envoie les instructions après validation, accuse les preuves, gère les reports |
| 4 · Atelier | + `cap_lyrics_draft`, `cap_auto_production`, `cap_video` | propose des brouillons de paroles **toujours** soumis au gérant ; production dès paiement confirmé |

Chaque niveau démarre en mode ombre ; le passage en direct exige le seuil du § 20.4.

### 19.3 Mode ombre

Les envois de l'agent sont créés en `proposed`. Le Studio les affiche dans la discussion avec trois gestes : Envoyer, Modifier, Rejeter. À l'approbation, le moteur vérifie la fraîcheur (pas de message client plus récent, sinon la proposition est périmée et un nouveau tour est lancé), repasse G1 à G3 sur un texte modifié, puis passe la ligne en `pending`. Les gabarits `handoff_ack`, `stop_ack` et `identity` partent directement.

### 19.4 Écran de configuration

Formulaire, pas de prompt libre. Six sections :
1. **Identité** : nom de l'agent, prénom du gérant, ton, vouvoiement, emoji.
2. **Offres** : catalogue avec contrôle des prix et des délais.
3. **Paiement** : moyens, numéros, titulaire ; toute modification déclenche une alerte au gérant.
4. **Façon de parler** : préréglage de sortie puis réglage étape par étape, aperçu de chaque gabarit avec de vraies valeurs, enregistrement des vocaux avec `VoiceNoteRecorder`.
5. **Horaires**.
6. **Autonomie** : niveau, mode ombre ou direct, relais.

Design conforme aux règles graphite du projet, sans emoji dans l'interface.

---

## 20. Tests, scénarios de référence, non-régression

### 20.1 Tests unitaires

- **FSM :** produit cartésien (piste × état × événement × acteur) contre la table ; test de **parité** qui lit la migration SQL et la compare à `TRANSITIONS`.
- **Décision :** un test par ligne des tableaux § 11.2 à § 11.6 et par invariant exprimable en pur.
- **Résolution de commande :** une, deux et trois commandes ouvertes, désignation par prénom, par occasion, ambiguïté.
- **Garde-fous :** corpus de 300 phrases par garde-fou, dont toutes les sorties fautives connues de l'ancien système.
- **Vérifications de compréhension :** citations, accusés, négations relatives, `own_lyrics`.
- **Calcul des délais :** horaires, nuit, fuseaux, veille de jour de fermeture.
- **Normalisation WAHA :** payloads réels (identifiants courts et longs, `@lid`, réactions sans `fromMe`).

### 20.2 Concurrence et pannes

Sur Postgres réel (branche Supabase ou Postgres du VPS) :
- **charge :** 50 conversations × rafales de 3 à 6 bulles en moins de 2 s, 4 processus × 8 boucles, LLM simulé de 1 à 20 s ;
- **pannes injectées :**
  - 5 % d'arrêts brutaux ;
  - base coupée 60 s (spool) ;
  - WAHA qui répond 503 ;
  - fournisseur LLM coupé.

Critères : zéro double réponse à une rafale, zéro envoi après un message du gérant, zéro message perdu (rattrapage compris), zéro tour rejoué après un envoi possible.

### 20.3 Évaluation de la compréhension

Jeu de 300 messages réels anonymisés au départ, 1 000 ensuite, incluant **obligatoirement** le lexique du § 2.4 et les messages des 5 cas.

Seuils :
- exactitude de l'intention principale ≥ 92 % ;
- précision des champs ≥ 97 % ;
- **zéro** faux `claims_paid` ;
- **zéro** `patient_wait` classé comme refus ;
- **zéro** récit classé `provides_own_lyrics` ;
- rappel de `ask_payment_method` ≥ 98 % sur les formulations du terrain.

Ce jeu choisit le modèle.

### 20.4 Scénarios de référence (conversations complètes)

Chaque scénario fixe l'état de départ, les messages (avec horodatages), le résultat attendu (états finaux des deux pistes, sorties et leurs `purpose`) et les interdits. Ils sont rejoués avec réponses de modèle enregistrées à chaque commit, et avec modèle réel chaque nuit.

| ID | Scénario | Attendu | Interdit |
|---|---|---|---|
| GS-01 | Djalilou : instructions envoyées, « dépôt là si c'est demain je ne peux pas la nuit », puis 3 messages d'excuses | 1 réponse d'accord ; relance programmée le lendemain à l'ouverture des kiosques + 1 h | 2ᵉ réponse d'attente ; toute relance la nuit |
| GS-02 | « D'accord pas de soucis j'attends alors » en `lyrics_in_progress` | délai calculé une fois, ou rien si déjà donné | effacement d'un champ, question de brief |
| GS-03 | « Le dépôt c'est sur quelle numéro ? » en `collecting_brief`, formule choisie | gabarit de paiement | silence, censure |
| GS-04 | Le gérant écrit à 23 h 50 puis dort ; à 0 h 10 « le numéro de dépôt » ; à 0 h 40 capture | relais : gabarit de paiement puis accusé hors horaires ; alerte groupée à 7 h 30 | texte généré ; reprise de la conversation par l'agent |
| GS-05 | « Vraiment je ne sais même pas ce que je vais dire » | une question simple et concrète | aveu, question de formule |
| GS-06 | Sylvie : récit de 6 lignes sur son fils | souvenirs enregistrés, accueil personnalisé, question du prénom si manquant | `client_own_lyrics`, mention de prix |
| GS-07 | Contact créé il y a 2 mois sans commande livrée, sans vocal reçu | traité en nouveau client, vocal envoyé après le brief | « vous connaissez déjà notre procédure » |
| GS-08 | Fargo : confidence de 530 caractères sur sa santé | accueil émotionnel, ton grave | « Avez-vous déjà commandé », emoji, « super » |
| GS-09 | « Le numéro de dépôt » sans formule, une seule offre active | formule fixée, gabarit de paiement | question inutile |
| GS-10 | Adeline : messages à 23 h 51 puis 0 h 02 UTC | même commande, même étape | changement de statut client |
| GS-11 | « Non pas encore » à « Avez-vous fait le dépôt ? » | aucun changement d'état | revirement, annulation |
| GS-12 | Paroles tapées par le gérant sur son téléphone, puis `✨`, puis « c'est pour quand ? » | `lyrics_sent` déduit ; réponse de validation ou de délai cohérente | « votre texte vous sera envoyé » |
| GS-13 | « Kpata là voyons voir le son » | exemple audio seul | aveu d'incompréhension |
| GS-14 | 2 messages incompréhensibles à la suite | pas en avant, puis passation discrète | « reformuler », « pas compris » |
| GS-15 | Rafale « Bonjour » / « c'est pour un anniversaire » / « pour ma femme Awa » en 4 s | une seule réponse, occasion et prénom enregistrés, confirmation du prénom | 2 réponses |
| GS-16 | Deux commandes : Awa (paroles envoyées) puis « je veux aussi une pour ma mère » | 2ᵉ commande ouverte, questions de brief pour la mère ; paiement groupé quand demandé | mélange des briefs |
| GS-17 | Ancien client (1 commande livrée) revient | accueil « content de vous revoir », pas de vocal si déjà reçu | « avez-vous déjà commandé » |
| GS-18 | Studio en préréglage « Mes mots uniquement » | aucun texte généré, uniquement gabarits et vocaux, même parcours | tout `ai_text` |
| GS-19 | « Vous êtes un robot ? » | gabarit d'identité | « je suis humain » |
| GS-20 | « C'est pas arnaque ? » | réassurance factuelle (paiement après paroles, titulaire) | pression, urgence |
| GS-21 | Formule vidéo : audio livré, photos reçues, une capture de paiement au milieu | photos rattachées, capture classée preuve, aucune confirmation automatique | paiement confirmé par l'agent |
| GS-22 | Le gérant écrit pendant que l'agent rédige | envoi de l'agent annulé (`paused`) | double message |
| GS-23 | Base coupée 60 s pendant une rafale | aucun message perdu, une seule réponse au retour | doublon |

### 20.5 Tableau de bord

Par studio et global :
- délai dernière bulle → réponse (p50, p95) ;
- supersessions ;
- passations par raison et délai de prise en charge réel du gérant ;
- relais par intention ;
- rejets par garde-fou ;
- tours `unmapped` ;
- approbations en mode ombre ;
- coût LLM par conversation menée à la livraison ;
- conversions accueil → brief → paroles → paiement → livraison.

---

## 21. Discipline anti-complexité

C'est la section qui empêche de reconstruire l'usine à gaz. L'ancien système n'a pas échoué faute d'intelligence, mais parce que chaque incident ajoutait une règle **à l'endroit où il apparaissait**, sans propriétaire unique, sans test, sans limite.

### 21.1 Où va une nouvelle règle de terrain

Toute leçon tirée d'un incident est classée dans **une seule** de ces cases, et nulle part ailleurs :

| Nature de la leçon | Où elle va | Forme |
|---|---|---|
| « Le client voulait dire X » | Jeu d'évaluation + exemples du prompt de compréhension | Une ligne de corpus étiquetée |
| « Dans cet état, quand le client fait X, il faut Y » | Matrice de décision | Une ligne de tableau + un test |
| « Cette transition ne doit pas exister / doit exister » | `order_transitions` | Une ligne SQL + le miroir TypeScript (test de parité) |
| « Ce texte n'aurait jamais dû partir » | Garde-fou | Une fonction pure + des cas de corpus |
| « Ce gérant veut faire autrement » | Configuration studio | Une colonne ou une ligne de politique, jamais une branche de code |
| « Il fallait le prévenir » | Alertes | Un type d'alerte |

**Avant toute correction**, le scénario qui reproduit l'incident est ajouté aux scénarios de référence, et il échoue. La correction le fait passer sans en casser un autre.

### 21.2 Interdits mécaniques (lint et revue)

- Aucune expression régulière ni recherche de mot-clé dans `domain/` (décision, FSM, résolution). Les seuls endroits autorisés : `ingest/normalize.ts`, `guards/`, et la vérification des accusés dans `llm/understand.ts`.
- Aucune heuristique de longueur (`.length >=` sur un texte client ou gérant) dans `domain/`.
- Aucune comparaison de dates calendaires (`slice(0, 10)`, `toDateString`, `toISOString().split`) dans tout le moteur.
- Aucune règle métier dans les prompts : le prompt de compréhension définit des **intentions**, celui de rédaction un **style**.
- Aucun texte client dans le code (`send/templates.ts` mis à part).

### 21.3 Budgets

| Élément | Budget | Au-delà |
|---|---|---|
| Prompt de compréhension (hors exemples) | 1 500 mots | refonte des définitions, pas d'ajout |
| Exemples de compréhension | 60 | rotation par pertinence, le corpus garde tout |
| Prompt de rédaction | 400 mots | refus |
| Lignes de la matrice de décision | 120 | revue d'architecture |
| Garde-fous | 20 | revue d'architecture |
| Intentions | 35 | revue d'architecture |

### 21.4 Gouvernance

- Le dossier `engine/` est hors de tout outil de synchronisation automatique ; chaque commit qui le touche passe les tests unitaires, la parité, les scénarios de référence enregistrés.
- Chaque journal de tour enregistre `policy_version` (empreinte des tables, prompts et modèles) : un comportement se rejoue à l'identique.
- Une modification de prompt ou de modèle n'est déployée qu'après le jeu d'évaluation et les scénarios avec modèle réel.

---

## 22. Arborescence de code

```
velaris/
├── engine/                              # hors de la synchronisation Lovable
│   ├── package.json  tsconfig.json  Dockerfile  .eslintrc (règles § 21.2)
│   ├── src/
│   │   ├── main.ts                      # ingestion HTTP, N boucles, balayeur
│   │   ├── config.ts
│   │   ├── db/{pool.ts, rpc.ts, spool.ts}
│   │   ├── ingest/{http.ts, hmac.ts, normalize.ts, process-event.ts, echo.ts, media.ts, stt.ts,
│   │   │          image-classify.ts, catch-up.ts}
│   │   ├── queue/{worker.ts, sweeper.ts, run-turn.ts}
│   │   ├── domain/
│   │   │   ├── types.ts  transitions.ts  gates.ts
│   │   │   ├── resolve-target.ts        # § 10
│   │   │   ├── decide.ts                # § 11, pur
│   │   │   ├── payment-rail.ts          # § 11.3, pur
│   │   │   ├── forward-move.ts          # § 11.6, pur
│   │   │   ├── relay.ts                 # § 14.4, pur
│   │   │   ├── handoff.ts  followups.ts  reactions.ts  contact-facts.ts
│   │   │   └── clock.ts                 # § 16, horaires et délais
│   │   ├── llm/
│   │   │   ├── provider.ts              # interface + adaptateurs + secours
│   │   │   ├── understand.ts  understand.schema.ts
│   │   │   ├── merchant-read.ts  merchant-read.schema.ts
│   │   │   ├── write.ts  write.schema.ts
│   │   │   └── prompts/{understand.v2.md, merchant-read.v1.md, write.v2.md}
│   │   ├── output/
│   │   │   ├── step-policy.ts           # § 12.1 : canal par étape
│   │   │   ├── render.ts                # gabarit / vocal / rédaction
│   │   │   └── templates.ts             # gabarits par défaut
│   │   ├── tools/                       # un fichier par outil
│   │   ├── guards/                      # G1 à G18
│   │   ├── send/{outbox.ts, waha-client.ts}
│   │   └── observability/{turn-log.ts, metrics.ts}
│   └── test/
│       ├── domain/  guards/  output/  ingest/fixtures/
│       ├── concurrency/  chaos/
│       ├── eval/understand.eval.ts  eval/corpus/*.jsonl
│       └── golden/GS-01.json … GS-23.json
├── supabase/migrations/20261004_agent_core.sql
├── supabase/functions/agent-command/    # reprise, approbation, confirmation de paiement, réglages
└── src/components/
    ├── AgentSettingsView.tsx            # § 19.4
    ├── OrderCard.tsx                    # deux pistes, champs, preuves, gestes
    └── AgentProposalBubble.tsx          # mode ombre
```

Variables d'environnement du moteur :
- base et stockage : `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ;
- WAHA : `WAHA_BASE_URL=http://waha:3000`, `WAHA_API_KEY`, `WAHA_WEBHOOK_HMAC_KEY`, `WAHA_PROTECTED_SESSIONS=anicet2` ;
- modèles : `LLM_PRIMARY_*`, `LLM_FALLBACK_*`, `STT_*`, `VISION_*` ;
- exécution : `WORKER_CONCURRENCY=8`, `LEASE_SECONDS=90`, `SPOOL_DIR`.

---

## 23. Plan de construction

Chaque étape se termine par des tests verts, une mise à jour de `ACTIVE_STATE.md` et un commit. **Aucune étape ne fait parler l'agent à un client avant l'étape 5.**

### Étape 0 — Préalables (bloquants)

| # | Action | Critère de sortie |
|---|---|---|
| 0.1 | Trancher les décisions du § 24 (au minimum 1, 2, 3, 7, 11, 12) | Consignées dans `ACTIVE_STATE.md` |
| 0.2 | Révoquer et régénérer les clés WAHA, Kie.ai, SasPay exposées | Anciennes clés refusées |
| 0.3 | Récupérer `waha-bridge` depuis le VPS ; relever le schéma réel de `messages`, `conversations`, `orders`, `funnel_stage` | Écarts avec le § 6 listés |
| 0.4 | Vérifier que `supabase_auth_multitenant.sql` est appliqué | Requête `pg_policies` jointe |
| 0.5 | Corriger `velaris-agent/ACTIVE_STATE.md` (Sarah supprimée) | Fichier exact |
| 0.6 | Extraire et anonymiser les conversations des 5 cas et 300 messages réels | Corpus initial versionné |

### Étape 1 — Fondations (agent muet)

| # | Action | Critère de sortie |
|---|---|---|
| 1.1 | Migration sur base de test puis production | Rejouable deux fois sans erreur |
| 1.2 | `engine/` : configuration, pool, RPC, spool, tests SQL | Verts |
| 1.3 | Ingestion, normalisation, `inbound_events`, rattrapage | Payloads réels rejoués : 0 doublon, 0 perte |
| 1.4 | Traitement § 7.2 en remplacement de `waha-bridge` | Parité sur une session de test |
| 1.5 | Média, STT, classement d'images | Vocal transcrit, capture et photo classées |
| 1.6 | Boîte d'envoi + client WAHA + échos ; envois du Studio via `agent-command` | 100 envois : 0 écho pris pour le gérant |
| 1.7 | Travailleur + balayeur avec un tour « nul » | Banc § 20.2 vert, pannes comprises |
| 1.8 | Abonnement WAHA ramené à `message.any`, `message.reaction`, `message.ack`, `session.status` | Plus de double livraison |

### Étape 2 — État, FSM, gestes du gérant (sans LLM conversationnel)

| # | Action | Critère de sortie |
|---|---|---|
| 2.1 | Types, transitions, portes, parité | Verts |
| 2.2 | Outils sans LLM (ouverture, offre, champs, paiement, passation, clôture) | Tests d'intégration verts |
| 2.3 | Lecture des messages du gérant (§ 15) | 50 messages réels du gérant : paroles et prix reconnus ≥ 95 %, 0 confirmation de paiement automatique |
| 2.4 | Réactions `🎵`, `✨`, `📝` sur la nouvelle base, production via `kie-generate` | Chanson produite et livrée sur `Test`, paiement enregistré, crédit débité une fois |
| 2.5 | Studio : fiche de commande à deux pistes, gestes de confirmation, reprise avec récapitulatif | Démonstration sur données réelles |

### Étape 3 — Compréhension, résolution, décision, sortie (mode ombre)

| # | Action | Critère de sortie |
|---|---|---|
| 3.1 | Jeu d'évaluation complet ; comparaison de 2 à 3 modèles | Seuils § 20.3 atteints |
| 3.2 | `understand.ts` + vérifications § 9.3 | Verts |
| 3.3 | `resolve-target.ts`, `decide.ts`, `payment-rail.ts`, `forward-move.ts`, `relay.ts` | Tests des tableaux verts |
| 3.4 | `clock.ts` (horaires et délais) | Tests de nuit et de fuseaux verts |
| 3.5 | Politiques d'étape, gabarits, vocaux, rendu | GS-18 vert |
| 3.6 | Rédaction + G1 à G18 | 300 tours simulés : 0 violation envoyée |
| 3.7 | Écran de configuration § 19.4 | Studio d'Anicet configuré |
| 3.8 | Scénarios GS-01 à GS-23 avec réponses enregistrées | 23 sur 23 |

### Étape 4 — Passation, relais, délai de prise en charge, réconciliation

| # | Action | Critère de sortie |
|---|---|---|
| 4.1 | § 14.1 à § 14.3 | Un test par raison |
| 4.2 | Relais § 14.4 | GS-04 vert ; 0 texte généré en relais |
| 4.3 | Reprise et réconciliation § 14.6 | GS-12 vert |

### Étape 5 — Niveau 1 en direct sur la ligne d'Anicet

| # | Action | Critère de sortie |
|---|---|---|
| 5.1 | Bascule de la session : URL de webhook WAHA → moteur, `engine_owner = 'velaris_engine'`, vérification que `velaris-agent` ne reçoit plus cette session | Un seul locuteur |
| 5.2 | Niveau 1 en mode ombre, 7 jours de trafic publicitaire réel | ≥ 90 % de propositions approuvées sans retouche ; 0 `unmapped` sur une question de paiement |
| 5.3 | Niveau 1 en direct | 7 jours : 0 double réponse, 0 marqueur, 0 montant hors catalogue, 0 réponse pendant une prise de main hors relais, 0 aveu |

### Étapes 6 à 8

| # | Action | Critère de sortie |
|---|---|---|
| 6.1 | Niveau 2 (paroles) en ombre puis en direct | Mêmes critères |
| 6.2 | Niveau 3 (paiement complet, reports, relances) | 0 confirmation sans gérant ou SasPay ; 0 relance la nuit |
| 7.1 | Niveau 4 : brouillons IA soumis au gérant, production automatique, vidéo | 0 double production |
| 7.2 | 3 studios pilotes en niveau 1 ombre, préréglages par défaut | Tableau de bord en place |
| 7.3 | Ouverture générale | Taux de passation stable sur 30 jours |
| 8.1 | Retrait de l'ancien moteur après 30 jours sans session sur `velaris-agent` (hors Velaris Partners, à confirmer) | Archivage |

---

## 24. Décisions à trancher par Anicet

| # | Question | Recommandation |
|---|---|---|
| 1 | Grille tarifaire officielle (le dossier, le prompt de Sarah et les automatisations se contredisent) | Saisir le catalogue de votre studio : une seule source |
| 2 | Formule texte seul : paiement avant ou après les paroles ? | `before_lyrics` pour le texte seul, `after_lyrics_validation` pour l'audio |
| 3 | Qui écrit les paroles au départ ? | Vous (niveaux 1 à 3) ; brouillon IA approuvé au niveau 4 |
| 4 | Prise de main : reprise uniquement par votre geste ? | Oui |
| 5 | Fournisseur de modèle | Choisi sur le jeu d'évaluation (zéro faux paiement, précision des prénoms, latence, coût) |
| 6 | Hébergement | VPS, à côté de WAHA, en remplacement de `waha-bridge` |
| 7 | `🎵` = « paroles validées, paiement reçu, lance » ? | Oui, enregistré dans la commande |
| 8 | Retouches gratuites | 2 |
| 9 | Langues locales | Compréhension dès le départ ; réponses en français |
| 10 | Information des clients | Mention courte dans le profil WhatsApp du studio |
| 11 | **Mode relais** pendant une prise de main (gabarits de paiement, accusé de preuve, délai — jamais de texte généré) | Activé par défaut : c'est ce qui aurait sauvé les nuits du cas Djalilou sans contredire la décision 4 |
| 12 | **Identité** : l'agent dit être l'assistant du studio quand on le lui demande | Oui ; ne jamais affirmer être humain |
| 13 | Coordonnées de paiement **sur demande à toute étape** dès qu'un prix est fixé | Oui (cas Fargo, Djalilou) |
| 14 | Brief complet = l'agent continue de répondre par gabarit (délais, paiement) au lieu du silence total | Oui |
| 15 | Ordre des questions du brief | Occasion, destinataire, puis formule (l'émotion avant le prix) |
| 16 | Exemples audio par occasion | Oui : 3 à 5 extraits de 30 s, autorisés par les clients ou créés pour l'occasion |
| 17 | Vos horaires réels de disponibilité | À saisir : ce sont eux qui rendent les délais annoncés honnêtes |
| 18 | Préréglage de sortie pour votre studio | « Alex complet » en ombre, ou « Mes mots uniquement » si vous préférez garder vos formulations |

---

## 25. Risques résiduels

| Risque | Mesure |
|---|---|
| Bannissement WhatsApp (WAHA n'est pas l'API officielle) | Réponses uniquement aux clients qui écrivent en premier, rythme humain, disjoncteur, aucune prospection |
| Fausse capture de paiement | Jamais de confirmation automatique sur image ; confirmation par le gérant ou SasPay ; à terme, lecture des SMS de l'opérateur par le gérant |
| Modèle qui comprend mal une tournure nouvelle | Pas en avant, puis passation discrète ; la tournure entre dans le corpus |
| Transcription vocale erronée | Prénoms extraits d'un vocal toujours confirmés au client |
| Disponibilité humaine (le débit d'un studio reste borné par son gérant aux niveaux 1 à 3) | Délais honnêtes, relais, brouillons IA au niveau 4 |
| Erreur de configuration d'un studio | Contraintes, aperçus, alerte sur modification des moyens de paiement, préréglages prudents |
| Compte Velaris d'un gérant compromis (détournement des dépôts) | Alerte WhatsApp sur toute modification de `payment_methods` ; journal des modifications |
| Deux moteurs sur une session | I19 et procédure de bascule |
| Dérive par accumulation | § 21 |

---

## 26. Analyse lucide

1. **La version 1 aurait reproduit trois des cinq cas réels** (Fargo, gel nocturne de Djalilou, Adeline) et contenait une heuristique de longueur, de la même famille que l'erreur du cas Sylvie. La cause était la même que dans l'ancien système, sous une forme plus propre : coupler ce que le terrain découple. La version 2 sépare paiement et création, silence et inaction, « qui écrit » et « qui sait ». C'est la leçon la plus importante du dossier Alex : **les pannes viennent des couplages, pas des mots**.
2. **Les cinq cas ont tous la même racine technique** : une décision prise sur la **forme** du texte (mot, longueur, date, syntaxe) au lieu de son **sens** et de l'**état**. L'architecture la rend impossible par construction : le sens vient du modèle avec citation vérifiée, l'état vient de la base, et le lint interdit regex, longueurs et dates dans la décision.
3. **L'architecture ne rend pas le modèle meilleur en nouchi ; elle rend ses erreurs inoffensives.** Une incompréhension produit un pas en avant ou une passation, jamais un effacement, une censure ou un aveu. La qualité de compréhension réelle se mesure sur le corpus. Sans ce corpus de vraies conversations, aucune architecture ne tiendra la promesse : c'est le premier livrable, avant le code.
4. **Le vrai plafond n'est pas technique : c'est la disponibilité du gérant.** Tant que le gérant écrit les paroles, la promesse « texte en 8 minutes » est fausse la nuit. Le système l'annonce désormais honnêtement et sauve les paiements nocturnes par le relais, mais seule l'étape 4 (brouillons IA approuvés) change le débit d'un studio. C'est une décision produit autant qu'une décision technique.
5. **Mobile Money personnel reste manuel.** Aucune API ne confirme un dépôt sur le numéro Orange Money personnel d'un gérant ; les fausses captures existent. Le système ne confirme donc jamais seul. Il rend la confirmation instantanée pour le gérant (un geste) et automatique via SasPay pour ceux qui l'utilisent.
6. **L'« illusion humaine » a une limite à ne pas franchir.** Un agent chaleureux, qui porte le prénom choisi par le gérant, oui. Un agent qui jure être humain, non : dans un marché marqué par les arnaques, une capture d'écran de ce mensonge coûte plus cher que la vente.
7. **La stabilité « à 100 % » est un comportement défini pour chaque panne**, pas l'absence de pannes. Chaque couche (WhatsApp, VPS, base, modèle, décision) a son mode dégradé, et tous convergent vers la même issue sûre : se taire, prévenir le gérant, rattraper sans doublon.
8. **Le plus grand risque à long terme est la rechute dans l'accumulation.** La section 21 ne vaut que si elle est appliquée : chaque incident devient d'abord un scénario de référence qui échoue, puis une ligne de table, de corpus ou de garde-fou. Jamais une exception codée là où le problème est apparu.

---

**En une phrase :** Postgres garantit qu'une seule voix parle et que rien ne se perd ; deux pistes en base disent exactement où en est chaque commande ; le modèle comprend avec preuve et rédige sur des faits ; une table décide, une autre choisit la voix du gérant ; les garde-fous vérifient chaque envoi ; et l'humain reprend la main sur un geste, sans que la nuit ne fasse perdre une vente.
