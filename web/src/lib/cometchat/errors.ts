// Pretty-print CometChat SDK errors. A raw `CometChatException` stringifies to
// "[object Object]", so never `String(e)` one — use these helpers instead.
// (Pattern from the cometchat-core skill, §6.)

export function formatCometChatError(e: unknown): string {
  if (e == null) return 'Unknown CometChat error.';
  const err = e as Record<string, unknown>;
  const code =
    (err.code as string | undefined) ?? (err.errorCode as string | undefined);
  const message =
    (err.message as string | undefined) ??
    (err.errorDescription as string | undefined);
  if (code && message) return `[CometChat ${code}] ${message}`;
  if (message) return `[CometChat] ${message}`;
  try {
    return `[CometChat] ${JSON.stringify(e)}`;
  } catch {
    return `[CometChat] ${String(e)}`;
  }
}

// A few known error codes get an actionable hint in the console.
const KNOWN_DOC_HINTS: Record<string, string> = {
  ERR_UID_NOT_FOUND:
    'The peer has no CometChat identity yet — they need to sign in once so the ' +
    'backend provisions their CometChat user before a conversation can open.',
  ERR_AUTH_TOKEN_NOT_FOUND:
    'The backend-issued auth token is empty or expired. Re-mint it via ' +
    'POST /api/cometchat/token.',
};

export function logCometChatError(e: unknown): void {
  const formatted = formatCometChatError(e);
  // eslint-disable-next-line no-console
  console.error(formatted, e);
  const code =
    (e as { code?: string; errorCode?: string })?.code ??
    (e as { code?: string; errorCode?: string })?.errorCode;
  if (code && KNOWN_DOC_HINTS[code]) {
    // eslint-disable-next-line no-console
    console.warn(`[CometChat hint] ${KNOWN_DOC_HINTS[code]}`);
  }
}
