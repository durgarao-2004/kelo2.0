/**
 * Google Drive folder tree planning — pure logic.
 * Every lecture is organized as:
 *   KELO / YEAR / SEMESTER / SUBJECT / { Recordings, Transcripts, Summaries }
 */
export const KELO_ROOT = "KELO";
export const LEAF_FOLDERS = ["Recordings", "Transcripts", "Summaries"] as const;
export type LeafFolder = (typeof LEAF_FOLDERS)[number];

export interface FolderPlanInput {
  year?: number | string | null;
  semester?: string | null;
  subject: string;
}

/** Drive folder names can't safely contain slashes; normalize whitespace too. */
export function sanitizeSegment(value: string): string {
  return (
    value
      .replace(/[/\\]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Untitled"
  );
}

/** ['KELO', '2026', 'Semester 1', 'Data Science'] */
export function subjectPathSegments(input: FolderPlanInput): string[] {
  const year =
    input.year === null || input.year === undefined || input.year === ""
      ? String(new Date().getFullYear())
      : String(input.year);
  const semester = input.semester?.trim() ? input.semester : "General";
  return [
    KELO_ROOT,
    sanitizeSegment(year),
    sanitizeSegment(semester),
    sanitizeSegment(input.subject),
  ];
}

/** Path to a specific leaf, e.g. the Recordings folder for a subject. */
export function leafPathSegments(
  input: FolderPlanInput,
  leaf: LeafFolder,
): string[] {
  return [...subjectPathSegments(input), leaf];
}

/**
 * The full ordered set of folder paths to ensure exist, root-first, so each
 * parent is created before its child. Includes the three leaf folders.
 */
export function fullFolderPlan(input: FolderPlanInput): string[][] {
  const base = subjectPathSegments(input);
  const paths: string[][] = [];
  for (let i = 1; i <= base.length; i++) {
    paths.push(base.slice(0, i));
  }
  for (const leaf of LEAF_FOLDERS) {
    paths.push([...base, leaf]);
  }
  return paths;
}

export function pathString(segments: string[]): string {
  return segments.join("/");
}
