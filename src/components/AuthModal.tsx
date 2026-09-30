import { useState, type FC, type FormEvent } from 'react';
import { X, Mail, Lock, Building2, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const AuthModal: FC = () => {
  const { authModalOpen, authModalMode, closeAuthModal, openAuthModal, signIn, signUp, setDemoMode } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studioName, setStudioName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);
    setLoading(true);

    if (authModalMode === 'login') {
      const res = await signIn(email, password);
      if (res.error) {
        setErrorMessage(res.error);
        setLoading(false);
      } else {
        setLoading(false);
      }
    } else {
      const res = await signUp(email, password, studioName);
      if (res.error) {
        setErrorMessage(res.error);
        setLoading(false);
      } else if (res.requiresEmailConfirmation) {
        setSuccessInfo('Compte créé avec succès. Vérifiez vos emails pour confirmer votre adresse.');
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleDemoAccess = () => {
    setDemoMode(true);
    closeAuthModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0d11] shadow-2xl p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/[0.03] blur-3xl pointer-events-none" />

        {/* Header with Close */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/[0.04]">
                <ShieldCheck className="h-3 w-3 text-white" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                Espace Studio Sécurisé
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {authModalMode === 'login' ? 'Connexion à votre Studio' : 'Créer votre Studio OS'}
            </h2>
            <p className="text-xs text-neutral-400">
              {authModalMode === 'login'
                ? 'Accédez à votre cockpit privé, vos ventes et vos lignes WhatsApp.'
                : 'Isolation totale de vos clients, automatisations et encaissements.'}
            </p>
          </div>

          <button
            onClick={closeAuthModal}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-white/[0.03] p-1 border border-white/[0.04]">
          <button
            type="button"
            onClick={() => {
              openAuthModal('login');
              setErrorMessage(null);
              setSuccessInfo(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              authModalMode === 'login'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => {
              openAuthModal('signup');
              setErrorMessage(null);
              setSuccessInfo(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              authModalMode === 'signup'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Créer un studio
          </button>
        </div>

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {successInfo && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {successInfo}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authModalMode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-neutral-300">
                Nom de votre Studio ou Entreprise
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder="Ex: Studio Mélodie Sahel"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#121318] pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-neutral-300">
              Adresse email professionnelle
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@monstudio.com"
                className="w-full rounded-xl border border-white/[0.08] bg-[#121318] pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-neutral-300">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/[0.08] bg-[#121318] pl-9 pr-10 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-neutral-500 hover:text-neutral-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Chargement...</span>
              </>
            ) : (
              <>
                <span>{authModalMode === 'login' ? 'Accéder à mon espace' : 'Créer mon studio'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Demo Mode Fallback Footer */}
        <div className="pt-2 border-t border-white/[0.06] text-center space-y-2">
          <p className="text-[11px] text-neutral-400">
            Vous souhaitez simplement explorer le logiciel ?
          </p>
          <button
            type="button"
            onClick={handleDemoAccess}
            className="text-xs font-medium text-neutral-300 hover:text-white underline underline-offset-4 transition-colors"
          >
            Continuer en mode démonstration
          </button>
        </div>
      </div>
    </div>
  );
};
