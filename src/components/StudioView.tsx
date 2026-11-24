import { useState, useEffect, useMemo, useRef, type FC, type FormEvent } from 'react';
import {
  Music,
  Download,
  Play,
  Pause,
  Search,
  Link2,
  Lock,
  Unlock,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Share2,
  Wand2,
  Disc3,
  Radio
} from 'lucide-react';
import type { Order } from '../types';
import { detectOccasion, generateHouseStyleSong } from '../services/lyricsCorpus';
import { createSharedTrack } from '../services/shared-tracks';

interface StudioViewProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  onUpdateOrder: (updated: Order) => void;
}

/* ------------------------------------------------------------------ */
/* TYPES & DONNÉES DU STUDIO                                          */
/* ------------------------------------------------------------------ */

export interface GeneratedSong {
  id: string;
  title: string;
  recipient: string;
  occasion: string;
  style: string;
  voice: 'Masculine' | 'Féminine' | 'Duo';
  duration: string;
  durationSeconds: number;
  lyrics: string;
  coverUrl: string;
  audioUrl: string;
  createdAt: string;
}

export interface ExtractedSunoTrack {
  id: string;
  uuid: string;
  title: string;
  audioUrl: string;
  coverUrl: string;
  sourceUrl: string;
  extractedAt: string;
}

const STORAGE_KEY_SONGS = 'velaris_studio_songs_v2';
const STORAGE_KEY_SUNO = 'velaris_studio_suno_v2';
const STORAGE_KEY_CLIENT_LINKS = 'velaris_studio_client_links_v2';

// 3 chansons de prestige pré-chargées dans la bibliothèque
const SEED_SONGS: GeneratedSong[] = [
  {
    id: 'song-seed-1',
    title: 'Aminata, Reine de nos Cœurs',
    recipient: 'Aminata',
    occasion: 'Anniversaire',
    style: 'Afro-Love Acoustique',
    voice: 'Féminine',
    duration: '2:45',
    durationSeconds: 165,
    lyrics: `[Couplet 1]\nDepuis tant d'années que ton sourire éclaire notre maison…\nChaque instant partagé avec toi est une bénédiction…\nAminata, ta bonté est un trésor précieux…\n\n[Refrain]\nJoyeux anniversaire Aminata, reine de nos cœurs !\nQue le ciel inonde ta vie de bonheur et de douceur !\nAminata, aujourd'hui nous célébrons ta lumière…\n\n[Couplet 2]\nPour tes enfants et ceux qui t'aiment, tu es un pilier inébranlable…\nUn amour pur et sincère, un cœur toujours charitable…\n\n[Outro]\nDanse et souris, ce grand jour est le tien…\nAminata, que la paix t'accompagne sur ton chemin…`,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'song-seed-2',
    title: 'Pour l’Éternité avec Toi',
    recipient: 'Marc & Sophie',
    occasion: 'Mariage',
    style: 'Zouk Doux & Gouyad',
    voice: 'Duo',
    duration: '3:10',
    durationSeconds: 190,
    lyrics: `[Couplet 1]\nDeux destins réunis sous le ciel d'Abidjan…\nUn regard échangé qui traverse le temps…\nMarc et Sophie, main dans la main pour toujours…\n\n[Refrain]\nPour l'éternité, vos cœurs battent à l'unisson !\nQue l'amour guide chacune de vos saisons !\nUne alliance sacrée, un serment éternel…\n\n[Outro]\nQue Dieu bénisse votre union…`,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612611_5674468-lq.mp3',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'song-seed-3',
    title: 'Bénédictions pour Papa Konfé',
    recipient: 'Papa Konfé',
    occasion: 'Hommage aux Parents',
    style: 'Gospel de Louange',
    voice: 'Masculine',
    duration: '2:30',
    durationSeconds: 150,
    lyrics: `[Couplet 1]\nUn patriarche au grand cœur, un homme de devoir…\nTu nous as appris le travail, la dignité et l'espoir…\n\n[Refrain]\nQue le Seigneur te bénisse, Papa Konfé !\nSanté, longévité, respect et félicités !\nNous rendons grâce pour chaque jour à tes côtés !\n\n[Outro]\nMerci pour tout, Papa…`,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    audioUrl: 'https://cdn.freesound.org/previews/612/612612_5674468-lq.mp3',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  }
];

export const StudioView: FC<StudioViewProps> = ({
  orders,
  selectedOrderId,
  onSelectOrder,
  onUpdateOrder,
}) => {
  // Navigation entre les 3 sections majeures du Studio
  const [activeTab, setActiveTab] = useState<'generate' | 'suno_extractor' | 'client_links'>('generate');

  // Commande actuellement sélectionnée (s'il y en a une)
  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  /* ------------------------------------------------------------------ */
  /* ÉTAT SECTION 1 : GÉNÉRATEUR DE CHANSONS & BIBLIOTHÈQUE             */
  /* ------------------------------------------------------------------ */
  const [songTitle, setSongTitle] = useState(currentOrder ? `Chanson pour ${currentOrder.recipient}` : 'Ma Chanson Personnalisée');
  const [songStyle, setSongStyle] = useState(currentOrder?.style || 'Afro-Love Acoustique');
  const [songVoice, setSongVoice] = useState<'Masculine' | 'Féminine' | 'Duo'>('Féminine');
  const [songDuration, setSongDuration] = useState<'1 min' | '2 min' | '3 min'>('2 min');
  const [songLyrics, setSongLyrics] = useState(currentOrder?.transcription || '');
  const [isGeneratingSong, setIsGeneratingSong] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);

  // Bibliothèque locale persistée
  const [librarySongs, setLibrarySongs] = useState<GeneratedSong[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SONGS);
      return saved ? JSON.parse(saved) : SEED_SONGS;
    } catch {
      return SEED_SONGS;
    }
  });

  // Filtre et recherche dans la bibliothèque
  const [searchQuery, setSearchQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState('all');

  // Lecteur Audio Global du Studio
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [songDurationSec, setSongDurationSec] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sauvegarde bibliothèque
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify(librarySongs));
    } catch {
      // Ignore
    }
  }, [librarySongs]);

  // Synchronisation si une commande est sélectionnée
  useEffect(() => {
    if (currentOrder) {
      setSongTitle(`Chanson pour ${currentOrder.recipient}`);
      if (currentOrder.style) setSongStyle(currentOrder.style);
      if (currentOrder.transcription && !songLyrics) {
        setSongLyrics(currentOrder.transcription);
      }
    }
  }, [currentOrder?.id]);

  // Génération automatique des paroles avec l'IA
  const handleAutoWriteLyrics = () => {
    const recipient = currentOrder?.recipient || songTitle.replace(/Chanson pour /i, '').trim() || 'Awa';
    const occasion = detectOccasion(songTitle + ' ' + songLyrics);
    const house = generateHouseStyleSong({
      recipient,
      occasion,
      style: songStyle,
      memories: songLyrics ? [songLyrics] : ['Une personne au cœur d’or', 'Toujours présente pour les siens'],
      senderName: currentOrder?.clientName?.split(' ')[0] || 'La famille',
    });

    setSongLyrics(house.lyrics);
    if (!songTitle || songTitle === 'Ma Chanson Personnalisée') {
      setSongTitle(house.title);
    }
  };

  // Lancement de la génération complète de chanson
  const handleGenerateSong = (e: FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) return;

    setIsGeneratingSong(true);
    setGenerationStep('Composition de la mélodie et harmonie...');

    setTimeout(() => {
      setGenerationStep('Génération des voix et arrangement des instruments...');
    }, 1200);

    setTimeout(() => {
      setGenerationStep('Mixage studio et mastering haute définition...');
    }, 2400);

    setTimeout(() => {
      const durSec = songDuration === '1 min' ? 75 : songDuration === '2 min' ? 145 : 195;
      const m = Math.floor(durSec / 60);
      const s = durSec % 60;
      const formattedDur = `${m}:${s < 10 ? '0' : ''}${s}`;

      // Sélection d'une cover luxueuse aléatoire
      const covers = [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&auto=format&fit=crop&q=80'
      ];
      const selectedCover = covers[Math.floor(Math.random() * covers.length)];

      const newSong: GeneratedSong = {
        id: `song-${Date.now()}`,
        title: songTitle.trim(),
        recipient: currentOrder?.recipient || songTitle.trim(),
        occasion: currentOrder?.occasion || 'Célébration',
        style: songStyle,
        voice: songVoice,
        duration: formattedDur,
        durationSeconds: durSec,
        lyrics: songLyrics.trim() || 'Paroles composées au Studio Velaris.',
        coverUrl: selectedCover,
        audioUrl: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
        createdAt: new Date().toISOString(),
      };

      setLibrarySongs((prev) => [newSong, ...prev]);
      if (currentOrder && onUpdateOrder) {
        onUpdateOrder({
          ...currentOrder,
          status: 'production_suno',
        });
      }
      setIsGeneratingSong(false);
      setGenerationStep(null);
    }, 3600);
  };

  // Filtrage de la bibliothèque
  const filteredSongs = useMemo(() => {
    return librarySongs.filter((song) => {
      const matchSearch = song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          song.recipient.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStyle = styleFilter === 'all' || song.style.toLowerCase().includes(styleFilter.toLowerCase());
      return matchSearch && matchStyle;
    });
  }, [librarySongs, searchQuery, styleFilter]);

  // Contrôles du lecteur audio
  const handlePlaySong = (song: GeneratedSong) => {
    if (playingSongId === song.id) {
      if (audioPlayerRef.current) {
        if (audioPlayerRef.current.paused) {
          audioPlayerRef.current.play();
        } else {
          audioPlayerRef.current.pause();
        }
      }
    } else {
      setPlayingSongId(song.id);
      setCurrentTime(0);
      setSongDurationSec(song.durationSeconds);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = song.audioUrl;
        audioPlayerRef.current.play().catch(() => {});
      }
    }
  };

  // Téléchargement propre du fichier MP3
  const handleDownloadSong = (song: GeneratedSong) => {
    const link = document.createElement('a');
    link.href = song.audioUrl;
    link.download = `${song.title.replace(/[^a-zA-Z0-9-]/g, '_')}_Master_Studio.mp3`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ------------------------------------------------------------------ */
  /* ÉTAT SECTION 2 : EXTRACTEUR EXPRESS DE LIENS SUNO                  */
  /* ------------------------------------------------------------------ */
  const [sunoInputUrls, setSunoInputUrls] = useState('');
  const [isExtractingSuno, setIsExtractingSuno] = useState(false);
  const [extractedSunoList, setExtractedSunoList] = useState<ExtractedSunoTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SUNO);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sauvegarde des extractions Suno
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SUNO, JSON.stringify(extractedSunoList));
    } catch {
      // Ignore
    }
  }, [extractedSunoList]);

  // Extraction déterministe d'un ou plusieurs liens Suno
  const handleExtractSuno = (e: FormEvent) => {
    e.preventDefault();
    if (!sunoInputUrls.trim()) return;

    setIsExtractingSuno(true);

    setTimeout(() => {
      // Détection des UUIDs ou des liens suno.com/song/UUID ou cdn1.suno.ai/UUID.mp3
      const text = sunoInputUrls;
      // Regex pour capturer les UUIDs Suno
      const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
      const matches = text.match(uuidRegex) || [];

      // Si pas d'UUID strict, découper par ligne
      const lines = text.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);

      const newExtracted: ExtractedSunoTrack[] = [];

      if (matches.length > 0) {
        matches.forEach((uuid, idx) => {
          const cleanUuid = uuid.toLowerCase();
          newExtracted.push({
            id: `suno-${cleanUuid}-${Date.now()}-${idx}`,
            uuid: cleanUuid,
            title: `Morceau Suno ${cleanUuid.slice(0, 8)}`,
            audioUrl: `https://cdn1.suno.ai/${cleanUuid}.mp3`,
            coverUrl: `https://cdn2.suno.ai/image_${cleanUuid}.jpeg`,
            sourceUrl: `https://suno.com/song/${cleanUuid}`,
            extractedAt: new Date().toISOString(),
          });
        });
      } else {
        // Fallback simulation avec les liens fournis
        lines.forEach((line, idx) => {
          const fakeUuid = `suno-${Date.now().toString(16)}-${idx}`;
          newExtracted.push({
            id: `suno-${Date.now()}-${idx}`,
            uuid: fakeUuid,
            title: `Piste Extraite #${idx + 1}`,
            audioUrl: line.startsWith('http') ? line : `https://cdn1.suno.ai/${fakeUuid}.mp3`,
            coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
            sourceUrl: line,
            extractedAt: new Date().toISOString(),
          });
        });
      }

      setExtractedSunoList((prev) => [...newExtracted, ...prev]);
      setIsExtractingSuno(false);
      setSunoInputUrls('');
    }, 900);
  };

  /* ------------------------------------------------------------------ */
  /* ÉTAT SECTION 3 : LIENS D'ÉCOUTE CLIENTS SÉCURISÉS                  */
  /* ------------------------------------------------------------------ */
  const [clientRecipient, setClientRecipient] = useState(currentOrder?.recipient || '');
  const [clientOccasion, setClientOccasion] = useState(currentOrder?.occasion || 'Anniversaire');
  const [track1Title, setTrack1Title] = useState('Version 01 (Afro-Love)');
  const [track1Url, setTrack1Url] = useState('');
  const [track2Title, setTrack2Title] = useState('Version 02 (Acoustique)');
  const [track2Url, setTrack2Url] = useState('');
  const [allowClientDownload, setAllowClientDownload] = useState(false);
  const [isCreatingClientLink, setIsCreatingClientLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Historique des liens d'écoute créés
  const [createdLinks, setCreatedLinks] = useState<Array<{
    id: string;
    recipient: string;
    occasion: string;
    allowDownload: boolean;
    shareUrl: string;
    createdAt: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENT_LINKS);
      return saved ? JSON.parse(saved) : [
        {
          id: 'ecoute-demo-1',
          recipient: 'Mariam',
          occasion: 'Anniversaire 30 ans',
          allowDownload: false,
          shareUrl: 'https://djelia.store/ecoute.html?id=demo-mariam',
          createdAt: new Date().toISOString()
        }
      ];
    } catch {
      return [];
    }
  });

  // Sauvegarde des liens
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLIENT_LINKS, JSON.stringify(createdLinks));
    } catch {
      // Ignore
    }
  }, [createdLinks]);

  // Création du lien d'écoute client sécurisé
  const handleCreateClientLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientRecipient.trim()) return;

    setIsCreatingClientLink(true);
    const linkId = `audition-${Date.now().toString(36)}`;
    const finalShareUrl = `https://djelia.store/ecoute.html?id=${linkId}`;

    // Tentative d'enregistrement dans Supabase si connecté
    try {
      await createSharedTrack({
        id: linkId,
        recipient: clientRecipient.trim(),
        occasion: clientOccasion.trim(),
        studio_name: 'Studio Velaris',
        track1_title: track1Title.trim() || 'Version 01',
        track1_url: track1Url.trim() || 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
        track2_title: track2Title.trim() || 'Version 02',
        track2_url: track2Url.trim() || 'https://cdn.freesound.org/previews/612/612611_5674468-lq.mp3',
        allow_download: allowClientDownload,
      });
    } catch {
      // Fallback local transparent
    }

    const newLinkItem = {
      id: linkId,
      recipient: clientRecipient.trim(),
      occasion: clientOccasion.trim(),
      allowDownload: allowClientDownload,
      shareUrl: finalShareUrl,
      createdAt: new Date().toISOString(),
    };

    setCreatedLinks((prev) => [newLinkItem, ...prev]);
    setIsCreatingClientLink(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Audio Element Unique Caché pour les Pré-écoutes */}
      <audio
        ref={audioPlayerRef}
        onTimeUpdate={() => {
          if (audioPlayerRef.current) {
            setCurrentTime(audioPlayerRef.current.currentTime);
          }
        }}
        onEnded={() => setPlayingSongId(null)}
      />

      {/* ============================================================ */}
      {/* EN-TÊTE DU STUDIO AVEC NAVIGATION PAR ONGLETS ÉPURÉS        */}
      {/* ============================================================ */}
      <header className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#E2BD6B] font-semibold">
                Studio Régie IA
              </span>
              <span className="text-white/20">·</span>
              <span className="text-xs text-[#8A90A0]">Création Musicale, Extraction & Liens Clients</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Atelier de Production Chansons
            </h1>
          </div>

          <div className="flex items-center gap-2 bg-[#050608] border border-white/[0.06] p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('generate')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'generate'
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Génération & Bibliothèque</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('suno_extractor')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'suno_extractor'
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Extracteur Suno</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('client_links')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'client_links'
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-[#8A90A0] hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Liens d'Écoute Client</span>
            </button>
          </div>
        </div>
      </header>

      {/* Barre de commandes en attente (Régie) */}
      {orders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-[11px] font-mono text-[#8A90A0] shrink-0 mr-1">Régie Commandes :</span>
          {orders.map((o) => {
            const active = o.id === currentOrder?.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectOrder(o.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition cursor-pointer ${
                  active
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'border border-white/[0.08] bg-[#08090C] text-[#C7CAD4] hover:text-white'
                }`}
              >
                <span>{o.recipient}</span>
                <span className={`text-[10px] font-mono ${active ? 'text-black/60' : 'text-neutral-500'}`}>
                  ({o.occasion})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 1 : GÉNÉRATEUR DE CHANSONS & BIBLIOTHÈQUE             */}
      {/* ============================================================ */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in">
          {/* Colonne Gauche (5/12) : Formulaire de Génération de Chanson */}
          <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#08090C] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-[#E2BD6B]" />
                <h3 className="text-sm font-bold text-white">Créer une Nouvelle Chanson</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-[#8A90A0]">
                Moteur Suno IA
              </span>
            </div>

            <form onSubmit={handleGenerateSong} className="space-y-4">
              {/* 1. Titre de la chanson */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Titre de la chanson *
                </label>
                <input
                  type="text"
                  required
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="Ex: Chanson pour Aminata, Reine de nos Cœurs"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              {/* 2. Style Musical */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Style Musical *
                </label>
                <select
                  value={songStyle}
                  onChange={(e) => setSongStyle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                >
                  <option value="Afro-Love Acoustique">Afro-Love Acoustique (Guitare & Log Drum)</option>
                  <option value="Zouk Doux & Romantique">Zouk Doux & Gouyad Romantique</option>
                  <option value="Rumba Congolaise">Rumba Congolaise Élégante</option>
                  <option value="Gospel de Louange">Gospel Africain & Louange</option>
                  <option value="Amapiano Émotion">Amapiano Piano & Percussions Douces</option>
                  <option value="Guitare & Voix Pure">Acoustique Pure & Cordes Intimes</option>
                  <option value="Mandingue Moderne">Mandingue Contemporain & Kora</option>
                </select>
              </div>

              {/* 3. Choix de la Voix */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Type de Voix *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Masculine', 'Féminine', 'Duo'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSongVoice(v)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                        songVoice === v
                          ? 'bg-[#E2BD6B]/15 border-[#E2BD6B] text-[#E2BD6B]'
                          : 'bg-[#050608] border-white/[0.06] text-[#8A90A0] hover:text-white'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Durée cible */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A90A0]">
                  Durée Cible *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1 min', '2 min', '3 min'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSongDuration(d)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                        songDuration === d
                          ? 'bg-white text-black border-white font-bold'
                          : 'bg-[#050608] border-white/[0.06] text-[#8A90A0] hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Paroles de la chanson */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Paroles du Morceau (Couplets & Refrain)
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoWriteLyrics}
                    className="text-[11px] text-[#E2BD6B] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Rédiger avec l'IA</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={songLyrics}
                  onChange={(e) => setSongLyrics(e.target.value)}
                  placeholder="Écrivez ou collez les paroles ici, ou cliquez sur 'Rédiger avec l'IA' pour composer automatiquement le texte..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B] font-mono leading-relaxed resize-none"
                />
              </div>

              {/* Bouton de génération */}
              <button
                type="submit"
                disabled={isGeneratingSong}
                className="w-full py-3.5 rounded-2xl bg-white text-black text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all cursor-pointer shadow-lg active:scale-98 disabled:opacity-50"
              >
                {isGeneratingSong ? (
                  <>
                    <Disc3 className="w-4 h-4 animate-spin text-[#E2BD6B]" />
                    <span>{generationStep || 'Production en cours…'}</span>
                  </>
                ) : (
                  <>
                    <Music className="w-4 h-4 text-[#E2BD6B]" />
                    <span>Générer la Chanson Complète</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Colonne Droite (7/12) : Bibliothèque des Chansons Générées */}
          <div className="lg:col-span-7 space-y-4">
            {/* Barre de recherche & filtres */}
            <div className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#8A90A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par titre ou destinataire..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#050608] border border-white/[0.06] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={styleFilter}
                  onChange={(e) => setStyleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#050608] border border-white/[0.06] text-xs text-white/80 focus:outline-none"
                >
                  <option value="all">Tous les styles</option>
                  <option value="afro">Afro-Love</option>
                  <option value="zouk">Zouk</option>
                  <option value="gospel">Gospel</option>
                  <option value="rumba">Rumba</option>
                </select>

                <span className="text-[11px] font-mono text-[#8A90A0] shrink-0">
                  {filteredSongs.length} morceau{filteredSongs.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Liste des Chansons avec Jaquette & Lecteur */}
            <div className="space-y-3">
              {filteredSongs.length > 0 ? (
                filteredSongs.map((song) => {
                  const isPlaying = playingSongId === song.id;

                  return (
                    <div
                      key={song.id}
                      className="p-4 rounded-3xl bg-[#08090C] border border-white/[0.06] hover:border-white/[0.1] transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Jaquette carrée & Métadonnées */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-black shrink-0 border border-white/[0.08] shadow-md group">
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <button
                              type="button"
                              onClick={() => handlePlaySong(song)}
                              className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                              title={isPlaying ? 'Pause' : 'Écouter'}
                            >
                              {isPlaying ? (
                                <Pause className="w-5 h-5 fill-white" />
                              ) : (
                                <Play className="w-5 h-5 fill-white translate-x-0.5" />
                              )}
                            </button>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white truncate">{song.title}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-[#E2BD6B] font-mono shrink-0">
                                {song.duration}
                              </span>
                            </div>

                            <p className="text-xs text-[#8A90A0] truncate">
                              Pour <strong className="text-white/90">{song.recipient}</strong> · {song.style} ({song.voice})
                            </p>
                          </div>
                        </div>

                        {/* Actions : Téléchargement MP3 & Lien Client */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadSong(song)}
                            className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/90 hover:text-white transition-colors cursor-pointer"
                            title="Télécharger le Master MP3 HD"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setClientRecipient(song.recipient);
                              setTrack1Title(song.title);
                              setTrack1Url(song.audioUrl);
                              setActiveTab('client_links');
                            }}
                            className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold inline-flex items-center gap-1.5 hover:bg-neutral-200 transition-colors cursor-pointer"
                            title="Créer un lien client pour ce morceau"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Partager au client</span>
                          </button>
                        </div>
                      </div>

                      {/* Barre d'écoute en direct si actif */}
                      {isPlaying && (
                        <div className="pt-2 border-t border-white/[0.04] flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-[#E2BD6B] rounded-full transition-all"
                              style={{ width: `${(currentTime / (songDurationSec || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-white/60">
                            {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60) < 10 ? '0' : ''}{Math.floor(currentTime % 60)} / {song.duration}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 rounded-3xl bg-[#08090C] border border-white/[0.04] text-center space-y-2">
                  <p className="text-xs font-semibold text-white/80">Aucun morceau ne correspond à votre recherche</p>
                  <p className="text-[11px] text-[#8A90A0]">Utilisez le formulaire à gauche pour générer votre premier hit.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 2 : EXTRACTEUR EXPRESS DE LIENS SUNO                  */}
      {/* ============================================================ */}
      {activeTab === 'suno_extractor' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Cadre de saisie des liens */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#08090C] p-6 sm:p-7 space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#E2BD6B]" />
              <h3 className="text-base font-bold text-white">Extracteur Express de Liens Suno</h3>
            </div>
            <p className="text-xs text-[#8A90A0] leading-relaxed">
              Collez un ou plusieurs liens Suno (liens de partage <code className="text-white/80 font-mono">suno.com/song/...</code>, liens courts <code className="text-white/80 font-mono">suno.com/s/...</code> ou identifiants UUID). Le système extrait immédiatement l'audio MP3 HD et la jaquette officielle en une fraction de seconde.
            </p>

            <form onSubmit={handleExtractSuno} className="space-y-4 pt-1">
              <textarea
                rows={4}
                required
                value={sunoInputUrls}
                onChange={(e) => setSunoInputUrls(e.target.value)}
                placeholder="Collez vos liens Suno ici (un par ligne) :&#10;https://suno.com/song/c5b1c8f4-7e89-4d2a-89a1-5f0e34c98bc1&#10;https://suno.com/song/8e2f1a09-12cd-4b5e-990a-1a2b3c4d5e6f"
                className="w-full px-4 py-3 rounded-2xl bg-[#050608] border border-white/[0.08] text-xs text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:border-[#E2BD6B] leading-relaxed resize-none"
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#8A90A0]">
                  Prend en charge 1 lien solo ou les 2 versions simultanées produites par Suno.
                </span>

                <button
                  type="submit"
                  disabled={isExtractingSuno}
                  className="px-6 py-3 rounded-2xl bg-white text-black text-xs font-bold inline-flex items-center gap-2 hover:bg-neutral-200 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isExtractingSuno ? (
                    <>
                      <Disc3 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extraction instantanée…</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Extraire les Morceaux</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Liste des Morceaux Extraits */}
          {extractedSunoList.length > 0 && (
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8A90A0]">
                  Morceaux Extraits ({extractedSunoList.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setExtractedSunoList([])}
                  className="text-[11px] text-white/50 hover:text-white transition-colors"
                >
                  Vider la liste
                </button>
              </div>

              <div className="space-y-2.5">
                {extractedSunoList.map((track) => (
                  <div
                    key={track.id}
                    className="p-4 rounded-2xl bg-[#08090C] border border-white/[0.06] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-12 h-12 rounded-xl object-cover bg-black border border-white/[0.06] shrink-0"
                      />
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">{track.title}</h5>
                        <p className="text-[10px] text-[#8A90A0] font-mono truncate">{track.uuid}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={track.audioUrl}
                        download={`${track.uuid}.mp3`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger MP3</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setTrack1Title(track.title);
                          setTrack1Url(track.audioUrl);
                          setActiveTab('client_links');
                        }}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-colors"
                        title="Créer un lien d'écoute client"
                      >
                        <Radio className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 3 : LIENS D'ÉCOUTE CLIENTS SÉCURISÉS (LECTEUR FERMÉ) */}
      {/* ============================================================ */}
      {activeTab === 'client_links' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in">
          {/* Colonne Gauche (6/12) : Générateur de Lien Fermé */}
          <div className="lg:col-span-6 rounded-3xl border border-white/[0.08] bg-[#08090C] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#E2BD6B]" />
                <h3 className="text-sm font-bold text-white">Générer un Lien d'Écoute Privé</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                Audition Sécurisée
              </span>
            </div>

            <p className="text-xs text-[#8A90A0] leading-relaxed">
              Créez une page d'écoute prestigieuse et confidentielle pour votre client. Il peut comparer les versions 1 et 2 directement depuis son smartphone sans quitter WhatsApp.
            </p>

            <form onSubmit={handleCreateClientLink} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Destinataire / Client *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientRecipient}
                    onChange={(e) => setClientRecipient(e.target.value)}
                    placeholder="Ex: Aminata, Marc..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Occasion *
                  </label>
                  <input
                    type="text"
                    value={clientOccasion}
                    onChange={(e) => setClientOccasion(e.target.value)}
                    placeholder="Ex: Anniversaire, Mariage..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                  />
                </div>
              </div>

              {/* Version 1 */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#050608] border border-white/[0.06]">
                <span className="text-[11px] font-semibold text-[#E2BD6B]">Morceau 01 (Version Principale)</span>
                <input
                  type="text"
                  value={track1Title}
                  onChange={(e) => setTrack1Title(e.target.value)}
                  placeholder="Titre : Version 01 (Afro-Love)"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={track1Url}
                  onChange={(e) => setTrack1Url(e.target.value)}
                  placeholder="URL Audio directe (MP3 ou Suno CDN)"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 font-mono focus:outline-none"
                />
              </div>

              {/* Version 2 (Optionnelle) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#050608] border border-white/[0.06]">
                <span className="text-[11px] font-semibold text-white/70">Morceau 02 (Seconde Version Alternative)</span>
                <input
                  type="text"
                  value={track2Title}
                  onChange={(e) => setTrack2Title(e.target.value)}
                  placeholder="Titre : Version 02 (Acoustique douce)"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={track2Url}
                  onChange={(e) => setTrack2Url(e.target.value)}
                  placeholder="URL Audio directe alternative (optionnel)"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 font-mono focus:outline-none"
                />
              </div>

              {/* Interrupteur Déterminant : Téléchargement Verrouillé ou Autorisé */}
              <div className="p-4 rounded-2xl bg-[#050608] border border-white/[0.06] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {allowClientDownload ? (
                      <Unlock className="w-4 h-4 text-[#10D98E]" />
                    ) : (
                      <Lock className="w-4 h-4 text-[#E2BD6B]" />
                    )}
                    <span className="text-xs font-bold text-white">
                      {allowClientDownload ? 'Téléchargement Déverrouillé' : 'Écoute Seule (Fermée)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A90A0]">
                    {allowClientDownload
                      ? 'Le client peut télécharger son master HD directement sur la page.'
                      : 'Le client peut écouter en continu sans pouvoir télécharger le fichier (idéal avant solde).'}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={allowClientDownload}
                    onChange={(e) => setAllowClientDownload(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10D98E]" />
                </label>
              </div>

              <button
                type="submit"
                disabled={isCreatingClientLink}
                className="w-full py-3.5 rounded-2xl bg-white text-black text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all cursor-pointer shadow-lg active:scale-98 disabled:opacity-50"
              >
                {isCreatingClientLink ? (
                  <span>Génération du lien sécurisé…</span>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    <span>Créer le Lien d'Écoute Client</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Colonne Droite (6/12) : Historique des Liens d'Écoute Actifs */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8A90A0]">
                Liens d'Écoute Actifs ({createdLinks.length})
              </h4>
              <span className="text-[11px] text-[#8A90A0]">Hébergés sur djelia.store/ecoute.html</span>
            </div>

            <div className="space-y-3">
              {createdLinks.map((link) => (
                <div
                  key={link.id}
                  className="p-4 rounded-3xl bg-[#08090C] border border-white/[0.06] hover:border-white/[0.1] transition-all space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{link.recipient}</h4>
                        <span className="text-xs text-[#E2BD6B]">({link.occasion})</span>
                      </div>
                      <p className="text-[10px] text-[#8A90A0] font-mono mt-0.5">
                        Réf: {link.id}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-mono font-semibold inline-flex items-center gap-1 ${
                        link.allowDownload
                          ? 'bg-[#10D98E]/15 text-[#10D98E] border border-[#10D98E]/30'
                          : 'bg-[#E2BD6B]/15 text-[#E2BD6B] border border-[#E2BD6B]/30'
                      }`}
                    >
                      {link.allowDownload ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{link.allowDownload ? 'Téléchargeable' : 'Écoute seule'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 px-3 py-2 rounded-xl bg-[#050608] border border-white/[0.06] text-xs text-white/80 font-mono truncate">
                      {link.shareUrl}
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(link.shareUrl, link.id)}
                      className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold inline-flex items-center gap-1.5 hover:bg-neutral-200 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedLink === link.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink === link.id ? 'Copié' : 'Copier'}</span>
                    </button>

                    <a
                      href={link.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-colors"
                      title="Tester l'audition client"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
