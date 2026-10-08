"use client";
// Lets pages expose what's on screen to the voice assistant, and handle the actions it sends back.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { VoiceAction, VoiceContext } from "@/lib/voice/types";

type ActionType = VoiceAction["type"];
/** A handler may return a sentence to say instead of the assistant's reply (e.g. "Choose insurance first"). */
export type VoiceHandler<T extends ActionType = ActionType> = (a: Extract<VoiceAction, { type: T }>) => string | void;
type Handlers = { [K in ActionType]?: VoiceHandler<K> };

type Bridge = {
  contexts: Map<symbol, Partial<VoiceContext>>;
  handlers: Map<symbol, Handlers>;
};

const BridgeCtx = createContext<Bridge | null>(null);

export function VoiceBridgeProvider({ children }: { children: ReactNode }) {
  const [bridge] = useState<Bridge>(() => ({ contexts: new Map(), handlers: new Map() }));
  return <BridgeCtx.Provider value={bridge}>{children}</BridgeCtx.Provider>;
}

function useBridge() {
  const b = useContext(BridgeCtx);
  if (!b) throw new Error("VoiceBridgeProvider missing");
  return b;
}

/** Publish part of the page context while the component is mounted. */
export function useVoiceContext(partial: Partial<VoiceContext> | null) {
  const b = useBridge();
  const id = useRef(Symbol("ctx"));
  useEffect(() => {
    const key = id.current;
    if (partial) b.contexts.set(key, partial);
    else b.contexts.delete(key);
    return () => void b.contexts.delete(key);
  }, [b, partial]);
}

/** Register action handlers while the component is mounted. Latest handlers always win (no stale closures). */
export function useVoiceHandlers(handlers: Handlers) {
  const b = useBridge();
  const id = useRef(Symbol("handlers"));
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    const key = id.current;
    const proxy: Handlers = {};
    for (const type of Object.keys(handlers) as ActionType[]) {
      (proxy as Record<string, unknown>)[type] = (a: VoiceAction) =>
        (latest.current[type] as ((x: VoiceAction) => string | void) | undefined)?.(a);
    }
    b.handlers.set(key, proxy);
    return () => void b.handlers.delete(key);
    // handler *types* are fixed per component; contents come from `latest`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b]);
}

/** Used by the assistant itself. */
export function useVoiceBridge() {
  const b = useBridge();
  return {
    context(): Partial<VoiceContext> {
      return Object.assign({}, ...b.contexts.values());
    },
    /** Run an action on whichever mounted component handles it. Returns [handled, override message]. */
    dispatch(a: VoiceAction): [boolean, string | void] {
      for (const h of [...b.handlers.values()].reverse()) {
        const fn = h[a.type] as ((x: VoiceAction) => string | void) | undefined;
        if (fn) return [true, fn(a)];
      }
      return [false, undefined];
    },
  };
}
