'use client';

// SSR guard for the CometChat provider. The UI Kit touches `window`/`document`
// at module-eval time, so it must never run during Next's server render or the
// `next build` static-prerender pass (`ReferenceError: window is not defined`).
// Loading the provider through `next/dynamic` with `ssr: false` from a Client
// Component keeps the kit — and the WebRTC calls SDK — entirely browser-side.

import dynamic from 'next/dynamic';

const CometChatProvider = dynamic(
  () => import('./CometChatProvider').then((m) => m.CometChatProvider),
  { ssr: false },
);

export function CometChatGate({ children }: { children: React.ReactNode }) {
  return <CometChatProvider>{children}</CometChatProvider>;
}
