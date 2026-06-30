export const toRedactedTxtFilename = (originalFilename) => {
  const base = String(originalFilename || 'document')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'document';

  return `${base}.redacted.txt`;
};
