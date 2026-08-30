/**
 * Conservative transcript hygiene: strip provider artifacts and normalize
 * whitespace WITHOUT touching actual words. This is deliberately narrow —
 * "clean obvious noise" must never mean "rewrite or invent content," so
 * nothing here alters spoken words, fillers, or punctuation.
 */
function stripControlChars(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isPrintable = code >= 32 || ch === "\n" || ch === "\t";
    if (isPrintable) out += ch;
  }
  return out;
}

export function cleanTranscript(raw: string): string {
  return stripControlChars(raw.replace(/\r\n?/g, "\n"))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
