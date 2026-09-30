import { useState, type FC } from 'react';
import { 
  X, 
  Sparkles, 
  User, 
  Phone, 
  Heart, 
  Calendar, 
  Music, 
  Wallet, 
  FileText, 
  Mic, 
  CheckCircle2 
} from 'lucide-react';
import type { Order } from '../types';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (newOrder: Order) => void;
}

const STYLES = [
  { id: 'afro_love', label: 'Afro-Love (Romantique & Rythmé)' },
  { id: 'acoustique', label: 'Guitare Acoustique (Intime & Doux)' },
  { id: 'rumba', label: 'Rumba Congolaise (Mélodique & Festif)' },
  { id: 'zouk', label: 'Zouk Rétro (Sensuel & Enveloppant)' },
  { id: 'gospel', label: 'Gospel & Louange (Puissant & Reconnaissant)' },
  { id: 'mandingue', label: 'Mandingue / Kora (Traditionnel & Profond)' },
];

const OCCASIONS = [
  'Anniversaire',
  'Mariage / Dot',
  'Déclaration d’Amour',
  'Hommage Maman / Papa',
  'Pardon & Réconciliation',
  'Naissance / Baptême',
  'Diplôme / Réussite',
  'Autre Célébration',
];

const PACKS = [
  { amount: 1200, label: 'Formule Texte + MP3 Studio (1 200 F)' },
  { amount: 3000, label: 'Formule Complète Vidéo + MP3 (3 000 F)' },
  { amount: 5000, label: 'Pack VIP Express Master (5 000 F)' },
];

export const NewOrderModal: FC<NewOrderModalProps> = ({ isOpen, onClose, onAddOrder }) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [recipient, setRecipient] = useState('');
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [style, setStyle] = useState(STYLES[0].id);
  const [amount, setAmount] = useState(3000);
  const [paymentMethod, setPaymentMethod] = useState<'Wave' | 'Orange Money' | 'Moov Money'>('Wave');
  const [details, setDetails] = useState('');
  const [isAudioSimulated, setIsAudioSimulated] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !recipient.trim()) return;

    const newId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      id: newId,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || '+225 07 00 00 00 00',
      occasion,
      recipient: recipient.trim(),
      style,
      status: 'brief_recu',
      amount,
      paymentMethod,
      createdAt: 'À l’instant',
      transcription: details.trim() || `Commande spéciale pour ${recipient} à l'occasion de : ${occasion}. Style souhaité : ${style}.`,
      audioTrackUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    };

    onAddOrder(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/[0.12] bg-[#0e1017] p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Glow ambient */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#d4af37]/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.1] hover:text-white transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#e5c158]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-['Space_Grotesk'] text-white">
              Nouveau Lead / Prise de Brief Client
            </h2>
            <p className="text-xs text-white/60">
              Enregistrez une nouvelle commande WhatsApp issue de vos campagnes ads.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#e5c158]" /> Nom du Client
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Ibrahim Traoré"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#d4af37] focus:outline-none transition-all"
              />
            </div>

            {/* Client Phone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp Client
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ex: +225 07 12 34 56 78"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#d4af37] focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recipient */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-400" /> Prénom du Destinataire
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Ex: Fadila, Awa, Maman..."
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#d4af37] focus:outline-none transition-all"
              />
            </div>

            {/* Occasion */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-400" /> Occasion
              </label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#141620] px-3.5 py-2.5 text-sm text-white focus:border-[#d4af37] focus:outline-none transition-all"
              >
                {OCCASIONS.map((occ) => (
                  <option key={occ} value={occ}>
                    {occ}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Musical Style */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5 text-purple-400" /> Style Musical
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#141620] px-3.5 py-2.5 text-sm text-white focus:border-[#d4af37] focus:outline-none transition-all"
              >
                {STYLES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Package / Amount */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" /> Formule Choisie
              </label>
              <select
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-white/[0.08] bg-[#141620] px-3.5 py-2.5 text-sm text-white focus:border-[#d4af37] focus:outline-none transition-all"
              >
                {PACKS.map((pk) => (
                  <option key={pk.amount} value={pk.amount}>
                    {pk.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
              Moyen d'encaissement Mobile Money
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['Wave', 'Orange Money', 'Moov Money'] as const).map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                    paymentMethod === method
                      ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#e5c158]'
                      : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:bg-white/[0.05]'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Story / Brief Details */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#e5c158]" /> Histoire & Anecdotes du Client
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAudioSimulated(!isAudioSimulated);
                  if (!details) {
                    setDetails("Message vocal client : C'est pour ma dulcinée. Elle aime les surprises douces. Rappeler nos souvenirs à Bassam et notre promesse sous la pluie.");
                  }
                }}
                className="text-[11px] text-[#e5c158] hover:underline flex items-center gap-1"
              >
                <Mic className="h-3 w-3" />
                {isAudioSimulated ? 'Vocal transcrit ✓' : 'Simuler note vocale'}
              </button>
            </div>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Racontez l'histoire : comment ils se sont rencontrés, les surnoms doux, les souvenirs marquants..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#d4af37] focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/[0.05] transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b38f2a] px-5 py-2.5 text-xs font-bold text-[#0c0d12] shadow-lg shadow-[#d4af37]/20 hover:opacity-95 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Créer la Commande & Ouvrir au Studio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
