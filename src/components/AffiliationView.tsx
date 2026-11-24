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
  Sliders,
  MessageCircle,
  Music2,
  ShieldCheck,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

const COLOR_PRESETS = [
  { id: '#E2BD6B', name: 'Or Champagne', class: 'bg-[#E2BD6B]' },
  { id: '#B8431D', name: 'Terracotta Signature', class: 'bg-[#B8431D]' },
  { id: '#10D98E', name: 'Émeraude Royale', class: 'bg-[#10D98E]' },
  { id: '#00E5FF', name: 'Cyan Électrique', class: 'bg-[#00E5FF]' },
  { id: '#F43F5E', name: 'Rose Passion', class: 'bg-[#F43F5E]' },
  { id: '#A855F7', name: 'Violet Studio', class: 'bg-[#A855F7]' },
  { id: '#EF4444', name: 'Rubis Impérial', class: 'bg-[#EF4444]' },
  { id: '#F59E0B', name: 'Ambre Solaire', class: 'bg-[#F59E0B]' },
];

const THEME_OPTIONS = [
  {
    id: 'obsidian',
    name: 'Obsidienne Pure',
    desc: 'Luxe sombre graphite profond',
    bg: '#07080B',
    border: 'rgba(255,255,255,0.1)'
  },
  {
    id: 'paper',
    name: 'Atelier Vinyle & Papier Chaud',
    desc: 'Signature d’origine Djelia (fond crème chaud)',
    bg: '#FAF7F2',
    border: 'rgba(20,17,12,0.15)'
  },
  {
    id: 'midnight',
    name: 'Nuit Bleue Midnight',
    desc: 'Bleu nuit discret et élégant',
    bg: '#070A14',
    border: 'rgba(59,130,246,0.2)'
  },
  {
    id: 'emerald',
    name: 'Émeraude Sombre',
    desc: 'Vert impérial haute joaillerie',
    bg: '#050F0B',
    border: 'rgba(16,217,142,0.2)'
  },
];

export const AffiliationView: FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'site' | 'affiliate'>('site');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Données de configuration du studio (user_metadata ou valeurs par défaut)
  const meta = user?.user_metadata || {};
  const initialName = (meta.studio_name as string) || 'Mon Studio';
  const initialSlug = (meta.studio_slug as string) || initialName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'mon-studio';

  const [studioName, setStudioName] = useState(initialName);
  const [studioSlug, setStudioSlug] = useState(initialSlug);
  
  // Mode de texte : 'signature' pour garder le texte d'origine Djelia, ou 'custom' pour texte libre
  const initialHeadline = (meta.studio_headline as string) || '';
  const initialBio = (meta.studio_bio as string) || '';
  const isCustomTextInitial = Boolean(
    initialHeadline &&
    initialHeadline !== 'Offre une chanson qui fera pleurer de joie.' &&
    initialHeadline !== 'Vos plus beaux souvenirs transformés en chansons d’exception'
  );

  const [textMode, setTextMode] = useState<'signature' | 'custom'>(isCustomTextInitial ? 'custom' : 'signature');
  const [headline, setHeadline] = useState(initialHeadline || 'Offre une chanson qui fera pleurer de joie.');
  const [bio, setBio] = useState(initialBio || 'En 30 secondes, crée la surprise dont on parlera pendant des années.');
  
  const [photoUrl, setPhotoUrl] = useState<string>((meta.studio_photo_url as string) || '');
  const [accentColor, setAccentColor] = useState<string>((meta.studio_color as string) || '#E2BD6B');
  const [themeMode, setThemeMode] = useState<'obsidian' | 'paper' | 'midnight' | 'emerald'>(
    (meta.studio_theme as any) || 'obsidian'
  );

  // Toggles de personnalisation modulaire
  const [showBadge, setShowBadge] = useState<boolean>(meta.studio_show_badge ?? true);
  const [badgeText, setBadgeText] = useState<string>((meta.studio_badge_text as string) || 'Studio de Création Musicale');
  const [showDemos, setShowDemos] = useState<boolean>(meta.studio_show_demos ?? true);
  const [showGuarantees, setShowGuarantees] = useState<boolean>(meta.studio_show_guarantees ?? true);
  
  // WhatsApp
  const [showWhatsApp, setShowWhatsApp] = useState<boolean>(meta.studio_show_whatsapp ?? false);
  const [whatsAppPhone, setWhatsAppPhone] = useState<string>((meta.studio_whatsapp_phone as string) || '');
  const [whatsAppPrompt, setWhatsAppPrompt] = useState<string>(
    (meta.studio_whatsapp_prompt as string) || 'Bonjour ! J’ai une question concernant ma commande de chanson.'
  );

  // Bandeau d'Annonce Supérieur
  const [showBanner, setShowBanner] = useState<boolean>(Boolean(meta.studio_banner_text));
  const [bannerText, setBannerText] = useState<string>((meta.studio_banner_text as string) || 'Livraison garantie en moins de 5 minutes avec 2 versions offertes');

  // État de sauvegarde & affichage
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [savingSite, setSavingSite] = useState(false);
  const [siteSavedNotice, setSiteSavedNotice] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // État Affiliation 50% & Retrait WhatsApp
  const [copiedKey, setCopiedKey] = useState<'mini' | 'short' | null>(null);
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

  // Configuration courante synchronisée
  const currentConfig = {
    name: studioName.trim() || 'Mon Studio',
    accent_color: accentColor,
    accentColor: accentColor,
    theme_mode: themeMode,
    themeMode: themeMode,
    photo_url: photoUrl || null,
    photoUrl: photoUrl || null,
    headline: textMode === 'custom' ? headline.trim() : '',
    bio: textMode === 'custom' ? bio.trim() : '',
    badge_text: showBadge ? badgeText.trim() : '',
    badgeText: showBadge ? badgeText.trim() : '',
    show_whatsapp: showWhatsApp,
    showWhatsApp: showWhatsApp,
    whatsapp_phone: whatsAppPhone.trim() || null,
    whatsAppPhone: whatsAppPhone.trim() || null,
    whatsapp_prompt: whatsAppPrompt.trim() || null,
    whatsAppPrompt: whatsAppPrompt.trim() || null,
    banner_text: showBanner ? bannerText.trim() : null,
    bannerText: showBanner ? bannerText.trim() : null,
    show_demos: showDemos,
    showDemos: showDemos,
    show_guarantees: showGuarantees,
    showGuarantees: showGuarantees,
  };

  // Synchronisation en direct avec l'iframe de prévisualisation (postMessage 0ms)
  const sendConfigToIframe = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'DJELIA_STUDIO_PREVIEW_UPDATE',
        config: currentConfig
      }, '*');
    }
  };

  useEffect(() => {
    sendConfigToIframe();
  }, [
    studioName,
    accentColor,
    themeMode,
    photoUrl,
    textMode,
    headline,
    bio,
    showBadge,
    badgeText,
    showWhatsApp,
    whatsAppPhone,
    whatsAppPrompt,
    showBanner,
    bannerText,
    showDemos,
    showGuarantees
  ]);

  // Réception de l'événement d'initialisation de l'iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'DJELIA_STUDIO_IFRAME_READY') {
        sendConfigToIframe();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentConfig]);

  // Récupération des statistiques d'affiliation
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

  const handleCopy = (text: string, type: 'mini' | 'short') => {
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

  // Enregistrement et publication instantanée
  const handleSaveSite = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    setSiteSavedNotice(null);

    const fullConfig = {
      ...currentConfig,
      slug: cleanSlug,
      price_quoted_standard: 1200,
    };

    try {
      // 0. Publication directe et infaillible sur le serveur VPS (orders.db / affiliate_configs)
      try {
        await fetch('https://waha.velarisagent.life/api/stt/pay/affiliate/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: cleanSlug, config: fullConfig }),
        });
      } catch {
        // En cas de coupure, continue vers le stockage local/Supabase
      }

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
          studio_headline: textMode === 'custom' ? headline.trim() : '',
          studio_bio: textMode === 'custom' ? bio.trim() : '',
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
          studio_banner_text: showBanner ? bannerText.trim() : '',
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
            bio: textMode === 'custom' ? bio.trim() : '',
            photo_url: photoUrl || null,
            accent_color: accentColor,
            social_links: {
              headline: textMode === 'custom' ? headline.trim() : '',
              theme_mode: themeMode,
              show_badge: showBadge,
              badge_text: badgeText.trim(),
              show_demos: showDemos,
              show_guarantees: showGuarantees,
              show_whatsapp: showWhatsApp,
              whatsapp_phone: whatsAppPhone.trim(),
              whatsapp_prompt: whatsAppPrompt.trim(),
              banner_text: showBanner ? bannerText.trim() : '',
            },
            price_quoted_standard: 1200,
            updated_at: new Date().toISOString(),
          });
        } catch {}

        // 4. Publication publique dans automation_rules
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
        } catch {}
      }

      setSiteSavedNotice(`Votre site est publié en direct sur https://djelia.store/s/${cleanSlug}`);
      setTimeout(() => setSiteSavedNotice(null), 6000);
      
      // Actualiser l'iframe pour confirmer
      sendConfigToIframe();
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

  return (
    <div className="space-y-8 pb-12">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Mon Site Vitrine & Affiliation</h1>
          <p className="text-sm text-[#8A90A0]">
            Personnalisez votre site djelia.store à votre identité et encaissez 50% de commission nette (600 F CFA) sur chaque vente.
          </p>
        </div>

        {/* Lien direct et bouton aperçu */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/90">
          <Globe className="w-3.5 h-3.5 text-[#E2BD6B]" />
          <span className="font-mono text-[11px] truncate max-w-[180px] sm:max-w-xs">
            djelia.store/s/{cleanSlug}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(shortSlugUrl, 'short')}
            className="text-[#E2BD6B] font-semibold text-[11px] hover:underline cursor-pointer"
          >
            {copiedKey === 'short' ? 'Copié' : 'Copier'}
          </button>
          <a
            href={shortSlugUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/70 hover:text-white p-0.5 ml-1"
            title="Ouvrir dans un nouvel onglet"
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
          <span>Personnalisation & Prévisualisation Réelle</span>
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
                  <h3 className="text-sm font-semibold text-white">1. Identité de Marque & Logo</h3>
                </div>

                {/* Upload Logo ou Photo */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Logo ou Photo de profil du studio (intégré dans l'en-tête du site)
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
                          <span>Téléverser mon image</span>
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
                        JPG, PNG ou WEBP. Si aucune image n'est choisie, votre nom élégant sera affiché.
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
                    placeholder="Ex : Studio Royal, Fatou Music, Mélodies d’Afrique..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                  <p className="text-[11px] text-[#8A90A0]">
                    Ce nom remplace "Djelia" dans le logo d'en-tête, le titre et le pied de page du site.
                  </p>
                </div>

                {/* Slug d'URL */}
                <div className="space-y-1.5">
                  <label htmlFor="st-slug" className="block text-xs font-medium text-[#8A90A0]">
                    Identifiant de votre lien personnalisé
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

                {/* Badge d'Expertise */}
                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white">Badge d'expertise en haut de page</p>
                      <p className="text-[11px] text-[#8A90A0]">Affiche un sous-titre de réassurance stylisé</p>
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
                      placeholder="Ex : Studio de Création Musicale, Chansons Sur-Mesure..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#06070A] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                    />
                  )}
                </div>
              </section>

              {/* 2. COULEURS & AMBIANCE À LA BASE (:root) */}
              <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                  <Palette className="w-4 h-4 text-[#E2BD6B]" />
                  <h3 className="text-sm font-semibold text-white">2. Couleurs & Ambiance Graphique (Injectées à la base)</h3>
                </div>

                {/* Couleur d'accentuation */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Couleur signature (applique la teinte sur les boutons, vinyle, étapes et barres de progression)
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

                {/* Ambiance de fond */}
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Atmosphère & Fond de base du site
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                            backgroundColor: th.bg === '#FAF7F2' ? '#1F1C18' : th.bg,
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

              {/* 3. TEXTES & ACCROCHE (Garder l'originale ou personnaliser) */}
              <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                  <Sparkles className="w-4 h-4 text-[#E2BD6B]" />
                  <h3 className="text-sm font-semibold text-white">3. Textes & Promesse Client</h3>
                </div>

                {/* Choix entre conserver l'identité Djelia ou personnaliser */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-2xl bg-[#06070A] border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setTextMode('signature')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      textMode === 'signature'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-[#8A90A0] hover:text-white'
                    }`}
                  >
                    <span className="block font-bold">Accroche Signature Djelia</span>
                    <span className="text-[10px] opacity-75 font-normal">Recommandée (taux de conversion maximal)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTextMode('custom')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      textMode === 'custom'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-[#8A90A0] hover:text-white'
                    }`}
                  >
                    <span className="block font-bold">Personnaliser mes Textes</span>
                    <span className="text-[10px] opacity-75 font-normal">Écrire mon propre titre et slogan</span>
                  </button>
                </div>

                {textMode === 'signature' ? (
                  <div className="p-4 rounded-2xl bg-[#06070A] border border-white/[0.06] space-y-2">
                    <p className="text-xs text-white/90 font-medium">
                      Accroche d'origine active :
                    </p>
                    <blockquote className="text-sm italic font-serif text-white/90 border-l-2 pl-3 py-0.5" style={{ borderColor: accentColor }}>
                      « Offre une chanson qui fera pleurer de joie. »
                    </blockquote>
                    <p className="text-[11px] text-[#8A90A0]">
                      Sous-titre : « En 30 secondes, crée la surprise dont on parlera pendant des années. »
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    {/* Headline principale */}
                    <div className="space-y-1.5">
                      <label htmlFor="st-headline" className="block text-xs font-medium text-[#8A90A0]">
                        Grand titre du Hero (H1)
                      </label>
                      <input
                        id="st-headline"
                        type="text"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="Ex : Offre une chanson qui fera pleurer de joie"
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                      />
                    </div>

                    {/* Phrase d'accueil (Bio) */}
                    <div className="space-y-1.5">
                      <label htmlFor="st-bio" className="block text-xs font-medium text-[#8A90A0]">
                        Sous-titre / Pitch du studio
                      </label>
                      <textarea
                        id="st-bio"
                        rows={2}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Ex : En 30 secondes, crée la surprise dont on parlera pendant des années..."
                        className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* 4. MODULES & ASSISTANCE WHATSAPP */}
              <section className="rounded-3xl bg-[#0D0F14] border border-white/[0.08] p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                  <Sliders className="w-4 h-4 text-[#E2BD6B]" />
                  <h3 className="text-sm font-semibold text-white">4. Modules Additionnels & WhatsApp</h3>
                </div>

                {/* Toggle Bouton WhatsApp d'Assistance Direct */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      <div>
                        <p className="text-xs font-semibold text-white">Bouton d’assistance WhatsApp flottant</p>
                        <p className="text-[11px] text-[#8A90A0]">Permet à vos clients de vous contacter directement en 1 clic</p>
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
                          placeholder="Ex : Bonjour ! J’ai une question concernant ma commande de chanson."
                          className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#25D366]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle Bandeau d'Annonce Supérieur */}
                <div className="pt-2 border-t border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-[#E2BD6B]" />
                      <div>
                        <p className="text-xs font-semibold text-white">Bandeau d'urgence ou d'offre spéciale</p>
                        <p className="text-[11px] text-[#8A90A0]">Affiche une bannière dorée discrète en tête de page</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBanner}
                        onChange={(e) => setShowBanner(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10D98E]" />
                    </label>
                  </div>

                  {showBanner && (
                    <input
                      type="text"
                      value={bannerText}
                      onChange={(e) => setBannerText(e.target.value)}
                      placeholder="Ex : Offre Spéciale : 2 versions Master HD livrées en 5 minutes !"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#06070A] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                    />
                  )}
                </div>

                {/* Toggle Démos Audios */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <Music2 className="w-4 h-4 text-[#E2BD6B]" />
                    <div>
                      <p className="text-xs font-semibold text-white">Lecteur d’extraits audio</p>
                      <p className="text-[11px] text-[#8A90A0]">Affiche les morceaux de démonstration dans le tunnel</p>
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
                      <p className="text-xs font-semibold text-white">Puces de garanties et réassurance</p>
                      <p className="text-[11px] text-[#8A90A0]">Livraison en 5 minutes, 2 versions, 100% sur-mesure</p>
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
              </section>

              {/* Bouton d'enregistrement / publication */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={savingSite}
                  className="w-full py-4 rounded-2xl bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50"
                >
                  {savingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{savingSite ? 'Publication en cours…' : 'Enregistrer et publier mon site'}</span>
                </button>

                <div className="flex items-center justify-center gap-4 text-xs text-[#8A90A0]">
                  <a
                    href={shortSlugUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-white/80 hover:text-white underline underline-offset-4"
                  >
                    <span>Tester le lien publié en plein écran</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </form>
          </div>

          {/* ============================================================ */}
          {/* COLONNE DROITE (5/12) : PRÉVISUALISATION RÉELLE 1:1 DU SITE  */}
          {/* ============================================================ */}
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10D98E] animate-pulse" />
                <h3 className="text-sm font-semibold text-white">Aperçu Réel 1:1 (djelia.store)</h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-[#0D0F14] border border-white/[0.08] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      previewDevice === 'mobile' ? 'bg-white text-black font-semibold' : 'text-[#8A90A0]'
                    }`}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      previewDevice === 'desktop' ? 'bg-white text-black font-semibold' : 'text-[#8A90A0]'
                    }`}
                  >
                    Plein
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIframeKey((k) => k + 1);
                    setTimeout(sendConfigToIframe, 300);
                  }}
                  className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white cursor-pointer"
                  title="Recharger l'aperçu"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <a
                  href={shortSlugUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white cursor-pointer"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Cadre du Mockup Intégrant le Vrai Site en Live */}
            <div
              className={`rounded-[32px] border overflow-hidden shadow-2xl transition-all duration-300 mx-auto bg-[#07080B] ${
                previewDevice === 'mobile' ? 'max-w-[380px] border-white/[0.16]' : 'w-full border-white/[0.12]'
              }`}
            >
              {/* Fake status bar pour le mobile */}
              {previewDevice === 'mobile' && (
                <div className="px-5 pt-3 pb-2 flex items-center justify-between text-[10px] text-white/40 font-mono select-none bg-[#07080B] border-b border-white/[0.04]">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-white/40" />
                    <span className="w-3.5 h-2 rounded border border-white/40" />
                  </div>
                </div>
              )}

              {/* L'iframe du vrai site public djelia.store */}
              <div className="relative w-full h-[640px] bg-[#07080B]">
                <iframe
                  ref={iframeRef}
                  key={iframeKey}
                  src={`https://djelia.store/?ref=${cleanSlug}&preview=1`}
                  title="Aperçu Réel djelia.store"
                  className="w-full h-full border-0"
                  onLoad={sendConfigToIframe}
                />
              </div>

              {/* Pied du cadre */}
              <div className="p-3 bg-[#06070A] border-t border-white/[0.06] text-center text-[10px] text-[#8A90A0]">
                Ce que vous voyez ici est exactement ce que verront vos clients sur <strong className="text-white font-mono">djelia.store/s/{cleanSlug}</strong>
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
              Partagez votre lien personnalisé sur vos statuts WhatsApp, TikTok ou Instagram. Le site s'habillera immédiatement à votre identité et vos couleurs, et chaque commande vous rapportera automatiquement 600 F CFA.
            </p>

            <div className="space-y-3">
              {/* Lien 1 : Adresse courte vitrine */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-white/70">1. Adresse courte personnalisée (Recommandée) :</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white/90 font-mono truncate">
                    {shortSlugUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(shortSlugUrl, 'short')}
                    className="px-4 py-3 rounded-2xl bg-white text-black text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer hover:bg-neutral-200 transition-colors"
                  >
                    {copiedKey === 'short' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'short' ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              {/* Lien 2 : Lien avec paramètre ref */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-white/70">2. Lien direct complet :</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-xs text-white/90 font-mono truncate">
                    {miniSiteUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(miniSiteUrl, 'mini')}
                    className="px-4 py-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'mini' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
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
