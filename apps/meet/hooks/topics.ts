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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encode(obj: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(obj));
}

function decode<T>(bytes: Uint8Array): T {
  return JSON.parse(decoder.decode(bytes)) as T;
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
          const data = decode<{ emoji: string; sender: string; ts: number }>(bytes);
          const id = `${data.sender}-${data.ts}`;
          setReactions((prev) => [...prev.slice(-19), { id, ...data }]);
          setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
        } catch { /* ignore bad frames */ }
      }
    })();

    return () => {
      active = false;
      sub.close();
      pubRef.current = null;
    };
  }, [participant]);

  const sendReaction = useCallback((emoji: string) => {
    if (!pubRef.current || !myId) return;
    const ts = Date.now();
    pubRef.current.send(encode({ emoji, sender: myId, ts }));
    // SFU does not echo latest pub back to own sub — add locally.
    const id = `${myId}-${ts}`;
    setReactions((prev) => [...prev.slice(-19), { id, emoji, sender: myId, ts }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
  }, [myId]);

  return { reactions, sendReaction };
}
