export const SAFE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const SAFE_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const isSafeImageFile = (file: File) => SAFE_IMAGE_TYPES.has(file.type);

export const getSafeImageExtension = (file: File, fallback = 'jpg') => (
  SAFE_IMAGE_EXTENSIONS[file.type] || fallback
);
