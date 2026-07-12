import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

// eslint-config-next still ships its shareable configs in the legacy
// eslintrc object shape ({ extends: [...] }), not flat-config arrays —
// FlatCompat bridges that into this file's flat config, which is the
// standard create-next-app pattern for this eslint-config-next version.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
