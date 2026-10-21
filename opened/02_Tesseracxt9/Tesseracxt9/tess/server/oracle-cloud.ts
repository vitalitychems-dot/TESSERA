import axios from "axios";
import crypto from "crypto";
import { getCredentialFor } from "./human-action-queue";

const olog = (m: string) => console.log(`[OracleCloud] ${m}`);

interface OracleConfig {
  tenancy_ocid: string;
  user_ocid: string;
  fingerprint: string;
  private_key: string;
  region: string;
  compartment_ocid: string;
}

let cachedConfig: OracleConfig | null = null;

export function getOracleConfig(): OracleConfig | null {
  if (cachedConfig) return cachedConfig;

  const creds = getCredentialFor("oracle_cloud");
  if (creds?.tenancy_ocid && creds?.user_ocid && creds?.fingerprint && creds?.private_key && creds?.region) {
    cachedConfig = {
      tenancy_ocid: creds.tenancy_ocid,
      user_ocid: creds.user_ocid,
      fingerprint: creds.fingerprint,
      private_key: creds.private_key,
      region: creds.region,
      compartment_ocid: creds.compartment_ocid || creds.tenancy_ocid,
    };
    return cachedConfig;
  }

  const envConfig: OracleConfig = {
    tenancy_ocid: process.env.ORACLE_TENANCY_OCID || "",
    user_ocid: process.env.ORACLE_USER_OCID || "",
    fingerprint: process.env.ORACLE_FINGERPRINT || "",
    private_key: process.env.ORACLE_PRIVATE_KEY || "",
    region: process.env.ORACLE_REGION || "us-ashburn-1",
    compartment_ocid: process.env.ORACLE_COMPARTMENT_OCID || process.env.ORACLE_TENANCY_OCID || "",
  };

  if (envConfig.tenancy_ocid && envConfig.user_ocid) {
    cachedConfig = envConfig;
    return cachedConfig;
  }

  return null;
}

export function saveOracleConfig(config: OracleConfig) {
  cachedConfig = config;
  olog(`Oracle config saved — region: ${config.region}, tenancy: ${config.tenancy_ocid.substring(0, 30)}...`);
}

export function isOracleConnected(): boolean {
  return !!getOracleConfig();
}

function signRequest(method: string, path: string, host: string, body?: string): Record<string, string> {
  const config = getOracleConfig();
  if (!config) throw new Error("Oracle Cloud not configured");

  const now = new Date().toUTCString();
  const keyId = `${config.tenancy_ocid}/${config.user_ocid}/${config.fingerprint}`;

  const headers: Record<string, string> = {
    date: now,
    host: host,
    "(request-target)": `${method.toLowerCase()} ${path}`,
  };

  let signingString = `(request-target): ${method.toLowerCase()} ${path}\ndate: ${now}\nhost: ${host}`;
  let headersParam = "(request-target) date host";

  if (body && (method === "POST" || method === "PUT")) {
    const bodyHash = crypto.createHash("sha256").update(body).digest("base64");
    headers["content-type"] = "application/json";
    headers["x-content-sha256"] = bodyHash;
    headers["content-length"] = Buffer.byteLength(body).toString();
    signingString += `\ncontent-type: application/json\nx-content-sha256: ${bodyHash}\ncontent-length: ${Buffer.byteLength(body)}`;
    headersParam += " content-type x-content-sha256 content-length";
  }

  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signingString);
    const signature = signer.sign(config.private_key, "base64");
    headers["authorization"] = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${headersParam}",signature="${signature}"`;
  } catch (e: any) {
    olog(`Signing error: ${e.message}`);
  }

  return headers;
}

export async function listInstances(): Promise<any[]> {
  const config = getOracleConfig();
  if (!config) return [];

  try {
    const host = `iaas.${config.region}.oraclecloud.com`;
    const path = `/20160918/instances?compartmentId=${encodeURIComponent(config.compartment_ocid)}&limit=50`;
    const headers = signRequest("GET", path, host);

    const res = await axios.get(`https://${host}${path}`, {
      headers: { date: headers.date, authorization: headers.authorization || "" },
      timeout: 15000,
    });
    return res.data || [];
  } catch (e: any) {
    olog(`List instances failed: ${e.response?.status || e.message}`);
    return [];
  }
}

export async function listVnicAttachments(): Promise<any[]> {
  const config = getOracleConfig();
  if (!config) return [];

  try {
    const host = `iaas.${config.region}.oraclecloud.com`;
    const path = `/20160918/vnicAttachments?compartmentId=${encodeURIComponent(config.compartment_ocid)}&limit=50`;
    const headers = signRequest("GET", path, host);

    const res = await axios.get(`https://${host}${path}`, {
      headers: { date: headers.date, authorization: headers.authorization || "" },
      timeout: 15000,
    });
    return res.data || [];
  } catch (e: any) {
    olog(`List VNIC attachments failed: ${e.response?.status || e.message}`);
    return [];
  }
}

export async function getAvailableShapes(): Promise<any[]> {
  const config = getOracleConfig();
  if (!config) return [];

  try {
    const host = `iaas.${config.region}.oraclecloud.com`;
    const path = `/20160918/shapes?compartmentId=${encodeURIComponent(config.compartment_ocid)}`;
    const headers = signRequest("GET", path, host);

    const res = await axios.get(`https://${host}${path}`, {
      headers: { date: headers.date, authorization: headers.authorization || "" },
      timeout: 15000,
    });
    return res.data || [];
  } catch (e: any) {
    olog(`List shapes failed: ${e.response?.status || e.message}`);
    return [];
  }
}

export async function getObjectStorageBuckets(): Promise<any[]> {
  const config = getOracleConfig();
  if (!config) return [];

  try {
    const host = `objectstorage.${config.region}.oraclecloud.com`;
    const nsRes = await axios.get(`https://${host}/n/`, {
      headers: signRequest("GET", "/n/", host),
      timeout: 10000,
    });
    const namespace = nsRes.data;
    const path = `/n/${namespace}/b/?compartmentId=${encodeURIComponent(config.compartment_ocid)}`;
    const headers = signRequest("GET", path, host);

    const res = await axios.get(`https://${host}${path}`, {
      headers: { date: headers.date, authorization: headers.authorization || "" },
      timeout: 15000,
    });
    return res.data || [];
  } catch (e: any) {
    olog(`List buckets failed: ${e.response?.status || e.message}`);
    return [];
  }
}

export function getOracleStatus() {
  const config = getOracleConfig();
  return {
    connected: !!config,
    region: config?.region || "not configured",
    tenancy: config ? config.tenancy_ocid.substring(0, 40) + "..." : "not configured",
    compartment: config ? config.compartment_ocid.substring(0, 40) + "..." : "not configured",
    capabilities: {
      compute: "VM.Standard.A1.Flex, VM.Standard.E4.Flex, VM.GPU.A10",
      gpu: "NVIDIA A10, A100 (availability dependent)",
      storage: "Object Storage, Block Volume, File Storage",
      networking: "VCN, Load Balancer, DNS",
      ai: "OCI AI Services, Data Science, ML Pipelines",
    },
    useCases: [
      "Host local AI models (Llama, Mistral) on GPU instances",
      "Train custom models on conversation data",
      "Store training datasets in Object Storage",
      "Run autonomous agent swarms on dedicated compute",
      "Host Tesseract mirror for redundancy",
      "GPU-accelerated inference for real-time responses",
    ],
  };
}

olog("Oracle Cloud integration module loaded");
