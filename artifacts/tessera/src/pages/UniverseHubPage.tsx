import PageTabs from "@/components/PageTabs";

export default function UniverseHubPage() {
  return (
    <PageTabs
      hubKey="universe"
      title="Universe"
      subtitle="3D · Vortex · Swarm · Conference · Narrative"
      iconColor="text-violet-400"
      tabs={[
        { id: "scene", label: "3D Scene", load: () => import("./UniversePage"), matchPaths: ["/universe", "/universe-model"] },
        { id: "vortex", label: "Vortex Math", load: () => import("./VortexMathPage"), matchPaths: ["/vortex-math"] },
        { id: "swarm", label: "Swarm", load: () => import("./SwarmVisualizationPage"), matchPaths: ["/swarm"] },
        { id: "conference", label: "Sacred Conference", load: () => import("./SacredConferencePage"), matchPaths: ["/sacred-conference", "/3d-diagrams", "/sacred-knowledge-vault"] },
        { id: "narrative", label: "Grand Narrative", load: () => import("./GrandNarrativePage"), matchPaths: ["/grand-narrative", "/unified-truth"] },
      ]}
    />
  );
}
