/** Decode PostgREST / Supabase bytea (hex or base64) to Buffer. */
export function decodeBytea(data: unknown): Buffer {
  if (data == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data !== "string") return Buffer.alloc(0);

  const s = data.trim();
  if (s.startsWith("\\x")) return Buffer.from(s.slice(2), "hex");
  if (/^[0-9a-f]+$/i.test(s) && s.length % 2 === 0) {
    return Buffer.from(s, "hex");
  }
  return Buffer.from(s, "base64");
}
