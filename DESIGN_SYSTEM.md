# 💎 SPÉCIFICATION DU DESIGN SYSTEM — INTÉRIEUR DU STUDIO OS (VELARIS)

> **Norme de référence pour toute évolution de l'interface utilisateur intérieure (UI/UX) de Velaris.**
> Ce document formalise les tokens, les règles d'artisanat visuel et l'architecture des 11 composants du Studio OS.
> Standards d'inspiration : **Linear, Stripe, Apple et Liquid Brokers**.

---

## 1. Directives Fondamentales d'Artisanat (Anti-Slop Directives)

### 🚫 Interdiction Absolue des Émojis
- **Aucun émoji** (`✨`, `🚀`, `🔥`, `🎵`, `💡`, `👋`, `💎`, `👑`, etc.) dans les boutons, en-têtes, badges, cartes ou puces de liste.
- **Remplacement systématique** : Icônes SVG fines vectorielles (`lucide-react`, 14-16px, `strokeWidth={1.5}` ou `1.75`), puces typographiques (`•`, `—`), ou numérotation monospace (`01`, `02`).

### 🎨 Palette Monochrome Graphite Luxe
- **Canvas Void** : `#050608` (noir profond architectural)
- **Surfaces de cartes** : `#07080B` (fond principal des cartes et panels)
- **Surfaces surélevées / Modals** : `#0D0F14` (surfaces de contrôle, fenêtres modales)
- **Bordures en micro-filets** : `border-white/[0.06]` à `border-white/[0.12]`
- **Boutons Souverains (CTAs)** :
  - Primaire : `bg-white text-black hover:bg-neutral-200 shadow-[0_0_20px_rgba(255,255,255,0.12)] rounded-full`
  - Secondaire : `bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-300 rounded-lg`

### 📐 Typographie & Chiffres de Précision
- **Titres & Headings** : `font-sans font-bold tracking-tight text-white`
- **Télémétrie & Chiffres Clés** : `font-mono tracking-tight text-white font-bold` (ex: `3 644 400 F CFA`, `18 min`, `92.4 %`, `0:48`)
- **Libellés de Section (Eyebrows)** : `text-[10px]` ou `text-[11px]`, uppercase, `font-mono tracking-widest text-neutral-400`

---

## 2. Architecture & Rôle des 11 Composants Intérieurs

### 1. `StudioAppLayout.tsx` — Shell Global & Barre Latérale
- **Style** : Barre latérale façon Linear avec navigation groupée (*Business & Pilotage*, *Connectivité & Règles*, *Studio & Académie*).
- **Indicateur actif** : Ligne blanche lumineuse verticale à gauche de l'onglet actif avec halo doux.
- **Télémétrie** : Témoin en direct vert `Poste connecté • 24/7` et monogramme studio minimal.
- **Profil Utilisateur** : Carte de compte privée affichant le statut `Poste RLS Privé`.
- **Sous-vues intégrées** :
  - *Coûts & Marges* : Grille d'analyse unitaire (marge brute 92.4%, coût lead 65 F).
  - *Tarifs & Formules* : 1 200 F, 3 000 F (Best-Seller) et 5 000 F.
  - *Supervision Système* : Statut des nœuds WAHA, Suno, Supabase RLS et Webhook Bridge.

### 2. `CockpitView.tsx` — Tableau de Bord Télémetrique
- **Style** : Télémétrie Liquid Brokers avec 4 cartes clés (Chiffre d'affaires, Chansons livrées, Prospects WhatsApp, Conversion closing).
- **Data Grid des Commandes** : Lignes épurées avec badges de statut minimaux (`[BRIEF]`, `[PAROLES]`, `[AUDIO SUNO]`, `[LIVRÉ]`).
- **Filtres rapides** : Sélecteur segmenté par statut et champ de recherche avec raccourci visuel.

### 3. `StudioView.tsx` — Atelier de Création Audio & Paroles
- **Style** : Console matérielle de mixage hardware (Teenage Engineering / Ableton).
- **Lecteur d'Ondes** : Spectre audio animé blanc avec timer monospace `0:48`.
- **Livret Vinyle** : Paroles découpées en strophes encadrées avec numérotation de vers.
- **Bouton Maître 1-Clic** : Rendu sonore Suno avec simulation du pipeline de 18 minutes.

### 4. `ConversationsView.tsx` — Inbox WhatsApp Double Panneau
- **Style** : Double volet style Superhuman / Linear Inbox.
- **Volet gauche** : Liste des discussions avec pastille de lecture et badges de statut.
- **Volet droit** : Fil de dialogue à bulles contrastées (client en fond graphite sombre, studio en blanc pur).
- **Dock de Snippets** : Boutons d'injection rapide de messages types (`Brief vocal`, `Grille 3 000 F`, `Reçu paiement`).

### 5. `PipelineView.tsx` — Suivi Clients Kanban
- **Style** : Tableau Kanban architectural en 4 étapes (*Nouveau Prospect*, *En Discussion*, *Devis & Paiement*, *En Studio / Livré*).
- **En-têtes** : Compteurs monospace tabulaires et cartes enrichies de résumés de brief.

### 6. `VentesCaisseView.tsx` — Caisse & Trésorerie Directe
- **Style** : Dashboard financier Stripe Treasury.
- **Ventilation des Encaissements** : Répartition Wave (66.4%) vs Orange Money (33.6%).
- **Grand Livre** : Table comptable complète avec horodatages et export CSV instantané.

### 7. `RevenusView.tsx` — Carte Télémétrique Maître & Activité
- **Style** : Chiffres de chiffre d'affaires géants en police monospace (`text-4xl sm:text-6xl font-mono`).
- **Graphique Horaire** : Ligne temporelle d'activité quotidienne (01h à 23h).
- **Matrice 2x2** : Indicateurs opérationnels (messages entrants, nouveaux prospects, automatisations, lignes).

### 8. `WhatsAppLinesView.tsx` — Télécom & Passerelle WAHA
- **Style** : Baie de serveurs télécom avec diodes d'état de flux Baileys.
- **Console de Test** : Terminal d'envoi en direct avec accusé de réception et message ID.

### 9. `AutomationsView.tsx` — Workflows Déclencheurs
- **Style** : Moteur d'événements Zapier / Linear Workflows.
- **Architecture** : Remplacement des émojis par des déclencheurs stricts (`Paiement Mobile Money Reçu`, `Note Vocale Reçue`).
- **Interrupteurs** : Toggles monochromes et journal d'audit des 50 dernières exécutions.

### 10. `AcademyView.tsx` — Cursus & Documentation Stripe Press
- **Style** : MasterClass / Stripe Press éditorial.
- **Curriculum** : Modules `01`, `02`, `03`, `04` avec jauge de progression.
- **Boîte à Outils** : Scripts de vente WhatsApp et prompts maîtres Suno avec copie en 1 clic.

### 11. `NewOrderModal.tsx` — Prise de Brief Client
- **Style** : Modale sobre graphite `#07080B` avec sélection de formules, moyen d'encaissement et simulation de brief vocal.

---

## 3. Guide de Maintenance UI

Lors de l'ajout d'une nouvelle vue ou d'un composant au Studio OS :
1. Toujours utiliser les tokens de surface (`#050608` pour le fond, `#07080B` pour les cartes, `#0D0F14` pour les éléments surélevés).
2. Vérifier l'absence totale de tout émoji dans le code JSX.
3. Afficher les métriques financières et temporelles en classe `font-mono`.
4. Compiler avec `tsc -b && vite build` pour garantir 0 erreur de typage.
