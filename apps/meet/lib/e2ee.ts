// Derive a shared AES-GCM key from a room passphrase. Every participant in the
// same room that types the same passphrase derives the same key and can decrypt
// each other's media; the SFU never sees it. Binding the salt to the room id
// keeps keys from colliding across rooms.
export async function deriveRoomKey(roomId: string, passphrase: string): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(`pulsebeam-e2ee:${roomId}`),
      iterations: 100_000,
      hash: "SHA-256",
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}
