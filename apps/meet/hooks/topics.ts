import { useEffect, useRef, useState } from "react";
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

const MY_ID = Math.random().toString(36).slice(2, 8);

export function useChat(participant: Participant | null) {
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
            { id: `${delivery.publisherId}-${delivery.seq}`, ...data, self: data.sender === MY_ID },
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

  const sendMessage = (text: string) => {
    if (!pubRef.current || !text.trim()) return;
    pubRef.current.send(encode({ sender: MY_ID, text: text.trim(), ts: Date.now() }));
  };

  return { messages, sendMessage };
}

export function useReactions(participant: Participant | null) {
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

  const sendReaction = (emoji: string) => {
    if (!pubRef.current) return;
    pubRef.current.send(encode({ emoji, sender: MY_ID, ts: Date.now() }));
  };

  return { reactions, sendReaction };
}
