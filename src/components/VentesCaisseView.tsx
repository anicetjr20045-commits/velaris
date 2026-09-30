import { useState, type FC } from 'react';
import { 
  Wallet, 
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
          <div className="flex items-center gap-2.5 mb-1.5">
            <Wallet className="h-6 w-6 text-[#c5a059]" />
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#f3f4f6]">
              Ventes & Caisse
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xl">
            Journal des encaissements directs Mobile Money (Wave, Orange Money, Moov).
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14120f] hover:bg-[#1e1c17] text-stone-200 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5 text-stone-400" />
          <span>Exporter le grand livre</span>
        </button>
      </div>

      {/* 2. Résumé de la Caisse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-950/30 bg-[#12110e] p-5 shadow-lg">
          <div className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-1">
            Total Encaissé
          </div>
          <div className="font-serif text-3xl font-bold text-[#f3f4f6]">
            {new Intl.NumberFormat('fr-FR').format(totalCaisse)} F CFA
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            <span>100 % fonds disponibles sans intermédiaire</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-5 shadow-lg">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#1dc3ff] mb-1">
            Wave Mobile Money
          </div>
          <div className="font-serif text-3xl font-bold text-[#f3f4f6]">
            {new Intl.NumberFormat('fr-FR').format(waveTotal)} F CFA
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            66.4 % des encaissements studio
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12110e] p-5 shadow-lg">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#ff7900] mb-1">
            Orange Money & Moov
          </div>
          <div className="font-serif text-3xl font-bold text-[#f3f4f6]">
            {new Intl.NumberFormat('fr-FR').format(omTotal)} F CFA
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            33.6 % des encaissements studio
          </div>
        </div>
      </div>

      {/* 3. Filtres & Recherche */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher une commande, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#12110e] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-[#c5a059]"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {['all', 'Wave', 'Orange'].map((p) => (
            <button
              key={p}
              onClick={() => setPaymentFilter(p)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                paymentFilter === p
                  ? 'bg-[#c5a059] text-black font-semibold'
                  : 'bg-[#14120f] text-stone-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {p === 'all' ? 'Tous modes' : p}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Table des transactions de vente */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e0d0b] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-[#14120e] text-[11px] uppercase tracking-wider text-stone-400 border-b border-white/[0.06]">
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
                  <td className="py-3 px-4 font-mono font-bold text-stone-200">
                    {o.id}
                    <div className="text-[10px] text-stone-400 font-normal">{o.createdAt}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-white">
                    {o.clientName}
                    <div className="text-[10px] text-stone-400 font-mono font-normal">{o.clientPhone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-stone-300">{o.occasion}</span>
                    <div className="text-[10px] text-[#c5a059] capitalize">{o.style.replace('_', ' ')}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.06] text-stone-300 font-medium">
                      {o.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-stone-100 text-sm">
                    {new Intl.NumberFormat('fr-FR').format(o.amount)} FCFA
                  </td>
                  <td className="py-3 px-4 text-center">
                    {onSelectOrderForStudio && (
                      <button
                        onClick={() => onSelectOrderForStudio(o.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#c5a059] hover:underline cursor-pointer font-medium"
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
