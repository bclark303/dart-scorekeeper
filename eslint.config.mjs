import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Provider SDKs and ORM queries are implementation details of lib/db.
    // Keeping this rule outside lib/db prevents accidental coupling while the
    // persistence surface is still small enough to enforce cleanly.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["lib/db/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@libsql/client",
              message: "Use the public lib/db persistence boundary instead.",
            },
            {
              name: "drizzle-orm",
              message: "Database queries belong under lib/db.",
            },
          ],
          patterns: [
            {
              group: ["drizzle-orm/*", "@libsql/client/*"],
              message: "Provider/ORM imports belong under lib/db only.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
