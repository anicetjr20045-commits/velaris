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
  { code: '+225', name: 'Côte d\'Ivoire (+225)' },
  { code: '+226', name: 'Burkina Faso (+226)' },
  { code: '+221', name: 'Sénégal (+221)' },
  { code: '+237', name: 'Cameroun (+237)' },
  { code: '+223', name: 'Mali (+223)' },
  { code: '+228', name: 'Togo (+228)' },
  { code: '+229', name: 'Bénin (+229)' },
  { code: '+224', name: 'Guinée (+224)' },
  { code: '+33', name: 'France (+33)' },
  { code: '+1', name: 'USA / Canada (+1)' },
  { code: '+', name: 'Autre pays (+)' },
];

const SCORE_LABELS = ['Trop court', 'Faible', 'Correct', 'Solide', 'Excellent'];
const SCORE_COLORS = ['bg-white/[0.12]', 'bg-rose-500', 'bg-amber-400', 'bg-[#E5B54F]', 'bg-emerald-400'];

const inputClass =
  'w-full rounded-xl border border-white/[0.08] bg-[#0E1015] pl-10 pr-3 h-11 text-sm text-white placeholder-neutral-600 focus:border-[#E5B54F]/60 focus:outline-none focus:ring-2 focus:ring-[#E5B54F]/15 transition-[border-color,box-shadow] duration-200 ease-luxury';

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

type AuthChannel = 'whatsapp' | 'magiclink' | 'password';

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
    resendConfirmation
  } = useAuth();

  // Canal d'authentification principal (WhatsApp par défaut pour maximiser la conversion africaine)
  const [channel, setChannel] = useState<AuthChannel>('whatsapp');

  // Champs partagés
  const [studioName, setStudioName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // État WhatsApp OTP
  const [countryPrefix, setCountryPrefix] = useState('+225');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [whatsappStep, setWhatsappStep] = useState<'phone' | 'otp'>('phone');
  const [whatsappOtp, setWhatsappOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [whatsappCooldown, setWhatsappCooldown] = useState(0);

  // État Lien Magique
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicEmailOtp, setMagicEmailOtp] = useState('');

  // État Mot de passe classique
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  // Compteur d'horloge pour verrouillage et cooldown WhatsApp
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      setWhatsappCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Échap pour fermer + reset
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

  const fullPhone = countryPrefix === '+'
    ? (phoneLocal.startsWith('+') ? phoneLocal : `+${phoneLocal}`)
    : `${countryPrefix}${phoneLocal.replace(/^0+/, '')}`;

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
      setErrorMessage('Numéro WhatsApp trop court. Vérifiez l\'indicatif et le numéro.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    const res = await sendWhatsAppOtp(fullPhone);
    setLoading(false);
    if (!res.success || !res.challengeToken) {
      setErrorMessage(res.error || 'Impossible d\'envoyer le code WhatsApp.');
    } else {
      setChallengeToken(res.challengeToken);
      setWhatsappStep('otp');
      setWhatsappCooldown(60);
      setSuccessInfo(`Code de sécurité envoyé sur votre WhatsApp au ${fullPhone}`);
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

    const res = await verifyWhatsAppOtp(fullPhone, whatsappOtp.trim(), challengeToken, studioName);
    setLoading(false);
    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessInfo('Connexion réussie.');
    }
  };

  // 3. Envoi Lien Magique Email
  const handleSendMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    const clean = magicEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setErrorMessage('Veuillez entrer une adresse email valide.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    const res = await signInWithMagicLink(clean);
    setLoading(false);
    if (res.error) {
      setErrorMessage(humanizeAuthError(res.error));
    } else {
      setMagicLinkSent(true);
      setSuccessInfo('Lien magique et code de confirmation envoyés à votre adresse email.');
    }
  };

  // 4. Validation OTP Email (pour ceux qui tapent le code reçu au lieu de cliquer sur le lien)
  const handleVerifyEmailOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!magicEmailOtp.trim()) {
      setErrorMessage('Veuillez saisir le code reçu par email.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    const res = await verifyEmailOtp(magicEmail.trim(), magicEmailOtp.trim());
    setLoading(false);
    if (res.error) {
      setErrorMessage(humanizeAuthError(res.error));
    }
  };

  // 5. Soumission Mot de passe classique
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
        setSuccessInfo('Mot de passe mis à jour. Vous êtes maintenant connecté.');
        setTimeout(closeAuthModal, 1500);
      }
      return;
    }

    if (authModalMode === 'login') {
      setLoading(true);
      const res = await signIn(cleanEmail, password);
      setLoading(false);
      if (res.error) {
        registerFailure();
        const msg = humanizeAuthError(res.error);
        setErrorMessage(msg);
        if (res.error.toLowerCase().includes('email not confirmed')) {
          setNeedsConfirmation(true);
          setResendAt(Date.now() + 30000);
        }
      } else {
        setFailedAttempts(0);
      }
    } else if (authModalMode === 'signup') {
      const name = studioName.replace(/[<>]/g, '').trim().slice(0, 60);
      setLoading(true);
      const res = await signUp(cleanEmail, password, name);
      setLoading(false);
      if (res.error) {
        setErrorMessage(humanizeAuthError(res.error));
      } else if (res.requiresEmailConfirmation) {
        setSentTo({ email: cleanEmail, kind: 'confirm' });
        setResendAt(Date.now() + 60000);
      }
    }
  };

  const handleResend = async () => {
    if (loading || resendRemaining > 0 || !sentTo) return;
    setLoading(true);
    setErrorMessage(null);
    const res = await resendConfirmation(sentTo.email);
    setLoading(false);
    if (res.error) {
      setErrorMessage(humanizeAuthError(res.error));
    } else {
      setResendAt(Date.now() + 60000);
      setSuccessInfo('Nouvel email envoyé avec succès.');
    }
  };

  const handleDemoAccess = () => {
    setDemoMode(true);
    closeAuthModal();
  };

  const score = passwordScore(password);

  const strengthMeter = authModalMode === 'signup' && channel === 'password' && password && (
    <div className="space-y-1.5 pt-1">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-neutral-500">Sécurité du mot de passe</span>
        <span className="font-medium text-neutral-400">{SCORE_LABELS[score]}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-colors duration-200 ${
              score > idx ? SCORE_COLORS[score] : 'bg-white/[0.08]'
            }`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Arrière-plan flouté */}
      <div
        onClick={() => authModalMode !== 'recovery' && closeAuthModal()}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Conteneur de modal épuré Dark Luxury */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0A0A0F] p-6 sm:p-7 shadow-2xl z-10 space-y-5 my-8 transition-transform duration-300"
      >
        {/* Bouton de fermeture */}
        {authModalMode !== 'recovery' && (
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Fermer la fenêtre"
            className="absolute right-4 top-4 h-9 w-9 inline-flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* En-tête */}
        <div className="space-y-1.5 pr-8">
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#E5B54F]">
            Djelia Academy
          </p>
          <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-white font-serif">
            {authModalMode === 'login' && 'Connexion à votre Studio'}
            {authModalMode === 'signup' && 'Lancer votre Studio Musical'}
            {authModalMode === 'reset' && 'Réinitialiser votre mot de passe'}
            {authModalMode === 'recovery' && 'Nouveau mot de passe'}
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {authModalMode === 'login' && 'Accédez à votre conciergerie IA, vos créations et vos commissions.'}
            {authModalMode === 'signup' && 'Rejoignez l\'académie et configurez votre vendeur WhatsApp 24/7.'}
            {authModalMode === 'reset' && 'Entrez votre email pour recevoir les instructions.'}
            {authModalMode === 'recovery' && 'Définissez votre nouveau mot de passe sécurisé.'}
          </p>
        </div>

        {/* Onglets Connexion vs Inscription */}
        {authModalMode !== 'recovery' && authModalMode !== 'reset' && !sentTo && (
          <div className="grid grid-cols-2 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
            {(['signup', 'login'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchMode(mode)}
                className={`h-9 text-xs font-semibold rounded-lg transition-all ${
                  authModalMode === mode
                    ? 'bg-white text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {mode === 'signup' ? 'Créer mon studio' : 'Se connecter'}
              </button>
            ))}
          </div>
        )}

        {/* Sélecteur de canal d'authentification */}
        {authModalMode !== 'recovery' && authModalMode !== 'reset' && !sentTo && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
              Mode de connexion sécurisée
            </p>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => { setChannel('whatsapp'); setErrorMessage(null); }}
                className={`py-2 px-2 rounded-lg text-xs font-medium inline-flex flex-col items-center justify-center gap-1 transition-all ${
                  channel === 'whatsapp'
                    ? 'bg-white/[0.10] text-[#F3CA75] border border-[#E5B54F]/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span className="text-[11px] font-semibold">WhatsApp</span>
                <span className="text-[9px] font-mono uppercase text-[#E5B54F]">Rapide</span>
              </button>

              <button
                type="button"
                onClick={() => { setChannel('magiclink'); setErrorMessage(null); }}
                className={`py-2 px-2 rounded-lg text-xs font-medium inline-flex flex-col items-center justify-center gap-1 transition-all ${
                  channel === 'magiclink'
                    ? 'bg-white/[0.10] text-[#F3CA75] border border-[#E5B54F]/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <MailCheck className="h-4 w-4" />
                <span className="text-[11px] font-semibold">Lien Magique</span>
                <span className="text-[9px] font-mono uppercase text-neutral-500">Sans MDP</span>
              </button>

              <button
                type="button"
                onClick={() => { setChannel('password'); setErrorMessage(null); }}
                className={`py-2 px-2 rounded-lg text-xs font-medium inline-flex flex-col items-center justify-center gap-1 transition-all ${
                  channel === 'password'
                    ? 'bg-white/[0.10] text-white border border-white/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span className="text-[11px] font-semibold">Classique</span>
                <span className="text-[9px] font-mono uppercase text-neutral-500">Mot de passe</span>
              </button>
            </div>
          </div>
        )}

        {/* Messages d'erreur & succès */}
        {errorMessage && (
          <div role="alert" className="vx-fade-in rounded-xl border border-rose-500/25 bg-rose-500/[0.08] p-3 text-xs text-rose-200 leading-relaxed">
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
          <div role="status" className="vx-fade-in flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3 text-xs text-emerald-200">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* ---------------- CANAL 1 : WHATSAPP OTP ---------------- */}
        {authModalMode !== 'recovery' && authModalMode !== 'reset' && channel === 'whatsapp' && (
          <div className="space-y-4">
            {whatsappStep === 'phone' ? (
              <form onSubmit={handleSendWhatsAppCode} className="space-y-4">
                {authModalMode === 'signup' && (
                  <Field id="wa-studio" label="Nom de votre Studio" icon={Building2}>
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

                <div className="space-y-1.5">
                  <label htmlFor="wa-phone-number" className="text-xs font-medium text-neutral-300">
                    Numéro WhatsApp actif
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-36 shrink-0">
                      <select
                        aria-label="Indicatif pays WhatsApp"
                        value={countryPrefix}
                        onChange={(e) => setCountryPrefix(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#0E1015] px-2.5 text-xs text-white focus:border-[#E5B54F]/60 focus:outline-none appearance-none cursor-pointer"
                      >
                        {COUNTRY_PREFIXES.map((c) => (
                          <option key={c.code} value={c.code} className="bg-[#141420] text-white">
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                    </div>

                    <div className="relative flex-1">
                      <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
                      <input
                        id="wa-phone-number"
                        type="tel"
                        required
                        autoComplete="tel"
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value)}
                        placeholder="Ex : 07 12 34 56 78"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Un code sécurisé à 6 chiffres vous sera expédié sur WhatsApp.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || whatsappCooldown > 0}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Envoi en cours sur WhatsApp…</span>
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
              <form onSubmit={handleVerifyWhatsAppCode} className="space-y-4 vx-fade-in">
                <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#F3CA75]" />
                    <span className="font-mono text-white">{fullPhone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsappStep('phone')}
                    className="text-[11px] font-semibold text-[#E5B54F] hover:underline"
                  >
                    Modifier
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="wa-otp-input" className="text-xs font-medium text-neutral-300">
                    Saisissez le code à 6 chiffres reçu
                  </label>
                  <input
                    id="wa-otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={whatsappOtp}
                    onChange={(e) => setWhatsappOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full h-12 rounded-xl border border-[#E5B54F]/40 bg-[#0E1015] text-center font-mono text-xl tracking-[0.4em] text-white focus:outline-none focus:ring-2 focus:ring-[#E5B54F]/20"
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                    <span>Valable 5 minutes</span>
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppCode()}
                      disabled={loading || whatsappCooldown > 0}
                      className="text-[#E5B54F] hover:underline disabled:opacity-50"
                    >
                      {whatsappCooldown > 0 ? `Renvoyer (${whatsappCooldown}s)` : 'Renvoyer le code'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || whatsappOtp.length !== 6}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Vérification sécurisée…</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmer et accéder au Studio</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ---------------- CANAL 2 : LIEN MAGIQUE EMAIL ---------------- */}
        {authModalMode !== 'recovery' && authModalMode !== 'reset' && channel === 'magiclink' && (
          <div className="space-y-4">
            {!magicLinkSent ? (
              <form onSubmit={handleSendMagicLink} className="space-y-4">
                {authModalMode === 'signup' && (
                  <Field id="magic-studio" label="Nom de votre Studio" icon={Building2}>
                    <input
                      id="magic-studio"
                      type="text"
                      maxLength={60}
                      value={studioName}
                      onChange={(e) => setStudioName(e.target.value)}
                      placeholder="Ex : Studio Sahel Beats"
                      className={inputClass}
                    />
                  </Field>
                )}

                <Field id="magic-email" label="Votre adresse email" icon={Mail}>
                  <input
                    id="magic-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className={inputClass}
                  />
                </Field>

                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Vous recevrez un lien de connexion direct en 1 clic. Aucun mot de passe requis.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Envoi en cours…</span>
                    </>
                  ) : (
                    <>
                      <span>M'envoyer le lien de connexion</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailOtp} className="space-y-4 vx-fade-in">
                <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white break-all">{magicEmail}</span>
                    <button
                      type="button"
                      onClick={() => setMagicLinkSent(false)}
                      className="text-[11px] font-semibold text-[#E5B54F] hover:underline"
                    >
                      Modifier
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Cliquez sur le lien dans votre boîte mail ou saisissez ci-dessous le code à 6 chiffres reçu :
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="magic-otp-input" className="text-xs font-medium text-neutral-300">
                    Code de confirmation reçu par email
                  </label>
                  <input
                    id="magic-otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={magicEmailOtp}
                    onChange={(e) => setMagicEmailOtp(e.target.value)}
                    placeholder="Ex : 123456"
                    className="w-full h-12 rounded-xl border border-white/[0.12] bg-[#0E1015] text-center font-mono text-lg text-white focus:outline-none focus:border-[#E5B54F]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !magicEmailOtp.trim()}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Valider le code</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ---------------- CANAL 3 : MOT DE PASSE CLASSIQUE ---------------- */}
        {(channel === 'password' || authModalMode === 'recovery' || authModalMode === 'reset') && (
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

            {authModalMode !== 'recovery' && (
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
              className="w-full mt-2 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50"
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
                className="w-full h-11 inline-flex items-center justify-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </button>
            )}
          </form>
        )}

        {/* Garanties + accès démo */}
        {authModalMode !== 'recovery' && (
          <div className="pt-4 border-t border-white/[0.08] space-y-3">
            <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-neutral-500">
              <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Chiffrement TLS</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Données isolées RLS</span>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleDemoAccess}
                className="min-h-[44px] text-xs font-medium text-neutral-300 hover:text-white underline underline-offset-4 decoration-white/[0.12] hover:decoration-[#E5B54F] transition-colors"
              >
                Explorer la plateforme en mode démo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
