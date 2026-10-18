import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [...nextVitals, ...nextTypescript, // Existing effects/ref patterns are reported during migration; React Compiler is not enabled.
// Preserve all existing Hooks/Next/TypeScript errors while tracking these new diagnostics.
{ rules: { "react-hooks/set-state-in-effect": "warn", "react-hooks/refs": "warn" } }, { ignores: [".next-hardening*/**"] }];
