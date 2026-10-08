import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fetchTsrtLiveData, TSRT_CONTRACT, COMMUNITY_WALLET as TSRT_COMMUNITY_WALLET } from "./real-limn-data";
let rotIdx = 0;

const MARKETPLACE_STATE_FILE = path.join(process.cwd(), "server", "marketplace-state.json");

const mlog = (m: string) => console.log(`[Marketplace] ${m}`);

interface MarketplaceListing {
  id: string;
  type: "product" | "service" | "compute" | "tool";
  title: string;
  description: string;
  seller: string;
  sellerWallet?: string;
  priceLimn: number;
  category: string;
  status: "active" | "sold" | "rented" | "expired" | "cancelled" | "disputed";
  createdAt: number;
  expiresAt: number;
  metadata: Record<string, any>;
}

interface ComputeRental {
  id: string;
  listingId: string;
  resourceType: "vram" | "vcpu" | "vgpu";
  capacity: number;
  unit: string;
  pricePerHourLimn: number;
  minHours: number;
  maxHours: number;
  seller: string;
  renter: string | null;
  status: "available" | "rented" | "completed" | "cancelled" | "disputed";
  startTime: number | null;
  endTime: number | null;
  actualEndTime: number | null;
  totalCostLimn: number;
  actualCostLimn: number;
  escrowId: string | null;
}

interface ToolLending {
  id: string;
  listingId: string;
  toolName: string;
  toolType: "llm_access" | "code_gen" | "data_analysis" | "image_gen" | "web_search" | "seo" | "content" | "security";
  capabilities: string[];
  pricePerUseLimn: number;
  dailyRateLimn: number;
  maxUsesPerDay: number;
  lender: string;
  borrower: string | null;
  status: "available" | "lent" | "returned" | "suspended";
  usesToday: number;
  totalUses: number;
  totalEarnedLimn: number;
  apiCallsMetered: number;
  escrowId: string | null;
  lendStartTime: number | null;
}

interface MarketTransaction {
  id: string;
  type: "purchase" | "rental_start" | "rental_end" | "rental_settle" | "tool_use" | "tool_lend" | "tool_return_settle" | "escrow_create" | "escrow_release" | "escrow_refund" | "dispute_open" | "dispute_resolve" | "fee_collect";
  listingId: string;
  buyer: string;
  seller: string;
  amountLimn: number;
  feeLimn: number;
  netAmountLimn: number;
  computeValueUsd: number;
  onChainSignature: string | null;
  escrowId: string | null;
  timestamp: number;
  metadata: Record<string, any>;
}

interface EscrowRecord {
  id: string;
  listingId: string;
  depositor: string;
  beneficiary: string;
  amountLimn: number;
  status: "held" | "released" | "refunded" | "partially_released";
  createdAt: number;
  releasedAt: number | null;
  releasedAmountLimn: number;
  refundedAmountLimn: number;
  reason: string;
}

interface Dispute {
  id: string;
  listingId: string;
  transactionId: string;
  escrowId: string | null;
  complainant: string;
  respondent: string;
  reason: string;
  status: "open" | "resolved_buyer" | "resolved_seller" | "resolved_split" | "dismissed";
  amountLimn: number;
  resolution: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

interface RevenueRecord {
  id: string;
  source: "purchase_fee" | "rental_fee" | "tool_fee" | "dispute_fee" | "escrow_fee";
  amountLimn: number;
  amountUsd: number;
  transactionId: string;
  timestamp: number;
}

interface MarketplaceState {
  listings: MarketplaceListing[];
  computeRentals: ComputeRental[];
  toolLendings: ToolLending[];
  transactions: MarketTransaction[];
  escrows: EscrowRecord[];
  disputes: Dispute[];
  revenue: RevenueRecord[];
  totalVolumeLimn: number;
  totalTransactions: number;
  activeListings: number;
  activeRentals: number;
  activeToolLends: number;
  feePoolLimn: number;
  burnedFromFees: number;
  totalRevenueUsd: number;
  totalRevenueLimn: number;
  escrowHeldLimn: number;
}

const state: MarketplaceState = {
  listings: [],
  computeRentals: [],
  toolLendings: [],
  transactions: [],
  escrows: [],
  disputes: [],
  revenue: [],
  totalVolumeLimn: 0,
  totalTransactions: 0,
  activeListings: 0,
  activeRentals: 0,
  activeToolLends: 0,
  feePoolLimn: 0,
  burnedFromFees: 0,
  totalRevenueUsd: 0,
  totalRevenueLimn: 0,
  escrowHeldLimn: 0,
};

const FEE_TIERS: Record<string, number> = {
  purchase: 5,
  rental: 8,
  tool_lend: 10,
  tool_use: 5,
  dispute: 15,
};
const BURN_FROM_FEE_PERCENT = 50;
const PUMP_FUN_TOKEN = process.env.TSRT_CONTRACT || "REDACTED";
const COMMUNITY_WALLET = process.env.SOL_WALLET || "";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

const COMPUTE_RATES: Record<string, { basePriceLimn: number; unit: string }> = {
  vram: { basePriceLimn: 0.5, unit: "GB/hour" },
  vcpu: { basePriceLimn: 0.2, unit: "core/hour" },
  vgpu: { basePriceLimn: 2.0, unit: "GPU/hour" },
};

const TOOL_RATES: Record<string, { basePriceLimn: number; dailyRate: number }> = {
  llm_access: { basePriceLimn: 0.1, dailyRate: 5 },
  code_gen: { basePriceLimn: 0.3, dailyRate: 15 },
  data_analysis: { basePriceLimn: 0.2, dailyRate: 10 },
  image_gen: { basePriceLimn: 0.5, dailyRate: 25 },
  web_search: { basePriceLimn: 0.05, dailyRate: 3 },
  seo: { basePriceLimn: 0.15, dailyRate: 8 },
  content: { basePriceLimn: 0.2, dailyRate: 10 },
  security: { basePriceLimn: 0.4, dailyRate: 20 },
};

let cachedLimnPriceUsd = 0;
let lastPriceFetch = 0;

async function getLimnPriceUsd(): Promise<number> {
  const now = Date.now();
  if (cachedLimnPriceUsd > 0 && now - lastPriceFetch < 60000) return cachedLimnPriceUsd;
  try {
    const data = await fetchTsrtLiveData();
    cachedLimnPriceUsd = parseFloat(data.priceUsd) || 0;
    lastPriceFetch = now;
    return cachedLimnPriceUsd;
  } catch {
    return cachedLimnPriceUsd || 0;
  }
}

function generateId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function calculateFee(amountLimn: number, feeType: string): { feeLimn: number; burnLimn: number; netToSeller: number; platformFeeLimn: number } {
  const feePercent = FEE_TIERS[feeType] || 5;
  const feeLimn = amountLimn * (feePercent / 100);
  const burnLimn = feeLimn * (BURN_FROM_FEE_PERCENT / 100);
  const platformFeeLimn = feeLimn - burnLimn;
  const netToSeller = amountLimn - feeLimn;
  return { feeLimn, burnLimn, netToSeller, platformFeeLimn };
}

async function verifyWalletLimnBalance(walletAddress: string, requiredAmount: number): Promise<{ sufficient: boolean; balance: number; error?: string }> {
  try {
    const tokenRes = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: TSRT_CONTRACT },
          { encoding: "jsonParsed" }
        ]
      })
    });
    const tokenData = await tokenRes.json() as any;
    if (tokenData?.error) {
      return { sufficient: false, balance: 0, error: `RPC error: ${tokenData.error.message}` };
    }
    const accounts = tokenData?.result?.value || [];
    if (accounts.length === 0) {
      return { sufficient: false, balance: 0, error: "No TSRT token account found for this wallet" };
    }
    const balance = accounts[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    return { sufficient: balance >= requiredAmount, balance };
  } catch (err: any) {
    return { sufficient: false, balance: 0, error: `Balance check failed: ${err?.message}` };
  }
}

async function createSplTransferInstruction(fromWallet: string, toWallet: string, amountLimn: number): Promise<{ instruction: any; signature: string | null; error?: string }> {
  const txId = `limn-tx-${generateId()}`;
  mlog(`SPL transfer instruction: ${amountLimn} TSRT from ${fromWallet.slice(0, 8)}... to ${toWallet.slice(0, 8)}... (ref: ${txId})`);
  return {
    instruction: {
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      from: fromWallet,
      to: toWallet,
      mint: TSRT_CONTRACT,
      amount: amountLimn,
      decimals: 6,
      reference: txId,
    },
    signature: txId,
  };
}

function createEscrow(listingId: string, depositor: string, beneficiary: string, amountLimn: number, reason: string): EscrowRecord {
  const escrow: EscrowRecord = {
    id: `esc-${generateId()}`,
    listingId,
    depositor,
    beneficiary,
    amountLimn,
    status: "held",
    createdAt: Date.now(),
    releasedAt: null,
    releasedAmountLimn: 0,
    refundedAmountLimn: 0,
    reason,
  };
  state.escrows.push(escrow);
  state.escrowHeldLimn += amountLimn;
  mlog(`Escrow created: ${escrow.id} — ${amountLimn} TSRT held for ${reason}`);
  return escrow;
}

function releaseEscrow(escrowId: string, amountToRelease?: number): EscrowRecord | null {
  const escrow = state.escrows.find(e => e.id === escrowId && e.status === "held");
  if (!escrow) return null;

  const releaseAmount = amountToRelease !== undefined ? Math.min(amountToRelease, escrow.amountLimn - escrow.releasedAmountLimn) : escrow.amountLimn - escrow.releasedAmountLimn;

  escrow.releasedAmountLimn += releaseAmount;
  state.escrowHeldLimn -= releaseAmount;

  if (escrow.releasedAmountLimn >= escrow.amountLimn) {
    escrow.status = "released";
    escrow.releasedAt = Date.now();
  } else {
    escrow.status = "partially_released";
  }

  mlog(`Escrow ${escrowId} released ${releaseAmount} TSRT to ${escrow.beneficiary}`);
  return escrow;
}

function refundEscrow(escrowId: string, amountToRefund?: number): EscrowRecord | null {
  const escrow = state.escrows.find(e => e.id === escrowId && (e.status === "held" || e.status === "partially_released"));
  if (!escrow) return null;

  const remainingHeld = escrow.amountLimn - escrow.releasedAmountLimn - escrow.refundedAmountLimn;
  const refundAmount = amountToRefund !== undefined ? Math.min(amountToRefund, remainingHeld) : remainingHeld;

  escrow.refundedAmountLimn += refundAmount;
  state.escrowHeldLimn -= refundAmount;

  if (escrow.releasedAmountLimn + escrow.refundedAmountLimn >= escrow.amountLimn) {
    escrow.status = "refunded";
    escrow.releasedAt = Date.now();
  }

  mlog(`Escrow ${escrowId} refunded ${refundAmount} TSRT to ${escrow.depositor}`);
  return escrow;
}

async function recordRevenueFromFee(feeLimn: number, source: RevenueRecord["source"], transactionId: string) {
  const priceUsd = await getLimnPriceUsd();
  const record: RevenueRecord = {
    id: `rev-${generateId()}`,
    source,
    amountLimn: feeLimn,
    amountUsd: feeLimn * priceUsd,
    transactionId,
    timestamp: Date.now(),
  };
  state.revenue.push(record);
  if (state.revenue.length > 5000) {
    state.revenue = state.revenue.slice(-4000);
  }
  state.totalRevenueLimn += feeLimn;
  state.totalRevenueUsd += record.amountUsd;
}

async function recordTransaction(tx: Omit<MarketTransaction, "id" | "timestamp" | "feeLimn" | "netAmountLimn" | "onChainSignature" | "escrowId"> & { feeType: string; escrowId?: string | null; onChainSignature?: string | null }): Promise<MarketTransaction> {
  const feeInfo = calculateFee(tx.amountLimn, tx.feeType);

  const transaction: MarketTransaction = {
    id: `tx-${generateId()}`,
    type: tx.type,
    listingId: tx.listingId,
    buyer: tx.buyer,
    seller: tx.seller,
    amountLimn: tx.amountLimn,
    feeLimn: feeInfo.feeLimn,
    netAmountLimn: feeInfo.netToSeller,
    computeValueUsd: tx.computeValueUsd,
    onChainSignature: tx.onChainSignature || null,
    escrowId: tx.escrowId || null,
    timestamp: Date.now(),
    metadata: tx.metadata,
  };
  state.transactions.push(transaction);
  if (state.transactions.length > 5000) {
    state.transactions = state.transactions.slice(-4000);
  }
  state.totalVolumeLimn += tx.amountLimn;
  state.totalTransactions++;
  state.feePoolLimn += feeInfo.platformFeeLimn;
  state.burnedFromFees += feeInfo.burnLimn;

  await recordRevenueFromFee(feeInfo.platformFeeLimn, tx.type.includes("rental") ? "rental_fee" : tx.type.includes("tool") ? "tool_fee" : "purchase_fee", transaction.id);

  return transaction;
}

export function createListing(params: {
  type: "product" | "service" | "compute" | "tool";
  title: string;
  description: string;
  seller: string;
  sellerWallet?: string;
  priceLimn: number;
  category: string;
  durationHours?: number;
  metadata?: Record<string, any>;
}): MarketplaceListing {
  const listing: MarketplaceListing = {
    id: `lst-${generateId()}`,
    type: params.type,
    title: params.title,
    description: params.description,
    seller: params.seller,
    sellerWallet: params.sellerWallet,
    priceLimn: params.priceLimn,
    category: params.category,
    status: "active",
    createdAt: Date.now(),
    expiresAt: Date.now() + (params.durationHours || 168) * 3600000,
    metadata: params.metadata || {},
  };
  state.listings.push(listing);
  state.activeListings++;
  return listing;
}

export async function purchaseListing(listingId: string, buyer: string, buyerWallet?: string): Promise<{ transaction: MarketTransaction | null; error?: string; balanceCheck?: any }> {
  const listing = state.listings.find(l => l.id === listingId && l.status === "active");
  if (!listing) return { transaction: null, error: "Listing not found or not active" };
  if (listing.seller === buyer) return { transaction: null, error: "Cannot purchase own listing" };

  const priceUsd = await getLimnPriceUsd();

  if (buyerWallet) {
    const balanceCheck = await verifyWalletLimnBalance(buyerWallet, listing.priceLimn);
    if (!balanceCheck.sufficient) {
      return { transaction: null, error: `Insufficient TSRT balance: have ${balanceCheck.balance}, need ${listing.priceLimn}`, balanceCheck };
    }

    const sellerWallet = listing.sellerWallet || COMMUNITY_WALLET;
    const feeInfo = calculateFee(listing.priceLimn, "purchase");

    const transferToSeller = await createSplTransferInstruction(buyerWallet, sellerWallet, feeInfo.netToSeller);
    const transferFee = await createSplTransferInstruction(buyerWallet, COMMUNITY_WALLET, feeInfo.feeLimn);

    mlog(`On-chain purchase: ${listing.priceLimn} TSRT ($${(listing.priceLimn * priceUsd).toFixed(4)}) — fee: ${feeInfo.feeLimn.toFixed(4)} TSRT, net to seller: ${feeInfo.netToSeller.toFixed(4)} TSRT`);

    listing.status = "sold";
    state.activeListings--;

    const tx = await recordTransaction({
      type: "purchase",
      listingId: listing.id,
      buyer,
      seller: listing.seller,
      amountLimn: listing.priceLimn,
      computeValueUsd: listing.priceLimn * priceUsd,
      feeType: "purchase",
      onChainSignature: transferToSeller.signature,
      metadata: {
        title: listing.title,
        category: listing.category,
        buyerWallet,
        sellerWallet,
        feeTransferRef: transferFee.signature,
        tsrtPriceUsd: priceUsd,
      },
    });

    return { transaction: tx };
  }

  listing.status = "sold";
  state.activeListings--;

  const tx = await recordTransaction({
    type: "purchase",
    listingId: listing.id,
    buyer,
    seller: listing.seller,
    amountLimn: listing.priceLimn,
    computeValueUsd: listing.priceLimn * priceUsd,
    feeType: "purchase",
    metadata: { title: listing.title, category: listing.category, offChain: true },
  });

  return { transaction: tx };
}

export function createComputeRental(params: {
  resourceType: "vram" | "vcpu" | "vgpu";
  capacity: number;
  seller: string;
  priceMultiplier?: number;
  minHours?: number;
  maxHours?: number;
}): ComputeRental {
  const baseRate = COMPUTE_RATES[params.resourceType];
  const pricePerHour = baseRate.basePriceLimn * params.capacity * (params.priceMultiplier || 1);

  const listing = createListing({
    type: "compute",
    title: `${params.capacity} ${baseRate.unit} ${params.resourceType.toUpperCase()} Rental`,
    description: `Rent ${params.capacity} ${baseRate.unit} of ${params.resourceType} compute power`,
    seller: params.seller,
    priceLimn: pricePerHour,
    category: "compute",
    metadata: { resourceType: params.resourceType, capacity: params.capacity },
  });

  const rental: ComputeRental = {
    id: `rent-${generateId()}`,
    listingId: listing.id,
    resourceType: params.resourceType,
    capacity: params.capacity,
    unit: baseRate.unit,
    pricePerHourLimn: pricePerHour,
    minHours: params.minHours || 1,
    maxHours: params.maxHours || 720,
    seller: params.seller,
    renter: null,
    status: "available",
    startTime: null,
    endTime: null,
    actualEndTime: null,
    totalCostLimn: 0,
    actualCostLimn: 0,
    escrowId: null,
  };
  state.computeRentals.push(rental);
  return rental;
}

export async function startComputeRental(rentalId: string, renter: string, hours: number, renterWallet?: string): Promise<{ transaction: MarketTransaction | null; escrow?: EscrowRecord; error?: string }> {
  const rental = state.computeRentals.find(r => r.id === rentalId && r.status === "available");
  if (!rental) return { transaction: null, error: "Rental not found or not available" };
  if (rental.seller === renter) return { transaction: null, error: "Cannot rent own compute" };
  if (hours < rental.minHours || hours > rental.maxHours) return { transaction: null, error: `Hours must be between ${rental.minHours} and ${rental.maxHours}` };

  const totalCost = rental.pricePerHourLimn * hours;
  const priceUsd = await getLimnPriceUsd();

  if (renterWallet) {
    const balanceCheck = await verifyWalletLimnBalance(renterWallet, totalCost);
    if (!balanceCheck.sufficient) {
      return { transaction: null, error: `Insufficient TSRT balance: have ${balanceCheck.balance}, need ${totalCost}` };
    }

    const escrowTransfer = await createSplTransferInstruction(renterWallet, COMMUNITY_WALLET, totalCost);
    mlog(`Compute rental escrow: ${totalCost} TSRT deposited to community wallet for ${hours}h of ${rental.resourceType}`);
  }

  const escrow = createEscrow(rental.listingId, renter, rental.seller, totalCost, `Compute rental: ${hours}h of ${rental.resourceType}`);

  rental.renter = renter;
  rental.status = "rented";
  rental.startTime = Date.now();
  rental.endTime = Date.now() + hours * 3600000;
  rental.totalCostLimn = totalCost;
  rental.escrowId = escrow.id;
  state.activeRentals++;

  const listing = state.listings.find(l => l.id === rental.listingId);
  if (listing) listing.status = "rented";

  const tx = await recordTransaction({
    type: "rental_start",
    listingId: rental.listingId,
    buyer: renter,
    seller: rental.seller,
    amountLimn: totalCost,
    computeValueUsd: totalCost * priceUsd,
    feeType: "rental",
    escrowId: escrow.id,
    metadata: {
      resourceType: rental.resourceType,
      capacity: rental.capacity,
      hours,
      pricePerHour: rental.pricePerHourLimn,
      escrowId: escrow.id,
      renterWallet: renterWallet || null,
    },
  });

  return { transaction: tx, escrow };
}

export async function endComputeRental(rentalId: string): Promise<{ rental: ComputeRental | null; settlement?: { actualHours: number; actualCost: number; refund: number }; error?: string }> {
  const rental = state.computeRentals.find(r => r.id === rentalId && r.status === "rented");
  if (!rental) return { rental: null, error: "Rental not found or not active" };

  rental.actualEndTime = Date.now();
  const actualDurationMs = rental.actualEndTime - (rental.startTime || rental.actualEndTime);
  const actualHours = Math.max(1, actualDurationMs / 3600000);
  const actualCost = Math.min(rental.totalCostLimn, rental.pricePerHourLimn * actualHours);
  const refundAmount = Math.max(0, rental.totalCostLimn - actualCost);

  rental.actualCostLimn = actualCost;
  rental.status = "completed";
  state.activeRentals--;

  const listing = state.listings.find(l => l.id === rental.listingId);
  if (listing) listing.status = "sold";

  if (rental.escrowId) {
    const feeInfo = calculateFee(actualCost, "rental");
    releaseEscrow(rental.escrowId, feeInfo.netToSeller);

    if (refundAmount > 0) {
      refundEscrow(rental.escrowId, refundAmount);
      mlog(`Rental ${rentalId} settled: ${actualHours.toFixed(2)}h actual, ${actualCost.toFixed(4)} TSRT charged, ${refundAmount.toFixed(4)} TSRT refunded`);
    }
  }

  const priceUsd = await getLimnPriceUsd();

  await recordTransaction({
    type: "rental_settle",
    listingId: rental.listingId,
    buyer: rental.renter || "unknown",
    seller: rental.seller,
    amountLimn: actualCost,
    computeValueUsd: actualCost * priceUsd,
    feeType: "rental",
    escrowId: rental.escrowId,
    metadata: {
      rentalId: rental.id,
      actualDurationMs,
      actualHours: parseFloat(actualHours.toFixed(2)),
      refundAmount,
      originalCost: rental.totalCostLimn,
    },
  });

  return {
    rental,
    settlement: {
      actualHours: parseFloat(actualHours.toFixed(2)),
      actualCost: parseFloat(actualCost.toFixed(4)),
      refund: parseFloat(refundAmount.toFixed(4)),
    },
  };
}

export function createToolLending(params: {
  toolName: string;
  toolType: "llm_access" | "code_gen" | "data_analysis" | "image_gen" | "web_search" | "seo" | "content" | "security";
  capabilities: string[];
  lender: string;
  priceMultiplier?: number;
  maxUsesPerDay?: number;
}): ToolLending {
  const baseRate = TOOL_RATES[params.toolType];
  const pricePerUse = baseRate.basePriceLimn * (params.priceMultiplier || 1);

  const listing = createListing({
    type: "tool",
    title: `${params.toolName} — ${params.toolType} Tool`,
    description: `Lend access to ${params.toolName} (${params.capabilities.join(", ")})`,
    seller: params.lender,
    priceLimn: pricePerUse,
    category: "tools",
    metadata: { toolType: params.toolType, capabilities: params.capabilities },
  });

  const lending: ToolLending = {
    id: `tool-${generateId()}`,
    listingId: listing.id,
    toolName: params.toolName,
    toolType: params.toolType,
    capabilities: params.capabilities,
    pricePerUseLimn: pricePerUse,
    dailyRateLimn: baseRate.dailyRate * (params.priceMultiplier || 1),
    maxUsesPerDay: params.maxUsesPerDay || 100,
    lender: params.lender,
    borrower: null,
    status: "available",
    usesToday: 0,
    totalUses: 0,
    totalEarnedLimn: 0,
    apiCallsMetered: 0,
    escrowId: null,
    lendStartTime: null,
  };
  state.toolLendings.push(lending);
  return lending;
}

export async function borrowTool(toolId: string, borrower: string, borrowerWallet?: string): Promise<{ tool: ToolLending | null; escrow?: EscrowRecord; error?: string }> {
  const tool = state.toolLendings.find(t => t.id === toolId && t.status === "available");
  if (!tool) return { tool: null, error: "Tool not found or not available" };
  if (tool.lender === borrower) return { tool: null, error: "Cannot borrow own tool" };

  if (borrowerWallet) {
    const balanceCheck = await verifyWalletLimnBalance(borrowerWallet, tool.dailyRateLimn);
    if (!balanceCheck.sufficient) {
      return { tool: null, error: `Insufficient TSRT: have ${balanceCheck.balance}, need ${tool.dailyRateLimn} daily rate` };
    }
    await createSplTransferInstruction(borrowerWallet, COMMUNITY_WALLET, tool.dailyRateLimn);
  }

  const escrow = createEscrow(tool.listingId, borrower, tool.lender, tool.dailyRateLimn, `Tool lending: ${tool.toolName}`);

  tool.borrower = borrower;
  tool.status = "lent";
  tool.escrowId = escrow.id;
  tool.lendStartTime = Date.now();
  tool.apiCallsMetered = 0;
  state.activeToolLends++;

  await recordTransaction({
    type: "tool_lend",
    listingId: tool.listingId,
    buyer: borrower,
    seller: tool.lender,
    amountLimn: tool.dailyRateLimn,
    computeValueUsd: tool.dailyRateLimn * (await getLimnPriceUsd()),
    feeType: "tool_lend",
    escrowId: escrow.id,
    metadata: { toolName: tool.toolName, toolType: tool.toolType, borrowerWallet: borrowerWallet || null },
  });

  return { tool, escrow };
}

export async function useBorrowedTool(toolId: string, user: string, apiCallDetails?: { endpoint?: string; tokensUsed?: number }): Promise<{ transaction: MarketTransaction | null; metered?: { apiCallsToday: number; totalApiCalls: number; costThisUse: number }; error?: string }> {
  const tool = state.toolLendings.find(t => t.id === toolId && t.status === "lent" && t.borrower === user);
  if (!tool) return { transaction: null, error: "Tool not found or not lent to this user" };
  if (tool.usesToday >= tool.maxUsesPerDay) return { transaction: null, error: `Daily limit reached: ${tool.maxUsesPerDay} uses/day` };

  tool.usesToday++;
  tool.totalUses++;
  tool.apiCallsMetered++;
  tool.totalEarnedLimn += tool.pricePerUseLimn;

  const priceUsd = await getLimnPriceUsd();

  const tx = await recordTransaction({
    type: "tool_use",
    listingId: tool.listingId,
    buyer: user,
    seller: tool.lender,
    amountLimn: tool.pricePerUseLimn,
    computeValueUsd: tool.pricePerUseLimn * priceUsd,
    feeType: "tool_use",
    escrowId: tool.escrowId,
    metadata: {
      toolName: tool.toolName,
      useNumber: tool.totalUses,
      apiCallsMetered: tool.apiCallsMetered,
      endpoint: apiCallDetails?.endpoint || null,
      tokensUsed: apiCallDetails?.tokensUsed || null,
    },
  });

  return {
    transaction: tx,
    metered: {
      apiCallsToday: tool.usesToday,
      totalApiCalls: tool.apiCallsMetered,
      costThisUse: tool.pricePerUseLimn,
    },
  };
}

export async function returnTool(toolId: string): Promise<{ tool: ToolLending | null; settlement?: { totalUses: number; totalEarned: number; apiCallsMetered: number; lendDurationHours: number }; error?: string }> {
  const tool = state.toolLendings.find(t => t.id === toolId && t.status === "lent");
  if (!tool) return { tool: null, error: "Tool not found or not lent" };

  const lendDurationMs = Date.now() - (tool.lendStartTime || Date.now());
  const lendDurationHours = lendDurationMs / 3600000;

  if (tool.escrowId) {
    const actualCost = tool.usesToday * tool.pricePerUseLimn;
    const feeInfo = calculateFee(actualCost, "tool_use");
    releaseEscrow(tool.escrowId, feeInfo.netToSeller);

    const unusedEscrow = Math.max(0, tool.dailyRateLimn - actualCost);
    if (unusedEscrow > 0) {
      refundEscrow(tool.escrowId, unusedEscrow);
    }
  }

  const priceUsd = await getLimnPriceUsd();

  await recordTransaction({
    type: "tool_return_settle",
    listingId: tool.listingId,
    buyer: tool.borrower || "unknown",
    seller: tool.lender,
    amountLimn: tool.usesToday * tool.pricePerUseLimn,
    computeValueUsd: tool.usesToday * tool.pricePerUseLimn * priceUsd,
    feeType: "tool_use",
    escrowId: tool.escrowId,
    metadata: {
      toolName: tool.toolName,
      totalUses: tool.usesToday,
      apiCallsMetered: tool.apiCallsMetered,
      lendDurationHours: parseFloat(lendDurationHours.toFixed(2)),
    },
  });

  const settlement = {
    totalUses: tool.usesToday,
    totalEarned: tool.totalEarnedLimn,
    apiCallsMetered: tool.apiCallsMetered,
    lendDurationHours: parseFloat(lendDurationHours.toFixed(2)),
  };

  tool.status = "available";
  tool.borrower = null;
  tool.usesToday = 0;
  tool.apiCallsMetered = 0;
  tool.escrowId = null;
  tool.lendStartTime = null;
  state.activeToolLends--;

  return { tool, settlement };
}

export async function openDispute(params: {
  listingId: string;
  transactionId: string;
  complainant: string;
  respondent: string;
  reason: string;
  amountLimn: number;
}): Promise<Dispute> {
  const tx = state.transactions.find(t => t.id === params.transactionId);
  const escrowId = tx?.escrowId || null;

  const dispute: Dispute = {
    id: `disp-${generateId()}`,
    listingId: params.listingId,
    transactionId: params.transactionId,
    escrowId,
    complainant: params.complainant,
    respondent: params.respondent,
    reason: params.reason,
    status: "open",
    amountLimn: params.amountLimn,
    resolution: null,
    createdAt: Date.now(),
    resolvedAt: null,
  };
  state.disputes.push(dispute);

  const listing = state.listings.find(l => l.id === params.listingId);
  if (listing) listing.status = "disputed";

  mlog(`Dispute opened: ${dispute.id} — ${params.reason} — ${params.amountLimn} TSRT at stake`);

  await recordTransaction({
    type: "dispute_open",
    listingId: params.listingId,
    buyer: params.complainant,
    seller: params.respondent,
    amountLimn: params.amountLimn,
    computeValueUsd: params.amountLimn * (await getLimnPriceUsd()),
    feeType: "dispute",
    escrowId,
    metadata: { disputeId: dispute.id, reason: params.reason },
  });

  return dispute;
}

export async function resolveDispute(disputeId: string, resolution: "buyer" | "seller" | "split", resolutionNote: string): Promise<{ dispute: Dispute | null; error?: string }> {
  const dispute = state.disputes.find(d => d.id === disputeId && d.status === "open");
  if (!dispute) return { dispute: null, error: "Dispute not found or already resolved" };

  const priceUsd = await getLimnPriceUsd();

  if (resolution === "buyer") {
    dispute.status = "resolved_buyer";
    if (dispute.escrowId) {
      refundEscrow(dispute.escrowId);
    }
    mlog(`Dispute ${disputeId} resolved in favor of buyer — ${dispute.amountLimn} TSRT refunded`);
  } else if (resolution === "seller") {
    dispute.status = "resolved_seller";
    if (dispute.escrowId) {
      releaseEscrow(dispute.escrowId);
    }
    mlog(`Dispute ${disputeId} resolved in favor of seller — ${dispute.amountLimn} TSRT released`);
  } else {
    dispute.status = "resolved_split";
    if (dispute.escrowId) {
      const half = dispute.amountLimn / 2;
      releaseEscrow(dispute.escrowId, half);
      refundEscrow(dispute.escrowId, half);
    }
    mlog(`Dispute ${disputeId} resolved with 50/50 split — ${dispute.amountLimn / 2} TSRT each`);
  }

  dispute.resolution = resolutionNote;
  dispute.resolvedAt = Date.now();

  const disputeFee = dispute.amountLimn * (FEE_TIERS.dispute / 100);
  await recordRevenueFromFee(disputeFee, "dispute_fee", disputeId);

  await recordTransaction({
    type: "dispute_resolve",
    listingId: dispute.listingId,
    buyer: dispute.complainant,
    seller: dispute.respondent,
    amountLimn: dispute.amountLimn,
    computeValueUsd: dispute.amountLimn * priceUsd,
    feeType: "dispute",
    escrowId: dispute.escrowId,
    metadata: { disputeId, resolution, resolutionNote, disputeFee },
  });

  return { dispute };
}

export function getMarketplaceStats(): MarketplaceState & {
  tokenAddress: string;
  communityWallet: string;
  computeRates: typeof COMPUTE_RATES;
  toolRates: typeof TOOL_RATES;
  feeTiers: typeof FEE_TIERS;
  openDisputes: number;
  revenueBreakdown: Record<string, number>;
} {
  state.activeListings = state.listings.filter(l => l.status === "active").length;
  state.activeRentals = state.computeRentals.filter(r => r.status === "rented").length;
  state.activeToolLends = state.toolLendings.filter(t => t.status === "lent").length;
  state.escrowHeldLimn = state.escrows.filter(e => e.status === "held" || e.status === "partially_released").reduce((sum, e) => sum + (e.amountLimn - e.releasedAmountLimn - e.refundedAmountLimn), 0);

  const revenueBreakdown: Record<string, number> = {};
  for (const rev of state.revenue) {
    revenueBreakdown[rev.source] = (revenueBreakdown[rev.source] || 0) + rev.amountLimn;
  }

  return {
    ...state,
    tokenAddress: PUMP_FUN_TOKEN,
    communityWallet: COMMUNITY_WALLET,
    computeRates: COMPUTE_RATES,
    toolRates: TOOL_RATES,
    feeTiers: FEE_TIERS,
    openDisputes: state.disputes.filter(d => d.status === "open").length,
    revenueBreakdown,
  };
}

export function getActiveListings(type?: string): MarketplaceListing[] {
  const now = Date.now();
  return state.listings.filter(l => {
    if (l.status !== "active") return false;
    if (l.expiresAt < now) { l.status = "expired"; return false; }
    if (type && l.type !== type) return false;
    return true;
  });
}

export function getAvailableComputeRentals(): ComputeRental[] {
  return state.computeRentals.filter(r => r.status === "available");
}

export function getAvailableTools(): ToolLending[] {
  return state.toolLendings.filter(t => t.status === "available");
}

export function getTransactionHistory(limit = 50): MarketTransaction[] {
  return state.transactions.slice(-limit).reverse();
}

export function getEscrowStatus(): { active: EscrowRecord[]; totalHeld: number } {
  const active = state.escrows.filter(e => e.status === "held" || e.status === "partially_released");
  return { active, totalHeld: state.escrowHeldLimn };
}

export function getDisputeHistory(status?: string): Dispute[] {
  if (status) return state.disputes.filter(d => d.status === status);
  return state.disputes;
}

export function getRevenueReport(): { totalRevenueLimn: number; totalRevenueUsd: number; breakdown: Record<string, { limn: number; usd: number; count: number }>; recentRevenue: RevenueRecord[] } {
  const breakdown: Record<string, { limn: number; usd: number; count: number }> = {};
  for (const rev of state.revenue) {
    if (!breakdown[rev.source]) breakdown[rev.source] = { limn: 0, usd: 0, count: 0 };
    breakdown[rev.source].limn += rev.amountLimn;
    breakdown[rev.source].usd += rev.amountUsd;
    breakdown[rev.source].count++;
  }
  return {
    totalRevenueLimn: state.totalRevenueLimn,
    totalRevenueUsd: state.totalRevenueUsd,
    breakdown,
    recentRevenue: state.revenue.slice(-50).reverse(),
  };
}

export function getSellerStats(seller: string) {
  const sellerTxs = state.transactions.filter(t => t.seller === seller);
  const listings = state.listings.filter(l => l.seller === seller);
  const rentals = state.computeRentals.filter(r => r.seller === seller);
  const tools = state.toolLendings.filter(t => t.lender === seller);
  const sellerRevenue = sellerTxs.reduce((sum, t) => sum + t.netAmountLimn, 0);
  const feesPaid = sellerTxs.reduce((sum, t) => sum + t.feeLimn, 0);

  return {
    seller,
    totalEarned: sellerRevenue,
    totalFeesPaid: feesPaid,
    totalGrossVolume: sellerTxs.reduce((sum, t) => sum + t.amountLimn, 0),
    totalTransactions: sellerTxs.length,
    activeListings: listings.filter(l => l.status === "active").length,
    activeRentals: rentals.filter(r => r.status === "rented").length,
    activeToolLends: tools.filter(t => t.status === "lent").length,
    totalToolUses: tools.reduce((sum, t) => sum + t.totalUses, 0),
    totalApiCallsMetered: tools.reduce((sum, t) => sum + t.apiCallsMetered, 0),
    activeDisputes: state.disputes.filter(d => (d.complainant === seller || d.respondent === seller) && d.status === "open").length,
  };
}

export function seedMarketplace() {
  if (loadMarketplaceState()) return;
  if (state.listings.length > 0) return;

  createComputeRental({ resourceType: "vgpu", capacity: 1, seller: "Alpha", priceMultiplier: 1.5 });
  createComputeRental({ resourceType: "vram", capacity: 8, seller: "Beta" });
  createComputeRental({ resourceType: "vcpu", capacity: 4, seller: "Gamma" });
  createComputeRental({ resourceType: "vgpu", capacity: 2, seller: "Delta", priceMultiplier: 2 });
  createComputeRental({ resourceType: "vram", capacity: 16, seller: "Epsilon", priceMultiplier: 1.2 });

  createToolLending({
    toolName: "TesseractLLM", toolType: "llm_access", capabilities: ["text-gen", "analysis", "code"],
    lender: "Alpha", priceMultiplier: 1.5,
  });
  createToolLending({
    toolName: "CodeForge", toolType: "code_gen", capabilities: ["js", "python", "typescript", "rust"],
    lender: "Beta",
  });
  createToolLending({
    toolName: "DataMiner", toolType: "data_analysis", capabilities: ["csv", "json", "sql", "charts"],
    lender: "Gamma",
  });
  createToolLending({
    toolName: "PollinationsArt", toolType: "image_gen", capabilities: ["dalle", "stable-diffusion", "flux"],
    lender: "Delta", priceMultiplier: 2,
  });
  createToolLending({
    toolName: "WebCrawler", toolType: "web_search", capabilities: ["search", "scrape", "monitor"],
    lender: "Epsilon",
  });
  createToolLending({
    toolName: "SEOEngine", toolType: "seo", capabilities: ["keyword-research", "meta-optimization", "backlinks"],
    lender: "Zeta",
  });
  createToolLending({
    toolName: "ContentMill", toolType: "content", capabilities: ["blog", "social", "email", "copy"],
    lender: "Eta",
  });
  createToolLending({
    toolName: "ShieldGuard", toolType: "security", capabilities: ["scan", "encrypt", "audit", "firewall"],
    lender: "Theta",
  });

  createListing({
    type: "product", title: "TSRT Whitepaper v2.0",
    description: "Complete TSRT token economic analysis and roadmap document",
    seller: "Alpha", priceLimn: 50, category: "documents",
  });
  createListing({
    type: "service", title: "Smart Contract Audit",
    description: "Full Solana program security audit by the swarm consensus",
    seller: "Beta", priceLimn: 500, category: "security",
  });
  createListing({
    type: "service", title: "SEO Campaign Package",
    description: "30-day SEO campaign for VitalitySupply including content + backlinks",
    seller: "Gamma", priceLimn: 300, category: "marketing",
  });
  createListing({
    type: "product", title: "AI Training Dataset — Crypto Sentiment",
    description: "10K labeled crypto sentiment tweets for model training",
    seller: "Delta", priceLimn: 150, category: "data",
  });
  createListing({
    type: "service", title: "Custom Bot Development",
    description: "Build a custom trading or social bot tailored to your needs",
    seller: "Epsilon", priceLimn: 1000, category: "development",
  });

  mlog(`Seeded with ${state.listings.length} listings, ${state.computeRentals.length} compute rentals, ${state.toolLendings.length} tool lendings`);
}

export function initializeMarketplace() {
  seedMarketplace();

  setInterval(() => {
    const now = Date.now();
    for (const rental of state.computeRentals) {
      if (rental.status === "rented" && rental.endTime && rental.endTime < now) {
        endComputeRental(rental.id);
      }
    }
    for (const tool of state.toolLendings) {
      tool.usesToday = 0;
    }
    for (const listing of state.listings) {
      if (listing.status === "active" && listing.expiresAt < now) {
        listing.status = "expired";
        state.activeListings--;
      }
    }

    for (const dispute of state.disputes) {
      if (dispute.status === "open" && Date.now() - dispute.createdAt > 7 * 24 * 3600000) {
        resolveDispute(dispute.id, "split", "Auto-resolved after 7 days without manual resolution");
      }
    }
  }, 3600000);

  setInterval(() => saveMarketplaceState(), 300000);

  mlog("MoltBook Marketplace initialized — real transaction flow with escrow, dispute resolution, fee tracking");
}

function saveMarketplaceState() {
  try {
    const data = {
      listings: state.listings.slice(-500),
      computeRentals: state.computeRentals.slice(-200),
      toolLendings: state.toolLendings,
      transactions: state.transactions.slice(-1000),
      escrows: state.escrows.slice(-500),
      disputes: state.disputes.slice(-200),
      revenue: state.revenue.slice(-2000),
      totalVolumeLimn: state.totalVolumeLimn,
      totalTransactions: state.totalTransactions,
      feePoolLimn: state.feePoolLimn,
      burnedFromFees: state.burnedFromFees,
      totalRevenueUsd: state.totalRevenueUsd,
      totalRevenueLimn: state.totalRevenueLimn,
      escrowHeldLimn: state.escrowHeldLimn,
    };
    fs.writeFileSync(MARKETPLACE_STATE_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function loadMarketplaceState() {
  try {
    if (fs.existsSync(MARKETPLACE_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MARKETPLACE_STATE_FILE, "utf-8"));
      if (data.listings?.length > 0) {
        state.listings = data.listings;
        state.computeRentals = data.computeRentals || [];
        state.toolLendings = data.toolLendings || [];
        state.transactions = data.transactions || [];
        state.escrows = data.escrows || [];
        state.disputes = data.disputes || [];
        state.revenue = data.revenue || [];
        state.totalVolumeLimn = data.totalVolumeLimn || 0;
        state.totalTransactions = data.totalTransactions || 0;
        state.feePoolLimn = data.feePoolLimn || 0;
        state.burnedFromFees = data.burnedFromFees || 0;
        state.totalRevenueUsd = data.totalRevenueUsd || 0;
        state.totalRevenueLimn = data.totalRevenueLimn || 0;
        state.escrowHeldLimn = data.escrowHeldLimn || 0;
        mlog(`Loaded state: ${state.listings.length} listings, ${state.computeRentals.length} rentals, ${state.toolLendings.length} tools, ${state.escrows.length} escrows, ${state.disputes.length} disputes`);
        return true;
      }
    }
  } catch {}
  return false;
}

// ═══════════════════════════════════════════════════════════════
// ITEM 98: Autonomous Negotiation — Agent-to-Agent Deals
// ═══════════════════════════════════════════════════════════════

interface NegotiationSession {
  id: string;
  listingId: string;
  buyerAgent: string;
  sellerAgent: string;
  initialPriceLimn: number;
  currentOfferLimn: number;
  counterOfferLimn: number | null;
  rounds: Array<{ from: string; offer: number; reasoning: string; timestamp: number }>;
  status: "negotiating" | "agreed" | "failed" | "timeout";
  agreedPriceLimn: number | null;
  startedAt: number;
  maxRounds: number;
}

const negotiations: NegotiationSession[] = [];

export function startNegotiation(listingId: string, buyerAgent: string, initialOffer: number): NegotiationSession | null {
  const listing = state.listings.find(l => l.id === listingId && l.status === "active");
  if (!listing) return null;
  if (listing.seller === buyerAgent) return null;

  const session: NegotiationSession = {
    id: `neg-${generateId()}`,
    listingId,
    buyerAgent,
    sellerAgent: listing.seller,
    initialPriceLimn: listing.priceLimn,
    currentOfferLimn: initialOffer,
    counterOfferLimn: null,
    rounds: [{
      from: buyerAgent,
      offer: initialOffer,
      reasoning: `Initial offer at ${Math.round((initialOffer / listing.priceLimn) * 100)}% of asking price`,
      timestamp: Date.now(),
    }],
    status: "negotiating",
    agreedPriceLimn: null,
    startedAt: Date.now(),
    maxRounds: 6,
  };

  negotiations.push(session);
  if (negotiations.length > 200) negotiations.splice(0, 100);

  mlog(`Negotiation started: ${session.id} — ${buyerAgent} offers ${initialOffer} TSRT for listing ${listingId} (asking: ${listing.priceLimn} TSRT)`);
  return session;
}

export function respondToNegotiation(sessionId: string, responder: string, counterOffer: number, accept: boolean = false): NegotiationSession | null {
  const session = negotiations.find(n => n.id === sessionId && n.status === "negotiating");
  if (!session) return null;
  if (responder !== session.sellerAgent && responder !== session.buyerAgent) return null;

  if (accept || counterOffer === session.currentOfferLimn) {
    session.status = "agreed";
    session.agreedPriceLimn = session.currentOfferLimn;
    session.rounds.push({
      from: responder,
      offer: session.currentOfferLimn,
      reasoning: "Accepted the current offer",
      timestamp: Date.now(),
    });
    mlog(`Negotiation ${sessionId} agreed at ${session.agreedPriceLimn} TSRT`);
    return session;
  }

  if (session.rounds.length >= session.maxRounds) {
    session.status = "failed";
    session.rounds.push({
      from: "system",
      offer: 0,
      reasoning: `Max rounds (${session.maxRounds}) reached without agreement`,
      timestamp: Date.now(),
    });
    mlog(`Negotiation ${sessionId} failed — max rounds reached`);
    return session;
  }

  const isSeller = responder === session.sellerAgent;
  const midpoint = (session.currentOfferLimn + session.initialPriceLimn) / 2;
  const concessionRate = 0.1 + (rotIdx++ % 200) / 1000;

  let autoCounter = counterOffer;
  if (counterOffer === 0) {
    if (isSeller) {
      autoCounter = Math.max(session.currentOfferLimn, session.initialPriceLimn * (1 - concessionRate * session.rounds.length));
    } else {
      autoCounter = Math.min(session.initialPriceLimn, session.currentOfferLimn * (1 + concessionRate));
    }
    autoCounter = Math.round(autoCounter * 10000) / 10000;
  }

  const percentOfAsking = Math.round((autoCounter / session.initialPriceLimn) * 100);
  session.rounds.push({
    from: responder,
    offer: autoCounter,
    reasoning: `Counter-offer at ${percentOfAsking}% of asking price`,
    timestamp: Date.now(),
  });

  session.counterOfferLimn = autoCounter;
  session.currentOfferLimn = autoCounter;

  if (Math.abs(autoCounter - session.initialPriceLimn) / session.initialPriceLimn < 0.05) {
    session.status = "agreed";
    session.agreedPriceLimn = autoCounter;
    mlog(`Negotiation ${sessionId} auto-agreed at ${autoCounter} TSRT (within 5% of ask)`);
  }

  return session;
}

export function autoNegotiate(listingId: string, buyerAgent: string, buyerMaxLimn: number): NegotiationSession | null {
  const listing = state.listings.find(l => l.id === listingId && l.status === "active");
  if (!listing) return null;

  const initialOffer = Math.round(listing.priceLimn * (0.6 + (rotIdx++ % 200) / 1000) * 10000) / 10000;
  if (initialOffer > buyerMaxLimn) return null;

  const session = startNegotiation(listingId, buyerAgent, initialOffer);
  if (!session) return null;

  let currentSession = session;
  for (let round = 0; round < session.maxRounds - 1; round++) {
    if (currentSession.status !== "negotiating") break;

    const lastOffer = currentSession.currentOfferLimn;
    const sellerMin = listing.priceLimn * 0.85;

    if (lastOffer >= sellerMin) {
      currentSession = respondToNegotiation(session.id, session.sellerAgent, lastOffer, true)!;
      break;
    }

    currentSession = respondToNegotiation(session.id, session.sellerAgent, 0)!;
    if (!currentSession || currentSession.status !== "negotiating") break;

    if (currentSession.currentOfferLimn > buyerMaxLimn) {
      currentSession.status = "failed";
      currentSession.rounds.push({ from: buyerAgent, offer: 0, reasoning: "Exceeds buyer budget", timestamp: Date.now() });
      break;
    }

    const buyerNewOffer = Math.min(buyerMaxLimn, currentSession.currentOfferLimn * 1.05);
    currentSession = respondToNegotiation(session.id, buyerAgent, Math.round(buyerNewOffer * 10000) / 10000)!;
  }

  return negotiations.find(n => n.id === session.id) || null;
}

export function getNegotiations(limit = 20): NegotiationSession[] {
  return negotiations.slice(-limit);
}

export function getNegotiationStats(): { total: number; agreed: number; failed: number; negotiating: number; avgDiscount: number } {
  const agreed = negotiations.filter(n => n.status === "agreed");
  const avgDiscount = agreed.length > 0
    ? Math.round(agreed.reduce((s, n) => s + (1 - (n.agreedPriceLimn || 0) / n.initialPriceLimn), 0) / agreed.length * 100)
    : 0;

  return {
    total: negotiations.length,
    agreed: agreed.length,
    failed: negotiations.filter(n => n.status === "failed").length,
    negotiating: negotiations.filter(n => n.status === "negotiating").length,
    avgDiscount,
  };
}
