import { defineConfig } from "@playwright/test";
import base from "./user-options.playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["auth-whitespace.spec.ts"],
  outputDir:
    "../../../../evaluation/remediation-20261008/auth-ui-6/whitespace-regression/browser-results",
});
