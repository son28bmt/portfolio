import api from './api';

const getMimeTypeFromFileName = (fileName = '') => {
  const ext = fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
  const map = {
    apk: 'application/vnd.android.package-archive',
    ipa: 'application/octet-stream',
    ios: 'application/octet-stream',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
};

/**
 * Upload files directly to Cloudflare R2 using Presigned URLs when possible.
 * Bypasses backend body parser, Nginx, and Cloudflare proxy file size limits (100MB max).
 */
export const uploadToCloudflareR2 = async (files, folder = 'projects') => {
  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) return [];

  const urls = [];

  for (const file of fileArray) {
    try {
      const mimeType = file.type || getMimeTypeFromFileName(file.name);

      // 1. Fetch Presigned upload URL from backend
      const { data } = await api.get('/projects/get-upload-url', {
        params: {
          fileName: file.name,
          mimeType,
          folder,
        },
      });

      if (data?.uploadUrl && data?.publicUrl) {
        // 2. Direct HTTP PUT to Cloudflare R2 presigned URL
        const uploadRes = await fetch(data.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`R2 Direct Upload Failed with status ${uploadRes.status}`);
        }

        let finalUrl = data.publicUrl;
        const isAppUpload = /^projects\/(apps|files)\//i.test(String(folder));
        if (isAppUpload) {
          try {
            const urlObj = new URL(finalUrl);
            urlObj.searchParams.set('downloadName', String(file.name || '').trim());
            finalUrl = urlObj.toString();
          } catch {
            // Keep default finalUrl if URL parse fails
          }
        }
        urls.push(finalUrl);
        continue;
      }
    } catch (err) {
      console.warn('Presigned R2 upload failed, falling back to multipart API POST:', err?.message || err);
    }

    // 3. Fallback to server multipart endpoint if presigned fails
    const payload = new FormData();
    payload.append('folder', folder);
    payload.append('files', file);

    const { data } = await api.post('/projects/upload-images', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (Array.isArray(data?.urls)) {
      urls.push(...data.urls);
    }
  }

  return urls;
};

export default uploadToCloudflareR2;
