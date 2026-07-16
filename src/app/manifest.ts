import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "CoChart — Collaborative Financial Charting",
		short_name: "CoChart",
		description:
			"A free, open-source tool for real-time collaborative market charting.",
		start_url: "/",
		display: "standalone",
		background_color: "#0a0a0a",
		theme_color: "#0a0a0a",
		icons: [
			{
				src: "/favicon.ico",
				sizes: "16x16 32x32 48x48",
				type: "image/x-icon",
			},
		],
	};
}
