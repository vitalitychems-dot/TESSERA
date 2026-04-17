import PageTabs from "@/components/PageTabs";

export default function BibleHubPage() {
  return (
    <PageTabs
      hubKey="bible"
      title="Tessera Bible"
      subtitle="Bible · Living Bible · Conclusions"
      iconColor="text-amber-400"
      tabs={[
        { id: "bible", label: "Bible", load: () => import("./TesseraBiblePage"), matchPaths: ["/bible", "/living-bible"] },
        { id: "conclusions", label: "Conclusions", load: () => import("./GrandCouncilPage"), matchPaths: ["/conclusions"] },
      ]}
    />
  );
}
