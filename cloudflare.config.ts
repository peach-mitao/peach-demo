import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ mode }) => ({
	worker: {
		name: mode === "preview" ? "peach-demo-folder-preview" : "peach-demo",
		workersDev: mode === "preview",
		compatibilityDate: "2026-09-20",
		entrypoint: "src/worker.ts",
		observability: {
			enabled: true,
			issues: {enabled: true},
			logs: {enabled: true, invocationLogs: false, headSamplingRate: 1},
		},
		assets: {
			notFoundHandling: "none",
			// 地区规则由边缘执行；回放接口仍由 Worker 适配。
			runWorkerFirst: ["/api/*", "/healthz", "/stream", "/login", "/setup", "/thumb", "/poster", "/cover", "/timeline", "/avatar", "/entity-image", "/logo", "/link-mark", "/site-mark", "/source-icon", "/work-icon", "/follow-avatar", "/follow-stream", "/follow-cover", "/follow-qualities", "/photo", "/photo-thumb", "/sample-thumb", "/sample-image", "/endcard-frame", "/avatar-choice", "/unavailable*", "/credits/ip-data", "/_fixtures/*", "/_media/*"],
		},
		domains: mode === "preview" ? [] : ["demo.peach.video"],
		env: {
			ASSETS: bindings.assets(),
		},
	},
}));
