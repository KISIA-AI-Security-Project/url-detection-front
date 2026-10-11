import { defineConfig } from "@playwright/test";
import previous from "./user-options.playwright.config";

export default defineConfig(previous, {
  testMatch: ["input-design.spec.ts"],
  outputDir:
    "../../../../evaluation/remediation-20261008/input-design-3/browser-results",
});
