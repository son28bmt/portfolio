export const mediaUrlVectors = [
  { value: 'https://example.com/image.jpg', valid: true },
  { value: 'http://example.com/video.mp4', valid: true },
  { value: '/uploads/images/photo.jpg', valid: true },
  { value: 'javascript:alert(1)', valid: false },
  { value: 'data:image/png;base64,abc', valid: false },
  { value: '/uploads/../secret.jpg', valid: false },
  { value: '/uploads/%2e%2e/secret.jpg', valid: false },
  { value: '/uploads//host/file.jpg', valid: false },
  { value: '/uploads/\\file.jpg', valid: false }
];