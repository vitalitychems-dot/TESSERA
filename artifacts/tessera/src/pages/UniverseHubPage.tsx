import PageTabs from "@/components/PageTabs";

export default function UniverseHubPage() {
  return (
    <PageTabs
      hubKey="universe"
      title="Universe"
      subtitle="3D · Vortex · Swarm · Conference · Narrative"
      iconColor="text-violet-400"
      tabs={[
        { id: "unified", label: "Unified Scene", load: () => import("./UniverseUnifiedScene"), matchPaths: ["/universe", "/universe-model"] },
        { id: "vortex", label: "Vortex Layer", load: () => import("./VortexMathPage"), matchPaths: ["/vortex-math"] },
        { id: "swarm", label: "Swarm Layer", load: () => import("./SwarmVisualizationPage"), matchPaths: ["/swarm"] },
        { id: "conference", label: "Conference Layer", load: () => import("./SacredConferencePage"), matchPaths: ["/sacred-conference", "/3d-diagrams", "/sacred-knowledge-vault"] },
      ]}
    />
  );
}
