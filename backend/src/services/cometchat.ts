// -----------------------------------------------------------------------------
// CometChat server-side integration (Phase B).
//
// This is the ONLY place the CometChat REST API Key is used. The key never
// leaves the server: clients receive an App ID, Region, and a short-lived,
// per-user auth token minted here — never the REST key or the Auth Key.
//
// Two responsibilities:
//   1. Provision/sync a CometChat user for each app user, carrying the app role
//      (patient|doctor|staff|admin) for RBAC-aware conversation scoping.
//   2. Mint a per-user auth token so the client can `loginWithAuthToken(token)`.
//
// REST reference (verified against docs.cometchat.com, v3):
//   Base:        https://{appId}.api-{region}.cometchat.io/v3
//   Header:      apikey: <REST API Key (fullAccess scope)>
//   Create user: POST /v3/users            { uid, name, role, metadata, tags }
//   Update user: PUT  /v3/users/{uid}      { name, role, metadata }
//   Mint token:  POST /v3/users/{uid}/auth_tokens  -> { data: { authToken } }
// -----------------------------------------------------------------------------

import { config } from '../config';
import { PublicUser, Role } from '../domain/types';
import { HttpError } from '../middleware/httpError';

// Extends HttpError so the app's central errorHandler honors the status/code
// without any special-casing.
export class CometChatError extends HttpError {
  constructor(status: number, message: string, code = 'cometchat_error') {
    super(status, message, code);
    this.name = 'CometChatError';
  }
}

// Raised by routes when the integration isn't configured (env vars empty).
export class CometChatNotConfiguredError extends CometChatError {
  constructor() {
    super(
      503,
      'CometChat is not configured. Set COMETCHAT_APP_ID, COMETCHAT_REGION and ' +
        'COMETCHAT_REST_API_KEY in the backend environment.',
      'cometchat_not_configured',
    );
    this.name = 'CometChatNotConfiguredError';
  }
}

export function isConfigured(): boolean {
  return config.cometchat.configured;
}

function assertConfigured(): void {
  if (!config.cometchat.configured) throw new CometChatNotConfiguredError();
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // NOTE: the official REST docs use the lowercase header name `apikey`.
    apikey: config.cometchat.restApiKey,
  };
}

// Exponential backoff with full jitter. Retries 429 + transient 5xx only; never
// retries 4xx (except 429) since those fail identically on replay. Honors
// Retry-After when present.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  const baseDelayMs = 400;
  const maxDelayMs = 4000;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, init);
      const retryable =
        res.status === 429 || (res.status >= 500 && res.status !== 501);
      if (retryable && attempt < maxAttempts) {
        const retryAfter = res.headers.get('retry-after');
        const backoff = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000, maxDelayMs)
          : Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
        const jitter = Math.random() * backoff * 0.3;
        await new Promise((r) => setTimeout(r, backoff + jitter));
        continue;
      }
      return res;
    } catch (err) {
      // Network-level failure (ECONNRESET/timeout) — retry with backoff.
      lastErr = err;
      if (attempt === maxAttempts) break;
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new CometChatError(
    502,
    `CometChat request failed: ${String(lastErr ?? 'network error')}`,
  );
}

// The CometChat UID is the app's stable server-side user id (already URL/UID
// safe: `user_...`). Keeping them identical means no extra mapping table.
export function cometChatUid(user: { id: string }): string {
  return user.id;
}

interface UserPayload {
  uid: string;
  name: string;
  metadata: { appRole: Role };
  tags: Role[];
}

// The app role is carried in `metadata.appRole` + `tags`, NOT the top-level
// CometChat `role` field: that field only accepts roles pre-defined in the
// dashboard (Roles & Permissions) and returns "The selected role is invalid"
// for arbitrary strings. metadata + tags are free-form and queryable, and the
// authoritative RBAC gate lives server-side in the appointment chat route.
function toUserPayload(user: PublicUser): UserPayload {
  return {
    uid: cometChatUid(user),
    name: user.name,
    metadata: { appRole: user.role },
    tags: [user.role],
  };
}

// Idempotently ensure the CometChat user exists and reflects the current app
// role/name. Create first; on 409 (already exists) fall back to update so a
// changed name/role stays in sync.
export async function syncUser(user: PublicUser): Promise<void> {
  assertConfigured();
  const payload = toUserPayload(user);

  const createRes = await fetchWithRetry(`${config.cometchat.baseUrl}/users`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (createRes.ok) return;

  // "Already exists" is NOT a 409 in CometChat — it is HTTP 400 with error code
  // ERR_UID_ALREADY_EXISTS. Detect by code (with a 409 fallback for safety) and
  // fall through to an update so name/role stay in sync on every login.
  const alreadyExists =
    createRes.status === 409 ||
    (await isAlreadyExistsError(createRes.clone()));

  if (alreadyExists) {
    const updateRes = await fetchWithRetry(
      `${config.cometchat.baseUrl}/users/${encodeURIComponent(payload.uid)}`,
      {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          name: payload.name,
          metadata: payload.metadata,
          tags: payload.tags,
        }),
      },
    );
    if (updateRes.ok) return;
    throw new CometChatError(
      updateRes.status,
      `Failed to update CometChat user (${updateRes.status})`,
    );
  }

  throw new CometChatError(
    createRes.status,
    `Failed to create CometChat user (${createRes.status})`,
  );
}

// CometChat signals a duplicate uid as HTTP 400 + code ERR_UID_ALREADY_EXISTS.
async function isAlreadyExistsError(res: Response): Promise<boolean> {
  try {
    const body = (await res.json()) as { error?: { code?: string } };
    return body?.error?.code === 'ERR_UID_ALREADY_EXISTS';
  } catch {
    return false;
  }
}

// Mint a per-user auth token. Assumes the user is already provisioned.
export async function mintAuthToken(uid: string): Promise<string> {
  assertConfigured();
  const res = await fetchWithRetry(
    `${config.cometchat.baseUrl}/users/${encodeURIComponent(uid)}/auth_tokens`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ force: true }),
    },
  );

  if (!res.ok) {
    throw new CometChatError(
      res.status,
      `Failed to mint CometChat auth token (${res.status})`,
    );
  }

  const data = (await res.json()) as { data?: { authToken?: string } };
  const token = data?.data?.authToken;
  if (!token) {
    throw new CometChatError(502, 'CometChat returned no auth token');
  }
  return token;
}

// Convenience: provision (create/sync) then mint a token in one call. This is
// the login path — a user's CometChat identity is guaranteed to exist and carry
// the current role before the token is issued.
export async function provisionAndMintToken(
  user: PublicUser,
): Promise<{ uid: string; authToken: string }> {
  await syncUser(user);
  const uid = cometChatUid(user);
  const authToken = await mintAuthToken(uid);
  return { uid, authToken };
}

// Best-effort provisioning used by non-critical hooks (e.g. admin user create).
// Never throws — logs and swallows so the primary operation isn't coupled to
// CometChat availability. The lazy path in the token endpoint still guarantees
// the user exists before first login.
export async function syncUserBestEffort(user: PublicUser): Promise<void> {
  if (!config.cometchat.configured) return;
  try {
    await syncUser(user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[cometchat] best-effort sync failed for user ${user.id}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
