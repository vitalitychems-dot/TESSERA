import PageTabs from "@/components/PageTabs";

export default function NFTHubPage() {
  return (
    <PageTabs
      hubKey="nft"
      title="Agent NFTs"
      subtitle="Members · Profiles · Wallets · Conference roles"
      iconColor="text-rose-400"
      tabs={[
        { id: "profile", label: "Unified Directory", load: () => import("./AgentDirectoryPage"), matchPaths: ["/agent-nft", "/agent-profile", "/agent-comms"] },
        { id: "members", label: "Member Roster", load: () => import("./MembersPage"), matchPaths: ["/members"] },
        { id: "wallets", label: "Wallets & Tokens", load: () => import("./TokenEconomyPage"), matchPaths: ["/wallet-dashboard", "/token-economy", "/economy-hub", "/tokens"] },
      ]}
    />
  );
}
