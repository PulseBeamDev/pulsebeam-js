import { useEffect, useRef, useState, useCallback } from "react";
import type { Participant, OrderedTopicPublisher, DataPublisher } from "@pulsebeam/react";

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  ts: number;
  self: boolean;
}

export interface Reaction {
  id: string;
  emoji: string;
  sender: string;
  ts: number;
}

interface ReactionPayload {
  id?: string;
  emoji: string;
  sender: string;
  ts: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(obj: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(obj));
}

function decode<T>(bytes: Uint8Array): T {
  return JSON.parse(decoder.decode(bytes)) as T;
}

function reactionId(data: ReactionPayload): string {
  // Keep accepting payloads from older clients that did not include an id.
  return data.id ?? `${data.sender}-${data.ts}`;
}

export function useChat(participant: Participant | null, myId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const pubRef = useRef<OrderedTopicPublisher | null>(null);

  useEffect(() => {
    if (!participant) return;

    const pub = participant.topic("chat").publisher().ordered();
    pubRef.current = pub;

    const sub = participant.topic("chat").subscriber().ordered();

    let active = true;
    (async () => {
      for await (const delivery of sub) {
        if (!active) break;
        if (delivery.type !== "message") continue;
        try {
          const data = decode<{ sender: string; text: string; ts: number }>(delivery.payload);
          setMessages((prev) => [
            ...prev,
            {
              id: `${delivery.publisherId}-${delivery.seq}`,
              sender: data.sender,
              text: data.text,
              ts: data.ts,
              self: false,
            },
          ]);
        } catch { /* ignore bad frames */ }
      }
    })();

    return () => {
      active = false;
      sub.close();
      pubRef.current = null;
    };
  }, [participant]);

  const sendMessage = useCallback((text: string) => {
    if (!pubRef.current || !text.trim() || !myId) return;
    const ts = Date.now();
    pubRef.current.send(encode({ sender: myId, text: text.trim(), ts }));
    // SFU does not echo your own pub back to your sub — add locally.
    setMessages((prev) => [
      ...prev,
      { id: `self-${ts}`, sender: myId, text: text.trim(), ts, self: true },
    ]);
  }, [myId]);

  return { messages, sendMessage };
}

export function useReactions(participant: Participant | null, myId: string | null) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const pubRef = useRef<DataPublisher | null>(null);
  const reactionCounterRef = useRef(0);
  const reactionTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const showReaction = useCallback((data: ReactionPayload) => {
    const id = reactionId(data);
    setReactions((prev) => {
      // The SFU forwards an unscoped subscription back to its publisher. The
      // local optimistic render and that echoed frame represent one event.
      if (prev.some((reaction) => reaction.id === id)) return prev;
      return [...prev.slice(-19), { id, emoji: data.emoji, sender: data.sender, ts: data.ts }];
    });

    if (reactionTimersRef.current.has(id)) return;
    const timer = setTimeout(() => {
      reactionTimersRef.current.delete(id);
      setReactions((prev) => prev.filter((reaction) => reaction.id !== id));
    }, 3000);
    reactionTimersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    if (!participant) return;

    const pub = participant.topic("reactions").publisher().latest();
    pubRef.current = pub;

    const sub = participant.topic("reactions").subscriber().latest();

    let active = true;
    (async () => {
      for await (const bytes of sub) {
        if (!active) break;
        try {
          showReaction(decode<ReactionPayload>(bytes));
        } catch { /* ignore bad frames */ }
      }
    })();

    return () => {
      active = false;
      sub.close();
      pubRef.current = null;
      for (const timer of reactionTimersRef.current.values()) clearTimeout(timer);
      reactionTimersRef.current.clear();
      setReactions([]);
    };
  }, [participant, showReaction]);

  const sendReaction = useCallback((emoji: string) => {
    if (!pubRef.current || !myId) return;
    const ts = Date.now();
    const reaction = {
      id: `${myId}-${ts}-${reactionCounterRef.current++}`,
      emoji,
      sender: myId,
      ts,
    };
    pubRef.current.send(encode(reaction));
    showReaction(reaction);
  }, [myId, showReaction]);

  return { reactions, sendReaction };
}
