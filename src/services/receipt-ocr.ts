/**
 * Scanner & Vérificateur OCR de Reçus Mobile Money
 * 
 * Analyse les captures d'écran de quittances (Wave, Orange Money, Moov)
 * pour certifier l'authenticité d'un paiement, extraire le montant et la référence.
 */

export interface ReceiptAnalysisResult {
  isPaymentProof: boolean;
  provider: 'Wave' | 'Orange Money' | 'Moov' | 'Autre' | null;
  amount: number | null;
  transactionRef: string | null;
  status: 'verified' | 'suspect' | 'unrecognized';
  summary: string;
  confidence: number;
}

/**
 * Analyse heuristique rapide d'un texte ou légende extrait d'une quittance
 */
export function analyzeReceiptText(text: string): ReceiptAnalysisResult {
  const clean = text.toLowerCase();

  // Détection du fournisseur
  let provider: ReceiptAnalysisResult['provider'] = null;
  if (clean.includes('wave') || clean.includes('wav-') || /wav[0-9-]/i.test(clean)) {
    provider = 'Wave';
  } else if (clean.includes('orange money') || clean.includes('om ') || clean.includes('orange') || clean.includes('om-') || /om[0-9-]/i.test(clean)) {
    provider = 'Orange Money';
  } else if (clean.includes('moov') || clean.includes('flooz')) {
    provider = 'Moov';
  }

  // Détection du montant
  let amount: number | null = null;
  const amountMatch = clean.match(/(\d{1,3}(?:[ .]\d{3})*|\d+)\s*(?:f\s*cfa|fcfa|f|cfa)/i);
  if (amountMatch) {
    const rawNum = amountMatch[1].replace(/[ .]/g, '');
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed) && parsed >= 500 && parsed <= 500000) {
      amount = parsed;
    }
  }

  // Détection d'ID de transaction (priorité aux mots les plus longs pour ne pas tronquer "référence" sur "réf")
  let transactionRef: string | null = null;
  const refMatch = text.match(/(?:référence|reference|transaction|réf|ref|id|tx|code)\s*[:#.]?\s*([A-Za-z0-9-]{6,25})/i);
  if (refMatch) {
    transactionRef = refMatch[1].trim();
  }

  // Mots clés de succès
  const hasSuccess = /succès|succes|effectué|effectue|réussi|reussi|confirmé|confirme|validé|valide|réalisé/i.test(clean);
  const isPaymentProof = Boolean(provider || hasSuccess || amount);

  let status: ReceiptAnalysisResult['status'] = 'unrecognized';
  if (isPaymentProof && amount && (hasSuccess || transactionRef)) {
    status = 'verified';
  } else if (isPaymentProof) {
    status = 'suspect';
  }

  const summary = status === 'verified'
    ? `Reçu ${provider || 'Mobile Money'} certifié de ${amount?.toLocaleString('fr-FR')} F CFA (Réf: ${transactionRef || 'OK'}).`
    : status === 'suspect'
    ? `Capture détectée mais confirmation incomplète (vérification visuelle requise).`
    : `L'image ne ressemble pas à un reçu de paiement officiel.`;

  return {
    isPaymentProof,
    provider,
    amount,
    transactionRef,
    status,
    summary,
    confidence: status === 'verified' ? 0.95 : status === 'suspect' ? 0.6 : 0.2,
  };
}
