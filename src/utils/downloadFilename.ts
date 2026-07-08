const FILENAME_UNSAFE_CHARS = /[<>:"/\\|?*]+/g;
const WHITESPACE_RUN = /\s+/g;

const stripControlCharacters = (value: string) => Array.from(value)
  .filter(character => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  })
  .join('');

export const ensureFileExtension = (filename: string, extension: string) => (
  filename.toLowerCase().endsWith(extension.toLowerCase()) ? filename : `${filename}${extension}`
);

export const safeDownloadFilename = (
  filename: string,
  extension: string,
  fallback = 'download',
) => {
  const normalizedFilename = stripControlCharacters(filename)
    .replace(FILENAME_UNSAFE_CHARS, '_')
    .replace(WHITESPACE_RUN, ' ')
    .trim();

  return ensureFileExtension(normalizedFilename || fallback, extension);
};
