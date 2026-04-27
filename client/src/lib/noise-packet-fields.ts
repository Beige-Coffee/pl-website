/**
 * Shared packet field definitions for ByteInspector and WireInspector.
 *
 * Defines how to segment Noise protocol messages into labeled, color-coded
 * fields (version byte, ephemeral key, MAC, encrypted payload, etc.).
 */

// ── Types ──

export type MessageType = "act1" | "act2" | "act3" | "transport";
export type FieldType = "version" | "ephemeral-initiator" | "ephemeral-responder" | "encrypted" | "mac" | "plaintext";

export interface FieldDefinition {
  startByte: number;
  endByte: number; // inclusive
  type: FieldType;
  label: string;
  tooltip: string;
  chapterRef?: string; // e.g. "act-1" for linking back to course chapter
}

// ── Color scheme ──
//
// "Manuscript" palette — warm earth tones that match the site's
// cream/gold/brown aesthetic. Metaphors: bronze (keys), sage (encrypted),
// terracotta (MAC/wax seal), parchment (plaintext).

export const FIELD_COLORS: Record<FieldType, {
  dark: { bg: string; text: string };
  light: { bg: string; text: string };
  legendLabel: string;
}> = {
  version: {
    dark: { bg: "bg-[#3d3530]/60", text: "text-[#c4b5ad]" },
    light: { bg: "bg-[#e8e0d8]", text: "text-[#5c4a3a]" },
    legendLabel: "Version",
  },
  "ephemeral-initiator": {
    dark: { bg: "bg-[#5a3d20]/60", text: "text-[#d4a574]" },
    light: { bg: "bg-[#f0dfc8]", text: "text-[#6b4420]" },
    legendLabel: "Public Key",
  },
  "ephemeral-responder": {
    dark: { bg: "bg-[#4a3318]/60", text: "text-[#c9985f]" },
    light: { bg: "bg-[#ecdcc8]", text: "text-[#5a3d1a]" },
    legendLabel: "Public Key",
  },
  encrypted: {
    dark: { bg: "bg-[#2d4a30]/60", text: "text-[#a8c9b8]" },
    light: { bg: "bg-[#dce8d8]", text: "text-[#2d4a3a]" },
    legendLabel: "Encrypted",
  },
  mac: {
    dark: { bg: "bg-[#5c2a20]/60", text: "text-[#e08070]" },
    light: { bg: "bg-[#f0d8d4]", text: "text-[#7a2a20]" },
    legendLabel: "MAC Tag",
  },
  plaintext: {
    dark: { bg: "bg-[#4a4030]/60", text: "text-[#e8dcc8]" },
    light: { bg: "bg-[#f8f0e0]", text: "text-[#6b5d4f]" },
    legendLabel: "Plaintext",
  },
};

// ── Field definitions by message type ──

export function getFieldDefinitions(messageType: MessageType, dataLength: number): FieldDefinition[] {
  switch (messageType) {
    case "act1":
      return [
        { startByte: 0, endByte: 0, type: "version", label: "Version", tooltip: "Version byte (0x00)", chapterRef: "act-1" },
        { startByte: 1, endByte: 33, type: "ephemeral-initiator", label: "Ephemeral Public Key", tooltip: "Initiator's ephemeral public key (compressed secp256k1)", chapterRef: "act-1" },
        { startByte: 34, endByte: 49, type: "mac", label: "MAC Tag", tooltip: "Poly1305 authentication tag", chapterRef: "act-1" },
      ];
    case "act2":
      return [
        { startByte: 0, endByte: 0, type: "version", label: "Version", tooltip: "Version byte (0x00)", chapterRef: "act-2" },
        { startByte: 1, endByte: 33, type: "ephemeral-responder", label: "Ephemeral Public Key", tooltip: "Responder's ephemeral public key (compressed secp256k1)", chapterRef: "act-2" },
        { startByte: 34, endByte: 49, type: "mac", label: "MAC Tag", tooltip: "Poly1305 authentication tag", chapterRef: "act-2" },
      ];
    case "act3":
      return [
        { startByte: 0, endByte: 0, type: "version", label: "Version", tooltip: "Version byte (0x00)", chapterRef: "act-3" },
        { startByte: 1, endByte: 49, type: "encrypted", label: "Encrypted Static Key + Tag", tooltip: "Initiator's static public key (encrypted with ChaCha20-Poly1305)", chapterRef: "act-3" },
        { startByte: 50, endByte: 65, type: "mac", label: "MAC Tag", tooltip: "Final Poly1305 authentication tag", chapterRef: "act-3" },
      ];
    case "transport":
      return [
        { startByte: 0, endByte: Math.min(17, dataLength - 1), type: "ephemeral-initiator", label: "Encrypted Length", tooltip: "Encrypted 2-byte message length + 16-byte Poly1305 tag", chapterRef: "sending-messages" },
        ...(dataLength > 18
          ? [{ startByte: 18, endByte: dataLength - 1, type: "encrypted" as FieldType, label: "Encrypted Body", tooltip: "Encrypted message body + 16-byte Poly1305 tag", chapterRef: "sending-messages" }]
          : []),
      ];
  }
}

export function getProbeFieldDefinitions(dataLength: number): FieldDefinition[] {
  return [
    {
      startByte: 0,
      endByte: dataLength - 1,
      type: "plaintext",
      label: "Plaintext ASCII",
      tooltip: "Raw unencrypted text. Anyone monitoring the network can read this.",
    },
  ];
}

export function getFieldForByte(fields: FieldDefinition[], byteIndex: number): FieldDefinition | undefined {
  return fields.find((f) => byteIndex >= f.startByte && byteIndex <= f.endByte);
}

// ── Legend items (deduplicated by label) ──

export function getLegendItems(messageType: MessageType): { type: FieldType; label: string }[] {
  switch (messageType) {
    case "act1":
      return [
        { type: "version", label: "Version" },
        { type: "ephemeral-initiator", label: "Public Key" },
        { type: "mac", label: "MAC Tag" },
      ];
    case "act2":
      return [
        { type: "version", label: "Version" },
        { type: "ephemeral-responder", label: "Public Key" },
        { type: "mac", label: "MAC Tag" },
      ];
    case "act3":
      return [
        { type: "version", label: "Version" },
        { type: "encrypted", label: "Encrypted" },
        { type: "mac", label: "MAC Tag" },
      ];
    case "transport":
      return [
        { type: "ephemeral-initiator", label: "Encrypted Length" },
        { type: "encrypted", label: "Encrypted Body" },
      ];
  }
}

// ── Helpers ──

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function bytesToTruncatedHex(bytes: Uint8Array, maxBytes = 8): string {
  const hex = Array.from(bytes.slice(0, maxBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (bytes.length > maxBytes) {
    return `${hex}...`;
  }
  return hex;
}
