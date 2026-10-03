/**
 * URL signées des médias du bucket privé (vocaux du gérant, chansons, exemples).
 * WAHA télécharge le fichier depuis cette URL ; elle expire au bout d'une heure.
 */

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  ogg: 'audio/ogg; codecs=opus', opus: 'audio/ogg; codecs=opus', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
  mp4: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

export interface StorageSignerOptions {
  supabaseUrl: string;
  secretKey: string;
  bucket?: string;
  expiresInSeconds?: number;
  fetchImpl?: typeof fetch;
}

export function createMediaSigner(opts: StorageSignerOptions) {
  const bucket = opts.bucket ?? 'product-files';
  const fetchImpl = opts.fetchImpl ?? fetch;
  return async (path: string): Promise<{ url: string; mimetype: string; filename: string }> => {
    const clean = path.replace(/^\/+/, '');
    const res = await fetchImpl(`${opts.supabaseUrl}/storage/v1/object/sign/${bucket}/${clean.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { apikey: opts.secretKey, Authorization: `Bearer ${opts.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: opts.expiresInSeconds ?? 3600 }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`sign_failed_${res.status}`);
    const json = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const rel = json.signedURL ?? json.signedUrl;
    if (!rel) throw new Error('sign_no_url');
    const filename = clean.split('/').pop() ?? 'fichier';
    const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
    return { url: `${opts.supabaseUrl}/storage/v1${rel}`, mimetype: MIME_BY_EXT[ext] ?? 'application/octet-stream', filename };
  };
}
