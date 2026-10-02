import { useEffect, useState, type CSSProperties, type FC } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Search,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import type { Order } from '../types';
import { useCountUp } from '../hooks/useCountUp';

interface VentesCaisseViewProps {
  orders: Order[];
  onSelectOrderForStudio?: (orderId: string) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

/* Couleurs d'opérateur, désaturées pour rester dans la palette graphite */
const PROVIDERS = {
  wave: { label: 'Wave', dot: 'bg-sky-400', stroke: '#38BDF8', text: 'text-sky-300' },
  orange: { label: 'Orange Money & Moov', dot: 'bg-orange-400', stroke: '#FB923C', text: 'text-orange-300' },
} as const;

const providerOf = (method: string) => {
  const m = method.toLowerCase();
  if (m.includes('wave')) return { dot: 'bg-sky-400', label: method };
  if (m.includes('orange')) return { dot: 'bg-orange-400', label: method };
  if (m.includes('moov')) return { dot: 'bg-blue-500', label: method };
  if (m.includes('mtn')) return { dot: 'bg-yellow-400', label: method };
  return { dot: 'bg-neutral-500', label: method };
};

const STATUS_LABEL: Record<Order['status'], { label: string; dot: string }> = {
  brief_recu: { label: 'Brief reçu', dot: 'bg-sky-400' },
  paroles_pretes: { label: 'Paroles prêtes', dot: 'bg-white' },
  paiement_valide: { label: 'Payé', dot: 'bg-[#E5B54F]' },
  production_suno: { label: 'En studio', dot: 'bg-violet-400' },
  livre: { label: 'Livré', dot: 'bg-emerald-400' },
};

/* Jauge circulaire : l'arc se dessine à l'apparition */
const RingGauge: FC<{ share: number; stroke: string; delay?: number }> = ({ share, stroke, delay = 0 }) => {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 108 108" className="h-24 w-24 -rotate-90 shrink-0" aria-hidden="true">
      <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle
        cx="54"
        cy="54"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={drawn ? c * (1 - share) : c}
        style={{ transition: `stroke-dashoffset 1200ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms` }}
      />
    </svg>
  );
};

export const VentesCaisseView: FC<VentesCaisseViewProps> = ({
  orders,
  onSelectOrderForStudio
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  const term = searchTerm.toLowerCase();
  const searched = orders.filter(o =>
    o.clientName.toLowerCase().includes(term) ||
    o.occasion.toLowerCase().includes(term) ||
    o.clientPhone.includes(searchTerm)
  );
  const filteredOrders = searched.filter(o =>
    paymentFilter === 'all' || o.paymentMethod.toLowerCase().includes(paymentFilter.toLowerCase())
  );
  const filteredTotal = filteredOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

  const totalCaisse = 3644400;
  const waveTotal = 2420000;
  const omTotal = 1224400;
  const waveShare = waveTotal / totalCaisse;
  const omShare = omTotal / totalCaisse;

  const animatedTotal = useCountUp(totalCaisse, 1100);
  const animatedWave = useCountUp(waveTotal, 1100);
  const animatedOm = useCountUp(omTotal, 1100);

  const filters = [
    { id: 'all', label: 'Tous modes' },
    { id: 'Wave', label: 'Wave' },
    { id: 'Orange', label: 'Orange Money' },
  ].map(f => ({
    ...f,
    count: f.id === 'all' ? searched.length : searched.filter(o => o.paymentMethod.toLowerCase().includes(f.id.toLowerCase())).length,
  }));

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
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `velaris_ventes_caisse_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const providerCards = [
    { key: 'wave' as const, value: animatedWave, share: waveShare, note: 'Reçus sur votre numéro Wave' },
    { key: 'orange' as const, value: animatedOm, share: omShare, note: 'Reçus sur Orange Money et Moov' },
  ];

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-16 vx-view-enter">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Ventes & trésorerie</h1>
          <p className="text-sm sm:text-base text-[#A3A3A3] mt-2 leading-relaxed max-w-xl">
            Le grand livre des paiements reçus directement sur vos comptes Wave, Orange Money et Moov.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-white/[0.12] bg-white/[0.02] px-4 py-2 text-[13px] text-neutral-200 hover:text-white hover:border-white/25 transition-colors duration-200 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
          Exporter le grand livre
        </button>
      </div>

      {/* Coffre */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4">
        <div className="vx-hairline relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-6 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_14rem_at_0%_0%,rgba(229,181,79,0.09),transparent_70%)]"
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-[13px] text-[#A3A3A3]">Total encaissé net</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 text-[12.5px] text-emerald-300">
              <ShieldCheck className="h-3 w-3" strokeWidth={1.75} />
              100 % sur vos comptes
            </span>
          </div>
          <div className="relative mt-4 flex items-baseline gap-2">
            <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white">{fmt(animatedTotal)}</span>
            <span className="text-sm text-neutral-500">F CFA</span>
          </div>

          {/* Répartition en une barre */}
          <div className="relative mt-7">
            <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
              <span className="vx-fill block h-full rounded-full bg-sky-400" style={{ width: `${waveShare * 100}%` } as CSSProperties} />
              <span className="vx-fill block h-full rounded-full bg-orange-400" style={{ width: `${omShare * 100}%`, '--i': 3 } as CSSProperties} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[12.5px]">
              <span className="inline-flex items-center gap-1.5 text-[#A3A3A3]">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Wave
                <span className="font-mono text-white">{(waveShare * 100).toFixed(1).replace('.', ',')} %</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#A3A3A3]">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Orange Money & Moov
                <span className="font-mono text-white">{(omShare * 100).toFixed(1).replace('.', ',')} %</span>
              </span>
            </div>
          </div>

          <div className="relative mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-3 gap-3">
            {[
              { label: 'Marge brute', value: '92,4 %' },
              { label: 'Commission Velaris', value: '0 F' },
              { label: 'Délai de versement', value: 'Immédiat' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[12.5px] text-neutral-500">{s.label}</div>
                <div className="mt-1 font-mono text-sm font-semibold text-white">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {providerCards.map((p, i) => {
            const meta = PROVIDERS[p.key];
            return (
              <div
                key={p.key}
                style={{ '--i': i + 1 } as CSSProperties}
                className="vx-stagger vx-hairline flex items-center gap-5 rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-5"
              >
                <div className="relative">
                  <RingGauge share={p.share} stroke={meta.stroke} delay={150 + i * 150} />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold text-white">
                    {Math.round(p.share * 100)}%
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px] text-[#A3A3A3]">
                    <Smartphone className={`h-3 w-3 ${meta.text}`} strokeWidth={1.75} />
                    {meta.label}
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-bold tracking-tight text-white">
                    {fmt(p.value)}
                    <span className="ml-1.5 text-[13px] font-medium text-neutral-500">F</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-neutral-500">{p.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grand livre */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0B0C10] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5 self-start">
            {filters.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPaymentFilter(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] transition-colors duration-200 cursor-pointer ${
                  paymentFilter === f.id ? 'bg-white text-black font-medium' : 'text-[#A3A3A3] hover:text-white'
                }`}
              >
                {f.label}
                <span className="font-mono text-[11.5px] text-neutral-500">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Commande, client, numéro"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-neutral-500 outline-none focus:border-white/20 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="text-[12.5px] text-neutral-500 border-b border-white/[0.08]">
                <th className="py-3 px-5 font-normal">Écriture</th>
                <th className="py-3 px-4 font-normal">Client</th>
                <th className="py-3 px-4 font-normal">Occasion</th>
                <th className="py-3 px-4 font-normal">Encaissement</th>
                <th className="py-3 px-4 font-normal text-right">Montant</th>
                <th className="py-3 px-5 font-normal" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-neutral-500">
                    Aucune écriture ne correspond. Effacez la recherche ou choisissez « Tous modes ».
                  </td>
                </tr>
              )}
              {filteredOrders.map((o, i) => {
                const provider = providerOf(o.paymentMethod);
                const status = STATUS_LABEL[o.status];
                return (
                  <tr
                    key={o.id}
                    style={{ '--i': Math.min(i, 10) } as CSSProperties}
                    className="vx-stagger group border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors duration-150"
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-mono font-semibold text-white">{o.id}</div>
                      <div className="mt-0.5 font-mono text-xs text-neutral-500">{o.createdAt}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-neutral-100">{o.clientName}</div>
                      <div className="mt-0.5 font-mono text-xs text-neutral-500">{o.clientPhone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-neutral-300">{o.occasion}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-neutral-500">
                        {status && <span className={`h-1 w-1 rounded-full ${status.dot}`} />}
                        <span className="capitalize">{o.style.replace(/_/g, ' ')}</span>
                        {status && <span className="text-neutral-600">/ {status.label}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[12.5px] text-neutral-300">
                        <span className={`h-1.5 w-1.5 rounded-full ${provider.dot}`} />
                        {provider.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono text-sm font-semibold text-white">+{fmt(o.amount)}</span>
                      <span className="ml-1 text-xs text-neutral-500">F</span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {onSelectOrderForStudio && (
                        <button
                          type="button"
                          onClick={() => onSelectOrderForStudio(o.id)}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] text-neutral-500 group-hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                        >
                          Atelier
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot>
                <tr className="border-t border-white/[0.08] bg-white/[0.015]">
                  <td colSpan={4} className="py-3.5 px-5 text-[12.5px] text-[#A3A3A3]">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" strokeWidth={1.75} />
                      {filteredOrders.length} écriture{filteredOrders.length > 1 ? 's' : ''} affichée{filteredOrders.length > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-mono text-sm font-bold text-white">{fmt(filteredTotal)}</span>
                    <span className="ml-1 text-xs text-neutral-500">F</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
