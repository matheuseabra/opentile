import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
	root,
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: "./tests/setup.ts",
		include: ["tests/**/*.test.{ts,tsx}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/components/**/*.tsx", "src/lib/**/*.ts"],
			thresholds: {
				statements: 98,
				branches: 88,
				functions: 98,
				lines: 100,
			},
		},
	},
});
