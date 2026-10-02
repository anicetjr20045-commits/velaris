# 🚀 MISSION OPUS 5.5 : REDESIGN MAÎTRE & ULTRA-PREMIUM DE VELARIS

> **Destinataire** : Claude Code (exécuté sur le modèle **Claude Opus 5.5**).  
> **Objectif** : Transformer l'intégralité du site Velaris (extérieur + intérieur Studio OS) pour lui donner une finition **Ultra-Premium, Somptueuse, Moderne et Bluffante (Effet « Wahou »)**.

---

## 1. Contexte Métier du Projet

**Velaris** est la plateforme n°1 permettant à des créateurs et entrepreneurs en Afrique de lancer leur propre **Studio de Chansons Personnalisées sur WhatsApp** :
- **Académie** : Forme de A à Z (acquisition Meta Ads, offres 1 200 F / 3 000 F / 5 000 F CFA, scripts de closing WhatsApp).
- **Studio OS (Logiciel Tout-en-Un)** :
  - Connexion WhatsApp multitenant (chaque utilisateur scanne son QR code WAHA).
  - Atelier de création audio (génération de paroles poétiques, production Suno en 18 min, mastering, export).
  - Boîte de réception WhatsApp en direct (inbox unifiée).
  - Caisse & Trésorerie directe (encaissement Wave & Orange Money avec 92% de marge nette).
  - Copilot IA & Analyste Business (employé IA dédié qui répond, traque les métriques et rédige les chansons).

---

## 2. Compétences & Skills Disponibles

Les compétences de design sont installées dans `.claude/skills/` :
1. `craft-ui-engineering` : Tokens luxueux, surfaces soignées, micro-bordures, élimination des artefacts cheap.
2. `frontend-design` : Direction artistique distinctive, typographie percutante, contrastes vibrants, suppression des templates génériques.
3. `motion-design-principles` : Micro-interactions fluides, animations de survol délicates, transitions élégantes.

---

## 3. Direction Artistique Attendue : « Ultra-Premium & Effet Wahou »

L'utilisateur demande expressément :
- **Pas de design terne ou tristounet** : L'interface doit vibrer de luxe et de modernité (comme les meilleures réalisations de Linear, Stripe, Apple Music, et Teenage Engineering).
- **Profondeur & Lumière** :
  - Fonds sombres nobles (noir obsidienne `#050608` avec des halos subtils ambrés, dorés ou indigo très discrets).
  - Cartes en verre dépoli avec bordures réactives au survol (`border-white/10 hover:border-white/20 transition-all`).
  - Boutons souverains qui attirent le clic, badges élégants, typographie soignée.
- **Zéro Émojis Cheap** : N'utilise aucun émoji de spam (`✨`, `🔥`, `🚀`). Utilise des icônes SVG fines (`lucide-react`) ou des micro-indicateurs graphiques.
- **Chiffres d'Impact** : Tout ce qui est financier ou statistique doit claquer avec lisibilité (`font-mono font-bold tracking-tight`).

---

## 4. Périmètre de Refonte

### A. L'Intérieur du Studio OS (`src/components/`)
1. **`StudioAppLayout.tsx`** : Le shell principal, la sidebar Linear épurée, les en-têtes et le menu de navigation fluide.
2. **`CockpitView.tsx`** : Tableau de bord de pilotage — cartes de KPI vivantes avec micro-lueurs, grille des commandes claire et dynamique.
3. **`StudioView.tsx`** : L'Atelier Créatif — console hardware studio magnifique, lecteur de son / ondes audio animé, livret vinyle pour les paroles, déclencheur de mastering 1-clic.
4. **`ConversationsView.tsx`** : Inbox WhatsApp — affichage moderne style Superhuman, bulles de dialogue soignées, barre d'action rapide.
5. **`StudioCopilotView.tsx`** : Le Copilot IA — boîte de discussion intelligente avec badges d'outils animés et suggestions en 1-clic.
6. **`VentesCaisseView.tsx` & `RevenusView.tsx`** : Caisse & Trésorerie — jauges de répartition Wave / Orange Money, transactions stylisées.
7. **`PipelineView.tsx`** : Suivi des prospects kanban avec transitions et tags visuels nets.
8. **`AcademyView.tsx`** : Cursus de formation avec cartes de modules inspirantes.

### B. L'Extérieur (Landing Page Publique)
1. **`LandingPage.tsx`** : Le Hero, la présentation de l'Académie, la démo de la suite logicielle et les tarifs.
2. **`Navbar.tsx`** : Navigation épurée avec statut de session en direct.

---

## 5. Règle Technique Absolue
- Après chaque modification, le build doit compiler à 100% sans erreur :
  `npm run build` (`tsc -b && vite build`) doit sortir avec exit code 0.
