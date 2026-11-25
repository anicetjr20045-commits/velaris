import { useState, useEffect, useMemo, useRef, type FC, type FormEvent, type ChangeEvent } from 'react';
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
  Radio,
  ArrowLeft,
  Upload,
  ChevronRight,
  Headphones,
  Mic,
  Film,
  AlertTriangle,
  Trash2,
  Power,
} from 'lucide-react';
import type { Order } from '../types';
import { detectOccasion, generateHouseStyleSong } from '../services/lyricsCorpus';
import {
  createSharedTrack,
  uploadAudioTrack,
  listMySharedTracks,
  manageSharedTrack,
} from '../services/shared-tracks';
import { VoiceLabView } from './VoiceLabView';
import { useAuth } from '../hooks/useAuth';

const KIE_LIMITS = {
  title: 80,
  style: 1000,
  lyrics: 5000,
} as const;

interface StudioViewProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  onUpdateOrder: (updated: Order) => void;
}

export interface GeneratedSong {
  id: string;
  taskId?: string;
  audioId?: string;
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
  videoUrl?: string;
  videoStatus?: 'idle' | 'generating' | 'ready' | 'failed';
  createdAt: string;
}

export interface ExtractedSunoTrack {
  id: string;
  uuid: string;
  title: string;
  style?: string;
  audioUrl: string;
  coverUrl: string;
  sourceUrl: string;
  extractedAt: string;
}

const STORAGE_KEY_SONGS = 'velaris_studio_songs_v2';
const STORAGE_KEY_SUNO = 'velaris_studio_suno_v2';
const STORAGE_KEY_CLIENT_LINKS = 'velaris_studio_client_links_v2';

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
  onSelectOrder: _onSelectOrder,
  onUpdateOrder,
}) => {
  const { user } = useAuth();
  const userMeta = (user?.user_metadata || {}) as Record<string, any>;
  const studioName = String(userMeta.studio_name || 'Djelia Studio');
  const studioSlug = String(
    userMeta.studio_slug ||
      studioName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
      'studio'
  );
  const creatorPhone = String(userMeta.phone || userMeta.studio_whatsapp_phone || '');

  // Navigation du Studio : 'hub' (Cartes d'accueil) ou 'generate' | 'suno_extractor' | 'client_links' | 'voice_lab'
  const [currentModule, setCurrentModule] = useState<'hub' | 'generate' | 'suno_extractor' | 'client_links' | 'voice_lab'>('hub');
  const [studioNotice, setStudioNotice] = useState<{ text: string; tone: 'error' | 'ok' | 'warn' } | null>(null);
  const notifyStudio = (text: string, tone: 'error' | 'ok' | 'warn' = 'warn') => {
    setStudioNotice({ text, tone });
    setTimeout(() => setStudioNotice(null), 5500);
  };

  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  /* ------------------------------------------------------------------ */
  /* SECTION 1 : CRÉATION DE CHANSONS & BIBLIOTHÈQUE                     */
  /* ------------------------------------------------------------------ */
  const [songTitle, setSongTitle] = useState(currentOrder ? `Chanson pour ${currentOrder.recipient}` : 'Ma Chanson Personnalisée');
  // Style en saisie libre au clavier (ex: Zouk, Afro-Love, etc.)
  const [songStyle, setSongStyle] = useState(currentOrder?.style || 'Zouk');
  const [songVoice, setSongVoice] = useState<'Masculine' | 'Féminine' | 'Duo'>('Féminine');
  const [songDuration, setSongDuration] = useState<'1 min' | '2 min' | '3 min'>('2 min');
  const [songLyrics, setSongLyrics] = useState(currentOrder?.transcription || '');
  const [isGeneratingSong, setIsGeneratingSong] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);

  // Suggestions rapides de style
  const styleSuggestions = ['Zouk', 'Afro-Love', 'Rumba Congolaise', 'Gospel', 'Amapiano', 'Acoustique Pure', 'Mandingue'];

  // Bibliothèque
  const [librarySongs, setLibrarySongs] = useState<GeneratedSong[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SONGS);
      return saved ? JSON.parse(saved) : SEED_SONGS;
    } catch {
      return SEED_SONGS;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [songDurationSec, setSongDurationSec] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify(librarySongs));
    } catch {
      // Ignore
    }
  }, [librarySongs]);

  useEffect(() => {
    if (currentOrder) {
      setSongTitle(`Chanson pour ${currentOrder.recipient}`);
      if (currentOrder.style) setSongStyle(currentOrder.style);
      if (currentOrder.transcription && !songLyrics) {
        setSongLyrics(currentOrder.transcription);
      }
    }
  }, [currentOrder?.id]);

  const handleAutoWriteLyrics = () => {
    const recipient = currentOrder?.recipient || songTitle.replace(/Chanson pour /i, '').trim() || 'Awa';
    const occasion = detectOccasion(songTitle + ' ' + songLyrics);
    const house = generateHouseStyleSong({
      recipient,
      occasion,
      style: songStyle,
      memories: songLyrics ? [songLyrics] : ['Une personne formidable', 'Toujours généreuse et bienveillante'],
      senderName: currentOrder?.clientName?.split(' ')[0] || 'La famille',
    });

    setSongLyrics(house.lyrics);
    if (!songTitle || songTitle === 'Ma Chanson Personnalisée') {
      setSongTitle(house.title);
    }
  };

  const isTitleOver = songTitle.length > KIE_LIMITS.title;
  const isStyleOver = songStyle.length > KIE_LIMITS.style;
  const isLyricsOver = songLyrics.length > KIE_LIMITS.lyrics;

  const handleGenerateSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) {
      notifyStudio('Veuillez saisir un titre pour la chanson.', 'error');
      return;
    }
    if (isTitleOver) {
      notifyStudio(`Titre trop long : ${songTitle.length}/${KIE_LIMITS.title} caractères maximum acceptés par Suno/Kie.ai.`, 'error');
      return;
    }
    if (isStyleOver) {
      notifyStudio(`Style trop long : ${songStyle.length}/${KIE_LIMITS.style} caractères maximum acceptés par Suno/Kie.ai.`, 'error');
      return;
    }
    if (isLyricsOver) {
      notifyStudio(`Paroles trop longues : ${songLyrics.length}/${KIE_LIMITS.lyrics} caractères maximum acceptés par Suno/Kie.ai.`, 'error');
      return;
    }

    setIsGeneratingSong(true);
    setGenerationStep('Envoi vers Suno via Kie.ai…');

    try {
      const vocalGender =
        songVoice === 'Féminine' ? 'f' : songVoice === 'Masculine' ? 'm' : 'duo';

      const genRes = await fetch('/api/suno?action=generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: songTitle.trim(),
          style: songStyle.trim() || 'Afro-Love acoustique',
          prompt: songLyrics.trim(),
          customMode: true,
          instrumental: !songLyrics.trim(),
          vocalGender,
          model: 'V4_5',
        }),
      });

      const genJson = await genRes.json().catch(() => ({}));
      if (!genRes.ok || !genJson.taskId) {
        notifyStudio(genJson.error || 'Impossible de lancer la génération Suno via Kie.ai.', 'error');
        setIsGeneratingSong(false);
        setGenerationStep(null);
        return;
      }

      const taskId = String(genJson.taskId);
      setGenerationStep('Composition Suno en cours (1 à 3 min)…');

      // Polling jusqu'à obtention des 2 pistes Suno
      let completed = false;
      const started = Date.now();
      while (Date.now() - started < 6 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 5000));
        const stRes = await fetch(`/api/suno?action=status&taskId=${encodeURIComponent(taskId)}`);
        const stJson = await stRes.json().catch(() => null);
        const data = stJson?.data;
        if (!data) continue;

        const rawStatus = String(data.status || '').toUpperCase();
        const sunoData = data.response?.sunoData || data.sunoData || [];

        if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETE' || rawStatus === 'FIRST_SUCCESS') {
          if (Array.isArray(sunoData) && sunoData.length > 0) {
            const generatedTracks: GeneratedSong[] = sunoData
              .filter((t: any) => t.audioUrl || t.audio_url || t.streamAudioUrl || t.stream_audio_url)
              .map((t: any, idx: number) => {
                const durSec = Math.round(Number(t.duration || 150));
                const m = Math.floor(durSec / 60);
                const s = durSec % 60;
                return {
                  id: `song-${taskId}-${idx}-${Date.now()}`,
                  taskId,
                  audioId: t.id || t.audioId || t.audio_id,
                  title: sunoData.length > 1 ? `${t.title || songTitle.trim()} (v${idx + 1})` : (t.title || songTitle.trim()),
                  recipient: currentOrder?.recipient || songTitle.trim(),
                  occasion: currentOrder?.occasion || 'Création Studio',
                  style: t.tags || songStyle.trim() || 'Afro-Love',
                  voice: songVoice,
                  duration: `${m}:${s < 10 ? '0' : ''}${s}`,
                  durationSeconds: durSec,
                  lyrics: t.prompt || songLyrics.trim() || 'Composition instrumentale',
                  coverUrl: t.imageUrl || t.image_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
                  audioUrl: t.audioUrl || t.audio_url || t.streamAudioUrl || t.stream_audio_url,
                  videoStatus: 'idle',
                  createdAt: new Date().toISOString(),
                };
              });

            if (generatedTracks.length > 0) {
              setLibrarySongs((prev) => [...generatedTracks, ...prev]);
              if (currentOrder && onUpdateOrder) {
                onUpdateOrder({ ...currentOrder, status: 'production_suno' });
              }
              notifyStudio(`${generatedTracks.length} version(s) Suno prête(s) et ajoutée(s) à votre discothèque.`, 'ok');
              completed = true;
              break;
            }
          }
        } else if (rawStatus === 'FAILED' || rawStatus === 'ERROR' || rawStatus === 'CREATE_TASK_FAILED') {
          notifyStudio(data.errorMessage || data.failReason || 'Échec de génération Suno.', 'error');
          completed = true;
          break;
        }
      }

      if (!completed) {
        notifyStudio('La génération prend plus de temps que prévu sur Kie.ai. Vérifiez votre historique dans un instant.', 'warn');
      }
    } catch (err: any) {
      notifyStudio(`Erreur réseau Suno/Kie.ai : ${err?.message || 'inconnue'}`, 'error');
    } finally {
      setIsGeneratingSong(false);
      setGenerationStep(null);
    }
  };

  const handleCreateLyricsVideo = async (song: GeneratedSong) => {
    if (!song.taskId || !song.audioId) {
      notifyStudio('La vidéo lyrics est disponible pour les chansons générées via Suno/Kie.ai.', 'warn');
      return;
    }

    setLibrarySongs((prev) =>
      prev.map((s) => (s.id === song.id ? { ...s, videoStatus: 'generating' } : s))
    );
    notifyStudio(`Génération de la vidéo lyrics MP4 pour « ${song.title} »…`, 'ok');

    try {
      const res = await fetch('/api/suno?action=music-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: song.taskId,
          audioId: song.audioId,
          author: studioName,
          domainName: 'djelia.store',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.taskId) {
        setLibrarySongs((prev) =>
          prev.map((s) => (s.id === song.id ? { ...s, videoStatus: 'failed' } : s))
        );
        notifyStudio(json.error || 'Impossible de lancer la vidéo lyrics.', 'error');
        return;
      }

      const vTaskId = String(json.taskId);
      const started = Date.now();
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 5000));
        const stRes = await fetch(`/api/suno?action=video-status&taskId=${encodeURIComponent(vTaskId)}`);
        const stJson = await stRes.json().catch(() => null);
        const data = stJson?.data;
        if (!data) continue;
        const flag = String(data.successFlag || data.status || '').toUpperCase();
        const videoUrl = data.response?.videoUrl || data.response?.video_url || data.videoUrl;
        if ((flag === 'SUCCESS' || flag === 'COMPLETE' || flag === '1') && videoUrl) {
          setLibrarySongs((prev) =>
            prev.map((s) => (s.id === song.id ? { ...s, videoStatus: 'ready', videoUrl } : s))
          );
          notifyStudio(`Vidéo lyrics MP4 prête pour « ${song.title} » !`, 'ok');
          return;
        }
        if (flag === 'FAILED' || flag === 'ERROR' || flag === 'CREATE_TASK_FAILED') {
          break;
        }
      }

      setLibrarySongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, videoStatus: 'failed' } : s))
      );
      notifyStudio('Échec de génération de la vidéo lyrics MP4.', 'error');
    } catch (err: any) {
      setLibrarySongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, videoStatus: 'failed' } : s))
      );
      notifyStudio(err?.message || 'Erreur réseau vidéo lyrics.', 'error');
    }
  };

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return librarySongs;
    return librarySongs.filter((song) => {
      return (
        song.title.toLowerCase().includes(q) ||
        song.recipient.toLowerCase().includes(q) ||
        song.style.toLowerCase().includes(q) ||
        song.occasion.toLowerCase().includes(q) ||
        song.lyrics.toLowerCase().includes(q)
      );
    });
  }, [librarySongs, searchQuery]);

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

  const handleDownloadSong = (song: GeneratedSong) => {
    const filename = `${song.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Master.mp3`;
    const link = document.createElement('a');
    link.href = `/api/suno?action=download&url=${encodeURIComponent(song.audioUrl)}&filename=${encodeURIComponent(filename)}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ------------------------------------------------------------------ */
  /* SECTION 2 : EXTRACTEUR EXPRESS DE LIENS SUNO                       */
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SUNO, JSON.stringify(extractedSunoList));
    } catch {
      // Ignore
    }
  }, [extractedSunoList]);

  const handleExtractSuno = async (e: FormEvent) => {
    e.preventDefault();
    if (!sunoInputUrls.trim()) return;

    setIsExtractingSuno(true);
    try {
      const res = await fetch('/api/suno?action=extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sunoInputUrls }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(json.tracks) || json.tracks.length === 0) {
        notifyStudio(json.error || 'Aucun lien Suno valide trouvé.', 'error');
        setIsExtractingSuno(false);
        return;
      }

      const newExtracted: ExtractedSunoTrack[] = json.tracks.map((t: any, idx: number) => ({
        id: `suno-${t.uuid}-${Date.now()}-${idx}`,
        uuid: t.uuid,
        title: t.title || `Chanson Suno ${t.uuid.slice(0, 8)}`,
        style: t.style || '',
        audioUrl: t.audioUrl,
        coverUrl: t.coverUrl,
        sourceUrl: t.sourceUrl,
        extractedAt: new Date().toISOString(),
      }));

      setExtractedSunoList((prev) => [...newExtracted, ...prev]);
      setSunoInputUrls('');
      notifyStudio(`${newExtracted.length} morceau(x) Suno extrait(s) avec succès.`, 'ok');
    } catch (err: any) {
      notifyStudio(`Erreur d'extraction Suno : ${err?.message || 'réseau'}`, 'error');
    } finally {
      setIsExtractingSuno(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* SECTION 3 : LIENS D'ÉCOUTE CLIENTS SÉCURISÉS (AVEC UPLOAD DIRECT)  */
  /* ------------------------------------------------------------------ */
  const [clientRecipient, setClientRecipient] = useState(currentOrder?.recipient || '');
  const [clientOccasion, setClientOccasion] = useState(currentOrder?.occasion || 'Anniversaire');
  const [track1Title, setTrack1Title] = useState('Version 01 (Afro-Love)');
  const [track1Url, setTrack1Url] = useState('');
  const [track1FileName, setTrack1FileName] = useState('');
  const [track2Title, setTrack2Title] = useState('Version 02 (Acoustique)');
  const [track2Url, setTrack2Url] = useState('');
  const [track2FileName, setTrack2FileName] = useState('');
  const [allowClientDownload, setAllowClientDownload] = useState(false);
  const [isUploadingTrack1, setIsUploadingTrack1] = useState(false);
  const [isUploadingTrack2, setIsUploadingTrack2] = useState(false);
  const [isCreatingClientLink, setIsCreatingClientLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Upload direct d'un fichier audio (Track 1)
  const handleUploadAudioFile = async (e: ChangeEvent<HTMLInputElement>, trackNum: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (trackNum === 1) {
      setIsUploadingTrack1(true);
      setTrack1FileName(file.name);
      const res = await uploadAudioTrack(file, 'v1');
      if (res.url) {
        setTrack1Url(res.url);
      } else {
        // Fallback ObjectURL local
        const localUrl = URL.createObjectURL(file);
        setTrack1Url(localUrl);
      }
      setIsUploadingTrack1(false);
    } else {
      setIsUploadingTrack2(true);
      setTrack2FileName(file.name);
      const res = await uploadAudioTrack(file, 'v2');
      if (res.url) {
        setTrack2Url(res.url);
      } else {
        const localUrl = URL.createObjectURL(file);
        setTrack2Url(localUrl);
      }
      setIsUploadingTrack2(false);
    }
  };

  const [createdLinks, setCreatedLinks] = useState<Array<{
    id: string;
    recipient: string;
    occasion: string;
    allowDownload: boolean;
    active?: boolean;
    playsCount?: number;
    shareUrl: string;
    createdAt: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENT_LINKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);
  const [isBulkUnlocking, setIsBulkUnlocking] = useState(false);

  // Synchronisation complète avec Supabase (inclut tous les liens déjà envoyés)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listMySharedTracks().then((remote) => {
      if (cancelled || remote.length === 0) return;
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.djelia.store';
      setCreatedLinks(
        remote.map((r) => ({
          id: r.id,
          recipient: r.recipient,
          occasion: r.occasion,
          allowDownload: r.allowDownload,
          active: r.active,
          playsCount: r.playsCount,
          shareUrl: `${origin}/ecoute/${studioSlug}/${r.id}`,
          createdAt: r.createdAt,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, studioSlug]);

  const handleToggleLinkDownload = async (link: { id: string; allowDownload: boolean }) => {
    setBusyLinkId(link.id);
    const next = !link.allowDownload;
    const res = await manageSharedTrack({ action: 'toggle-download', id: link.id, allowDownload: next });
    if (res.success) {
      setCreatedLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, allowDownload: next } : l)));
      notifyStudio(next ? 'Téléchargement déverrouillé pour ce client.' : 'Téléchargement verrouillé (écoute seule).', 'ok');
    } else {
      notifyStudio(res.error || 'Impossible de modifier le téléchargement.', 'error');
    }
    setBusyLinkId(null);
  };

  const handleToggleLinkActive = async (link: { id: string; active?: boolean }) => {
    setBusyLinkId(link.id);
    const currentlyActive = link.active !== false;
    const nextActive = !currentlyActive;
    const res = await manageSharedTrack({ action: 'toggle-active', id: link.id, active: nextActive });
    if (res.success) {
      setCreatedLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, active: nextActive } : l)));
      notifyStudio(nextActive ? 'Lien réactivé.' : 'Lien désactivé : le client ne peut plus y accéder.', 'ok');
    } else {
      notifyStudio(res.error || 'Impossible de modifier le statut du lien.', 'error');
    }
    setBusyLinkId(null);
  };

  const handleDeleteLink = async (id: string) => {
    setBusyLinkId(id);
    const res = await manageSharedTrack({ action: 'delete', id });
    if (res.success) {
      setCreatedLinks((prev) => prev.filter((l) => l.id !== id));
      notifyStudio('Lien d’écoute supprimé définitivement.', 'ok');
    } else {
      notifyStudio(res.error || 'Impossible de supprimer ce lien.', 'error');
    }
    setBusyLinkId(null);
  };

  const handleBulkUnlockDownloads = async () => {
    setIsBulkUnlocking(true);
    const res = await manageSharedTrack({ action: 'bulk-download', allowDownload: true });
    if (res.success) {
      setCreatedLinks((prev) => prev.map((l) => ({ ...l, allowDownload: true })));
      notifyStudio('Toutes les chansons de vos liens sont désormais téléchargeables.', 'ok');
    } else {
      notifyStudio(res.error || 'Impossible de mettre à jour tous les liens.', 'error');
    }
    setIsBulkUnlocking(false);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLIENT_LINKS, JSON.stringify(createdLinks));
    } catch {
      // Ignore
    }
  }, [createdLinks]);

  const handleCreateClientLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientRecipient.trim()) return;
    if (!track1Url.trim()) {
      notifyStudio('Veuillez uploader au moins un morceau audio avant de créer le lien.', 'error');
      return;
    }

    setIsCreatingClientLink(true);
    const cleanRecipientSlug = clientRecipient
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 18);
    const linkId = `${cleanRecipientSlug || 'audition'}-${Date.now().toString(36).slice(-5)}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.djelia.store';
    const finalShareUrl = `${origin}/ecoute/${studioSlug}/${linkId}`;

    try {
      const saveRes = await createSharedTrack({
        id: linkId,
        recipient: clientRecipient.trim(),
        occasion: clientOccasion.trim(),
        studio_name: studioName,
        creator_phone: creatorPhone || undefined,
        track1_title: track1Title.trim() || 'Version 01',
        track1_url: track1Url.trim(),
        track2_title: track2Url.trim() ? (track2Title.trim() || 'Version 02') : undefined,
        track2_url: track2Url.trim() || undefined,
        allow_download: allowClientDownload,
      });
      if (!saveRes.success) {
        notifyStudio(saveRes.error || 'Erreur lors de la sauvegarde du lien.', 'warn');
      } else {
        notifyStudio('Lien d’audition privée généré et sécurisé.', 'ok');
      }
    } catch {
      // Ignore
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
      {studioNotice && (
        <div
          className={`fixed top-5 right-5 z-50 max-w-md flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-top-2 ${
            studioNotice.tone === 'error'
              ? 'bg-rose-950/95 border-rose-500/40 text-rose-200'
              : studioNotice.tone === 'ok'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/95 border-amber-500/40 text-amber-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{studioNotice.text}</span>
        </div>
      )}
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
      {/* 1. EN-TÊTE ÉPURÉ DU STUDIO (masqué dans VoiceLab qui a déjà le sien) */}
      {/* ============================================================ */}
      {currentModule !== 'voice_lab' && (
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
                Atelier Studio Musical
              </h1>
            </div>

            {currentModule !== 'hub' && (
              <button
                type="button"
                onClick={() => setCurrentModule('hub')}
                className="px-4 py-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white/90 inline-flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à l'accueil du Studio</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* ============================================================ */}
      {/* 2. VUE D'ACCUEIL DU STUDIO PAR CARTES DE PRESTIGE (LE HUB)   */}
      {/* ============================================================ */}
      {currentModule === 'hub' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* CARTE 1 : CRÉATION DE CHANSONS & BIBLIOTHÈQUE */}
            <div
              onClick={() => setCurrentModule('generate')}
              className="group p-6 rounded-3xl bg-[#08090C] border border-white/[0.08] hover:border-[#E2BD6B]/50 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:shadow-2xl hover:shadow-black/50 relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E2BD6B]/15 border border-[#E2BD6B]/30 flex items-center justify-center text-[#E2BD6B] group-hover:scale-105 transition-transform duration-300">
                  <Music className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#E2BD6B] font-bold">
                    Pôle 01
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-[#E2BD6B] transition-colors">
                    Création & Discothèque
                  </h3>
                  <p className="text-xs text-[#8A90A0] leading-relaxed">
                    Composez des chansons avec titre, style sur-mesure au clavier, type de voix, durée et paroles. Téléchargez vos masters HD avec jaquette.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-white/90 group-hover:text-white">
                <span>Ouvrir l'atelier création</span>
                <ChevronRight className="w-4 h-4 text-[#E2BD6B] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* CARTE 2 : EXTRACTEUR EXPRESS DE LIENS SUNO */}
            <div
              onClick={() => setCurrentModule('suno_extractor')}
              className="group p-6 rounded-3xl bg-[#08090C] border border-white/[0.08] hover:border-[#E2BD6B]/50 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:shadow-2xl hover:shadow-black/50 relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#10D98E]/15 border border-[#10D98E]/30 flex items-center justify-center text-[#10D98E] group-hover:scale-105 transition-transform duration-300">
                  <Link2 className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#10D98E] font-bold">
                    Pôle 02
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-[#10D98E] transition-colors">
                    Extracteur Suno Express
                  </h3>
                  <p className="text-xs text-[#8A90A0] leading-relaxed">
                    Collez 1 ou plusieurs liens Suno (liens de partage, liens courts ou identifiants UUID) et extrayez instantanément le MP3 HD et la cover officielle.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-white/90 group-hover:text-white">
                <span>Extraire des liens</span>
                <ChevronRight className="w-4 h-4 text-[#10D98E] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* CARTE 3 : LIENS D'ÉCOUTE CLIENT SÉCURISÉS */}
            <div
              onClick={() => setCurrentModule('client_links')}
              className="group p-6 rounded-3xl bg-[#08090C] border border-white/[0.08] hover:border-[#E2BD6B]/50 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:shadow-2xl hover:shadow-black/50 relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform duration-300">
                  <Headphones className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400 font-bold">
                    Pôle 03
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
                    Auditions Clients Privées
                  </h3>
                  <p className="text-xs text-[#8A90A0] leading-relaxed">
                    Uploadez directement vos morceaux pour générer une page d'écoute fermée. Choisissez d'autoriser ou de verrouiller le téléchargement avant solde.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-white/90 group-hover:text-white">
                <span>Gérer les liens d'écoute</span>
                <ChevronRight className="w-4 h-4 text-sky-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* CARTE 4 : STUDIO VOCAL & VOIX IA (FISH AUDIO) */}
            <div
              onClick={() => setCurrentModule('voice_lab')}
              className="group p-6 rounded-3xl bg-[#08090C] border border-white/[0.08] hover:border-violet-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:shadow-2xl hover:shadow-black/50 relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform duration-300">
                  <Mic className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400 font-bold">
                    Pôle 04
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors">
                    Studio Vocal & Voix IA
                  </h3>
                  <p className="text-xs text-[#8A90A0] leading-relaxed">
                    Catalogue Fish Audio de voix ouest-africaines et françaises. Générez des notes vocales WhatsApp authentiques, expédiez-les en direct ou automatisez par emojis.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-white/90 group-hover:text-white">
                <span>Ouvrir le studio vocal</span>
                <ChevronRight className="w-4 h-4 text-violet-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. PÔLE 1 : CRÉATION DE CHANSONS & BIBLIOTHÈQUE              */}
      {/* ============================================================ */}
      {currentModule === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in">
          {/* Formulaire de Composition de Chanson */}
          <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#08090C] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-[#E2BD6B]" />
                <h3 className="text-sm font-bold text-white">Composer une Chanson</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-[#8A90A0]">
                Moteur Suno IA
              </span>
            </div>

            <form onSubmit={handleGenerateSong} className="space-y-4">
              {/* 1. Titre de la chanson */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Titre de la chanson *
                  </label>
                  <span
                    className={`text-[10px] font-mono ${
                      isTitleOver
                        ? 'text-rose-400 font-bold'
                        : songTitle.length >= KIE_LIMITS.title * 0.9
                        ? 'text-amber-400'
                        : 'text-white/40'
                    }`}
                  >
                    {songTitle.length} / {KIE_LIMITS.title}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={songTitle}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSongTitle(v);
                    if (v.length > KIE_LIMITS.title && songTitle.length <= KIE_LIMITS.title) {
                      notifyStudio(`Limite Suno/Kie.ai atteinte : le titre ne doit pas dépasser ${KIE_LIMITS.title} caractères.`, 'warn');
                    }
                  }}
                  placeholder="Ex: Aminata, Reine de nos Cœurs"
                  className={`w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border text-sm text-white focus:outline-none ${
                    isTitleOver ? 'border-rose-500 focus:border-rose-400' : 'border-white/[0.08] focus:border-[#E2BD6B]'
                  }`}
                />
                {isTitleOver && (
                  <p className="text-[11px] text-rose-400">
                    Dépassement de {songTitle.length - KIE_LIMITS.title} caractère(s) sur la limite Suno ({KIE_LIMITS.title} max).
                  </p>
                )}
              </div>

              {/* 2. Style Musical au clavier libre */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Style Musical (champ style Kie.ai) *
                  </label>
                  <span
                    className={`text-[10px] font-mono ${
                      isStyleOver
                        ? 'text-rose-400 font-bold'
                        : songStyle.length >= KIE_LIMITS.style * 0.9
                        ? 'text-amber-400'
                        : 'text-white/40'
                    }`}
                  >
                    {songStyle.length} / {KIE_LIMITS.style}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={songStyle}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSongStyle(v);
                    if (v.length > KIE_LIMITS.style && songStyle.length <= KIE_LIMITS.style) {
                      notifyStudio(`Limite Suno/Kie.ai atteinte : le style ne doit pas dépasser ${KIE_LIMITS.style} caractères.`, 'warn');
                    }
                  }}
                  placeholder="Tapez le style : Zouk, Afro-Love, Rumba, Gospel, Amapiano..."
                  className={`w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border text-xs text-white focus:outline-none ${
                    isStyleOver ? 'border-rose-500 focus:border-rose-400' : 'border-white/[0.08] focus:border-[#E2BD6B]'
                  }`}
                />
                {isStyleOver && (
                  <p className="text-[11px] text-rose-400">
                    Dépassement de {songStyle.length - KIE_LIMITS.style} caractère(s) sur la limite Suno ({KIE_LIMITS.style} max).
                  </p>
                )}

                {/* Suggestions rapides en 1 clic */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {styleSuggestions.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSongStyle(st)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                        songStyle.toLowerCase() === st.toLowerCase()
                          ? 'bg-[#E2BD6B]/20 border-[#E2BD6B] text-[#E2BD6B]'
                          : 'bg-white/[0.03] border-white/[0.06] text-[#8A90A0] hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-[#8A90A0]">
                    Paroles (champ prompt Kie.ai)
                  </label>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono ${
                        isLyricsOver
                          ? 'text-rose-400 font-bold'
                          : songLyrics.length >= KIE_LIMITS.lyrics * 0.9
                          ? 'text-amber-400'
                          : 'text-white/40'
                      }`}
                    >
                      {songLyrics.length} / {KIE_LIMITS.lyrics}
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoWriteLyrics}
                      className="text-[11px] text-[#E2BD6B] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Rédiger avec l'IA</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={songLyrics}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSongLyrics(v);
                    if (v.length > KIE_LIMITS.lyrics && songLyrics.length <= KIE_LIMITS.lyrics) {
                      notifyStudio(`Limite Suno/Kie.ai atteinte : les paroles ne doivent pas dépasser ${KIE_LIMITS.lyrics} caractères.`, 'warn');
                    }
                  }}
                  placeholder="Écrivez ou collez les paroles ici, ou cliquez sur 'Rédiger avec l'IA'..."
                  className={`w-full px-3.5 py-2.5 rounded-2xl bg-[#050608] border text-xs text-white focus:outline-none font-mono leading-relaxed resize-none ${
                    isLyricsOver ? 'border-rose-500 focus:border-rose-400' : 'border-white/[0.08] focus:border-[#E2BD6B]'
                  }`}
                />
                {isLyricsOver && (
                  <p className="text-[11px] text-rose-400">
                    Dépassement de {songLyrics.length - KIE_LIMITS.lyrics} caractère(s) sur la limite Suno ({KIE_LIMITS.lyrics} max).
                  </p>
                )}
              </div>

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

          {/* Bibliothèque des Chansons Générées */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl border border-white/[0.06] bg-[#08090C] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[#8A90A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par titre, mots des paroles, style..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#050608] border border-white/[0.06] text-xs text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <span className="text-[11px] font-mono text-[#8A90A0]">
                {filteredSongs.length} morceau{filteredSongs.length > 1 ? 's' : ''} en discothèque
              </span>
            </div>

            <div className="space-y-3">
              {filteredSongs.map((song) => {
                const isPlaying = playingSongId === song.id;

                return (
                  <div
                    key={song.id}
                    className="p-4 rounded-3xl bg-[#08090C] border border-white/[0.06] hover:border-white/[0.1] transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
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
                            Pour <strong className="text-white/90">{song.recipient}</strong> · Style : {song.style} ({song.voice})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadSong(song)}
                          className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/90 hover:text-white transition-colors cursor-pointer"
                          title="Télécharger le Master MP3 HD"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {song.videoUrl ? (
                          <a
                            href={`/api/suno?action=download&url=${encodeURIComponent(song.videoUrl)}&filename=${encodeURIComponent(`${song.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Lyrics.mp4`)}`}
                            className="px-2.5 py-2 rounded-xl bg-[#E2BD6B]/15 border border-[#E2BD6B]/40 text-[#E2BD6B] text-[11px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#E2BD6B]/25 transition-colors"
                            title="Télécharger la Vidéo Lyrics MP4"
                          >
                            <Film className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">MP4 Lyrics</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled={song.videoStatus === 'generating'}
                            onClick={() => handleCreateLyricsVideo(song)}
                            className="px-2.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            title="Transformer en Vidéo Lyrics MP4 via Kie.ai"
                          >
                            <Film className={`w-3.5 h-3.5 ${song.videoStatus === 'generating' ? 'animate-spin text-[#E2BD6B]' : ''}`} />
                            <span className="hidden sm:inline">
                              {song.videoStatus === 'generating' ? 'Vidéo…' : 'Vidéo Lyrics'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setClientRecipient(song.recipient);
                            setTrack1Title(song.title);
                            setTrack1Url(song.audioUrl);
                            setCurrentModule('client_links');
                          }}
                          className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold inline-flex items-center gap-1.5 hover:bg-neutral-200 transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Lien client</span>
                        </button>
                      </div>
                    </div>

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
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. PÔLE 2 : EXTRACTEUR EXPRESS DE LIENS SUNO                 */}
      {/* ============================================================ */}
      {currentModule === 'suno_extractor' && (
        <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
          <div className="rounded-3xl border border-white/[0.08] bg-[#08090C] p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#E2BD6B]" />
              <h3 className="text-base font-bold text-white">Extracteur de Liens Suno</h3>
            </div>
            <p className="text-xs text-[#8A90A0] leading-relaxed">
              Collez un ou plusieurs liens Suno (liens de partage <code className="text-white/80 font-mono">suno.com/song/...</code>, liens courts <code className="text-white/80 font-mono">suno.com/s/...</code> ou identifiants UUID). Le système extrait immédiatement l'audio MP3 HD et la jaquette officielle.
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
                  Gère 1 lien ou les 2 versions générées simultanément.
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

          {extractedSunoList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8A90A0]">
                  Morceaux Extraits ({extractedSunoList.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setExtractedSunoList([])}
                  className="text-[11px] text-white/50 hover:text-white transition-colors cursor-pointer"
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
                      <button
                        type="button"
                        onClick={() => {
                          if (playingSongId === track.id && audioPlayerRef.current) {
                            if (audioPlayerRef.current.paused) audioPlayerRef.current.play();
                            else audioPlayerRef.current.pause();
                          } else if (audioPlayerRef.current) {
                            setPlayingSongId(track.id);
                            audioPlayerRef.current.src = track.audioUrl;
                            audioPlayerRef.current.play().catch(() => {});
                          }
                        }}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/90 hover:text-white transition-colors cursor-pointer"
                        title="Écouter l'extrait"
                      >
                        {playingSongId === track.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <a
                        href={`/api/suno?action=suno-audio&uuid=${encodeURIComponent(track.uuid)}&download=1&title=${encodeURIComponent(track.title)}`}
                        download={`${track.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.m4a`}
                        className="px-3.5 py-2 rounded-xl bg-white text-black text-xs font-bold inline-flex items-center gap-1.5 hover:bg-neutral-200 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger Audio</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setTrack1Title(track.title);
                          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.djelia.store';
                          setTrack1Url(`${origin}/api/suno?action=suno-audio&uuid=${encodeURIComponent(track.uuid)}&title=${encodeURIComponent(track.title)}`);
                          setCurrentModule('client_links');
                        }}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-colors cursor-pointer"
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
      {/* 5. PÔLE 3 : LIENS D'ÉCOUTE CLIENTS (AVEC UPLOAD DIRECT)      */}
      {/* ============================================================ */}
      {currentModule === 'client_links' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in">
          {/* Formulaire de Création avec Upload Direct */}
          <div className="lg:col-span-6 rounded-3xl border border-white/[0.08] bg-[#08090C] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#E2BD6B]" />
                <h3 className="text-sm font-bold text-white">Générer un Lien d'Écoute Client</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                Audition Sécurisée
              </span>
            </div>

            <p className="text-xs text-[#8A90A0] leading-relaxed">
              Uploadez directement les fichiers MP3 ou collez leurs URLs pour créer la page confidentielle de votre client.
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

              {/* Version 1 avec Upload Audio Direct */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#050608] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#E2BD6B]">Morceau 01 (Version Principale)</span>
                  {track1FileName && (
                    <span className="text-[10px] text-white/50 font-mono truncate max-w-[140px]">
                      {track1FileName}
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={track1Title}
                  onChange={(e) => setTrack1Title(e.target.value)}
                  placeholder="Titre : Version 01 (Afro-Love)"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white focus:outline-none"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={track1Url}
                    onChange={(e) => setTrack1Url(e.target.value)}
                    placeholder="URL Audio directe ou uploadez le fichier ci-contre →"
                    className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 font-mono focus:outline-none truncate"
                  />

                  <label className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold shrink-0 cursor-pointer hover:bg-neutral-200 transition-colors inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingTrack1 ? 'Upload…' : 'Uploader'}</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleUploadAudioFile(e, 1)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Version 2 avec Upload Audio Direct (Optionnelle) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#050608] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/70">Morceau 02 (Seconde Version Alternative)</span>
                  {track2FileName && (
                    <span className="text-[10px] text-white/50 font-mono truncate max-w-[140px]">
                      {track2FileName}
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  value={track2Title}
                  onChange={(e) => setTrack2Title(e.target.value)}
                  placeholder="Titre : Version 02 (Acoustique douce)"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white focus:outline-none"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={track2Url}
                    onChange={(e) => setTrack2Url(e.target.value)}
                    placeholder="URL Audio directe alternative (optionnel)"
                    className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 font-mono focus:outline-none truncate"
                  />

                  <label className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingTrack2 ? 'Upload…' : 'Uploader'}</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleUploadAudioFile(e, 2)}
                      className="sr-only"
                    />
                  </label>
                </div>
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

          {/* Historique des Liens d'Écoute Actifs */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8A90A0]">
                Liens d'Écoute ({createdLinks.length})
              </h4>

              {createdLinks.some((l) => !l.allowDownload) && (
                <button
                  type="button"
                  disabled={isBulkUnlocking}
                  onClick={handleBulkUnlockDownloads}
                  className="px-3 py-1.5 rounded-xl bg-[#10D98E]/15 border border-[#10D98E]/30 text-[#10D98E] text-[11px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#10D98E]/25 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlock className="w-3 h-3" />
                  <span>{isBulkUnlocking ? 'Activation…' : 'Tout rendre téléchargeable'}</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {createdLinks.map((link) => {
                const isActive = link.active !== false;
                const isBusy = busyLinkId === link.id;
                return (
                  <div
                    key={link.id}
                    className={`p-4 rounded-3xl bg-[#08090C] border transition-all space-y-3 ${
                      isActive ? 'border-white/[0.06] hover:border-white/[0.1]' : 'border-rose-500/20 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white truncate">{link.recipient}</h4>
                          <span className="text-xs text-[#E2BD6B]">({link.occasion})</span>
                          {!isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-mono">
                              Désactivé
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#8A90A0] font-mono mt-0.5">
                          Réf: {link.id}{typeof link.playsCount === 'number' ? ` · ${link.playsCount} écoute(s)` : ''}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full font-mono font-semibold inline-flex items-center gap-1 shrink-0 ${
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
                        title="Ouvrir la page client"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Contrôles rapides 1-clic : Téléchargement, Activer/Désactiver, Supprimer */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.05]">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleLinkDownload(link)}
                        className={`flex-1 min-w-[160px] px-3 py-2 rounded-xl text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 ${
                          link.allowDownload
                            ? 'bg-white/[0.04] border-white/[0.08] text-white/80 hover:bg-white/[0.08]'
                            : 'bg-[#10D98E]/15 border-[#10D98E]/30 text-[#10D98E] hover:bg-[#10D98E]/25'
                        }`}
                      >
                        {link.allowDownload ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>{link.allowDownload ? 'Verrouiller téléchargement' : 'Rendre téléchargeable'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleLinkActive(link)}
                        className={`px-3 py-2 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 ${
                          isActive
                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{isActive ? 'Désactiver' : 'Réactiver'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteLink(link.id)}
                        className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title="Supprimer ce lien"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* ============================================================ */}
      {/* 5. PÔLE 4 : STUDIO VOCAL & VOIX IA (FISH AUDIO)              */}
      {/* ============================================================ */}
      {currentModule === 'voice_lab' && (
        <VoiceLabView
          orders={orders}
          onBackToHub={() => setCurrentModule('hub')}
        />
      )}
    </div>
  );
};
