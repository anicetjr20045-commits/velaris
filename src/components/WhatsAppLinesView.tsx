import { useState, type FC } from 'react';
import { 
  Smartphone, 
  RotateCw, 
  CheckCircle2, 
  QrCode, 
  Loader2 
} from 'lucide-react';
import type { WhatsAppLine } from '../types';
import { MOCK_WHATSAPP_LINES } from '../data/mockData';

export const WhatsAppLinesView: FC = () => {
  const [lines, setLines] = useState<WhatsAppLine[]>(MOCK_WHATSAPP_LINES);
  const [showToast, setShowToast] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const alexLine = lines.find(l => l.id === 'line-1') || lines[0];
  const aichaLine = lines.find(l => l.id === 'line-2') || lines[1];
  const aliceLine = lines.find(l => l.id === 'line-3') || lines[2];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleDisconnect = (id: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, status: 'disconnected', phone: undefined } : l));
  };

  const handleConnect = (id: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, status: 'qr_pending' } : l));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Toast de notification en haut à droite */}
      {showToast && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Session lancée. Scannez le QR code dès qu'il s'affiche.</span>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="text-emerald-400 hover:text-white cursor-pointer ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* 1. En-tête Lignes WhatsApp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Smartphone className="h-6 w-6 text-[#c5a059]" />
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#f3f4f6]">
              Lignes WhatsApp & Numéros
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xl">
            Chaque agent IA dispose de son propre numéro WhatsApp dédié. Réponses et commandes 100 % étanches.
          </p>
        </div>
      </div>

      {/* Barre de sous-titre */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400">
          Mes numéros WhatsApp (6 agents)
        </h2>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors cursor-pointer"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#c5a059]' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* 2. Liste des cartes d'agents WhatsApp */}
      <div className="space-y-4">
        {/* Agent 1 : Alex (Connecté) */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#e5c158] text-black font-bold flex items-center justify-center text-sm shadow-md relative">
                AL
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 flex items-center justify-center text-[9px] text-black">
                  ★
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-bold text-[#f3f4f6]">Alex</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 font-semibold bg-amber-500/10">
                    Ligne Principale
                  </span>
                </div>
                <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                  Alex, conseiller chaleureux et très réactif de Digital...
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium shrink-0">
              <span className={`h-2 w-2 rounded-full ${alexLine.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
              <span>{alexLine.status === 'connected' ? 'Connecté' : 'Déconnecté'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#0c0b09] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <div className="font-mono text-sm font-bold text-white tracking-wider">
                  {alexLine.phone || '+22656240533'}
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  Ligne WhatsApp active • Cet agent répond automatiquement à chaque message entrant.
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDisconnect('line-1')}
              className="px-4 py-2 rounded-xl bg-[#1c1a15] hover:bg-[#28251e] text-stone-300 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              Déconnecter
            </button>
          </div>
        </div>

        {/* Agent 2 : Aïcha (Scanner le QR) */}
        <div className="rounded-2xl border border-amber-500/30 bg-[#12110e] p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#d4a373] text-black font-bold flex items-center justify-center text-sm shadow-md">
                Aï
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-bold text-[#f3f4f6]">Aïcha</span>
                </div>
                <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                  Tu es Alexia ,Agent commercial pour une Entr...
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium shrink-0">
              <span className={`h-2 w-2 rounded-full ${aichaLine.status === 'qr_pending' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span>{aichaLine.status === 'qr_pending' ? 'Scanner le QR' : 'Connecté'}</span>
            </div>
          </div>

          {/* Cadre de Scan QR Code interactif */}
          <div className="rounded-xl border border-white/[0.06] bg-[#0c0b09] p-6 text-center space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                Scannez ce QR Code pour connecter Aïcha
              </h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto">
                Ouvrez WhatsApp sur le téléphone dédié → Paramètres → Appareils connectés → Connecter un appareil.
              </p>
            </div>

            {/* Rendu SVG soigné du QR Code */}
            <div className="inline-block p-4 rounded-2xl bg-white shadow-2xl">
              <svg className="h-44 w-44" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" fill="white" />
                {/* Repères angulaires de coin */}
                <rect x="10" y="10" width="25" height="25" fill="black" />
                <rect x="15" y="15" width="15" height="15" fill="white" />
                <rect x="18" y="18" width="9" height="9" fill="black" />

                <rect x="65" y="10" width="25" height="25" fill="black" />
                <rect x="70" y="15" width="15" height="15" fill="white" />
                <rect x="73" y="18" width="9" height="9" fill="black" />

                <rect x="10" y="65" width="25" height="25" fill="black" />
                <rect x="15" y="70" width="15" height="15" fill="white" />
                <rect x="18" y="73" width="9" height="9" fill="black" />

                {/* Motifs de données */}
                <rect x="40" y="10" width="5" height="15" fill="black" />
                <rect x="50" y="15" width="10" height="5" fill="black" />
                <rect x="42" y="30" width="16" height="5" fill="black" />
                <rect x="10" y="42" width="15" height="5" fill="black" />
                <rect x="30" y="45" width="10" height="10" fill="black" />
                <rect x="45" y="45" width="10" height="10" fill="black" />
                <rect x="60" y="40" width="5" height="15" fill="black" />
                <rect x="75" y="42" width="15" height="5" fill="black" />
                <rect x="40" y="65" width="15" height="5" fill="black" />
                <rect x="40" y="75" width="5" height="15" fill="black" />
                <rect x="55" y="70" width="10" height="10" fill="black" />
                <rect x="70" y="65" width="10" height="5" fill="black" />
                <rect x="85" y="75" width="5" height="15" fill="black" />
                <rect x="70" y="80" width="10" height="10" fill="black" />
              </svg>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c5a059]" />
                <span>En attente du scan sur WhatsApp...</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181612] hover:bg-[#201d18] text-xs text-stone-300 border border-white/[0.08] cursor-pointer"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>Nouveau QR</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Agent 3 : Alice (Déconnecté) */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6 shadow-xl space-y-4 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-stone-700 text-stone-300 font-bold flex items-center justify-center text-sm shadow-md">
                AL
              </div>
              <div>
                <div className="font-serif text-lg font-bold text-[#f3f4f6]">Alice</div>
                <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                  Agent chaleureux • FR
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-stone-400 font-medium shrink-0">
              <span className={`h-2 w-2 rounded-full ${aliceLine.status === 'connected' ? 'bg-emerald-400' : 'bg-stone-500'}`} />
              <span>{aliceLine.status === 'connected' ? 'Connecté' : 'Déconnecté'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#0c0b09] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-stone-400">
              <div className="font-semibold text-stone-300">Aucun numéro WhatsApp n'est relié à cet agent.</div>
              <div className="mt-0.5">Connectez un numéro dédié pour lancer ce canal commercial.</div>
            </div>

            <button
              onClick={() => handleConnect('line-3')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#d4af37] text-black text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Connecter WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
