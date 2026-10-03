# DOSSIER STRATÉGIQUE MAÎTRE — LA RÉALITÉ TERRAIN DE L'AGENT ALEX
## Contexte Opérationnel Approfondi pour Claude Opus 5.5
**Date :** 3 Octobre 2026  
**Auteur pour Claude :** Retour d'expérience chirurgical des vraies ventes WhatsApp  
**Objectif :** Intégrer l'intelligence humaine, la psychologie client africaine et les cas médico-légaux réels d'Alex pour bâtir l'infrastructure conversationnelle idéale de Velaris Studio OS.

---

## 1. 🎭 QUI ÉTAIT L'AGENT ALEX & POURQUOI ÇA NE PEUT PAS ÊTRE UN SIMPLE CHATBOT

Alex n'a jamais été un « bot de support » ni un simple assistant technique.
**Alex, c'est l'avatar commercial de Wendyam Anicet junior**, le fondateur de Velaris au Burkina Faso (+226).
Alex vendait en direct sur WhatsApp à des clients réels au Burkina Faso, en Côte d'Ivoire, au Sénégal, au Mali, etc.

### La Réalité du Trafic Publicitaire & Psychologie Client :
- **Trafic froid publicitaire (TikTok Ads, Facebook Ads)** :
  - Le prospect clique sur une publicité vidéo émouvante (« Offrez une chanson personnalisée pour son anniversaire / son mariage »).
  - Il atterrit sur WhatsApp avec un message pré-rempli ou spontané : *« Bonjour je veux une chanson »*, *« C'est combien ? »*, *« Kpata là voyons voir le son »*.
  - **La méfiance est maximale** : En Afrique, les arnaques en ligne sont légion. Les gens ont peur d'envoyer de l'argent avant d'avoir vu du concret.
  - **La sensibilité émotionnelle est extrême** : Les clients viennent pour des événements majeurs de leur vie (la mort d'un père, la célébration d'une mère courageuse, des excuses amoureuses, une demande en mariage, un baptême).
  - **Le langage naturel est oral et ouest-africain** : Fautes d'orthographe, syntaxe orale, nouchi ivoirien, formules directes sans verbe (*« Le numéro de dépôt »*, *« C'est sur quelle numéro »*, *« D'accord j'attends alors »*, *« Bien reçu »*).

---

## 2. 🛑 LES CAS MÉDICO-LÉGAUX RÉELS D'ALEX (POURQUOI L'ANCIEN SYSTÈME S'EST EFFONDRÉ)

Voici les vraies conversations qui ont fait souffrir le fondateur et qui ont dicté l'évolution de `velaris-agent` :

### Cas Réel 1 : Djalilou Dayamba pour Fadila (+226 55 91 77 65 - Burkina Faso)
1. **L'explication des kiosques nocturnes prise pour un refus** :
   - Djalilou explique la réalité locale : *« Mais dépôt là si c’est demain je ne peux pas vous faire ça la nuit »* (les kiosques Orange Money / Wave ferment la nuit en ville).
   - L'ancien automate voyait le mot *« demain »* et déclenchait la règle `client_defers` : il s'est mis à répéter en boucle perroquet une bulle d'attente à 37 secondes d'intervalle !
2. **Le déraillement catastrophique sur « J'attends alors »** :
   - Le client patientait poliment : *« D’accord pas de soucis j’attends alors »*.
   - Le système avait une regex rigide contenant `\battends\b`. Avec l'apostrophe de *« j'attends »*, le système a cru que le client changeait d'avis (`facts.clientChangedMind = true`) !
   - L'IA a immédiatement effacé tout le brief déjà validé et a redemandé froidement : *« Je vous écoute 🙏 dites-m’en un peu plus pour votre chanson 😊 »*. Le client a été perdu : *« Vraiment je ne sais même pas ce que je vais dire 🫣 »*.
3. **Le blocage syntaxique sur la demande de paiement** :
   - Le client dit : *« Le dépôt c’est sur quelle numéro ? »* (avec deux 'l' à *quelle*).
   - La regex du bot cherchait `quel numéro` : le paiement a été censuré, aucune coordonnée n'a été envoyée.
4. **Le gel nocturne de 8h35** :
   - La conversation est tombée en pause `await_merchant_text` à minuit. Alex a dû se réveiller le matin à 08h58 pour écrire et envoyer manuellement les paroles et son numéro Orange Money Burkina (+226 05 77 73 08 Wendyam Anicet junior) pour sauver la vente in extremis.

### Cas Réel 2 : OP Sylvie CI pour son fils Stevens (+225 0706523525 - Côte d'Ivoire)
1. **Une histoire émouvante prise pour des paroles de chanson** :
   - Sylvie raconte avec amour son fils Stevens (24 ans, courageux, soutien de famille, père défunt, lumière dans la famille : *« En fait je ne sais pas quoi lui dire... »*).
   - Le bot avait une fonction `looksLikeLyricsBubble` qui vérifiait simplement si un message faisait >= 4 lignes et >= 160 caractères.
   - Résultat absurde : le système a cru que Sylvie avait composé elle-même les paroles de la chanson (`client_provided_lyrics`) !
2. **La punition du prospect dormeur** :
   - Sylvie avait cliqué sur une pub Facebook 2 mois auparavant sans acheter.
   - Le bot voyait que son contact datait d'avant aujourd'hui : il l'a qualifiée de « cliente existante » et lui a refusé le vocal de procédure expliquant le fonctionnement du studio, alors qu'elle ne l'avait jamais reçu de sa vie !

### Cas Réel 3 : Fargo Anne pour Sanfo Alassane (+226 70 78 49 83 - Burkina Faso)
1. **Question robotique blessante face à une confidence intime** :
   - La cliente confie un texte bouleversant de 530 caractères sur sa santé fragile, ses enfants et sa prière pour son foyer.
   - Au lieu d'accueillir avec chaleur et respect, un filet algorithmique s'affole et pose froidement : *« Avez-vous déjà commandé une chanson chez nous ? 🙏 »* !
2. **Censure de l'expression ouest-africaine « Le numéro de dépôt »** :
   - La cliente demande tout simplement *« Le numéro de dépôt »*.
   - Pas de verbe dans la phrase ➔ le filtre anti-paiement prématuré détruit les coordonnées bancaires, laissant la cliente sans réponse sur comment payer.

### Cas Réel 4 : Adeline rock TEPY pour Rita (+225 0747213340 - Côte d'Ivoire)
1. **Le bug mathématique de minuit UTC** :
   - La cliente écrit à 23h51 UTC. À 00h00 UTC (9 minutes plus tard), la date change.
   - Le code compare `slice(0, 10)` calendaire : le bot croit que la cliente est une ancienne cliente d'un autre jour et sabote le tunnel de vente.
2. **Faux positif sur « Non pas encore »** :
   - La cliente répond à une question en disant *« Non pas encore »*. Le filtre attrape `non pas` et décrète un revirement négatif.
3. **L'amnésie des paroles déjà livrées** :
   - Les paroles écrites dans le chat n'étaient pas reconnues comme livrées si elles n'étaient pas passées par une table de cron spécifique. L'agent disait *« Votre texte vous sera envoyé personnellement »* alors que le texte était juste sous les yeux de la cliente !

### Cas Réel 5 : Les Aveux d'Impuissance Robotiques Dégradants
- Dès qu'un client utilisait de l'argot local ivoirien (*« kpata là voyons voir le son »*, *« c'est propre »*, *« enjaillement »*), le bot répondait :  
  *« Je n'ai pas bien compris votre message, pouvez-vous reformuler ? »*  
- **C'est la pire chose possible en vente commerciale** : cela brise instantanément l'illusion humaine et fait fuir le client.

---

## 3. 🎯 LA VISION ULTIME : DE L'AGENT UNIQUE À VELARIS STUDIO OS

Ce que nous voulons, ce n'est pas seulement « réparer un script ».
C'est créer **l'infrastructure de vente conversationnelle la plus intelligente, chaleureuse et robuste d'Afrique**, intégrée dans Velaris Platform.

### Les Exigences Fondamentales Inviolables de l'Infrastructure :

1. **Multi-Studio Natif & Personnalisé** :
   - Chaque entrepreneur de l'Académie a sa propre boutique.
   - Il connecte son numéro WhatsApp via WAHA (ex: session `studio_kaboré`, `studio_diarra`).
   - L'agent s'appelle Alex (ou le prénom choisi par le gérant), utilise le ton du studio, les coordonnées Mobile Money du gérant (Wave, OM, Moov), et son catalogue de tarifs.
2. **Compréhension Totale du Contexte Culturel & Oral** :
   - L'agent doit comprendre l'argot, les fautes, les expressions comme *« Le dépôt c'est sur quelle numéro »*, *« J'attends alors »*, *« C'est validé »*, *« Kpata »*, sans jamais déclarer forfait ni sortir un aveu robotique d'impuissance.
   - « Bien reçu » = accusé d'écoute d'un vocal, **JAMAIS** une preuve de paiement.
   - « J'attends » = attente polie et positive, **JAMAIS** une objection ou un refus.
3. **Zéro Boîte Noire de 35 000 Tokens & Zéro Usine à Gaz Regex** :
   - Pas de millefeuille de 54 règles qui se marchent sur les pieds.
   - Une architecture saine :
     - **Extraction de Faits & Intentions** : Le LLM qualifie le sens avec précision et certitude en JSON.
     - **Machine à États Robuste** : Le code sait exactement où en est la commande (`lead` ➔ `brief_recueilli` ➔ `vocal_envoyé` ➔ `paroles_proposées` ➔ `paroles_validées` ➔ `attente_paiement` ➔ `paiement_confirmé` ➔ `production_suno` ➔ `livré`).
     - **Garde-fous Métier Infaillibles** : Pas d'hallucination de prix, pas de numéros de paiement inventés, pas de crochets `[...]` visibles, pas de gel nocturne imprévu.
4. **Savoir Accompagner et Savoir s'Arrêter** :
   - Poser **1 seule question par message** pour guider le client sans le submerger.
   - Respecter les étapes : Le vocal de procédure part **SEUL**. Les paroles partent **SEULES**. Les coordonnées de paiement ne partent **QUE** quand le client a choisi une offre ou validé le texte.
   - Quand le brief est complet ou que le gérant humain intervient, le bot **se tait immédiatement** et sait passer le relais avec élégance.

---

## 4. ORDRE DE MISSION POUR CLAUDE OPUS 5.5

Claude :
Prends la pleine mesure de cette réalité opérationnelle.
Ne te contente pas d'une vue logicielle abstraite. Intègre ces cas réels, cette psychologie de vente, ce parcours client et cette vision de plateforme.
1. Analyse comment notre architecture définitive (`ARCHITECTURE_AGENT_DEFINITIVE.md`) répond point par point à chacun de ces écueils historiques de terrain.
2. Enrichis et bétonne la spécification pour garantir que l'infrastructure que nous bâtirons sera la référence absolue, incassable et prête pour des milliers de ventes réelles.
