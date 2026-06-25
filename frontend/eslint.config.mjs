// @ts-check
import tseslint from "typescript-eslint";
import angular from "@angular-eslint/eslint-plugin";
import angularTemplate from "@angular-eslint/eslint-plugin-template";
import angularTemplateParser from "@angular-eslint/template-parser";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "src/assets/**", "*.config.*"],
  },

  // ── TypeScript source files ─────────────────────────────────────────────
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommended],
    plugins: {
      "@angular-eslint": angular,
    },
    languageOptions: {
      parserOptions: {
        project: ["tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript hygiene
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

      // Angular conventions
      "@angular-eslint/component-class-suffix": "error",
      "@angular-eslint/directive-class-suffix": "error",
      "@angular-eslint/no-input-rename": "warn",
      "@angular-eslint/no-output-rename": "warn",
      "@angular-eslint/use-lifecycle-interface": "warn",
      "@angular-eslint/no-empty-lifecycle-method": "warn",

      // Compliance: nessun accesso DIRETTO al Web Storage. Tutto deve passare dall'API gated dal
      // consenso (CookieConsentService.set/get/remove), così la persistenza è sempre categorizzata,
      // censita in policy e pulita alla revoca. Eccezioni gestite sotto (service + auth infra).
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Usa CookieConsentService.set/get/remove (gated dal consenso + censito in policy)." },
        { name: "sessionStorage", message: "Usa CookieConsentService.set/get/remove (gated dal consenso + censito in policy)." },
      ],
    },
  },

  // ── Angular HTML templates ────────────────────────────────────────────────
  {
    files: ["**/*.html"],
    plugins: {
      "@angular-eslint/template": angularTemplate,
    },
    languageOptions: {
      parser: angularTemplateParser,
    },
    rules: {
      // Accessibility — errors (WCAG non-negotiable)
      "@angular-eslint/template/alt-text": "error",
      "@angular-eslint/template/elements-content": "error",
      "@angular-eslint/template/label-has-associated-control": "error",
      "@angular-eslint/template/no-distracting-elements": "error",
      "@angular-eslint/template/role-has-required-aria": "error",
      "@angular-eslint/template/valid-aria": "error",
      "@angular-eslint/template/table-scope": "error",

      // Accessibility — warnings (require case-by-case evaluation)
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
      "@angular-eslint/template/mouse-events-have-key-events": "warn",
      "@angular-eslint/template/no-autofocus": "warn",
    },
  },

  // ── Eccezioni alla guardia Web Storage ────────────────────────────────────
  // Solo il dispatcher del consenso e l'infrastruttura di autenticazione (modulo foglia) possono
  // toccare lo storage grezzo; tutto il resto passa dall'API gated.
  {
    files: [
      "**/core/engine/services/cookie-consent.service.ts",
      "**/core/engine/services/token.service.ts",
    ],
    rules: { "no-restricted-globals": "off" },
  }
);
