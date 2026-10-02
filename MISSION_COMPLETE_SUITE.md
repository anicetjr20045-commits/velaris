# 🚀 MISSION MAÎTRE FINALE : VELARIS STUDIO OS & SUITE INTÉGRALE

> **Destinataire** : Claude Code (exécuté sur **Claude Opus 5.5**).  
> **Objectif** : Parachever l'intégralité de la plateforme Velaris selon les 16 exigences précises de l'utilisateur, avec un niveau de finition, d'intelligence et de sécurité de classe mondiale (Linear, Stripe, Apple).

---

## 📋 CAHIER DES CHARGES DÉTAILLÉ (16 POINTS + BONUS WAHOU)

### 1. 🎬 Transitions d'écran & Fluidité entre clics
- Appliquer un conteneur de transition fluide (`.vx-view-enter`, crossfade doux avec léger slide 6px et opacité, sans flash blanc, sans saccade ni saut de scroll).
- Zéro jank : utilisation exclusive de propriétés accélérées par GPU (`transform`, `opacity`).

### 2. 📱 Mobile First Intégral + Tablette + Desktop
- **Navigation Inférieure Mobile (Bottom Navigation Bar)** : Sur smartphone (< 768px), barre flottante ou fixée en bas avec accès rapide aux 5 onglets majeurs (Cockpit, Discussions, Studio IA, Copilot, Plus / Menu).
- **Cibles tactiles** : 44px minimum pour tous les boutons sur mobile.
- **Tiroir mobile** : Ouverture fluide, fermeture par balayage ou tap sur backdrop / touche Échap.
- **Tablette & Grand Écran** : Mise en page adaptative (iPad 768-1024px avec sidebar compacte ou tiroir, Desktop 1280px+ avec sidebar spacieuse).

### 3. ✨ Sublimation du Design (Obsidienne & Or Champagne)
- Renforcer la palette chaude : Fond `#0C0A09`, surfaces `#171512`, bordures `#2D261E` / `#3A3022`, or `#E5B54F` / `#F0C068`.
- Grands titres en Playfair Display / Instrument Serif (32-36px), typographie des cartes agrandie (14-16px).
- Reflets lumineux subtils au survol (`.vx-spotlight`).

### 4. 💬 Discussions WhatsApp en Temps Réel Vrai
- Accusés de lecture instantanés (`read` / `unread` avec double coche bleue / grise).
- Horodatages précis, tri automatique du fil par dernier message reçu.
- Pastille rouge de notification non-lue réactive en direct sur l'onglet de navigation.
- Module de réponse avec pièces jointes et envoi simulé ou réel WAHA.

### 5. 🔄 Suivi Client (Pipeline) Automatisé
- Déplacement dynamique et automatique des prospects d'une colonne à l'autre selon les événements (nouveau prospect -> en discussion -> devis/paiement -> en studio -> livré).
- Fiches de brief enrichies avec tags d'occasion, de budget et liseré or.

### 6. ❌ Suppression de la page "Coûts & Marges"
- Retirer l'onglet `couts` de `navGroups` dans `StudioAppLayout.tsx` et son rendu.

### 7. ❌ Suppression de la page "Tarifs & Formules"
- Retirer l'onglet `tarifs` de `navGroups` dans `StudioAppLayout.tsx` et son rendu.

### 8. 🧠 IA Copilot & Sonar encore plus Intelligente et Capable
- Recherche ultra-rapide par numéro de téléphone ou bribe de numéro (`+226...`, `07...`).
- Recherche sémantique par contexte dans toute la base.
- Assistant proactif de rédaction des chansons, relances commerciales et analyse des ventes.
- Mascotte Sonar dorée interactive avec micro-animations au frappe clavier.

### 9. 🔌 Optimisation Connexion WAHA & WhatsApp
- Dans `src/services/waha.ts` : heartbeat régulier anti-déconnexion, reconnexion assistée en 1 clic, isolation multi-tenant stricte par session `studio_${user.id}`.

### 10. 🗄️ Base de Données Supabase Professionnelle & Temps Réel
- Dans `src/services/supabase.ts` : gestion robuste des erreurs de réseau, cache local de secours, publication Realtime sur les tables `conversations`, `messages`, `orders`, `automation_rules`.

### 11. ⚡ Automatisations Multi-Médias Fonctionnelles
- Support des déclencheurs récurrents avec 4 types de médias :
  1. Message Texte personnalisé.
  2. Note Vocale native WhatsApp (audio PTT avec lecteur).
  3. Fichier Document / PDF (grille tarifaire, reçu).
  4. Vidéo démo.
- Switchs dorés fonctionnels avec persistance.

### 12. 🎓 Académie Studio Magnifiée
- Présentation haut de gamme des modules de formation avec progression.
- Scripts de closing WhatsApp et prompts Suno prêts à copier en 1 clic.

### 13. 👑 Véritable Console Admin Complète (`src/components/AdminConsoleView.tsx`)
- Tableau de bord de direction de la plateforme :
  - Vue d'ensemble du réseau de studios connectés.
  - Métriques consolidées du parc d'utilisateurs.
  - État de santé des nœuds (WAHA, Supabase, Suno, Webhook Bridge).
  - Centre de télémétrie et logs de sécurité.

### 14. 🛡️ Sécurisation Maximale Anti-Piratage
- Sanitisation stricte des entrées utilisateurs (anti-XSS).
- Vérification stricte des identifiants et appartenance des données (isolation RLS).
- Masquage des clés sensibles et gestion sécurisée des sessions.

### 15. 🔑 Authentification Parfaite (Site de Classe Mondiale)
- Modal et formulaire d'authentification complet :
  - Inscription avec nom de studio, email et mot de passe.
  - Connexion avec persistance de session.
  - **Mot de passe oublié** : formulaire de réinitialisation avec envoi d'email via Supabase Auth (`resetPasswordForEmail`).
  - Notification claire de confirmation d'email et bascule fluide vers le mode Démo.

### 16. 👤 Gestion du Profil Studio & Déconnexion/Reconnexion
- Onglet ou modale dédiée **Mon Profil Studio** :
  - Informations du compte, email, nom du studio personnalisable.
  - Identifiant unique de ligne WhatsApp et statut RLS privé.
  - Bouton de déconnexion immédiate et reconnexion sans perte de données.

### 17. 🌟 Bonus "Effet Wahou"
- **Palette de commandes rapide `Cmd+K` / `Ctrl+K`** : Recherche instantanée et raccourcis clavier pour naviguer n'importe où dans le Studio en 1 seconde.
- **Enregistreur de note vocale studio** : Enregistrement micro dans le navigateur pour simuler un brief vocal ou l'envoyer.
