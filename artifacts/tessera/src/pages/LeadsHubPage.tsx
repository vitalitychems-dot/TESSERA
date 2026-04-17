import PageTabs from "@/components/PageTabs";

export default function LeadsHubPage() {
  return (
    <PageTabs
      hubKey="leads"
      title="Leads · Access · Services"
      subtitle="Lead Gen · Affiliate · API Access · Local · Ideas · SEO"
      iconColor="text-amber-400"
      tabs={[
        { id: "leads", label: "Lead Gen", load: () => import("./LeadGenPage"), matchPaths: ["/lead-gen"] },
        { id: "affiliate", label: "Affiliate & API Access", load: () => import("./AffiliateMarketingPage"), matchPaths: ["/affiliate", "/api-marketplace"] },
        { id: "local", label: "Local Services", load: () => import("./LocalServicesPage"), matchPaths: ["/local-services"] },
        { id: "ideas", label: "Business Ideas", load: () => import("./BusinessIdeasPage"), matchPaths: ["/business-ideas"] },
        { id: "seo", label: "SEO Research", load: () => import("./SEOResearchPage"), matchPaths: ["/seo"] },
      ]}
    />
  );
}
