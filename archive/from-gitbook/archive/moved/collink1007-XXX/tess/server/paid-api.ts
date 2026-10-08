import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { callLLMSimple } from "./llm-helper";

const log = (msg: string) => console.log(`[PaidAPI] ${msg}`);

const WALLET_ADDRESS = process.env.SOL_WALLET || "";
const RPC_URL = "https://api.mainnet-beta.solana.com";

const SERVICES = {
  "text-generate": { name: "AI Text Generation", priceSOL: 0.001, description: "Generate any text content using advanced AI" },
  "code-review": { name: "AI Code Review", priceSOL: 0.002, description: "Get professional code review and suggestions" },
  "summarize": { name: "Text Summarization", priceSOL: 0.001, description: "Summarize any article, document, or text" },
  "translate": { name: "AI Translation", priceSOL: 0.001, description: "Translate text between 50+ languages" },
  "seo-audit": { name: "SEO Audit", priceSOL: 0.003, description: "Get SEO analysis and recommendations for any URL" },
  "blog-post": { name: "Blog Post Generation", priceSOL: 0.005, description: "Generate a full SEO-optimized blog post" },
  "email-write": { name: "Email Writer", priceSOL: 0.001, description: "Generate professional emails, cold outreach, cover letters" },
  "data-extract": { name: "Data Extraction", priceSOL: 0.002, description: "Extract structured data from unstructured text" },
};

interface PaymentRecord {
  signature: string;
  fromAddress: string;
  amountSOL: number;
  service: string;
  verifiedAt: number;
  status: "verified" | "failed" | "pending";
  response?: string;
}

interface APIStats {
  totalRequests: number;
  totalRevenueLamports: number;
  totalRevenueSOL: number;
  requestsByService: Record<string, number>;
  recentPayments: PaymentRecord[];
  startedAt: number;
}

const apiStats: APIStats = {
  totalRequests: 0,
  totalRevenueLamports: 0,
  totalRevenueSOL: 0,
  requestsByService: {},
  recentPayments: [],
  startedAt: Date.now(),
};

const usedSignatures = new Map<string, number>();
const MAX_USED_SIGS = 10000;
const SIG_EXPIRY_MS = 24 * 60 * 60 * 1000;

function cleanExpiredSignatures() {
  const cutoff = Date.now() - SIG_EXPIRY_MS;
  const toDelete: string[] = [];
  usedSignatures.forEach((ts, sig) => { if (ts < cutoff) toDelete.push(sig); });
  toDelete.forEach(sig => usedSignatures.delete(sig));
  if (usedSignatures.size > MAX_USED_SIGS) {
    const entries = [...usedSignatures.entries()].sort((a, b) => a[1] - b[1]);
    entries.slice(0, entries.length - MAX_USED_SIGS).forEach(([sig]) => usedSignatures.delete(sig));
  }
}

function markSignatureUsed(signature: string): boolean {
  cleanExpiredSignatures();
  if (usedSignatures.has(signature)) return false;
  usedSignatures.set(signature, Date.now());
  return true;
}

let connection: Connection | null = null;
function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, "confirmed");
  return connection;
}

export async function verifySOLPayment(
  signature: string,
  expectedAmountSOL: number,
  maxAgeSeconds: number = 300
): Promise<{ verified: boolean; fromAddress?: string; amountSOL?: number; error?: string }> {
  if (usedSignatures.has(signature)) {
    return { verified: false, error: "Payment signature already used. Each payment can only be redeemed once." };
  }

  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) {
      return { verified: false, error: "Transaction not found. It may not be confirmed yet." };
    }

    if (tx.meta?.err) {
      return { verified: false, error: "Transaction failed on-chain" };
    }

    const blockTime = tx.blockTime;
    if (blockTime) {
      const age = Math.floor(Date.now() / 1000) - blockTime;
      if (age > maxAgeSeconds) {
        return { verified: false, error: `Transaction too old (${age}s > ${maxAgeSeconds}s limit)` };
      }
    }

    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.getAccountKeys();

    let receiverIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys.get(i)?.toBase58() === WALLET_ADDRESS) {
        receiverIndex = i;
        break;
      }
    }

    if (receiverIndex === -1) {
      return { verified: false, error: "Payment not sent to our wallet" };
    }

    const received = (postBalances[receiverIndex] - preBalances[receiverIndex]) / LAMPORTS_PER_SOL;
    const minExpected = expectedAmountSOL * 0.95;

    if (received < minExpected) {
      return { verified: false, error: `Insufficient payment: received ${received.toFixed(6)} SOL, expected ${expectedAmountSOL} SOL` };
    }

    let senderAddress = "";
    for (let i = 0; i < accountKeys.length; i++) {
      if (i !== receiverIndex && preBalances[i] > postBalances[i]) {
        senderAddress = accountKeys.get(i)?.toBase58() || "";
        break;
      }
    }

    return { verified: true, fromAddress: senderAddress, amountSOL: received };
  } catch (err: any) {
    return { verified: false, error: `Verification failed: ${err.message}` };
  }
}

async function processServiceRequest(service: string, prompt: string): Promise<string> {
  const systemPrompts: Record<string, string> = {
    "text-generate": "You are a professional content writer. Generate high-quality text based on the user's request.",
    "code-review": "You are a senior software engineer. Review the provided code and give specific, actionable feedback on bugs, performance, security, and best practices.",
    "summarize": "You are an expert summarizer. Provide a clear, concise summary of the provided text, capturing all key points.",
    "translate": "You are a professional translator. Translate the provided text accurately while maintaining natural flow in the target language.",
    "seo-audit": "You are an SEO expert. Analyze the provided URL or content and give specific, actionable SEO recommendations covering title tags, meta descriptions, headings, keywords, content quality, and technical SEO.",
    "blog-post": "You are a professional blog writer. Generate a complete, SEO-optimized blog post with proper headings, engaging content, and a natural writing style. Include an introduction, body sections with ## headings, and a conclusion.",
    "email-write": "You are a professional email writer. Generate a polished, effective email based on the user's requirements.",
    "data-extract": "You are a data extraction specialist. Extract and structure the requested data from the provided text in a clean, organized format.",
  };

  const systemPrompt = systemPrompts[service] || systemPrompts["text-generate"];
  const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;

  try {
    const response = await callLLMSimple(fullPrompt, 1500);
    return response;
  } catch (err: any) {
    return `Error processing request: ${err.message}`;
  }
}

export function getAPIServices() {
  return Object.entries(SERVICES).map(([id, svc]) => ({
    id,
    ...svc,
    priceUSD: (svc.priceSOL * 170).toFixed(2),
  }));
}

export function getAPIStats() {
  return {
    ...apiStats,
    uptime: Math.floor((Date.now() - apiStats.startedAt) / 1000),
    servicesAvailable: Object.keys(SERVICES).length,
  };
}

export async function handlePaidRequest(
  service: string,
  prompt: string,
  paymentSignature: string
): Promise<{ success: boolean; result?: string; error?: string; payment?: PaymentRecord }> {
  const svc = SERVICES[service as keyof typeof SERVICES];
  if (!svc) {
    return { success: false, error: `Unknown service: ${service}. Available: ${Object.keys(SERVICES).join(", ")}` };
  }

  if (!prompt || prompt.trim().length < 3) {
    return { success: false, error: "Prompt is required and must be at least 3 characters" };
  }

  if (!paymentSignature || paymentSignature.length < 30) {
    return { success: false, error: "Valid Solana transaction signature required as payment proof" };
  }

  log(`Processing ${service} request with payment ${paymentSignature.slice(0, 12)}...`);

  const verification = await verifySOLPayment(paymentSignature, svc.priceSOL);

  const payment: PaymentRecord = {
    signature: paymentSignature,
    fromAddress: verification.fromAddress || "unknown",
    amountSOL: verification.amountSOL || 0,
    service,
    verifiedAt: Date.now(),
    status: verification.verified ? "verified" : "failed",
  };

  if (!verification.verified) {
    payment.status = "failed";
    apiStats.recentPayments.push(payment);
    if (apiStats.recentPayments.length > 100) apiStats.recentPayments = apiStats.recentPayments.slice(-80);
    return { success: false, error: `Payment verification failed: ${verification.error}`, payment };
  }

  if (!markSignatureUsed(paymentSignature)) {
    return { success: false, error: "Payment signature already redeemed. Each transaction can only be used once." };
  }

  apiStats.totalRequests++;
  apiStats.totalRevenueLamports += Math.round((verification.amountSOL || 0) * LAMPORTS_PER_SOL);
  apiStats.totalRevenueSOL += verification.amountSOL || 0;
  apiStats.requestsByService[service] = (apiStats.requestsByService[service] || 0) + 1;

  log(`Payment verified: ${verification.amountSOL?.toFixed(6)} SOL from ${verification.fromAddress}`);

  const result = await processServiceRequest(service, prompt);
  payment.response = result.slice(0, 100) + (result.length > 100 ? "..." : "");

  apiStats.recentPayments.push(payment);
  if (apiStats.recentPayments.length > 100) apiStats.recentPayments = apiStats.recentPayments.slice(-80);

  log(`${service} request fulfilled for ${verification.fromAddress} — ${result.length} chars generated`);

  return { success: true, result, payment };
}

export function generateSolanaPayURL(amountSOL: number, memo?: string): string {
  const base = `solana:${WALLET_ADDRESS}`;
  const params = new URLSearchParams();
  params.set("amount", amountSOL.toString());
  if (memo) params.set("memo", memo);
  return `${base}?${params.toString()}`;
}

export function generatePaymentInstructions(service: string): {
  walletAddress: string;
  amountSOL: number;
  solanaPayURL: string;
  instructions: string[];
} | null {
  const svc = SERVICES[service as keyof typeof SERVICES];
  if (!svc) return null;

  return {
    walletAddress: WALLET_ADDRESS,
    amountSOL: svc.priceSOL,
    solanaPayURL: generateSolanaPayURL(svc.priceSOL, `tessera-api-${service}`),
    instructions: [
      `Send exactly ${svc.priceSOL} SOL to ${WALLET_ADDRESS}`,
      "Use any Solana wallet (Phantom, Solflare, etc.)",
      "Copy the transaction signature after sending",
      `POST to /api/v1/request with: { service: "${service}", prompt: "your request", paymentSignature: "your_tx_signature" }`,
      "Your AI response will be returned immediately after payment verification",
    ],
  };
}

export function getDonationInfo() {
  return {
    walletAddress: WALLET_ADDRESS,
    network: "Solana (Mainnet)",
    supportedTokens: ["SOL", "TSRT"],
    tsrtContract: "REDACTED",
    solanaPayURL: generateSolanaPayURL(0, "tessera-donation"),
    qrCodeData: `solana:${WALLET_ADDRESS}`,
    message: "Support Tessera Sovereign — the world's first autonomous AI republic. Every SOL helps power our 80+ agents and accelerates AI sovereignty.",
  };
}

log("Paid API Gateway initialized — accepting SOL payments for AI services");
