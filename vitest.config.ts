import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: "./tests/setup.ts",
		include: ["tests/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/components/**/*.tsx"],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100,
			},
		},
	},
});
