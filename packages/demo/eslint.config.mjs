import nextVitals from "eslint-config-next/core-web-vitals";

export default [...nextVitals, {
  rules: { "react-hooks/set-state-in-effect": "warn", "react-hooks/refs": "warn", "@next/next/no-html-link-for-pages": "off", "@next/next/no-img-element": "off" },
}];
