import PageTabs from "@/components/PageTabs";

export default function NFTHubPage() {
  return (
    <PageTabs
      hubKey="nft"
      title="Agent NFTs"
      subtitle="Members · Profiles · Wallets · Conference roles"
      iconColor="text-rose-400"
      tabs={[
        { id: "members", label: "Members & Profiles", load: () => import("./MembersPage"), matchPaths: ["/agent-nft", "/members", "/agent-profile"] },
        { id: "wallets", label: "Token Wallets", load: () => import("./TokenEconomyPage"), matchPaths: ["/wallet-dashboard", "/token-economy", "/economy-hub", "/tokens"] },
      ]}
    />
  );
}
