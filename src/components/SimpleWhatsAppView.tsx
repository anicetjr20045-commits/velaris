import { useState, useRef, useEffect, type FC, type ChangeEvent, type FormEvent } from 'react';
import {
  RotateCw,
  Check,
  Plus,
  Trash2,
  Pencil,
  Zap,
  Upload,
  X,
  Mic,
  Music2,
  Type,
  Video,
  FileText,
  AlertCircle,
  Smartphone,
  QrCode,
  KeyRound,
  Copy,
  LogOut,
  BadgeCheck,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useWahaSession } from '../hooks/useWaha';
import { wahaSessionNameFor } from '../services/waha';
import { useAuth } from '../hooks/useAuth';
import { useStudioLive } from '../hooks/useStudioLive';
import type { AutomationMediaKind, AutomationRule } from '../types';
import {
  AUTOMATION_MEDIA_MAX_BYTES,
  deleteAutomationRule,
  getAutomationMediaUrl,
  getLiveAutomationRules,
  removeAutomationMedia,
  saveAutomationRule,
  setAutomationRuleEnabled,
  uploadAutomationMedia,
} from '../services/supabase';
import { REACTION_TRIGGERS, findReactionTrigger, sameReaction } from '../data/reactionTriggers';
import { WaveformPlayer } from './WaveformPlayer';
import { VoiceNoteRecorder, type VoiceRecording } from './VoiceNoteRecorder';

const EMPTY_RULES: AutomationRule[] = [];

// Métadonnées par type de média d'automatisation
interface KindMetadata {
  id: AutomationMediaKind;
  label: string;
  badge: string;
  icon: LucideIcon;
  accept?: string;
  hint: string;
}

const MEDIA_KINDS: KindMetadata[] = [
  {
    id: 'voice',
    label: 'Note vocale',
    badge: 'Note vocale WhatsApp (PTT)',
    icon: Mic,
    accept: 'audio/ogg,audio/opus,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,.ogg,.opus,.mp3,.m4a',
    hint: 'Envoyé comme un vrai vocal WhatsApp enregistré au micro (forme d’onde verte).',
  },
  {
    id: 'music',
    label: 'Musique / Chanson',
    badge: 'Fichier musical',
    icon: Music2,
    accept: 'audio/mpeg,audio/mp4,audio/wav,audio/ogg,.mp3,.wav,.m4a,.ogg',
    hint: 'Morceau MP3 complet ou extrait de chanson studio avec titre et lecteur.',
  },
  {
    id: 'text',
    label: 'Texte',
    badge: 'Message texte',
    icon: Type,
    hint: 'Message rédigé avec vos arguments, tarifs ou remerciements.',
  },
  {
    id: 'video',
    label: 'Vidéo',
    badge: 'Vidéo MP4',
    icon: Video,
    accept: 'video/mp4,video/quicktime,.mp4,.mov',
    hint: 'Démonstration vidéo, extrait de clip ou tutoriel de commande.',
  },
  {
    id: 'document',
    label: 'Document',
    badge: 'Fichier / PDF',
    icon: FileText,
    accept: 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg',
    hint: 'Grille tarifaire PDF, brochure ou capture d’écran.',
  },
  {
    id: 'payment',
    label: 'Encaisser Vente',
    badge: 'Enregistrement Vente CRM',
    icon: BadgeCheck,
    hint: 'Enregistre instantanément la commande, le montant, le client, son pays et met à jour vos statistiques.',
  },
];

const KIND_META = Object.fromEntries(MEDIA_KINDS.map((k) => [k.id, k])) as Record<
  AutomationMediaKind,
  KindMetadata
>;

// Automatisations officielles pré-intégrées au studio
const DEFAULT_STUDIO_PRESETS: AutomationRule[] = [
  {
    id: 'preset-welcome',
    name: 'Accueil & Brief Client',
    emoji: '😊',
    action: `Bonjour et bienvenue dans notre studio de chansons personnalisées. Nous composons des chansons sur-mesure pour chaque événement (déclaration, anniversaire, mariage). Pour qui souhaitez-vous créer cette chanson ?`,
    active: true,
    kind: 'text',
  },
  {
    id: 'preset-offers',
    name: 'Présentation des Formules (1 200 F / 3 000 F)',
    emoji: '✨',
    action: `Nous proposons deux formules pour votre projet :

- Formule 1 (Chanson personnalisée complète) : 1 200 F
- Formule 2 (Chanson + montage vidéo avec vos photos) : 3 000 F

Laquelle vous convient le mieux ?`,
    active: true,
    kind: 'text',
  },
  {
    id: 'preset-voice-procedure',
    name: 'Vocal de procédure (Voix féminine)',
    emoji: '🎵',
    action: 'https://waha.velarisagent.life/qr/assets/vocal_procedure_soeur.opus',
    active: true,
    kind: 'voice',
    mediaUrl: 'https://waha.velarisagent.life/qr/assets/vocal_procedure_soeur.opus',
    mediaName: 'vocal_procedure_soeur.opus',
  },
  {
    id: 'preset-video-demo',
    name: 'Vidéo Démo & Tutoriel',
    emoji: '🎥',
    action: 'Vidéo tutoriel de commande en 15 secondes.',
    active: true,
    kind: 'video',
    mediaUrl: 'https://waha.velarisagent.life/qr/assets/324048.mp4',
    mediaName: 'video-demo.mp4',
  },
  {
    id: 'preset-payment-wave',
    name: 'Coordonnées Paiement Wave',
    emoji: '💢',
    action: `Vous pouvez régler votre commande par Wave au numéro officiel du studio : +225 0759600590 (Digital Starter). Merci de nous envoyer la capture dès que c'est fait.`,
    active: true,
    kind: 'text',
  },
  {
    id: 'preset-payment-om',
    name: 'Coordonnées Orange Money',
    emoji: '🙏',
    action: `Vous pouvez régler votre commande par Orange Money au numéro : +226 56240533 (Wendyam Anicet junior Sekongo). Merci de nous envoyer la capture du reçu.`,
    active: true,
    kind: 'text',
  },
  {
    id: 'preset-payment-standard',
    name: 'Encaissement Vente · Formule 1 200 F',
    emoji: '💰',
    action: 'Paiement de 1 200 F CFA bien reçu ! Votre chanson entre en production.',
    active: true,
    kind: 'payment',
    offerName: 'Formule Standard 1 200 F',
    amount: 1200,
    currency: 'F CFA',
    confirmationMessage: 'Paiement de 1 200 F CFA bien reçu ! Votre chanson entre immédiatement en création dans notre studio.',
  },
  {
    id: 'preset-payment-video',
    name: 'Encaissement Vente · Formule Vidéo 3 000 F',
    emoji: '💳',
    action: 'Paiement de 3 000 F CFA bien reçu ! Votre chanson & montage vidéo entrent en production.',
    active: true,
    kind: 'payment',
    offerName: 'Formule Chanson + Vidéo 3 000 F',
    amount: 3000,
    currency: 'F CFA',
    confirmationMessage: 'Paiement de 3 000 F CFA bien reçu ! Votre chanson et votre montage vidéo entrent en création dans notre studio.',
  },
];

interface DraftMedia {
  blob?: Blob;
  url?: string;
  path?: string;
  name: string;
  size?: number;
  durationSec?: number;
  peaks?: number[];
}

interface DraftRule {
  id?: string;
  name: string;
  emoji: string;
  kind: AutomationMediaKind;
  action: string;
  media?: DraftMedia;
  offerName?: string;
  amount?: number;
  currency?: string;
  confirmationMessage?: string;
}

export const SimpleWhatsAppView: FC = () => {
  const { user } = useAuth();
  const sessionName = wahaSessionNameFor(user?.id);
  const waha = useWahaSession(sessionName, { enabled: true, syncToStudio: true });

  const [activeTab, setActiveTab] = useState<'qr' | 'automations'>('qr');
  const [showQrWhenConnected, setShowQrWhenConnected] = useState(false);
  const [isActivationRequested, setIsActivationRequested] = useState(false);
  const [pairMode, setPairMode] = useState<'qr' | 'code'>('qr');
  const [pairingPhone, setPairingPhone] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Synchronisation des règles Supabase
  const { data: dbRules, setData: setDbRules } = useStudioLive<AutomationRule[]>(
    getLiveAutomationRules,
    EMPTY_RULES,
    ['automation_rules'],
    [user?.id],
    { enabled: !!user }
  );

  // État local des règles prédéfinies
  const [presetRules, setPresetRules] = useState<AutomationRule[]>(() => {
    try {
      const saved = localStorage.getItem('velaris_preset_rules_active');
      if (saved) {
        const stateMap = JSON.parse(saved) as Record<string, boolean>;
        return DEFAULT_STUDIO_PRESETS.map((p) => ({
          ...p,
          active: stateMap[p.id] !== undefined ? stateMap[p.id] : p.active,
        }));
      }
    } catch {
      // Ignorer
    }
    return DEFAULT_STUDIO_PRESETS;
  });

  // Liste unifiée des règles :
  // - Pour chaque membre (`studio_*`) : isolation stricte sur ses propres règles en base (aucune donnée admin hardcodée)
  // - Pour la session studio principale `Test` : règles personnalisées + presets officiels
  const isMemberSession = !!user && sessionName.startsWith('studio_');
  const allRules: AutomationRule[] = isMemberSession
    ? dbRules
    : [
        ...dbRules,
        ...presetRules.filter((p) => !dbRules.some((r) => sameReaction(r.emoji, p.emoji))),
      ];

  // Filtre d'affichage
  const [filterKind, setFilterKind] = useState<string>('all');
  const filteredRules = allRules.filter((r) => {
    if (filterKind === 'all') return true;
    if (filterKind === 'voice') return r.kind === 'voice';
    if (filterKind === 'music') return r.kind === 'music';
    if (filterKind === 'text') return r.kind === 'text';
    if (filterKind === 'video_doc') return r.kind === 'video' || r.kind === 'document';
    return true;
  });

  // Modal de création / édition
  const [draft, setDraft] = useState<DraftRule | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // URLs signées pour les médias Supabase
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const localUrls = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = localUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Résolution des URLs signées pour les médias en base
  const mediaPaths = dbRules.map((r) => r.mediaPath).filter((p): p is string => !!p);
  const missingKeys = mediaPaths.filter((p) => !signedUrls[p]).join('|');

  useEffect(() => {
    if (!user || !missingKeys) return;
    let cancelled = false;
    Promise.all(
      missingKeys.split('|').map(async (p) => [p, await getAutomationMediaUrl(p)] as const)
    ).then((entries) => {
      if (cancelled) return;
      const found = entries.filter((e): e is readonly [string, string] => !!e[1]);
      if (found.length) {
        setSignedUrls((prev) => ({ ...prev, ...Object.fromEntries(found) }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, missingKeys]);

  const resolveMediaUrl = (rule: AutomationRule) =>
    rule.mediaUrl || (rule.mediaPath ? signedUrls[rule.mediaPath] : undefined) || rule.action;

  const showToast = (text: string, ok = true) => {
    setToastMessage({ text, ok });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Basculement d'activation d'une règle
  const handleToggleRule = async (rule: AutomationRule) => {
    const next = !rule.active;
    const isPreset = rule.id.startsWith('preset-');

    if (isPreset) {
      setPresetRules((prev) => {
        const nextList = prev.map((p) => (p.id === rule.id ? { ...p, active: next } : p));
        try {
          const map = Object.fromEntries(nextList.map((p) => [p.id, p.active]));
          localStorage.setItem('velaris_preset_rules_active', JSON.stringify(map));
        } catch {}
        return nextList;
      });
      showToast(next ? `Règle « ${rule.name} » activée` : `Règle « ${rule.name} » mise en pause`);
      return;
    }

    // Règle en base
    setDbRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: next } : r)));
    const ok = await setAutomationRuleEnabled(rule.id, next);
    if (!ok) {
      setDbRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: rule.active } : r)));
      showToast("Erreur lors de la mise à jour de la règle en base.", false);
    } else {
      showToast(next ? `Règle « ${rule.name} » activée` : `Règle « ${rule.name} » mise en pause`);
    }
  };

  // Suppression d'une règle
  const handleDeleteRule = async (rule: AutomationRule) => {
    if (rule.id.startsWith('preset-')) {
      // Pour un preset, on le désactive simplement
      handleToggleRule({ ...rule, active: true });
      return;
    }

    const previous = dbRules;
    setDbRules((prev) => prev.filter((r) => r.id !== rule.id));
    const ok = await deleteAutomationRule(rule.id);
    if (ok) {
      if (rule.mediaPath) removeAutomationMedia(rule.mediaPath);
      showToast(`Règle « ${rule.name} » supprimée.`);
    } else {
      setDbRules(previous);
      showToast("Impossible de supprimer la règle.", false);
    }
  };

  // Test à blanc de la règle
  const handleTestRule = (rule: AutomationRule) => {
    const t = findReactionTrigger(rule.emoji);
    if (rule.kind === 'payment') {
      showToast(
        `Test réussi : Réaction ${rule.emoji} (${t?.label || 'Emoji'}) → Encaissement de ${(rule.amount || 3000).toLocaleString('fr-FR')} F CFA prêt.`,
        true
      );
      return;
    }
    showToast(
      `Test réussi : Réaction ${rule.emoji} (${t?.label || 'Emoji'}) → ${KIND_META[rule.kind ?? 'text'].label} prêt.`,
      true
    );
  };

  // Ouverture du formulaire de création / édition
  const handleOpenCreate = () => {
    setDraftError(null);
    setIsRecording(false);
    setDraft({
      name: '',
      emoji: '💰',
      kind: 'payment',
      action: '',
      offerName: '',
      amount: 3000,
      currency: 'F CFA',
      confirmationMessage: '',
    });
  };

  const handleOpenEdit = (rule: AutomationRule) => {
    setDraftError(null);
    setIsRecording(false);
    setDraft({
      id: rule.id.startsWith('preset-') ? undefined : rule.id,
      name: rule.name,
      emoji: rule.emoji,
      kind: rule.kind ?? 'text',
      action: rule.action,
      offerName: rule.offerName || rule.name,
      amount: rule.amount || 3000,
      currency: rule.currency || 'F CFA',
      confirmationMessage: rule.confirmationMessage || (rule.kind === 'payment' ? rule.action : ''),
      media:
        rule.kind !== 'text' && rule.kind !== 'payment' && (rule.mediaPath || rule.mediaUrl)
          ? {
              path: rule.mediaPath,
              url: resolveMediaUrl(rule),
              name: rule.mediaName || 'Média existant',
            }
          : undefined,
    });
  };

  // Sélection d'un fichier média
  const handlePickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft) return;

    if (file.size > AUTOMATION_MEDIA_MAX_BYTES) {
      setDraftError('Fichier trop lourd (16 Mo maximum pour WhatsApp).');
      return;
    }

    setDraftError(null);
    const objectUrl = URL.createObjectURL(file);
    localUrls.current.add(objectUrl);

    setDraft({
      ...draft,
      media: {
        blob: file,
        url: objectUrl,
        name: file.name,
        size: file.size,
      },
    });
  };

  // Réception d'un enregistrement au micro
  const handleRecordedVoice = (rec: VoiceRecording) => {
    localUrls.current.add(rec.url);
    const ext = rec.mimeType.includes('ogg')
      ? 'ogg'
      : rec.mimeType.includes('mp4')
      ? 'm4a'
      : 'webm';

    setDraft((prev) =>
      prev
        ? {
            ...prev,
            media: {
              blob: rec.blob,
              url: rec.url,
              name: `vocal_studio_${Date.now()}.${ext}`,
              size: rec.blob.size,
              durationSec: rec.durationSec,
              peaks: rec.peaks,
            },
          }
        : null
    );
    setIsRecording(false);
  };

  // Sauvegarde d'une règle (création ou mise à jour)
  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    if (!draft.name.trim()) {
      setDraftError("Veuillez donner un nom à l'automatisation.");
      return;
    }

    if (draft.kind === 'payment') {
      if (!draft.amount || draft.amount <= 0) {
        setDraftError("Veuillez indiquer un montant valide pour l'encaissement.");
        return;
      }
    } else if (draft.kind === 'text') {
      if (!draft.action.trim()) {
        setDraftError("Veuillez saisir le texte du message à envoyer.");
        return;
      }
    } else {
      if (!draft.media && !draft.action.trim()) {
        setDraftError("Veuillez ajouter un fichier média ou une note vocale.");
        return;
      }
    }

    // Vérification collision d'emoji
    const clash = allRules.find(
      (r) => r.id !== draft.id && r.active && sameReaction(r.emoji, draft.emoji)
    );
    if (clash) {
      setDraftError(
        `La règle « ${clash.name} » utilise déjà la réaction ${draft.emoji}. Choisissez un autre emoji.`
      );
      return;
    }

    setIsSavingDraft(true);
    setDraftError(null);

    try {
      let finalMediaPath = draft.media?.path;
      let finalMediaUrl = draft.media?.url;

      // Téléversement si nouveau fichier local
      if (draft.media?.blob && user) {
        const uploadRes = await uploadAutomationMedia(draft.media.blob, draft.media.name);
        if ('error' in uploadRes) {
          setIsSavingDraft(false);
          setDraftError(`Erreur lors du téléversement : ${uploadRes.error}`);
          return;
        }
        finalMediaPath = uploadRes.path;
      }

      const ruleData: AutomationRule = {
        id: draft.id ?? `auto-${Date.now()}`,
        name: draft.name.trim(),
        emoji: draft.emoji.trim(),
        action: draft.kind === 'payment' ? (draft.confirmationMessage || draft.action || '').trim() : draft.action.trim(),
        active: true,
        kind: draft.kind,
        mediaPath: finalMediaPath,
        mediaUrl: finalMediaUrl,
        mediaName: draft.media?.name,
        offerName: draft.offerName?.trim() || draft.name.trim(),
        amount: draft.amount || 3000,
        currency: draft.currency || 'F CFA',
        confirmationMessage: draft.confirmationMessage?.trim() || '',
      };

      if (user) {
        const savedId = await saveAutomationRule({
          id: draft.id,
          name: ruleData.name,
          emoji: ruleData.emoji,
          action: ruleData.action,
          active: true,
          kind: ruleData.kind,
          mediaPath: finalMediaPath,
          offerName: ruleData.offerName,
          amount: ruleData.amount,
          currency: ruleData.currency,
          confirmationMessage: ruleData.confirmationMessage,
        });

        if (!savedId) {
          setIsSavingDraft(false);
          setDraftError("Impossible d'enregistrer la règle en base.");
          return;
        }
        ruleData.id = savedId;
      }

      setDbRules((prev) => {
        const exists = prev.some((r) => r.id === ruleData.id);
        return exists ? prev.map((r) => (r.id === ruleData.id ? ruleData : r)) : [ruleData, ...prev];
      });

      setDraft(null);
      setIsRecording(false);
      setIsSavingDraft(false);
      showToast(`Automatisation « ${ruleData.name} » enregistrée !`);
    } catch (err: any) {
      setIsSavingDraft(false);
      setDraftError(`Erreur : ${err?.message || err}`);
    }
  };

  const connectedPhone = waha.session?.me?.id
    ? '+' + waha.session.me.id.split('@')[0].split(':')[0]
    : null;

  const shouldShowQr = waha.isOnline ? showQrWhenConnected : isActivationRequested;

  const handleActivateConnection = async () => {
    setIsActivationRequested(true);
    await waha.restart();
  };

  const handleRequestPairingCode = async (e: FormEvent) => {
    e.preventDefault();
    setPairingError(null);
    setPairingCode(null);
    const digits = pairingPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      setPairingError('Indiquez votre numéro complet avec l’indicatif (ex : +225 07... ou +226 70...).');
      return;
    }
    setIsRequestingCode(true);
    const res = await waha.requestPairingCode(digits);
    setIsRequestingCode(false);
    if (res.ok && res.code) {
      setPairingCode(res.code);
      showToast('Code d’association généré. Saisissez-le dans WhatsApp.');
    } else {
      setPairingError(res.error || 'Impossible d’obtenir le code pour ce numéro.');
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard?.writeText(pairingCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Toast de confirmation */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#0D0F14] border border-white/[0.12] text-sm text-white shadow-2xl animate-in fade-in slide-in-from-top-2">
          {toastMessage.ok ? (
            <Check className="w-4 h-4 text-[#10D98E]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* En-tête & Sélecteur de sous-onglets WhatsApp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">WhatsApp & Studio</h1>
          <p className="text-sm text-[#8A90A0]">
            Gérez votre ligne WhatsApp connectée et vos automatisations par réactions emojis.
          </p>
        </div>

        {/* Sélecteur de sous-onglets épuré */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0D0F14] border border-white/[0.06] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#8A90A0] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Code QR & Connexion</span>
            {waha.isOnline && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#10D98E]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('automations')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'automations'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#8A90A0] hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Réponses Automatiques</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">
              {allRules.length}
            </span>
          </button>
        </div>
      </div>

      {/* SOUS-ONGLET 1 : CODE QR & CONNEXION WHATSAPP */}
      {activeTab === 'qr' && (
        <div className="space-y-6">
          {/* Statut de connexion */}
          <section className="rounded-3xl bg-[#0D0F14] p-5 flex items-center justify-between gap-4 border border-white/[0.06]">
            <div className="flex items-center gap-3.5 min-w-0">
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  waha.isOnline ? 'bg-[#10D98E] shadow-[0_0_12px_#10D98E]' : 'bg-[#E2BD6B]'
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {waha.isOnline
                    ? connectedPhone || 'Ligne WhatsApp Connectée'
                    : isActivationRequested
                    ? 'Génération de la connexion WhatsApp…'
                    : 'Ligne WhatsApp Non Connectée'}
                </p>
                <p className="text-xs text-[#8A90A0] mt-0.5 truncate">
                  {waha.isOnline
                    ? 'Passerelle active 24h/24 · Écoute des réactions emojis opérationnelle'
                    : isActivationRequested
                    ? 'Scannez le QR Code ou saisissez votre code à 8 chiffres pour lier votre compte'
                    : 'Cliquez sur Activer pour afficher votre QR code ou code d’association'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!waha.isOnline && !isActivationRequested && (
                <button
                  type="button"
                  onClick={handleActivateConnection}
                  className="px-4 py-2 rounded-full bg-white hover:bg-white/90 text-black text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Zap className="w-3.5 h-3.5 text-black fill-black" />
                  <span>Activer</span>
                </button>
              )}
              {waha.isOnline && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowQrWhenConnected((prev) => !prev)}
                    className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    {showQrWhenConnected ? 'Masquer' : 'Gérer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => waha.logout()}
                    title="Déconnecter et changer de numéro"
                    className="px-3.5 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Changer de numéro</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => waha.restart()}
                aria-label="Rafraîchir la connexion WhatsApp"
                title="Rafraîchir la connexion"
                className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-[#8A90A0] hover:text-white transition-colors cursor-pointer"
              >
                <RotateCw className={`w-4 h-4 ${waha.isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </section>

          {/* Écran d'accueil avant activation volontaire */}
          {!waha.isOnline && !isActivationRequested && (
            <section className="rounded-3xl bg-[#0D0F14] p-8 sm:p-10 flex flex-col items-center text-center space-y-5 border border-white/[0.06]">
              <div className="w-14 h-14 rounded-2xl bg-[#E2BD6B]/10 border border-[#E2BD6B]/20 flex items-center justify-center text-[#E2BD6B]">
                <Smartphone className="w-7 h-7" />
              </div>

              <div className="space-y-1.5 max-w-md">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Connecter votre WhatsApp au Studio
                </h2>
                <p className="text-xs text-[#8A90A0] leading-relaxed">
                  Liez votre numéro pour activer instantanément les automatisations par réactions emojis,
                  l'encaissement automatique des ventes et la réception des commandes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleActivateConnection}
                className="px-6 py-3 rounded-2xl bg-white hover:bg-white/90 text-black text-xs font-bold transition-all shadow-xl inline-flex items-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-black fill-black" />
                <span>Activer la connexion WhatsApp</span>
              </button>

              <div className="flex items-center gap-4 text-[11px] text-[#707685] pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10D98E]" />
                  <span>Scan QR Code instantané</span>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10D98E]" />
                  <span>Code à 8 chiffres (1 seul téléphone)</span>
                </span>
              </div>
            </section>
          )}

          {/* Module d'appairage WhatsApp (QR Code ou Code à 8 chiffres) */}
          {shouldShowQr && (
            <section className="rounded-3xl bg-[#0D0F14] p-6 sm:p-8 flex flex-col items-center text-center space-y-6 border border-white/[0.06]">
              {/* Sélecteur de méthode d'appairage */}
              <div className="inline-flex p-1 rounded-2xl bg-[#08090C] border border-white/[0.06] gap-1">
                <button
                  type="button"
                  onClick={() => setPairMode('qr')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    pairMode === 'qr' ? 'bg-white text-black shadow-sm' : 'text-[#8A90A0] hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scanner le QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPairMode('code')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    pairMode === 'code' ? 'bg-white text-black shadow-sm' : 'text-[#8A90A0] hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Code à 8 chiffres (1 seul téléphone)</span>
                </button>
              </div>

              {pairMode === 'qr' ? (
                <>
                  <div className="p-4 rounded-3xl bg-white flex items-center justify-center min-h-[220px] min-w-[220px] shadow-2xl">
                    {waha.qrUrl ? (
                      <img
                        src={waha.qrUrl}
                        alt="QR Code WhatsApp"
                        className="w-52 h-52 object-contain"
                      />
                    ) : (
                      <div className="text-center text-black/60 text-xs space-y-2 py-10 px-4 max-w-[200px]">
                        <RotateCw className="w-5 h-5 animate-spin mx-auto text-black/40" />
                        <p>Préparation du QR Code sécurisé…</p>
                        {waha.error && (
                          <p className="text-[11px] text-rose-600 font-medium">{waha.error}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 max-w-sm text-center">
                    <p className="text-base font-semibold text-white">Scanner avec votre WhatsApp</p>
                    <div className="space-y-2 text-xs text-[#8A90A0] text-left bg-[#08090C] p-4 rounded-2xl border border-white/[0.05]">
                      <p className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-white/[0.08] text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                        <span>Ouvrez <strong>WhatsApp</strong> sur votre smartphone</span>
                      </p>
                      <p className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-white/[0.08] text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                        <span>Accédez à <strong>Réglages</strong> (ou ⋮) &gt; <strong>Appareils connectés</strong></span>
                      </p>
                      <p className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-white/[0.08] text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                        <span>Appuyez sur <strong>Connecter un appareil</strong> et scannez ce code</span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => waha.restart()}
                    className="px-5 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-medium text-white inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Régénérer le QR Code</span>
                  </button>
                </>
              ) : (
                <div className="w-full max-w-md space-y-5">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">Connexion par numéro de téléphone</p>
                    <p className="text-xs text-[#8A90A0]">
                      Idéal si vous ouvrez l’application sur le même téléphone que votre WhatsApp.
                    </p>
                  </div>

                  <form onSubmit={handleRequestPairingCode} className="space-y-3">
                    <input
                      type="tel"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      placeholder="Ex : +225 07 00 00 00 00 ou +226 70 00 00 00"
                      className="w-full px-4 py-3 rounded-2xl bg-[#08090C] border border-white/[0.08] text-sm text-white text-center font-mono tabular-nums focus:outline-none focus:border-[#E2BD6B]"
                    />
                    {pairingError && (
                      <p className="text-xs text-rose-400">{pairingError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={isRequestingCode}
                      className="w-full py-3 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isRequestingCode ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Génération du code…</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Obtenir mon code à 8 chiffres</span>
                        </>
                      )}
                    </button>
                  </form>

                  {pairingCode && (
                    <div className="p-5 rounded-2xl bg-[#08090C] border border-[#E2BD6B]/30 space-y-3">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-[#E2BD6B]">
                        Votre code d’association
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl sm:text-3xl font-mono font-bold tracking-[0.2em] text-white">
                          {pairingCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white cursor-pointer"
                          title="Copier le code"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-[#10D98E]" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-[#8A90A0] leading-relaxed text-left">
                        Sur votre téléphone : ouvrez WhatsApp &gt; <strong>Appareils connectés</strong> &gt; <strong>Connecter un appareil</strong> &gt; appuyez en bas sur <strong>Lier avec le numéro de téléphone</strong> et entrez ce code.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Carte informative si connecté */}
          {waha.isOnline && !showQrWhenConnected && (
            <div className="p-6 rounded-3xl bg-[#08090C] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Votre Studio WhatsApp est en ligne</p>
                <p className="text-xs text-[#8A90A0] leading-relaxed max-w-lg">
                  Toutes les réponses par emojis, notes vocales et flux clients fonctionnent en tâche de fond 24h/24. Vous pouvez tester ou modifier vos règles dans l’onglet dédié.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('automations')}
                className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition-colors shrink-0 cursor-pointer"
              >
                Gérer les automatisations
              </button>
            </div>
          )}
        </div>
      )}

      {/* SOUS-ONGLET 2 : AUTOMATISATIONS PAR EMOJIS & RÉACTIONS WHATSAPP */}
      {activeTab === 'automations' && (
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Automatisations par Réactions WhatsApp</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E2BD6B]/10 text-[#E2BD6B] text-[11px] font-mono font-medium border border-[#E2BD6B]/20">
                {allRules.length} règles
              </span>
            </div>
            <p className="text-xs text-[#8A90A0] max-w-xl">
              Réagissez à un message client avec un emoji sur votre téléphone. WhatsApp envoie instantanément la note vocale, la musique, le texte ou la vidéo correspondante.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-colors inline-flex items-center gap-2 shrink-0 cursor-pointer shadow-[0_4px_16px_rgba(255,255,255,0.15)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle automatisation</span>
          </button>
        </div>

        {/* Filtres par type de média */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'voice', label: 'Notes vocales' },
            { id: 'music', label: 'Musiques' },
            { id: 'text', label: 'Textes' },
            { id: 'video_doc', label: 'Vidéos & Docs' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterKind(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                filterKind === f.id
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/[0.05] text-[#8A90A0] hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Grille des automatisations */}
        {filteredRules.length === 0 ? (
          <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-8 sm:p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.05] text-[#E2BD6B] flex items-center justify-center mx-auto">
              <Zap className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <p className="text-sm font-semibold text-white">Aucune automatisation configurée</p>
              <p className="text-xs text-[#8A90A0] leading-relaxed">
                Créez votre première règle ou enregistrez une note vocale depuis le Studio Vocal : dès que vous réagirez avec l’emoji choisi sur WhatsApp, le message partira automatiquement.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer ma première automatisation</span>
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRules.map((rule) => {
            const triggerInfo = findReactionTrigger(rule.emoji);
            const kindMeta = KIND_META[rule.kind ?? 'text'];
            const KindIcon = kindMeta.icon;
            const isPreset = rule.id.startsWith('preset-');
            const mediaUrl = resolveMediaUrl(rule);

            return (
              <div
                key={rule.id}
                className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 flex flex-col justify-between space-y-4 hover:border-white/[0.12] transition-all"
              >
                {/* En-tête de la carte */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.06] text-sm shrink-0 border border-white/[0.08]">
                      {rule.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-medium text-[#E2BD6B]">
                          {triggerInfo?.label || 'Réaction'}
                        </span>
                        <span className="text-[10px] text-white/30">•</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#8A90A0]">
                          <KindIcon className="w-3 h-3" />
                          <span>{kindMeta.label}</span>
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white truncate mt-0.5">
                        {rule.name}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.active}
                    onClick={() => handleToggleRule(rule)}
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                      rule.active ? 'bg-[#10D98E]' : 'bg-white/15'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-black transition-transform ${
                        rule.active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Contenu / Prévisualisation */}
                <div className="rounded-2xl bg-[#06070A] border border-white/[0.04] p-3 text-xs text-[#8A90A0] leading-relaxed">
                  {rule.kind === 'payment' ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white font-medium truncate">
                          {rule.offerName || rule.name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#10D98E]/15 text-[#10D98E] border border-[#10D98E]/25 shrink-0">
                          {(rule.amount || 3000).toLocaleString('fr-FR')} {rule.currency || 'F CFA'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#707685]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10D98E] shrink-0" />
                        <span>Enregistrement automatique CRM · Extraction Pays & Contact</span>
                      </div>
                      {rule.confirmationMessage && (
                        <p className="line-clamp-2 text-[11px] text-[#8A90A0] italic bg-white/[0.02] p-2 rounded-xl border border-white/[0.04]">
                          « {rule.confirmationMessage} »
                        </p>
                      )}
                    </div>
                  ) : rule.kind === 'voice' ? (
                    <div className="space-y-1.5">
                      <WaveformPlayer seed={rule.id} src={mediaUrl} tone="dark" />
                      <div className="flex items-center justify-between text-[10px] text-[#8A90A0] pt-1">
                        <span className="inline-flex items-center gap-1">
                          <Mic className="w-3 h-3 text-[#E2BD6B]" />
                          <span>Note vocale WhatsApp</span>
                        </span>
                        {rule.mediaName && <span className="font-mono truncate">{rule.mediaName}</span>}
                      </div>
                    </div>
                  ) : rule.kind === 'music' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-white font-medium">
                        <Music2 className="w-4 h-4 text-[#E2BD6B] shrink-0" />
                        <span className="truncate">{rule.mediaName || 'Morceau audio studio'}</span>
                      </div>
                      {mediaUrl && (
                        <audio src={mediaUrl} controls className="w-full h-8 max-w-full rounded" />
                      )}
                      {rule.action && <p className="italic text-[#707685]">« {rule.action} »</p>}
                    </div>
                  ) : rule.kind === 'video' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-white font-medium">
                        <Video className="w-3.5 h-3.5 text-rose-400" />
                        <span>{rule.mediaName || 'Vidéo de démonstration'}</span>
                      </div>
                      <p className="line-clamp-2 text-[#707685]">{rule.action}</p>
                    </div>
                  ) : rule.kind === 'document' ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-white font-medium">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{rule.mediaName || 'Document PDF'}</span>
                      </div>
                      {rule.action && <p className="line-clamp-2 text-[#707685]">{rule.action}</p>}
                    </div>
                  ) : (
                    <p className="line-clamp-3 text-white/90">« {rule.action} »</p>
                  )}
                </div>

                {/* Barre d'actions en bas de carte */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-1.5 text-[#10D98E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10D98E]" />
                    <span className="text-[11px] font-mono">
                      {rule.active ? 'Prêt sur WhatsApp' : 'En pause'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTestRule(rule)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                    >
                      <Zap className="w-3 h-3 text-[#E2BD6B]" />
                      <span>Tester</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(rule)}
                      className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Modifier"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>

                    {!isPreset && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule)}
                        className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </section>
      )}

      {/* MODAL DE CRÉATION / MODIFICATION D'UNE AUTOMATISATION */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0D0F14] border border-white/[0.12] p-6 sm:p-7 shadow-2xl space-y-6">
            {/* En-tête Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {draft.id ? "Modifier l'automatisation" : "Créer une automatisation"}
                </h3>
                <p className="text-xs text-[#8A90A0] mt-0.5">
                  Choisissez la réaction emoji et le contenu envoyé au client.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSaveDraft} className="space-y-5">
              {draftError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{draftError}</span>
                </div>
              )}

              {/* Nom */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Nom de l'automatisation
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ex : Démo Chanson Mariage, Fiche Tarifs, Message Vocal Accueil..."
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                  required
                />
              </div>

              {/* Sélecteur de Déclencheur Emoji */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Réaction WhatsApp de déclenchement
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {REACTION_TRIGGERS.slice(0, 12).map((t) => {
                    const isSelected = sameReaction(draft.emoji, t.value);
                    const TriggerIcon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setDraft({ ...draft, emoji: t.value })}
                        className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#E2BD6B]/15 border-[#E2BD6B] text-white'
                            : 'bg-[#06070A] border-white/[0.06] text-[#8A90A0] hover:text-white hover:border-white/[0.12]'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <TriggerIcon className="w-3 h-3 text-[#E2BD6B]" />
                          <span className="text-base">{t.value}</span>
                        </div>
                        <span className="text-[10px] font-mono truncate max-w-full">
                          {t.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1">
                  <input
                    type="text"
                    value={draft.emoji}
                    onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                    placeholder="Ou collez un emoji personnalisé (ex: 🔥, 👏, 🎁...)"
                    className="w-full px-3 py-2 rounded-xl bg-[#06070A] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                </div>
              </div>

              {/* Type d'action */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Type d'action à envoyer
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {MEDIA_KINDS.map((k) => {
                    const isSelected = draft.kind === k.id;
                    const Icon = k.icon;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => {
                          setIsRecording(false);
                          setDraft({ ...draft, kind: k.id, media: undefined });
                        }}
                        className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-white text-black font-semibold border-white'
                            : 'bg-[#06070A] border-white/[0.06] text-[#8A90A0] hover:text-white hover:border-white/[0.12]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-medium leading-tight">{k.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contenu spécifique au type */}
              <div className="space-y-3 pt-1">
                {draft.kind === 'payment' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#8A90A0]">
                          Nom de la formule / offre
                        </label>
                        <input
                          type="text"
                          value={draft.offerName || ''}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              offerName: e.target.value,
                              name: draft.name || e.target.value,
                            })
                          }
                          placeholder="Ex : Formule Standard, Pack Vidéo..."
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#8A90A0]">
                          Montant encaissé (F CFA)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={100}
                            step={100}
                            value={draft.amount ?? 3000}
                            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs font-mono font-bold text-white focus:outline-none focus:border-[#E2BD6B]"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[#8A90A0]">
                            F CFA
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sélecteurs de montants rapides */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-[#707685]">Montants usuels :</span>
                      {[1200, 3000, 5000, 10000, 15000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDraft({ ...draft, amount: amt })}
                          className={`px-2.5 py-1 rounded-xl text-xs font-mono cursor-pointer transition-colors border ${
                            draft.amount === amt
                              ? 'bg-[#10D98E]/15 border-[#10D98E]/40 text-[#10D98E] font-semibold'
                              : 'bg-white/[0.04] border-white/[0.06] text-[#8A90A0] hover:text-white hover:border-white/[0.12]'
                          }`}
                        >
                          {amt.toLocaleString('fr-FR')} F
                        </button>
                      ))}
                    </div>

                    {/* Message WhatsApp de confirmation facultatif */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#8A90A0]">
                          Message WhatsApp envoyé au client (optionnel)
                        </label>
                        <span className="text-[10px] text-[#707685]">
                          Laisser vide pour enregistrement silencieux
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        value={draft.confirmationMessage || ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            confirmationMessage: e.target.value,
                            action: e.target.value,
                          })
                        }
                        placeholder="Ex : Paiement bien reçu ! Votre commande entre immédiatement en production dans notre studio."
                        className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                      />
                    </div>

                    {/* Cartouche d'assurance sobre */}
                    <div className="p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.06] flex items-start gap-3">
                      <BadgeCheck className="w-4 h-4 text-[#10D98E] shrink-0 mt-0.5" />
                      <div className="text-xs text-[#8A90A0] leading-relaxed">
                        <span className="text-white font-medium">Détection & Traçabilité :</span> Dès
                        que vous réagissez avec cet emoji sur WhatsApp, la vente de{' '}
                        {(draft.amount || 3000).toLocaleString('fr-FR')} F CFA est enregistrée, le
                        numéro et le pays (+225, +226...) sont extraits, et votre chiffre d'affaires
                        est mis à jour en direct sur votre tableau de bord.
                      </div>
                    </div>
                  </div>
                )}
                {draft.kind === 'text' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#8A90A0]">
                      Message texte envoyé au client
                    </label>
                    <textarea
                      rows={4}
                      value={draft.action}
                      onChange={(e) => setDraft({ ...draft, action: e.target.value })}
                      placeholder="Tapez le message qui sera expédié dès que vous réagissez avec cet emoji..."
                      className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                      required
                    />
                  </div>
                )}

                {draft.kind === 'voice' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-[#8A90A0]">
                      Note vocale WhatsApp
                    </label>

                    {isRecording ? (
                      <VoiceNoteRecorder
                        onComplete={handleRecordedVoice}
                        onCancel={() => setIsRecording(false)}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsRecording(true)}
                            className="px-3.5 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-semibold hover:bg-violet-500/25 transition-colors inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>Enregistrer au micro</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-xs font-medium hover:bg-white/[0.1] transition-colors inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Importer un audio (.opus, .mp3, .ogg)</span>
                          </button>
                        </div>

                        {draft.media?.url && (
                          <div className="p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] space-y-2">
                            <p className="text-xs font-medium text-white">Aperçu de la note vocale :</p>
                            <WaveformPlayer
                              seed={draft.name || 'draft'}
                              src={draft.media.url}
                              peaks={draft.media.peaks}
                              durationHint={draft.media.durationSec}
                              tone="dark"
                            />
                            <p className="text-[11px] font-mono text-[#8A90A0]">
                              {draft.media.name}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(draft.kind === 'music' || draft.kind === 'video' || draft.kind === 'document') && (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-[#8A90A0]">
                      Fichier {KIND_META[draft.kind].label}
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-medium transition-colors inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Téléverser {KIND_META[draft.kind].label}</span>
                      </button>

                      {draft.media?.name && (
                        <span className="text-xs font-mono text-[#10D98E]">
                          {draft.media.name}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs text-[#8A90A0]">
                        Légende / texte accompagnant le média (optionnel)
                      </label>
                      <input
                        type="text"
                        value={draft.action}
                        onChange={(e) => setDraft({ ...draft, action: e.target.value })}
                        placeholder="Ex : Voici un extrait créé dans notre studio..."
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                      />
                    </div>
                  </div>
                )}

                {/* Input fichier caché */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={KIND_META[draft.kind].accept}
                  onChange={handlePickFile}
                  className="hidden"
                />
              </div>

              {/* Boutons Footer Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="px-4 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSavingDraft}
                  className="px-5 py-2.5 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingDraft ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement…</span>
                    </>
                  ) : (
                    <span>Enregistrer l'automatisation</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
