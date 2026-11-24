import { useState, useEffect, useRef, type FC, type FormEvent, type ChangeEvent } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  X,
  Loader2,
  Smartphone,
  Wallet,
  Sparkles,
  TrendingUp,
  Palette,
  Globe,
  Share2,
  Upload,
  Trash2,
  Eye,
  Sliders,
  MessageCircle,
  Music2,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { THEME_STYLES } from './MiniSiteView';

const COLOR_PRESETS = [
  { id: '#E2BD6B', name: 'Or Champagne', class: 'bg-[#E2BD6B]' },
  { id: '#10D98E', name: 'Émeraude Royale', class: 'bg-[#10D98E]' },
  { id: '#00E5FF', name: 'Cyan Électrique', class: 'bg-[#00E5FF]' },
  { id: '#F43F5E', name: 'Rose Passion', class: 'bg-[#F43F5E]' },
  { id: '#A855F7', name: 'Violet Studio', class: 'bg-[#A855F7]' },
  { id: '#EF4444', name: 'Rubis Impérial', class: 'bg-[#EF4444]' },
  { id: '#F59E0B', name: 'Ambre Solaire', class: 'bg-[#F59E0B]' },
  { id: '#FFFFFF', name: 'Blanc Pur', class: 'bg-[#FFFFFF]' },
];

const THEME_OPTIONS = [
  { id: 'obsidian', name: 'Obsidienne Pure', desc: 'Noir profond luxe', bg: '#06070A', border: 'rgba(255,255,255,0.08)' },
  { id: 'midnight', name: 'Nuit Bleue Midnight', desc: 'Bleu nuit discret', bg: '#070A12', border: 'rgba(59,130,246,0.2)' },
  { id: 'emerald', name: 'Émeraude Sombre', desc: 'Végétal haut de gamme', bg: '#050F0B', border: 'rgba(16,217,142,0.2)' },
  { id: 'carbon', name: 'Café Carbone', desc: 'Brun sombre boisé', bg: '#0C0A09', border: 'rgba(226,189,107,0.2)' },
];

export const AffiliationView: FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'site' | 'affiliate'>('site');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Données de configuration du studio (user_metadata ou valeurs par défaut)
  const meta = user?.user_metadata || {};
  const initialName = (meta.studio_name as string) || 'Mon Studio';
  const initialSlug = (meta.studio_slug as string) || initialName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'mon-studio';

  const [studioName, setStudioName] = useState(initialName);
  const [studioSlug, setStudioSlug] = useState(initialSlug);
  const [headline, setHeadline] = useState(
    (meta.studio_headline as string) || 'Vos plus beaux souvenirs transformés en chansons d’exception'
  );
  const [bio, setBio] = useState(
    (meta.studio_bio as string) || 'Création musicale sur-mesure en 15 minutes, paroles écrites spécialement pour vos proches.'
  );
  const [photoUrl, setPhotoUrl] = useState<string>((meta.studio_photo_url as string) || '');
  const [accentColor, setAccentColor] = useState<string>((meta.studio_color as string) || '#E2BD6B');
  const [themeMode, setThemeMode] = useState<'obsidian' | 'midnight' | 'emerald' | 'carbon'>(
    (meta.studio_theme as any) || 'obsidian'
  );

  // Toggles de personnalisation modulaire
  const [showBadge, setShowBadge] = useState<boolean>(meta.studio_show_badge ?? true);
  const [badgeText, setBadgeText] = useState<string>((meta.studio_badge_text as string) || 'Studio de Création Musicale');
  const [showDemos, setShowDemos] = useState<boolean>(meta.studio_show_demos ?? true);
  const [showGuarantees, setShowGuarantees] = useState<boolean>(meta.studio_show_guarantees ?? true);
  const [showWhatsApp, setShowWhatsApp] = useState<boolean>(meta.studio_show_whatsapp ?? false);
  const [whatsAppPhone, setWhatsAppPhone] = useState<string>((meta.studio_whatsapp_phone as string) || '');
  const [whatsAppPrompt, setWhatsAppPrompt] = useState<string>(
    (meta.studio_whatsapp_prompt as string) || 'Bonjour ! J’ai une question concernant ma commande de chanson.'
  );

  // État de sauvegarde & affichage
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [savingSite, setSavingSite] = useState(false);
  const [siteSavedNotice, setSiteSavedNotice] = useState<string | null>(null);

  // État Affiliation 50% & Retrait WhatsApp
  const [copiedKey, setCopiedKey] = useState<'mini' | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawPhone, setWithdrawPhone] = useState((meta.phone as string) || '');
  const [withdrawName, setWithdrawName] = useState((meta.full_name as string) || '');
  const [withdrawOperator, setWithdrawOperator] = useState('Wave');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const cleanSlug = studioSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mon-studio';
  const miniSiteUrl = `https://djelia.store/?ref=${cleanSlug}`;
  const shortSlugUrl = `https://djelia.store/s/${cleanSlug}`;

  // Métriques d'Affiliation 50% en Temps Réel depuis le serveur
  const [stats, setStats] = useState<{
    clicks_count: number;
    sales_count: number;
    conversion_rate: number;
    total_earned: number;
    balance: number;
    commissions: Array<{
      order_id: string;
      created_at: string;
      order_price: number;
      commission: number;
      formula: string;
      status: string;
    }>;
  }>({
    clicks_count: 0,
    sales_count: 0,
    conversion_rate: 0,
    total_earned: 0,
    balance: 0,
    commissions: []
  });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAffiliateStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch(`https://waha.velarisagent.life/api/stt/pay/affiliate/stats?slug=${encodeURIComponent(cleanSlug)}`);
        const json = await res.json();
        if (!cancelled && json.code === 200 && json.data) {
          setStats(json.data);
        }
      } catch {
        // En cas de coupure réseau, conserve les valeurs par défaut
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };
    fetchAffiliateStats();
    return () => { cancelled = true; };
  }, [cleanSlug]);

  const totalClicks = stats.clicks_count;
  const totalSales = stats.sales_count;
  const commissionPerSale = 600;
  const balanceCfa = stats.balance || (totalSales * commissionPerSale);
  const minWithdrawThreshold = 1500;

  const handleCopy = (text: string, type: 'mini') => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Upload d'image local / converti en DataURL
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Veuillez choisir une image de moins de 3 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setPhotoUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Enregistrement et publication sur Supabase (Auth + table studios + localStorage)
  const handleSaveSite = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    setSiteSavedNotice(null);

    const fullConfig = {
      id: user?.id || 'local-partner',
      user_id: user?.id || 'partner',
      name: studioName.trim() || 'Mon Studio',
      slug: cleanSlug,
      headline: headline.trim(),
      bio: bio.trim(),
      photo_url: photoUrl || null,
      accent_color: accentColor,
      theme_mode: themeMode,
      show_badge: showBadge,
      badge_text: badgeText.trim(),
      show_demos: showDemos,
      show_guarantees: showGuarantees,
      show_whatsapp: showWhatsApp,
      whatsapp_phone: whatsAppPhone.trim() || null,
      whatsapp_prompt: whatsAppPrompt.trim() || null,
      price_quoted_standard: 1200,
    };

    try {
      // 1. Sauvegarde instantanée en localStorage pour affichage direct à zéro latence
      try {
        localStorage.setItem(`djelia_custom_studio_${cleanSlug}`, JSON.stringify(fullConfig));
        localStorage.setItem('djelia_current_studio_config', JSON.stringify(fullConfig));
      } catch {}

      // 2. Sauvegarde dans user_metadata Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          studio_name: studioName.trim(),
          studio_slug: cleanSlug,
          studio_headline: headline.trim(),
          studio_bio: bio.trim(),
          studio_photo_url: photoUrl,
          studio_color: accentColor,
          studio_theme: themeMode,
          studio_show_badge: showBadge,
          studio_badge_text: badgeText.trim(),
          studio_show_demos: showDemos,
          studio_show_guarantees: showGuarantees,
          studio_show_whatsapp: showWhatsApp,
          studio_whatsapp_phone: whatsAppPhone.trim(),
          studio_whatsapp_prompt: whatsAppPrompt.trim(),
          studio_price: 1200,
        },
      });
      if (authError) throw authError;

      // 3. Persistance dans la table studios
      if (user?.id) {
        try {
          await (supabase.from('studios') as any).upsert({
            user_id: user.id,
            name: studioName.trim(),
            slug: cleanSlug,
            bio: bio.trim(),
            photo_url: photoUrl || null,
            accent_color: accentColor,
            social_links: {
              headline: headline.trim(),
              theme_mode: themeMode,
              show_badge: showBadge,
              badge_text: badgeText.trim(),
              show_demos: showDemos,
              show_guarantees: showGuarantees,
              show_whatsapp: showWhatsApp,
              whatsapp_phone: whatsAppPhone.trim(),
              whatsapp_prompt: whatsAppPrompt.trim(),
            },
            price_quoted_standard: 1200,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // Table studios optionnelle
        }

        // 4. Publication publique dans automation_rules pour diffusion mondiale vers djelia.store
        try {
          const { data: existing } = await supabase
            .from('automation_rules')
            .select('id')
            .eq('trigger_type', 'studio_config')
            .eq('trigger_value', cleanSlug)
            .maybeSingle();

          if (existing?.id) {
            await supabase
              .from('automation_rules')
              .update({
                name: studioName.trim(),
                text_body: JSON.stringify(fullConfig),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('automation_rules').insert({
              user_id: user.id,
              name: studioName.trim(),
              trigger_type: 'studio_config',
              trigger_value: cleanSlug,
              text_body: JSON.stringify(fullConfig),
              enabled: true,
            });
          }
        } catch {
          // Non bloquant
        }
      }

      setSiteSavedNotice('Votre vitrine personnalisée a été enregistrée et publiée avec succès !');
      setTimeout(() => setSiteSavedNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour.';
      setSiteSavedNotice(msg);
    } finally {
      setSavingSite(false);
    }
  };

  const handleRequestWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    if (!withdrawPhone.trim()) return;

    if (user?.id) {
      try {
        await (supabase.from('affiliate_payouts') as any).insert({
          user_id: user.id,
          amount: balanceCfa,
          operator: withdrawOperator,
          phone_number: withdrawPhone.trim(),
          status: 'pending',
        });
      } catch {}
    }

    setWithdrawSuccess(true);

    const textMsg =
      `Bonjour l’équipe ! Je souhaite effectuer un retrait de mes commissions d'affiliation de ${balanceCfa.toLocaleString('fr-FR')} F CFA (50% de mes ventes).\n\n` +
      `Studio : ${studioName} (Slug: ${cleanSlug})\n` +
      `Opérateur : ${withdrawOperator}\n` +
      `Numéro de réception : ${withdrawPhone.trim()}\n` +
      `Nom du titulaire : ${withdrawName.trim() || studioName}\n\n` +
      `Merci de procéder au virement !`;

    const waUrl = `https://wa.me/22656240533?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');

    setTimeout(() => {
      setWithdrawSuccess(false);
      setIsWithdrawModalOpen(false);
    }, 2000);
  };

  const initials = (studioName || 'Studio').slice(0, 2).toUpperCase();
  const currentTheme = THEME_STYLES[themeMode] || THEME_STYLES.obsidian;

  return (
    <div className="space-y-8 pb-12">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Mon Site Vitrine & Affiliation</h1>
          <p className="text-sm text-[#8A90A0]">
            Personnalisez votre propre site de vente et encaissez 50% de commission nette (600 F CFA) sur chaque commande.
          </p>
        </div>

        {/* Lien direct et bouton aperçu */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/90">
          <Globe className="w-3.5 h-3.5 text-[#E2BD6B]" />
          <span className="font-mono text-[11px] truncate max-w-[180px] sm:max-w-xs">
            djelia.store/s/{cleanSlug}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(miniSiteUrl, 'mini')}
            className="text-[#E2BD6B] font-semibold text-[11px] hover:underline cursor-pointer"
          >
            {copiedKey === 'mini' ? 'Copié' : 'Copier'}
          </button>
          <a
            href={miniSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/70 hover:text-white p-0.5"
            title="Voir en direct"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Sélecteur 2 onglets principaux */}
      <div className="flex gap-2 p-1 rounded-2xl bg-[#0D0F14] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setActiveSubTab('site')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'site'
              ? 'bg-white text-black shadow-md'
              : 'text-[#8A90A0] hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Personnalisation & Aperçu Live</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('affiliate')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'affiliate'
              ? 'bg-white text-black shadow-md'
              : 'text-[#8A90A0] hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Affiliation 50% & Retraits</span>
        </button>
      </div>

      {activeSubTab === 'site' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ============================================================ */}
          {/* COLONNE GAUCHE (7/12) : FORMULAIRE DE PERSONNALISATION ÉTENDU */}
          {/* ============================================================ */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={handleSaveSite} className="space-y-6">
              {siteSavedNotice && (
                <div className="p-4 rounded-2xl bg-[#10D98E]/15 border border-[#10D98E]/30 text-[#10D98E] text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{siteSavedNotice}</span>
                </div>
              )}

              {/* 1. IDENTITÉ VISUELLE & LOGO */}
              <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                  <Layers className="w-4 h-4 text-[#E2BD6B]" />
                  <h3 className="text-sm font-semibold text-white">1. Identité Visuelle & Logo</h3>
                </div>

                {/* Upload Logo ou Photo */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Logo ou Photo de profil du studio
                  </label>

                  <div className="flex items-center gap-4">
                    {photoUrl ? (
                      <div className="relative group">
                        <img
                          src={photoUrl}
                          alt="Logo Studio"
                          className="w-16 h-16 rounded-2xl object-cover border-2 shadow-md"
                          style={{ borderColor: accentColor }}
                        />
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors"
                          title="Supprimer la photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-black font-black text-lg shadow-md shrink-0 tracking-wider"
                        style={{ backgroundColor: accentColor }}
                      >
                        {initials}
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Téléverser une image</span>
                        </button>

                        {photoUrl && (
                          <button
                            type="button"
                            onClick={() => setPhotoUrl('')}
                            className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Retirer</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8A90A0]">
                        JPG, PNG ou WEBP. Si aucune photo n’est choisie, votre monogramme sera affiché.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nom du Studio */}
                <div className="space-y-1.5">
                  <label htmlFor="st-name" className="block text-xs font-medium text-[#8A90A0]">
                    Nom de votre studio de musique
                  </label>
                  <input
                    id="st-name"
                    type="text"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    placeholder="Ex : Fatou Music, Awa Studio, Mélodies d’Afrique..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                </div>

                {/* Slug d'URL */}
                <div className="space-y-1.5">
                  <label htmlFor="st-slug" className="block text-xs font-medium text-[#8A90A0]">
                    Votre adresse exclusive sur le web
                  </label>
                  <div className="flex items-center rounded-2xl bg-[#06070A] border border-white/[0.08] overflow-hidden focus-within:border-[#E2BD6B]">
                    <span className="px-3.5 py-2.5 text-xs text-[#8A90A0] bg-white/[0.02] border-r border-white/[0.06] select-none font-mono">
                      djelia.store/s/
                    </span>
                    <input
                      id="st-slug"
                      type="text"
                      value={studioSlug}
                      onChange={(e) => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="mon-studio"
                      required
                      className="flex-1 px-3.5 py-2.5 bg-transparent text-sm text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Badge de Confiance / Label d'Accroche */}
                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white">Badge d'expertise en tête de page</p>
                      <p className="text-[11px] text-[#8A90A0]">Affiche une puce de réassurance personnalisée</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBadge}
                        onChange={(e) => setShowBadge(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10D98E]" />
                    </label>
                  </div>

                  {showBadge && (
                    <input
                      type="text"
                      value={badgeText}
                      onChange={(e) => setBadgeText(e.target.value)}
                      placeholder="Ex : Studio de Création Musicale, 100% Original..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#06070A] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                    />
                  )}
                </div>
              </section>

              {/* 2. COULEURS & AMBIANCE */}
              <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                  <Palette className="w-4 h-4 text-[#E2BD6B]" />
                  <h3 className="text-sm font-semibold text-white">2. Couleurs & Ambiance Graphique</h3>
                </div>

                {/* Couleur d'accentuation */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Couleur d'accentuation (boutons, bordures et reflets)
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {COLOR_PRESETS.map((c) => {
                      const isSelected = accentColor.toLowerCase() === c.id.toLowerCase();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setAccentColor(c.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-white bg-white/10 text-white shadow-sm'
                              : 'border-white/[0.08] bg-[#06070A] text-[#8A90A0] hover:text-white'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full ${c.class} shadow-sm`} />
                          <span>{c.name}</span>
                        </button>
                      );
                    })}

                    {/* Color picker libre */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#06070A] border border-white/[0.08]">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        title="Choisir une couleur sur-mesure"
                      />
                      <span className="font-mono text-xs text-white/90 uppercase">{accentColor}</span>
                    </div>
                  </div>
                </div>

                {/* Ambiance de fond sombre */}
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Ambiance de fond du site
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {THEME_OPTIONS.map((th) => {
                      const isSelected = themeMode === th.id;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setThemeMode(th.id as any)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-white text-white shadow-md'
                              : 'border-white/[0.08] text-[#8A90A0] hover:text-white'
                          }`}
                          style={{
                            backgroundColor: th.bg,
                            borderColor: isSelected ? accentColor : undefined,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">{th.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />}
                          </div>
                          <p className="text-[11px] text-[#8A90A0] mt-0.5">{th.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 3. TEXTES & ACCROCHE PROSPECT */}
              <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                  <Sparkles className="w-4 h-4 text-[#E2BD6B]" />
                  <h3 className="text-sm font-semibold text-white">3. Textes & Promesse Client</h3>
                </div>

                {/* Headline principale */}
                <div className="space-y-1.5">
                  <label htmlFor="st-headline" className="block text-xs font-medium text-[#8A90A0]">
                    Grand titre d'accroche
                  </label>
                  <input
                    id="st-headline"
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Ex : Vos plus beaux souvenirs transformés en chansons d’exception"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                </div>

                {/* Phrase d'accueil (Bio) */}
                <div className="space-y-1.5">
                  <label htmlFor="st-bio" className="block text-xs font-medium text-[#8A90A0]">
                    Sous-titre et présentation de votre studio
                  </label>
                  <textarea
                    id="st-bio"
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Ex : Création sur-mesure en 15 minutes, paroles écrites spécialement pour vos proches..."
                    className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                </div>
              </section>

              {/* 4. MODULES DU SITE (AJOUTER / ENLEVER) */}
              <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                  <Sliders className="w-4 h-4 text-[#E2BD6B]" />
                  <h3 className="text-sm font-semibold text-white">4. Modules & Toggles (Ajouter ou Enlever)</h3>
                </div>

                {/* Toggle Démos Audios */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Music2 className="w-4 h-4 text-[#E2BD6B]" />
                    <div>
                      <p className="text-xs font-semibold text-white">Lecteur d’extraits audio</p>
                      <p className="text-[11px] text-[#8A90A0]">Affiche 3 morceaux réels de démonstration avec paroles</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDemos}
                      onChange={(e) => setShowDemos(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10D98E]" />
                  </label>
                </div>

                {/* Toggle Garanties */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#10D98E]" />
                    <div>
                      <p className="text-xs font-semibold text-white">Bloc des 3 garanties d’excellence</p>
                      <p className="text-[11px] text-[#8A90A0]">Livraison express, format audio MP3 HD, paiement sécurisé</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGuarantees}
                      onChange={(e) => setShowGuarantees(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10D98E]" />
                  </label>
                </div>

                {/* Toggle Bouton WhatsApp d'Assistance Direct */}
                <div className="pt-2 border-t border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      <div>
                        <p className="text-xs font-semibold text-white">Bouton d’assistance WhatsApp direct</p>
                        <p className="text-[11px] text-[#8A90A0]">Permet à vos clients de vous contacter directement en cas de besoin</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showWhatsApp}
                        onChange={(e) => setShowWhatsApp(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#25D366]" />
                    </label>
                  </div>

                  {showWhatsApp && (
                    <div className="p-4 rounded-2xl bg-[#06070A] border border-white/[0.08] space-y-3">
                      <div className="space-y-1">
                        <label htmlFor="wa-phone" className="block text-xs font-medium text-[#8A90A0]">
                          Votre numéro WhatsApp (avec indicatif pays)
                        </label>
                        <input
                          id="wa-phone"
                          type="tel"
                          value={whatsAppPhone}
                          onChange={(e) => setWhatsAppPhone(e.target.value)}
                          placeholder="+225 07 00 00 00 ou +226 70 00 00 00"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#25D366]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="wa-prompt" className="block text-xs font-medium text-[#8A90A0]">
                          Message d'accueil pré-rempli pour vos clients
                        </label>
                        <input
                          id="wa-prompt"
                          type="text"
                          value={whatsAppPrompt}
                          onChange={(e) => setWhatsAppPrompt(e.target.value)}
                          placeholder="Ex : Bonjour ! J’ai une question concernant la création d'une chanson."
                          className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#25D366]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Bouton d'enregistrement / publication */}
              <button
                type="submit"
                disabled={savingSite}
                className="w-full py-4 rounded-2xl bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50"
              >
                {savingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{savingSite ? 'Publication en cours…' : 'Enregistrer et publier mon site'}</span>
              </button>
            </form>
          </div>

          {/* ============================================================ */}
          {/* COLONNE DROITE (5/12) : APERÇU LIVE EN TEMPS RÉEL (MOCKUP)   */}
          {/* ============================================================ */}
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#E2BD6B]" />
                <h3 className="text-sm font-semibold text-white">Aperçu en direct</h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-[#0D0F14] border border-white/[0.08] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      previewDevice === 'mobile' ? 'bg-white text-black font-semibold' : 'text-[#8A90A0]'
                    }`}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      previewDevice === 'desktop' ? 'bg-white text-black font-semibold' : 'text-[#8A90A0]'
                    }`}
                  >
                    Plein
                  </button>
                </div>

                <a
                  href={miniSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Cadre du Mockup en Temps Réel */}
            <div
              className={`rounded-[32px] border overflow-hidden shadow-2xl transition-all duration-300 mx-auto ${
                previewDevice === 'mobile' ? 'max-w-[360px] border-white/[0.14]' : 'w-full border-white/[0.12]'
              }`}
              style={{ backgroundColor: currentTheme.bg }}
            >
              {/* Fake status bar pour le mobile */}
              {previewDevice === 'mobile' && (
                <div className="px-5 pt-3 pb-2 flex items-center justify-between text-[10px] text-white/40 font-mono select-none">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-white/40" />
                    <span className="w-3.5 h-2 rounded border border-white/40" />
                  </div>
                </div>
              )}

              {/* Header officiel djelia.store personnalisé */}
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{
                  backgroundColor: `${currentTheme.bg}F0`,
                  borderColor: currentTheme.border,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Logo"
                      className="w-7 h-7 rounded-lg object-cover shrink-0 border"
                      style={{ borderColor: accentColor }}
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-black font-black text-xs shrink-0"
                      style={{ backgroundColor: accentColor }}
                    >
                      {initials}
                    </div>
                  )}
                  <span className="font-extrabold text-xs text-white tracking-tight truncate">
                    {studioName || 'Mon Studio'}
                    <span style={{ color: accentColor }}>.</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-white/70">
                    Étape <strong>1/6</strong> · Style
                  </span>
                  <div className="font-mono font-bold text-xs shrink-0" style={{ color: accentColor }}>
                    1 200 F
                  </div>
                </div>
              </div>

              {/* Barre de progression aux couleurs du studio */}
              <div className="h-1 w-full bg-white/[0.06]">
                <div className="h-full w-1/6" style={{ backgroundColor: accentColor }} />
              </div>

              {/* Contenu réel djelia.store preview */}
              <div className="p-4 space-y-5 max-h-[520px] overflow-y-auto custom-scrollbar relative">
                {/* Vinyl & Hero Section djelia.store */}
                <div className="relative pt-2 pb-1 text-center space-y-2.5">
                  {/* Disque vinyle stylisé en arrière-plan */}
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-[#050608] via-[#15171F] to-[#050608] border border-white/10 flex items-center justify-center shadow-xl relative">
                    <div className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center" style={{ backgroundColor: `${accentColor}25` }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/60">
                    {badgeText || (studioName || 'Mon Studio')} — Chansons personnalisées
                  </p>

                  <h4 className="text-base font-black text-white leading-tight">
                    {headline || (
                      <>
                        Offre une chanson <br />
                        qui fera <em className="italic" style={{ color: accentColor }}>pleurer de joie</em>.
                      </>
                    )}
                  </h4>

                  <p className="text-[11px] text-[#8A90A0] max-w-[280px] mx-auto leading-relaxed">
                    {bio || 'En 30 secondes, crée la surprise dont on parlera pendant des années.'}
                  </p>

                  {/* Bouton CTA Principal */}
                  <div className="pt-1">
                    <div
                      className="w-full py-2.5 px-4 rounded-xl text-center font-bold text-xs text-white shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: accentColor }}
                    >
                      Commencer ma chanson →
                    </div>
                    <p className="text-[9px] text-white/50 mt-1.5">
                      Commande aujourd'hui, reçois ta chanson en moins de 5 min.
                    </p>
                  </div>

                  {/* Badges de réassurance djelia.store */}
                  <div className="flex items-center justify-center gap-1.5 text-[8px] font-mono text-white/60 pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">Moins de 5 min</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">2 versions</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">100% sur-mesure</span>
                  </div>
                </div>

                {/* Tunnel de Commande — Étape 1 : Styles Musicaux */}
                <div
                  className="p-3.5 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: currentTheme.card,
                    borderColor: currentTheme.border,
                  }}
                >
                  <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                      <Music2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      <span className="text-[11px] font-bold text-white">1. Choisis le style musical</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#E2BD6B] font-bold">1 200 F</span>
                  </div>

                  {/* Guide vocal */}
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}25`, color: accentColor }}>
                      <Music2 className="w-3 h-3" />
                    </div>
                    <p className="text-[9px] text-white/70 leading-snug">
                      <strong>Tu hésites ?</strong> Écoute les démos studio ci-dessous.
                    </p>
                  </div>

                  {/* Grille de 6 styles comme sur djelia.store */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { name: 'Zouk', active: true, tag: 'Romantique' },
                      { name: 'Afrobeat', active: false, tag: 'Rythmé' },
                      { name: 'Coupé-décalé', active: false, tag: 'Festif' },
                      { name: 'Rumba', active: false, tag: 'Doux' },
                      { name: 'Pop Love', active: false, tag: 'Moderne' },
                      { name: 'Gospel', active: false, tag: 'Émouvant' },
                    ].map((st) => (
                      <div
                        key={st.name}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          st.active
                            ? 'bg-white/[0.08] shadow-sm'
                            : 'bg-black/30 border-white/[0.06] opacity-75'
                        }`}
                        style={{
                          borderColor: st.active ? accentColor : undefined,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white">{st.name}</span>
                          {st.active && (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: accentColor }}
                            />
                          )}
                        </div>
                        <span className="text-[8px] text-[#8A90A0]">{st.tag}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bouton de passage à l'étape suivante */}
                  <div
                    className="py-2 rounded-xl text-center font-bold text-[11px] text-black shadow-sm cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    Continuer avec ce style →
                  </div>
                </div>

                {/* Bouton WhatsApp Flottant dans l'aperçu */}
                {showWhatsApp && (
                  <div className="sticky bottom-2 flex justify-end pointer-events-none">
                    <div className="px-3 py-1.5 rounded-full bg-[#121B17] border border-[#25D366]/60 shadow-xl flex items-center gap-1.5 text-[#25D366] text-[10px] font-bold pointer-events-auto">
                      <MessageCircle className="w-3 h-3 fill-[#25D366]" />
                      <span>Aide {studioName || 'Mon Studio'}</span>
                    </div>
                  </div>
                )}

                {/* Footer djelia.store */}
                <div className="pt-2 text-center text-[9px] text-white/40">
                  © {new Date().getFullYear()} {studioName || 'Mon Studio'} · Moteur djelia.store · 1 200 F CFA
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* ONGLET 2 : AFFILIATION 50% & RETRAITS DIRECTS WHATSAPP       */
        /* ============================================================ */
        <div className="space-y-6">
          {/* CARTE SOLDE 50% GÉANTE (Stripe Glow) */}
          <section className="stripe-glow-card rounded-[28px] p-6 space-y-5 border border-white/[0.12]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/75">Commissions Disponibles</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  50% NET
                </span>
              </div>
              <span className="text-xs font-semibold text-[#E2BD6B] font-mono">
                600 F CFA / vente
              </span>
            </div>

            <div className="text-4xl sm:text-5xl font-extrabold text-white tabular-nums leading-none tracking-tight">
              {balanceCfa.toLocaleString('fr-FR')} <span className="text-xl font-sans text-white/60">F CFA</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/[0.08] text-center">
              <div>
                <p className="text-[11px] text-[#8A90A0]">Visites / Clics</p>
                <p className="text-base font-bold text-white font-mono mt-0.5">{totalClicks}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#8A90A0]">Ventes Livrées</p>
                <p className="text-base font-bold text-[#10D98E] font-mono mt-0.5">{totalSales}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#8A90A0]">Taux Conversion</p>
                <p className="text-base font-bold text-[#E2BD6B] font-mono mt-0.5">
                  {totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <span className="text-xs text-white/60">
                Seuil de retrait : <strong className="text-white">1 500 F CFA</strong> (par Wave ou Orange Money)
              </span>

              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(true)}
                disabled={balanceCfa < minWithdrawThreshold}
                className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                  balanceCfa >= minWithdrawThreshold
                    ? 'bg-white text-black hover:bg-white/90 shadow-lg cursor-pointer hover:scale-[1.02]'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>
                  {balanceCfa >= minWithdrawThreshold
                    ? 'Demander mon virement WhatsApp'
                    : `Encore ${(minWithdrawThreshold - balanceCfa).toLocaleString('fr-FR')} F CFA`}
                </span>
              </button>
            </div>
          </section>

          {/* Liens de partage uniques */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#E2BD6B]" />
              <h3 className="text-sm font-semibold text-white">Vos Liens de Diffusion (50% de commission nette)</h3>
            </div>
            <p className="text-xs text-[#8A90A0] leading-relaxed">
              Partagez l'un de ces liens sur vos statuts WhatsApp, TikTok ou Instagram. Le site s'habillera automatiquement à vos couleurs et chaque vente vous rapportera automatiquement 600 F CFA.
            </p>

            <div className="space-y-3">
              {/* Lien 1 : Studio complet djelia.store */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-white/70">1. Lien Direct vers votre Studio en ligne :</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white/90 font-mono truncate">
                    {miniSiteUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(miniSiteUrl, 'mini')}
                    className="px-4 py-3 rounded-2xl bg-white text-black text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer hover:bg-neutral-200 transition-colors"
                  >
                    {copiedKey === 'mini' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'mini' ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              {/* Lien 2 : Lien court vitrine */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-white/70">2. Adresse courte personnalisée :</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white/90 font-mono truncate">
                    {shortSlugUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(shortSlugUrl, 'mini')}
                    className="px-4 py-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Historique des Commandes & Commissions en Direct */}
          <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.06] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#10D98E]" />
                <h3 className="text-sm font-semibold text-white">Journal des Ventes & Commissions</h3>
              </div>
              {loadingStats && (
                <div className="flex items-center gap-1 text-[10px] text-white/50 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-[#E2BD6B]" />
                  <span>Synchronisation...</span>
                </div>
              )}
            </div>

            {stats.commissions && stats.commissions.length > 0 ? (
              <div className="space-y-2">
                {stats.commissions.map((c, i) => (
                  <div
                    key={c.order_id || i}
                    className="p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.06] flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">Réf: {c.order_id?.substring(0, 8) || 'CMD'}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 font-mono font-semibold">
                          Confirmée
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8A90A0]">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Récemment'} · Formule 1 200 F
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-extrabold text-[#10D98E] font-mono">
                        +{c.commission || 600} F CFA
                      </span>
                      <p className="text-[9px] text-white/40">50% net</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#06070A] border border-white/[0.04] text-center space-y-2">
                <p className="text-xs font-semibold text-white/80">Aucune commande enregistrée pour l'instant</p>
                <p className="text-[11px] text-[#8A90A0] max-w-sm mx-auto leading-relaxed">
                  Dès qu'un client passe commande via votre lien ou votre vitrine personnalisée sur djelia.store, votre commission de 600 F CFA s'affichera ici en temps réel.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL DE RETRAIT DIRECT VIA WHATSAPP */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0D0F14] border border-white/[0.12] p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#E2BD6B]" />
                <h3 className="text-base font-bold text-white">Retrait de Commissions (50%)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#06070A] border border-white/[0.08] text-center space-y-1">
              <p className="text-xs text-[#8A90A0]">Montant à verser sur votre compte :</p>
              <p className="text-2xl font-black text-white font-mono">
                {balanceCfa.toLocaleString('fr-FR')} F CFA
              </p>
              <p className="text-[11px] text-[#10D98E]">Virement direct sans aucun intermédiaire</p>
            </div>

            <form onSubmit={handleRequestWithdraw} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Opérateur Mobile Money
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Wave', 'Orange Money', 'Moov', 'MTN'].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setWithdrawOperator(op)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer text-center ${
                        withdrawOperator === op
                          ? 'bg-white text-black border-white font-bold'
                          : 'bg-[#06070A] border-white/[0.08] text-[#8A90A0] hover:text-white'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="payout-phone" className="block text-xs font-medium text-[#8A90A0]">
                  Numéro de réception ({withdrawOperator})
                </label>
                <input
                  id="payout-phone"
                  type="tel"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 ou +226 70 00 00 00"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#06070A] border border-white/[0.08] text-sm text-white tabular-nums focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="payout-name" className="block text-xs font-medium text-[#8A90A0]">
                  Nom et prénom du titulaire du compte
                </label>
                <input
                  id="payout-name"
                  type="text"
                  value={withdrawName}
                  onChange={(e) => setWithdrawName(e.target.value)}
                  placeholder="Ex : Awa Diallo"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={withdrawSuccess}
                  className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {withdrawSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-[#10D98E]" />
                      <span>Redirection WhatsApp en cours…</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      <span>Envoyer la demande sur WhatsApp</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[#8A90A0] text-center leading-relaxed">
                Vous serez redirigé sur le WhatsApp officiel de l'équipe avec votre message déjà rédigé.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
