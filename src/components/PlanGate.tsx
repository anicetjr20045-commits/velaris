import { useState, type FC, type ReactNode } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Music2,
  Smartphone,
  Zap,
  CheckCircle2,
  ChevronDown,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { initiateChariowCheckout } from '../services/chariow';

interface PlanGateProps {
  isPro: boolean;
  featureTitle?: string;
  featureDescription?: string;
  onUpgrade?: () => void;
  children: ReactNode;
}

interface CountryInfo {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  region: string;
  operators: string[];
}

const CHARIOW_COUNTRIES: CountryInfo[] = [
  {
    name: 'Burkina Faso',
    code: 'BF',
    dialCode: '+226',
    flag: '🇧🇫',
    region: 'Afrique de l’Ouest',
    operators: ['Orange Money', 'Moov Money'],
  },
  {
    name: 'Côte d’Ivoire',
    code: 'CI',
    dialCode: '+225',
    flag: '🇨🇮',
    region: 'Afrique de l’Ouest',
    operators: ['Wave', 'Orange Money', 'MTN MoMo', 'Moov'],
  },
  {
    name: 'Sénégal',
    code: 'SN',
    dialCode: '+221',
    flag: '🇸🇳',
    region: 'Afrique de l’Ouest',
    operators: ['Wave', 'Orange Money', 'Free Money'],
  },
  {
    name: 'Cameroun',
    code: 'CM',
    dialCode: '+237',
    flag: '🇨🇲',
    region: 'Afrique Centrale',
    operators: ['MTN MoMo', 'Orange Money'],
  },
  {
    name: 'Mali',
    code: 'ML',
    dialCode: '+223',
    flag: '🇲🇱',
    region: 'Afrique de l’Ouest',
    operators: ['Orange Money', 'Moov Africa'],
  },
  {
    name: 'Bénin',
    code: 'BJ',
    dialCode: '+229',
    flag: '🇧🇯',
    region: 'Afrique de l’Ouest',
    operators: ['MTN MoMo', 'Moov Money'],
  },
  {
    name: 'Togo',
    code: 'TG',
    dialCode: '+228',
    flag: '🇹🇬',
    region: 'Afrique de l’Ouest',
    operators: ['T-Money', 'Moov Money'],
  },
  {
    name: 'Gabon',
    code: 'GA',
    dialCode: '+241',
    flag: '🇬🇦',
    region: 'Afrique Centrale',
    operators: ['Airtel Money', 'Moov Money'],
  },
  {
    name: 'Congo',
    code: 'CG',
    dialCode: '+242',
    flag: '🇨🇬',
    region: 'Afrique Centrale',
    operators: ['MTN MoMo', 'Airtel Money'],
  },
  {
    name: 'RDC Kinshasa',
    code: 'CD',
    dialCode: '+243',
    flag: '🇨🇩',
    region: 'Afrique Centrale',
    operators: ['M-Pesa', 'Orange Money', 'Airtel'],
  },
  {
    name: 'Guinée',
    code: 'GN',
    dialCode: '+224',
    flag: '🇬🇳',
    region: 'Afrique de l’Ouest',
    operators: ['Orange Money', 'MTN'],
  },
  {
    name: 'France & Diaspora',
    code: 'FR',
    dialCode: '+33',
    flag: '🇫🇷',
    region: 'Diaspora',
    operators: ['Carte Bancaire', 'Apple Pay'],
  },
  {
    name: 'International',
    code: 'US',
    dialCode: '+1',
    flag: '🌍',
    region: 'International',
    operators: ['Carte Bancaire Visa / Mastercard'],
  },
];

export const PlanGate: FC<PlanGateProps> = ({
  isPro,
  featureDescription,
  children,
}) => {
  const { user, openAuthModal } = useAuth();

  // Détecter indicatif par défaut depuis profil utilisateur
  const userPhone = String(user?.user_metadata?.phone || '');
  const detectedCountry = CHARIOW_COUNTRIES.find((c) =>
    userPhone.startsWith(c.dialCode.replace('+', '')) || userPhone.startsWith(c.dialCode)
  ) || CHARIOW_COUNTRIES[0];

  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(detectedCountry);
  const [phoneNumber, setPhoneNumber] = useState<string>(() => {
    if (userPhone) {
      const clean = userPhone.replace(/\D/g, '');
      const prefix = detectedCountry.dialCode.replace(/\D/g, '');
      return clean.startsWith(prefix) ? clean.slice(prefix.length) : clean;
    }
    return '';
  });
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (isPro) {
    return <>{children}</>;
  }

  const handleCheckout = async () => {
    if (!user) {
      openAuthModal('signup');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const cleanDigits = phoneNumber.replace(/\D/g, '');
      const fullPhone = `${selectedCountry.dialCode.replace('+', '')}${cleanDigits}`;

      const res = await initiateChariowCheckout({
        userId: user.id,
        email: user.email || '',
        fullName:
          (user.user_metadata?.studio_name as string) ||
          (user.user_metadata?.full_name as string) ||
          'Créateur Djelia',
        phone: fullPhone,
        countryCode: selectedCountry.code,
        redirectUrl: `${window.location.origin}/studio?payment=success&sale_id={sale_id}`,
      });

      if (res.success && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
      } else {
        setErrorMsg(res.error || 'Impossible d\'initialiser le paiement Chariow.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Passerelle temporairement indisponible.');
      setLoading(false);
    }
  };

  return (
    <div className="py-6 sm:py-10 px-4 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* 1. HERO HEADER DE VENTE */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#E5B54F]/10 border border-[#E5B54F]/30 text-xs sm:text-sm font-mono tracking-wider uppercase text-[#F5D060] font-semibold shadow-[0_0_20px_rgba(245,208,96,0.15)]">
          <Sparkles className="h-4 w-4" />
          <span>Pass Créateur Djelia Academy</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-heading font-black text-white tracking-tight leading-tight">
          Activez Votre Studio Musical IA & WhatsApp 24/7
        </h1>

        <p className="text-base sm:text-lg text-[#CBD2E1] leading-relaxed">
          {featureDescription ||
            'Débloquez l’accès complet à l’Atelier de composition, à votre vendeur automatique WhatsApp et à 30 crédits de production musicale pour seulement 4 900 F CFA par mois.'}
        </p>
      </div>

      {/* 2. GRILLE CENTRALE : LES 4 PILIERS DU PASS & MODULE DE PAIEMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Colonne Gauche : Les 4 Piliers Débloqués (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl bg-[#0D0E15] border border-white/[0.1] p-7 space-y-6 shadow-[0_15px_40px_rgba(0,0,0,0.4)]">
            <h3 className="text-xs sm:text-sm font-mono uppercase tracking-widest text-[#F5D060] flex items-center gap-2.5 font-bold">
              <ShieldCheck className="h-5 w-5" />
              <span>Inclus immédiatement dans votre Pass (4 900 F CFA / 30 jours)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#08090E] border border-white/[0.08] p-5 space-y-2.5">
                <div className="flex items-center gap-3 text-white font-bold text-base">
                  <div className="h-10 w-10 rounded-xl bg-[#E5B54F]/15 border border-[#E5B54F]/30 flex items-center justify-center text-[#F5D060]">
                    <Music2 className="h-5 w-5" />
                  </div>
                  <span>30 Crédits Chansons IA</span>
                </div>
                <p className="text-xs sm:text-sm text-[#BAC0D4] leading-relaxed">
                  Composez 30 chansons complètes avec vos paroles et 2 versions MP3 HD livrables à vos clients.
                </p>
              </div>

              <div className="rounded-2xl bg-[#08090E] border border-white/[0.08] p-5 space-y-2.5">
                <div className="flex items-center gap-3 text-white font-bold text-base">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <span>Ligne WhatsApp 24/7</span>
                </div>
                <p className="text-xs sm:text-sm text-[#BAC0D4] leading-relaxed">
                  Connexion instantanée de votre numéro via QR code. Réponses et relances automatiques jour et nuit.
                </p>
              </div>

              <div className="rounded-2xl bg-[#08090E] border border-white/[0.08] p-5 space-y-2.5">
                <div className="flex items-center gap-3 text-white font-bold text-base">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Zap className="h-5 w-5" />
                  </div>
                  <span>Moteur Suno V6 Intégré</span>
                </div>
                <p className="text-xs sm:text-sm text-[#BAC0D4] leading-relaxed">
                  Génération en 15 secondes : Afrobeat, Coupé Décalé, Amapiano, Zouglou, R&B, Rumba et Gospel.
                </p>
              </div>

              <div className="rounded-2xl bg-[#08090E] border border-white/[0.08] p-5 space-y-2.5">
                <div className="flex items-center gap-3 text-white font-bold text-base">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <span>Site Personnalisé & Affiliation 50%</span>
                </div>
                <p className="text-xs sm:text-sm text-[#BAC0D4] leading-relaxed">
                  Votre vitrine officielle à vos couleurs et 600 F CFA reversés sur chaque commande.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-[#BAC0D4]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Sans engagement de durée</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Zéro prélèvement automatique forcé</span>
              </span>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Module de Paiement Mobile Money Chariow (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl bg-[#0D0E15] border border-[#F5D060]/40 p-7 space-y-6 shadow-[0_0_50px_-10px_rgba(245,208,96,0.25)] relative overflow-hidden">
            {/* Glow décoratif */}
            <div className="absolute top-0 right-0 w-44 h-24 bg-[#F5D060]/15 blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/[0.1] pb-5">
              <div>
                <span className="text-xs font-mono tracking-wider uppercase text-[#F5D060] font-bold">
                  Abonnement Mensuel
                </span>
                <h4 className="text-xl font-heading font-extrabold text-white">Pass Créateur 30 Jours</h4>
              </div>
              <div className="text-right">
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-[#F5D060]">4 900 F</div>
                <div className="text-xs text-[#BAC0D4]">CFA / mois (≈ 7,50 €)</div>
              </div>
            </div>

            {/* SÉLECTEUR DE PAYS AVEC DRAPEAUX */}
            <div className="space-y-2 relative">
              <label className="block text-xs sm:text-sm font-semibold text-[#D2D7E5]">
                Votre pays de paiement (Afrique de l'Ouest & Centrale) :
              </label>

              <button
                type="button"
                onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                className="w-full h-13 px-4 rounded-2xl bg-[#08090E] border border-white/[0.15] hover:border-[#F5D060]/60 flex items-center justify-between text-left text-base text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="text-2xl leading-none">{selectedCountry.flag}</span>
                  <span className="font-semibold truncate">{selectedCountry.name}</span>
                  <span className="text-xs sm:text-sm font-mono text-[#A0A5B5]">({selectedCountry.dialCode})</span>
                </div>
                <ChevronDown className="h-5 w-5 text-[#A0A5B5] shrink-0" />
              </button>

              {/* Menu Déroulant des Pays avec drapeaux */}
              {isCountryDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto rounded-2xl bg-[#090A10] border border-white/[0.18] shadow-2xl z-50 p-2 space-y-1 divide-y divide-white/[0.06]">
                  {CHARIOW_COUNTRIES.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(country);
                        setIsCountryDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-3 rounded-xl flex items-center justify-between text-left text-sm transition-colors cursor-pointer ${
                        selectedCountry.code === country.code
                          ? 'bg-[#F5D060]/20 text-[#F5D060] font-bold'
                          : 'text-[#D0D4E0] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-xl">{country.flag}</span>
                        <span className="font-semibold">{country.name}</span>
                        <span className="font-mono text-xs text-[#A0A5B5]">{country.dialCode}</span>
                      </div>
                      <span className="text-xs font-mono text-[#A0A5B5] shrink-0 truncate max-w-[130px] text-right font-medium">
                        {country.operators[0]}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Opérateurs disponibles pour le pays sélectionné */}
              <div className="flex flex-wrap gap-2 pt-1.5">
                {selectedCountry.operators.map((op) => (
                  <span
                    key={op}
                    className="inline-flex items-center text-xs font-mono px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[#BAC0D4] font-medium"
                  >
                    {op}
                  </span>
                ))}
              </div>
            </div>

            {/* SAISIE DU NUMÉRO DE TÉLÉPHONE */}
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-[#D2D7E5]">
                Numéro Mobile Money (Wave, Orange, Moov, MTN) :
              </label>
              <div className="flex items-center rounded-2xl bg-[#08090E] border border-white/[0.15] focus-within:border-[#F5D060] transition-all overflow-hidden">
                <span className="px-4 text-sm font-mono text-[#CBD2E1] bg-white/[0.04] border-r border-white/[0.1] h-13 flex items-center font-bold">
                  {selectedCountry.dialCode}
                </span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="ex: 70 00 00 00"
                  className="flex-1 h-13 px-4 bg-transparent text-base text-white placeholder-[#606575] focus:outline-none font-mono"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs sm:text-sm text-red-400">
                {errorMsg}
              </div>
            )}

            {/* BOUTON D'ACTION PRINCIPAL CHARIOW */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                className="w-full h-14 inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 disabled:opacity-60 text-[#0A0A0F] font-bold text-base transition-all duration-200 cursor-pointer shadow-[0_0_30px_rgba(245,208,96,0.4)] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Redirection Chariow…</span>
                  </>
                ) : (
                  <>
                    <span>Activer mon Pass (4 900 F CFA)</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

              <p className="text-xs text-center text-[#BAC0D4] leading-relaxed">
                Paiement instantané et sécurisé par Chariow. Accès immédiat et déblocage de vos 30 crédits dès validation.
              </p>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.setItem('velaris_preview_mode', 'true');
                      localStorage.setItem('velaris_preview_mode', 'true');
                    } catch {}
                    window.location.reload();
                  }}
                  className="text-xs font-semibold text-[#CBD2E1] hover:text-[#F5D060] underline decoration-white/20 transition-colors cursor-pointer"
                >
                  Aperçu direct (Mode Démo / Créateur) →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
