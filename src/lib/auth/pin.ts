/**
 * PIN rules for KELO's email + 6-digit PIN auth.
 * Pure functions — no I/O — so they are fully unit-testable and safe to run
 * on the client (for instant feedback) and the server (for enforcement).
 */
export const PIN_LENGTH = 6;

export type PinValidation =
  | { valid: true }
  | { valid: false; reason: string };

/** A small blocklist of notoriously common 6-digit PINs. */
const COMMON_PINS = new Set<string>([
  "123456",
  "654321",
  "111111",
  "000000",
  "121212",
  "112233",
  "123123",
  "789456",
  "159753",
  "147258",
  "102030",
  "abcabc",
  "696969",
  "666666",
  "999999",
  "888888",
  "777777",
  "555555",
  "444444",
  "333333",
  "222222",
  "101010",
  "202020",
  "123321",
  "142536",
]);

function isAllSameDigit(pin: string): boolean {
  return /^(\d)\1{5}$/.test(pin);
}

/** Strictly ascending or descending runs, e.g. 123456 / 987654. */
function isSequential(pin: string): boolean {
  let asc = true;
  let desc = true;
  for (let i = 1; i < pin.length; i++) {
    const prev = pin.charCodeAt(i - 1);
    const cur = pin.charCodeAt(i);
    if (cur - prev !== 1) asc = false;
    if (prev - cur !== 1) desc = false;
  }
  return asc || desc;
}

/** Short repeating patterns like ABABAB (2-cycle) or ABCABC (3-cycle). */
function isRepeatingPattern(pin: string): boolean {
  const two = pin.slice(0, 2);
  const three = pin.slice(0, 3);
  return two + two + two === pin || three + three === pin;
}

export function validatePin(pin: string): PinValidation {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return { valid: false, reason: "PIN must be exactly 6 digits." };
  }
  if (isAllSameDigit(pin)) {
    return { valid: false, reason: "PIN can’t be the same digit repeated." };
  }
  if (isSequential(pin)) {
    return { valid: false, reason: "PIN can’t be a sequence like 123456." };
  }
  if (isRepeatingPattern(pin)) {
    return { valid: false, reason: "PIN can’t be a repeating pattern." };
  }
  if (COMMON_PINS.has(pin)) {
    return { valid: false, reason: "This PIN is too common — pick another." };
  }
  return { valid: true };
}

/** Confirm the two entries match (used at signup / PIN change). */
export function pinsMatch(pin: string, confirm: string): boolean {
  return pin.length === PIN_LENGTH && pin === confirm;
}

export function isSixDigits(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
