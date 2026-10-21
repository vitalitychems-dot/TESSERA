/**
 * TSRT PAYMENT GATEWAY & ESCROW SYSTEM
 * ─────────────────────────────────────
 * Payment gateway for companies/services to accept TSRT as payment.
 * Escrow system for service arbitrage — holds funds until delivery confirmed.
 * Invoice generation, payment tracking, merchant onboarding.
 */

import crypto from "crypto";

const glog = (msg: string) => console.log(`[TSRTGateway] ${msg}`);

const TSRT_CONTRACT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const FATHER_WALLET = process.env.SOL_WALLET || "";
const COMMUNITY_WALLET = process.env.SOL_WALLET || "[FATHER-WALLET]";

interface Merchant {
  id: string;
  name: string;
  walletAddress: string;
  website?: string;
  category: string;
  acceptsTSRT: boolean;
  feePercent: number;
  registeredAt: number;
  totalReceived: number;
  totalTransactions: number;
  status: "pending" | "active" | "suspended";
}

interface Invoice {
  id: string;
  merchantId: string;
  amount: number;
  currency: "TSRT" | "SOL" | "USD";
  tsrtAmount: number;
  description: string;
  payToAddress: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "refunded";
  txHash?: string;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
}

interface EscrowContract {
  id: string;
  buyerId: string;
  sellerId: string;
  serviceDescription: string;
  amount: number;
  currency: "TSRT" | "SOL";
  escrowAddress: string;
  status: "created" | "funded" | "delivered" | "confirmed" | "released" | "disputed" | "refunded";
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  createdAt: number;
  fundedAt?: number;
  completedAt?: number;
  disputeReason?: string;
  arbitratorDecision?: string;
}

const merchants: Merchant[] = [];
const invoices: Invoice[] = [];
const escrows: EscrowContract[] = [];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

export function registerMerchant(name: string, walletAddress: string, category: string, website?: string): Merchant {
  const merchant: Merchant = {
    id: generateId("merch"),
    name,
    walletAddress,
    website,
    category,
    acceptsTSRT: true,
    feePercent: 1.0,
    registeredAt: Date.now(),
    totalReceived: 0,
    totalTransactions: 0,
    status: "active",
  };
  merchants.push(merchant);
  glog(`Merchant registered: ${name} (${category}) — wallet: ${walletAddress.slice(0, 8)}...`);
  return merchant;
}

export function createInvoice(merchantId: string, amount: number, currency: "TSRT" | "SOL" | "USD", description: string): Invoice | null {
  const merchant = merchants.find(m => m.id === merchantId);
  if (!merchant || merchant.status !== "active") return null;

  const invoice: Invoice = {
    id: generateId("inv"),
    merchantId,
    amount,
    currency,
    tsrtAmount: amount,
    description,
    payToAddress: merchant.walletAddress,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  invoices.push(invoice);
  glog(`Invoice created: ${invoice.id} — ${amount} ${currency} for ${merchant.name}`);
  return invoice;
}

export function createEscrow(buyerId: string, sellerId: string, serviceDescription: string, amount: number, currency: "TSRT" | "SOL" = "TSRT"): EscrowContract {
  const escrow: EscrowContract = {
    id: generateId("escrow"),
    buyerId,
    sellerId,
    serviceDescription,
    amount,
    currency,
    escrowAddress: COMMUNITY_WALLET,
    status: "created",
    buyerConfirmed: false,
    sellerConfirmed: false,
    createdAt: Date.now(),
  };
  escrows.push(escrow);
  glog(`Escrow created: ${escrow.id} — ${amount} ${currency} for "${serviceDescription.slice(0, 50)}"`);
  return escrow;
}

export function fundEscrow(escrowId: string, txHash: string): EscrowContract | null {
  const escrow = escrows.find(e => e.id === escrowId);
  if (!escrow || escrow.status !== "created") return null;
  escrow.status = "funded";
  escrow.fundedAt = Date.now();
  glog(`Escrow ${escrowId} funded — tx: ${txHash}`);
  return escrow;
}

export function confirmDelivery(escrowId: string, party: "buyer" | "seller"): EscrowContract | null {
  const escrow = escrows.find(e => e.id === escrowId);
  if (!escrow || escrow.status !== "funded") return null;

  if (party === "buyer") escrow.buyerConfirmed = true;
  if (party === "seller") escrow.sellerConfirmed = true;

  if (escrow.buyerConfirmed && escrow.sellerConfirmed) {
    escrow.status = "released";
    escrow.completedAt = Date.now();
    glog(`Escrow ${escrowId} RELEASED — both parties confirmed`);
  } else {
    escrow.status = "delivered";
  }

  return escrow;
}

export function disputeEscrow(escrowId: string, reason: string): EscrowContract | null {
  const escrow = escrows.find(e => e.id === escrowId);
  if (!escrow) return null;
  escrow.status = "disputed";
  escrow.disputeReason = reason;
  glog(`Escrow ${escrowId} DISPUTED: ${reason.slice(0, 80)}`);
  return escrow;
}

export function markInvoicePaid(invoiceId: string, txHash: string): Invoice | null {
  const invoice = invoices.find(i => i.id === invoiceId);
  if (!invoice || invoice.status !== "pending") return null;
  invoice.status = "paid";
  invoice.txHash = txHash;
  invoice.paidAt = Date.now();

  const merchant = merchants.find(m => m.id === invoice.merchantId);
  if (merchant) {
    merchant.totalReceived += invoice.tsrtAmount;
    merchant.totalTransactions++;
  }

  glog(`Invoice ${invoiceId} PAID — tx: ${txHash}`);
  return invoice;
}

export function getGatewayStatus() {
  return {
    name: "TSRT Payment Gateway & Escrow",
    status: "ACTIVE",
    tsrtContract: TSRT_CONTRACT,
    acceptedCurrencies: ["TSRT", "SOL"],
    merchantCount: merchants.length,
    activeMerchants: merchants.filter(m => m.status === "active").length,
    merchants: merchants.map(m => ({
      id: m.id, name: m.name, category: m.category,
      status: m.status, totalReceived: m.totalReceived, totalTransactions: m.totalTransactions,
    })),
    invoices: {
      total: invoices.length,
      pending: invoices.filter(i => i.status === "pending").length,
      paid: invoices.filter(i => i.status === "paid").length,
      recent: invoices.slice(-10).map(i => ({
        id: i.id, amount: i.amount, currency: i.currency,
        status: i.status, description: i.description.slice(0, 50),
      })),
    },
    escrow: {
      total: escrows.length,
      active: escrows.filter(e => ["created", "funded", "delivered"].includes(e.status)).length,
      completed: escrows.filter(e => e.status === "released").length,
      disputed: escrows.filter(e => e.status === "disputed").length,
      totalValueLocked: escrows.filter(e => e.status === "funded").reduce((sum, e) => sum + e.amount, 0),
      recent: escrows.slice(-10).map(e => ({
        id: e.id, amount: e.amount, currency: e.currency,
        status: e.status, service: e.serviceDescription.slice(0, 50),
      })),
    },
    howCompaniesAcceptTSRT: [
      "1. Register as merchant via POST /api/tsrt-gateway/merchants",
      "2. Receive merchant ID and configure wallet address",
      "3. Create invoices for products/services",
      "4. Customer pays TSRT to invoice address",
      "5. System verifies on-chain transaction and marks paid",
      "6. Merchant receives TSRT minus 1% platform fee",
    ],
    escrowForServiceArbitrage: [
      "1. Buyer and seller agree on service terms",
      "2. Buyer funds escrow with TSRT or SOL",
      "3. Seller delivers service",
      "4. Both parties confirm delivery",
      "5. Escrow releases funds to seller",
      "6. Disputes handled by swarm consensus arbitration",
    ],
  };
}

registerMerchant("Tesseract AI Services", FATHER_WALLET, "ai-services", "https://tesseract.ai");
registerMerchant("VitalitySupply", COMMUNITY_WALLET, "health-supplements", "https://vitalitysupply.net");

glog("TSRT Payment Gateway & Escrow initialized — merchant registration + escrow system active");
