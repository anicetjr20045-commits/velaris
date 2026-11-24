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
  ChevronLeft,
  Volume2,
  Heart,
  Calendar,
  Gift,
  Smile,
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
    audioUrl: 'https://waha.velarisagent.life/qr/assets/vocal_procedure_soeur.opus',
    lyricsExcerpt: 'Mariam mon amour, chaque jour à tes côtés est une bénédiction...',
  },
  {
    title: 'Mariage & Bénédiction — Amadou & Fatou',
    style: 'Zouk Doux & Guitare',
    duration: '3:10',
    audioUrl: 'https://waha.velarisagent.life/qr/assets/vocal_commande_soeur.opus',
    lyricsExcerpt: 'Devant Dieu et nos familles, nos cœurs ne font plus qu’un...',
  },
  {
    title: 'Hommage & Gratitude — Pour Maman Awa',
    style: 'Rumba Douce & Piano',
    duration: '2:30',
    audioUrl: 'https://waha.velarisagent.life/qr/assets/vocal_procedure_soeur.opus',
    lyricsExcerpt: 'Merci maman pour tes prières, ton sourire éclaire nos vies...',
  },
];

const OCCASIONS = [
  { id: 'anniversaire', label: 'Anniversaire', icon: Gift },
  { id: 'amour', label: 'Amour & Couple', icon: Heart },
  { id: 'mariage', label: 'Mariage & Union', icon: Calendar },
  { id: 'maman', label: 'Maman & Parents', icon: Smile },
];

export const MiniSiteView: FC<MiniSiteViewProps> = ({ slug, onReturnToHome }) => {
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  // Formulaire de brief rapide en direct
  const [occasion, setOccasion] = useState('anniversaire');
  const [recipientName, setRecipientName] = useState('');
  const [memories, setMemories] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Afro-Love Acoustique');

  // Mémorisation de l'attribution affiliée 30 jours
  useEffect(() => {
    if (typeof window !== 'undefined' && slug) {
      try {
        localStorage.setItem('djelia_affiliate_slug', slug);
        localStorage.setItem('djelia_affiliate_time', Date.now().toString());
      } catch {}
    }
  }, [slug]);

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
            if (data.user_id) {
              try {
                localStorage.setItem('djelia_affiliate_uid', data.user_id);
              } catch {}
            }
          } else {
            // Studio généré proprement avec identité locale
            const formattedName = slug
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase());
            setStudio({
              id: 'local-partner',
              user_id: 'partner',
              name: formattedName.includes('Studio') ? formattedName : `Studio ${formattedName}`,
              slug,
              bio: 'Création de chansons personnalisées émouvantes, livrées en 15 minutes sur WhatsApp.',
              accent_color: '#E2BD6B',
              accepted_payments: ['Wave', 'Orange Money', 'MTN'],
              music_styles: ['Afro-Love', 'Zouk Doux', 'Acoustique', 'Gospel'],
              price_quoted_standard: 1200,
            });
          }
        }
      } catch {
        if (isMounted) {
          setStudio({
            id: 'local-partner',
            user_id: 'partner',
            name: `Studio ${slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
            slug,
            bio: 'Création de chansons personnalisées émouvantes pour vos événements.',
            accent_color: '#E2BD6B',
            accepted_payments: ['Wave', 'Orange Money'],
            music_styles: ['Afro-Love', 'Zouk Doux', 'Acoustique'],
            price_quoted_standard: 1200,
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

  const initials = (studio?.name || 'Studio').slice(0, 2).toUpperCase();
  const accentColor = studio?.accent_color || '#E2BD6B';

  const handleTogglePlay = (index: number) => {
    setPlayingIndex((prev) => (prev === index ? null : index));
  };

  // Redirection commande 100% Web : tunnel de composition et paiement en ligne autonome
  const handleComposerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRecipient = recipientName.trim() || 'un proche';
    const occasionLabel = OCCASIONS.find((o) => o.id === occasion)?.label || occasion;

    const draftPayload = {
      title: `Chanson pour ${cleanRecipient}`,
      recipient: cleanRecipient,
      occasion: occasionLabel,
      style: selectedStyle,
      details: memories.trim(),
      amount: 1200,
      affiliate_slug: slug,
    };

    try {
      localStorage.setItem('djelia_draft', JSON.stringify(draftPayload));
      localStorage.setItem('djelia_affiliate_slug', slug);
      localStorage.setItem('djelia_affiliate_time', String(Date.now()));
    } catch (_) {}

    // Envoi direct dans le flux web de création et paiement sécurisé Chariow (Wave / OM)
    const webCheckoutUrl = `https://djelia.store/studio.html?aff=${encodeURIComponent(slug)}&dest=${encodeURIComponent(cleanRecipient)}&occ=${encodeURIComponent(occasionLabel)}&style=${encodeURIComponent(selectedStyle)}`;
    window.location.assign(webCheckoutUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06070A] text-white flex flex-col items-center justify-center space-y-3 font-sans">
        <div
          className="h-10 w-10 rounded-full border-2 border-white/10 animate-spin"
          style={{ borderTopColor: accentColor }}
        />
        <p className="font-mono text-xs text-[#8A90A0] tracking-widest uppercase">
          Chargement de votre vitrine…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06070A] text-white font-sans selection:bg-[#E2BD6B]/30 selection:text-white">
      {/* Top Header Navigation Co-brandée */}
      <header className="sticky top-0 z-40 bg-[#06070A]/90 border-b border-white/[0.08] backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onReturnToHome && (
            <button
              onClick={onReturnToHome}
              className="p-1.5 rounded-lg text-[#8A90A0] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              title="Retour à l'accueil"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center text-black font-extrabold text-xs shadow-md shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white uppercase">
                  {studio?.name}
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-[#8A90A0]">
                  ● Partenaire Officiel
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3" />
            Technologie Djélia Engine
          </span>
          <a
            href="#composer-brief"
            className="h-9 px-4 rounded-full font-bold text-xs text-black inline-flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer shadow-lg"
            style={{ backgroundColor: accentColor }}
          >
            <span>Commander (1 200 F)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-8 pt-12 pb-16 max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#8A90A0]">
          <Sparkles className="h-3.5 w-3.5" style={{ color: accentColor }} />
          <span>Atelier Certifié de Création Musicale IA</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Offrez une chanson qui touche le cœur, signée{' '}
            <span style={{ color: accentColor }}>{studio?.name}</span>
          </h1>
          <p className="text-sm sm:text-base text-[#8A90A0] max-w-2xl mx-auto leading-relaxed">
            {studio?.bio}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-white/80">
          <div className="flex items-center gap-1.5">
            <Check className="h-4 w-4 text-[#10D98E]" />
            <span>2 versions MP3 complètes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="h-4 w-4 text-[#10D98E]" />
            <span>Livraison en 15 minutes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="h-4 w-4 text-[#10D98E]" />
            <span>Paiement Wave & Orange Money</span>
          </div>
        </div>
      </section>

      {/* FORMULAIRE DE COMPOSITION RAPIDE EN DIRECT (HERO CONVERSION) */}
      <section id="composer-brief" className="px-4 sm:px-8 py-8 max-w-2xl mx-auto">
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.1] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#E2BD6B]">
                Brief Express en 30 secondes
              </span>
              <span className="text-xs font-mono font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-full">
                1 200 F CFA
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">Personnalisez votre chanson</h2>
          </div>

          <form onSubmit={handleComposerSubmit} className="space-y-5">
            {/* Choix Occasion */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#8A90A0]">Pour quelle occasion ?</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OCCASIONS.map((o) => {
                  const isSelected = occasion === o.id;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOccasion(o.id)}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black font-semibold border-white shadow-md'
                          : 'bg-[#06070A] border-white/[0.06] text-[#8A90A0] hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px]">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prénom du destinataire */}
            <div className="space-y-1.5">
              <label htmlFor="rec-name" className="block text-xs font-medium text-[#8A90A0]">
                Prénom de la personne à qui vous dédiez la chanson
              </label>
              <input
                id="rec-name"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ex : Mariam, Ibrahim, Maman Awa..."
                required
                className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>

            {/* Souvenirs & Détails */}
            <div className="space-y-1.5">
              <label htmlFor="rec-memories" className="block text-xs font-medium text-[#8A90A0]">
                Détails personnels, surnoms ou souvenirs marquants (optionnel)
              </label>
              <textarea
                id="rec-memories"
                rows={2}
                value={memories}
                onChange={(e) => setMemories(e.target.value)}
                placeholder="Ex : Son rire contagieux, nos vacances à Grand-Bassam, sa recette préférée..."
                className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>

            {/* Style musical */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#8A90A0]">Style musical</label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Afro-Love Acoustique',
                  'Zouk Doux & Guitare',
                  'Afrobeat Énergique',
                  'Gospel & Bénédictions',
                  'Piano Voix Émotion',
                ].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStyle(st)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                      selectedStyle === st
                        ? 'bg-[#E2BD6B] text-black font-semibold'
                        : 'bg-[#06070A] text-[#8A90A0] border border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl font-bold text-sm text-black flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_24px_rgba(255,255,255,0.2)] hover:scale-[1.01] transition-all"
              style={{ backgroundColor: accentColor }}
            >
              <span>Valider mon brief & Commander (1 200 F CFA)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Extraits audios réels */}
      <section className="px-4 sm:px-8 py-10 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4" style={{ color: accentColor }} />
            <h2 className="text-base font-semibold text-white">Extraits de nos créations studio</h2>
          </div>
          <span className="text-xs text-[#8A90A0] font-mono">Qualité Master 24-bit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SAMPLE_DEMOS.map((demo, idx) => {
            const isPlaying = playingIndex === idx;
            return (
              <div
                key={demo.title}
                className="p-5 rounded-2xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/[0.16] transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#8A90A0]">{demo.duration}</span>
                    <Volume2 className="w-3.5 h-3.5 text-[#8A90A0]" />
                  </div>
                  <h3 className="text-sm font-semibold text-white line-clamp-1">{demo.title}</h3>
                  <p className="text-xs text-[#8A90A0] line-clamp-1">{demo.style}</p>
                  <p className="text-[11px] text-white/70 italic line-clamp-2 pt-1 border-t border-white/[0.04]">
                    « {demo.lyricsExcerpt} »
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleTogglePlay(idx)}
                  className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      <span>Écouter l'extrait</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Garantie & Contact WhatsApp */}
      <section className="px-4 sm:px-8 py-10 max-w-4xl mx-auto">
        <div className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-white">Une question sur votre commande ?</h3>
            <p className="text-xs text-[#8A90A0]">
              Notre équipe d'assistance est disponible 24h/24 directement sur WhatsApp.
            </p>
          </div>

          <a
            href={`https://wa.me/22656240533?text=${encodeURIComponent(`Bonjour ! Je souhaite des informations sur les chansons personnalisées de ${studio?.name || 'votre studio'}. (Réf: ${slug})`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-[#10D98E]" />
            <span>Discuter sur WhatsApp</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-4 sm:px-8 py-8 text-center text-xs text-[#8A90A0] space-y-2">
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
