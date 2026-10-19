import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ mode }) => ({
	worker: {
		name: mode === "preview" ? "peach-demo-folder-preview" : "peach-demo",
		workersDev: mode === "preview" ? true : undefined,
		compatibilityDate: "2026-09-20",
		entrypoint: "src/worker.js",
		observability: {
			enabled: true,
		},
		assets: {
			notFoundHandling: "single-page-application",
			runWorkerFirst: [
				"/*",
				"!/favicon.ico",
				"!/favicon-32x32.png",
				"!/peach-logo.png",
				"!/app.js",
				"!/app.css",
				"!/board.css",
				"!/dist/*",
				"!/js/*",
				"!/vendor/*",
				"!/site-icon/*",
				"!/_demo/*",
			],
		},
		domains: mode === "preview" ? [] : ["demo.peach.video"],
		env: {
			ASSETS: bindings.assets(),
			MEDIA: bindings.r2({ name: "peach-public-media" }),
		},
	},
}));
