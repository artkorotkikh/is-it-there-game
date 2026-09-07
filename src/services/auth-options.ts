// II currently issues origin-bound, unscoped delegations. Requesting `targets`
// makes the SDK correctly reject that response as broader than requested.
export const signInOptions = { maxTimeToLive: 8n * 3_600_000_000_000n };

/** Map known failure classes without displaying provider payloads or key material. */
export function signInError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/allow.*popup|could not be opened|popup.*block/i.test(message))
    return 'Allow popups for this game, then try Sign in again.';
  if (/cancel|closed|reject|denied/i.test(message))
    return 'Sign-in cancelled. Try again when you are ready, or play as a guest.';
  if (/delegation|public key|expiration/i.test(message))
    return 'Internet Identity returned a session the game could not accept. Reload the game and try again. (II-SESSION)';
  if (/storage|indexeddb|database|quota/i.test(message))
    return 'The browser could not store your sign-in. Allow site storage, then try again. (II-STORAGE)';
  if (/channel|network|fetch|time|click handler/i.test(message))
    return 'Could not connect to Internet Identity. Check your connection and try Sign in again. (II-CONNECTION)';
  return 'Internet Identity sign-in failed. Reload the game and try again. (II-UNKNOWN)';
}
