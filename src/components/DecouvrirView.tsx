import { useState, type FC } from 'react';

export const DecouvrirView: FC = () => {
  const [dailyOrders, setDailyOrders] = useState<number>(5);

  const averageBasket = 3000;
  const monthlyRevenue = dailyOrders * averageBasket * 30;
  const estimatedAdCost = Math.round(monthlyRevenue * 0.15);
  const netProfit = monthlyRevenue - estimatedAdCost;

  const formatNumber = (val: number) => new Intl.NumberFormat('fr-FR').format(val);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 text-[#d1d5db]">
      <div className="space-y-2">
        <div className="text-xs uppercase font-medium tracking-wider text-[#c5a059]">
          Simulation financière détaillée
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Modèle économique & rentabilité
        </h1>
        <p className="text-sm text-zinc-300 max-w-xl">
          Simulez le potentiel de revenus d'un studio de chansons WhatsApp selon votre volume de production quotidien.
        </p>
      </div>

      <div className="border border-white/[0.1] bg-[#0c0d11] rounded-2xl p-6 sm:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-white">
              Bénéfice net mensuel estimé
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Basé sur un panier moyen éprouvé de {formatNumber(averageBasket)} <span className="whitespace-nowrap">FCFA</span>.
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="font-sans text-2xl sm:text-3xl font-bold text-emerald-400">
              {formatNumber(netProfit)} <span className="whitespace-nowrap">FCFA</span>
            </span>
            <span className="text-xs text-zinc-400 block mt-0.5">net / mois en poche</span>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-zinc-300">Commandes livrées par jour :</span>
            <span className="font-sans font-bold text-white text-sm bg-white/[0.06] border border-white/10 px-3 py-1 rounded-lg">
              {dailyOrders} commande{dailyOrders > 1 ? 's' : ''} / jour
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={15}
            step={1}
            value={dailyOrders}
            onChange={(e) => setDailyOrders(Number(e.target.value))}
            className="w-full h-1.5 bg-neutral-800 appearance-none cursor-pointer accent-white"
          />

          <div className="flex justify-between text-xs text-zinc-400">
            <span>1 commande / jour</span>
            <span>5 commandes / jour</span>
            <span>15 commandes / jour</span>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.08] text-sm">
          <div className="border border-white/[0.06] bg-white/[0.02] p-4 rounded-xl">
            <span className="text-zinc-400 block text-xs">Chiffre d'affaires brut</span>
            <span className="font-sans text-lg font-bold text-white mt-1 block">
              {formatNumber(monthlyRevenue)} <span className="whitespace-nowrap">FCFA</span>
            </span>
            <span className="text-zinc-400 text-xs mt-0.5 block">{dailyOrders * 30} commandes / mois</span>
          </div>

          <div className="border border-white/[0.06] bg-white/[0.02] p-4 rounded-xl">
            <span className="text-zinc-400 block text-xs">Budget publicitaire estimé (15%)</span>
            <span className="font-sans text-lg font-bold text-zinc-300 mt-1 block">
              -{formatNumber(estimatedAdCost)} <span className="whitespace-nowrap">FCFA</span>
            </span>
            <span className="text-zinc-400 text-xs mt-0.5 block">TikTok & Facebook Ads</span>
          </div>

          <div className="border border-emerald-500/20 bg-emerald-500/[0.06] p-4 rounded-xl">
            <span className="text-emerald-400 block text-xs font-semibold">Bénéfice net retirable</span>
            <span className="font-sans text-lg font-bold text-white mt-1 block">
              {formatNumber(netProfit)} <span className="whitespace-nowrap">FCFA</span>
            </span>
            <span className="text-zinc-300 text-xs mt-0.5 block">Directement sur Wave & OM</span>
          </div>
        </div>
      </div>
    </div>
  );
};
