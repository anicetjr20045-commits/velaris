import { useEffect, useRef, useState, type FC, type FormEvent, type ReactNode } from 'react';
import {
  X,
  Mail,
  Lock,
  Building2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  KeyRound,
  RotateCw,
  Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;
const RESEND_COOLDOWN = 45;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Traduit les messages Supabase Auth ; ne révèle jamais si un compte existe. */
function humanizeAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Adresse email non confirmée. Ouvrez le lien reçu par email ou renvoyez-le ci-dessous.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Impossible de créer ce compte. Essayez de vous connecter ou de réinitialiser le mot de passe.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  if (m.includes('password should be') || m.includes('weak')) return 'Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.';
  if (m.includes('same password') || m.includes('different from the old')) return 'Le nouveau mot de passe doit être différent de l\'ancien.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Connexion réseau indisponible. Vérifiez votre accès internet.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

/** Score 0-4 : longueur, casse, chiffres, symboles */
function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const SCORE_LABELS = ['Trop court', 'Faible', 'Correct', 'Solide', 'Excellent'];
const SCORE_COLORS = ['bg-[#3A3022]', 'bg-rose-500', 'bg-amber-400', 'bg-[#E5B54F]', 'bg-emerald-400'];

const inputClass =
  'w-full rounded-xl border border-[#2D261E] bg-[#1A1713] pl-10 pr-3 h-11 text-sm text-white placeholder-neutral-600 focus:border-[#E5B54F]/60 focus:outline-none focus:ring-2 focus:ring-[#E5B54F]/15 transition-[border-color,box-shadow] duration-200 ease-luxury';

const Field: FC<{ id: string; label: string; icon: typeof Mail; children: ReactNode; aside?: ReactNode }> = ({ id, label, icon: Icon, children, aside }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-xs font-medium text-neutral-300">{label}</label>
      {aside}
    </div>
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" strokeWidth={1.6} />
      {children}
    </div>
  </div>
);

export const AuthModal: FC = () => {
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    openAuthModal,
    signIn,
    signUp,
    setDemoMode,
    resetPassword,
    updatePassword,
    resendConfirmation
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [studioName, setStudioName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  // Écran « vérifiez vos emails » après inscription ou demande de réinitialisation
  const [sentTo, setSentTo] = useState<{ email: string; kind: 'confirm' | 'reset' } | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const lockRemaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const resendRemaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  // Horloge pour les comptes à rebours (verrouillage / renvoi)
  useEffect(() => {
    if (lockRemaining <= 0 && resendRemaining <= 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [lockRemaining, resendRemaining]);

  // Échap pour fermer + focus sur le premier champ à chaque changement de mode
  const closeRef = useRef(closeAuthModal);
  closeRef.current = closeAuthModal;
  useEffect(() => {
    if (!authModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && authModalMode !== 'recovery') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [authModalOpen, authModalMode]);

  // Jamais de mot de passe conservé en mémoire après fermeture
  useEffect(() => {
    if (authModalOpen) return;
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrorMessage(null);
    setSuccessInfo(null);
    setSentTo(null);
    setNeedsConfirmation(false);
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const switchMode = (mode: 'login' | 'signup' | 'reset') => {
    openAuthModal(mode);
    setErrorMessage(null);
    setSuccessInfo(null);
    setSentTo(null);
    setNeedsConfirmation(false);
    setPassword('');
    setConfirmPassword('');
  };

  const registerFailure = () => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCK_SECONDS * 1000;
      setLockedUntil(until);
      setNow(Date.now());
      setFailedAttempts(0);
    }
  };

  const score = passwordScore(password);
  const cleanEmail = email.trim().toLowerCase();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || lockRemaining > 0) return;
    setErrorMessage(null);
    setSuccessInfo(null);
    setNeedsConfirmation(false);

    if (authModalMode !== 'recovery' && !EMAIL_RE.test(cleanEmail)) {
      setErrorMessage('Adresse email invalide.');
      return;
    }

    if ((authModalMode === 'signup' || authModalMode === 'recovery') && (password.length < 8 || score < 2)) {
      setErrorMessage('Choisissez un mot de passe d\'au moins 8 caractères mêlant lettres, chiffres ou symboles.');
      return;
    }

    if (authModalMode === 'recovery' && password !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    if (authModalMode === 'login') {
      const res = await signIn(cleanEmail, password);
      if (res.error) {
        registerFailure();
        setErrorMessage(humanizeAuthError(res.error));
        setNeedsConfirmation(res.error.toLowerCase().includes('email not confirmed'));
      } else {
        setFailedAttempts(0);
      }
    } else if (authModalMode === 'signup') {
      const name = studioName.replace(/[<>]/g, '').trim().slice(0, 60);
      const res = await signUp(cleanEmail, password, name);
      if (res.error) {
        setErrorMessage(humanizeAuthError(res.error));
      } else if (res.requiresEmailConfirmation) {
        setSentTo({ email: cleanEmail, kind: 'confirm' });
        setResendAt(Date.now() + RESEND_COOLDOWN * 1000);
        setNow(Date.now());
        setPassword('');
      }
    } else if (authModalMode === 'reset') {
      const res = await resetPassword(cleanEmail);
      // Réponse identique que le compte existe ou non (anti-énumération)
      if (res.error && /rate limit|too many|security purposes|network|fetch/i.test(res.error)) {
        setErrorMessage(humanizeAuthError(res.error));
      } else {
        setSentTo({ email: cleanEmail, kind: 'reset' });
        setResendAt(Date.now() + RESEND_COOLDOWN * 1000);
        setNow(Date.now());
      }
    } else {
      const res = await updatePassword(password);
      if (res.error) {
        setErrorMessage(humanizeAuthError(res.error));
      } else {
        setPassword('');
        setConfirmPassword('');
        setSuccessInfo('Mot de passe mis à jour. Votre session studio est active.');
        window.setTimeout(closeAuthModal, 1400);
      }
    }

    setLoading(false);
  };

  const handleResend = async () => {
    if (resendRemaining > 0 || (!sentTo && !EMAIL_RE.test(cleanEmail))) return;
    const target = sentTo?.email ?? cleanEmail;
    const kind = sentTo?.kind ?? 'confirm';
    setLoading(true);
    setErrorMessage(null);
    const res = kind === 'reset' ? await resetPassword(target) : await resendConfirmation(target);
    setLoading(false);
    if (res.error && /rate limit|too many|security purposes|network|fetch/i.test(res.error)) {
      setErrorMessage(humanizeAuthError(res.error));
      return;
    }
    setResendAt(Date.now() + RESEND_COOLDOWN * 1000);
    setNow(Date.now());
    if (!sentTo) setSentTo({ email: target, kind });
    else setSuccessInfo('Nouvel email envoyé.');
  };

  const handleDemoAccess = () => {
    setDemoMode(true);
    closeAuthModal();
  };

  const titles: Record<typeof authModalMode, { title: string; subtitle: string }> = {
    login: { title: 'Connexion à votre Studio', subtitle: 'Accédez à votre cockpit privé, vos ventes et vos lignes WhatsApp.' },
    signup: { title: 'Créer votre Studio OS', subtitle: 'Isolation totale de vos clients, automatisations et encaissements.' },
    reset: { title: 'Mot de passe oublié', subtitle: 'Recevez un lien sécurisé à usage unique pour définir un nouveau mot de passe.' },
    recovery: { title: 'Nouveau mot de passe', subtitle: 'Définissez le mot de passe de votre espace studio.' }
  };

  const strengthMeter = (authModalMode === 'signup' || authModalMode === 'recovery') && password.length > 0 && (
    <div className="space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-colors duration-300 ease-luxury ${i < score ? SCORE_COLORS[score] : 'bg-[#2D261E]'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-500">Robustesse</span>
        <span className="font-mono text-neutral-300">{SCORE_LABELS[score]}</span>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md vx-palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && authModalMode !== 'recovery') closeAuthModal();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="vx-palette relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[#2D261E] bg-[#141210] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] p-6 sm:p-8 space-y-6 vx-hairline"
      >
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[#E5B54F]/[0.06] blur-3xl pointer-events-none" />

        {/* En-tête */}
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#E5B54F]/40 bg-[#E5B54F]/[0.08]">
                <ShieldCheck className="h-3 w-3 text-[#E5B54F]" strokeWidth={1.8} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Espace Studio Sécurisé
              </span>
            </div>
            <h2 id="auth-title" className="font-display text-2xl font-bold tracking-tight text-white">
              {sentTo ? 'Vérifiez vos emails' : titles[authModalMode].title}
            </h2>
            {!sentTo && <p className="text-[13px] text-neutral-400 leading-relaxed">{titles[authModalMode].subtitle}</p>}
          </div>

          {authModalMode !== 'recovery' && (
            <button
              onClick={closeAuthModal}
              className="-mr-2 -mt-2 h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Onglets connexion / inscription */}
        {!sentTo && (authModalMode === 'login' || authModalMode === 'signup') && (
          <div className="relative grid grid-cols-2 rounded-xl bg-white/[0.03] p-1 border border-[#2D261E]/60" role="tablist">
            <span
              aria-hidden
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white transition-transform duration-300 ease-luxury"
              style={{ transform: authModalMode === 'signup' ? 'translate3d(100%,0,0)' : 'translate3d(0,0,0)' }}
            />
            {(['login', 'signup'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={authModalMode === mode}
                onClick={() => switchMode(mode)}
                className={`relative z-10 h-9 text-[13px] font-semibold rounded-lg transition-colors duration-200 ${
                  authModalMode === mode ? 'text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {mode === 'login' ? 'Se connecter' : 'Créer un studio'}
              </button>
            ))}
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="vx-fade-in rounded-xl border border-rose-500/25 bg-rose-500/[0.08] p-3 text-[13px] text-rose-200 leading-relaxed">
            {errorMessage}
            {needsConfirmation && (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendRemaining > 0}
                className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#F3CA75] hover:text-white disabled:opacity-50"
              >
                <RotateCw className="h-3.5 w-3.5" />
                {resendRemaining > 0 ? `Renvoyer dans ${resendRemaining}s` : 'Renvoyer l\'email de confirmation'}
              </button>
            )}
          </div>
        )}

        {successInfo && (
          <div role="status" className="vx-fade-in flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3 text-[13px] text-emerald-200">
            <Check className="h-4 w-4 shrink-0" />
            {successInfo}
          </div>
        )}

        {sentTo ? (
          /* Écran de confirmation d'envoi */
          <div className="vx-fade-in space-y-5">
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="h-14 w-14 rounded-2xl border border-[#E5B54F]/40 bg-[#E5B54F]/[0.08] flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-[#F3CA75]" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {sentTo.kind === 'confirm'
                  ? 'Un lien de confirmation a été envoyé à'
                  : 'Si un studio est associé à cette adresse, un lien de réinitialisation a été envoyé à'}
                <br />
                <span className="font-mono text-[13px] text-white break-all">{sentTo.email}</span>
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Le lien est à usage unique et expire après 1 heure. Pensez à vérifier vos courriers indésirables.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resendRemaining > 0}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-[#3A3022] text-[13px] font-semibold text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" strokeWidth={1.6} />}
              {resendRemaining > 0 ? <span className="font-mono">Renvoyer dans {resendRemaining}s</span> : 'Renvoyer l\'email'}
            </button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[13px] font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {authModalMode === 'signup' && (
              <Field id="auth-studio" label="Nom de votre Studio ou Entreprise" icon={Building2}>
                <input
                  id="auth-studio"
                  type="text"
                  required
                  maxLength={60}
                  autoComplete="organization"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder="Ex : Studio Mélodie Sahel"
                  className={inputClass}
                />
              </Field>
            )}

            {authModalMode !== 'recovery' && (
              <Field id="auth-email" label="Adresse email professionnelle" icon={Mail}>
                <input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@monstudio.com"
                  className={inputClass}
                />
              </Field>
            )}

            {authModalMode !== 'reset' && (
              <Field
                id="auth-password"
                label={authModalMode === 'recovery' ? 'Nouveau mot de passe' : 'Mot de passe'}
                icon={Lock}
                aside={authModalMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-xs text-[#E5B54F]/90 hover:text-[#F3CA75] transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              >
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={authModalMode === 'login' ? 6 : 8}
                  maxLength={128}
                  autoComplete={authModalMode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>
            )}

            {authModalMode === 'recovery' && (
              <Field id="auth-password-confirm" label="Confirmer le mot de passe" icon={KeyRound}>
                <input
                  id="auth-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={inputClass}
                />
              </Field>
            )}

            {strengthMeter}

            <button
              type="submit"
              disabled={loading || lockRemaining > 0}
              className="w-full mt-2 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-[13px] font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Vérification sécurisée…</span>
                </>
              ) : lockRemaining > 0 ? (
                <span className="font-mono">Trop d'essais · réessayez dans {lockRemaining}s</span>
              ) : (
                <>
                  <span>
                    {{
                      login: 'Accéder à mon espace',
                      signup: 'Créer mon studio',
                      reset: 'Envoyer le lien sécurisé',
                      recovery: 'Enregistrer le mot de passe'
                    }[authModalMode]}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {authModalMode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full h-11 inline-flex items-center justify-center gap-2 text-[13px] text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </button>
            )}
          </form>
        )}

        {/* Garanties + accès démo */}
        {authModalMode !== 'recovery' && (
          <div className="pt-4 border-t border-[#2D261E] space-y-3">
            <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-neutral-500">
              <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> TLS chiffré</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Données isolées RLS</span>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleDemoAccess}
                className="min-h-[44px] text-[13px] font-medium text-neutral-300 hover:text-white underline underline-offset-4 decoration-[#3A3022] hover:decoration-[#E5B54F] transition-colors"
              >
                Continuer en mode démonstration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
