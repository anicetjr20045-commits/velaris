/**
 * Moteur Ghostwriter & Suggestions Commerciales en Direct
 * 
 * Fournit 3 variantes de réponses contextualisées pour chaque tour client,
 * et permet de reformuler instantanément n'importe quel texte brut en un clic.
 */

export interface GhostwriterVariants {
  variantDirect: {
    label: string;
    text: string;
    tag: string;
  };
  variantWarm: {
    label: string;
    text: string;
    tag: string;
  };
  variantConcise: {
    label: string;
    text: string;
    tag: string;
  };
}

/**
 * Génère 3 variantes chirurgicales de réponse selon l'intention et le stade de vente
 */
export function generateGhostwriterVariants(
  stageKey: string,
  clientName: string,
  recipientName: string,
  occasion: string,
  recommendedBase: string
): GhostwriterVariants {
  const shortClient = clientName && !clientName.startsWith('+') && !clientName.toLowerCase().includes('client')
    ? clientName.split(' ')[0]
    : '';
  const greeting = shortClient ? `Bonjour ${shortClient}` : 'Bonjour';
  const target = recipientName || 'votre proche';
  const occLabel = occasion && occasion !== 'Occasion spéciale' ? occasion.toLowerCase() : 'cette occasion';

  switch (stageKey) {
    case 'accueil':
      return {
        variantDirect: {
          label: 'Direct & Efficace',
          text: `${greeting} ! Voulez-vous composer une chanson personnalisée pour ${target} ?`,
          tag: 'Standard',
        },
        variantWarm: {
          label: 'Chaleureux & Accueillant',
          text: `${greeting} et bienvenue au studio musical ! C'est un réel plaisir de vous accompagner pour célébrer ${target}. Voulez-vous qu'on prépare une chanson sur-mesure ?`,
          tag: 'Relationnel',
        },
        variantConcise: {
          label: 'Court (Mobile)',
          text: `${greeting}, voulez-vous une chanson personnalisée ?`,
          tag: 'Rapide',
        },
      };

    case 'brief_incomplet':
    case 'brief_complet':
      return {
        variantDirect: {
          label: 'Direct (4 Repères)',
          text: `Pour bien composer les paroles pour ${target} : quel est son prénom exact, l'occasion (${occLabel}) et 1 ou 2 petits souvenirs marquants ?`,
          tag: 'Précis',
        },
        variantWarm: {
          label: 'Poétique & Émotion',
          text: `C'est une magnifique intention pour ${target} ! Racontez-moi un peu ce qu'elle représente pour vous et quelques anecdotes pour que les paroles touchent droit au cœur.`,
          tag: 'Émotion',
        },
        variantConcise: {
          label: 'Court',
          text: `Quel est le prénom de la personne et quelques souvenirs à glisser dans la chanson ?`,
          tag: 'Rapide',
        },
      };

    case 'presentation_offres':
      return {
        variantDirect: {
          label: 'Formules Claires',
          text: `Nous faisons la chanson à 1 200 F (texte seul). Nous avons aussi un autre modèle vidéo avec photos à 3 000 F. Tout dépend de votre choix !`,
          tag: 'Tarif officiel',
        },
        variantWarm: {
          label: 'Conseil Studio',
          text: `Pour mettre en valeur ${target}, vous avez la formule chanson seule à 1 200 F, ou le coffret complet avec clip vidéo et ses photos à 3 000 F. Laquelle vous ferait le plus plaisir ?`,
          tag: 'Valeur',
        },
        variantConcise: {
          label: 'Synthétique',
          text: `Nos formules : 1 200 F (chanson seule) ou 3 000 F (avec montage vidéo). Que préférez-vous ?`,
          tag: 'Rapide',
        },
      };

    case 'validation_texte':
      return {
        variantDirect: {
          label: 'Clôture & Paiement',
          text: `Super, merci pour votre validation ! Vous pouvez donc passer au paiement Wave ou Orange Money svp une capture pour lancer la fabrication au studio.`,
          tag: 'Clôture',
        },
        variantWarm: {
          label: 'Enthousiaste',
          text: `Nous sommes ravis que ce texte pour ${target} vous touche autant ! Dès réception de votre règlement et de la capture, notre équipe démarre le mixage audio.`,
          tag: 'Engagement',
        },
        variantConcise: {
          label: 'Court',
          text: `C'est validé ! Vous pouvez envoyer le règlement svp une capture dès que c'est fait.`,
          tag: 'Rapide',
        },
      };

    case 'paiement_recu':
      return {
        variantDirect: {
          label: 'Confirmation Réception',
          text: `Paiement bien reçu, merci beaucoup ! Votre chanson passe en composition studio, livraison d'ici 18 minutes chrono.`,
          tag: 'Lancement',
        },
        variantWarm: {
          label: 'Solennel & Rassurant',
          text: `Votre paiement est bien enregistré. Nos musiciens et ingénieurs du son s'occupent de la production pour ${target}. Ça sort tout de suite !`,
          tag: 'Studio',
        },
        variantConcise: {
          label: 'Court',
          text: `Bien reçu merci ! La chanson arrive dans moins de 20 minutes.`,
          tag: 'Rapide',
        },
      };

    case 'suivi_production':
      return {
        variantDirect: {
          label: 'Mixage en cours',
          text: `Votre chanson est en plein mixage et mastering au studio ! Ça sort d'ici quelques minutes.`,
          tag: 'Statut',
        },
        variantWarm: {
          label: 'Chaleureux',
          text: `Rassurez-vous, tout se passe à merveille ! On apporte la touche finale en studio et on vous dépose le titre très rapidement.`,
          tag: 'Rassurant',
        },
        variantConcise: {
          label: 'Court',
          text: `C'est presque prêt, ça arrive dans un instant !`,
          tag: 'Rapide',
        },
      };

    case 'retouches':
      return {
        variantDirect: {
          label: 'Retouche acceptée',
          text: `C'est bien noté, je modifie le texte immédiatement ! Dites-moi si vous souhaitez changer un autre détail.`,
          tag: 'Retouche',
        },
        variantWarm: {
          label: 'Bienveillant',
          text: `Aucun souci, nous voulons que ce soit absolument parfait pour ${target}. Je réajuste ça tout de suite pour vous !`,
          tag: 'Service',
        },
        variantConcise: {
          label: 'Court',
          text: `C'est noté, je rectifie ça de suite !`,
          tag: 'Rapide',
        },
      };

    default:
      return {
        variantDirect: {
          label: 'Recommandation',
          text: recommendedBase || `${greeting}, comment puis-je vous aider au mieux ?`,
          tag: 'Prêt',
        },
        variantWarm: {
          label: 'Chaleureux',
          text: `${greeting} ! Nous restons à votre entière disposition pour faire de ce projet une réussite.`,
          tag: 'Courtois',
        },
        variantConcise: {
          label: 'Concis',
          text: recommendedBase ? recommendedBase.split('.')[0] + '.' : `${greeting}, que souhaitez-vous ?`,
          tag: 'Court',
        },
      };
  }
}

/**
 * Modifie la tonalité d'un texte rédigé en 1 clic
 */
export function shiftTextTone(text: string, tone: 'shorter' | 'warmer' | 'action'): string {
  const trimmed = text.trim();
  if (!trimmed) return text;

  if (tone === 'shorter') {
    const cleanPunct = trimmed.replace(/[.!?]+$/, '');
    const sentences = cleanPunct.split(/(?:[.!?]|\n)\s+/).filter(Boolean);
    if (sentences.length > 1) {
      return `${sentences[0].trim()}.`;
    }
    const clauses = cleanPunct.split(/[,;]\s+/).filter(Boolean);
    if (clauses.length > 1) {
      return `${clauses[0].trim()}.`;
    }
    const words = cleanPunct.split(/\s+/);
    if (words.length > 10) {
      return `${words.slice(0, Math.ceil(words.length * 0.65)).join(' ').trim()}.`;
    }
    return `${cleanPunct}.`;
  }

  if (tone === 'warmer') {
    if (!trimmed.includes('merci') && !trimmed.includes('plaisir')) {
      return `Avec grand plaisir ! ${trimmed} 🙏`;
    }
    return `${trimmed} 🙏`;
  }

  if (tone === 'action') {
    if (!trimmed.includes('capture') && (trimmed.includes('paiement') || trimmed.includes('Wave') || trimmed.includes('Orange') || trimmed.includes('compte'))) {
      return `${trimmed}\nSvp envoyez la capture d'écran dès validation pour lancer la composition immédiate !`;
    }
  }

  return trimmed;
}
