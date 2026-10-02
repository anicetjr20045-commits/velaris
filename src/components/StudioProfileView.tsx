import { useState, type CSSProperties, type FC, type FormEvent } from 'react';
import {
  UserRound,
  ShieldCheck,
  Mail,
  Smartphone,
  KeyRound,
  LogOut,
  LogIn,
  RefreshCw,
  Check,
  Copy,
  Loader2,
  Fingerprint,
  CalendarClock,
  Pencil
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

interface StudioProfileViewProps {
  /** Par défaut on reste sur le profil, qui propose alors la reconnexion */
  onSignedOut?: () => void;
  onOpenWhatsApp: () => void;
}

const panelClass = 'rounded-2xl border border-[#2D261E] bg-[#13110E] vx-hairline';

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const StudioProfileView: FC<StudioProfileViewProps> = ({ onSignedOut, onOpenWhatsApp }) => {
  const { user, session, isDemoMode, signOut, openAuthModal, resetPassword } = useAuth();

  const currentName = (user?.user_metadata?.studio_name as string) || '';
  const [studioName, setStudioName] = useState(currentName);
  const [prevName, setPrevName] = useState(currentName);
  if (prevName !== currentName) {
    setPrevName(currentName);
    setStudioName(currentName);
  }

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'signout' | 'refresh' | 'reset' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const sessionName = user ? `studio_${user.id.slice(0, 8)}` : 'Test';
  const tokenExpiry = session?.expires_at ? new Date(session.expires_at * 1000) : null;
  const initials = ((currentName || user?.email || 'ST').slice(0, 2)).toUpperCase();

  const flash = (tone: 'ok' | 'err', text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3200);
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    // Assainissement : pas de balises, espaces normalisés, 60 caractères max
    const clean = studioName.replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!clean || clean === currentName) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { studio_name: clean } });
    setSaving(false);
    if (error) flash('err', 'Impossible d\'enregistrer le nom du studio.');
    else flash('ok', 'Nom du studio mis à jour.');
  };

  const handleSignOut = async () => {
    setBusy('signout');
    await signOut();
    setBusy(null);
    onSignedOut?.();
  };

  // Rafraîchit le jeton sans déconnecter : aucune donnée locale n'est perdue
  const handleRefresh = async () => {
    setBusy('refresh');
    const { error } = await supabase.auth.refreshSession();
    setBusy(null);
    if (error) flash('err', 'Session expirée : reconnectez-vous.');
    else flash('ok', 'Session renouvelée.');
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setBusy('reset');
    const { error } = await resetPassword(user.email);
    setBusy(null);
    if (error) flash('err', 'Envoi impossible pour le moment.');
    else flash('ok', `Lien de réinitialisation envoyé à ${user.email}.`);
  };

  const copySession = async () => {
    try {
      await navigator.clipboard.writeText(sessionName);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // presse-papiers indisponible
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Mon profil studio</h1>
          <p className="text-sm sm:text-base text-[#A8A29E] mt-2">Identité, sécurité et ligne WhatsApp de votre studio.</p>
        </div>

        <div className={`${panelClass} p-8 text-center space-y-5`}>
          <div className="mx-auto h-14 w-14 rounded-full border border-[#3A3022] bg-[#1A1713] flex items-center justify-center">
            <UserRound className="h-6 w-6 text-[#78716C]" strokeWidth={1.4} />
          </div>
          <div className="space-y-1.5">
            <div className="text-lg font-semibold text-white">
              {isDemoMode ? 'Vous explorez le mode démonstration' : 'Aucune session ouverte'}
            </div>
            <p className="text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Connectez-vous pour retrouver vos commandes, vos discussions et votre ligne WhatsApp privée, isolées par RLS.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center justify-center gap-2 h-11 rounded-full bg-[#E5B54F] px-6 text-sm font-semibold text-[#0C0A09] hover:bg-[#F0C068] active:scale-[0.98] transition-all duration-150 ease-press"
            >
              <LogIn className="h-4 w-4" />
              Se connecter
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="inline-flex items-center justify-center h-11 rounded-full border border-[#3A3022] px-6 text-sm font-semibold text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white transition-colors"
            >
              Créer mon studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const facts = [
    { icon: Mail, label: 'Email du compte', value: user.email ?? '—', mono: false },
    { icon: Fingerprint, label: 'Identifiant studio', value: `${user.id.slice(0, 8)}…${user.id.slice(-4)}`, mono: true },
    { icon: CalendarClock, label: 'Membre depuis', value: fmtDate(user.created_at), mono: false },
    { icon: CalendarClock, label: 'Dernière connexion', value: fmtDate(user.last_sign_in_at), mono: false }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Mon profil studio</h1>
        <p className="text-sm sm:text-base text-[#A8A29E] mt-2">Identité, sécurité et ligne WhatsApp de votre studio.</p>
      </div>

      {notice && (
        <div
          role="status"
          className={`vx-fade-in flex items-center gap-2 rounded-xl border p-3 text-sm ${
            notice.tone === 'ok' ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200' : 'border-rose-500/25 bg-rose-500/[0.07] text-rose-200'
          }`}
        >
          <Check className="h-4 w-4 shrink-0" />
          {notice.text}
        </div>
      )}

      {/* Identité */}
      <section className={`${panelClass} vx-stagger p-5 sm:p-6`} style={{ '--i': 0 } as CSSProperties}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-16 w-16 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#3A3022,#13110E_70%)] border border-[#E5B54F]/40 flex items-center justify-center font-display text-xl font-bold text-[#F3CA75]">
            {initials}
          </div>

          <form onSubmit={saveName} className="flex-1 space-y-1.5">
            <label htmlFor="profile-studio-name" className="text-xs font-medium text-neutral-400">Nom du studio</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Pencil className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                <input
                  id="profile-studio-name"
                  value={studioName}
                  maxLength={60}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder="Mon Studio Velaris"
                  className="w-full h-11 rounded-xl border border-[#2D261E] bg-[#1A1713] pl-9 pr-3 text-[15px] text-white placeholder-neutral-600 focus:border-[#E5B54F]/60 focus:outline-none focus:ring-2 focus:ring-[#E5B54F]/15 transition-[border-color,box-shadow]"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !studioName.trim() || studioName.trim() === currentName}
                className="h-11 shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-black hover:bg-neutral-200 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-xl overflow-hidden border border-[#2D261E] bg-[#2D261E]">
          {facts.map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="bg-[#13110E] px-4 py-3.5 flex items-start gap-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[#78716C]" strokeWidth={1.5} />
              <div className="min-w-0">
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className={`text-sm text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ligne WhatsApp */}
        <section className={`${panelClass} vx-stagger p-5 sm:p-6 space-y-4`} style={{ '--i': 1 } as CSSProperties}>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <Smartphone className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.5} />
            Ligne WhatsApp privée
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2D261E] bg-[#1A1713] px-4 h-12">
            <span className="font-mono text-sm text-[#F3CA75] truncate">{sessionName}</span>
            <button
              onClick={copySession}
              aria-label="Copier l'identifiant de session"
              className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Session WAHA dédiée à votre studio : aucun autre compte ne peut lire ou envoyer sur cette ligne.
          </p>
          <button
            onClick={onOpenWhatsApp}
            className="w-full h-11 rounded-xl border border-[#3A3022] text-[13px] font-semibold text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white transition-colors"
          >
            Gérer mes lignes WhatsApp
          </button>
        </section>

        {/* Sécurité */}
        <section className={`${panelClass} vx-stagger p-5 sm:p-6 space-y-4`} style={{ '--i': 2 } as CSSProperties}>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.5} />
            Sécurité & isolation
          </div>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Statut RLS</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
                PRIVÉ · user_id
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Email confirmé</span>
              <span className={`font-mono text-xs ${user.email_confirmed_at ? 'text-emerald-400' : 'text-amber-300'}`}>
                {user.email_confirmed_at ? 'OUI' : 'EN ATTENTE'}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Jeton de session</span>
              <span className="font-mono text-xs text-neutral-300">
                {tokenExpiry ? `expire ${tokenExpiry.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '—'}
              </span>
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleRefresh}
              disabled={busy !== null}
              className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-[#3A3022] text-[13px] font-medium text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
              Reconnecter
            </button>
            <button
              onClick={handlePasswordReset}
              disabled={busy !== null}
              className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-[#3A3022] text-[13px] font-medium text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Mot de passe
            </button>
          </div>
        </section>
      </div>

      {/* Déconnexion */}
      <section className={`${panelClass} vx-stagger p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`} style={{ '--i': 3 } as CSSProperties}>
        <div>
          <div className="text-[15px] font-semibold text-white">Se déconnecter de ce poste</div>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Vos données restent dans votre espace Supabase. Reconnectez-vous à tout moment pour les retrouver intactes.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={busy !== null}
          className="h-11 shrink-0 inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/30 px-5 text-[13px] font-semibold text-rose-300 hover:bg-rose-500/[0.08] hover:text-rose-200 disabled:opacity-50 transition-colors"
        >
          {busy === 'signout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Se déconnecter
        </button>
      </section>
    </div>
  );
};
