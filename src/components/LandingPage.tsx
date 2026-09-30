import { useState, type FC } from 'react';
import { 
  Play, 
  Pause, 
  Sparkles, 
  MessageCircle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Star, 
  Music, 
  ChevronDown, 
  Headphones
} from 'lucide-react';

interface LandingPageProps {
  onOpenStudio: () => void;
  onOpenCockpit: () => void;
}

interface AudioSample {
  id: string;
  title: string;
  recipient: string;
  occasion: string;
  style: string;
  duration: string;
  audioUrl: string;
  lyricsSnippet: string;
  tag: string;
}

const SAMPLES: AudioSample[] = [
  {
    id: 'afro_love_awa',
    title: 'Awa, Mon Amour Précieux',
    recipient: 'Awa',
    occasion: 'Anniversaire de Mariage (5 ans)',
    style: 'Afro-Love Moderne',
    duration: '0:48',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    lyricsSnippet: '« Cinq ans déjà qu’on marche main dans la main,\nQuand le vent soufflait fort, t’as tracé le chemin.\nAwa mon amour, ma reine couronnée,\nPour toute la vie, mon âme t’est donnée… »',
    tag: 'Romantique & Festif',
  },
  {
    id: 'acoustique_maman',
    title: 'Merci Maman Marie',
    recipient: 'Maman Marie',
    occasion: 'Anniversaire & Hommage',
    style: 'Guitare Acoustique Douce',
    duration: '0:42',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    lyricsSnippet: '« T’as bravé les tempêtes sans jamais faiblir,\nPour nous voir grandir, pour nous voir sourire.\nMerci maman, ange de notre vie,\nQue la grâce du Très-Haut sur toi soit bénie… »',
    tag: 'Émouvant & Poignant',
  },
  {
    id: 'rumba_fadila',
    title: 'Fadila, Ma Fleur Sacrée',
    recipient: 'Fadila',
    occasion: 'Dot & Mariage Coutumier',
    style: 'Rumba Congolaise',
    duration: '0:50',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    lyricsSnippet: '« De Ouaga jusqu’à Bobo, j’ai cherché la perle rare,\nEt c’est dans tes yeux doux que s’est posé mon regard.\nFadila, yaa mam nonga,\nPour toi je donne tout, ma magnifique promise… »',
    tag: 'Mélodique & Entraînant',
  },
  {
    id: 'gospel_grace',
    title: 'Reconnaissance Infinie',
    recipient: 'Pasteur David & Famille',
    occasion: 'Action de Grâce',
    style: 'Gospel & Louange',
    duration: '0:45',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    lyricsSnippet: '« Que la gloire revienne au Créateur de nos jours,\nPour ta bonté infinie et ton fidèle amour.\nDans la louange nos voix s’élèvent en chœur,\nTu as comblé nos vies de paix et de douceur… »',
    tag: 'Spirituel & Puissant',
  },
];

const FAQS = [
  {
    q: 'Comment raconter mon histoire pour créer la chanson ?',
    a: 'C’est très simple ! Cliquez sur le bouton WhatsApp et envoyez-nous une courte note vocale ou un message texte. Dites-nous le prénom de la personne, votre lien avec elle, l’occasion (anniversaire, mariage, amour, hommage) et 2 ou 3 anecdotes ou souvenirs qui vous tiennent à cœur.',
  },
  {
    q: 'Dois-je payer avant de voir le texte de la chanson ?',
    a: 'Non, absolument pas ! C’est notre garantie sérénité : nous écrivons d’abord les paroles complètes de votre chanson gratuitement. Vous relisez tranquillement sur WhatsApp, vous nous dites si vous souhaitez modifier un mot ou ajouter un détail. Vous ne réglez qu’une fois le texte 100% validé.',
  },
  {
    q: 'Combien de temps prend la livraison ?',
    a: 'La rédaction des paroles prend environ 8 minutes. Une fois votre texte validé et la commande confirmée, le studio enregistre et masterise votre chanson. Le fichier final MP3 HD (ou vidéo) vous est livré directement sur WhatsApp en 15 à 20 minutes en moyenne.',
  },
  {
    q: 'Quels sont les moyens de paiement acceptés ?',
    a: 'Nous acceptons tous les paiements Mobile Money locaux sécurisés : Wave (Côte d’Ivoire, Sénégal), Orange Money (Burkina Faso, Côte d’Ivoire, Sénégal, Mali), Moov Money et MTN. Aucun paiement par carte bancaire obligatoire.',
  },
  {
    q: 'Quelle est la différence entre la formule à 1 200 F et celle à 3 000 F ?',
    a: 'La formule à 1 200 F CFA vous donne la chanson complète en haute qualité audio MP3 Studio. La formule à 3 000 F CFA (notre formule la plus populaire) comprend la chanson MP3 + une vidéo karaoké personnalisée avec défilement des paroles en musique et l’intégration de 3 à 5 de vos plus belles photos, prête à poster sur statut WhatsApp, TikTok ou Instagram !',
  },
];

export const LandingPage: FC<LandingPageProps> = ({ onOpenStudio, onOpenCockpit }) => {
  const [activeSampleId, setActiveSampleId] = useState(SAMPLES[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const activeSample = SAMPLES.find((s) => s.id === activeSampleId) || SAMPLES[0];

  const handleOrderWhatsApp = (styleName?: string) => {
    const text = encodeURIComponent(
      `Bonjour le Studio Velaris ! 👋 Je souhaite commander une chanson personnalisée${styleName ? ` dans le style ${styleName}` : ''}. Pouvez-vous m'expliquer le déroulé ?`
    );
    window.open(`https://wa.me/22656240533?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-20 pb-24 text-white">
      {/* 1. HERO SECTION */}
      <section className="relative pt-6 sm:pt-12 pb-10 overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-1.5 text-xs font-semibold text-[#e5c158] shadow-[0_0_20px_rgba(212,175,55,0.15)]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Studio Artisanal & Musical N°1 en Afrique de l'Ouest</span>
          </div>

          {/* Master Headline */}
          <h1 className="font-['Space_Grotesk'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Offrez une vraie chanson personnalisée à{' '}
            <span className="bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#c59e2b] bg-clip-text text-transparent">
              ceux qui comptent le plus.
            </span>
          </h1>

          {/* Emotional Subtitle */}
          <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed font-normal">
            Racontez votre histoire en quelques mots par note vocale WhatsApp. Nos compositeurs et l'IA créent votre chanson sur-mesure, masterisée et livrée en <strong>18 minutes chrono</strong>.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleOrderWhatsApp()}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#c59e2b] px-7 py-4 text-sm font-extrabold text-[#090a0f] shadow-[0_0_35px_rgba(212,175,55,0.35)] transition-all hover:scale-105 active:scale-95"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Commander ma Chanson sur WhatsApp</span>
            </button>

            <a
              href="#ecouter"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/90 hover:bg-white/[0.08] transition-all"
            >
              <Headphones className="h-4 w-4 text-[#e5c158]" />
              <span>Écouter des extraits réels</span>
            </a>
          </div>

          {/* Social Proof Trust Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-white/60">
            <div className="flex items-center gap-1.5">
              <div className="flex text-[#e5c158]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <span className="font-bold text-white">4.9/5</span>
              <span>(1 240+ chansons créées)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Paroles gratuites avant paiement</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>Livraison ~18 minutes</span>
            </div>
          </div>
        </div>

        {/* Ambient floating music card preview */}
        <div className="mt-12 max-w-xl mx-auto rounded-3xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] via-[#12141c]/80 to-[#08090d] p-5 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#e5c158]">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-[#e5c158]">
                  Extrait Studio en cours de lecture
                </p>
                <p className="text-sm font-bold text-white">Awa, Mon Trésor Éternel</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
              Style Afro-Love
            </span>
          </div>

          {/* Sound wave bars */}
          <div className="py-4 flex items-center justify-between gap-1 h-12">
            {[10, 24, 18, 36, 14, 28, 42, 20, 32, 16, 40, 22, 18, 35, 12, 26, 38, 14, 30, 20, 16].map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}px` }}
                className="w-1.5 rounded-full bg-gradient-to-t from-[#d4af37]/60 to-[#f3e5ab] animate-pulse"
              />
            ))}
          </div>

          <div className="rounded-2xl bg-black/40 p-3 border border-white/[0.04] text-xs text-white/80 italic leading-relaxed text-center">
            « Awa, mon amour, ma reine couronnée, pour toute la vie mon âme t’est donnée… »
          </div>
        </div>
      </section>

      {/* 2. AUDIO SAMPLES PLAYER SECTION */}
      <section id="ecouter" className="space-y-6 pt-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e5c158]">
            Écoutez la Magie
          </span>
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-4xl font-extrabold text-white">
            Découvrez nos créations musicales réelles
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Chaque voix, chaque parole et chaque instrument sont personnalisés avec l'émotion exacte que vous souhaitez transmettre.
          </p>
        </div>

        {/* Style selection tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => {
                setActiveSampleId(sample.id);
                setIsPlaying(false);
              }}
              className={`rounded-2xl px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all border ${
                sample.id === activeSample.id
                  ? 'border-[#d4af37] bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/25'
                  : 'border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {sample.style}
            </button>
          ))}
        </div>

        {/* Interactive Master Player Card */}
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/[0.1] bg-gradient-to-br from-[#12141c] via-[#0e1017] to-[#08090d] p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-[#d4af37]/10 blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Player Controls (5 cols) */}
            <div className="md:col-span-5 space-y-4 text-center md:text-left">
              <div>
                <span className="rounded-md bg-[#d4af37]/15 px-2 py-0.5 text-[10px] font-bold text-[#e5c158] border border-[#d4af37]/25">
                  {activeSample.tag}
                </span>
                <h3 className="font-['Space_Grotesk'] text-xl font-bold text-white mt-2">
                  {activeSample.title}
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Pour <strong className="text-white">{activeSample.recipient}</strong> • {activeSample.occasion}
                </p>
              </div>

              {/* Play / Pause button & animated soundbar */}
              <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#d4af37] to-[#e5c158] text-black shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6 fill-current" />
                  ) : (
                    <Play className="h-6 w-6 fill-current ml-0.5" />
                  )}
                </button>
                <div className="text-left">
                  <span className="text-xs font-bold text-white block">
                    {isPlaying ? 'Lecture en cours…' : 'Appuyez pour écouter'}
                  </span>
                  <span className="text-[11px] font-mono text-white/40">Durée : {activeSample.duration}</span>
                </div>
              </div>

              {/* Order this specific style */}
              <button
                onClick={() => handleOrderWhatsApp(activeSample.style)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] px-4 py-2.5 text-xs font-semibold text-white/90 transition-all border border-white/[0.08]"
              >
                <MessageCircle className="h-4 w-4 text-emerald-400" />
                <span>Commander ce style sur WhatsApp</span>
              </button>
            </div>

            {/* Lyrics Sheet Display (7 cols) */}
            <div className="md:col-span-7 rounded-2xl border border-white/[0.06] bg-[#07080c]/80 p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e5c158] flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Extrait des Paroles
                </span>
                <span className="text-[10px] text-white/40 font-mono">100% Personnalisé</span>
              </div>

              <p className="text-xs sm:text-sm text-white/90 whitespace-pre-line leading-relaxed italic pl-3 border-l-2 border-[#d4af37]/40 font-sans">
                {activeSample.lyricsSnippet}
              </p>

              <div className="text-[11px] text-white/40 pt-2 flex items-center justify-between">
                <span>Rédigé sur-mesure pour Moussa</span>
                <span className="text-emerald-400 font-semibold">Validé avant paiement ✓</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS IN 3 STEPS */}
      <section className="space-y-8 pt-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e5c158]">
            Simplicité Absolue
          </span>
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-4xl font-extrabold text-white">
            Comment ça marche en 3 étapes
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Aucune compétence musicale requise. Tout se passe naturellement sur votre WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Step 1 */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md relative space-y-4 hover:border-[#d4af37]/30 transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#e5c158] font-bold text-lg">
              01
            </div>
            <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">
              Vous racontez votre histoire
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Envoyez-nous une note vocale ou un texte sur WhatsApp avec les prénoms, l’occasion (anniversaire, mariage, hommage) et vos plus beaux souvenirs.
            </p>
            <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Note vocale ou texte simple
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-3xl border border-[#d4af37]/30 bg-gradient-to-b from-[#18160c] to-[#0d0e14] p-6 backdrop-blur-md relative space-y-4 shadow-xl shadow-[#d4af37]/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d4af37] text-black font-extrabold text-lg">
              02
            </div>
            <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">
              Vous lisez & validez les paroles
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              En moins de 8 minutes, nous composons un texte poétique émouvant avec couplets et refrain. Vous relisez, ajustez et <strong>validez gratuitement sans payer d’avance</strong>.
            </p>
            <div className="text-[11px] text-[#e5c158] font-semibold flex items-center gap-1 pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% gratuit avant validation
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md relative space-y-4 hover:border-[#d4af37]/30 transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#e5c158] font-bold text-lg">
              03
            </div>
            <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">
              Votre chanson livrée en 18 min
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Après validation et paiement Mobile Money (Wave / Orange Money), notre studio masterise votre morceau audio ou vidéo et vous l’envoie directement sur WhatsApp.
            </p>
            <div className="text-[11px] text-blue-400 font-semibold flex items-center gap-1 pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Fichier MP3 HD + Vidéo
            </div>
          </div>
        </div>
      </section>

      {/* 4. PRICING OFFERS */}
      <section className="space-y-8 pt-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e5c158]">
            Tarifs Transparents
          </span>
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-4xl font-extrabold text-white">
            Des formules accessibles pour tous
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Aucun abonnement, aucun frais caché. Vous payez par Wave ou Orange Money uniquement après avoir validé votre texte.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          {/* Plan 1 */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">Formule Découverte</span>
              <h3 className="text-xl font-bold font-['Space_Grotesk'] text-white">Chanson Audio MP3 Studio</h3>
              <div className="pt-2">
                <span className="font-['Space_Grotesk'] text-3xl font-extrabold text-white">1 200</span>
                <span className="text-sm font-semibold text-white/60 ml-1">FCFA</span>
              </div>
              <p className="text-xs text-white/60">Le cadeau intime et touchant pour faire vibrer le cœur de vos proches.</p>
              
              <ul className="space-y-2.5 text-xs text-white/80 pt-2 border-t border-white/[0.06]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Paroles sur-mesure (couplets + refrain)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Chanson audio MP3 HD masterisée</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Dédicace des prénoms et souvenirs</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Livraison WhatsApp en ~18 min</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleOrderWhatsApp('Formule Audio 1200 F')}
              className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] py-3 text-xs font-bold text-white hover:bg-white/[0.08] transition-all"
            >
              Choisir la Formule 1 200 F
            </button>
          </div>

          {/* Plan 2: POPULAR */}
          <div className="rounded-3xl border-2 border-[#d4af37] bg-gradient-to-b from-[#1c190d] via-[#12141c] to-[#08090d] p-6 backdrop-blur-md flex flex-col justify-between space-y-6 relative shadow-2xl shadow-[#d4af37]/15">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#e5c158] px-4 py-1 text-[10px] font-extrabold uppercase tracking-wider text-black shadow-md">
              ★ Formule La Plus Populaire
            </div>

            <div className="space-y-4 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#e5c158]">Formule Complète</span>
              <h3 className="text-xl font-bold font-['Space_Grotesk'] text-white">Pack Vidéo Paroles + MP3</h3>
              <div className="pt-2">
                <span className="font-['Space_Grotesk'] text-3xl font-extrabold text-[#e5c158]">3 000</span>
                <span className="text-sm font-semibold text-white/60 ml-1">FCFA</span>
              </div>
              <p className="text-xs text-white/60">L'expérience totale avec un clip vidéo karaoké prêt à être partagé.</p>
              
              <ul className="space-y-2.5 text-xs text-white/90 pt-2 border-t border-white/[0.06]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#e5c158] shrink-0" />
                  <span><strong>Tout ce qui est dans la Formule 1 200 F</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#e5c158] shrink-0" />
                  <span><strong>Vidéo animée avec défilement des paroles</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#e5c158] shrink-0" />
                  <span>Intégration de 3 à 5 photos personnelles</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#e5c158] shrink-0" />
                  <span>Format optimisé Statut WhatsApp & Réseaux</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleOrderWhatsApp('Pack Vidéo 3000 F')}
              className="w-full rounded-2xl bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#c59e2b] py-3.5 text-xs font-extrabold text-black shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:scale-102 transition-all"
            >
              Commander le Pack Vidéo 3 000 F
            </button>
          </div>

          {/* Plan 3 */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Pack Prestige VIP</span>
              <h3 className="text-xl font-bold font-['Space_Grotesk'] text-white">Célébration Express Master</h3>
              <div className="pt-2">
                <span className="font-['Space_Grotesk'] text-3xl font-extrabold text-white">5 000</span>
                <span className="text-sm font-semibold text-white/60 ml-1">FCFA</span>
              </div>
              <p className="text-xs text-white/60">Pour les grandes occasions avec double version musicale et priorité absolue.</p>
              
              <ul className="space-y-2.5 text-xs text-white/80 pt-2 border-t border-white/[0.06]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Chanson MP3 HD + Vidéo Paroles complète</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>2 Versions musicales offertes (Afro + Acoustique)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Dédicace vocale parlée en introduction</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Livraison VIP Express sous 10 minutes</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleOrderWhatsApp('Pack VIP 5000 F')}
              className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] py-3 text-xs font-bold text-white hover:bg-white/[0.08] transition-all"
            >
              Choisir le Pack VIP 5 000 F
            </button>
          </div>
        </div>
      </section>

      {/* 5. CUSTOMER TESTIMONIALS */}
      <section className="space-y-6 pt-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e5c158]">
            Émotions Vécues
          </span>
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-4xl font-extrabold text-white">
            Ce que nos clients en disent
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            De vrais messages reçus sur WhatsApp après réception des chansons.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center gap-1 text-[#e5c158]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <p className="text-xs text-white/80 leading-relaxed italic">
              « Ma femme Awa a fondu en larmes dès qu’elle a entendu son prénom dans le refrain. C’est le plus beau cadeau de nos 5 ans de mariage. Merci infiniment ! »
            </p>
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
              <span className="font-bold text-white">Moussa T. (Abidjan)</span>
              <span className="text-[#e5c158]">Pack Vidéo 3 000 F</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center gap-1 text-[#e5c158]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <p className="text-xs text-white/80 leading-relaxed italic">
              « Envoyé à 6h du matin pour l’anniversaire de ma mère. Toute la famille écoute ça en boucle à Ouaga. La rapidité m'a impressionnée ! »
            </p>
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
              <span className="font-bold text-white">Fatou S. (Ouagadougou)</span>
              <span className="text-[#e5c158]">Chanson MP3 1 200 F</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center gap-1 text-[#e5c158]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <p className="text-xs text-white/80 leading-relaxed italic">
              « Pour la dot coutumière de ma fiancée Fadila, la rumba était magique. Les paroles racontaient exactement notre histoire. Vous êtes très forts ! »
            </p>
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
              <span className="font-bold text-white">Djalilou W. (Bobo)</span>
              <span className="text-[#e5c158]">Pack Vidéo 3 000 F</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ ACCORDION */}
      <section className="space-y-6 pt-6 max-w-3xl mx-auto">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e5c158]">
            Des Réponses Claires
          </span>
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-extrabold text-white">
            Questions Fréquemment Posées
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-bold text-white hover:text-[#e5c158] transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-white/50 transition-transform ${
                    openFaqIndex === index ? 'rotate-180 text-[#e5c158]' : ''
                  }`}
                />
              </button>
              {openFaqIndex === index && (
                <div className="px-4 pb-4 text-xs text-white/70 leading-relaxed border-t border-white/[0.04] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 7. BOTTOM CTA & STUDIO OS SWITCHER */}
      <section className="rounded-3xl border border-[#d4af37]/30 bg-gradient-to-r from-[#17140a] via-[#1f1b0c] to-[#121008] p-8 sm:p-12 text-center max-w-4xl mx-auto space-y-6 shadow-2xl relative overflow-hidden">
        <div className="space-y-3">
          <h2 className="font-['Space_Grotesk'] text-2xl sm:text-4xl font-extrabold text-white">
            Prêt à émouvoir quelqu'un aujourd'hui ?
          </h2>
          <p className="text-xs sm:text-sm text-white/70 max-w-xl mx-auto">
            Rejoignez plus de 1 200 personnes qui ont offert des larmes de joie. Écriture gratuite des paroles en moins de 8 minutes sur WhatsApp.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => handleOrderWhatsApp()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#c59e2b] px-8 py-4 text-sm font-extrabold text-black shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95 transition-all"
          >
            <MessageCircle className="h-5 w-5" />
            <span>Créer ma chanson sur WhatsApp</span>
          </button>

          <button
            onClick={onOpenStudio}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-6 py-4 text-xs font-semibold text-white/80 hover:bg-white/[0.08] transition-all"
          >
            <Sparkles className="h-4 w-4 text-[#e5c158]" />
            <span>Tester l'Atelier Studio 1-Clic</span>
          </button>
        </div>

        <div className="pt-4 flex items-center justify-center gap-4 text-[11px] text-white/40">
          <span>WhatsApp actif 7j/7</span>
          <span>•</span>
          <span>Wave & Orange Money acceptés</span>
          <span>•</span>
          <button onClick={onOpenCockpit} className="text-[#e5c158] hover:underline">
            Accès Espace Créateur →
          </button>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="pt-12 border-t border-white/[0.08] text-center text-xs text-white/40 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="font-['Space_Grotesk'] text-sm font-bold text-white">VELARIS STUDIO</span>
          <span>—</span>
          <span>Chansons Personnalisées & Création Musicale</span>
        </div>
        <p className="max-w-md mx-auto text-[11px]">
          Côte d'Ivoire (Abidjan) • Burkina Faso (Ouagadougou) • Sénégal (Dakar) • France.
        </p>
        <p className="text-[10px] text-white/30">
          © 2026 Velaris Studio. Tous droits réservés.
        </p>
      </footer>
    </div>
  );
};
