/**
 * Timetable validation & status — pure logic.
 * Slots are recurring weekly: { day_of_week 0..6, start_minute, end_minute }.
 */
export interface TimeSlot {
  id?: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
}

export type SlotValidation =
  | { valid: true }
  | { valid: false; reason: string };

export function validateSlot(slot: {
  day_of_week: number;
  start_minute: number;
  end_minute: number;
}): SlotValidation {
  const { day_of_week, start_minute, end_minute } = slot;
  if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
    return { valid: false, reason: "Day must be between Sunday and Saturday." };
  }
  if (!Number.isInteger(start_minute) || start_minute < 0 || start_minute > 1439) {
    return { valid: false, reason: "Start time is invalid." };
  }
  if (!Number.isInteger(end_minute) || end_minute < 1 || end_minute > 1440) {
    return { valid: false, reason: "End time is invalid." };
  }
  if (end_minute <= start_minute) {
    return { valid: false, reason: "End time must be after start time." };
  }
  return { valid: true };
}

/** Do two slots overlap? (Same day and intersecting half-open intervals.) */
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  if (a.day_of_week !== b.day_of_week) return false;
  return a.start_minute < b.end_minute && b.start_minute < a.end_minute;
}

/** All overlapping pairs within a set of slots. */
export function findOverlaps(slots: TimeSlot[]): Array<[TimeSlot, TimeSlot]> {
  const pairs: Array<[TimeSlot, TimeSlot]> = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) pairs.push([slots[i], slots[j]]);
    }
  }
  return pairs;
}

/**
 * Would `candidate` conflict with any existing slot? Used when adding/editing.
 * When editing, pass the slot's own id as `ignoreId` so it doesn't clash with
 * itself.
 */
export function conflictsWithExisting(
  candidate: TimeSlot,
  existing: TimeSlot[],
  ignoreId?: string,
): boolean {
  return existing.some(
    (slot) =>
      (ignoreId === undefined || slot.id !== ignoreId) &&
      slotsOverlap(candidate, slot),
  );
}

export type ClassStatus =
  | "upcoming"
  | "starting_soon"
  | "in_progress"
  | "completed";

/**
 * Status of a class on its own day, given the current minute-of-day.
 * "starting_soon" is the 15-minute window before the start.
 */
export function classStatus(
  startMinute: number,
  endMinute: number,
  nowMinute: number,
  soonWindow = 15,
): ClassStatus {
  if (nowMinute >= endMinute) return "completed";
  if (nowMinute >= startMinute) return "in_progress";
  if (nowMinute >= startMinute - soonWindow) return "starting_soon";
  return "upcoming";
}

/** The next upcoming/in-progress slot today, or null. Sorted by start time. */
export function nextClassToday<T extends TimeSlot>(
  todaySlots: T[],
  nowMinute: number,
): T | null {
  const candidates = todaySlots
    .filter((s) => s.end_minute > nowMinute)
    .sort((a, b) => a.start_minute - b.start_minute);
  return candidates[0] ?? null;
}
