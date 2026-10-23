import { defineWranglerConfig } from "wrangler/experimental-config";

export default defineWranglerConfig({
	assetsDirectory: "./public",
	dev: {ip: "127.0.0.1", port: Number(process.env.PEACH_DEMO_PREVIEW_PORT || 8791)},
});
