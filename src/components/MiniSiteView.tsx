import { useEffect, useState, type FC } from 'react';
import {
  Music2,
  Play,
  Pause,
  ShieldCheck,
  Check,
  ArrowRight,
  Sparkles,
  Smartphone,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../services/supabase';

interface StudioData {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  bio?: string | null;
  photo_url?: string | null;
  accent_color?: string | null;
  accepted_payments?: string[] | null;
  music_styles?: string[] | null;
  price_quoted_standard?: number | null;
}

interface MiniSiteViewProps {
  slug: string;
  onReturnToHome?: () => void;
}

const SAMPLE_DEMOS = [
  {
    title: 'Anniversaire & Amour — Pour Mariam',
    style: 'Afro-Love Acoustique',
    duration: '2:45',
    audioUrl: 'https://waha.velarisagent.life/qr/assets/vocal_procedure_soeur.opus'
  },
  {
    title: 'Mariage & Bénédiction — Amadou & Fatou',
    style: 'Zouk Doux & Guitare',
    duration: '3:10',
    audioUrl: 'https://waha.velarisagent.life/qr/assets/vocal_commande_soeur.opus'
  }
];

export const MiniSiteView: FC<MiniSiteViewProps> = ({ slug, onReturnToHome }) => {
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStudio() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('studios')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (isMounted) {
          if (data && !error) {
            setStudio(data as StudioData);
          } else {
            // Fallback studio généré proprement si la table ou le slug n'existe pas encore
            setStudio({
              id: 'mock-id',
              user_id: 'mock-user',
              name: `Studio ${slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
              slug,
              bio: 'Création de chansons personnalisées émouvantes pour vos mariages, anniversaires et déclarations d\'amour en Afrique.',
              accent_color: '#D4A017',
              accepted_payments: ['Wave', 'Orange Money', 'MTN'],
              music_styles: ['Afrobeat', 'Zouk', 'Acoustique', 'Gospel'],
              price_quoted_standard: 2000
            });
          }
        }
      } catch {
        if (isMounted) {
          setStudio({
            id: 'mock-id',
            user_id: 'mock-user',
            name: `Studio ${slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
            slug,
            bio: 'Création de chansons personnalisées émouvantes pour vos événements.',
            accent_color: '#D4A017',
            accepted_payments: ['Wave', 'Orange Money'],
            music_styles: ['Afrobeat', 'Zouk', 'Acoustique'],
            price_quoted_standard: 2000
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStudio();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const initials = ((studio?.name || 'Studio').slice(0, 2)).toUpperCase();
  const accentColor = studio?.accent_color || '#D4A017';
  const price = studio?.price_quoted_standard || 2000;

  const handleOrderClick = () => {
    // Redirection vers le checkout central Chariow avec tracking d'affiliation du membre
    const targetUrl = studio?.user_id && studio.user_id !== 'mock-user'
      ? `https://djelia.store/?ref=${studio.user_id.slice(0, 8)}`
      : 'https://djelia.store';
    window.location.href = targetUrl;
  };

  const handleTogglePlay = (index: number) => {
    setPlayingIndex(prev => (prev === index ? null : index));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center space-y-3 font-sans">
        <div className="h-10 w-10 rounded-full border-2 border-white/10 border-t-[#D4A017] animate-spin" />
        <p className="font-mono text-xs text-[#8E94A3] tracking-widest uppercase">
          Chargement du studio…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0F0F5] font-sans selection:bg-[#D4A017]/30 selection:text-white">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#12121A]/85 border-b border-white/[0.08] backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onReturnToHome && (
            <button
              onClick={onReturnToHome}
              className="p-1.5 rounded-lg text-[#8E94A3] hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Retour à l'accueil"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[#0A0A0F] font-heading font-black text-xs"
              style={{ backgroundColor: accentColor }}
            >
              {initials[0]}
            </div>
            <span className="font-heading font-bold text-sm tracking-tight text-white uppercase">
              {studio?.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3" />
            Atelier Certifié Djelia
          </span>
          <button
            onClick={handleOrderClick}
            className="h-9 px-4 rounded-full font-semibold text-xs text-[#0A0A0F] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            <span>Commander</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-8 pt-12 pb-16 max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#8E94A3]">
          <Sparkles className="h-3.5 w-3.5 text-[#D4A017]" />
          <span>Musique Personnalisée & Paroles Uniques</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight leading-tight">
            Offrez une chanson qui touche le cœur, signée{' '}
            <span style={{ color: accentColor }}>{studio?.name}</span>
          </h1>
          <p className="text-sm sm:text-base text-[#8E94A3] max-w-2xl mx-auto leading-relaxed">
            {studio?.bio}
          </p>
        </div>

        {/* Badges de Styles Musicaux */}
        {studio?.music_styles && studio.music_styles.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {studio.music_styles.map(style => (
              <span
                key={style}
                className="px-3 py-1 rounded-full text-xs font-medium bg-[#141420] border border-white/[0.08] text-neutral-300"
              >
                {style}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Section Écoute / Démo Tracks */}
      <section className="px-4 sm:px-8 py-10 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-[#D4A017]" />
            <h2 className="text-base font-heading font-semibold text-white">Extraits de nos Créations</h2>
          </div>
          <span className="text-xs text-[#8E94A3] font-mono">Qualité Studio 24-bit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SAMPLE_DEMOS.map((demo, idx) => {
            const isPlaying = playingIndex === idx;
            return (
              <div
                key={demo.title}
                className="p-4 rounded-2xl bg-[#141420] border border-white/[0.08] hover:border-[#D4A017]/40 transition-all flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    onClick={() => handleTogglePlay(idx)}
                    className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-[#0A0A0F] transition-transform group-hover:scale-105 cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                    aria-label={isPlaying ? 'Pause' : 'Lecture'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{demo.title}</div>
                    <div className="text-xs text-[#8E94A3] truncate">{demo.style}</div>
                  </div>
                </div>

                <span className="text-xs font-mono text-[#8E94A3] shrink-0">{demo.duration}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section Offre & Commande */}
      <section className="px-4 sm:px-8 py-12 max-w-4xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-b from-[#141420] to-[#0D0D15] border border-white/[0.1] p-6 sm:p-10 space-y-8 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/[0.08]">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#D4A017]">
                Formule Clé en Main
              </span>
              <h3 className="text-2xl sm:text-3xl font-heading font-bold text-white mt-1">
                Votre Chanson Personnalisée
              </h3>
              <p className="text-xs sm:text-sm text-[#8E94A3] mt-1">
                Livrée directement sur votre WhatsApp en 15 à 20 minutes.
              </p>
            </div>

            <div className="sm:text-right">
              <div className="text-3xl sm:text-4xl font-mono font-bold text-white">
                {price.toLocaleString('fr-FR')} <span className="text-xs font-sans text-[#D4A017]">F CFA</span>
              </div>
              <div className="text-xs text-[#8E94A3]">2 versions complètes incluses</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#F0F0F5]">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3" />
              </div>
              <span>Paroles écrites sur mesure avec vos souvenirs</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3" />
              </div>
              <span>2 styles musicaux différents téléchargeables en HD</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3" />
              </div>
              <span>Lecture audio privée partageable avec vos proches</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3" />
              </div>
              <span>Paiement sécurisé par Wave, Orange Money ou MTN</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleOrderClick}
              className="w-full sm:w-auto flex-1 h-12 rounded-full font-semibold text-sm text-[#0A0A0F] inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_24px_-4px_rgba(212,160,23,0.45)] hover:scale-[1.01]"
              style={{ backgroundColor: accentColor }}
            >
              <span>Composer ma chanson maintenant</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <a
              href="https://wa.me/22656240533?text=Bonjour,%20je%20souhaite%20des%20informations%20sur%20les%20chansons%20personnalis%C3%A9es"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto h-12 px-6 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Smartphone className="h-4 w-4" />
              <span>Contacter sur WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-4 sm:px-8 py-8 text-center text-xs text-[#8E94A3] space-y-2">
        <p>
          Vitrine officielle de <strong className="text-white">{studio?.name}</strong> · Propulsé par la technologie Djelia Studio
        </p>
        <p className="text-[11px] font-mono text-neutral-600">
          Chansons produites avec amour en Afrique de l'Ouest · Tous droits réservés
        </p>
      </footer>
    </div>
  );
};
