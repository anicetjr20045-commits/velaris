import { useState, type FC } from 'react';
import { 
  Download, 
  Search, 
  CheckCircle2, 
  ArrowUpRight
} from 'lucide-react';
import type { Order } from '../types';

interface VentesCaisseViewProps {
  orders: Order[];
  onSelectOrderForStudio?: (orderId: string) => void;
}

export const VentesCaisseView: FC<VentesCaisseViewProps> = ({
  orders,
  onSelectOrderForStudio
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.occasion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.clientPhone.includes(searchTerm);
    const matchesPayment = paymentFilter === 'all' || o.paymentMethod.toLowerCase().includes(paymentFilter.toLowerCase());
    return matchesSearch && matchesPayment;
  });

  const totalCaisse = 3644400;
  const waveTotal = 2420000;
  const omTotal = 1224400;

  const exportCsv = () => {
    const headers = ['ID', 'Client', 'WhatsApp', 'Destinataire', 'Occasion', 'Style', 'Statut', 'Montant FCFA', 'Paiement', 'Date'];
    const rows = filteredOrders.map(o => [
      o.id,
      `"${o.clientName}"`,
      `"${o.clientPhone}"`,
      `"${o.recipient}"`,
      `"${o.occasion}"`,
      o.style,
      o.status,
      o.amount,
      o.paymentMethod,
      `"${o.createdAt}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `velaris_ventes_caisse_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. En-tête Ventes & Caisse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono tracking-wider text-neutral-300 uppercase">
              TRÉSORERIE STUDIO
            </span>
            <span className="text-xs font-mono text-neutral-500">Encaissements Mobile Money</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Ventes & Caisse Directe
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Journal comptable des paiements reçus directement sur vos comptes Wave, Orange Money et Moov.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-mono transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Exporter le grand livre</span>
        </button>
      </div>

      {/* 2. Résumé de la Caisse — Precision Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
            Total Encaissé Net
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {new Intl.NumberFormat('fr-FR').format(totalCaisse)} F CFA
          </div>
          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>100% direct sur vos comptes</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
            Part Wave Mobile Money
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {new Intl.NumberFormat('fr-FR').format(waveTotal)} F CFA
          </div>
          <div className="text-[11px] font-mono text-neutral-400 pt-1">
            66.4% du volume d'encaissement
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
            Part Orange Money & Moov
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {new Intl.NumberFormat('fr-FR').format(omTotal)} F CFA
          </div>
          <div className="text-[11px] font-mono text-neutral-400 pt-1">
            33.6% du volume d'encaissement
          </div>
        </div>
      </div>

      {/* 3. Filtres & Recherche */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            placeholder="Rechercher une commande, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#07080B] border border-white/[0.06] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20 transition-all font-sans"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {['all', 'Wave', 'Orange'].map((p) => (
            <button
              key={p}
              onClick={() => setPaymentFilter(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer border ${
                paymentFilter === p
                  ? 'border-white bg-white text-black font-semibold shadow-sm'
                  : 'bg-[#07080B] text-neutral-400 hover:text-white border-white/[0.06] hover:bg-white/[0.03]'
              }`}
            >
              {p === 'all' ? 'Tous modes' : p}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Table des transactions de vente */}
      <div className="rounded-xl border border-white/[0.06] bg-[#07080B] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#0D0F14] text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-white/[0.06]">
              <tr>
                <th className="py-3 px-4">Commande</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Occasion & Style</th>
                <th className="py-3 px-4">Paiement</th>
                <th className="py-3 px-4 text-right">Montant</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-white">
                    {o.id}
                    <div className="text-[10px] text-neutral-500 font-normal">{o.createdAt}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-white">
                    {o.clientName}
                    <div className="text-[10px] text-neutral-400 font-mono">{o.clientPhone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-neutral-300">{o.occasion}</span>
                    <div className="text-[10px] text-neutral-400 capitalize">{o.style.replace('_', ' ')}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-neutral-300 border border-white/[0.06]">
                      {o.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                    {new Intl.NumberFormat('fr-FR').format(o.amount)} FCFA
                  </td>
                  <td className="py-3 px-4 text-center">
                    {onSelectOrderForStudio && (
                      <button
                        onClick={() => onSelectOrderForStudio(o.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white cursor-pointer font-mono"
                      >
                        <span>Atelier</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
