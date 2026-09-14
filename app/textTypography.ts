import type { MessageLanguage } from "../firebase/messages";

const NO_BREAK_SPACE = "\u00a0";
const NARROW_NO_BREAK_SPACE = "\u202f";

/** Display-only typography: keep punctuation with its word without changing
 * stored copy, explicit line breaks, URLs, or punctuation without spaces.
 * Unicode UAX #14 gives NBSP and NNBSP their non-breaking behavior.
 */
export function formatDisplayText(text: string, language: MessageLanguage): string {
  return text
    // Existing spaces inside quotation marks/brackets must not strand them.
    .replace(/([«“‘(\[])[ \t\u00a0\u202f]+/gu, `$1${NO_BREAK_SPACE}`)
    .replace(/[ \t\u00a0\u202f]+(?=[»”’\)\]])/gu, NO_BREAK_SPACE)
    // French uses a thin non-breaking space before ! ? ;, a full one before :.
    // Other languages keep the supplied spacing but make it non-breaking.
    .replace(/[ \t\u00a0\u202f]+(?=[!?;:])/gu, (space, offset: number, source: string) =>
      language === "fr" && source[offset + space.length] !== ":"
        ? NARROW_NO_BREAK_SPACE
        : NO_BREAK_SPACE,
    )
    .replace(/[ \t\u00a0\u202f]+(?=[,\.\u2026])/gu, NO_BREAK_SPACE);
}
