import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const DEV_SECRET = 'dev-only-change-me';

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Never ship a hardcoded secret. If a real JWT_SECRET is provided we use it.
// Otherwise, in production we mint an ephemeral random secret (valid for this
// process only) and warn loudly; in dev we fall back to the well-known value.
function resolveJwtSecret(): string {
  const provided = process.env.JWT_SECRET;
  if (provided && provided !== DEV_SECRET) return provided;

  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      '[config] WARNING: JWT_SECRET not set in production — generating an ' +
        'ephemeral secret. Sessions will not survive a restart. Set JWT_SECRET.',
    );
    return crypto.randomBytes(48).toString('hex');
  }
  return DEV_SECRET;
}

// CometChat (Phase B). All values come from env — never hardcode. The REST API
// key is server-only (full user CRUD + token minting) and MUST NOT be shipped to
// any client bundle. Clients only ever receive appId + region + a minted token.
const cometchatAppId = process.env.COMETCHAT_APP_ID ?? '';
const cometchatRegion = process.env.COMETCHAT_REGION ?? '';
const cometchatConfigured = Boolean(
  cometchatAppId && cometchatRegion && process.env.COMETCHAT_REST_API_KEY,
);

export const config = {
  port: num(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  },
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),
  seedPassword: process.env.SEED_PASSWORD ?? 'Passw0rd!',
  cometchat: {
    appId: cometchatAppId,
    region: cometchatRegion,
    // authKey is a dev/client convenience credential; the backend never needs it
    // for the token flow, but we surface it so ops can confirm it is env-sourced.
    authKey: process.env.COMETCHAT_AUTH_KEY ?? '',
    restApiKey: process.env.COMETCHAT_REST_API_KEY ?? '',
    // v3 REST base, e.g. https://<appId>.api-us.cometchat.io/v3
    baseUrl:
      cometchatAppId && cometchatRegion
        ? `https://${cometchatAppId}.api-${cometchatRegion}.cometchat.io/v3`
        : '',
    // True only when the server has everything it needs to mint tokens.
    configured: cometchatConfigured,
  },
} as const;
