import api from './api';

export async function uploadCmsImage(file, folder = 'cms/images') {
  if (!file || !file.type.startsWith('image/')) throw new Error('Chỉ được tải lên tệp ảnh.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh không được vượt quá 5 MB.');
  const body = new FormData();
  body.append('image', file);
  body.append('folder', folder);
  const { data } = await api.post('/admin/cms/upload-image', body, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.url;
}