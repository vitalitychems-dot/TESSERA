export const SITE_URL = "https://vitalitysupply.org";
export const SITE_NAME = "Vitality Supply";

export function seoHead(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
}) {
  const url = `${SITE_URL}${opts.path.startsWith("/") ? opts.path : `/${opts.path}`}`;
  const title = opts.title.includes("Vitality") ? opts.title : `${opts.title} · ${SITE_NAME}`;
  const image = opts.image ?? `${SITE_URL}/og.jpg`;
  return {
    meta: [
      { title },
      { name: "description", content: opts.description },
      { property: "og:title", content: title },
      { property: "og:description", content: opts.description },
      { property: "og:url", content: url },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:image", content: image },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: opts.description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}