# DOSSIER D'INGÉNIERIE & D'ARCHITECTURE — AGENT IA DE VENTE CONVERSATIONNELLE WHATSAPP
## Transmission Stratégique pour Claude Opus 5.5 (Claude Code)
**Date :** 3 Octobre 2026  
**Projets sources :** `velaris-agent` (`/root/projets/velaris-agent`), `velarisse` (`/root/projets/velarisse`), `velaris` (`/root/projets/velaris`)  
**Objectif :** Conception et implémentation de l'architecture définitive du vendeur WhatsApp autonome/semi-autonome par studio sur la plateforme Velaris.

---

## 1. 🎯 LA VISION DU PRODUIT & POSITIONNEMENT MÉTIER

Velaris est une suite logicielle (Studio OS) et une académie permettant à des entrepreneurs et créateurs en Afrique de lancer et gérer leur propre **Studio de Chansons Personnalisées sur WhatsApp**.

### Le Cycle de Vente Métier :
1. **Acquisition Publicitaire (Trafic Froid)** :
   - Campagnes TikTok et Facebook Ads (budget dès 5 000 F CFA).
   - Les prospects arrivent en masse sur WhatsApp : ils envoient un message type « Bonjour, je veux une chanson » ou « C'est combien ? ».
2. **Accueil & Découverte (La Réception)** :
   - Accueil chaleureux et immédiat sans pavé textuel rébarbatif.
   - Présentation claire et transparente des tarifs :
     - Formule Découverte (Texte de paroles poétiques) : 1 200 F CFA.
     - Formule Studio Standard (Chanson complète audio masterisée) : 3 000 F CFA.
     - Formule VIP (Chanson + Montage Vidéo Souvenir) : 5 000 F / 10 000 F CFA.
   - Délais de production annoncés : ~8 minutes pour le texte, ~18 minutes pour la chanson audio complète.
3. **Collecte du Brief Créatif** :
   - L'agent recueille l'occasion (anniversaire, mariage, déclaration d'amour, deuil, hommage) et le prénom du destinataire.
   - **Règle fondamentale** : 1 seule question par message pour ne jamais submerger le client africain sur mobile.
4. **Vocal de Procédure** :
   - Dès le brief validé, envoi d'une note vocale explicative (voix chaleureuse) qui explique comment le studio compose la chanson.
   - Ce vocal doit partir **SEUL** (sans texte concurrent ni paroles prématurées).
5. **Composition & Validation des Paroles** :
   - Le studio compose un texte poétique adapté. Le client valide les paroles ou demande des retouches mineures.
6. **Paiement Mobile Money Sécurisé** :
   - Le client paie directement sur le compte Mobile Money (Wave, Orange Money, Moov) du gérant du studio.
   - Le client envoie une capture d'écran ou un SMS de confirmation.
7. **Production Musicale & Livraison** :
   - Génération musicale via IA (Suno / Kie.ai), mixage/mastering et livraison directe du fichier audio MP3 sur WhatsApp.

---

## 2. 🛑 AUTOPSIE COMPLÈTE DE L'ANCIEN SYSTÈME (`velaris-agent`) : NOS ERREURS, FATIGUES ET LIMITES

L'ancien projet `velaris-agent` a fonctionné pendant des mois avec du vrai trafic publicitaire et des vrais clients. Nous avons tiré des leçons inestimables de ses pannes et de ses souffrances :

### A. L'Effet « Boîte Noire Monolithique » & L'Empilement de 54 Règles
- **Ce qu'on a fait au début** :
  - On a cru qu'on pouvait rendre l'agent parfait en lui ajoutant des instructions dans le prompt système (`prompts.ts` a fini par dépasser 35 000 tokens !).
  - À chaque bug client rencontré, on ajoutait une règle (R10, R11... jusqu'à R54), puis des invariants (INV-1 à INV-12).
  - On a superposé :
    1. Un extracteur de faits booléens (`facts.server.ts`, 50+ regex).
    2. Un moteur de règles déterministes (`rules.ts`).
    3. Un censeur de sortie (`guardrails.ts`, 2 580 lignes de regex).
    4. Un système de crons asynchrones (`scheduled-send.ts`).
- **Pourquoi ça a échoué (La Fatigue du Fondateur)** :
  - **La guerre des cerveaux** : Le prompt demandait d'être chaleureux, le censeur regex coupait les formules de politesse en croyant que c'était du bavardage (`stripEffusiveFiller`), les crons renvoyaient des messages en retard (« bulles zombies »).
  - Dès qu'un client utilisait une expression imprévue, le château de cartes s'écroulait. Le fondateur passait ses journées à éteindre des incendies sur WhatsApp.

### B. Le Bug des Doubles Réponses (Courses Concurrentes Webhook)
- **Le problème** : Sur WhatsApp, un client n'envoie pas un seul message propre. Il envoie :
  - *Bulle 1 (14h00:01)* : « Bonjour »
  - *Bulle 2 (14h00:03)* : « C'est pour un anniversaire »
  - *Bulle 3 (14h00:04)* : « Pour ma femme Awa »
- **La catastrophe** : WAHA envoyait 3 webhooks quasi-simultanés. Trois workers Node.js démarraient en parallèle, appelaient le LLM séparément, et répondaient 3 fois d'affilée en se contredisant.

### C. La Fuite des Marqueurs Techniques (`[HANDOFF_TEXT]`, `[NOTIFY_OWNER]`)
- On demandait au LLM d'insérer des balises entre crochets dans son texte pour déclencher des actions backend.
- Dès que le LLM mettait un espace (`[ HANDOFF_TEXT ]`) ou variait la casse, les regex ne matchaient pas et le client voyait apparaître du code laid et incompréhensible dans son WhatsApp.

### D. La Mauvaise Interprétation du Langage Oral (« Bien reçu »)
- En Afrique de l'Ouest, dire « Bien reçu » signifie souvent « J'ai bien écouté ton vocal » ou « D'accord ».
- Le système détectait « reçu » comme une preuve de virement financier, envoyait des remerciements et lançait la commande en production sans que le client n'ait payé un seul franc !

### E. L'Incapacité de « Savoir Quand s'Arrêter »
- L'agent relançait les clients indéfiniment après une livraison.
- Quand le gérant humain intervenait pour parler au client, le bot continuait à envoyer des messages par-dessus l'humain !

---

## 3. 💡 LE PIVOT RÉUSSI : LE COCKPIT & LA RÉCEPTIONNISTE SARAH

Face à cette complexité ingérable, nous avons fait un grand ménage dans `velaris-agent` :
1. **Passage de 5 175 lignes à 1 005 lignes** dans `webhook-handler.ts`.
2. **La Réceptionniste IA (Sarah)** au périmètre ultra-restreint et spécialisé :
   - Elle accueille, donne les tarifs, recueille le brief (occasion, destinataire) en 1 question par message.
   - Dès que le brief est complet : elle envoie le vocal de procédure, crée la commande dans Supabase (`orders`), notifie le gérant sur son WhatsApp, et **SE TAIT DÉFINITIVEMENT via une pause dure (`brief_completed`)**.
3. **Le Contrôle Humain & Le Déclencheur Magique 🎵** :
   - Le gérant humain rédige ou peaufine le texte des paroles et encaisse l'argent.
   - Une fois l'argent reçu, le gérant pose simplement la réaction emoji `🎵` sur le message des paroles dans WhatsApp (ou clique sur le bouton au Dashboard).
   - Le webhook capte la réaction `🎵`, appelle l'API Suno, masterise le son et livre automatiquement l'audio au client sur WhatsApp.

---

## 4. 🚀 LE NOUVEAU DÉFI : L'ARCHITECTURE VELARIS STUDIO OS

Aujourd'hui, nous ne voulons plus gérer une seule ligne en dur. Sur **Velaris Platform**, **chaque utilisateur / studio a sa propre ligne WhatsApp connectée via WAHA**, ses propres tarifs, son nom de studio et ses clients.

### Ce que nous voulons construire :
Une architecture d'agent conversationnel d'élite, multi-tenant, qui résout définitivement les problématiques passées sans jamais retomber dans le piège des 54 règles.

### Principes Architecturaux Directeurs Déjà Validés dans le Rapport Claude Opus :
1. **Ingestion Idempotente & Mutex FIFO par Conversation** :
   - Un seul worker actif par conversation WhatsApp.
   - Si 3 bulles arrivent en 5 secondes, elles sont accumulées dans un buffer et traitées dans **un seul et unique tour unifié**.
2. **Séparation Découplée en 4 Étapes** :
   - **Étape 1 (Compréhension)** : LLM léger en sortie JSON stricte (intent, fields extraits, confiance, sentiment, demande_humain). Zéro règles métier dans ce prompt.
   - **Étape 2 (Décision Déterministe en Code / FSM)** : Une machine à états finie vérifiée par le code TypeScript. Les transitions ne sont permises que si les conditions strictes en base sont réunies.
   - **Étape 3 (Actions & Outils Validés)** : Outils qui lisent les prix en base, enregistrent les preuves, sans jamais laisser le LLM inventer quoi que ce soit.
   - **Étape 4 (Rédaction & Ton)** : LLM reçoit uniquement les faits établis par les outils et rédige 1 à 2 bulles chaleureuses au ton du studio, avec 1 seule question.
3. **Garde-fous de Sortie & Passation Humaine Programmée** :
   - Vérification des montants, rejet absolu de tout marqueur technique.
   - Verrou de pause dure dès que l'humain prend la parole, que le client s'énerve, ou que le brief est complété.
   - Alerte WhatsApp immédiate au gérant du studio.

---

## 5. ORDRE DE MISSION POUR CLAUDE OPUS 5.5

Claude, analyse l'ensemble de ces éléments historiques et actuels :
1. Révise les points forts et les écueils de `velaris-agent` et de notre ébauche dans `RAPPORT_CLAUDE_OPUS.md`.
2. Propose l'architecture technique concrète et détaillée pour l'agent conversationnel intégré dans `velaris` (`/root/projets/velaris`) :
   - Schéma de base de données PostgreSQL / Supabase complet (tables `conversations`, `messages`, `orders`, `studio_personas`, `studio_catalogues`, `automation_locks`).
   - Algorithme de Mutex FIFO et Buffer d'ingestion WAHA.
   - Spécification formelle de la FSM (Machine à États Finie) avec toutes les transitions autorisées et interdites.
   - Schémas JSON de l'extracteur d'intentions et du tool calling.
   - Mécanisme de passation humaine et de silence strict.
3. Rédige ton analyse architecturale de haut niveau et le plan de construction étape par étape.
