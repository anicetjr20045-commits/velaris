import { useState, useEffect, type FC } from 'react';
import {
  ShieldCheck,
  Upload,
  Link2,
  Copy,
  Check,
  Send,
  Music2,
  Eye,
  Loader2,
  Download,
  Lock,
  ExternalLink
} from 'lucide-react';
import {
  uploadAudioTrack,
  createSharedTrack,
  getRecentSharedTracks,
  type SharedTrackRecord
} from '../services/shared-tracks';

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
  const [track1FileName, setTrack1FileName] = useState('');
  const [track2Title, setTrack2Title] = useState('Version 2 (Acoustique)');
  const [track2Url, setTrack2Url] = useState('');
  const [track2FileName, setTrack2FileName] = useState('');
  const [allowDownload, setAllowDownload] = useState(false);

  const [isUploadingTrack1, setIsUploadingTrack1] = useState(false);
  const [isUploadingTrack2, setIsUploadingTrack2] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [shares, setShares] = useState<SharedTrackRecord[]>([]);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Charger les partages récents depuis Supabase
  const loadRecentShares = async () => {
    const list = await getRecentSharedTracks(15);
    setShares(list);
  };

  useEffect(() => {
    void loadRecentShares();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, trackNum: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    if (trackNum === 1) {
      setIsUploadingTrack1(true);
      setTrack1FileName(file.name);
      const res = await uploadAudioTrack(file, 'v1');
      setIsUploadingTrack1(false);
      if (res.url) {
        setTrack1Url(res.url);
      } else {
        setErrorMessage(res.error || 'Erreur lors du téléversement du fichier audio 1');
      }
    } else {
      setIsUploadingTrack2(true);
      setTrack2FileName(file.name);
      const res = await uploadAudioTrack(file, 'v2');
      setIsUploadingTrack2(false);
      if (res.url) {
        setTrack2Url(res.url);
      } else {
        setErrorMessage(res.error || 'Erreur lors du téléversement du fichier audio 2');
      }
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) {
      setErrorMessage('Veuillez renseigner le prénom du destinataire.');
      return;
    }
    if (!track1Url) {
      setErrorMessage('Veuillez uploader au moins le fichier audio de la version 1.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    const id = `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newRecord: Omit<SharedTrackRecord, 'created_at' | 'plays_count'> = {
      id,
      recipient: recipient.trim(),
      occasion: occasion.trim(),
      track1_title: track1Title.trim() || 'Version 1',
      track1_url: track1Url,
      track2_title: track2Url ? (track2Title.trim() || 'Version 2') : undefined,
      track2_url: track2Url || undefined,
      allow_download: allowDownload,
      creator_phone: creatorPhone.trim(),
      studio_name: 'Studio Velaris',
    };

    const res = await createSharedTrack(newRecord);
    setIsGenerating(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Impossible d\'enregistrer le lien sur le serveur');
      return;
    }

    await loadRecentShares();

    const url = `${window.location.origin}${window.location.pathname}?listen=${id}`;
    setGeneratedLink(url);
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendWhatsApp = (share: SharedTrackRecord, linkUrl: string) => {
    const cleanPhone = (share.creator_phone || creatorPhone).replace(/\D/g, '');
    const msg = `Bonjour ${share.recipient} !\n\nVoici votre lien d'écoute privée pour découvrir la chanson personnalisée en studio :\n👉 ${linkUrl}\n\nÉcoutez tranquillement les versions et validez votre préférée directement depuis le lecteur !`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#E5B54F]" />
            Générateur de Lien d'Écoute Protégé (Streaming Cloud Sécurisé)
          </h2>
          <p className="text-[13px] text-neutral-400 mt-1">
            Générez un lien d'écoute haute fidélité pour votre client sur smartphone. L'écoute est protégée sans téléchargement par défaut, avec option de téléchargement activable à votre convenance.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

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

          <div className="space-y-4 pt-1 border-t border-white/[0.06]">
            {/* Version 1 */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white flex items-center gap-1.5">
                  <Music2 className="h-4 w-4 text-[#E5B54F]" />
                  Chanson — Version 1 (Obligatoire)
                </span>
                {track1Url && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> Fichier prêt sur le Cloud
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={track1Title}
                  onChange={(e) => setTrack1Title(e.target.value)}
                  placeholder="Titre de la version (ex: Afro-Love)"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-[#E5B54F] focus:outline-none"
                />
                <label className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer">
                  {isUploadingTrack1 ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E5B54F]" />
                      <span>Téléversement en cours…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      <span className="truncate">{track1FileName || 'Uploader fichier MP3/WAV'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={isUploadingTrack1}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 1)}
                  />
                </label>
              </div>
            </div>

            {/* Version 2 */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white flex items-center gap-1.5">
                  <Music2 className="h-4 w-4 text-neutral-400" />
                  Chanson — Version 2 (Optionnelle pour choix)
                </span>
                {track2Url && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> Fichier prêt sur le Cloud
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={track2Title}
                  onChange={(e) => setTrack2Title(e.target.value)}
                  placeholder="Titre de la version (ex: Acoustique Doux)"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-[#E5B54F] focus:outline-none"
                />
                <label className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer">
                  {isUploadingTrack2 ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E5B54F]" />
                      <span>Téléversement en cours…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      <span className="truncate">{track2FileName || 'Uploader fichier MP3/WAV (opt.)'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={isUploadingTrack2}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 2)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Numéro WhatsApp du créateur */}
          <div>
            <label className="block text-[12.5px] font-medium text-neutral-300 mb-1.5">
              Numéro WhatsApp de réception des validations
            </label>
            <input
              type="text"
              value={creatorPhone}
              onChange={(e) => setCreatorPhone(e.target.value)}
              placeholder="Ex : 22605777308"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#E5B54F] focus:outline-none"
            />
          </div>

          {/* Option : Autoriser le téléchargement */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-start gap-3">
            <input
              id="allow-download"
              type="checkbox"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-[#E5B54F] accent-[#E5B54F] cursor-pointer"
            />
            <label htmlFor="allow-download" className="text-xs leading-relaxed text-neutral-300 cursor-pointer">
              <strong className="block text-white font-medium text-[13px] mb-0.5">
                Autoriser le téléchargement du fichier MP3 par le client
              </strong>
              Laissez décoché si le client n'a pas encore réglé la totalité de sa commande (protection anti-téléchargement). Cochez cette case pour lui permettre de télécharger directement son master MP3.
            </label>
          </div>

          <button
            type="submit"
            disabled={!track1Url || isUploadingTrack1 || isUploadingTrack2 || isGenerating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Génération du lien sécurisé…</span>
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                <span>Générer le lien de streaming sécurisé</span>
              </>
            )}
          </button>
        </form>

        {/* Panneau de résultat & Partages récents */}
        <div className="lg:col-span-5 space-y-6">
          {/* Lien tout juste généré */}
          {generatedLink && (
            <div className="rounded-2xl border border-[#E5B54F]/40 bg-[#E5B54F]/[0.04] p-5 space-y-3 vx-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#E5B54F] uppercase tracking-wider font-semibold">
                  Lien public prêt pour {recipient}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                  {allowDownload ? <Download className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {allowDownload ? 'Téléchargement actif' : 'Protégé'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-neutral-300"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.open(generatedLink, '_blank')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Tester le lecteur</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = creatorPhone.replace(/\D/g, '');
                    const msg = `Bonjour ${recipient} !\n\nVoici votre lien d'écoute privée pour découvrir la chanson personnalisée en studio :\n👉 ${generatedLink}\n\nÉcoutez tranquillement les versions et validez votre préférée directement depuis le lecteur !`;
                    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Envoyer WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {/* Historique des liens d'écoute */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0B0C10] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Liens récents créés</h3>
              <span className="text-[11px] font-mono text-neutral-500">{shares.length} actif(s)</span>
            </div>

            {shares.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">
                Aucun lien de streaming créé pour le moment.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {shares.map((s) => {
                  const linkUrl = `${window.location.origin}${window.location.pathname}?listen=${s.id}`;
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-center justify-between gap-3 hover:border-white/15 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[13px] font-medium text-white truncate">{s.recipient}</h4>
                          <span className="text-[11px] text-neutral-500 font-mono">· {s.occasion}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-400">
                          <span className="flex items-center gap-1">
                            {s.allow_download ? (
                              <Download className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Lock className="h-3 w-3 text-[#E5B54F]" />
                            )}
                            {s.allow_download ? 'Téléchargeable' : 'Protégé'}
                          </span>
                          {typeof s.plays_count === 'number' && (
                            <span className="text-neutral-500 font-mono">{s.plays_count} écoute(s)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => window.open(linkUrl, '_blank')}
                          title="Tester le lien"
                          className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(s, linkUrl)}
                          title="Envoyer sur WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
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
    </div>
  );
};
