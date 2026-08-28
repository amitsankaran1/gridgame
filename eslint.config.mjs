// `next lint` is deprecated and gone in Next 16, and with no config of its own it
// stops to ask an interactive question — which means `npm run lint` hangs a CI
// job rather than failing it. This is the flat config the migration produces.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs"],
    rules: {
      // Both are deliberate command-line tools, not part of the bundle.
      "no-console": "off",
    },
  },
];

export default config;
