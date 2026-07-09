'use client';

// The live 1:1 consult surface for one appointment — chat + voice/video call
// between exactly this appointment's patient and doctor. Loaded browser-only
// (via next/dynamic ssr:false) from the appointment detail page.
//
// The backend is the RBAC source of truth: `GET /api/cometchat/appointments/:id/chat`
// returns the single peer the caller may converse/call with (and 403s for staff).
// We point a 1:1 CometChat conversation at exactly that peer's UID.

import { useEffect, useState } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
} from '@cometchat/chat-uikit-react';
import { api, ApiError } from '@/lib/api';
import { useCometChat } from '@/lib/cometchat/CometChatProvider';
import { logCometChatError } from '@/lib/cometchat/errors';
import { ErrorNotice, Spinner } from '@/components/ui';
import type { AppointmentChatContext } from '@/lib/types';

export default function AppointmentConsult({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const { isReady, notConfigured, error: providerError } = useCometChat();
  const [ctx, setCtx] = useState<AppointmentChatContext | null>(null);
  const [peer, setPeer] = useState<CometChat.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Resolve who (if anyone) the caller may chat/call with for this
  //    appointment. The backend re-checks RBAC on every message/call too.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .cometchatAppointmentChat(appointmentId)
      .then((res) => {
        if (!cancelled) setCtx(res);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError ? e.message : 'Failed to load the consult.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  // 2. Once CometChat is logged in and we know the peer UID, resolve the peer
  //    user object the message components render against.
  const peerUid = ctx?.peer?.uid;
  const peerName = ctx?.peer?.name;
  useEffect(() => {
    if (!isReady || !peerUid) return;
    let cancelled = false;
    CometChat.getUser(peerUid)
      .then((u) => {
        if (!cancelled) setPeer(u);
      })
      .catch((e) => {
        // The peer has no CometChat identity yet (they've never signed in, so
        // the backend hasn't provisioned them). Fall back to a lightweight user
        // so the surface still renders; the conversation opens once they log in.
        logCometChatError(e);
        if (cancelled) return;
        const u = new CometChat.User(peerUid);
        if (peerName) u.setName(peerName);
        setPeer(u);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, peerUid, peerName]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNotice message={error} />;

  if (notConfigured) {
    return (
      <div className="seam-note">
        Secure chat &amp; calling are not configured on this deployment. Set the
        CometChat credentials in the backend environment to enable them.
      </div>
    );
  }

  if (providerError) {
    return (
      <ErrorNotice
        message={`Could not connect to secure chat. ${providerError}`}
      />
    );
  }

  // Defensive: only participants (canChat) ever reach this component.
  if (ctx && !ctx.canChat) {
    return (
      <div className="seam-note">
        You are not a participant in this appointment&apos;s consult.
      </div>
    );
  }

  if (!isReady || !peer) {
    return (
      <div className="stack" style={{ gap: 10, alignItems: 'center' }}>
        <Spinner />
        <span className="faint">Connecting to secure chat…</span>
      </div>
    );
  }

  const canCall = ctx?.canCall ?? false;

  return (
    <div className="cc-consult">
      {/* Header renders the peer + auto-mounts the voice/video call buttons
          (hidden when the caller may not call). */}
      <CometChatMessageHeader
        user={peer}
        hideVoiceCallButton={!canCall}
        hideVideoCallButton={!canCall}
      />
      <div className="cc-list">
        {/* No thread panel is wired, so hide the "Reply in Thread" action. */}
        <CometChatMessageList user={peer} hideReplyInThreadOption={true} />
      </div>
      <CometChatMessageComposer user={peer} />
    </div>
  );
}
