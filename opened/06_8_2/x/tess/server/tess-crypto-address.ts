import crypto from "crypto";

export interface Ed25519KeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
  publicKeyHex: string;
  privateKeyHex: string;
}

export interface TessAddress {
  raw: string;
  display: string;
  meshAddress: string;
  publicKeyHex: string;
  fingerprint: string;
  checksum: string;
}

export function generateEd25519KeyPair(): Ed25519KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    publicKey,
    privateKey,
    publicKeyHex: publicKey.toString("hex"),
    privateKeyHex: privateKey.toString("hex"),
  };
}

export function deriveTessAddress(publicKeyDer: Buffer | string): TessAddress {
  const pubBuf = typeof publicKeyDer === "string"
    ? Buffer.from(publicKeyDer, "hex")
    : publicKeyDer;

  const sha256 = crypto.createHash("sha256").update(pubBuf).digest();
  const ripemd160 = crypto.createHash("ripemd160").update(sha256).digest();
  const meshBytes = sha256.subarray(0, 20);

  const versionedPayload = Buffer.concat([Buffer.from([0x54, 0x45]), meshBytes]);
  const checkHash = crypto.createHash("sha256")
    .update(crypto.createHash("sha256").update(versionedPayload).digest())
    .digest();
  const checksum = checkHash.subarray(0, 4);
  const addressBytes = Buffer.concat([versionedPayload, checksum]);

  const meshHex = meshBytes.toString("hex");
  const fingerprintHex = ripemd160.subarray(0, 8).toString("hex");
  const checksumHex = checksum.toString("hex");

  const raw = addressBytes.toString("hex");
  const display = `tess://${meshHex}.sovereign`;
  const meshAddress = `${meshHex}.sovereign`;

  return { raw, display, meshAddress, publicKeyHex: pubBuf.toString("hex"), fingerprint: fingerprintHex, checksum: checksumHex };
}

export function generateNodeAddress(nodeName: string): { keyPair: Ed25519KeyPair; address: TessAddress } {
  const keyPair = generateEd25519KeyPair();
  const address = deriveTessAddress(keyPair.publicKey);
  return { keyPair, address };
}

export function verifyTessAddress(address: TessAddress): boolean {
  try {
    const pubBuf = Buffer.from(address.publicKeyHex, "hex");
    const recomputed = deriveTessAddress(pubBuf);
    return recomputed.meshAddress === address.meshAddress && recomputed.checksum === address.checksum;
  } catch {
    return false;
  }
}

export function parseTessAddress(uri: string): string | null {
  const match = uri.match(/^tess:\/\/([0-9a-f]{40})\.sovereign/i);
  if (match) return match[1];
  const match2 = uri.match(/^([0-9a-f]{40})\.sovereign/i);
  if (match2) return match2[1];
  return null;
}

export function signMessage(privateKeyDer: Buffer | string, message: string): string {
  const privBuf = typeof privateKeyDer === "string"
    ? Buffer.from(privateKeyDer, "hex")
    : privateKeyDer;
  const privKey = crypto.createPrivateKey({ key: privBuf, format: "der", type: "pkcs8" });
  const sig = crypto.sign(null, Buffer.from(message, "utf8"), privKey);
  return sig.toString("hex");
}

export function verifySignature(publicKeyDer: Buffer | string, message: string, signatureHex: string): boolean {
  try {
    const pubBuf = typeof publicKeyDer === "string"
      ? Buffer.from(publicKeyDer, "hex")
      : publicKeyDer;
    const pubKey = crypto.createPublicKey({ key: pubBuf, format: "der", type: "spki" });
    return crypto.verify(null, Buffer.from(message, "utf8"), pubKey, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

const nodeKeyRegistry: Map<string, { keyPair: Ed25519KeyPair; address: TessAddress }> = new Map();

export function getOrCreateNodeAddress(nodeName: string): TessAddress {
  const existing = nodeKeyRegistry.get(nodeName);
  if (existing) return existing.address;
  const generated = generateNodeAddress(nodeName);
  nodeKeyRegistry.set(nodeName, generated);
  return generated.address;
}

export function getNodePublicKey(nodeName: string): string | null {
  return nodeKeyRegistry.get(nodeName)?.address.publicKeyHex || null;
}

export function getAllNodeAddresses(): Array<{ nodeName: string; address: TessAddress }> {
  return Array.from(nodeKeyRegistry.entries()).map(([nodeName, { address }]) => ({ nodeName, address }));
}
