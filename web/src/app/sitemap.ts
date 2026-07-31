import type { MetadataRoute } from "next";

const SITE_URL = "https://cochart.app";

// Prerender to a static file at build time (required under `output: 'export'`).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: `${SITE_URL}/`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
	];
}
