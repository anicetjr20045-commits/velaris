import { useState, type FC } from 'react';
import {
  ShieldCheck,
  Upload,
  Link2,
  Copy,
  Check,
  Send,
  Music2,
  Trash2,
  Eye
} from 'lucide-react';
import type { ProtectedShareData } from './ProtectedStreamView';

const STORAGE_KEY = 'velaris_protected_shares';

export function getSavedProtectedShares(): ProtectedShareData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProtectedShare(item: ProtectedShareData): void {
  try {
    const current = getSavedProtectedShares();
    const updated = [item, ...current.filter((x) => x.id !== item.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function removeProtectedShare(id: string): void {
  try {
    const current = getSavedProtectedShares();
    const updated = current.filter((x) => x.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

interface ProtectedAudioShareModalProps {
  defaultRecipient?: string;
  defaultOccasion?: string;
  defaultPhone?: string;
}

export const ProtectedAudioShareModal: FC<ProtectedAudioShareModalProps> = ({
  defaultRecipient = '',
  defaultOccasion = 'Anniversaire',
  defaultPhone = '',
}) => {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [occasion, setOccasion] = useState(defaultOccasion);
  const [creatorPhone, setCreatorPhone] = useState(defaultPhone || '22605777308');
  const [track1Title, setTrack1Title] = useState('Version 1 (Afro-Love)');
  const [track1Url, setTrack1Url] = useState('');
  const [track2Title, setTrack2Title] = useState('Version 2 (Acoustique)');
  const [track2Url, setTrack2Url] = useState('');

  const [shares, setShares] = useState<ProtectedShareData[]>(() => getSavedProtectedShares());
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, trackNum: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to Base64 Data URL or Blob URL for client streaming
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (trackNum === 1) setTrack1Url(result);
      else setTrack2Url(result);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !track1Url) return;

    const id = `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newShare: ProtectedShareData = {
      id,
      recipient: recipient.trim(),
      occasion: occasion.trim(),
      track1Title: track1Title.trim() || 'Version 1',
      track1Url,
      track2Title: track2Url ? (track2Title.trim() || 'Version 2') : undefined,
      track2Url: track2Url || undefined,
      creatorPhone: creatorPhone.trim(),
      createdAt: new Date().toISOString(),
      studioName: 'Studio Velaris',
    };

    saveProtectedShare(newShare);
    setShares(getSavedProtectedShares());

    const url = `${window.location.origin}${window.location.pathname}?listen=${id}`;
    setGeneratedLink(url);
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendWhatsApp = (share: ProtectedShareData, linkUrl: string) => {
    const cleanPhone = creatorPhone.replace(/\D/g, '');
    const msg = `Bonjour ${share.recipient} ! 🎶\n\nVoici votre lien d'écoute privée pour découvrir la chanson personnalisée en studio :\n👉 ${linkUrl}\n\nÉcoutez tranquillement les versions et dites-moi votre préférée ! ✨`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Générateur de Lien d'Écoute Protégé (Anti-Téléchargement)
          </h2>
          <p className="text-[13px] text-neutral-400 mt-1">
            Envoyez 1 ou 2 versions à votre client dans une page de streaming somptueuse sans lui donner le fichier MP3 avant son paiement final.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulaire de création */}
        <form onSubmit={handleGenerate} className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12.5px] font-medium text-neutral-300 mb-1.5">Prénom du destinataire</label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Ex : Aminata, Marc…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#E5B54F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-neutral-300 mb-1.5">Occasion célébrée</label>
              <input
                type="text"
                required
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Ex : Anniversaire, Mariage, Hommage…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#E5B54F] focus:outline-none"
              />
            </div>
          </div>

          {/* Version 1 */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-white flex items-center gap-1.5">
                <Music2 className="h-4 w-4 text-[#E5B54F]" />
                Chanson 1 (Obligatoire)
              </span>
              {track1Url && <span className="text-[11px] text-emerald-400 font-medium">✓ Audio prêt</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={track1Title}
                onChange={(e) => setTrack1Title(e.target.value)}
                placeholder="Titre Version 1"
                className="rounded-lg border border-white/[0.08] bg-[#07080B] px-3 py-2 text-xs text-white focus:outline-none"
              />
              <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                <Upload className="h-3.5 w-3.5" />
                <span>{track1Url ? 'Remplacer le fichier' : 'Uploader Chanson 1 (MP3/WAV)'}</span>
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 1)} />
              </label>
            </div>
          </div>

          {/* Version 2 */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-neutral-300 flex items-center gap-1.5">
                <Music2 className="h-4 w-4 text-neutral-400" />
                Chanson 2 (Optionnelle pour offrir le choix)
              </span>
              {track2Url && <span className="text-[11px] text-emerald-400 font-medium">✓ Audio prêt</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={track2Title}
                onChange={(e) => setTrack2Title(e.target.value)}
                placeholder="Titre Version 2"
                className="rounded-lg border border-white/[0.08] bg-[#07080B] px-3 py-2 text-xs text-white focus:outline-none"
              />
              <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors">
                <Upload className="h-3.5 w-3.5" />
                <span>{track2Url ? 'Remplacer Version 2' : 'Uploader Chanson 2 (Optionnel)'}</span>
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 2)} />
              </label>
            </div>
          </div>

          {/* Numéro WhatsApp de notification */}
          <div>
            <label className="block text-[12.5px] font-medium text-neutral-300 mb-1">Votre numéro WhatsApp pour recevoir le choix du client</label>
            <input
              type="text"
              value={creatorPhone}
              onChange={(e) => setCreatorPhone(e.target.value)}
              placeholder="Ex: 22605777308 ou 22507000000"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-sm font-mono text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!recipient.trim() || !track1Url}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#E5B54F] hover:bg-[#F3CA75] text-[#050608] font-bold py-3 text-sm transition-all shadow-[0_0_24px_rgba(229,181,79,0.3)] disabled:opacity-40 cursor-pointer"
          >
            <Link2 className="h-4 w-4" />
            <span>Générer le lien d'écoute sans téléchargement</span>
          </button>

          {/* Résultat du lien généré */}
          {generatedLink && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 space-y-3 vx-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Lien d'écoute protégé créé !
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">Anti-téléchargement actif</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="flex-1 rounded-lg border border-white/10 bg-[#07080B] px-3 py-1.5 font-mono text-xs text-neutral-200 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-neutral-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedLink ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#E5B54F] hover:underline"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Tester la vue client
                </a>
              </div>
            </div>
          )}
        </form>

        {/* Historique des liens créés */}
        <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Liens générés récemment</h3>
          {shares.length === 0 ? (
            <p className="text-[13px] text-neutral-500 italic py-6 text-center">
              Aucun lien pour l'instant. Vos liens générés apparaîtront ici.
            </p>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto">
              {shares.map((s) => {
                const link = `${window.location.origin}${window.location.pathname}?listen=${s.id}`;
                return (
                  <div key={s.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm text-white">{s.recipient}</div>
                        <div className="text-[11.5px] text-neutral-400">{s.occasion} · {s.track2Url ? '2 versions' : '1 version'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          removeProtectedShare(s.id);
                          setShares(getSavedProtectedShares());
                        }}
                        className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium border border-white/10 hover:bg-white/10 text-neutral-300"
                      >
                        <Eye className="h-3 w-3" />
                        Tester
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          alert('Lien copié dans le presse-papier !');
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium bg-white/[0.06] hover:bg-white/15 text-white"
                      >
                        <Copy className="h-3 w-3" />
                        Copier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(s, link)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 ml-auto"
                      >
                        <Send className="h-3 w-3" />
                        Partager
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
