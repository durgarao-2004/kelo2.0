/**
 * Pure integrity check used both server-side (finalize, against Storage) and
 * client-side (resume, against IndexedDB): given the chunk indexes we can
 * currently account for and how many chunks the recorder believes it
 * produced, which indexes (0..expectedCount-1) are missing?
 */
export function findMissingChunkIndexes(
  presentIndexes: number[],
  expectedCount: number,
): number[] {
  const present = new Set(presentIndexes);
  const missing: number[] = [];
  for (let i = 0; i < expectedCount; i++) {
    if (!present.has(i)) missing.push(i);
  }
  return missing;
}
