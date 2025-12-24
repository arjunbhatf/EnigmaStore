function xorBytes(data: Uint8Array, keyBytes: Uint8Array) {
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    output[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return output;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string) {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function generateNineDigitKey() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return 100_000_000 + (buffer[0] % 900_000_000);
}

export function encryptHash(hash: string, key: number) {
  const data = new TextEncoder().encode(hash);
  const keyBytes = new TextEncoder().encode(String(key));
  const encrypted = xorBytes(data, keyBytes);
  return `0x${bytesToHex(encrypted)}`;
}

export function decryptHash(encryptedHash: string, key: number) {
  const data = hexToBytes(encryptedHash);
  const keyBytes = new TextEncoder().encode(String(key));
  const decrypted = xorBytes(data, keyBytes);
  return new TextDecoder().decode(decrypted);
}
