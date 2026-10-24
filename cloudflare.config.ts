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
			// 页面、回放快照、图片和视频统一执行连接 IP 的地区限制。
			runWorkerFirst: true,
		},
		domains: mode === "preview" ? [] : ["demo.peach.video"],
		env: {
			ASSETS: bindings.assets(),
			REGION_DATA: bindings.r2({name: "peach-region-data"}),
		},
	},
}));
