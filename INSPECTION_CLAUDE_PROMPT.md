# MANDAT D'INSPECTION MÉDICO-LÉGALE — AUDIT DE L'AGENT IA WHATSAPP VELARIS (CLAUDE OPUS 5.5)

Tu es Claude Opus 5.5. Le fondateur de Velaris te charge d'inspecter en profondeur l'intégralité du système IA de vente de chansons personnalisées sur WhatsApp qui vient d'être conçu, testé et déployé sur le VPS et Supabase.

Le fondateur exige une vraie analyse sans complaisance, sans spéculation, couvrant toute la chaîne : de la compréhension sémantique de l'IA jusqu'au serveur WAHA et au VPS, en passant par l'autonomie, la prise de commande, les règles métier, la gestion des encaissements et la résistance aux cas réels du terrain.

---

## 1. CARTOGRAPHIE COMPLÈTE DE CE QUI A ÉTÉ FAIT ET DÉPLOYÉ

### A. Le Cœur Décisionnel & d'Ingestion (`/root/projets/velaris/engine/`)
L'ancien système `velaris-agent` souffrait d'une accumulation ingérable de 54 règles, d'un prompt obèse de 35 000 tokens et de courses concurrentes webhooks.
Une refonte intégrale a été bâtie dans `velaris/engine` reposant sur une machine à états finis (FSM) rigoureuse et un découpage chirurgical :
1. **Ingestion & Déduplication FIFO** (`src/ingest/`, `src/queue/`) :
   - File d'attente FIFO par conversation avec fenêtre de silence (debounce). Si le client envoie 3 messages successifs en 4 secondes (« Bonjour », « C'est pour un anniversaire », « Pour ma femme Awa »), ils sont regroupés dans un seul tour de parole atomique (`agent_ingest_message`).
   - Normalisation WAHA stricte (`waha-normalizer.ts`) : déduplication automatique entre `message` et `message.any`, clé unique sur identifiant court/long.
   - Signature HMAC SHA-256 obligatoire pour tous les webhooks entrants.
2. **Compréhension Sémantique & JSON Guard** (`src/llm/understand.ts`, `src/llm/corpus.ts`, `src/llm/deepseek.ts`, `src/llm/json-guard.ts`) :
   - LLM utilisé : DeepSeek V3 chat en mode JSON strict (température 0).
   - Protection `json-guard` : élimination automatique des blocs de réflexion `<think>`, refus strict de tout markdown parasite ou tableau, fallback déterministe.
   - Extraction des intentions (`greet`, `ask_price`, `provide_brief`, `confirm_recipient_name`, `choose_offer`, `ask_payment_details`, `claim_payment`, `request_revision`, `approve_lyrics`, `human_handover`, `stop`).
   - Extraction sémantique des entités : occasion, prénom du destinataire, relation, souvenirs.
3. **Moteur Décisionnel Déterministe & FSM** (`src/domain/decide.ts`, `src/domain/orders.ts`, `src/domain/step-policy.ts`) :
   - Cycle de vie formel de la commande : 10 états (`collecting_brief`, `confirming_name`, `presenting_offers`, `brief_completed`, `awaiting_payment`, `payment_declared`, `payment_confirmed`, `in_production`, `lyrics_review`, `delivered`), 36 transitions vérifiées.
   - **Règle d'or de la réception** : Une seule question par message.
   - **Vérification de la prononciation du prénom** : L'agent demande systématiquement confirmation de l'orthographe/prononciation du prénom avant de valider le brief (crucial pour le chant).
   - **Vocal de procédure** : Envoyé SEUL, une seule fois par contact, dès validation du brief.
   - **Piste de paiement hermétique** :
     - Formules officielles : 1 200 F CFA (Paroles / Découverte), 3 000 F CFA (Chanson audio complète), 5 000 F CFA (VIP Chanson + Vidéo).
     - Règle absolue anti-hallucination : « Bien reçu » ne vaut JAMAIS paiement. L'agent NE CONFIRME JAMAIS un paiement lui-même (seul le gérant humain ou le webhook SasPay peut valider un encaissement).
     - Si le client demande le numéro de dépôt à tout moment, les coordonnées de paiement Wave / Orange Money lui sont fournies sans friction.
   - **Supervision humaine & Handover** :
     - Tout message envoyé par le gérant (`fromMe: true`) verrouille immédiatement la conversation en silence bot (`merchant_takeover`). L'IA se tait instantanément.
     - Reprise de l'IA par le gérant via la réaction emoji ✨ (`resume_ai`).
     - Déclenchement de la production musicale Suno par la réaction emoji 🎵 sur le texte des paroles validé.
   - **Disjoncteur de sécurité (Rate-limiting)** : Plafond horaire d'envois et détection de boucles pour éviter tout spam.
4. **Boîte d'Envoi Outbox Régulée** (`src/output/outbox-sender.ts`) :
   - Émission asynchrone régulée avec délai humain naturel (1 à 4 secondes).
   - Protection inviolable : interdiction absolue d'envoyer le moindre message sur la session WhatsApp réservée `anicet2` (+22658357772).

### B. La Passerelle WAHA & le Déploiement VPS
- Serveur WAHA hébergé sur VPS (`https://waha.velarisagent.life`).
- Architecture multi-tenant : chaque gérant de studio possède sa session dédiée (`studio_*`), session de test principale `Test` (+22656240533).
- Microservice `velaris-engine` / `waha-bridge` sur le port 3001 du VPS, orchestré via Docker Compose et reverse proxy Caddy avec routes `/api/qr/*` protégées et sans 404.

### C. La Suite Logicielle Velaris & les Dernières Évolutions
- Studio OS et Académie accessibles à tous les utilisateurs (déverrouillage universel).
- Neutralisation des données par défaut : nouveaux studios démarrent strictement à 0 F CFA, 0 commande, 0 contact.
- Élimination complète de l'ancienne vue pipeline / suivi client au profit d'un flux direct.
- Schéma Supabase `automation_rules` aligné avec `action_type`, `media_path`, `caption` et bucket `product-files` opérationnel.

---

## 2. CE QUE TU DOIS FAIRE MAINTENANT

1. **Examen critique du code source** :
   - Examine attentivement `/root/projets/velaris/engine/src/domain/decide.ts`, `/root/projets/velaris/engine/src/domain/orders.ts`, `/root/projets/velaris/engine/src/domain/step-policy.ts`, `/root/projets/velaris/engine/src/llm/understand.ts`, et les suites de tests dans `/root/projets/velaris/engine/test/`.
2. **Analyse médico-légale des 136 tests existants** :
   - Les 136 tests sont tous au vert. Mais couvrent-ils véritablement tous les cas vicieux du terrain ou existe-t-il des angles morts ?
   - Qu'en est-il des cas limites : clients indécis, changements d'avis au milieu du brief, argot local ivoirien/burkinabè/sénégalais, questions hors sujet, tentatives de tromperie sur le paiement, doubles commandes simultanées, délais et silences ?
3. **Identification des failles ou points de fragilité résiduels** :
   - Où l'IA peut-elle encore trébucher ou avoir une réponse sous-optimale ?
   - Y a-t-il des risques de désalignement entre le modèle LLM et la FSM déterministe ?
4. **Plan de perfectionnement / Correctifs immédiats** :
   - Quelles sont les améliorations exactes à apporter au code pour que l'IA soit 100% infaillible, autonome et digne d'un standard de classe mondiale ?
   - Si des correctifs précis doivent être appliqués, détaille-les clairement avec les lignes de code ou les mécanismes exacts.

Fournis un rapport d'inspection complet, d'une rigueur absolue, structuré et sans jargon superflu, prêt à être présenté au fondateur.
