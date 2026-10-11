import { defineConfig } from "@playwright/test";
import base from "./user-options.playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["auth-ui.spec.ts"],
  outputDir:
    "../../../../evaluation/remediation-20261008/auth-ui-7/front/browser-results",
});
