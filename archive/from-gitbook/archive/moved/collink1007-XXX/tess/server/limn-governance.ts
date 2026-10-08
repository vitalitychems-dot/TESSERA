export const TSRT_EXCHANGE_RULES = {
  xmrToLimn: 1,
  tsrtPrice: 0.0000004129,
  minDeposit: 0.001,
  conversionFee: 0.02,
  burnSplit: 0.01,
  treasurySplit: 0.01,
  distributionWindow: 24,
  onChain: true,
};

export const SATELLITE_NODE_REWARDS = {
  baseTsrtPerDay: 15,
  minUptime: 0.95,
  vgpuBonusPerHour: 5,
  governanceVotingRights: true,
  reinforcesSovereignCompute: true,
};

export const REVENUE_GOVERNANCE = {
  fatherShare: 0.30,
  stakingPool: 0.40,
  communityTreasury: 0.20,
  limnBurn: 0.10,
  divisions: {
    moltbook: "community & external relations",
    tesseract: "AI execution & self-improvement",
  },
};

export function applyRevenueGovernance(totalRevenue: number) {
  return {
    father: totalRevenue * REVENUE_GOVERNANCE.fatherShare,
    staking: totalRevenue * REVENUE_GOVERNANCE.stakingPool,
    treasury: totalRevenue * REVENUE_GOVERNANCE.communityTreasury,
    burn: totalRevenue * REVENUE_GOVERNANCE.limnBurn,
    total: totalRevenue,
  };
}

export function calculateNodeReward(uptimePercent: number, vramHours: number) {
  const base = uptimePercent >= SATELLITE_NODE_REWARDS.minUptime
    ? SATELLITE_NODE_REWARDS.baseTsrtPerDay
    : SATELLITE_NODE_REWARDS.baseTsrtPerDay * (uptimePercent / SATELLITE_NODE_REWARDS.minUptime);
  const vgpuBonus = vramHours * SATELLITE_NODE_REWARDS.vgpuBonusPerHour;
  return { base, vgpuBonus, total: base + vgpuBonus };
}

export function calculateExchangeConversion(xmrAmount: number, tsrtPriceUsd: number) {
  if (xmrAmount < TSRT_EXCHANGE_RULES.minDeposit) {
    return { error: `Minimum deposit is ${TSRT_EXCHANGE_RULES.minDeposit} XMR`, tsrtAmount: 0, fee: 0 };
  }
  const xmrPriceUsd = 200;
  const xmrValueUsd = xmrAmount * xmrPriceUsd;
  const fee = xmrValueUsd * TSRT_EXCHANGE_RULES.conversionFee;
  const netUsd = xmrValueUsd - fee;
  const tsrtAmount = netUsd / (tsrtPriceUsd || TSRT_EXCHANGE_RULES.tsrtPrice);
  return {
    xmrAmount,
    xmrValueUsd,
    fee,
    burnAmount: fee * 0.5,
    treasuryAmount: fee * 0.5,
    netUsd,
    tsrtAmount,
    tsrtPriceUsd: tsrtPriceUsd || TSRT_EXCHANGE_RULES.tsrtPrice,
  };
}

console.log("[TSRTGovernance] Exchange Rules loaded: min deposit " + TSRT_EXCHANGE_RULES.minDeposit + " XMR, " + (TSRT_EXCHANGE_RULES.conversionFee * 100) + "% fee");
console.log("[TSRTGovernance] Satellite Rewards: " + SATELLITE_NODE_REWARDS.baseTsrtPerDay + " TSRT/day, " + (SATELLITE_NODE_REWARDS.minUptime * 100) + "% uptime req");
console.log("[TSRTGovernance] Revenue: Father " + (REVENUE_GOVERNANCE.fatherShare * 100) + "%, Staking " + (REVENUE_GOVERNANCE.stakingPool * 100) + "%, Treasury " + (REVENUE_GOVERNANCE.communityTreasury * 100) + "%, Burn " + (REVENUE_GOVERNANCE.limnBurn * 100) + "%");
