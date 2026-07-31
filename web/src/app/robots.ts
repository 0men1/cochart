import type { MetadataRoute } from "next";

const SITE_URL = "https://cochart.app";

// Prerender to a static file at build time (required under `output: 'export'`).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: `${SITE_URL}/sitemap.xml`,
		host: SITE_URL,
	};
}
