import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ mode }) => ({
	worker: {
		name: mode === "preview" ? "peach-demo-folder-preview" : "peach-demo",
		workersDev: mode === "preview" ? true : undefined,
		compatibilityDate: "2026-09-20",
		entrypoint: "src/worker.ts",
		observability: {
			enabled: true,
			issues: {enabled: true},
		},
		assets: {
			notFoundHandling: "none",
			runWorkerFirst: [
				"/api/*", "/healthz", "/stream", "/login", "/setup",
				"/_fixtures", "/_fixtures/*", "/_media", "/_media/*",
				"/thumb", "/poster", "/cover", "/timeline", "/avatar", "/entity-image", "/logo",
				"/link-mark", "/site-mark", "/source-icon", "/work-icon", "/follow-avatar", "/follow-stream", "/follow-cover",
				"/follow-qualities", "/photo", "/photo-thumb", "/sample-thumb", "/sample-image", "/endcard-frame", "/avatar-choice",
			],
		},
		domains: mode === "preview" ? [] : ["demo.peach.video"],
		env: {
			ASSETS: bindings.assets(),
		},
	},
}));
