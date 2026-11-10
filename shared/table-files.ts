export type CheckedFile = {
  mime: string;
  extension: string;
  media: "image" | "audio";
};
export function inspectTableFile(bytes: Uint8Array): CheckedFile | null {
  const text = (start: number, length: number) =>
    new TextDecoder().decode(bytes.subarray(start, start + length));
  if (bytes.length < 12) return null;
  if (
    bytes[0] === 0x89 &&
    text(1, 3) === "PNG" &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return { mime: "image/png", extension: "png", media: "image" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", extension: "jpg", media: "image" };
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP")
    return { mime: "image/webp", extension: "webp", media: "image" };
  if (text(0, 4) === "RIFF" && text(8, 4) === "WAVE")
    return { mime: "audio/wav", extension: "wav", media: "audio" };
  if (text(0, 4) === "OggS")
    return { mime: "audio/ogg", extension: "ogg", media: "audio" };
  if (text(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
    return { mime: "audio/mpeg", extension: "mp3", media: "audio" };
  if (text(4, 4) === "ftyp")
    return { mime: "audio/mp4", extension: "m4a", media: "audio" };
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return { mime: "audio/webm", extension: "webm", media: "audio" };
  return null;
}
export const imageLimit = 10 * 1024 * 1024;
export const audioLimit = 25 * 1024 * 1024;
