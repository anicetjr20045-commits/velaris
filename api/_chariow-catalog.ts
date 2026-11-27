export interface ChariowCatalogItem {
  productId: string;
  kind: 'subscription' | 'pack';
  label: string;
  priceCfa: number;
  credits: number;
  durationDays: number;
}

export const CHARIOW_CATALOG: Record<string, ChariowCatalogItem> = {
  prd_bh3vpcup: {
    productId: 'prd_bh3vpcup',
    kind: 'subscription',
    label: 'Pass Créateur Djelia Academy (4 900 F CFA / 30 jours)',
    priceCfa: 4900,
    credits: 30,
    durationDays: 30,
  },
  prd_ps1n1r1z: {
    productId: 'prd_ps1n1r1z',
    kind: 'pack',
    label: 'Pack Starter · +20 crédits (2 000 F CFA)',
    priceCfa: 2000,
    credits: 20,
    durationDays: 0,
  },
  prd_6x7tpj8z: {
    productId: 'prd_6x7tpj8z',
    kind: 'pack',
    label: 'Pack Studio Pro · +55 crédits (4 500 F CFA)',
    priceCfa: 4500,
    credits: 55,
    durationDays: 0,
  },
  prd_x88amcm9: {
    productId: 'prd_x88amcm9',
    kind: 'pack',
    label: 'Pack Agence · +125 crédits (9 000 F CFA)',
    priceCfa: 9000,
    credits: 125,
    durationDays: 0,
  },
};

export function resolveChariowProduct(
  productId?: string | null,
  amountCfa?: number | null,
  fallbackId: string = 'prd_bh3vpcup',
): ChariowCatalogItem {
  const pid = String(productId || '').trim();
  if (pid && CHARIOW_CATALOG[pid]) return CHARIOW_CATALOG[pid];
  const amt = Number(amountCfa || 0);
  if (amt > 0) {
    const byPrice = Object.values(CHARIOW_CATALOG).find((c) => c.priceCfa === amt);
    if (byPrice) return byPrice;
  }
  return CHARIOW_CATALOG[fallbackId] || CHARIOW_CATALOG.prd_bh3vpcup;
}
