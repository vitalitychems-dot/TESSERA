import crypto from "crypto";

const GCM_ALGORITHM = "aes-256-gcm";
const CBC_ALGORITHM = "aes-256-cbc";
const GCM_IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("[key-encryption] KEY_ENCRYPTION_SECRET or SESSION_SECRET must be set. Refusing to encrypt with a default key.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptKeyValue(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

export function decryptKeyValue(ciphertext: string): string {
  if (!ciphertext.includes(":")) return ciphertext;
  const parts = ciphertext.split(":");
  const key = getEncryptionKey();

  if (parts.length === 3) {
    const [ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) return ciphertext;
    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      return ciphertext;
    }
  }

  const [ivHex, encrypted] = parts;
  if (!ivHex || !encrypted || ivHex.length !== 32) return ciphertext;
  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return ciphertext;
  }
}

export function isEncrypted(value: string): boolean {
  if (!value.includes(":")) return false;
  const parts = value.split(":");
  if (parts.length === 3) {
    return parts[0].length === 24 && /^[0-9a-f]+$/.test(parts[0]);
  }
  return parts[0].length === 32 && /^[0-9a-f]+$/.test(parts[0]);
}
