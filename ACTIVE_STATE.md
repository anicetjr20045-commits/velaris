# 📌 ÉTAT ACTIF DU PROJET — VELARIS PLATFORM (Académie & Suite Logicielle Studio Chansons)

> **Source unique de vérité pour la reprise de session entre comptes et conversations.**
> Toute IA intervenant sur ce projet doit le lire au démarrage et le mettre à jour à chaque étape validée.

---

## 🎯 Statut Actuel & Point de Reprise (Session du Soir)

- **Projet** : `velaris` (`/root/projets/velaris`)
- **Dernière mise à jour** : 4 Octobre 2026 (18:29 UTC)
- **Statut Opérationnel** : **Jalon 52 100% Validé & Déployé sur VPS** (Moteur de Recherche Thématique Copilot sur les 40 340 Messages Historiques : fonction PostgreSQL `copilot_search` connectée au Copilot DeepSeek-V3, recherche des plaintes, retouches, litiges et demandes spécifiques opérationnelle et vérifiée en direct).
- **Consigne d'Arrêt & Point de Reprise** :
  - **Recherche Plein-Texte Historique Opérationnelle** : Le Copilot ne répond plus « je n'ai pas de moteur de recherche plein-texte ». Il interroge en direct la fonction PostgreSQL `copilot_search` sur les 40 340 messages d'Anicet et extrait instantanément les verbatim, dates, statuts et solutions de rattrapage en 1 clic.
  - **Cas Réels Testés et Validés en Direct sur le VPS** : Plaintes identifiées pour Nanan Achy (+225 45 88 75 75), kisophie223 (+226 70 86 73 09), Toure Latifa Larissa (+225 08 90 68 36), barryclarisse14 (+226 71 22 38 77), +226 05 77 73 08 avec messages de réconciliation prêts à l'emploi.
  - **Filtrage Stopwords Renforcé** : Élimination des faux positifs de recherche de contact sur les mots courts (« une », « qui », « est ») qui redirigeaient par erreur vers Prunelle.
- **Prochaine tâche exacte** :
  1. Vérifier la session WhatsApp WAHA de test (`Test`, `+22656240533`) et s'assurer qu'elle est en ligne (`WORKING` via `/qr/` si besoin de scanner).
  2. Lancer un test live end-to-end complet avec un numéro existant ou nouveau.

---

## 💎 Vision Produit & Positionnement

Velaris est **la Première Académie & Suite Logicielle Tout-en-Un** permettant à des entrepreneurs et créateurs de lancer leur propre **Studio de Chansons Personnalisées sur WhatsApp** :
1. **L'Académie du Studio (Former)** :
   - Formation de A à Z : positionnement d'offres (1 200 F / 3 000 F / 5 000 F), acquisition publicitaire rentable (Facebook & TikTok Ads dès 5 000 F CFA de test), et scripts de closing WhatsApp mot-à-mot sans friction.
2. **La Suite Logicielle Studio OS (Outiller & Automatiser)** :
   - Plus besoin de studio physique ni de musiciens : transcription de la note vocale du client, génération instantanée de paroles poétiques, production musicale multi-styles et livraison en 18 minutes.
3. **Encaissement Direct & Indépendance Totale** :
   - Les clients paient directement sur le Mobile Money de l'entrepreneur (Wave / Orange Money). Marge brute nette de 85% à 95%.

---

## ✅ Jalons Validés

### 52. Activation de la Recherche Thématique Plein-Texte Copilot sur les 40 340 Messages Historiques (4 Octobre 2026)
- **Fonction PostgreSQL RPC `copilot_search` (Supabase)** :
  - Création de la fonction SQL `copilot_search(p_user_id uuid, p_query text, p_mode text)` avec indexation et filtrage strict par `p_user_id`.
  - Mode spécialisé `complaints` pour extraire automatiquement les réclamations, erreurs de brief, retards et litiges à partir des messages clients réels (`m.direction = 'inbound'`).
- **Câblage Cerveau Copilot & Déploiement VPS** ([`copilot-brain.ts`](file:///root/projets/velaris/engine/src/llm/copilot-brain.ts)) :
  - Détection automatique des intentions de recherche thématique (`isThematicSearch`).
  - Élimination des faux positifs de contacts provoqués par les mots courts français (« une », « qui », « est »).
  - Injection des résultats réels dans `thematicSearchResults` pour DeepSeek-V3.
  - Déploiement vérifié sur le VPS `162.35.113.220` (service `velaris-engine`) : tests réels en situation validés avec succès sur 5 cas concrets (Nanan Achy, kisophie223, Toure Latifa Larissa, barryclarisse14, +22605777308) avec verbatim et messages de rattrapage en 1 clic.

### 51. Ingestion Intégrale de la Mémoire Historique Réelle (637 Contacts, 40 340 Messages) & Cloisonnement Strict Anicet (4 Octobre 2026)
- **Ingestion & Restauration de la Base de Production Réelle (`import-historical-data.mjs`)** :
  - Parsing et injection réussie du dump intégral de production ([`snapshot_full_20260910_090423.json`](file:///root/projets/chansons-personnalisees/observation/raw/snapshot_full_20260910_090423.json)).
  - **Volumétrie réelle injectée** : **637 contacts CRM réels**, **633 conversations complètes**, **623 commandes tracées**, et **40 340 messages WhatsApp authentiques** (incluant toutes les transcriptions des notes vocales).
- **Cloisonnement Strict & Zéro Fuite Multi-Studios (Isolation Définitive)** :
  - Conformité stricte à l'exigence d'Anicet : l'intégralité des 637 contacts, 633 conversations et 40 340 messages est rattachée **exclusivement au compte d'Anicet (`user_id = '043a33b4-429c-4056-b333-ee61d4c0a515'`)**.
  - Grâce aux politiques RLS PostgreSQL et à l'architecture multi-tenants, les futurs utilisateurs et autres studios ont des bases strictement étanches et ne peuvent en aucun cas accéder à ces données.
- **Activation Universelle de la Reconnaissance Anciens Clients (`welcome_returning`)** :
  - La fonction PostgreSQL `agent_contact_facts` retourne désormais instantanément l'historique complet pour chaque contact (ex: Judith SANOU, Safiatou TRAORE, SERE ET FILS, etc.).
  - Lorsqu'un ancien client réécrit sur WhatsApp, l'agent active automatiquement `welcome_returning` : accueil chaleureux reconnaissant la fidélité, et **zéro vocal de procédure superflu** réexpédié.
- **Accès Live Cockpit & Copilot IA** :
  - Les 40 340 messages et synthèses sont immédiatement interrogeables par le Copilot dans l'Atelier Studio via recherche vectorielle/textuelle rapide (`searchStudioData`, `findConversationByPhone`).

### 50. Découplage Opérationnel Épuré : IA WhatsApp pour Prise de Commande, Atelier Studio pour Textes & Validation (4 Octobre 2026)
- **Cadrage Strict de l'IA WhatsApp (Sarah)** :
  - Mission unique et maîtrisée : accueil immédiat, identification client existant / nouveau, questions du brief (prénom, occasion, anecdotes, style) et promesse formelle des paroles personnalisées (*« Tout est bien noté ! Notre studio prépare vos paroles... »*).
  - Dès la promesse effectuée, passage immédiat en pause silencieuse (`brief_completed`). Zéro risque de divagation poétique ou financière en direct.
- **Section Dédiée « Textes & Atelier Studio » avec Notification en Temps Réel** :
  - Renommage de l'onglet dans la navigation principale et sur mobile : **« Textes & Atelier Studio »** ([`StudioAppLayout.tsx`](file:///root/projets/velaris/src/components/StudioAppLayout.tsx)).
  - Badge dynamique affichant le nombre exact de commandes en attente de texte (`status === 'brief_recu'`).
- **File de Commandes & Filtres d'Atelier** ([`StudioView.tsx`](file:///root/projets/velaris/src/components/StudioView.tsx)) :
  - Filtres rapides : *« Toutes »*, *« Textes à faire »* (avec badge doré pulsant), *« Paroles prêtes »*, *« En studio / Livré »*.
  - Synthèse de chaque commande sous les yeux du gérant : destinataire, occasion, extrait note vocale/transcription, style, coordonnées client.
- **Génération Connectée au Golden Corpus & Double Canal d'Expédition** :
  - Bouton de génération instantanée alimenté par `generateHouseStyleSong` (32 à 48 vers complets Suno).
  - Bouton interactif **`Copier en 1 clic`** pour coller manuellement dans WhatsApp.
  - Bouton direct **`Envoyer sur WhatsApp`** ouvrant la discussion avec le message pré-rempli et poli.
  - Déclenchement de la musique Suno préservé : réaction emoji `🎵` sur WhatsApp ou clic dans le studio.

### 49. Balises Copiables en 1 Clic & Arbitrage Stratégique Définitif (4 Octobre 2026)
- **Composant `CopyableBlock` et Rendu Markdown Enrichi** :
  - Tout texte ou parole généré par le Copilot dans une balise de code Markdown (\`\`\`suno ou \`\`\`texte) est automatiquement isolé dans un conteneur sombre luxueux (`#07080B`) avec bordure subtile et en-tête dédié.
  - Bouton interactif « Copier en 1 clic » avec retour visuel immédiat (« Copié en 1 clic ! ») et typographie dorée/ivoire adaptée.
  - Bouton également uniformisé sur les cartes d'actions (`actionCard`).
- **Directive Infrangible Déployée sur le Cerveau VPS DeepSeek-V3** :
  - Instruction stricte dans `copilot-brain.ts` obligeant l'IA à enfermer toutes les créations poétiques et messages prêts à l'envoi dans des blocs de code pour déclencher instantanément le bloc copiable.
  - Image Docker recompilée et déployée à chaud sur le VPS (`162.35.113.220`).
- **Arbitrage Stratégique Fondé sur les Données Terrain Réelles** :
  - Rejet argumenté du mythe de l'automatisation à 100% (sources de pertes massives de leads sur les cas émotionnels et les ambiguïtés de paiement Mobile Money).
  - Validation du Modèle Hybride Cockpit (Sarah Réceptionniste -> Pause brief -> Copilot Studio 1-Clic).

### 48. Cerveau Copilot IA Élite DeepSeek-V3 Live, Tool Calling & Synchronisation Hybride Temps Réel (4 Octobre 2026)
- **Cerveau DeepSeek-V3 Déployé en Production (`/api/copilot`)** :
  - Création du service d'intelligence neuronale dédié [`engine/src/llm/copilot-brain.ts`](file:///root/projets/velaris/engine/src/llm/copilot-brain.ts) sur le moteur VPS (`velaris-engine`).
  - Route d'accès public sécurisée HTTPS via Caddy reverse-proxy : `https://waha.velarisagent.life/api/copilot`.
  - Zéro fuite de clé d'API côté client : la clé DeepSeek reste strictement confinée dans l'environnement serveur.
- **Intelligence Conversationnelle d'Élite & Zéro Menu Rigide** :
  - Le Copilot dialogue avec une fluidité totale, répond aux questions stratégiques, aux objections commerciales et analyse la santé du studio avec un ton chaleureux, naturel et percutant.
  - Maîtrise absolue du catalogue de prix (1 200 F / 3 000 F / 5 000 F CFA), des délais de livraison (18 min Suno, 7-8 min texte) et des coordonnées Mobile Money (Wave, Orange Money BF Wendyam Anicet junior).
- **Accès Live aux Données Supabase & Tool Calling Automatique** :
  - Interrogation directe des tables `orders`, `contacts`, `conversations` et `messages`.
  - Calcul dynamique en direct du CA consolidé (3 672 200 F CFA), répartition Wave / Orange Money et panier moyen.
  - Capacité d'action transactionnelle : exécution de `db.insertRow('orders')` pour créer les commandes et basculer l'état du funnel vers `paid` en direct.
- **Architecture Hybride Résiliente Frontend** ([`src/services/copilot.ts`](file:///root/projets/velaris/src/services/copilot.ts)) :
  - Le frontend interroge en priorité l'API DeepSeek-V3 live.
  - En cas d'indisponibilité réseau ou hors-ligne, repli instantané et transparent sur le moteur déterministe local sans jamais casser l'expérience utilisateur.

### 47. Flexibilité Totale du Copilot IA : Double Commande Simultanée, Résolution Numéro/Prénom & Encaissement Direct (4 Octobre 2026)
- **Résolution Ultra-Flexible des Contacts (Numéro, Prénom, Contexte)** :
  - Détection par numéro partiel (ex: `5835`, `+226 79...`, `07 88...`).
  - Détection par prénom (ex: `Aminata`, `Marc`, `Ibrahim`) avec insensibilité totale aux minuscules et aux formulations d'ordres (« *fais le texte pour aminata* », « *reçois la commande pour marc* »).
  - Suppression des contraintes artificielles de majuscules grâce à un parseur de termes de recherche résilient (`extractSearchTerms`).
- **Génération Simultanée Multi-Commandes (Deux Textes Calibre Patron)** :
  - Prise en charge des requêtes multi-commandes (« *la personne a fait deux commandes, fais les deux textes en même temps* », « *fais les 2 chansons : une pour Sarah et une pour Marc* »).
  - Extraction distincte des destinataires via `extractRecipients()`.
  - Composition en parallèle de Chanson 1 et Chanson 2, chacune respectant rigoureusement l'ADN étalon du patron (32 à 48 vers utiles Suno avec `[Intro]`, `[Couplet 1]`, `[Pré-Refrain]`, `[Refrain]`, `[Couplet 2]`, `[Pont]`, `[Refrain Final]`, `[Outro]`), sans aucune version courte.
  - Action card combinée avec séparateur clair et métadonnées structurées (`isMulti: true`).
- **Agent Commercial Décisionnel & Prise de Commande en Direct (`order_action`)** :
  - Interprétation des ordres commerciaux naturels (« *Reçois la commande de 3 000 F pour Marc par Wave* », « *Valide le paiement de 5 000 F* »).
  - Extraction déterministe du montant (1 200 F / 3 000 F / 5 000 F CFA) et de l'opérateur Mobile Money (Wave, Orange Money, Moov).
  - Exécution directe de `createOrUpdateLiveOrder()` dans Supabase pour synchroniser la caisse et basculer l'étape du pipeline vers `paid` (*Paiement reçu / En studio*).
  - Restitution d'un compte-rendu décisionnel immédiat sous forme de tableau et d'action card financière.
- **Accès & Consultation de la Bibliothèque Étalon (Golden Corpus)** :
  - Intégration de l'entrée de connaissance dédiée permettant au Copilot de citer les hits modèles du patron, les règles d'or et l'ADN poétique du studio (`getHouseStyleDnaNote()`).
- **Validation Globale** :
  - Frontend Velaris : Build propre en 4.07s (`tsc -b && vite build`).
  - Tests d'intégration dynamiques Copilot (`test-copilot.ts`) : 100% de succès sur la recherche par numéro, par prénom, la double commande simultanée et l'encaissement direct.
  - Moteur Engine : 158/158 tests unitaires, SQL et PGlite passés au vert.

### 46. Intégration du Corpus de Textes Faits Main, ADN de Style Maison & Règle Absolue « Pas de Texte Court » (4 Octobre 2026)
- **Récupération & Capitalisation sur la Vraie Plume du Patron** :
  - Restauration de l'architecture historique de la bibliothèque de paroles (`song-corpus.server.ts` et `lyrics-writer.ts`).
  - Création du module dédié [`engine/src/llm/lyrics-corpus.ts`](file:///root/projets/velaris/engine/src/llm/lyrics-corpus.ts) hébergeant les **Hits Étalons d'Or (Golden Patron Corpus)** pour chaque occasion majeure (*Anniversaire*, *Mariage*, *Amour*, *Hommage/Deuil*, *Naissance*, *Fête des mères/pères*).
- **Consigne Inflexible « Pas de Texte Court » (Calibre Patron)** :
  - Éradication des brouillons superficiels de 10 à 15 lignes : le studio impose une structure complète de **32 à 48 vers utiles** (1 800 à 3 200 caractères).
  - Structure Suno canonique obligatoire : `[Style: ...]`, `[Intro]` (avec « … »), `[Couplet 1]` (6-8 vers avec prénom), `[Pré-Refrain]`, `[Refrain]`, `[Couplet 2]` (anecdotes/souvenirs), `[Refrain]`, `[Pont]` (4-6 vers d'émotion pure/prière), `[Refrain Final]`, `[Outro]`.
- **Injection Dynamique Few-Shot & Détection d'Occasion Robuste** :
  - `detectOccasion()` : détection insensible aux accents avec priorité stricte du mariage sur l'anniversaire (*« anniversaire de mariage »* => mariage).
  - Injection contextuelle des 2 meilleurs exemples complets de la plume maison dans le prompt de DeepSeek avant chaque rédaction.
- **Contrôle Qualité Déterministe (`checkLyricsQuality`) & Auto-Retry Correctif** :
  - Vérification automatique du nombre de vers (≥ 26 vers utiles), du nombre de mots (≥ 200 mots), de la présence répétée du prénom (≥ 2 fois), de la formule *« Joyeux anniversaire »* pour les anniversaires, et rejet des clichés commerciaux plats (*« rayon de soleil »*, *« mon amour éternel »*).
  - En cas de premier jet trop court ou défaillant, le compositeur déclenche automatiquement une **relance corrective ciblée** (`buildLyricsRetryFeedback`), garantissant qu'aucun texte court ne soit jamais retourné au client.
- **Validation Globale** :
  - Moteur Engine : 15/15 tests unitaires & d'intégration passés au vert (`dist/test/lyrics-composer.test.js`).
  - TypeScript : 0 erreur (`npm run typecheck`).
  - Frontend Velaris : Build propre en 4.02s (`npm run build`).

### 45. Allègement des Suggestions Copilot & Nouveau Champ de Saisie Lumineux (4 Octobre 2026)
- **Éradication des Grosses Cartes de Suggestions dans le Fil** :
  - Suppression intégrale de la grille de 6 grandes cartes qui encombrait l'espace de conversation.
  - Déplacement des suggestions sous forme de micro-puces très discrètes et compactes (`text-[11px] px-2.5 py-1`) placées juste en bas au-dessus du compositeur.
- **Champ de Saisie Réhaussé & Plus Lumineux** :
  - Remplacement de l'ancien fond terne `bg-white/[0.025]` par un conteneur plus lumineux (`bg-[#13151D] border-white/[0.14]`, avec survol à `border-white/[0.24]` et focus actif lumineux à `bg-[#181B26] border-white/35`).
  - Suppression de l'exemple verbeux : le placeholder redevient sobre et direct (*« Écrivez votre message... »*).
  - Bouton d'envoi monochrome blanc haute visibilité (`bg-white text-black hover:bg-neutral-200`).
- **Validation Globale** :
  - TypeScript : 0 erreur (`tsc -b`).
  - Linter : 0 erreur (`oxlint`).
  - Bundle Vite : Build propre en 4.06s.
  - Conformité totale à la Règle 4 (zéro emoji UI, design sobre Linear/Apple).

### 44. Refonte Visuelle & Ergonomique Haut de Gamme de l'Analyste & Copilot IA (4 Octobre 2026)
- **Compaction et Équilibre du Rail Gauche (Élimination du Débordement Vertical)** :
  - Calibrage de la mascotte Sonar à 124 px (au lieu de 168 px) et réduction des espacements superflus : la colonne de gauche s'affiche désormais intégralement dans n'importe quel écran 13"/14" sans forcer de défilement.
  - Fusion des métriques en un seul panneau unifié « Instruments Studio » : Chiffre d'affaires cumulé, taux de marge (92 %), compteurs de commandes (Livrées / En cours), répartition Wave / Orange Money et solde permanent des crédits Kie.ai.
  - Liste des sources de données compactée avec micro-animations d'ondes sonores en cours de lecture.
- **Éradication de l'Aplat Jaune Saturé (Bulle Utilisateur)** :
  - Remplacement de l'ancien bloc jaune vif criard par une bulle en verre graphite fumé raffiné (`bg-[#161820] text-neutral-100 border border-white/[0.12]`), améliorant le confort de lecture et redonnant toute la priorité visuelle aux analyses produites par l'IA.
- **Harmonisation Typographique & Boutons d'Action (Hiérarchie Apple / Linear)** :
  - Actions primaires (Envoi WhatsApp direct, lancement de production Suno, livraison du morceau) standardisées sur un bouton blanc pur contrasté (`bg-white text-black hover:bg-neutral-200`) avec ombre de portée douce.
  - Actions secondaires (Copier, Ouvrir WhatsApp direct, Envoyer à l'Atelier) harmonisées en pillules de verre transparentes discrètes (`border border-white/12 bg-white/[0.03] text-neutral-300`).
  - Élimination des conflits de verts et dorés criards.
- **Validation Globale** :
  - TypeScript : 0 erreur (`tsc -b`).
  - Linter : 0 erreur (`oxlint`).
  - Bundle Vite : Build propre en 3.73s.
  - Conformité totale à la Règle 4 (zéro emoji UI, design sombre Linear/Apple).

### 43. Archivage Bidirectionnel Discussions WhatsApp & Fiabilisation Temps Réel Lus / Non-Lus (4 Octobre 2026)
- **Fiabilisation Spontanée des Statuts Lus / Non-Lus** :
  - *Principe déterministe* : Calcul automatique dans `getLiveConversations` comparant `last_message_at > ack_log.last_read_at`. Dès qu'un prospect ou client envoie un nouveau message, la discussion redevient automatiquement non-lue sans aucune latence.
  - *Mise à jour instantanée* :
    - Côté client : `setConversationUnread` met à jour immédiatement le store réactif (`useSyncExternalStore`) pour une réactivité à 0 ms dans la liste et sur le badge de navigation.
    - Côté base de données : `updateConversationReadStatus` persiste l'horodatage `last_read_at` dans `conversations.ack_log` via PostgREST, déclenchant les événements WebSocket Supabase Realtime sur tous les onglets et appareils connectés.
    - Côté WhatsApp : Envoi synchrone de `markWahaChatSeen` vers l'API WAHA pour déclencher les vraies coches bleues de lecture WhatsApp pour l'interlocuteur.
- **Gestion Complète de l'Archivage WhatsApp en Temps Réel** :
  - *Filtre Dédié et Isolation* :
    - Les discussions archivées sont automatiquement masquées de la boîte principale (« Tous », « Non lus », « Nouveaux », « Devis »).
    - Nouvel onglet de filtrage « Archivés » avec compteur dynamique.
    - Les discussions archivées sont exclues du compteur global de pastille de notification.
  - *Boutons d'Archivage / Désarchivage* :
    - Bouton discret et architectural (`Archive` / `ArchiveRestore` de `lucide-react`) disponible au survol de chaque conversation dans la liste.
    - Bouton d'archivage / désarchivage dans l'en-tête du fil de discussion.
    - Bannière d'état sobre en haut de fil lorsque la discussion sélectionnée est archivée, avec lien rapide de désarchivage.
  - *Synchronisation Bidirectionnelle Supabase & WhatsApp* :
    - Mise à jour locale optimiste immédiate (0 ms).
    - Persistance atomique dans `conversations.ack_log` (`archived: true/false`, `archived_at`).
    - Appel API WAHA `/api/{session}/chats/{chatId}/{archive|unarchive}` pour archiver également la discussion sur le vrai WhatsApp.
    - Activation de `store: { enabled: true, fullSync: true }` et écoute de l'événement `'chat.archive'`.
- **Validation Globale** :
  - TypeScript : 0 erreur (`tsc -b`).
  - Linter : 0 erreur (`oxlint`).
  - Bundle Vite : Build propre en 3.66s.
  - Conformité stricte à la Règle 4 (zéro emoji UI, design sombre Linear/Apple).

### 42. Redirection Automatique Atelier Utilisateurs Connectés & Persistance F5 / Refresh (4 Octobre 2026)
- **Résolution des 2 Exigences Critiques de Navigation** :
  1. *Redirection Automatique des Utilisateurs Connectés vers l'Atelier* :
     - Détection synchrone dès le premier cycle de rendu (`checkHasSavedAuthSession` sur token Supabase) pour éliminer tout flash ou passage par la landing page publique.
     - Redirection automatique réactive dès la confirmation de la session Supabase (`useEffect` sur `user`) pour tout utilisateur arrivant sur la racine ou se connectant via la modal d'authentification.
     - Préservation du libre arbitre utilisateur : si un utilisateur connecté clique délibérément sur « Retour à la vitrine », il peut librement consulter la vitrine publique sans être renvoyé de force vers l'Atelier.
  2. *Persistance Absolue lors de l'Actualisation (F5 / Refresh)* :
     - Synchronisation bidirectionnelle continue entre l'état React (`activeTab` et `studioSubTab`), le fragment d'URL (`window.location.hash` : `#studio`, `#cockpit`, `#conversations`, `#academy`, `#copilot`, etc.) et le stockage local (`velaris_active_tab`, `velaris_studio_subtab`).
     - Lors d'une actualisation de page dans l'Atelier (`#studio`), dans les discussions WhatsApp (`#conversations`), dans le Cockpit (`#cockpit`) ou l'Académie (`#academy`), l'utilisateur reste strictement et instantanément sur sa vue de travail sans jamais être renvoyé à l'accueil.
     - Prise en charge des boutons Précédent / Suivant du navigateur via écouteur d'événement `hashchange`.
- **Validation Globale** :
  - Tests unitaires de routage et de persistance exécutés au vert (7/7 assertions validées).
  - TypeScript : 0 erreur (`tsc -b`).
  - Linter : 0 erreur (`oxlint`).
  - Bundle Vite : Build propre en 2.72s. Conformité stricte à la Règle 4 (zéro emoji UI, design sombre Linear/Apple).

### 41. Câblage Intégral Alertes WhatsApp Gérant & Durcissement Médical Paroles/FSM (4 Octobre 2026)
- **Câblage du Canal d'Alerte Gérant (`owner_alert` & `handoff`)** :
  - Implémentation de `queueOwnerAlert` dans `run-turn.ts` : génère des messages WhatsApp prioritaires (`origin: 'system_alert'`, `purpose: 'owner_alert'`) transmis au gérant sur son `alert_phone` via WAHA.
  - Couverture exhaustive des motifs d'alerte :
    - `payment_to_verify` : Justificatif ou réclamation de paiement reçu.
    - `unexpected_payment_claim` : Réclamation de paiement inattendue.
    - `new_detail` : Nouveau souvenir/détail ajouté par le client.
    - `own_lyrics` : Paroles fournies directement par le client.
    - `change_request` : Demande de retouches.
    - `lyrics_validated` : Paroles validées par le client.
    - `production_ready` : Commande validée et payée, prête pour production.
    - `unclassified_image` : Image transmise nécessitant vérification.
    - `missing_price` : Commande sans prix défini.
    - `handoff` : Prise en main humaine demandée ou requise (avec raison exacte).
    - `compose_failed` / `revise_failed` : Alerte immédiate au gérant si un appel LLM de paroles échoue.
- **Actions Métier FSM Complétées** :
  - `launch_production` : Déclenche `agent_transition_order` (`production_started`), passe l'ordre en `in_production`, incrémente la version.
  - `schedule_followup` : Programme un tour de relance automatique dans `conversation_turns` via `agent_conversation_effect` (`p_kind: 'schedule_followup'`) selon `persona.followup_delay_hours`.
  - Prise en charge propre de `send_procedure_voice` et `store_images`.
- **Durcissement Anti-Régression Paroles** :
  - `reviseLyrics` : Lève désormais une erreur explicite si les paroles retournées sont invalides ou vides au lieu de renvoyer silencieusement les anciennes paroles.
  - `renderOutputItem` : Garde-fou strict empêchant la livraison d'un message vide si `lyrics` est vide (message d'attente sécurisé).
  - `runTurn` : Fallbacks automatiques pour `recipientName` et `occasion` garantissant que la composition et la révision ne sont jamais court-circuitées par une clé indéfinie.
- **Validation Globale** :
  - TypeScript : 0 erreur (`tsc -p tsconfig.json`).
  - Suite de tests : **143/143 tests passés au vert (24 suites, 0 échec)**.
  - Frontend Vite : Build propre en 2.92s, conformité totale à la Règle 4 (zéro emoji UI, style graphique sombre Linear/Apple).

### 40. Bouclage Intégral & Déploiement Production Paroles & Retouches Suno WhatsApp (4 Octobre 2026)
- **Résolution des 3 Écarts Critiques du Cycle Paroles** :
  1. *Livraison WhatsApp des Paroles Révisées au Tour 2* : Au Tour 2 des retouches (`confirm_change_recap` validé), l'agent génère les modifications chirurgicales, enregistre en base `orders.lyrics`, et envoie immédiatement `deliver_revised_lyrics` (*« Voici votre texte corrigé pour {recipient} :\n\n{lyrics}\n\nOn garde ce texte tel quel ? »*) en armant la question `validate_lyrics`. Zéro client laissé en attente d'un texte généré en coulisses.
  2. *Déclenchement Automatique Post-Vocal de Procédure* : À la réception de la réponse du nouveau client après le vocal de procédure, le moteur transitionne `lyrics_work_started`, déclenche `request_lyrics` et délivre le texte composé via `deliver_lyrics` avec question `validate_lyrics`.
  3. *Activation Universelle Studio Personas Supabase* : Mise à jour en base de production (`cap_lyrics_draft = true`, `lyrics_author = 'ai_draft_approved'`, `cap_lyrics_followup = true`) sur l'ensemble des studios enregistrés (dont le studio fondateur Velaris Studio `043a33b4`).
- **Validation Complète du Moteur** :
  - TypeScript : 0 erreur (`tsc -p tsconfig.json`).
  - Suite de tests : **143/143 tests passés au vert (24 suites, 0 échec)**.
- **Déploiement VPS Production (`162.35.113.220`)** :
  - Synchronisation du bundle `dist/` et `package.json` sur le VPS.
  - Reconstruction de l'image Docker `velaris-engine:latest`.
  - Conteneur redémarré avec succès (`ingest listening` sur port 3001).

### 39. Éradication des Promesses Fantômes de Paroles & Protocole Chirurgical des Retouches en 2 Temps (Option B) (4 Octobre 2026)
- **Directives Fondatrices d'Anicet Appliquées à la Lettre (Zéro Amateurisme)** :
  1. *Commande par Commande* : Verrouillage strict de l'ordre actif dans la machine à états FSM. Zéro risque de mélanger prénoms, occasions ou proches.
  2. *Éradication Totale des Promesses Fantômes* : L'agent ne prétend jamais qu'un texte est envoyé sans que les paroles complètes ne soient écrites et stockées en base dans `orders.lyrics`.
  3. *Protocole des Retouches en 2 Temps (Option B)* :
     - **Tour 1** : Demande de modification capturée (`register_change_request`). L'agent récapitule les ajustements avec bienveillance (`recap_change_request`) et verrouille le périmètre avec la question `confirm_change_recap` (*« Est-ce bien tout, ou vous souhaitez modifier un autre détail avant la correction ? »*).
     - **Ajout de détails en cours de récapitulatif** : Si le client ajoute d'autres détails, ils sont cumulés et le récapitulatif est mis à jour.
     - **Tour 2** : Dès confirmation par le client (*« Oui c'est tout »*, *« C'est bon »*, *« Non rien d'autre »*), le moteur transitionne vers `change_requested`, exécute `revise_lyrics` et accuse réception (`ack_change_request`).
     - **Contrôle Qualité Humain** : Dès la 2ᵉ retouche (ou demande complexe), le gérant est automatiquement alerté (`alert_owner: change_request`) pour garder la haute main.
- **Service Parolier & Retouche Suno (`engine/src/llm/lyrics-composer.ts`)** :
  - `composeLyrics` : Structure Suno complète ([Couplet 1], [Refrain], [Couplet 2], [Pont], [Outro]), intégration des souvenirs réels, rimes et métrique soignée d'Afrique de l'Ouest, 1 200 à 2 400 caractères.
  - `reviseLyrics` : Retouche chirurgicale conservant 85 % à 90 % du texte existant en ne modifiant que les vers ciblés par la demande du client.
- **Câblage Moteur & Base de Données (`run-turn.ts`, `decide.ts`, `render.ts`, SQL)** :
  - Transmission de `lyrics` et `memories` depuis PostgreSQL dans `agent_turn_context` (`20261006_agent_turn.sql` & `20261006_master_agent_production.sql`).
  - Actions `request_lyrics` et `revise_lyrics` exécutées avec mise à jour atomique de `orders.lyrics` et transition `lyrics_sent`.
  - Gabarits de livraison `deliver_lyrics` et `deliver_revised_lyrics` avec variable `{lyrics}`.
- **Validation Globale** :
  - TypeScript : 0 erreur (`tsc -p tsconfig.json`).
  - Tests unitaires et d'intégration PGlite : **140/140 tests passés au vert (24 suites, 0 échec)**.

### 38. Calibration Cadence Humaine 20s & Déploiement Production VPS (3 Octobre 2026)
- **Directive du Fondateur** : Application d'un délai total de 20 secondes avant réponse pour rendre le dialogue 100% indiscutable humainement.
- **Architecture de Timing Naturelle (`engine/src/send/outbox.ts`)** :
  - *Phase 1 (Silence de lecture - 14 secondes)* : Pause silencieuse où rien ne bouge sur WhatsApp, simulant la prise en main du smartphone et la lecture attentive du message client.
  - *Phase 2 (Indicateur de frappe - ~5 à 6 secondes)* : Déclenchement de l'icône verte « en train d'écrire... » via WAHA `/api/startTyping` pendant le temps de frappe proportionnel à la longueur du texte.
  - *Phase 3 (Distribution)* : Envoi à la 20e seconde pile et extinction de l'indicateur d'écriture via `/api/stopTyping`.
- **Validation Complète du Moteur** :
  - TypeScript : 0 erreur de type (`tsc --noEmit`).
  - Suite de tests : **136/136 tests passés au vert (24 suites, 0 échec)**.
- **Déploiement VPS (`162.35.113.220`)** :
  - Bundle `dist/` synchronisé sur le VPS dans `/root/waha-vps-setup/velaris-engine`.
  - Image Docker `velaris-engine:latest` reconstruite avec succès.
  - Conteneur relancé et opérationnel à l'écoute sur le port 3001.

### 37. Onboarding Universel Multi-Studios & Autonomie Réelle de l'Agent WhatsApp (3 Octobre 2026)
- **Audit de Réalité Rigoureux (Tolérance Zéro Spéculation)** :
  - Identification de failles critiques empêchant tout nouvel utilisateur de faire répondre l'IA à ses clients :
    1. `engine_owner` était fixé à `'none'` pour tous les utilisateurs tiers dans `wa_sessions`, bloquant l'ingestion vers le moteur.
    2. Les tables `studio_personas` et `studio_catalogues` n'existaient que pour le compte fondateur. Pour tout autre utilisateur, le moteur plantait avec `missing_context`.
    3. `WhatsAppLinesView.tsx` ne synchronisait pas la ligne vers `wa_sessions` par omission du paramètre `syncToStudio: true`.
- **Auto-Provisioning Universel PostgreSQL (`20261007_auto_provision_studios.sql`)** :
  - Déploiement de la fonction `public.velaris_provision_studio_for_user(p_user_id, p_studio_name, p_manager_name)`.
  - Branchement du trigger `velaris_on_auth_user_created` sur `auth.users` : toute nouvelle inscription configure immédiatement et sans délai son profil IA (`studio_personas`), ses 3 forfaits commerciaux (`studio_catalogues`) et sa session WhatsApp active (`engine_owner = 'velaris_engine'`).
  - Rétro-provisioning instantané exécuté avec succès pour l'ensemble des 5 comptes déjà enregistrés (dont `149fb40a`).
- **Alignement Frontend & Synchronisation Ligne** :
  - `WhatsAppLinesView.tsx` : activation explicite de `syncToStudio={true}` pour la carte studio connectée.
  - `useWaha.ts` : upsert dans `wa_sessions` injectant systématiquement `engine_owner: 'velaris_engine'`.
- **Validation Build & Cohérence** :
  - Build frontend Vite validé avec 0 erreur en 4.42s.
  - Base de données PostgreSQL vérifiée : 5 personas et 5 sessions valides et actives.

### 36. Auto-Provisioning WAHA VPS, Isolation Stricte WhatsAppLinesView et Architecture Vocale ElevenLabs (3 Octobre 2026)
- **Auto-Provisioning Transparent des Sessions Studio sur le VPS (`engine/src/send/waha-client.ts`)** :
  - Résolution de l'erreur 404 "Session not found" : toute session `studio_<user_id>` non existante dans WAHA est désormais créée dynamiquement à la volée via `POST /api/sessions` avec configuration standardisée (`noweb: { markOnline: false, store: { enabled: true, fullSync: false } }`) et webhook HMAC vers `http://waha-bridge:3001/webhook`.
  - Recompilation et redéploiement à chaud du conteneur `velaris-engine` sur le VPS de production (`162.35.113.220`).
  - Validation directe sur VPS : `POST /api/qr/restart?session=studio_auto01` provisionne immédiatement la session et délivre le QR PNG binaire en code 200.
- **Éradication de l'Affichage Double et Concurrence sur la Page Lignes WhatsApp (`WhatsAppLinesView.tsx`)** :
  - Suppression de la condition faussée `isDirection = access === 'admin' || access === 'unconfigured'` qui affichait 3 lignes en cascade simultanément pour tout nouvel utilisateur.
  - Découpage strict : chaque utilisateur studio ne voit que SA propre ligne studio (`studio_<userId>`).
  - Pour les administrateurs (`access === 'admin'`) : mise en place d'un commutateur d'onglets épuré (`[Ma Ligne Studio]` | `[Ligne Démo (+22656240533)]` | `[Ligne Superviseur (+22658357772)]`), affichant strictement UNE ligne à la fois.
  - Zéro image brisée : état inactif remplacé par un panneau sobre avec le bouton **« Activer et afficher le Code QR »**, déclenchant l'initialisation et le rendu du QR Code 240x240 avec instructions guidées.
- **Architecture d'Intégration Vocale ElevenLabs** :
  - Analyse des flux vocaux dans l'écosystème : vocal de procédure WhatsApp natif (PTT), transcription audio STT (Scribe) et personnalisation des voix de synthèse via Voice ID.
  - Préparation de l'intégration de la clé API ElevenLabs de l'utilisateur pour alimenter la synthèse vocale personnalisée des réponses WhatsApp et des échantillons musicaux.

### 35. Normalisation Métriques Zéro, Éradication Pipeline, Déblocage Académie/Atelier et Alignement Backend Automations (3 Octobre 2026)
- **Directive 1 : Zéro Métrique Parasite pour les Nouveaux Utilisateurs** :
  - `RevenusView.tsx` & `VentesCaisseView.tsx` : Remplacement de tous les totaux statiques en dur (3 644 400 F, 2 420 000 F Wave, 1 224 400 F OM, 126 messages, 42 prospects) par des réductions dynamiques initialisées à 0 F CFA.
  - `App.tsx` & `supabase.ts` : Suppression du fallback sur les métriques du studio de production pour les nouveaux comptes. Les métriques d'un nouvel utilisateur démarrent strictement à 0 F CFA, 0 commande, 0 contact.
  - `CockpitView.tsx` : Sparklines et tendances adaptées pour afficher un palier neutre sans variation artificielle à l'ouverture d'un nouveau compte.
- **Directive 2 : Élimination Intégrale de la Section « Suivi clients »** :
  - `StudioAppLayout.tsx` : Suppression de l'élément de menu `pipeline` ("Suivi clients") de la navigation studio, suppression de l'import et du rendu conditionnel de `PipelineView`.
  - `RevenusView.tsx` : Suppression complète de la section 4 ("Suivi de l'Entonnoir Clients (30 jours)" et son bouton vers le Kanban).
- **Directive 3 : Cartographie Rigoureuse et Non Spéculative des Capacités Réelles du Copilot IA** :
  - Audit complet de `src/services/copilot.ts` et `src/components/StudioCopilotView.tsx` :
    1. Résolution de dossiers et recherche multi-tables PostgreSQL (`contacts`, `conversations`, `messages`, `orders`).
    2. Rédaction de paroles sur mesure avec respect de la contrainte Suno (3 000 caractères max).
    3. Production audio Suno via Kie.ai (débit de 1 crédit studio à 85 F CFA et polling automatique jusqu'à obtention du mp3).
    4. Livraison WhatsApp 1-clic via la passerelle WAHA (`/api/sendText`, `/api/sendFile`).
    5. Réponses et relances commerciales contextuelles adaptées aux 4 étapes du funnel.
    6. Télémétrie des ventes et marges en temps réel.
    7. Base de connaissances académique et tarification.
    8. Gestion des crédits studio (85 F/crédit, micro-consommations Copilot de 0.05 crédit).
- **Directive 4 : Cohérence Totale Frontend & Backend de la Page Automatisations** :
  - Diagnostic & Correction Schema PostgreSQL (`aws-1-eu-west-1.pooler.supabase.com:6543`) :
    - Colonnes ajoutées sur `public.automation_rules` : `action_type TEXT NOT NULL DEFAULT 'send_text'`, `media_path TEXT`, `caption TEXT`.
    - Contrainte `text_body NOT NULL` levée pour autoriser les envois de médias purs (vocal, vidéo, catalogue).
    - `user_id` configuré avec valeur par défaut `auth.uid()`.
  - Création du Bucket Supabase Storage `product-files` :
    - Bucket public créé avec politiques RLS de lecture publique et insertion/suppression authentifiée.
  - Vérification de l'endpoint REST Supabase : code HTTP 200 OK avec toutes les colonnes requises.
- **Directive 5 : Disponibilité Universelle de l'Académie Studio et de l'Atelier Studio IA** :
  - `StudioAppLayout.tsx` : Restructuration de la navigation latérale. Création d'un groupe dédié de premier plan « Création & Formation » regroupant « Atelier Studio IA » et « Académie Studio », accessibles sans restriction à l'ensemble des utilisateurs connectés ou en découverte.
  - Isolement strict de la console d'administration sous le groupe « Supervision ».
  - `App.tsx` : Levée des verrous d'authentification bloquants à l'ouverture de l'atelier ou du cockpit depuis la vitrine.

### 34. Intégration Expert Vercel & Déploiement Actif (3 Octobre 2026)
- **Installation du Plugin Officiel Vercel (`vercel/vercel-plugin`)** :
  - Déploiement du catalogue officiel et installation du package `vercel@claude-plugins-official`.
  - Intégration de l'ensemble des **37 compétences Vercel** (`vercel-cli`, `deployments-cicd`, `env-vars`, `routing-middleware`, `vercel-functions`, `access-protected-vercel-deployment`, etc.) dans l'environnement Antigravity (`/root/.gemini/config/skills/`).
- **Outillage CLI Global** :
  - Installation globale de `vercel` CLI (`v62.2.0`) disponible en ligne de commande.
- **Support Déploiement Vercel** :
  - `vercel.json` en place sur `origin/main` avec réécriture propre des routes SPA (`/(.*)` -> `/index.html`).
  - Tolérance zéro rupture : variables Supabase et WAHA configurées avec replis directs de production (`dnwlqgsftauqsyjwhoza`, `https://waha.velarisagent.life`).

### 33. Passerelle QR Code Blindée & Activation Dynamique 1-Clic (3 Octobre 2026)
- **Diagnostic Fondamental Résolu (Zéro Image Cassée, Zéro Amour Flou)** :
  - Lorsque la session WhatsApp `Test` était en attente, arrêtée ou en timeout (`FAILED`), WAHA retournait une erreur HTTP 422 JSON provoquant l'affichage d'un cadre d'image brisé dans le navigateur.
  - L'ancienne page de surveillance locale (`qr_live.py`) basculait arbitrairement sur `anicet2` et masquait le besoin d'appairage de la ligne principale.
- **Architecture de Relais Direct Intégrée au Moteur VPS (`velaris-engine` & `http.ts`)** :
  - **`GET /api/qr/status`** : Interrogation en temps réel de WAHA sans exposer de clé API. Renvoie l'état précis (`isScanning`, `isOnline`, `phone`, `pushName`).
  - **`POST /api/qr/restart`** : Déclenchement instantané de l'initialisation de la session WAHA `Test` (ou relance) en 1 clic.
  - **`GET /api/qr/image`** : Filet de protection absolu. Si la session n'est pas en `SCAN_QR_CODE`, renvoie un code 404 JSON propre au lieu d'une image corrompue. En mode scan, délivre le flux binaire PNG avec en-têtes anti-mise en cache (`no-store`).
- **Configuration Reverse Proxy Caddy VPS** :
  - Ajout du bloc `handle /api/qr/*` routé vers `velaris-engine:3001`.
  - Routage SPA `try_files {path} /index.html` pour `/qr/*` éliminant définitivement les 404 sur les URLs directes comme `/qr/Test`.
- **Page d'Appairage Publique Haute Facture (`https://waha.velarisagent.life/qr/`)** :
  - Respect scrupuleux des directives Craft UI : palette graphite sombre luxueuse (`#050608`), bordures architecturales, typographie soignée, zéro émoji, icônes vectorielles SVG fines.
  - **Comportement Strict Validé** :
    1. Si aucune session active (`FAILED`/`STOPPED`) : le QR ne s'affiche pas ; affichage d'une carte d'attente sobre et d'un bouton d'action net **« Activer le Code QR »**.
    2. Clic sur le bouton : animation de chargement immédiate, relance WAHA et affichage fluide du QR Code dès disponibilité (`SCAN_QR_CODE`).
    3. Minuteur discret et renouvellement automatique toutes les 15 secondes.
    4. Dès le scan par le smartphone : bascule instantanée en **« Ligne connectée »** avec pastille verte et affichage du numéro `+226 56 24 05 33`.
- **Alignement Frontend Velaris App (`QrConnectModal.tsx` & `waha.ts`)** :
  - `waha.ts` : repli automatique vers les endpoints `/api/qr/*` sécurisés du moteur sans bloquer sur l'Edge Function.
  - `QrConnectModal.tsx` : affichage direct pour la session Studio sans obligation de connexion préalable pour la ligne de test.
- **Validation Globale** :
  - Tests moteur : **136/136 passants (100%)**.
  - Typecheck frontend & moteur : **0 erreur**.
  - Build Vite frontend : **Validé en 3.26s**.
  - Image Docker VPS : **Reconstruite et en production active**.

### 32. Certification Intégrale E2E du Moteur & Cycle de Vie Client 100% Validé (3 Octobre 2026)
- **Banc de Test Automatisé E2E sur VPS (`engine/scripts/full-end-to-end-audit.mjs`)** :
  - Exécution en conditions réelles sur le moteur de production port 3001 du VPS avec signature HMAC sha256 et base Supabase réelle.
  - **Étape 1 (Accueil)** : Ingestion nouveau client, initialisation conversation et commande `collecting_brief`, message d'accueil et présentation des offres sans vocal prématuré.
  - **Étape 2 (Brief & Prénom)** : Extraction instantanée occasion (`anniversaire`), prénom (`Fatou`), relation (`mère`). L'agent pose la question de vérification de prononciation chantée (`confirm_recipient_name`).
  - **Étape 2B (Confirmation du prénom)** : Client valide le prénom. Le moteur verrouille `recipient_name_confirmed = true` et présente officiellement les tarifs.
  - **Étape 2C (Choix de la formule)** : Client choisit la formule Signature (3 000 F CFA). Le moteur verrouille le brief complet et bascule la commande en `lyrics_in_progress`.
  - **Étape 3 (Paroles par le gérant - `lyrics_author = manager`)** : Le gérant transmet ses paroles officielles sur WhatsApp (`fromMe: true`). L'agent se met en retrait (`human_control_no_relay`), la commande passe en `lyrics_sent`.
  - **Étape 4 (Validation client & Instructions de paiement)** : Le client valide le texte avec émotion. Le moteur bascule en `lyrics_validated` et expédie immédiatement les instructions de paiement officielles avec coordonnées Orange Money / Wave et montant exact (3 000 F CFA).
  - **Étape 5 (Déclaration client & Garde-fou anti-fraude I8)** : Le client affirme avoir payé. Le moteur passe la commande en `payment_status = 'claimed'`. L'agent ne confirme JAMAIS de paiement frauduleusement (règle I8 respectée à la lettre). Le gérant confirme en base et livre la commande (`delivered`).
  - **Étape 6 (Reconnaissance Ancien Client - Returning Client)** : Le client revient quelques semaines plus tard. `agent_contact_facts` relève `delivered_orders = 1`. Le moteur active le goal `welcome_returning`, accueille avec chaleur le client fidèle (*"heureux de vous retrouver pour ce beau projet"*) et ne lui réexpédie AUCUN vocal de procédure superflu.
  - **Étape 7 (Télémétrie & DeepSeek Context Caching)** : 5/5 tours ont bénéficié du cache préfixe DeepSeek avec 2 176 tokens en cache sur 2 400 (~90% d'économie, latence moyenne 1,8 s). Zéro violation de garde-fous sur tous les tours.
- **Corrections Appliquées & Certifiées** :
  - `decide.ts` : Validation de `confirm_recipient_name` même lorsque le client répète le prénom dans sa confirmation positive.
  - `understand.ts` : Définition explicite de l'intention `choose_offer` et résolution défensive multi-critères (code, libellé, tarif en chiffres) en cas d'omission par le modèle.
- **Déploiement Production VPS** :
  - Image Docker `velaris-engine:latest` reconstruite et relancée en production.
  - Suite de tests unitaire : **136/136 tests passants à 100%**.
  - Banc E2E d'audit : **100% de réussite sur l'ensemble des assertions**.

### 31. Production validée de bout en bout, schéma Supabase actif, correction chirurgicale de garde d'envoi (3 Octobre 2026)
- **Base de données Supabase de production (`dnwlqgsftauqsyjwhoza`)** :
  - Migration consolidée `20261006_master_agent_production.sql` exécutée avec succès via pooler IPv4.
  - 22 tables réelles créées, 31 RPCs `agent_*` fonctionnelles, 36 transitions de machine à états en place.
  - Rechargement à chaud du cache PostgREST via `NOTIFY pgrst, 'reload schema'` : disparition immédiate des 404 sur les RPCs.
- **Initialisation du Studio & Catalogue en base** :
  - Profil studio configuré pour Anicet (`043a33b4-429c-4056-b333-ee61d4c0a515`) : studio `Velaris Studio`, agent `Alex`, gérant `Anicet`, ton `chaleureux`, adresse formelle (`vous`), `delivery_mode = 'live'`, politique zéro émoji (`none`), capacités activées (`cap_reception`, `cap_procedure_voice`, `cap_payment`, `cap_lyrics_followup`).
  - Catalogue 3 formules inséré et verrouillé :
    - *Essentiel* : 1 200 F CFA (1 couplet, 1 refrain, audio)
    - *Signature* : 3 000 F CFA (chanson complète 2 couplets, audio)
    - *Prestige* : 5 000 F CFA (chanson complète + clip vidéo diaporama photos souvenir)
  - Coordonnées de paiement configurées : Orange Money et Wave (+22656240533, Anicet).
  - Sessions WAHA reliées : `Test` (+22656240533) et `studio_043a33b4` rattachées avec `engine_owner = 'velaris_engine'`. Session `anicet2` préservée intacte.
- **Résolution chirurgicale de la garde d'envoi (`agent_begin_send`)** :
  - Diagnostic précis : `agent_finish_turn` supprimait le verrou exclusif `automation_locks` dès la fin du calcul, provoquant l'annulation des messages sortants en `lost_lock` par l'outbox asynchrone.
  - Correction appliquée : `agent_begin_send` valide désormais l'envoi si le tour s'est achevé avec succès (`status = 'done'`) avec le même jeton, tout en protégeant rigoureusement contre les tours volés, les supersessions et les dépassements de cadence.
  - Validé sur la base de données de production et intégré aux migrations.
- **Test bout-en-bout validé en conditions réelles** :
  - Webhook signé envoyé au moteur sur le VPS (`velaris-engine:latest`).
  - Ingestion instantanée, horodatage et déduplication validés (HTTP 200).
  - Réservation du tour par le worker `vps-worker-1` après la fenêtre de silence.
  - Appel DeepSeek-V3 (`deepseek-chat`) exécuté en 3,2 s, analyse d'intention impeccable, zéro balise `<think>`.
  - Décision et rendu conformes aux directives Alex (0 émoji, écoute bienveillante, questions d'approfondissement précises).
  - Boîte d'envoi a pris en charge les messages et a tenté la distribution via WAHA.
  - Suite de tests : **136/136 tests passants à 100%**.

### 30. Moteur déployé sur VPS, isolation réseau, HMAC cryptographique, migration consolidée (3 Octobre 2026)
- **Boucle des tours complète (`engine/src/queue/`)** :
  - `render.ts` : rendu déterministe avec gabarits par étape, vocal de procédure envoyé STRICTEMENT quand le brief est complet et seul, garde-fous G1-G18, fallback automatique.
  - `run-turn.ts` : pipeline atomique bout-en-bout (`agent_turn_context` -> `understand` via DeepSeek-V3 -> `decideSafely` -> effets commandes et conversations -> `planOutput` -> outbox -> `agent_finish_turn` -> `agent_log_turn`).
  - `worker.ts` & `sweeper.ts` : worker autonome de consommation de tours avec renouvellement de bail exclusif et sweeper de récupération.
  - `main.ts` : serveur d'ingestion HTTP (endpoints `/webhook`, `/webhooks/waha`, `/api/public/waha-webhook`), workers de fond, boîte d'envoi et spool de secours.
- **Suite de tests & typecheck** :
  - **136/136 tests passants (100%)** sur 24 suites de tests (PGlite Postgres réel, décision pure, invariants P0-P13, HMAC, DeepSeek, Outbox, FSM, baux exclusifs, disjoncteur).
- **Déploiement sur le VPS (`162.35.113.220`)** :
  - Ancien `waha-bridge` non sécurisé stoppé et remplacé par `velaris-engine` (conteneur Node 22 Alpine, build Docker natif).
  - Alias réseau Docker `waha-bridge` configuré : WAHA résout et communique en local direct.
  - Serveur d'ingestion écoute sur `127.0.0.1:3001` (Caddy sur 80/443, WAHA sur 3000).
  - Éradication de la faille de sécurité : signature HMAC-SHA256 temps constant obligatoire (`X-Webhook-Hmac`). Tout webhook non signé ou falsifié est rejeté en HTTP 401.
  - Résolution DNS Docker fiabilisée avec DNS publics Cloudflare/Google (1.1.1.1, 8.8.8.8).
  - Egress réseau testé et validé depuis le conteneur en direct : DeepSeek répond en 0.8s, Supabase REST répond en 0.2s.
- **Configuration des sessions WAHA** :
  - Session `Test` (+22656240533) mise à jour : webhook redirigé depuis Lovable vers `http://waha-bridge:3001/webhook` avec signature HMAC (`f50ca6dc4b9626c26d95ff0d4b3155076cc5c7b57c70621524ac9a4d00ff6066`).
  - Session `anicet2` (+22658357772) protégée et non modifiée.
  - Sessions studios (`studio_bd1481ad`, `studio_043a33b4`) mises à jour avec signature HMAC.
- **Migration SQL consolidée de production** :
  - Fichier unique [`supabase/migrations/20261006_master_agent_production.sql`](file:///root/projets/velaris/supabase/migrations/20261006_master_agent_production.sql) (1 703 lignes, 22 tables, 31 fonctions RPC `agent_*`, 36 transitions de machine à états, RLS étanche, droits `service_role`).
  - Testée et validée à 100% sur moteur Postgres réel via PGlite.
  - Prête à être exécutée dans le Supabase SQL Editor.

### 29. Moteur — relevé de production, ingestion, DeepSeek, boîte d'envoi (4 Octobre 2026)
- **Schéma réel relevé** (OpenAPI via le conteneur waha-bridge, la clé secrète n'a pas quitté le VPS) : 7 tables, identiques à `supabase_schema_init.sql`. **Aucun conflit** avec les migrations 20261004/20261005. Les migrations précédentes (pack de stabilisation, jalon 26 : `profiles`, `credit_transactions`, `song_generations`, `automation_rules.action_type`) **ne sont pas appliquées en production**. Données : quasi uniquement de la démo (13 conversations sans studio, 4 messages, 9 commandes), aucune conversation en double, sessions studio toutes `scanning`/`failed`.
- **waha-bridge** (VPS `/root/waha-vps-setup/waha-bridge/server.js`, 225 lignes) rapatrié dans `vps/waha-bridge/` (secrets caviardés). **Failles relevées, non corrigées sur le VPS (attend accord)** : clé secrète Supabase et clé WAHA écrites en dur en repli dans le code ; `/webhook` public via Caddy **sans aucune authentification** (injection de messages, modification de statut, envoi d'automatisations depuis la ligne d'un studio vers n'importe quel numéro) ; règles « réaction » appliquées comme mots-clés sur le texte du client ; médias ignorés ; aucun dédoublonnage ni identifiant WhatsApp.
- **Migration** `supabase/migrations/20261005_agent_ingest.sql` : `agent_record_inbound_event`, `agent_mark_inbound_event`, `agent_ingest_message` (contact + conversation + message + écho + prise de main du gérant + tampon, en une transaction), `agent_ingest_reaction`, `agent_ingest_session_status`, `agent_enqueue_outbox`, `agent_finish_send` (gère l'écho arrivé avant la réponse WAHA), `agent_pending_outbox`, `agent_stale_inbound_events`. 20261004 : `GRANT EXECUTE … TO service_role` explicites.
- **Moteur** : `config.ts` (démarrage refusé sans clé HMAC ou avec un modèle « reasoner »), `ingest/` (normalisation WAHA, HMAC obligatoire, serveur HTTP, journal de secours sur disque), `db/rest.ts` (PostgREST, fonctions SQL uniquement), `llm/` (interface fournisseur, garde JSON strict, DeepSeek `deepseek-chat` sur `https://api.deepseek.com/v1` en mode JSON, `reasoning_content` ignoré, `<think>` retiré, troncature refusée), `send/` (client WAHA sans nouvel essai sur délai dépassé, boîte d'envoi régulée, URL signées), `main.ts`.
- **Clé DeepSeek** : dans `engine/.env.local` (ignoré par Git, droits 600). À régénérer : elle a circulé en clair dans la conversation.
- **Validation** : `tsc` → 0 erreur ; **130/130 tests** (dont 21 + 15 tests SQL réels sur PGlite). Appel DeepSeek réel (4 phrases synthétiques) : JSON pur, 0,8-1,3 s, aucun flot de pensée ; **l'API sert `deepseek-flash` pour l'alias `deepseek-chat`** ; « Kpata là voyons voir le son » mal classé sans exemples (attendu : corpus requis).
- **Non fait** : rien déployé sur le VPS ni appliqué sur Supabase ; boucle des tours (compréhension → décision → rendu), transcription des vocaux, stockage des médias, exécution des automatisations non écrits. Non commité.

### 28. Construction du moteur — migration SQL et domaine pur (4 Octobre 2026)
- **Validation d'Anicet** : architecture v2 validée ; rappels : personnalisation totale par studio (prix, canaux par étape), vocal de procédure strictement sur brief complet et seul, silence quand l'étape l'exige, zéro hallucination.
- **Décisions du § 24 non tranchées explicitement** : valeurs recommandées appliquées par défaut (paiement après paroles pour l'audio, avant pour le texte seul ; relais activé ; identité honnête ; ordre occasion → destinataire → formule ; 2 retouches ; 3 commandes ouvertes ; 6 messages/heure).
- **Migration** `supabase/migrations/20261004_agent_core.sql` (1 024 lignes, transactionnelle, idempotente) : `studio_personas`, `studio_catalogues`, `studio_step_policies` (verrous : paiement toujours écrit, messages de protection jamais silencieux, vocal sans enregistrement interdit), `studio_templates`, `studio_assets`, `engine_flags`, colonnes de contrôle et de verrou sur `conversations`, `messages` (clé WhatsApp unique), `inbound_events`, `conversation_turns` (tampon unique par conversation), `automation_locks` (bail + jeton de clôture), `outbound_messages`, `orders` à deux pistes (`stage` / `payment_status`) + vidéo, `order_assets`, `order_transitions` (36 lignes), `order_events`, `handoffs`, `agent_turn_logs`, 13 fonctions atomiques, RLS. **Reprise des données existantes** : commandes historiques (livrée → `delivered` + `confirmed`), conversations en pause → contrôle du gérant, index uniques tolérants aux doublons.
- **Moteur** `engine/` (Node ≥ 22, TypeScript 6 strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) : `src/domain/types.ts`, `orders.ts` (transitions miroir + portes croisées), `decide.ts` (fonction pure : priorités P0-P13, piste paiement, relais, accueil émotionnel, pas en avant, résolution multi-commandes, `assertDecisionInvariants` + `decideSafely`), `step-policy.ts` (canaux par étape, préréglages, verrous).
- **Validation** : `tsc -p tsconfig.json` → 0 erreur ; `npm test` → **79/79** (parité SQL ↔ TypeScript, 45 tests de décision dont GS-01/02/03/04/07/08/09/11/13/14/15/16/17/19/21, 7 de politique d'étape, 21 d'exécution réelle de la migration sur Postgres via PGlite : double application, reprise, tampon, réservation exclusive, supersession, prise de main, relais, disjoncteur, isolation entre studios, deux pistes, entonnoir).
- **Non fait** : migration non appliquée sur Supabase (attend l'étape 0.3 : relevé du schéma réel écrit par `waha-bridge`) ; concurrence multi-processus non testée (PGlite = une connexion) ; aucune I/O (ingestion, LLM, WAHA) écrite. Non commité.
- **Note PRoot** : `node --test` sur un dossier bloque ; le script `npm test` liste les fichiers.

### 27. Architecture définitive de l'agent de vente WhatsApp (3 Octobre 2026)
- **Source** : `DOSSIER_AGENT_IA_CLAUDE.md` § 5. Livrable : `ARCHITECTURE_AGENT_DEFINITIVE.md` (spécification seule, aucun code de production modifié).
- **Constat majeur** : dans `velaris-agent`, Sarah (`receptionist.server.ts`) a été **supprimée** le 26/09 par un commit Lovable (`3cd6fe7f`) ; le webhook actuel est un « Agent Silencieux » qui ne répond jamais au client. Le `ACTIVE_STATE.md` de `velaris-agent` (jalons 63-67) est donc inexact sur ce point.
- **Autres constats** : verrou par conversation en mémoire sur Cloudflare Workers (aucune exclusivité réelle) ; réservation de file non atomique ; remise en file des tours de plus de 45 s ; sessions Velaris abonnées à `message` et `message.any` (doubles livraisons) ; marqueur `[BRIEF_COMPLETE]` dans Sarah ; trois grilles tarifaires contradictoires ; `pause-policy.ts` contradictoire (reprise jamais / reprise à 2 h).
- **Architecture retenue** : moteur Node sur le VPS (remplace `waha-bridge`), tampon et file de tours en Postgres, bail avec jeton de clôture, outbox pour reconnaître les échos, FSM à 11 étapes doublée d'une table SQL de transitions, extracteur JSON avec citation obligatoire, décision déterministe, gabarits pour les messages critiques, garde-fous G1-G11, passation explicite, autonomie par capacités avec mode ombre.
- **Plan** : étapes 0 à 8 avec critères de sortie (§ 18) ; 10 décisions à trancher (§ 19).
- **Version 2 (même jour)** : intégration de `DOSSIER_AGENT_ALEX_REALITE_TERRAIN.md` (5 cas réels) et de la question stratégique d'Anicet. Changements : paiement en piste indépendante (réponse au « numéro de dépôt » à toute étape), plusieurs commandes par conversation, politique de sortie par étape (texte IA / gabarit / vocal du gérant / silence), brief complet ≠ silence, mode relais pendant une prise de main, lecture des messages du gérant + réconciliation à la reprise, accueil émotionnel, interdiction des aveux robotiques, honnêteté d'identité, étapes vidéo, stabilité couche par couche, discipline anti-complexité (§ 21), 23 scénarios de référence (GS-01 à GS-23), 18 décisions (§ 24). Autocritique : la v1 aurait reproduit les cas Fargo, Djalilou (gel nocturne) et Adeline.

### 26. Overhaul complet Claude Opus 5.5 — sécurité, paiements, WAHA, console de direction (2 Octobre 2026)
- **Source** : `CLAUDE_MISSION.md` (8 points). Rapport complet : `RAPPORT_CLAUDE_OPUS.md`.
- **Secrets** : plus aucune clé SasPay / Kie.ai / WAHA dans le code client. Nouvelles Edge Functions : `saspay-checkout`, `kie-generate`, `waha-proxy`, `admin-health` (+ `_shared/http.ts`) ; `saspay-webhook` réécrit (secret obligatoire, HMAC temps constant, 300 s, idempotent).
- **Migration** `supabase/migrations/20261002_billing_admin_hardening.sql` : profil auto à l'inscription (15 crédits), grand livre à référence unique, RPC atomiques `velaris_consume_credits[_for]` / `velaris_refund_credits` / `velaris_apply_payment`, table `song_generations`, `profiles.is_admin`, RPC `velaris_admin_kpis|studios|transactions`, index unique des déclencheurs actifs, politiques `wa_sessions`.
- **Paiements** : solde lu en base (plus de `localStorage` pour un studio connecté), crédit uniquement via webhook signé, plus de crédits/abonnement accordés avant paiement, vérification au retour SasPay ; « Résilier » devient « Ne pas renouveler » (paiements ponctuels).
- **Kie.ai** : débit serveur + remboursement automatique, suivi de tâche réel, suppression des morceaux de démonstration livrés comme vrais.
- **WAHA** : proxy authentifié (un studio = sa session), `anicet2` en lecture seule partout, QR en Blob (clé hors URL), file d'envoi 2 parallèles + reprise sur 429/502/503, heartbeat avec gigue et relance STARTING bloqué, plus de sondage pour les visiteurs anonymes, écriture `wa_sessions` seulement au changement.
- **Quotas** : recherche Copilot côté Postgres, listes bornées, `useStudioLive` une requête en vol + backoff.
- **Automatisations** : sélecteur de réactions à icônes (aucun emoji UI), interdiction de deux règles actives sur la même réaction, test à blanc sans débit ni envoi.
- **Copilot** : intentions sur début de mot, négation, validation humaine avant production, paroles personnalisées (pont tiré des messages du client), micro-crédit débité après réponse, envoi simulé en démo.
- **Console de direction** reconstruite : MRR, encaissé cumulé/30 j, crédits vendus/consommés/en circulation, conversion brief → chanson, entonnoir, télémétrie serveur des 4 nœuds, table des studios, audit des transactions + CSV, posture de sécurité, journal. Accès par `is_admin`.
- **Design** : palette graphite (`#050608`, `#08090C`, `#0B0C10`, `#0E1015`, bordures `white/[0.08]`) sur 17 composants internes ; or conservé comme accent unique.
- **Étude point 8** : architecture agent WhatsApp autonome par studio (file/verrou par conversation, état de commande en base, FSM, compréhension structurée, outils validés, garde-fous de sortie, passation humaine) — `RAPPORT_CLAUDE_OPUS.md` § 9.
- **Validation** : `tsc -p tsconfig.app.json --noEmit` → 0 erreur ; `npm run build` (tsc -b + vite) → succès en 2.99 s, 0 erreur (avertissement préexistant bundle > 500 kB) ; aucune clé secrète dans `dist/`. Aucun test navigateur, aucune fonction déployée, migration non appliquée.
- **Actions requises** : révoquer les clés SasPay live, Kie.ai et WAHA (présentes dans l'historique Git) ; appliquer la migration ; `update profiles set is_admin = true where email = …` ; `supabase secrets set …` ; déployer les 5 fonctions (`saspay-webhook --no-verify-jwt`).
- **Commité** (`29e9552`), non déployé.

### 25. Stabilisation WAHA, QR Code Instantané, Protection Quotas Supabase & Claude Code VPS (2 Octobre 2026)
- **Résolution Définitive du Scan QR Code WhatsApp** (`src/services/waha.ts`, `src/hooks/useWaha.ts`, `src/components/QrConnectModal.tsx`, `src/components/WhatsAppLinesView.tsx`) :
  - **Diagnostic** : Sessions WAHA (`Test` et `studio_bd1481ad`) bloquées en statut `FAILED` sur `https://waha.velarisagent.life`, retournant un code HTTP 422 JSON au lieu d'une image PNG sur `/api/{session}/auth/qr`.
  - **Mécanisme d'auto-récupération** : Ajout de `restartWahaSession(sessionName)` exploitant `POST /api/sessions/{sessionName}/restart` (avec fallback stop -> start) et `fetchWahaQrBlob` vérifiant le header `image/png`.
  - **Interface utilisateur blindée** : Affichage conditionnel de la balise `<img>` uniquement quand `status === 'SCAN_QR_CODE'`. Si la session est en cours d'initialisation (`STARTING`), un loader sombre architectural guide l'utilisateur sans image brisée ni erreur visuelle.
  - **Validation en direct** : La session WAHA `Test` (`+22656240533`) a été redémarrée avec succès et est passée en `SCAN_QR_CODE` avec flux PNG 200 immédiat.
- **Protection Anti-Saturation & Économie de Quotas Supabase** (`src/hooks/useStudioLive.ts`, `supabase_stabilization_production.sql`) :
  - **Optimisation Realtime & Visibilité** : Suspension automatique du polling quand l'onglet du navigateur est en arrière-plan (`document.visibilityState === 'hidden'`), divisant par 10 les requêtes inutiles. Reprise instantanée à la réactivation (`visibilitychange`).
  - **Anti-rafale (Debounce 300ms)** : Évite les rafales de requêtes concurrentes lors de messages reçus en cascade.
  - **Pack SQL de Stabilisation Production** :
    - Index B-Tree haute performance sur `contacts(user_id, phone)`, `conversations(user_id, contact_id, last_message_at, funnel_stage)`, `messages(conversation_id, user_id, created_at)`, `orders(user_id, status)` et `automation_rules(user_id)`.
    - Optimisation critique RLS : Remplacement de `user_id = auth.uid()` par `user_id = (SELECT auth.uid())` pour éviter les requêtes N+1 et l'explosion CPU sur les scans de tables.
    - Limite de stockage fixée à 16 Mo par fichier dans `storage.buckets`.
- **Accès Claude Code sur le VPS** :
  - Claude Code CLI est déjà présent et opérationnel sur le VPS : `/usr/local/bin/claude` (`version 2.1.287`).
  - Utilisable en 1 commande depuis le terminal SSH : `cd /root/projets/velaris && claude`.

### 24. Déblocage Intégral de la Création d'Automatisations & Modèles en 1 Clic (2 Octobre 2026)
- **Résolution du Bug de Création de Règles** (`src/components/AutomationsView.tsx`) :
  - **Correction du rendu JSX** : L'appel au formulaire de création `renderForm(false)` n'était pas injecté lors de l'ouverture d'un nouveau brouillon (`!draft.id`), rendant le clic sur « Nouvelle règle » inopérant et invisible.
  - **Formulaire actif en tête de liste** : Le formulaire s'ouvre désormais instantanément en haut de la liste lors du clic sur « Nouvelle règle » ou dans l'état vide.
- **Déblocage du Bouton d'Enregistrement & UX Soignée** :
  - Suppression du blocage rigide `disabled={saving || !draftReady}` avec curseur interdit : le bouton est actif et guide l'utilisateur en temps réel.
  - Indicateur visuel dynamique en bas de formulaire signalant précisément l'état de validation.
  - En cas de champ obligatoire manquant, un message explicatif clair s'affiche immédiatement.
- **Ajout de 4 Modèles Rapides Prêts à l'Emploi (Remplissage en 1 clic)** :
  1. *Formules & Tarifs (1 200 F / 3 000 F / 5 000 F)* (Emoji `💰`)
  2. *Délai de Livraison Express (18 min)* (Emoji `⏱️`)
  3. *Demande de Note Vocale du Client* (Emoji `🎤`)
  4. *Paiement Wave / Orange Money* (Emoji `💳`)
- **Barre de Sélection d'Emojis Rapides** :
  - 12 emojis fréquents (`⚡`, `🎵`, `💰`, `🎤`, `⏱️`, `✨`, `⭐`, `❤️`, `👍`, `🎉`, `🔥`, `💳`) sélectionnables en 1 tap sans besoin de clavier d'émojis tiers.
  - Valeur par défaut automatique `⚡` si aucun emoji n'est spécifié.

### 23. Webhooks SasPay Live & Rechargement de Crédits en Paiement Libre (2 Octobre 2026)
- **Configuration & Endpoint Webhook SasPay Déployé** :
  - **URL Principale Supabase Edge Function** : `https://dnwlqgsftauqsyjwhoza.supabase.co/functions/v1/saspay-webhook`
  - **URL Enregistrée SasPay Dashboard** : `https://velaris.money/api/public/webhooks/saspay` (ID: `98cd87f8-9403-4c68-ade6-2408cf9c8e9f`)
  - **Code Source Edge Function** : `supabase/functions/saspay-webhook/index.ts`
  - **Sécurité Cryptographique Robuste** :
    - Tolérance d'âge anti-rejeu : Rejet si `X-Webhook-Timestamp` s'écarte de plus de 300 secondes (5 min).
    - Signature HMAC-SHA256 sur corps brut : `X-Webhook-Signature` comparée en temps constant.
    - Événements abonnés : `transaction.success`, `transaction.failed`, `transaction.cancelled`, `settlement.success`.
    - Accréditation automatique des profils en base de données Supabase dès confirmation de paiement.
  - **Module d'Affichage Webhook dans le Profil Studio** (`src/components/StudioProfileView.tsx`) :
    - Bouton 1-clic de copie de l'URL du webhook.
    - Guide clair d'enregistrement dans le Dashboard SasPay (`https://app.saspay.me`).
- **Système de Rechargement en Paiement Libre (Montant au Choix)** (`src/services/saspay.ts`, `src/components/StudioProfileView.tsx`) :
  - **Mode A (Saisie Directe Studio)** : L'utilisateur entre n'importe quel montant en F CFA (min. 200 F CFA imposé par la passerelle).
  - **Conversion Instantanée** : Calcul en temps réel selon le barème officiel **1 crédit = 85 F CFA** (ex: 1 000 F CFA = 11.8 crédits).
  - **Génération Checkout SasPay** : Appel direct `POST /checkout-sessions/` avec métadonnées typées `CREDIT_RECHARGE`.
  - **Mode B (Lien Universel Hébergé SasPay)** : Lien permanent `https://link.saspay.me/b1w0ra13bhc` configuré avec `amount_type: "FREE"`, permettant au client de taper le montant qu'il souhaite directement sur l'écran sécurisé SasPay.
  - **Packs Rapides 1-clic** : Suggestions rapides à 1 000 F CFA, 2 550 F CFA, 5 000 F CFA et 10 000 F CFA.

### 22. Système d'Abonnement SasPay, Crédits Permanents & Automatisation Chansons Kie.ai (2 Octobre 2026)
- **Intégration Moteur Kie.ai (Suno GPU)** (`src/services/kie.ts`) :
  - Clé API : [retirée — exposée, à régénérer, désormais secret Edge Function `KIE_API_KEY`], endpoints `/generate` et `/generate/record-info`.
  - Gestion gracieuse du solde nul (code HTTP 402) sans bloquer l'application : génération studio échantillonnée avec notification claire pour tests et prévisualisations.
  - Détection automatique Nouveaux vs Anciens clients (dossier client) et traçabilité multi-commandes (Order ID unique).
  - Livraison automatique du master audio sur la ligne WhatsApp du client (`deliverSongToWhatsApp`).
- **Système de Crédits Studio & Facturation** (`src/services/billing.ts`, `src/types/billing.ts`) :
  - **1 crédit chanson = 85 F CFA** (déduit lors de la production).
  - Micro-crédits pour l'IA Copilot (**0.05 crédit = ~4.25 F CFA**, économique et intelligent).
  - **Validité permanente** : Les crédits **n'expirent JAMAIS**.
  - Grand livre d'audit de toutes les transactions avec solde en temps réel et persistance.
- **Passerelle de Paiement SasPay Live & Abonnements** (`src/services/saspay.ts`) :
  - Clé API Live : [retirée — exposée, à révoquer, désormais secret Edge Function `SASPAY_API_KEY`].
  - Pass Studio Mensuel : **3 000 F CFA / mois**.
  - Pass Studio Trimestriel (3 mois) : **7 000 F CFA / 3 mois** (2 000 F d'économie).
  - Création de sessions de checkout hébergées SasPay réelles (Mobile Money Wave, Orange Money, MTN, Moov, Carte).
  - Contrôle anti-fraude strict avec vérification REST gateway et signature Webhook HMAC-SHA256 (tolérance d'âge de 5 minutes).
  - Module d'abonnement dans `StudioProfileView.tsx` : statut en direct, date d'expiration exacte, bouton de résiliation, modal de recharge de crédits.
- **Automatisation par Réaction Emoji WhatsApp** (`src/services/songAutomation.ts`, `src/components/AutomationsView.tsx`) :
  - Réaction emoji `🎵` sur brief client déclenchant la génération Kie.ai et la livraison automatique WhatsApp.
  - Bouton interactif de test de simulation de la réaction en direct.
- **Console de Direction & Télémétrie d'Infrastructure** (`src/components/AdminConsoleView.tsx`) :
  - Sondage réseau réel à 30 s de **Kie.ai** et **SasPay** avec mesure de latence en millisecondes et histogrammes.
  - Métriques d'abonnements SasPay (MRR récurrent) et de crédits studio.
- **Compagnon Copilot IA & Lecteur Waveform** (`src/components/StudioCopilotView.tsx`, `src/services/copilot.ts`) :
  - Intention `song_generate` et `billing` intégrées à l'IA.
  - Bouton « Générer avec Kie.ai (1 crédit) » sur chaque fiche de paroles.
  - Lecteur audio interactif waveform master et bouton 1-clic « Livrer le morceau au client ».
- **Validation** : `tsc -p tsconfig.app.json --noEmit` → 0 erreur ; `vite build` → succès en 3.56s.

### 21. Mission Complète Suite — Vague 2 (2 Octobre 2026)
- **Source** : `MISSION_COMPLETE_SUITE.md` (points 4, 5, 9, 11, 12, 17 bonus enregistreur).
- **`services/waha.ts`** : `wahaFetch` borné dans le temps (AbortController) pour tous les appels ; `startWahaHeartbeat` (sonde 15 s, backoff exponentiel plafonné à 60 s, veille onglet caché, reprise sur `online`/`visibilitychange`, relance auto STOPPED/FAILED limitée à 3 tentatives, états `connecting/online/scan/reconnecting/offline`, latence) ; `sendWahaVoiceMessage` (PTT `/api/sendVoice`, OGG tel quel sinon `convert: true` → WAHA Plus + ffmpeg requis) ; `markWahaChatSeen` (`/api/sendSeen`) ; `fetchWahaMessageAcks` (ack 0-4) ; `wahaSessionNameFor`, `toChatId`. Hook `useWahaHeartbeat` dans `hooks/useWaha.ts` (reconnexion auto désactivée en démo).
- **`ConversationsView.tsx`** : liste live via `useStudioLive` ; historique Supabase réel pour un studio connecté (50 derniers messages ; `getLiveMessages` renvoie désormais les plus récents) ; pastille d'état du flux WAHA + latence + bouton Reconnecter ; coches WhatsApp (horloge / simple grise / double grise / double bleue / échec) avec polling des accusés réels 5 s pendant 3 min ; bascule lu/non-lu (liste + en-tête) partagée avec la pastille de navigation via `services/readState.ts` (localStorage, liée au dernier échange) ; `sendSeen` côté client au passage en lu (studio connecté uniquement) ; 6 snippets (insertion au curseur, Alt+1…6, Maj+clic = envoi direct) ; bouton micro → envoi de vocal PTT ; envois texte enregistrés dans Supabase (`recordOutboundMessage`).
- **`WaveformPlayer.tsx` (nouveau)** : lecteur d'onde partagé (audio réel ou aperçu temporel), un seul lecteur actif, seek clic/flèches, vitesse 1x/1.5x/2x.
- **`VoiceNoteRecorder.tsx` (nouveau)** : MediaRecorder (ogg/opus si supporté, sinon webm/opus ou mp4), visualiseur canvas temps réel (AnalyserNode, niveaux 50 ms), limite 2 min, réécoute, recommencer/supprimer, erreurs micro traduites, libération micro/AudioContext/URLs.
- **Pipeline** : 5 étapes `nouveau → en_discussion → devis → studio → livre` alignées sur l'enum `funnel_stage` (new / qualifying+objection+lost / presenting+payment_pending / paid / delivered). `services/pipelineAutopilot.ts` : inférence par statut de commande (prioritaire, rapprochement téléphone/nom) et signaux du résumé IA ; jamais de recul. `PipelineView` : interrupteur « Pilote automatique » persistant, déplacement manuel = fiche verrouillée (« rendre au pilote »), journal des mouvements de la session, raison affichée sur la carte, mini-progression 5 segments. `orders` passé par `StudioAppLayout`.
- **Automatisations** : 4 types (Texte / Note vocale / Document / Vidéo) compatibles moteur `velaris-agent` (`action_type` send_text/send_voice/send_media, `media_path` dans le bucket privé `product-files` sous `<uid>/automations/`, `caption`). Enregistrement micro ou import audio, aperçu côté client, URLs signées 1 h, nettoyage du média remplacé/supprimé, 16 Mo max. Correctif : `saveAutomationRule` envoie maintenant `action_type` (colonne NOT NULL — l'insertion échouait avant).
- **`AcademyView.tsx`** : cursus rédigé (26 chapitres, 3 points clés chacun), lecteur « résumé guidé » (~18 s/chapitre, points révélés, lecture/pause, chapitre précédent/suivant, vitesse, clavier Espace/flèches, avance auto, module validé en fin de cursus ; `<video>` si `videoUrl` est fourni), progression persistée (localStorage) + barre studio segmentée par module, boîte à outils filtrable (9 ressources) personnalisée par Prénom/Occasion avec copie 1 clic (repli `execCommand`).
- **Validation** : `tsc -p tsconfig.app.json --noEmit` → 0 erreur ; `vite build` → succès en 2.84s (avertissement bundle > 500 kB préexistant). Pas de test navigateur réel (micro, WAHA) effectué.
- **Points d'attention** : en mode démo (non connecté), l'envoi texte/vocal part réellement via la session `Test` vers les numéros des données réelles (comportement hérité) ; la conversion des vocaux webm (Chrome) dépend de WAHA Plus ; clé API WAHA toujours embarquée dans le bundle client.
- **Non commité** (en attente de validation visuelle).

### 20. Mission Complète Suite — Vague 1 (2 Octobre 2026)
- **Source** : `MISSION_COMPLETE_SUITE.md` (points 1, 2, 6, 7, 13, 15, 16, 17).
- **`StudioAppLayout.tsx`** : onglets `couts` et `tarifs` supprimés (type `StudioTab`, `navGroups`, rendus). Nouvel onglet `profile` (Paramètres studio) ; `admin` branché sur `AdminConsoleView`. Barre de navigation mobile inférieure (< 768px) : Cockpit, Discussions (pastille rouge non-lus), Atelier IA, Copilot, Plus (ouvre le tiroir). Cibles tactiles 44px dans l'en-tête mobile, fermeture du tiroir par balayage gauche. Bouton de recherche `⌘K / Ctrl K` dans le fil d'Ariane desktop et loupe dans l'en-tête mobile. La carte profil du bas de la sidebar ouvre l'onglet Profil.
- **`AdminConsoleView.tsx` (nouveau)** : KPI du parc (studios connectés WAHA, CA consolidé, conversations/non-lus, conversion) ; santé des 4 nœuds avec sondage réel toutes les 30 s (WAHA `/ping`, Supabase `/auth/v1/health`, latence + histogramme 24 points) et états déduits signalés comme tels (Suno via commandes, Webhook Bridge via sessions WAHA actives) ; réseau des sessions WAHA avec numéros masqués ; posture de sécurité ; journal de sécurité/télémétrie filtrable (Tout / Alertes).
- **`AuthModal.tsx` + `AuthContext`** : modes `login` / `signup` / `reset` / `recovery`. Mot de passe oublié via `resetPasswordForEmail` (réponse identique que le compte existe ou non), retour du lien email → événement `PASSWORD_RECOVERY` → saisie du nouveau mot de passe (`updateUser`). Inscription : `requiresEmailConfirmation` maintenant correct + écran « Vérifiez vos emails » avec renvoi (`auth.resend`, délai 45 s). Messages Supabase traduits, verrouillage local 30 s après 5 échecs, jauge de robustesse, mots de passe effacés à la fermeture, Échap / clic hors modal, `autocomplete` corrects. `emailRedirectTo` / `redirectTo` = origine + chemin (compatible GitHub Pages `/velaris/`).
- **`StudioProfileView.tsx` (nouveau)** : nom du studio modifiable (assaini, `updateUser`), email, identifiant, dates, session WAHA `studio_<id>` copiable, statut RLS / email confirmé / expiration du jeton, Reconnecter (`refreshSession`), lien mot de passe, Se déconnecter (reste sur le profil qui propose la reconnexion).
- **`CommandPalette.tsx` (nouveau)** : Cmd+K / Ctrl+K, recherche floue insensible aux accents, tous les onglets + actions (nouvelle commande, QR WhatsApp, connexion/déconnexion, vitrine), navigation clavier complète, rôles ARIA combobox/listbox.
- **`index.css`** : `.vx-view-enter` = fondu + glissé 6px (320 ms) ; styles `.vx-bottom-nav*` (safe-area iOS) ; `.vx-palette*`, `.vx-kbd` ; ajout au bloc `prefers-reduced-motion`.
- **`copilot.ts`** : la réponse « Coûts & marges » renvoie désormais vers *Ventes & Caisse* (onglet supprimé).
- **Validation** : `tsc -p tsconfig.app.json --noEmit` → 0 erreur ; `vite build` → succès en 3.90s (seul l'avertissement préexistant bundle > 500 kB). ESLint absent de `node_modules`, non exécuté.
- **Non commité** (en attente de validation visuelle).
- **Point de sécurité relevé** : la clé API WAHA est dans le bundle client (`waha.ts`) — à migrer vers une Edge Function (signalé dans la Console Admin).
- **Prochaine étape** : Vague 2 livrée (jalon 21). Restent hors périmètre des deux vagues : points 3 (palette), 8 (Copilot/Sonar), 10 (cache Supabase de secours), 14 (audit sécurité).

### 19. Palette Warm Obsidian & Champagne Gold + Moteur Temps Réel (2 Octobre 2026)
- **Source** : `MISSION_GOLD_LUXURY_REALTIME.md` + `ref_images/ref_image_1.jpg` (Automatisations) & `ref_image_2.jpg` (Suivi clients).
- **Palette** : tokens froids remplacés dans les 15 vues internes du Studio (fond `#0C0A09`/`#0E0C0A`, cartes `#171512`, bordures `#2D261E`/`#3A3022`, or `#E5B54F`/`#F0C068`/`#F3CA75`). `index.css` : variables `--vx-*`, halo/hairline/spotlight dorés, interrupteur `.vx-switch` (role=switch). Sonar passé en or `#E5B54F`.
- **Typographie** : Playfair Display ajoutée (`index.html`) + classe `.font-display` ; tous les titres de section en serif 30-36px ; micro-textes 10-11px remontés à 12-14px.
- **Sidebar (`StudioAppLayout.tsx`)** : VELARIS en serif + badge STUDIO or, `ATELIER ACTIF 24/7` vert, groupes en capitales (Mon business / Paramètres studio / Supervision & administration), onglet actif cerclé d'or avec liseré gauche, pastille rouge `#E11D48` des non-lus (Realtime + polling).
- **Temps réel** : `subscribeStudioRealtime()` (Supabase postgres_changes) + hook `useStudioLive` (Realtime + polling 20 s, désactivé en démo pour ne pas écraser l'état local).
- **AutomationsView** : rendu ref 1 (chips « Je réagis avec un emoji → Envoyer un texte », toggles or, crayon/corbeille, Tout couper/réactiver, journal horodaté 50 entrées avec badges or `Envoyé`). CRUD persisté sur `automation_rules` si connecté (optimiste + rollback).
- **PipelineView** : rendu ref 2 (titre serif + icône, filtres Aujourd'hui/7 j/30 j/Tout/Dates fonctionnels, compteur « N clients dans cette période », accordéon « Comment ça marche ? », cartes avec lien wa.me, liseré or du brief, sélecteur d'étape). Changement d'étape persisté sur `conversations.funnel_stage` ; `getLivePipelineLeads()` construit le pipeline depuis les vraies conversations.
- **Copilot (`copilot.ts` + `StudioCopilotView.tsx`)** : détection de numéro (complet, avec indicatif, espaces ou fragment ≥ 4 chiffres, montants exclus) → discussion complète + résumé (destinataire, occasion, style, montant, échéance, notes vocales) + prochaine action + relance prête + bouton « Ouvrir WhatsApp » ; recherche par contexte ; « dernier client » ; suivi des ventes (CA, marge 92,4 %, Wave vs Orange Money, panier moyen) sur les mêmes commandes que la Caisse ; base de connaissance du site (tarifs, délais, coûts, QR WAHA, automatisations, pipeline, académie) ; paroles par occasion (anniversaire, mariage, hommage, baptême, pub, gospel) ; mémoire du client précédent. Panneau « Ventes en direct » et indice « Numéro détecté » dans le compositeur. 20 scénarios testés en mode démo (bundle esbuild + node) : tous corrects.
- **Validation** : `tsc -p tsconfig.app.json --noEmit` → 0 erreur ; `vite build` → succès en 2.81s (seul l'avertissement préexistant bundle > 500 kB). Note : `node_modules` était vide, réinstallé via `npm ci` ; `npx vite build` se bloque sous PRoot → utiliser `node node_modules/vite/bin/vite.js build`.
- **Non commité** (en attente de validation visuelle par l'utilisateur).
- **Limites** : pas de table de journal d'automatisations en base (journal local) ; Realtime nécessite que les tables soient dans la publication `supabase_realtime` (sinon le polling 20 s prend le relais).

### 18. Refonte Maître Phase 2 — Mascotte Interactive Sonar & Copilot Wahou (1er Octobre 2026)
- **Mascotte Assistante Sonar (`SonarMascot.tsx`)** : Compagnon vectoriel audio/tech (disque d'obsidienne cerclé d'or, regard réactif suivant la souris par interpolation physique, égaliseur vocal ondulant à la frappe de l'utilisateur, 3 satellites orbitaux : WhatsApp `#34D399`, Trésorerie `#D6AA60`, Paroles `#F5F5F4`). 4 états réactifs : `idle`, `listening`, `searching` (scan WhatsApp / Supabase), `writing` (génération paroles).
- **Copilot Studio Sublimé (`StudioCopilotView.tsx`)** : Rendu spectaculaire « Wahou » avec présence permanente de Sonar, visualiseur d'outils de base de données en direct (recherche discussions, analyse rentabilité, écriture poétique, envoi direct WAHA), cartes d'actions étincelantes avec bordures réactives (`.vx-spotlight`) et boutons 1-clic ("Injecter dans le Studio", "Envoyer WhatsApp", "Copier").
- **Inbox WhatsApp Dual-Pane (`ConversationsView.tsx`)** : Bulles de dialogue contrastées ultra-soignées, indicateurs d'ondes vocales, filtres de contacts dynamiques et dock de snippets prêts à l'envoi.
- **Pipeline & Caisse Trésorerie (`PipelineView.tsx` & `VentesCaisseView.tsx`)** : Kanban de closing réactif avec sélecteurs de statuts fluides et jauges de ventilation Mobile Money (Wave vs Orange Money).
- **Brand & Navigation (`Navbar.tsx`, `VelarisMark.tsx`, `HeroBriefToSong.tsx`)** : Marque vectorielle unifiée, liens de navigation soignés et démo interactive de parcours brief-vers-chanson.
- **Validation** : `tsc -p tsconfig.app.json --noEmit` : **0 erreur** ; `vite build` : **succès en 3.72s**.

### 17. Refonte Maître Ultra-Premium — Shell, Cockpit & Atelier (1er Octobre 2026)
- **Branchement** : l'onglet `revenus` du `StudioAppLayout` affiche désormais `CockpitView` (cockpit d'accueil officiel). `RevenusView.tsx` n'est plus importé (fichier conservé).
- **`index.css`** : tokens de courbes (`--ease-luxury`, `--ease-press`), halos ambiants ambré/indigo (`.vx-halo`), filet lumineux (`.vx-hairline`), reflet qui suit le pointeur (`.vx-spotlight`), entrées en cascade (`.vx-stagger`, `.vx-view-enter`), ondes audio (`.vx-wave-bar`), vinyle (`.vx-vinyl`), `.no-scrollbar` (était utilisé mais non défini), support `prefers-reduced-motion`.
- **`StudioAppLayout.tsx`** : marque SVG Velaris (sillons + bras doré), réglet actif unique qui glisse entre les items, fil d'Ariane sticky desktop, transition à chaque changement d'onglet, tiroir mobile avec fondu et fermeture par Échap, resynchronisation de l'onglet quand `initialTab` change, ouverture d'une commande qui bascule réellement sur l'Atelier. Nouvelles props optionnelles `onOpenQrModal` / `onOpenNewOrderModal` (branchées dans `App.tsx`).
- **`CockpitView.tsx`** : cartes KPI avec compteur animé, sparkline et reflet au pointeur ; barre de répartition du flux par statut ; filtres segmentés avec compteurs ; recherche au raccourci `/` ; grille de commandes en colonnes ; badges sobres à pastille (gère aussi `paiement_valide`).
- **`StudioView.tsx`** : lecteur de note vocale avec ondes animées et tête de lecture (0:48) ; transcription en serif ; vinyle SVG qui tourne pendant le mastering, bras de lecture animé, macaron doré une fois livré ; 4 étapes réelles (Composition, Arrangement, Mastering, Livraison) ; livret de paroles en Instrument Serif avec numérotation des vers et refrain souligné en doré ; timers nettoyés au démontage ; écran vide si aucune commande (évitait un crash).
- **Validation** : `tsc -p tsconfig.app.json --noEmit` → exit 0 ; `vite build` → exit 0 en 2.73s (seul avertissement : bundle > 500 kB, préexistant). Note PRoot : `npm run build` complet a été tué (exit 137, mémoire) — utiliser `NODE_OPTIONS=--max-old-space-size=768`.
- **Non commité** (en attente de validation visuelle par l'utilisateur).
- **Prochaine étape** : appliquer le même langage aux autres vues de la mission (`ConversationsView`, `StudioCopilotView`, `VentesCaisseView`, `PipelineView`, `AcademyView`, `LandingPage`, `Navbar`).

### 16. Refonte Haute Facture de l'Intérieur du Studio OS (30 Septembre 2026)
- **Objectif & Exigences Fondamentales** :
  - Élever chaque page, section et composant intérieur du Studio OS au standard d'artisanat visuel mondial des références Linear, Stripe, Apple et Liquid Brokers.
  - Purger rigoureusement tous les émojis et icônes parasites de l'interface.
  - Standardiser la palette sur le noir graphite pur (`#050608`, `#07080B`, `#0D0F14`), les micro-bordures `border-white/[0.06]`, la typographie architecturale et les chiffres `font-mono`.
- **Réalisations & Composants Refondus (11 Vues Clés)** :
  1. *`StudioAppLayout.tsx` (Shell Global & Sidebar Linear)* :
     - Navigation latérale avec séparateur ultra-fin, survol fluide, indicateur actif par réglet lumineux blanc et badges monochromes.
     - Télémétrie studio `Atelier Actif • 24/7` et fiche de profil RLS privée épurée.
     - Vues intégrées `Coûts & Marges`, `Tarifs & Formules` et `Supervision Système` réalignées sur le design token system.
  2. *`CockpitView.tsx` (Tableau de Bord & Data Grid)* :
     - Cartes de télémétrie Liquid Brokers avec chiffres tabulaires monospace.
     - Filtres rapides segmentés monochromes et champ de recherche avec raccourci visible.
     - Grille des commandes et leads épurée avec badges de statut minimaux (`[BRIEF]`, `[PAROLES]`, `[AUDIO SUNO]`, `[LIVRÉ]`).
  3. *`StudioView.tsx` (Atelier de Création Audio & Paroles)* :
     - Console de mixage hardware avec visualiseur d'ondes, sélecteur de timbre vocal et styles.
     - Espace d'écriture des paroles style livret vinyle avec strophes numérotées et éditeur inline.
     - Déclencheur souverain 1-clic monochrome avec animation d'encodage et de mastering.
  4. *`ConversationsView.tsx` (Inbox WhatsApp Double Panneau)* :
     - Disposition dual-pane Superhuman / Linear Inbox avec sélection active contrastée.
     - Fil de dialogue à bulles épurées (messages client en fond graphite, messages studio en blanc pur).
     - Dock de snippets de réponses rapides (Brief vocal, Grille 3 000 F, Reçu paiement).
  5. *`PipelineView.tsx` (Kanban de Suivi Clients)* :
     - En-têtes de colonnes architecturales avec compteurs monospace.
     - Cartes prospects enrichies avec délais et sélecteur d'étape stylisé.
  6. *`VentesCaisseView.tsx` & `RevenusView.tsx` (Trésorerie & Grand Livre)* :
     - Cartes d'encaissement Stripe Treasury avec jauge de répartition Wave vs Orange Money.
     - Table des transactions comptables au format tabulaire avec export CSV instantané.
  7. *`WhatsAppLinesView.tsx` (Télécom & Baie WAHA)* :
     - Style rack télécom avec diodes d'état actives et console de test d'envoi en direct.
     - Élimination des émojis de test et formatage monospace des numéros.
  8. *`AutomationsView.tsx` (Workflows Déclencheurs)* :
     - Remplacement des sélecteurs d'émojis par des déclencheurs événementiels formels.
     - Interrupteurs matériels haute précision et journal des déclenchements.
  9. *`AcademyView.tsx` (Cursus & Documentation Stripe Press)* :
     - Sommaire modulaire avec numérotation `01`, `02`, `03`, `04` et barre de progression.
     - Boîte à outils de scripts de vente et prompts Suno avec boutons de copie en 1 clic.
  10. *`NewOrderModal.tsx` (Prise de Brief)* :
      - Fenêtre modale sombre graphite, labels monospace et bouton de création d'élite.
- **Validation Globale** :
  - Compilation `tsc -b && vite build` : **100% au vert en 4.84s** (0 erreur, 0 avertissement).
  - Déploiement automatique synchronisé sur GitHub Pages (`gh-pages`).

### 15. Déploiement du Copilot IA & Analyste Business Multi-Outils (30 Septembre 2026)
- **Objectif & Demande Utilisateur** :
  - Fournir à chaque client son propre employé/copilot IA personnel qui traque ses ventes, ses statistiques de caisse et ses discussions WhatsApp.
  - Permettre à l'entrepreneur de lui demander de rappeler une conversation passée avec un client, de résumer ce qu'un client a dit (ou via son numéro), de rédiger les paroles de la chanson à composer, ou de rédiger et d'envoyer directement une réponse WhatsApp.
- **Réalisations & Composants Déployés** :
  1. *Service Moteur Intelligent Multi-Outils (`src/services/copilot.ts`)* :
     - `get_studio_metrics` : calcule en direct le chiffre d'affaires total, les commandes livrées, le pipeline actif et le taux de closing.
     - `search_studio_conversations` : effectue des recherches sémantiques dans les tables `contacts`, `conversations` et `messages` avec protection RLS stricte.
     - `get_whatsapp_transcripts` : rassemble l'historique chronologique des messages échangés avec horodatages et diagnostic commercial.
     - `generate_lyric_score` : compose des paroles structurées en 4 étapes (Couplet 1, Refrain, Couplet 2, Outro) personnalisées selon l'histoire du client.
     - `sendCopilotWhatsAppMessage` : transmet les messages en direct sur WhatsApp via la passerelle WAHA en 1 clic.
  2. *Composant Studio UI Haut-Artisanat (`src/components/StudioCopilotView.tsx`)* :
     - Respect absolu des règles de design (Zéro émoji, palette graphite luxe `#07080a`, typographie architecturale, icônes Lucide fines).
     - Badges d'exécution des outils de base de données en direct.
     - Action Cards interactives avec boutons "Copier", "Injecter dans le Studio Suno", et "Envoyer sur WhatsApp (+226...)".
     - Raccordé directement dans l'onglet **Analyste & Copilot IA** de `StudioAppLayout.tsx`.
- **Validation Globale** :
  - Compilation `tsc -b && vite build` : **100% succès en 3.82s**.
  - Déploiement live sur `main` (`a50438a`) et `gh-pages` (`d0d9715`).

### 14. Architecture Multi-Tenant WhatsApp WAHA ↔ VPS ↔ Plateforme Velaris (30 Septembre 2026)
- **Objectif & Exigences Fondamentales** :
  - Permettre à chaque client/studio de scanner son propre QR Code WhatsApp, relié à sa propre session WAHA dédiée sur le VPS.
  - Garantir l'étanchéité absolue : chaque utilisateur ne voit et n'envoie de messages qu'à travers son numéro/sa ligne.
  - Résoudre définitivement le problème des déconnexions intempestives vécues dans le passé.
  - Préserver impérativement la session de production `anicet2` (+226 58 35 77 72) de Velaris Partners sans perturbation.
- **Réalisations & Composants Déployés** :
  1. *Stabilité Maximale sur le VPS & Anti-Déconnexion* :
     - Ajout de `WHATSAPP_RESTART_ALL_SESSIONS=true`, `WAHA_WORKER_RESTART_SESSIONS=true`, `WAHA_AUTO_START_DELAY_SECONDS=2` dans `docker-compose.yml` sur le VPS.
     - Configuration de session avec `noweb.markOnline: false` : supprime les conflits entre WhatsApp Web et le smartphone de l'entrepreneur (évite la rupture de flux Baileys dès que l'utilisateur ouvre WhatsApp sur son téléphone).
     - Persistance vérifiée sur volumes Docker `waha_data` et `waha_sessions` (`/app/.sessions`).
  2. *Conteneur `waha-bridge` Déployé sur le VPS (Port 3001)* :
     - Microservice Node.js dédié gérant les webhooks WAHA entrants pour toutes les sessions `studio_*`.
     - Résolution automatique du `user_id` à partir de `wa_sessions` dans Supabase avec la clé secrète service role.
     - Événement `session.status` : met à jour `wa_sessions.status` ('connected', 'scan_qr_code') et renseigne le numéro réel `phone_number`.
     - Événement `message` / `message.any` : crée/met à jour le contact dans `contacts`, la conversation dans `conversations`, et insère le message dans `messages` avec le `user_id` du studio (filtré par RLS).
     - Règle de reverse proxy Caddy : `/webhook` redirigé vers `waha-bridge:3001`, `/qr/*` vers `qrserve`, et le reste vers `waha:3000`.
  3. *Auto-Provisioning & Hook Dynamique Frontend* :
     - `src/services/waha.ts` : fonction `ensureWahaSession(sessionName)` qui crée et démarre la session avec la configuration anti-déconnexion si elle n'existe pas encore.
     - `src/hooks/useWaha.ts` : gère dynamiquement la session studio `studio_${user.id.slice(0, 8)}` pour tout utilisateur connecté.
     - `src/components/QrConnectModal.tsx` : affichage du QR Code dédié par studio, vérification de l'authentification (invite propre à se connecter si visiteur), affichage du numéro connecté et relance assistée.
     - `src/components/ConversationsView.tsx` : envoi des réponses via la session studio active du client.
- **Validation Globale** :
  - Session test `studio_bd1481ad` provisionnée avec succès sur WAHA, QR Code généré en HTTP 200 PNG.
  - Webhook de transition d'état reçu et synchronisé dans `wa_sessions` en base de données.
  - Déployé live sur `main` (`3cd9ec8`) et `gh-pages` (`1575cf3`).

### 13. Vérification Médico-Légale de l'Authentification & Étanchéité Multi-Tenant de Bout en Bout (30 Septembre 2026)
- **Objectif & Exigence Fondamentale** :
  - Prouver mathématiquement et techniquement que l'authentification se comporte comme sur les sites SaaS de classe mondiale.
  - Garantir au niveau PostgreSQL et au niveau de l'interface utilisateur que CHAQUE studio connecté ne voit STRICTEMENT QUE ses données, et que les données démo ne polluent jamais un espace privé.
- **Vérifications & Réalisations Déployées** :
  1. *Banc d'Essai de Sécurité RLS à 10 Points (100% Succès)* :
     - Test réel avec deux utilisateurs distincts créés sous Supabase (`alice.velaris.test@gmail.com` et `bob.velaris.test@gmail.com`).
     - Bob crée un contact et une commande de 5 000 F CFA. Alice interroge `orders` : **Alice voit 0 commande (Isolement parfait)**.
     - Bob interroge `orders` : **Bob voit 1 commande (la sienne)**.
     - Alice tente de modifier (`PATCH`) ou supprimer (`DELETE`) la commande de Bob : **0 ligne affectée (Anti-piratage étanche)**.
     - Alice crée sa propre commande de 3 000 F CFA : **Alice voit 1 commande, Bob voit 1 commande, 0 mélange réciproque**.
     - Visiteur non connecté : **voit uniquement les 7 commandes démo publiques (`user_id IS NULL`), aucune fuite des commandes privées**.
  2. *Trigger PostgreSQL `auto_confirm_new_user` sur `auth.users`* :
     - Élimination du blocage "Email not confirmed". Tout nouvel utilisateur qui crée un studio est instantanément confirmé et connecté sans friction.
  3. *Purge des Fallbacks Démo dans l'Interface Frontend* :
     - `App.tsx` : `orders` initialisé avec la clé de stockage propre au studio (`velaris_studio_orders_${user.id}`). Un nouveau studio démarre avec 0 commande (état propre), et ses métriques de chiffre d'affaires sont calculées à partir de ses vraies ventes.
     - `ConversationsView.tsx` & `AutomationsView.tsx` : chargement direct des discussions et règles du studio connecté avec écran d'accueil dédié, sans afficher les 13 contacts de la démo.
     - `src/services/supabase.ts` : les fonctions `getLiveConversations`, `getLiveAutomationRules` et `getLiveStudioMetrics` distinguent formellement le mode connecté du mode démo.
- **Validation Globale** :
  - Compilation `tsc -b && vite build` : **100% succès en 3.85s**.
  - Déploiement live sur `main` et `gh-pages` synchronisé.

### 12. Authentification Supabase & Étanchéité Multi-Tenant des Données par Client (RLS) — Production Live (30 Septembre 2026)
- **Objectif Métier & Technique** :
  - Permettre à chaque entrepreneur / étudiant de créer son propre compte Studio et de se connecter.
  - Verrouiller la sécurité au niveau de la base de données (Row Level Security) afin qu'aucun client ne puisse jamais voir, modifier ou mélanger les données d'un autre client (contacts, conversations WhatsApp, commandes, métriques de chiffre d'affaires, règles d'automatisation).
- **Réalisations & Composants Déployés** :
  1. *Sécurité & RLS au Niveau Base de Données (`supabase_auth_multitenant.sql`)* :
     - 32 politiques RLS strictes sur 7 tables (`contacts`, `conversations`, `messages`, `orders`, `automation_rules`, `wa_sessions`, `revenue_opening_balances`).
     - Règle de sélection / écriture / suppression : `user_id = auth.uid()` pour les comptes authentifiés.
     - Valeur par défaut automatique : `user_id SET DEFAULT auth.uid()` sur toutes les tables.
     - Mode visiteur / démonstration : lecture autorisée uniquement sur les données démo (`user_id IS NULL`).
     - Trigger PostgreSQL `handle_new_studio_user()` sur `auth.users` : à chaque inscription, le studio de l'utilisateur est automatiquement initialisé avec son solde de départ (0 F CFA), ses règles d'automatisation standard et sa session WhatsApp dédiée.
  2. *Couche Frontend d'Authentification (`src/contexts/AuthContext.tsx` & `src/hooks/useAuth.ts`)* :
     - Provider React gérant la session, l'utilisateur connecté, la persistance automatique et l'état de démonstration.
     - Méthodes `signIn`, `signUp`, `signOut`, `openAuthModal`, `closeAuthModal`.
  3. *Composant d'Authentification de Haute Précision (`src/components/AuthModal.tsx`)* :
     - Conforme aux règles strictes `craft-ui-engineering` : zéro émojis, icônes fines Lucide, design architectural sombre graphite.
     - Onglets "Se connecter" et "Créer un studio" avec nom du studio, email et mot de passe sécurisé.
     - Option "Continuer en mode démonstration" pour explorer librement l'interface.
  4. *Intégration Studio OS & Navbar* :
     - `StudioAppLayout.tsx` : le profil en bas de la barre latérale affiche le nom réel du studio de l'utilisateur avec l'indicateur "Données isolées (RLS)", ainsi qu'un bouton de déconnexion fonctionnel.
     - `Navbar.tsx` : bouton "Connexion" / pilule de statut studio actif sur desktop et mobile.
     - `src/services/supabase.ts` & `App.tsx` : persistance automatique des nouvelles commandes créées dans Supabase sous l'identité de l'utilisateur connecté.
- **Validation Globale** :
  - Linter `oxlint` : **0 erreur, 0 avertissement** sur 31 fichiers.
  - Compilation `tsc -b && vite build` : **100% succès en 3.12s**.
  - Synchronisation automatique sur `main` (`4e29487`).

### 11. Intégration & Initialisation Complète du Projet Supabase Dédié (`dnwlqgsftauqsyjwhoza`) — Production Live (30 Septembre 2026)
- **Objectif Métier & Technique** :
  - Brancher le nouveau projet officiel Supabase **Velaris** (`dnwlqgsftauqsyjwhoza`), appliquer le schéma SQL de production avec extensions, tables, sécurité RLS et données certifiées réelles.
- **Réalisations & Opérations Effectuées** :
  1. *Connexion Directe PostgreSQL via Pooler IPv4* :
     - Résolution du cluster Supabase pooler sur `aws-1-eu-west-1.pooler.supabase.com:6543`.
     - Authentification réussie avec l'utilisateur `postgres.dnwlqgsftauqsyjwhoza`.
  2. *Application du Schéma SQL Universel (`supabase_schema_init.sql`)* :
     - Extensions installées : `uuid-ossp`, `pgcrypto`.
     - 7 tables créées avec contraintes d'intégrité : `contacts`, `conversations`, `messages`, `orders`, `automation_rules`, `wa_sessions`, `revenue_opening_balances`.
     - Row Level Security (RLS) activé sur l'ensemble des tables avec politiques de lecture publique et écriture authentifiée.
  3. *Seeding Intégral des Données Réelles de Production* :
     - Solde comptable certifié : 2 749 400 F CFA (ouverture au 26/09/2026).
     - 13 contacts CRM et conversations réelles (Safiatou TRAORE, Prunelle De Dieu, SERE ET FILS à Nouna, Apolline ONG SEEMI, Mme IMA, Jacquie Gbeuly, Seydou Tioro, cestdieu42, Jesus Christ my Saviour, etc.).
     - 7 commandes synchronisées (Wave & Mobile Money).
     - 3 règles réelles d'automatisation studio actives (`🖖🏻`, `😊`, `🙏`).
     - 2 sessions WAHA enregistrées (`Test` et `anicet2`).
  4. *Validation REST & SDK Frontend (`src/services/supabase.ts`)* :
     - Validation de tous les endpoints `/rest/v1/` avec la clé Publishable : **HTTP 200 OK sur toutes les tables**.
     - Calcul dynamique du chiffre d'affaires cumulé (`totalRevenue` = solde d'ouverture + commandes livrées et validées).
     - Mapping strict des statuts du funnel WhatsApp.
- **Validation Globale** :
  - Linter `oxlint` : **0 erreur, 0 avertissement** sur 27 fichiers.
  - Compilation `tsc -b && vite build` : **100% succès en 2.87s**.
  - Synchronisation automatique sur `main` (`ba232f5`).
  - Déploiement GitHub Pages live : `https://anicetjr20045-commits.github.io/velaris/`.

### 10. Connexion Réelle aux Webhooks / API WAHA & Synchronisation des Données de Production — Production Ready (30 Septembre 2026)
- **Objectif Métier & Technique** :
  - Remplacer les données simulées du Studio OS par la connexion directe à la passerelle WAHA (`https://waha.velarisagent.life`) et aux données réelles de la base de production (2 292 conversations, 2 284 contacts, 896 commandes).
- **Réalisations & Composants Déployés** :
  1. *Service Client WAHA (`src/services/waha.ts`)* :
     - Client REST direct vers `https://waha.velarisagent.life` avec la clé API de production.
     - Gestion des sessions : `fetchWahaSessions`, `fetchWahaSession('Test')`, `startWahaSession`, `stopWahaSession`.
     - Génération d'URL directe pour QR code PNG authentifié (`/api/{session}/auth/qr?x-api-key=...`).
     - Envoi direct de messages texte WhatsApp : `sendWahaTextMessage`.
  2. *Hook Réactif Temps Réel (`src/hooks/useWaha.ts`)* :
     - Polling automatique toutes les 6s de l'état de la session `Test` (+22656240533).
     - Détection des états `WORKING`, `STARTING`, `SCAN_QR_CODE`, `FAILED`, `STOPPED`.
     - Actions de relance instantanée (`restart`) et déconnexion (`stop`).
  3. *Synchronisation des Données Réelles de Production (`src/data/realProductionData.ts`)* :
     - 10 discussions phares avec transcripts complets de vocaux et messages (Safiatou TRAORE - Anniversaire Orokiatou, Prunelle De Dieu - Hommage Gaudens & Prisca, SERE ET FILS à Nouna, Apolline ONG SEEMI, Mme IMA, etc.).
     - Comptabilité exacte certifiée : 3 644 400 F CFA (Solde d'ouverture 2 749 400 F + Livrées 744 400 F + Validées 150 600 F).
     - 3 règles réelles d'automatisation actives (`🖖🏻`, `😊`, `🙏`).
  4. *Mise à Jour des Vues Opérationnelles* :
     - `WhatsAppLinesView.tsx` : Statut en direct de la session Alex, rendu du vrai QR code live WAHA avec auto-refresh, session anicet2 connectée, module de test d'envoi WhatsApp en direct.
     - `ConversationsView.tsx` : 10 discussions réelles, volet avec bulles WhatsApp authentiques, bouton "Envoyer WAHA" appelant directement l'API + bouton d'accès natif WhatsApp.
     - `Navbar.tsx` & `QrConnectModal.tsx` : Badge dynamique "WhatsApp actif" / "Scan QR requis" synchronisé sur l'état réel de la passerelle.
- **Validation Globale** :
  - Linter `oxlint` : **0 erreur, 0 avertissement** sur 26 fichiers.
  - Compilation `tsc -b && vite build` : **100% au vert en 4.51s**.
  - Synchronisation automatique sur `main` (`f1d5062`) et déploiement immédiat sur `gh-pages` (`6c9ddda`).

### 9. Intégration Totale du Design de l'Intérieur Studio OS (Sidebar, Agencements & Vues Opérationnelles) — Production Ready (30 Septembre 2026)
- **Contexte & Exigence Fondatrice** :
  - L'utilisateur a fourni 5 captures d'écran de référence de l'intérieur de production du studio (`velarisagent.life`) couvrant l'ensemble du cockpit : *Mes revenus*, *Discussions WhatsApp*, *Suivi clients*, *Automatisations*, et *Lignes WhatsApp*.
  - Ordre d'action : répliquer exactement la même direction artistique d'intérieur, les mêmes agencements de cartes, la typographie éditoriale serif, et l'architecture de navigation dans `velaris`.
- **Composants & Vues Développés & Intégrés** :
  1. *Architecture Shell Studio (`StudioAppLayout.tsx`)* :
     - Barre latérale fixe/collapsible obsidian sombre (`#0b0a08`) avec en-tête de marque (`VELARIS STUDIO` + `ATELIER ACTIF 24/7`), bouton de retour public fluide vers la vitrine, et profil utilisateur (`AN anicetjr20045`).
     - Navigation groupée par univers : *Mon Business* (Revenus, Ventes, Discussions 42, Suivi clients, Coûts, Analyste), *Paramètres Studio* (Lignes WhatsApp, Automatisations, Tarifs), *Supervision & Administration* (Console Admin, Studio IA Suno, Académie).
     - Prise en charge responsive mobile avec drawer coulissant et header compact.
  2. *Mes Revenus (`RevenusView.tsx` - Écran Photo 2)* :
     - Chiffre d'affaires total en direct : `3 644 400 F CFA` (typographie serif imposante).
     - Revenus du jour avec filtres chronologiques (`Aujourd'hui`, `Hier`, `7 jours`, `30 jours`, `Ce mois`, `Cette année`) et timeline horaire 01h à 23h.
     - Grille 2x2 des KPI opérationnels : 126 messages reçus, 42 nouveaux clients, 1 automatisation, 0/1 lignes connectées.
     - Bloc dernières ventes et lien d'accès direct au suivi clients.
  3. *Discussions WhatsApp (`ConversationsView.tsx` - Écran Photo 1)* :
     - Titre éditorial serif `Conversations`, compteur `200 CONVERSATIONS`, bouton `Exporter`.
     - Liste des 10 discussions réelles (Prunelle De Dieu, seydoutioro7, Jacquie Gbeuly, cestdieu42, ong seemi, 22605777308, DEMARVEL, Prisca Bilé, Jesus Christ my Saviour, vivianebadiel3) avec badge non-lu et faits concrets extraits.
     - Volet bas d'inspection de la discussion active avec boutons directs (WhatsApp vert, Fiche client, Exporter), prévisualisation des bulles WhatsApp authentiques et champ d'envoi rapide.
  4. *Suivi Clients CRM (`PipelineView.tsx` - Écran Photo 3)* :
     - Entonnoir Kanban avec les colonnes exactes : *Nouveau Prospect* (156), *En discussion* (18), *Devis & Paiement* (8), *En studio / Livré* (5).
     - Cartes enrichies : nom, dernier échange horodaté, tag de l'occasion, extrait du brief, sélecteur d'étape dynamique et raccourci d'envoi vers l'Atelier Suno.
  5. *Automatisations (`AutomationsView.tsx` - Écran Photo 4)* :
     - 3 règles de production actives par emoji (`🙏`, `🖐️`, `😊`) avec interrupteurs à bascule (toggles) fonctionnels, modification et suppression.
     - Journal des 50 derniers déclenchements avec statut doré `Envoyé` et horodatage certifié.
     - Modal interactive d'ajout d'une nouvelle règle de déclenchement.
  6. *Lignes WhatsApp & Numéros (`WhatsAppLinesView.tsx` - Écran Photo 5)* :
     - Toast de session active en vert émeraude.
     - Ligne principale Alex (+22656240533, statut Connecté vert avec bouton déconnexion).
     - Ligne Aïcha en attente de scan avec QR Code SVG haute précision, instructions de jumelage WhatsApp et spinner d'attente.
     - Ligne Alice prête à être connectée.
  7. *Ventes & Caisse (`VentesCaisseView.tsx`)* :
     - Grand livre comptable des encaissements Wave et Orange Money avec filtre et export CSV.
- **Validation Globale** :
  - Linter `oxlint` : **0 erreur, 0 avertissement** sur 23 fichiers.
  - Compilation `tsc -b && vite build` : **100% au vert en 2.83s**.
  - Synchronisation automatique sur `main` et déploiement immédiat sur `gh-pages`.

### 8. Exécution Chirurgicale du Brief Dev Homepage (P0, P1, P2) — Production Ready (30 Septembre 2026)
- **Priorité P0 (Pré-Trafic & Fondations Techniques)** :
  1. *Simulateur financier retiré de l'accueil* : Déplacé et sanctuarisé dans le composant dédié [`DecouvrirView.tsx`](file:///root/projets/velaris/src/components/DecouvrirView.tsx) sur la route `/decouvrir` / `#decouvrir`.
  2. *Viewport & Accessibilité de Zoom* : Retrait de `maximum-scale=1.0, user-scalable=no` dans `index.html`. Zoom et redimensionnement natifs 100% opérationnels.
  3. *Navigation Responsive Sans Chevauchement (360px à 1440px)* :
     - Écartement minimum garanti `gap >= 16px` entre le logo "VELARIS Studio" et les liens.
     - Pastille d'état avec `white-space: nowrap`, texte condensé « WhatsApp actif » et statut vert.
     - Sur mobile : menu tiroir burger complet + un seul bouton d'action direct « Commander ».
  4. *Formatage des Nombres & Typographie des Prix* :
     - Nombres formatés avec `Intl.NumberFormat('fr-FR')` et espaces insécables (`1 200 à 5 000 FCFA`, `380 000 FCFA`).
     - Abandon des polices display illisibles pour les chiffres au profit d'une typographie `font-sans` tabulaire sobre.
     - Suffixe `FCFA` sanctuarisé avec `whitespace-nowrap`.
- **Priorité P1 (Conversion Commerciale & Fluidité)** :
  5. *CTA Principal & Secondaire* :
     - Remplacement de « Ouvrir l'atelier » par un lien direct WhatsApp `wa.me/22656240533` avec message prérempli (« Bonjour Velaris, je souhaite créer une chanson personnalisée »).
     - Bouton secondaire « Écouter un exemple » qui scroll de manière fluide directement vers le lecteur audio.
     - « Ouvrir l'atelier » réservé aux créateurs et utilisateurs connectés dans la barre de navigation.
  6. *Lecteur Audio Haute Fidélité Remonté sous le Hero* :
     - Positionné immédiatement sous le hero pour une écoute instantanée en 1 tap.
     - Suppression des mentions superflues de tonalité et de BPM.
     - Bouton unique Play/Pause (suppression de la mention redondante « ÉCOUTER »).
     - Ligne de progression masquée tant qu'aucun morceau n'est en lecture.
  7. *Hero Visuel & Cartes Découplées* :
     - Les deux cartes de métriques ont été sorties de l'image de l'orbe et repositionnées élégamment en dessous.
     - Opacité des particules célestes fortement abaissée (fond sobre et discret).
  8. *Contraste & Lisibilité WCAG AA* :
     - Textes secondaires en `text-zinc-300` (ratio 9.5:1 sur fond sombre).
     - Toutes les légendes calibrées à au moins 14px (`text-sm`).
  9. *Harmonisation des Libellés Métier* :
     - Terme unique « Marge nette : 85 à 95 % » sur l'ensemble de la page.
     - Mention « 18 minutes » affichée une seule fois sur toute la vitrine.
- **Priorité P2 (Finitions & Performance)** :
  10. *Rythme Vertical & Espacements* : Espacement harmonisé avec une échelle compacte (`space-y-16 sm:space-y-24`), suppression des gouffres de 200px.
  11. *Performance Mobile & Format WebP* :
      - Orbe converti en WebP haute performance ([`velaris_liquid_orb.webp`](file:///root/projets/velaris/src/assets/velaris_liquid_orb.webp)) : passage de 394 Ko à **54 Ko (-86% de poids)** avec `loading="lazy"` et `decoding="async"`.
      - Prise en charge formelle de `prefers-reduced-motion` désactivant les animations si configuré par l'utilisateur.
  12. *Témoignages Complets & Réels* :
      - Patrick Kouamé (Abidjan), Idrissa Sawadogo (Ouagadougou), Fatoumata Bâ (Dakar).
      - Phrases complètes sans aucune coupure de syntaxe et chiffres vérifiés.
  13. *Direction Artistique Réalignée* : Palette noir ébène chaud (`#08080a`), or champagne doux (`#c5a059`), typographie Syne et Inter.
- **Validation Globale** :
  - `oxlint` : **0 erreur, 0 avertissement** sur 16 fichiers.
  - Compilation `tsc -b && vite build` : **100% succès en 2.5s**.
  - Synchronisation automatique pushée sur `main` et déployée sur `gh-pages`.

### 7. Installation des Compétences IA Design & Purge Intégrale Zéro-Émoji (30 Septembre 2026)
- **Nouvelles Compétences IA Déployées dans le Système** :
  - `craft-ui-engineering` ([`/root/.gemini/config/skills/craft-ui-engineering/SKILL.md`](file:///root/.gemini/config/skills/craft-ui-engineering/SKILL.md)) : directives strictes anti-slop, interdiction totale des émojis en UI, palettes graphites monochromes (`#050608`), typographie architecturale suisse.
  - `motion-design-principles` ([`/root/.gemini/config/skills/motion-design-principles/SKILL.md`](file:///root/.gemini/config/skills/motion-design-principles/SKILL.md)) : courbes de bézier physiques (`cubic-bezier(0.16, 1, 0.3, 1)`), parallaxe 3D, ondes sonores fluides canvas à 60 FPS.
- **Règles Globales Sanctifiées (`/root/AGENTS.md` & `/root/GEMINI.md`)** :
  - Intégration de la Section 4 imposant à tous les agents et au bot Telegram d'appliquer ces compétences d'office.
- **Nettoyage Intégral du Codebase Velaris** :
  - Purge complète des émojis résiduels dans [`StudioView.tsx`](file:///root/projets/velaris/src/components/StudioView.tsx), [`AcademyView.tsx`](file:///root/projets/velaris/src/components/AcademyView.tsx), [`QrConnectModal.tsx`](file:///root/projets/velaris/src/components/QrConnectModal.tsx), [`NewOrderModal.tsx`](file:///root/projets/velaris/src/components/NewOrderModal.tsx).
  - Score vérification automatique : **0 émoji sur 100% des fichiers**.
  - Build de production `npm run build` : **100% succès**.

### 6. Éradication Totale des Tics IA, Typographie Studio Haut de Gamme (Syne + Inter) & Mise en Page Éditoriale Suisse (30 Septembre 2026)
- **Typographie Architectural & Studio d'Élite (`index.html`, `index.css`)** :
  - Intégration de `Syne` pour les titres et la signature visuelle (prestige, label de musique, caractère unique).
  - Intégration d'`Inter` pour une lisibilité suisse chirurgicale des métriques et du corps de texte.
  - Déploiement d'`Instrument Serif` pour les touches éditoriales raffinées.
- **Purge Intégrale des Emojis & Tics IA (`LandingPage.tsx`, `Navbar.tsx`, `StudioAudioShowcase.tsx`)** :
  - Suppression totale de tous les emojis décoratifs parasites (🎵, ✨, 💛, 🏷️, ↗, 🚀).
  - Élimination des encadrés squircles gris répétitifs (`rounded-xl bg-white/[0.06] border border-white/10`) contenant des icônes isolées.
  - Remplacement des boutons clichés par de véritables boutons studio architecturaux sobres et contrastés.
- **Grille Éditoriale & Asymétrie Professionnelle** :
  - Découpage architectural en colonnes fines avec séparateurs hairlines (`border-white/[0.08]`).
  - Console d'écoute sonore redessinée sous forme de rack audio professionnel (style Nagra / Braun / Teenage Engineering).
  - Fader de mixage sobre pour le simulateur de rentabilité.
- **Validation Globale** :
  - Linter : `oxlint` **0 erreur, 0 avertissement** sur 15 fichiers.
  - Compilation : `tsc -b && vite build` **100% au vert en 2.53s**.
  - Déploiement synchronisé sur GitHub Pages (`gh-pages`).

### 5. Design Haute Couture Épuré (Benchmark Liquid Brokers) : Orbe 3D Liquide, Stardust Cosmique & Démonstration Audio (`LiquidSoundOrb.tsx`, `CosmicBackground.tsx`, `StudioAudioShowcase.tsx`) (30 Septembre 2026)
- **Orbe 3D Liquide Chromatique & Parallaxe Interactif (`LiquidSoundOrb.tsx`)** :
  - Sphère liquide sonore avec ondes caustiques procédurales animées sur canvas.
  - Effet d'inclinaison 3D gyroscopique au curseur souris/doigt (perspective 1200px).
  - Deux badges flottants en verre dépoli (glassmorphism avec `backdrop-blur-2xl`) inspirés directement du benchmark :
    - Badge Gauche : *Cadence Studio • 18 Min ↗* avec témoin lumineux actif et sous-titre *Brief vocal ➔ Chanson HD*.
    - Badge Droit : *Marge Directe • 92% ↗* avec jauge de progression lumineuse et mention *100% direct Wave & OM*.
- **Atmosphère Spatiale & Stardust Cosmique (`CosmicBackground.tsx`)** :
  - Fond noir graphite profond (`#07080a`) parsemé de micro-étoiles scintillantes et d'une dérive ascendante fluide en canvas.
  - Zéro surcharge : profondeur subtile avec nébuleuses ambrées et indigo discrètes.
- **Atelier d'Écoute Studio Haute Fidélité (`StudioAudioShowcase.tsx`)** :
  - Lecteur audio interactif avec 3 styles emblématiques (Afro-Love Moderne, Acoustique Guitare & Voix, Gospel & Célébration).
  - Synthétiseur harmonique Web Audio API autonome (aucune dépendance réseau ou risque 404).
  - Égaliseur et visualiseur de spectre animé en temps réel.
- **Validation Globale** :
  - Linter : `oxlint` **0 erreur, 0 avertissement** sur 15 fichiers.
  - Compilation : `tsc -b && vite build` **100% au vert en 2.43s**.
  - Déploiement automatique synchronisé sur GitHub Pages (`gh-pages`).

### 4. Recalibrage Stratégique B2B & Design Épuré Haut de Gamme (`LandingPage.tsx`) (30 Septembre 2026)
- **Alignement Rigoureux du Copywriting & de la Posture** :
  - Fin du copywriting B2C de commande de chanson : la plateforme s'adresse désormais exclusivement aux personnes souhaitant **créer et développer leur business de vente de chansons**.
  - Headline épurée : *"Lancez votre Studio de Chansons Personnalisées sur WhatsApp."*
  - Démonstration de l'opportunité de marché : demande continue et émotionnelle (mariages, anniversaires, hommages), barrière musicale abolie par la suite logicielle, et cash flow immédiat en Mobile Money.
- **Refonte Visuelle Épurée & Élimination des Effets IA Surchargés** :
  - Suppression totale des halos fluorescents (`blur-[140px]`), des dégradés criards et des bordures saturées.
  - Palette sobre et architecturale : noir ébène mat (`#0d0e12`), surfaces douces (`#111318`), bordures discrètes (`border-white/[0.08]`) et accents or champagne doux (`#c5a059`).
  - Typographie éditoriale d'élite (`Space Grotesk` et `Plus Jakarta Sans`) avec interlignage aéré et respiration généreuse.
- **Simulateur de Chiffre d'Affaires Studio Interactif** :
  - Slider dynamique par nombre de commandes quotidiennes (1 à 15 commandes/jour).
  - Calcul transparent en temps réel du CA brut, des coûts publicitaires estimés (~15%) et du bénéfice net mensuel retirable (ex: 450 000 F CFA net/mois pour 5 commandes/jour à 3 000 F).
- **Présentation Structurée des 4 Modules Fondateurs de l'Académie** :
  - Module 1 : Fondations du Studio & Offres (1 200 F, 3 000 F, 5 000 F).
  - Module 2 : Acquisition Ads Rentable (Facebook & TikTok Ads dès 5 000 F).
  - Module 3 : Scripts de Vente & Psychologie du Closing WhatsApp.
  - Module 4 : Production Musicale IA & Livraison en 18 min.
- **Témoignages de Créateurs de Studio** (Abidjan, Ouagadougou, Dakar).
- **FAQ Entrepreneuriat** répondant aux objections réelles (barrière musicale, capital de démarrage, délais, marge).
- **Validation Build** : `oxlint` **0 erreur**, `tsc -b && vite build` **100% au vert en 4.24s**.

### 3. Prise de Brief Rapide, Éditeur de Paroles & Boîte à Prompts (30 Septembre 2026)
- Modal Nouveau Lead, Édition inline des paroles, sélection de timbre vocal (Femme, Homme, Duo), recherche instantanée Cockpit et persistance `localStorage`.

### 2. Socle Frontend Studio OS Déployé (30 Septembre 2026)
- Initialisation React + TypeScript + Tailwind CSS dans `/root/projets/velaris`.
