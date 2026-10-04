import { supabase } from './supabase';

export interface SharedTrackRecord {
  id: string;
  recipient: string;
  occasion: string;
  studio_name: string;
  creator_phone?: string;
  track1_title: string;
  track1_url: string;
  track2_title?: string;
  track2_url?: string;
  allow_download: boolean;
  plays_count?: number;
  created_at?: string;
}

/**
 * Uploade un fichier audio dans le bucket public 'shared-audio' de Supabase
 */
export async function uploadAudioTrack(file: File, prefix = 'track'): Promise<{ url: string | null; error?: string }> {
  try {
    const ext = file.name.split('.').pop() || 'mp3';
    const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;
    const storagePath = `tracks/${filename}`;

    const { data, error } = await supabase.storage
      .from('shared-audio')
      .upload(storagePath, file, {
        contentType: file.type || 'audio/mpeg',
        upsert: true,
      });

    if (error || !data) {
      console.error('Erreur upload audio Supabase:', error);
      return { url: null, error: error?.message || 'Upload échoué' };
    }

    const { data: pubData } = supabase.storage
      .from('shared-audio')
      .getPublicUrl(storagePath);

    return { url: pubData.publicUrl };
  } catch (err: any) {
    console.error('Exception upload audio:', err);
    return { url: null, error: err.message || 'Erreur réseau lors de l\'upload' };
  }
}

/**
 * Enregistre une fiche d'écoute protégée dans la base Supabase
 */
export async function createSharedTrack(track: Omit<SharedTrackRecord, 'created_at' | 'plays_count'>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('shared_tracks')
      .insert({
        id: track.id,
        recipient: track.recipient,
        occasion: track.occasion,
        studio_name: track.studio_name || 'Studio Velaris',
        creator_phone: track.creator_phone || null,
        track1_title: track.track1_title,
        track1_url: track.track1_url,
        track2_title: track.track2_title || null,
        track2_url: track.track2_url || null,
        allow_download: Boolean(track.allow_download),
      });

    if (error) {
      console.error('Erreur création shared_track en base:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur lors de l\'enregistrement' };
  }
}

/**
 * Récupère une fiche d'écoute protégée par son ID unique
 */
export async function getSharedTrackById(id: string): Promise<SharedTrackRecord | null> {
  try {
    const { data, error } = await supabase
      .from('shared_tracks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Incrémente silencieusement le compteur de lecture
    try {
      void supabase.rpc('increment_track_plays', { p_id: id }).then(undefined, () => {
        // Fallback update direct
        void supabase
          .from('shared_tracks')
          .update({ plays_count: (data.plays_count || 0) + 1 })
          .eq('id', id);
      });
    } catch {
      // ignore
    }

    return {
      id: data.id,
      recipient: data.recipient,
      occasion: data.occasion,
      studio_name: data.studio_name || 'Studio Velaris',
      creator_phone: data.creator_phone,
      track1_title: data.track1_title,
      track1_url: data.track1_url,
      track2_title: data.track2_title,
      track2_url: data.track2_url,
      allow_download: Boolean(data.allow_download),
      plays_count: data.plays_count || 0,
      created_at: data.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Récupère les récents partages créés
 */
export async function getRecentSharedTracks(limit = 20): Promise<SharedTrackRecord[]> {
  try {
    const { data, error } = await supabase
      .from('shared_tracks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      recipient: d.recipient,
      occasion: d.occasion,
      studio_name: d.studio_name || 'Studio Velaris',
      creator_phone: d.creator_phone,
      track1_title: d.track1_title,
      track1_url: d.track1_url,
      track2_title: d.track2_title,
      track2_url: d.track2_url,
      allow_download: Boolean(d.allow_download),
      plays_count: d.plays_count || 0,
      created_at: d.created_at,
    }));
  } catch {
    return [];
  }
}
