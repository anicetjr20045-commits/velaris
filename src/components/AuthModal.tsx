import { useState, useRef, useEffect, type FC, type FormEvent, type ReactNode } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  MailCheck,
  KeyRound,
  RotateCw,
  Check,
  Smartphone,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

function passwordScore(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  return Math.min(score, 4);
}

function humanizeAuthError(err: string): string {
  const l = err.toLowerCase();
  if (l.includes('invalid login credentials')) return 'Adresse email ou mot de passe incorrect.';
  if (l.includes('user already registered')) return 'Ce compte existe déjà. Connectez-vous avec vos identifiants.';
  if (l.includes('password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (l.includes('email not confirmed')) return 'Veuillez confirmer votre adresse email avant de vous connecter.';
  if (l.includes('rate limit') || l.includes('too many requests')) return 'Trop de tentatives rapprochées. Veuillez patienter un instant.';
  return err;
}

const COUNTRY_PREFIXES = [
  { code: '+226', flag: 'BF', name: 'Burkina Faso (+226)' },
  { code: '+225', flag: 'CI', name: 'Côte d\'Ivoire (+225)' },
  { code: '+221', flag: 'SN', name: 'Sénégal (+221)' },
  { code: '+237', flag: 'CM', name: 'Cameroun (+237)' },
  { code: '+223', flag: 'ML', name: 'Mali (+223)' },
  { code: '+228', flag: 'TG', name: 'Togo (+228)' },
  { code: '+229', flag: 'BJ', name: 'Bénin (+229)' },
  { code: '+224', flag: 'GN', name: 'Guinée (+224)' },
  { code: '+33', flag: 'FR', name: 'France (+33)' },
  { code: '+', flag: 'INT', name: 'Autre (+)' },
];

function formatFullPhone(prefix: string, local: string): string {
  const raw = local.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const prefixDigits = prefix.replace(/\D/g, '');
  if (prefixDigits && raw.startsWith(prefixDigits)) return `+${raw}`;
  if (prefix === '+33' && raw.startsWith('0')) return `+33${raw.slice(1)}`;
  if (prefix === '+') return `+${raw}`;
  return `${prefix}${raw}`;
}

const SCORE_LABELS = ['Trop court', 'Faible', 'Correct', 'Solide', 'Excellent'];
const SCORE_COLORS = ['bg-white/[0.12]', 'bg-rose-500', 'bg-amber-400', 'bg-[#E5B54F]', 'bg-emerald-400'];

const inputClass =
  'w-full rounded-xl border border-white/[0.08] bg-[#0E1015] pl-10 pr-3 h-11 text-sm text-white placeholder-neutral-600 focus:border-[#E5B54F]/70 focus:outline-none focus:ring-2 focus:ring-[#E5B54F]/15 transition-[border-color,box-shadow] duration-200';

const Field: FC<{ id: string; label: string; icon: typeof Mail; children: ReactNode; aside?: ReactNode }> = ({
  id,
  label,
  icon: Icon,
  children,
  aside,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-xs font-medium text-neutral-300">
        {label}
      </label>
      {aside}
    </div>
    <div className="relative">
      <Icon
        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none"
        strokeWidth={1.6}
      />
      {children}
    </div>
  </div>
);

type PrimaryMethod = 'whatsapp' | 'email';
type EmailSubMode = 'password' | 'magiclink';

export const AuthModal: FC = () => {
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    openAuthModal,
    signIn,
    sendWhatsAppOtp,
    verifyWhatsAppOtp,
    signInWithMagicLink,
    verifyEmailOtp,
    signUp,
    setDemoMode,
    resetPassword,
    updatePassword,
    resendConfirmation,
  } = useAuth();

  // Navigation épurée : 2 canaux clairs au lieu de 3 options confuses
  const [method, setMethod] = useState<PrimaryMethod>('whatsapp');
  const [emailSubMode, setEmailSubMode] = useState<EmailSubMode>('password');

  // Champs studio
  const [studioName, setStudioName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // État WhatsApp OTP
  const [countryPrefix, setCountryPrefix] = useState('+226');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [whatsappStep, setWhatsappStep] = useState<'phone' | 'otp'>('phone');
  const [whatsappOtp, setWhatsappOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [whatsappCooldown, setWhatsappCooldown] = useState(0);

  // État Email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicEmailOtp, setMagicEmailOtp] = useState('');

  // Sécurité et verrouillage
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sentTo, setSentTo] = useState<{ email: string; kind: 'confirm' | 'reset' } | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const lockRemaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const resendRemaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  // Cooldown timer
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      setWhatsappCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Touche Échap
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

  // Reset à la fermeture
  useEffect(() => {
    if (authModalOpen) return;
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrorMessage(null);
    setSuccessInfo(null);
    setSentTo(null);
    setNeedsConfirmation(false);
    setWhatsappStep('phone');
    setWhatsappOtp('');
    setMagicLinkSent(false);
    setMagicEmailOtp('');
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const fullPhone = formatFullPhone(countryPrefix, phoneLocal);

  const switchMode = (mode: 'login' | 'signup' | 'reset') => {
    openAuthModal(mode);
    setErrorMessage(null);
    setSuccessInfo(null);
    setSentTo(null);
    setNeedsConfirmation(false);
    setPassword('');
    setConfirmPassword('');
    setWhatsappStep('phone');
    setWhatsappOtp('');
    setMagicLinkSent(false);
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

  // 1. Envoi du code WhatsApp
  const handleSendWhatsAppCode = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (loading || whatsappCooldown > 0) return;
    const digits = fullPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      setErrorMessage('Numéro WhatsApp trop court. Vérifiez l\'indicatif et le numéro saisi.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    const res = await sendWhatsAppOtp(fullPhone);
    setLoading(false);
    if (!res.success || !res.challengeToken) {
      setWhatsappCooldown(0);
      setErrorMessage(res.error || 'Impossible d\'envoyer le code WhatsApp.');
    } else {
      setChallengeToken(res.challengeToken);
      setWhatsappStep('otp');
      setWhatsappCooldown(60);
      setSuccessInfo(`Code de sécurité expédié sur WhatsApp au ${fullPhone}`);
    }
  };

  // 2. Vérification du code WhatsApp
  const handleVerifyWhatsAppCode = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (whatsappOtp.trim().length !== 6) {
      setErrorMessage('Veuillez saisir le code complet à 6 chiffres reçu sur WhatsApp.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    const res = await verifyWhatsAppOtp(fullPhone, whatsappOtp.trim(), challengeToken, studioName.trim());
    setLoading(false);
    if (res.error) {
      registerFailure();
      setErrorMessage(humanizeAuthError(res.error));
    }
  };

  // 3. Envoi Lien Magique
  const handleSendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Veuillez entrer une adresse email valide.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    const res = await signInWithMagicLink(cleanEmail);
    setLoading(false);
    if (res.error) {
      setErrorMessage(humanizeAuthError(res.error));
    } else {
      setMagicLinkSent(true);
      setSuccessInfo(`Lien magique envoyé à ${cleanEmail}. Vérifiez votre boîte mail.`);
    }
  };

  // 3b. Validation Code Lien Magique
  const handleVerifyMagicEmailOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !magicEmailOtp.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    const res = await verifyEmailOtp(email.trim().toLowerCase(), magicEmailOtp.trim());
    setLoading(false);
    if (res.error) {
      setErrorMessage(humanizeAuthError(res.error));
    }
  };

  // 4. Soumission Mot de passe classique & Reset
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || lockRemaining > 0) return;
    setErrorMessage(null);
    setSuccessInfo(null);
    setNeedsConfirmation(false);

    const cleanEmail = email.trim().toLowerCase();

    if (authModalMode === 'reset') {
      setLoading(true);
      const res = await resetPassword(cleanEmail);
      setLoading(false);
      if (res.error) {
        setErrorMessage(humanizeAuthError(res.error));
      } else {
        setSentTo({ email: cleanEmail, kind: 'reset' });
        setResendAt(Date.now() + 60000);
      }
      return;
    }

    if (authModalMode === 'recovery') {
      if (password.length < 8) {
        setErrorMessage('Le mot de passe doit comporter au moins 8 caractères.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Les deux mots de passe ne correspondent pas.');
        return;
      }
      setLoading(true);
      const res = await updatePassword(password);
      setLoading(false);
      if (res.error) {
        setErrorMessage(humanizeAuthError(res.error));
      } else {
        closeAuthModal();
      }
      return;
    }

    if (authModalMode === 'signup') {
      if (password.length < 8) {
        setErrorMessage('Le mot de passe doit comporter au moins 8 caractères.');
        return;
      }
      setLoading(true);
      const res = await signUp(cleanEmail, password, studioName.trim() || undefined);
      setLoading(false);
      if (res.error) {
        setErrorMessage(humanizeAuthError(res.error));
      } else if (res.requiresEmailConfirmation) {
        setSentTo({ email: cleanEmail, kind: 'confirm' });
        setNeedsConfirmation(true);
        setResendAt(Date.now() + 60000);
      }
      return;
    }

    // Connexion classique
    setLoading(true);
    const res = await signIn(cleanEmail, password);
    setLoading(false);
    if (res.error) {
      registerFailure();
      setErrorMessage(humanizeAuthError(res.error));
    }
  };

  const handleResend = async () => {
    if (!sentTo?.email || resendRemaining > 0 || loading) return;
    setLoading(true);
    setErrorMessage(null);
    const res =
      sentTo.kind === 'confirm'
        ? await resendConfirmation(sentTo.email)
        : await resetPassword(sentTo.email);
    setLoading(false);
    if (res.error) {
      setErrorMessage(humanizeAuthError(res.error));
    } else {
      setResendAt(Date.now() + 60000);
      setSuccessInfo('Email renvoyé avec succès.');
    }
  };

  const handleDemoAccess = () => {
    setDemoMode(true);
    closeAuthModal();
  };

  const score = passwordScore(password);
  const strengthMeter =
    authModalMode === 'signup' || authModalMode === 'recovery' ? (
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-400">Robustesse du mot de passe</span>
          <span className="font-mono text-neutral-300">{SCORE_LABELS[score]}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                score > idx ? SCORE_COLORS[score] : 'bg-white/[0.08]'
              }`}
            />
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Backdrop sombre et diffus */}
      <div
        onClick={authModalMode !== 'recovery' ? closeAuthModal : undefined}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Cadre modal architectural */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[#07090E] p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.85)] z-10 space-y-5 my-8 overflow-hidden"
      >
        {/* Halo subtil doré supérieur */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-28 bg-[#E5B54F]/10 blur-3xl pointer-events-none rounded-full" />

        {/* Bouton de fermeture discret */}
        {authModalMode !== 'recovery' && (
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Fermer la fenêtre"
            className="absolute right-4 top-4 h-8 w-8 inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* En-tête sobre et hiérarchisé */}
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E5B54F]" />
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#E5B54F]/90 font-medium">
              Djelia Academy
            </p>
          </div>
          <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-white font-serif">
            {authModalMode === 'login' && 'Connexion au Studio'}
            {authModalMode === 'signup' && 'Créer votre Studio'}
            {authModalMode === 'reset' && 'Réinitialiser votre mot de passe'}
            {authModalMode === 'recovery' && 'Nouveau mot de passe'}
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {authModalMode === 'login' && 'Accédez à votre conciergerie IA, vos créations et vos commissions.'}
            {authModalMode === 'signup' && 'Lancez votre studio musical et encaissez vos ventes sans intermédiaire.'}
            {authModalMode === 'reset' && 'Indiquez votre email pour recevoir les instructions de récupération.'}
            {authModalMode === 'recovery' && 'Définissez votre nouveau mot de passe sécurisé pour continuer.'}
          </p>
        </div>

        {/* Sélecteur de méthode (WhatsApp vs Email) : Épuré, sans double étage */}
        {authModalMode !== 'recovery' && authModalMode !== 'reset' && !sentTo && (
          <div className="grid grid-cols-2 rounded-xl bg-white/[0.03] p-1 border border-white/[0.06] gap-1">
            <button
              type="button"
              onClick={() => {
                setMethod('whatsapp');
                setErrorMessage(null);
              }}
              className={`h-9 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all ${
                method === 'whatsapp'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
              <span
                className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                  method === 'whatsapp' ? 'bg-black/10 text-neutral-900 font-bold' : 'bg-[#E5B54F]/15 text-[#F3CA75]'
                }`}
              >
                Rapide
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod('email');
                setErrorMessage(null);
              }}
              className={`h-9 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all ${
                method === 'email'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Email</span>
            </button>
          </div>
        )}

        {/* Messages d'erreur & statut */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/25 bg-rose-500/[0.08] p-3 text-xs text-rose-200 leading-relaxed"
          >
            {errorMessage}
            {needsConfirmation && (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendRemaining > 0}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#F3CA75] hover:text-white disabled:opacity-50"
              >
                <RotateCw className="h-3.5 w-3.5" />
                {resendRemaining > 0 ? `Renvoyer dans ${resendRemaining}s` : 'Renvoyer l\'email de confirmation'}
              </button>
            )}
          </div>
        )}

        {successInfo && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3 text-xs text-emerald-200"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Confirmation envoyée (email confirmation ou mot de passe) */}
        {sentTo && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] text-center space-y-2">
              <MailCheck className="h-8 w-8 text-[#E5B54F] mx-auto" />
              <p className="text-sm font-semibold text-white">Vérifiez votre boîte de réception</p>
              <p className="text-xs text-neutral-400">
                Un message sécurisé a été transmis à <br />
                <span className="font-mono text-white font-medium">{sentTo.email}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resendRemaining > 0}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>{resendRemaining > 0 ? `Renvoyer l'email (${resendRemaining}s)` : 'Renvoyer l\'email'}</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full text-center text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Retour à la connexion
            </button>
          </div>
        )}

        {/* ---------------- CANAL 1 : WHATSAPP OTP (PAR DÉFAUT) ---------------- */}
        {!sentTo && authModalMode !== 'recovery' && authModalMode !== 'reset' && method === 'whatsapp' && (
          <div className="space-y-4">
            {whatsappStep === 'phone' ? (
              <form onSubmit={handleSendWhatsAppCode} className="space-y-4">
                {authModalMode === 'signup' && (
                  <Field id="wa-studio" label="Nom de votre Studio Musical" icon={Building2}>
                    <input
                      id="wa-studio"
                      type="text"
                      required
                      maxLength={60}
                      autoComplete="organization"
                      value={studioName}
                      onChange={(e) => setStudioName(e.target.value)}
                      placeholder="Ex : Studio Sahel Beats"
                      className={inputClass}
                    />
                  </Field>
                )}

                {/* Bloc téléphonique unifié style matériel */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="wa-phone-number" className="font-medium text-neutral-300">
                      Numéro WhatsApp
                    </label>
                    <span className="text-[11px] font-mono text-neutral-500">Sans indicatif</span>
                  </div>

                  <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#0E1015] focus-within:border-[#E5B54F]/70 focus-within:ring-2 focus-within:ring-[#E5B54F]/15 transition-all overflow-hidden h-11">
                    {/* Sélecteur Pays intégré */}
                    <div className="relative h-full flex items-center px-2.5 border-r border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors shrink-0">
                      <select
                        aria-label="Indicatif pays WhatsApp"
                        value={countryPrefix}
                        onChange={(e) => setCountryPrefix(e.target.value)}
                        className="h-full bg-transparent text-xs font-mono font-semibold text-white focus:outline-none appearance-none pr-5 cursor-pointer"
                      >
                        {COUNTRY_PREFIXES.map((c) => (
                          <option key={c.code} value={c.code} className="bg-[#0E1015] text-white">
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                    </div>

                    {/* Champ local */}
                    <div className="relative flex-1 h-full flex items-center">
                      <input
                        id="wa-phone-number"
                        type="tel"
                        required
                        autoComplete="tel"
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value)}
                        placeholder="Ex : 05 77 73 08"
                        className="w-full h-full bg-transparent px-3 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Prévisualisation dynamique discrète */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-neutral-500">Réception immédiate du code à 6 chiffres</span>
                    {phoneLocal.trim() && (
                      <span className="font-mono text-[#F3CA75] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {fullPhone}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || whatsappCooldown > 0}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Transmission en cours…</span>
                    </>
                  ) : whatsappCooldown > 0 ? (
                    <span className="font-mono">Patientez {whatsappCooldown}s</span>
                  ) : (
                    <>
                      <span>Recevoir mon code WhatsApp</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Étape Saisie OTP WhatsApp */
              <form onSubmit={handleVerifyWhatsAppCode} className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#E5B54F]/10 border border-[#E5B54F]/20 flex items-center justify-center text-[#E5B54F]">
                      <Smartphone className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Code expédié au</p>
                      <p className="text-xs font-mono font-bold text-white">{fullPhone}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsappStep('phone')}
                    className="text-xs text-[#E5B54F] hover:text-[#F3CA75] font-medium transition-colors"
                  >
                    Modifier
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="wa-otp-input" className="text-xs font-medium text-neutral-300 block text-center">
                    Saisissez le code à 6 chiffres
                  </label>
                  <input
                    id="wa-otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                    value={whatsappOtp}
                    onChange={(e) => setWhatsappOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full h-12 rounded-xl border border-white/[0.12] bg-[#0E1015] text-center font-mono text-xl tracking-[0.4em] text-white focus:outline-none focus:border-[#E5B54F] focus:ring-2 focus:ring-[#E5B54F]/20 transition-all"
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                    <span>Valide 5 minutes</span>
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppCode()}
                      disabled={loading || whatsappCooldown > 0}
                      className="text-[#E5B54F] hover:text-[#F3CA75] transition-colors disabled:opacity-40 font-mono"
                    >
                      {whatsappCooldown > 0 ? `Renvoyer (${whatsappCooldown}s)` : 'Renvoyer le code'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || whatsappOtp.length !== 6}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Vérification sécurisée…</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmer et entrer au Studio</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Inversion Connexion vs Inscription sous le formulaire */}
            {whatsappStep === 'phone' && (
              <div className="text-center pt-1">
                {authModalMode === 'signup' ? (
                  <p className="text-xs text-neutral-400">
                    Vous avez déjà un studio ?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="font-semibold text-white hover:text-[#F3CA75] underline underline-offset-4 decoration-white/20 transition-colors"
                    >
                      Se connecter
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-neutral-400">
                    Nouveau sur Djelia ?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-semibold text-white hover:text-[#F3CA75] underline underline-offset-4 decoration-white/20 transition-colors"
                    >
                      Créer mon studio
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- CANAL 2 : EMAIL & MOT DE PASSE OU LIEN MAGIQUE ---------------- */}
        {!sentTo && authModalMode !== 'recovery' && authModalMode !== 'reset' && method === 'email' && (
          <div className="space-y-4">
            {emailSubMode === 'magiclink' ? (
              magicLinkSent ? (
                /* Étape validation code reçu par email */
                <form onSubmit={handleVerifyMagicEmailOtp} className="space-y-4">
                  <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-1 text-center">
                    <MailCheck className="h-6 w-6 text-[#E5B54F] mx-auto mb-1" />
                    <p className="text-xs text-white font-medium">Lien et code expédiés à</p>
                    <p className="text-xs font-mono text-[#F3CA75]">{email}</p>
                    <p className="text-[11px] text-neutral-400 pt-1">
                      Cliquez sur le lien reçu par email ou saisissez le code ci-dessous :
                    </p>
                  </div>

                  <Field id="magic-email-otp" label="Code de validation" icon={KeyRound}>
                    <input
                      id="magic-email-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      value={magicEmailOtp}
                      onChange={(e) => setMagicEmailOtp(e.target.value.trim())}
                      placeholder="Ex : 123456"
                      className={`${inputClass} font-mono text-center tracking-widest`}
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={loading || !magicEmailOtp.trim()}
                    className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Valider le code email</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMagicLinkSent(false);
                        setMagicEmailOtp('');
                      }}
                      className="text-xs text-[#E5B54F] hover:underline"
                    >
                      Changer d'email ou renvoyer
                    </button>
                  </div>
                </form>
              ) : (
                /* Sous-mode Envoi Lien Magique */
                <form onSubmit={handleSendMagicLink} className="space-y-4">
                  <Field id="magic-email" label="Adresse email" icon={Mail}>
                    <input
                      id="magic-email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@monstudio.com"
                      className={inputClass}
                    />
                  </Field>

                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Vous recevrez un lien de connexion direct en 1 clic sans mot de passe.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>M'envoyer le lien magique</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setEmailSubMode('password')}
                      className="text-xs text-neutral-400 hover:text-white transition-colors"
                    >
                      Utiliser un mot de passe classique
                    </button>
                  </div>
                </form>
              )
            ) : (
              /* Sous-mode Mot de passe classique */
              <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
                {authModalMode === 'signup' && (
                  <Field id="auth-studio" label="Nom de votre Studio" icon={Building2}>
                    <input
                      id="auth-studio"
                      type="text"
                      required
                      maxLength={60}
                      autoComplete="organization"
                      value={studioName}
                      onChange={(e) => setStudioName(e.target.value)}
                      placeholder="Ex : Studio Sahel Beats"
                      className={inputClass}
                    />
                  </Field>
                )}

                <Field id="auth-email" label="Adresse email professionnelle" icon={Mail}>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@monstudio.com"
                    className={inputClass}
                  />
                </Field>

                <Field
                  id="auth-password"
                  label="Mot de passe"
                  icon={Lock}
                  aside={
                    authModalMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-xs text-[#E5B54F]/90 hover:text-[#F3CA75] transition-colors"
                      >
                        Mot de passe oublié ?
                      </button>
                    )
                  }
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

                {strengthMeter}

                <button
                  type="submit"
                  disabled={loading || lockRemaining > 0}
                  className="w-full mt-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Vérification sécurisée…</span>
                    </>
                  ) : lockRemaining > 0 ? (
                    <span className="font-mono">Réessayez dans {lockRemaining}s</span>
                  ) : (
                    <>
                      <span>{authModalMode === 'signup' ? 'Créer mon studio' : 'Se connecter'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setEmailSubMode('magiclink')}
                    className="text-neutral-400 hover:text-[#F3CA75] transition-colors"
                  >
                    Lien magique sans mot de passe
                  </button>

                  {authModalMode === 'signup' ? (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="font-semibold text-white hover:underline"
                    >
                      Se connecter
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-semibold text-white hover:underline"
                    >
                      Créer un studio
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* ---------------- MODE MOT DE PASSE OUBLIÉ (RESET) ---------------- */}
        {!sentTo && authModalMode === 'reset' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Field id="auth-reset-email" label="Adresse email de votre compte" icon={Mail}>
              <input
                id="auth-reset-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@monstudio.com"
                className={inputClass}
              />
            </Field>

            <button
              type="submit"
              disabled={loading || lockRemaining > 0}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Envoi en cours…</span>
                </>
              ) : (
                <>
                  <span>Envoyer les instructions</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full h-10 inline-flex items-center justify-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Retour à la connexion</span>
            </button>
          </form>
        )}

        {/* ---------------- MODE NOUVEAU MOT DE PASSE (RECOVERY) ---------------- */}
        {authModalMode === 'recovery' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Field id="auth-recovery-password" label="Nouveau mot de passe sécurisé" icon={Lock}>
              <input
                id="auth-recovery-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
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

            <Field id="auth-recovery-confirm" label="Confirmer le mot de passe" icon={KeyRound}>
              <input
                id="auth-recovery-confirm"
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

            {strengthMeter}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Enregistrer le mot de passe</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Pied de page : Garanties de sécurité & Mode Démo */}
        {authModalMode !== 'recovery' && (
          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-neutral-400" /> Chiffrement TLS
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-neutral-400" /> Données isolées RLS
              </span>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleDemoAccess}
                className="text-[11px] text-neutral-400 hover:text-white transition-colors"
              >
                Accéder en mode démonstration sans compte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
