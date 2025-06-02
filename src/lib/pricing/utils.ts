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
