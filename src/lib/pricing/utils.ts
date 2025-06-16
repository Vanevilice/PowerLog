
// src/lib/pricing/utils.ts

/**
 * Appends a new message to an existing commentary string.
 * If the existing commentary is empty, it returns the new message.
 * If the new message is empty or null, it returns the existing commentary.
 * Ensures a single space between existing and new messages.
 * @param existingComment The current commentary string.
 * @param newMessage The new message to append.
 * @returns The combined commentary string.
 */
export function appendCommentary(existingComment: string, newMessage: string | null | undefined): string {
  const trimmedNewMessage = typeof newMessage === 'string' ? newMessage.trim() : '';
  if (!trimmedNewMessage) return existingComment;
  return existingComment ? `${existingComment} ${trimmedNewMessage}` : trimmedNewMessage;
}

/**
 * Normalizes a city or port name for consistent matching.
 * - Converts to lowercase.
 * - Trims whitespace from ends.
 * - Removes "г. " (with space) from the beginning.
 * - Removes " г." (with space) or " г" or "г." from the end.
 * - Removes common parenthetical suffixes like (ВСК), (ВМПП), (ПЛ), (ТА), etc.
 * @param name The city or port name string to normalize.
 * @returns The normalized name string, or an empty string if input is null/undefined.
 */
export function normalizeCityName(name: string | null | undefined): string {
  if (!name) return "";
  let normalized = String(name).toLowerCase().trim();

  // Remove "г. " (cyrillic g, dot, space) from the beginning
  if (normalized.startsWith("г. ")) {
    normalized = normalized.substring(3).trim();
  }

  // Remove " г." or " г" or "г." from the end
  if (normalized.endsWith(" г.")) {
    normalized = normalized.substring(0, normalized.length - 3).trim();
  } else if (normalized.endsWith(" г")) {
    normalized = normalized.substring(0, normalized.length - 2).trim();
  } else if (normalized.endsWith("г.")) {
    normalized = normalized.substring(0, normalized.length - 2).trim();
  }
  
  if (normalized.startsWith("г.")) {
     normalized = normalized.substring(2).trim();
  }

  // Remove common parenthetical suffixes (e.g., (ВСК), (ВМПП), (ПЛ), (ТА))
  // This regex matches a space followed by parentheses containing any characters.
  normalized = normalized.replace(/\s*\([^)]*\)\s*$/, "").trim();
  // If the suffix was directly attached without a space, e.g. "Город(Суффикс)"
  normalized = normalized.replace(/\([^)]*\)$/, "").trim();


  return normalized;
}

