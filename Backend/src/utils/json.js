export const stripMarkdownCodeFences = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};
