const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const CMS_FILE_TYPES = new Set(['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/vnd.rar', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/octet-stream', 'text/plain', 'application/vnd.android.package-archive', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

const detectedImageType = buffer => {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return 'image/gif';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString() === 'ftyp' && buffer.subarray(8, 12).toString().includes('avif')) return 'image/avif';
  return null;
};

const assertCmsImageBuffer = buffer => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) { const error = new Error('Vui lòng chọn ảnh.'); error.status = 400; throw error; }
  if (buffer.length > MAX_IMAGE_BYTES) { const error = new Error('Ảnh không được vượt quá 5 MB.'); error.status = 413; throw error; }
  if (!detectedImageType(buffer)) { const error = new Error('Tệp không phải định dạng ảnh được hỗ trợ.'); error.status = 400; throw error; }
};

const assertCmsFile = (file) => {
  if (!file?.buffer?.length) { const error = new Error('Vui lòng chọn tệp.'); error.status = 400; throw error; }
  if (file.buffer.length > MAX_FILE_BYTES) { const error = new Error('Tệp không được vượt quá 50 MB.'); error.status = 413; throw error; }
  if (!CMS_FILE_TYPES.has(String(file.mimetype || '').toLowerCase())) { const error = new Error('Định dạng tệp chưa được hỗ trợ.'); error.status = 400; throw error; }
};

module.exports = { MAX_IMAGE_BYTES, MAX_FILE_BYTES, detectedImageType, assertCmsImageBuffer, assertCmsFile };