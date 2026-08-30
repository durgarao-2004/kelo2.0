/**
 * Defensive parsing of model output. Models sometimes wrap JSON in prose or
 * code fences; extract the object robustly.
 */
export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continue
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // continue
    }
  }
  return null;
}

export function asStringArray(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
}

export interface Flashcard {
  q: string;
  a: string;
}

export function asFlashcards(value: unknown, max = 30): Flashcard[] {
  if (!Array.isArray(value)) return [];
  const cards: Flashcard[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).q === "string" &&
      typeof (item as Record<string, unknown>).a === "string"
    ) {
      cards.push({
        q: (item as Flashcard).q.trim(),
        a: (item as Flashcard).a.trim(),
      });
    }
    if (cards.length >= max) break;
  }
  return cards;
}

export interface Definition {
  term: string;
  definition: string;
}

/** Definitions the lecturer actually gave — defensively parsed so a
 * malformed/partial model response degrades to fewer entries, never a crash. */
export function asDefinitions(value: unknown, max = 50): Definition[] {
  if (!Array.isArray(value)) return [];
  const out: Definition[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).term === "string" &&
      typeof (item as Record<string, unknown>).definition === "string" &&
      (item as Record<string, string>).term.trim() &&
      (item as Record<string, string>).definition.trim()
    ) {
      out.push({
        term: (item as Definition).term.trim(),
        definition: (item as Definition).definition.trim(),
      });
    }
    if (out.length >= max) break;
  }
  return out;
}

export interface NoteSection {
  heading: string;
  points: string[];
}

/** Structured lecture notes as headed sections of bullet points. */
export function asNoteSections(value: unknown, max = 20): NoteSection[] {
  if (!Array.isArray(value)) return [];
  const out: NoteSection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const heading = (item as Record<string, unknown>).heading;
    const points = asStringArray((item as Record<string, unknown>).points, 30);
    if (typeof heading === "string" && heading.trim() && points.length > 0) {
      out.push({ heading: heading.trim(), points });
    }
    if (out.length >= max) break;
  }
  return out;
}
