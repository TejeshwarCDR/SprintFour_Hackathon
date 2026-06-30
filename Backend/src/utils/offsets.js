export const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export const boundariesDifferBeyondTolerance = (left, right, tolerance = 2) => (
  Math.abs(left.start - right.start) > tolerance ||
  Math.abs(left.end - right.end) > tolerance
);

export const normalizeEndOffset = (text, start, end) => {
  const safeStart = Math.max(0, Math.min(text.length, Number(start)));
  const safeEnd = Math.max(safeStart, Math.min(text.length, Number(end)));
  return { start: safeStart, end: safeEnd };
};
