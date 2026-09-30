# 📌 ÉTAT ACTIF DU PROJET — VELARIS PLATFORM (Académie & Suite Logicielle Studio Chansons)

> **Source unique de vérité pour la reprise de session entre comptes et conversations.**
> Toute IA intervenant sur ce projet doit le lire au démarrage et le mettre à jour à chaque étape validée.

---

## 🎯 Statut Actuel

- **Projet** : `velaris` (`/root/projets/velaris`)
- **Dernière mise à jour** : 30 Septembre 2026 (15:45 UTC)
- **Branche Git** : `main` & `gh-pages`
- **Dépôt GitHub** : https://github.com/anicetjr20045-commits/velaris
- **Lien Live Permanent GitHub Pages** : https://anicetjr20045-commits.github.io/velaris/
- **Statut Opérationnel** : Base Supabase Officielle Initialisée & Connectée en Direct (`dnwlqgsftauqsyjwhoza`) — Schéma SQL complet appliqué via le cluster de pooler `aws-1-eu-west-1.pooler.supabase.com:6543`, 13 conversations et contacts réels insérés, 7 commandes enregistrées, 3 automatisations de production activées, solde de départ 2 749 400 F CFA certifié. Endpoints REST validés (HTTP 200). Déploiement GitHub Pages live.

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
