'use client';

// CometChat provider (Phase B). CometChat is an ADD-ON to the telehealth portal,
// so this provider never blocks the app: it renders {children} unconditionally
// and wires CometChat up in the background once the user is authenticated.
//
// Auth model: the browser holds NO CometChat secrets. When the telehealth
// session becomes authenticated we call `POST /api/cometchat/token`, which
// provisions/syncs the user's CometChat identity (carrying their role) and
// returns { uid, authToken, appId, region }. We init the SDK with the
// backend-supplied App ID + Region, then `loginWithAuthToken(authToken)`.
//
// `<CometChatIncomingCall />` is mounted at the app root so a doctor or patient
// is rung wherever they are in the portal — not only on the appointment screen.

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  CometChatUIKit,
  UIKitSettingsBuilder,
  CometChatIncomingCall,
  CometChatCallEvents,
  CometChatUIEvents,
} from '@cometchat/chat-uikit-react';
import { CometChatCalls } from '@cometchat/calls-sdk-javascript';
import '@cometchat/chat-uikit-react/css-variables.css';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCometChatError, logCometChatError } from './errors';

interface CometChatContextValue {
  /** SDK initialised AND the current user is logged in — safe to render chat. */
  isReady: boolean;
  /** Backend has no CometChat credentials (503) — degrade gracefully. */
  notConfigured: boolean;
  error: string | null;
}

const CometChatContext = createContext<CometChatContextValue>({
  isReady: false,
  notConfigured: false,
  error: null,
});

export const useCometChat = () => useContext(CometChatContext);

// Module-level guards: shared across mounts so React 18 StrictMode's double
// effect invocation doesn't init twice or fire two concurrent logins (which the
// SDK rejects with "Please wait until the previous login request ends").
let initialized = false;
let loginInFlight: Promise<unknown> | null = null;

async function ensureInitialized(appId: string, region: string): Promise<void> {
  if (initialized) return;
  const settings = new UIKitSettingsBuilder()
    .setAppId(appId)
    .setRegion(region)
    // No auth key in the client — production login is auth-token only.
    .subscribePresenceForAllUsers()
    .build();
  await CometChatUIKit.init(settings);
  // X1 fix: initialize the WebRTC Calls SDK. Without this the call rings but never
  // connects (no media session). Required alongside mounting the ongoing-call view.
  const callAppSetting = new CometChatCalls.CallAppSettingsBuilder()
    .setAppId(appId)
    .setRegion(region)
    .build();
  await CometChatCalls.init(callAppSetting);
  initialized = true;
}

async function ensureLoggedIn(uid: string, authToken: string): Promise<void> {
  const existing = await CometChatUIKit.getLoggedinUser();
  if (existing) {
    if (existing.getUid?.() === uid) return; // same user — nothing to do
    await CometChatUIKit.logout(); // different user — switch accounts
  }
  if (loginInFlight) {
    await loginInFlight; // a concurrent mount already started login — reuse it
    return;
  }
  loginInFlight = CometChatUIKit.loginWithAuthToken(authToken);
  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

export function CometChatProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ongoingCall, setOngoingCall] = useState<React.ReactNode>(null);

  // X1 fix: when a call is accepted the UI Kit emits the ready-made ongoing-call
  // view via `ccShowOngoingCall`. The original integration mounted only
  // <CometChatIncomingCall/> and never rendered this — so calls rang but never
  // connected (no session host). Render the emitted child; clear on end/reject.
  useEffect(() => {
    const show = CometChatUIEvents.ccShowOngoingCall.subscribe(
      (payload: { child?: React.ReactNode }) => setOngoingCall(payload?.child ?? null),
    );
    const ended = CometChatCallEvents.ccCallEnded.subscribe(() => setOngoingCall(null));
    const rejected = CometChatCallEvents.ccCallRejected.subscribe(() => setOngoingCall(null));
    return () => {
      show.unsubscribe();
      ended.unsubscribe();
      rejected.unsubscribe();
    };
  }, []);

  // Log the telehealth user in/out of CometChat in lockstep with the session.
  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      // Signed out (or still loading): drop any CometChat session so the next
      // user doesn't inherit this one.
      if (isReady) {
        void CometChatUIKit.logout().catch(() => undefined);
        setIsReady(false);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const session = await api.cometchatToken();
        await ensureInitialized(session.appId, session.region);
        await ensureLoggedIn(session.uid, session.authToken);
        if (!cancelled) {
          setNotConfigured(false);
          setError(null);
          setIsReady(true);
        }
      } catch (e) {
        if (cancelled) return;
        // 503 = backend has no CometChat credentials. Not an error the user can
        // fix; the portal keeps working, chat just stays unavailable.
        if (e instanceof ApiError && e.status === 503) {
          setNotConfigured(true);
          return;
        }
        logCometChatError(e);
        setError(formatCometChatError(e));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run when the signed-in identity changes.
  }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CometChatContext.Provider value={{ isReady, notConfigured, error }}>
      {children}
      {isReady ? <CometChatIncomingCall /> : null}
      {ongoingCall}
    </CometChatContext.Provider>
  );
}
