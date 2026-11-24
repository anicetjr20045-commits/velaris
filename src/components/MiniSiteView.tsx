import { useEffect, useState, useRef, type FC } from 'react';
import {
  Music2,
  Play,
  Pause,
  Check,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  Volume2,
  Heart,
  Calendar,
  Gift,
  Smile,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../services/supabase';

export interface StudioData {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  headline?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  accent_color?: string | null;
  theme_mode?: 'obsidian' | 'midnight' | 'emerald' | 'carbon';
  show_badge?: boolean;
  badge_text?: string | null;
  show_demos?: boolean;
  show_guarantees?: boolean;
  show_whatsapp?: boolean;
  whatsapp_phone?: string | null;
  whatsapp_prompt?: string | null;
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

export const THEME_STYLES = {
  obsidian: {
    bg: '#06070A',
    card: '#0D0F14',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.16)',
    subtle: '#141822',
  },
  midnight: {
    bg: '#070A12',
    card: '#0D1424',
    border: 'rgba(59, 130, 246, 0.14)',
    borderHover: 'rgba(59, 130, 246, 0.28)',
    subtle: '#111B30',
  },
  emerald: {
    bg: '#050F0B',
    card: '#091A12',
    border: 'rgba(16, 217, 142, 0.14)',
    borderHover: 'rgba(16, 217, 142, 0.28)',
    subtle: '#0F261B',
  },
  carbon: {
    bg: '#0C0A09',
    card: '#181412',
    border: 'rgba(226, 189, 107, 0.14)',
    borderHover: 'rgba(226, 189, 107, 0.28)',
    subtle: '#221D1A',
  },
};

export const MiniSiteView: FC<MiniSiteViewProps> = ({ slug, onReturnToHome }) => {
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Formulaire de brief rapide en direct
  const [occasion, setOccasion] = useState('anniversaire');
  const [recipientName, setRecipientName] = useState('');
  const [memories, setMemories] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Afro-Love Acoustique');

  // Attribution affiliée 30 jours
  useEffect(() => {
    if (typeof window !== 'undefined' && slug) {
      try {
        localStorage.setItem('djelia_affiliate_slug', slug);
        localStorage.setItem('djelia_affiliate_time', Date.now().toString());
      } catch {}
    }
  }, [slug]);

  // Chargement ultra-résilient du studio (Cache Local + Supabase)
  useEffect(() => {
    let isMounted = true;

    async function loadStudio() {
      setLoading(true);

      // 1. Essai de préchargement instantané depuis le localStorage
      try {
        const cachedRaw = localStorage.getItem(`djelia_custom_studio_${slug}`);
        if (cachedRaw && isMounted) {
          const parsed = JSON.parse(cachedRaw);
          setStudio(parsed);
          setLoading(false);
        }
      } catch {}

      try {
        // 2. Requête Supabase vers la table studios
        const { data, error } = await supabase
          .from('studios')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (isMounted) {
          if (data && !error) {
            // Décodage des paramètres avancés stockés dans social_links JSONB
            const ext = (data.social_links as Record<string, any>) || {};
            const loadedStudio: StudioData = {
              id: data.id,
              user_id: data.user_id,
              name: data.name,
              slug: data.slug,
              headline: ext.headline || 'Vos plus beaux souvenirs transformés en chansons d’exception',
              bio: data.bio || 'Création musicale sur-mesure livrée en haute fidélité.',
              photo_url: data.photo_url || ext.photo_url || null,
              accent_color: data.accent_color || '#E2BD6B',
              theme_mode: ext.theme_mode || 'obsidian',
              show_badge: ext.show_badge ?? true,
              badge_text: ext.badge_text || 'Studio de Création Musicale',
              show_demos: ext.show_demos ?? true,
              show_guarantees: ext.show_guarantees ?? true,
              show_whatsapp: ext.show_whatsapp ?? false,
              whatsapp_phone: ext.whatsapp_phone || null,
              whatsapp_prompt: ext.whatsapp_prompt || null,
              price_quoted_standard: data.price_quoted_standard || 1200,
            };

            setStudio(loadedStudio);

            // Mémorisation locale pour affichage instantané aux prochaines visites
            try {
              localStorage.setItem(`djelia_custom_studio_${slug}`, JSON.stringify(loadedStudio));
              if (data.user_id) {
                localStorage.setItem('djelia_affiliate_uid', data.user_id);
              }
            } catch {}
          } else {
            // Si pas encore en base, création d'une identité propre par défaut
            const formattedName = slug
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase());
            const defaultStudio: StudioData = {
              id: 'local-partner',
              user_id: 'partner',
              name: formattedName.includes('Studio') ? formattedName : `Studio ${formattedName}`,
              slug,
              headline: 'Vos plus beaux souvenirs transformés en chansons d’exception',
              bio: 'Création musicale sur-mesure livrée en haute fidélité.',
              photo_url: null,
              accent_color: '#E2BD6B',
              theme_mode: 'obsidian',
              show_badge: true,
              badge_text: 'Studio de Création Musicale',
              show_demos: true,
              show_guarantees: true,
              show_whatsapp: false,
              whatsapp_phone: null,
              price_quoted_standard: 1200,
            };
            setStudio(defaultStudio);
          }
        }
      } catch {
        // Fallback gracieux
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStudio();

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [slug]);

  const initials = (studio?.name || 'Studio').slice(0, 2).toUpperCase();
  const accentColor = studio?.accent_color || '#E2BD6B';
  const currentTheme = THEME_STYLES[studio?.theme_mode || 'obsidian'] || THEME_STYLES.obsidian;

  const handleTogglePlay = (index: number) => {
    if (playingIndex === index) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingIndex(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const demo = SAMPLE_DEMOS[index];
      const audio = new Audio(demo.audioUrl);
      audioRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => setPlayingIndex(null);
      setPlayingIndex(index);
    }
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

  // Traitement du lien WhatsApp personnalisé du créateur
  const cleanWhatsAppNumber = studio?.whatsapp_phone
    ? studio.whatsapp_phone.replace(/\D/g, '')
    : '';
  const waContactPrompt = studio?.whatsapp_prompt || `Bonjour ${studio?.name || 'le Studio'} ! J'ai une question concernant la création d'une chanson.`;
  const waDirectUrl = cleanWhatsAppNumber
    ? `https://wa.me/${cleanWhatsAppNumber}?text=${encodeURIComponent(waContactPrompt)}`
    : null;

  if (loading) {
    return (
      <div
        className="min-h-screen text-white flex flex-col items-center justify-center space-y-3 font-sans"
        style={{ backgroundColor: currentTheme.bg }}
      >
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
    <div
      className="min-h-screen text-white font-sans selection:bg-white/20 transition-colors duration-500 relative"
      style={{ backgroundColor: currentTheme.bg }}
    >
      {/* Barre de navigation haute-horlogerie */}
      <header
        className="border-b sticky top-0 z-40 backdrop-blur-xl px-4 sm:px-8 py-3.5 transition-colors"
        style={{
          backgroundColor: `${currentTheme.bg}E6`,
          borderColor: currentTheme.border,
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onReturnToHome && (
              <button
                type="button"
                onClick={onReturnToHome}
                className="p-1.5 -ml-1.5 rounded-xl text-[#8A90A0] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Retour à l'académie"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Logo image ou monogramme initiales */}
            {studio?.photo_url ? (
              <img
                src={studio.photo_url}
                alt={studio.name}
                className="w-10 h-10 rounded-2xl object-cover shrink-0 shadow-lg border"
                style={{ borderColor: `${accentColor}60` }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-black font-extrabold text-sm shrink-0 shadow-lg tracking-wider"
                style={{ backgroundColor: accentColor }}
              >
                {initials}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">{studio?.name}</span>
                {studio?.show_badge && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono border font-medium truncate max-w-[170px]"
                    style={{
                      borderColor: `${accentColor}40`,
                      backgroundColor: `${accentColor}15`,
                      color: accentColor,
                    }}
                  >
                    {studio.badge_text || 'Studio de Musique'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8A90A0] line-clamp-1">
                {studio?.headline || 'Créations musicales sur-mesure'}
              </p>
            </div>
          </div>

          {/* Prix & Commande directe */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[11px] text-[#8A90A0] uppercase font-mono">Tarif Unique</span>
              <span className="font-bold text-sm font-mono" style={{ color: accentColor }}>
                1 200 F CFA
              </span>
            </div>

            <a
              href="#composer"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-black transition-transform active:scale-95 shadow-md inline-flex items-center gap-1.5"
              style={{ backgroundColor: accentColor }}
            >
              <span>Commander</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Studio */}
      <section className="px-4 sm:px-8 pt-10 pb-6 max-w-4xl mx-auto text-center space-y-4">
        {studio?.show_badge && (
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border shadow-sm"
            style={{
              borderColor: `${accentColor}40`,
              backgroundColor: `${accentColor}12`,
              color: accentColor,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{studio.badge_text || 'Créations 100% Personnalisées'}</span>
          </div>
        )}

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          {studio?.headline || 'Vos plus beaux souvenirs transformés en chansons d’exception'}
        </h1>

        <p className="text-sm sm:text-base text-[#8A90A0] max-w-2xl mx-auto leading-relaxed">
          {studio?.bio ||
            'Offrez une chanson unique à vos proches. Remplissez simplement votre brief, validez en ligne et recevez vos morceaux masterisés.'}
        </p>

        <div className="inline-flex items-center gap-4 pt-1 text-xs text-[#8A90A0]">
          <span className="flex items-center gap-1 text-white font-medium">
            <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Mastering Studio Haute Définition</span>
          </span>
          <span className="text-white/20">·</span>
          <span className="flex items-center gap-1 text-white font-medium">
            <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Paiement Sécurisé Wave / OM</span>
          </span>
        </div>
      </section>

      {/* Compositeur de brief en direct */}
      <section id="composer" className="px-4 sm:px-8 py-6 max-w-3xl mx-auto">
        <div
          className="rounded-[28px] border p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden"
          style={{
            backgroundColor: currentTheme.card,
            borderColor: currentTheme.border,
          }}
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[#8A90A0]">
                Étape 1 sur 2
              </span>
              <h2 className="text-lg font-bold text-white">Rédigez votre brief musical</h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#8A90A0]">Prix total :</span>
              <div className="font-extrabold text-base font-mono" style={{ color: accentColor }}>
                1 200 F CFA
              </div>
            </div>
          </div>

          <form onSubmit={handleComposerSubmit} className="space-y-5">
            {/* Occasion */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#8A90A0]">
                Pour quelle occasion ?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OCCASIONS.map((occ) => {
                  const Icon = occ.icon;
                  const isSelected = occasion === occ.id;
                  return (
                    <button
                      key={occ.id}
                      type="button"
                      onClick={() => setOccasion(occ.id)}
                      className={`p-3 rounded-2xl border text-xs font-medium transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'text-white shadow-md'
                          : 'text-[#8A90A0] hover:text-white bg-black/20 hover:bg-black/40'
                      }`}
                      style={{
                        borderColor: isSelected ? accentColor : 'rgba(255, 255, 255, 0.08)',
                        backgroundColor: isSelected ? `${accentColor}20` : undefined,
                      }}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{ color: isSelected ? accentColor : undefined }}
                      />
                      <span>{occ.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prénom du destinataire */}
            <div className="space-y-1.5">
              <label htmlFor="rec-name" className="block text-xs font-medium text-[#8A90A0]">
                Prénom du destinataire ou surnom affectueux
              </label>
              <input
                id="rec-name"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ex : Mariam, Ibrahim, Maman Awa, Mon Trésor..."
                required
                className="w-full px-3.5 py-3 rounded-2xl bg-black/40 border border-white/[0.08] text-sm text-white focus:outline-none"
                style={{ caretColor: accentColor }}
              />
            </div>

            {/* Souvenirs & Détails */}
            <div className="space-y-1.5">
              <label htmlFor="rec-memories" className="block text-xs font-medium text-[#8A90A0]">
                Détails personnels, qualités ou souvenirs marquants (optionnel)
              </label>
              <textarea
                id="rec-memories"
                rows={2}
                value={memories}
                onChange={(e) => setMemories(e.target.value)}
                placeholder="Ex : Son rire communicatif, nos vacances à Grand-Bassam, sa recette préférée..."
                className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] text-sm text-white focus:outline-none"
                style={{ caretColor: accentColor }}
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
                  'Rumba Douce & Piano',
                  'Gospel & Louange',
                  'Pop Urbaine & Émotion',
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedStyle(s)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      selectedStyle === s
                        ? 'text-white shadow-sm'
                        : 'text-[#8A90A0] hover:text-white bg-black/20'
                    }`}
                    style={{
                      borderColor: selectedStyle === s ? accentColor : 'rgba(255, 255, 255, 0.08)',
                      backgroundColor: selectedStyle === s ? `${accentColor}20` : undefined,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl font-bold text-sm text-black flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:scale-[1.01] transition-all"
              style={{ backgroundColor: accentColor }}
            >
              <span>Valider mon brief & Commander (1 200 F CFA)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Extraits audios réels (Optionnel) */}
      {studio?.show_demos && (
        <section className="px-4 sm:px-8 py-10 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4" style={{ color: accentColor }} />
              <h2 className="text-base font-semibold text-white">Extraits de nos créations</h2>
            </div>
            <span className="text-xs text-[#8A90A0] font-mono">Qualité Master 24-bit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SAMPLE_DEMOS.map((demo, idx) => {
              const isPlaying = playingIndex === idx;
              return (
                <div
                  key={demo.title}
                  className="p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4"
                  style={{
                    backgroundColor: currentTheme.card,
                    borderColor: currentTheme.border,
                  }}
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
      )}

      {/* Bento des Garanties (Optionnel) */}
      {studio?.show_guarantees && (
        <section className="px-4 sm:px-8 py-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              className="p-5 rounded-2xl border space-y-2"
              style={{
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Livraison en Direct</h3>
              <p className="text-xs text-[#8A90A0]">
                Composition instantanée sous vos yeux dès validation de votre paiement.
              </p>
            </div>

            <div
              className="p-5 rounded-2xl border space-y-2"
              style={{
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                <Music2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Format Audio Universel</h3>
              <p className="text-xs text-[#8A90A0]">
                Morceau MP3 Master HD 320 kbps compatible avec WhatsApp, iPhone et Android.
              </p>
            </div>

            <div
              className="p-5 rounded-2xl border space-y-2"
              style={{
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Paiement 100% Sécurisé</h3>
              <p className="text-xs text-[#8A90A0]">
                Guichet officiel Mobile Money (Wave, Orange Money, Moov, MTN, Carte).
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Assistance WhatsApp Direct Créateur (Optionnel) */}
      {studio?.show_whatsapp && waDirectUrl && (
        <>
          {/* Bloc d'assistance en bas de page */}
          <section className="px-4 sm:px-8 py-8 max-w-4xl mx-auto">
            <div
              className="rounded-3xl border p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6"
              style={{
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
              }}
            >
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-400 font-mono">Assistance en direct</span>
                </div>
                <h3 className="text-lg font-bold text-white">Une question avant de commander ?</h3>
                <p className="text-xs text-[#8A90A0]">
                  Contactez directement l'équipe de <strong className="text-white">{studio.name}</strong> sur WhatsApp.
                </p>
              </div>

              <a
                href={waDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl text-black text-xs font-bold inline-flex items-center gap-2 transition-transform hover:scale-105 shrink-0 cursor-pointer shadow-lg"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle className="w-4 h-4 fill-black" />
                <span>Discuter avec le studio</span>
              </a>
            </div>
          </section>

          {/* Bouton Flottant WhatsApp Fixé en Bas à Droite */}
          <div className="fixed bottom-6 right-6 z-50">
            <a
              href={waDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border"
              style={{
                backgroundColor: '#121B17',
                borderColor: 'rgba(37, 211, 102, 0.4)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(37, 211, 102, 0.25)',
              }}
              title="Poser une question sur WhatsApp"
            >
              <div className="relative">
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center text-black shadow-md">
                  <MessageCircle className="w-4 h-4 fill-black" />
                </div>
              </div>
              <span className="text-xs font-semibold text-white tracking-wide pr-1">
                Aide WhatsApp
              </span>
            </a>
          </div>
        </>
      )}

      {/* Footer sobre & sans mention Djélia forcée */}
      <footer
        className="border-t px-4 sm:px-8 py-8 text-center text-xs text-[#8A90A0] space-y-2"
        style={{ borderColor: currentTheme.border }}
      >
        <p>
          © {new Date().getFullYear()} <strong className="text-white">{studio?.name}</strong> · Studio de création musicale indépendante.
        </p>
        <p className="text-[11px] font-mono text-neutral-600">
          Chansons écrites et composées pour vos proches · Tous droits réservés
        </p>
      </footer>
    </div>
  );
};
