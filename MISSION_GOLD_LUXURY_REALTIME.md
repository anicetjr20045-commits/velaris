# 🏆 MISSION : PALETTE CHAUDE CHAMPAGNE & OR LUXE + MOTEUR TEMPS RÉEL INTÉGRAL

> **Destinataire** : Claude Code (exécuté sur **Claude Opus 5.5**).  
> **Source Visuelle de Vérité** : Deux captures d'écran de référence extraites du Google Drive :
> - `ref_images/ref_image_1.jpg` (Vue Automatisations)
> - `ref_images/ref_image_2.jpg` (Vue Pipeline / Suivi clients)

---

## 1. NOUVELLE DIRECTION ARTISTIQUE : « WARM OBSIDIAN & CHAMPAGNE GOLD »

L'utilisateur trouve le noir actuel trop sombre et froid, et les titres/textes trop petits. Il veut exactement l'ambiance chaleureuse, dorée et lisible des deux images de référence.

### 🎨 Tokens de Couleurs
- **Canvas Fond Général** : `#0C0A09` / `#0E0C0A` (noir obsidienne chocolaté chaud, très noble, jamais de gris bleuté froid).
- **Cartes & Conteneurs** : `#171512` / `#1A1713` avec micro-bordures chaudes dorées/ambrées (`border-[#2D261E]` ou `border-[#3A3022]`).
- **Accent Or Champagne Signature** :
  - `#E5B54F` / `#F0C068` (boutons d'action `+ Nouvelle règle`, pilule de filtre active `30 jours`, switchs/toggles dorés, badges `Envoyé`, contour d'onglet actif sidebar, badge `STUDIO`).
  - Textes d'accent or : `text-[#E5B54F]` ou `text-[#F3CA75]`.
- **Badges Spéciaux** :
  - Notification non-lue : pilule rouge vive `bg-[#E11D48] text-white rounded-full`.
  - Statut en direct : point vert émeraude `#22C55E` (`● ATELIER ACTIF 24/7`).
  - Liseré gauche des citations/briefs : trait vertical or chaud (`border-l-2 border-[#D4A347]`).

### 📐 Typographie & Tailles de Textes (Plus grandes et visibles)
- **Grands Titres de Section** : `font-serif font-bold text-3xl sm:text-4xl text-white tracking-normal` (comme dans l'image : « Automatisations », « Suivi clients » en serif somptueux et affirmé).
- **Sous-titres & Descriptions** : `text-sm sm:text-base text-[#A8A29E] leading-relaxed`.
- **Sections & Titres de Cartes** : Ne plus faire de textes minuscules ! Les en-têtes passent de 10-11px à **13-15px** bien lisibles, et les noms de prospects/commandes en **16-18px font-medium text-white**.

---

## 2. FONCTIONNALITÉS EN TEMPS RÉEL & POUSSÉES

### A. L'IA Copilot Omnisciente (`src/components/StudioCopilotView.tsx` & `src/services/copilot.ts`)
1. **Recherche par Numéro de Téléphone** :
   - Quand l'utilisateur tape un numéro (ex: `+226...`, `07...`, `5835...` ou n'importe quel fragment de numéro), l'IA le détecte instantanément, retrouve la conversation correspondante, résume ce que le client a dit et affiche le bouton direct WhatsApp.
2. **Recherche par Contexte / Sujet** :
   - Recherche intelligente dans les contacts, discussions et briefs.
3. **Tracking des Ventes & Connaissance Complète du Site** :
   - L'IA connaît les statistiques réelles (chiffre d'affaires cumulé, marge brute 92.4%, répartition Wave / OM, nombre de chansons livrées).
   - Elle peut rédiger des textes pour un client ou composer des paroles de chanson adaptées à son histoire.
4. **Mascotte Sonar en Palette Or** :
   - Harmoniser la mascotte Sonar avec la palette dorée chaude (`#E5B54F`).

### B. Données Réelles & Synchronisation Temps Réel
1. **Discussions WhatsApp & Pipeline** :
   - Affichage en temps réel des vraies discussions et du pipeline de production.
   - Filtres temporels fonctionnels : `Aujourd'hui`, `7 jours`, `30 jours`, `Tout`.
2. **QR Code WhatsApp Multi-Tenant (WAHA)** :
   - Chaque client a sa ligne dédiée, scanne son QR code et accède à ses propres discussions sans aucun mélange ni déconnexion.
3. **Automatisations** :
   - Toggles dorés fonctionnels avec mise à jour d'état et journal des déclenchements horodaté.

---

## 3. FICHIERS CLÉS À TRAITER EN PRIORITÉ
1. `src/index.css` : Ajuster les variables de couleurs pour le fond chaud obsidienne (`#0C0A09`), surfaces (`#171512`), accents or champagne (`#E5B54F`).
2. `src/components/StudioAppLayout.tsx` : Sidebar avec liseré or, badge STUDIO or, typographies de menu enrichies.
3. `src/components/StudioCopilotView.tsx` : Recherche par numéro/contexte, affichage or chaud, intelligence omnisciente.
4. `src/components/PipelineView.tsx` : Grand titre serif, cartes avec liseré or, filtres fonctionnels (comme dans `ref_image_2.jpg`).
5. `src/components/AutomationsView.tsx` : Grand titre serif, toggles dorés, journal des 50 déclencheurs avec badges `Envoyé` or (comme dans `ref_image_1.jpg`).
6. `src/components/CockpitView.tsx` & `src/components/StudioView.tsx` : Harmonisation or chaud et titres agrandis.

---

## 4. VALIDATION
- Compiler avec `npx vite build` (et `NODE_OPTIONS=--max-old-space-size=768 npx tsc -p tsconfig.app.json --noEmit`) pour assurer 0 erreur.
