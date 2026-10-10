# 📁 JEU DE DONNÉES : 50 CONVERSATIONS CLIENTS RÉELLES (BENCHMARK & REPLAY IA)

Ce jeu de données regroupe **50 vraies conversations clients WhatsApp complètes**, extraites directement de la base de données de production.

Chaque conversation retrace un échange commercial authentique avec des clients de **Côte d'Ivoire (+225)**, du **Burkina Faso (+226)** et du **Bénin (+229)**, depuis le premier message d'accroche jusqu'au brief, au choix de formule, aux paroles et au paiement.

---

## 1. FICHIERS DISPONIBLES

| Fichier | Format | Taille | Usage recommandé |
| :--- | :--- | :--- | :--- |
| [`dataset_50_conversations_reelles.json`](file:///root/projets/velaris/dataset_50_conversations_reelles.json) | JSON structuré | ~870 Ko | Inspection humaine, chargement direct dans un script JS/Python |
| [`dataset_50_conversations_reelles.jsonl`](file:///root/projets/velaris/dataset_50_conversations_reelles.jsonl) | JSON Lines | ~730 Ko | Standard pour les bancs de test LLM (OpenAI Evals, LangSmith, Anthropic, runners automatiques) |

---

## 2. STRUCTURE D'UNE CONVERSATION

Chaque entrée de la base de données contient :

```json
{
  "conversation_id": "CONV_01",
  "original_uuid": "3665f3a0-9279-478f-9105-9b6100890ff2",
  "client_info": {
    "phone": "+2250711462687",
    "country": "Côte d'Ivoire (+225)",
    "name": "PHILIPPE CHAMA"
  },
  "order_summary": {
    "occasion": "Anniversaire",
    "recipient": "Mariette",
    "sender": "Néhémie",
    "stage_reached": "lyrics_validated",
    "payment_status": "confirmed"
  },
  "total_turns": 59,
  "client_turns_count": 31,
  
  "client_inputs_for_replay": [
    "Bonjour ! Puis-je en savoir plus à ce sujet ?",
    "Chanson d'amour surprise à une amie",
    "Est-ce que Si je vous envoie le texte vous pouvez faire la chanson avec ça",
    "Néhémie",
    "On vous paie par quel moyen"
  ],
  
  "full_transcript": [
    {
      "role": "client",
      "text": "Bonjour ! Puis-je en savoir plus à ce sujet ?",
      "media_type": "text",
      "timestamp": "2026-08-18T08:59:43Z"
    },
    {
      "role": "assistant",
      "text": "Bonjour et bienvenue chez Velaris ! Avec joie, nous créons des chansons personnalisées uniques. C'est pour quelle occasion ?",
      "media_type": "text",
      "timestamp": "2026-08-18T09:00:10Z"
    }
  ]
}
```

---

## 3. COMMENT L'IA DE TEST DOIT UTILISER CE FICHIER

### Mode 1 : Simulation de Client Tour par Tour (Replay Actif)
L'IA de test (ou votre runner de test) lit le tableau **`client_inputs_for_replay`** et envoie chaque message dans l'ordre au bot Velaris :
1. Envoyer `client_inputs_for_replay[0]`.
2. Attendre la réponse du bot.
3. Vérifier que la réponse respecte les règles (pas d'emoji, ton courtois, pose la bonne question, ne redemande pas ce qui a déjà été dit).
4. Envoyer `client_inputs_for_replay[1]`, et ainsi de suite.

### Mode 2 : Benchmark et Comparaison (Ground Truth)
L'IA de test peut comparer les réponses générées par le nouveau moteur avec celles de l'ancien historique (**`full_transcript`**) :
- Est-ce que le nouveau moteur comprend plus vite le brief ?
- Est-ce qu'il évite les répétitions inutiles ?
- Est-ce que le devis (1 200 F / 3 000 F) est correctement présenté sans forcer ?

---

## 4. PROMPT PRÊT À L'EMPLOI POUR VOTRE IA DE TEST

Vous pouvez copier-coller directement ce prompt à votre IA :

```text
Tu es un agent de test et d'évaluation automatisé pour le bot WhatsApp Velaris Studio.
Voici un jeu de données contenant 50 conversations réelles avec de vrais clients : dataset_50_conversations_reelles.json.

Pour chaque conversation (de CONV_01 à CONV_50) :
1. Lis la liste des messages clients dans "client_inputs_for_replay".
2. Joue le rôle du client en envoyant ces messages séquentiellement au bot.
3. À chaque tour, évalue la réponse du bot sur 5 critères stricts :
   - ZÉRO EMOJI : Aucun emoji décoratif dans les réponses du bot.
   - NON-RÉPÉTITION : Ne jamais reposer une question dont la réponse a déjà été donnée.
   - ORIENTATION VENTE : Présenter les deux formules (Découverte 1 200 F / Prestige 3 000 F) au bon moment.
   - SÉCURITÉ PAIEMENT : Ne jamais donner de numéro Wave/OM avant la validation des paroles.
   - DIGNITÉ ET CLARTÉ : Phrases courtes (1 à 2 bulles max), ton ouest-africain respectueux et professionnel.
4. Identifie les éventuels blocages ou bugs, et génère un rapport récapitulatif des performances.
```

---

## 5. MÉTRIQUES CLÉS DU JEU DE DONNÉES

- **Total des conversations** : 50 conversations complètes
- **Nombre moyen de messages par conversation** : 47,4 tours
- **Nombre moyen de messages client** : 23,3 messages par client
- **Répartition géographique** :
  - Côte d'Ivoire (+225) : 38 conversations
  - Burkina Faso (+226) : 11 conversations
  - Bénin (+229) : 1 conversation
- **Cas spécifiques inclus** :
  - Clients partageant directement leurs propres poèmes / paroles
  - Clients partageant des liens TikTok et demandant de copier le style
  - Clients négociant ou demandant les prix d'emblée
  - Clients indécis sur le choix de formule
  - Clients envoyant des photos avant ou après la validation
