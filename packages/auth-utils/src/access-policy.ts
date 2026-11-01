export type AccessCapability = "can_view" | "can_create" | "can_edit" | "can_delete";

export interface MenuGrant {
  menu: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CapabilityRequirement {
  menu: string;
  capability: AccessCapability;
}

export type ApiPolicy =
  | { kind: "authenticated" }
  | { kind: "capabilities"; alternatives: CapabilityRequirement[][] };

const capability = (menu: string, action: AccessCapability): CapabilityRequirement => ({ menu, capability: action });
const allow = (...requirements: CapabilityRequirement[]): ApiPolicy => ({ kind: "capabilities", alternatives: requirements.map(item => [item]) });
const all = (...requirements: CapabilityRequirement[]): ApiPolicy => ({ kind: "capabilities", alternatives: [requirements] });
const authenticated: ApiPolicy = { kind: "authenticated" };

function methodMap(entries: Record<string, ApiPolicy>): Record<string, ApiPolicy> {
  return entries;
}

const rules: { pattern: RegExp; methods: Record<string, ApiPolicy> }[] = [
  {
    pattern: /^\/api\/admin\/products$/,
    methods: methodMap({
      GET: allow(capability("products", "can_view"), capability("register", "can_view")),
      POST: allow(capability("products", "can_create")),
      PATCH: allow(capability("products", "can_edit")),
      PUT: allow(capability("products", "can_edit")),
      DELETE: allow(capability("products", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/products\/upload$/,
    methods: methodMap({ POST: allow(capability("products", "can_edit")) }),
  },
  {
    pattern: /^\/api\/admin\/products\/image$/,
    methods: methodMap({ DELETE: allow(capability("products", "can_edit")) }),
  },
  {
    pattern: /^\/api\/admin\/categories$/,
    methods: methodMap({
      POST: allow(capability("products", "can_create")),
      PATCH: allow(capability("products", "can_edit")),
      PUT: allow(capability("products", "can_edit")),
      DELETE: allow(capability("products", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/modifiers$/,
    methods: methodMap({
      GET: allow(capability("products", "can_view"), capability("register", "can_view")),
      POST: allow(capability("products", "can_create")),
      PATCH: allow(capability("products", "can_edit")),
      DELETE: allow(capability("products", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/pricing-options$/,
    methods: methodMap({
      GET: allow(capability("products", "can_view"), capability("register", "can_view")),
      POST: allow(capability("products", "can_create")),
      PATCH: allow(capability("products", "can_edit")),
      DELETE: allow(capability("products", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/pricing-tiers$/,
    methods: methodMap({
      GET: allow(capability("products", "can_view"), capability("register", "can_view")),
      POST: allow(capability("products", "can_create")),
      PATCH: allow(capability("products", "can_edit")),
      PUT: allow(capability("products", "can_edit")),
      DELETE: allow(capability("products", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/product-tier-prices$/,
    methods: methodMap({ POST: allow(capability("products", "can_edit")) }),
  },
  {
    pattern: /^\/api\/admin\/modifier-tier-prices$/,
    methods: methodMap({ POST: allow(capability("products", "can_edit")) }),
  },
  {
    pattern: /^\/api\/admin\/recipes$/,
    methods: methodMap({
      GET: allow(capability("products", "can_view"), capability("ingredients", "can_view")),
      POST: allow(capability("products", "can_create"), capability("ingredients", "can_create")),
      DELETE: allow(capability("products", "can_delete"), capability("ingredients", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/ingredients$/,
    methods: methodMap({
      GET: allow(capability("ingredients", "can_view")),
      POST: allow(capability("ingredients", "can_create")),
      PATCH: allow(capability("ingredients", "can_edit")),
      DELETE: allow(capability("ingredients", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/ingredients\/[^/]+\/adjust$/,
    methods: methodMap({ POST: allow(capability("ingredients", "can_edit")) }),
  },
  {
    pattern: /^\/api\/admin\/purchases$/,
    methods: methodMap({
      GET: allow(capability("purchases", "can_view")),
      POST: allow(capability("purchases", "can_create")),
    }),
  },
  {
    pattern: /^\/api\/admin\/expenses$/,
    methods: methodMap({
      GET: allow(capability("expenses", "can_view")),
      POST: allow(capability("expenses", "can_create")),
      PATCH: allow(capability("expenses", "can_edit")),
      DELETE: allow(capability("expenses", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/taxes$/,
    methods: methodMap({
      GET: allow(capability("tax-discounts", "can_view"), capability("taxes", "can_view")),
      POST: allow(capability("tax-discounts", "can_create"), capability("taxes", "can_create")),
      PATCH: allow(capability("tax-discounts", "can_edit"), capability("taxes", "can_edit")),
      DELETE: allow(capability("tax-discounts", "can_delete"), capability("taxes", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/taxes\/active$/,
    methods: methodMap({
      GET: allow(capability("tax-discounts", "can_view"), capability("taxes", "can_view"), capability("register", "can_view")),
    }),
  },
  {
    pattern: /^\/api\/admin\/discounts$/,
    methods: methodMap({
      GET: allow(capability("tax-discounts", "can_view"), capability("discounts", "can_view")),
      POST: allow(capability("tax-discounts", "can_create"), capability("discounts", "can_create")),
      PATCH: allow(capability("tax-discounts", "can_edit"), capability("discounts", "can_edit")),
      DELETE: allow(capability("tax-discounts", "can_delete"), capability("discounts", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/discounts\/active$/,
    methods: methodMap({
      GET: allow(capability("tax-discounts", "can_view"), capability("discounts", "can_view"), capability("register", "can_view")),
    }),
  },
  {
    pattern: /^\/api\/admin\/tables$/,
    methods: methodMap({
      GET: allow(capability("tables", "can_view"), capability("register", "can_view")),
      POST: allow(capability("tables", "can_create")),
      PATCH: allow(capability("tables", "can_edit"), capability("register", "can_edit")),
      DELETE: allow(capability("tables", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/tables\/generate$/,
    methods: methodMap({ POST: allow(capability("tables", "can_create")) }),
  },
  {
    pattern: /^\/api\/admin\/orders$/,
    methods: methodMap({ POST: allow(capability("register", "can_create")) }),
  },
  {
    pattern: /^\/api\/admin\/orders\/draft$/,
    methods: methodMap({
      GET: allow(capability("register", "can_view"), capability("orders", "can_view")),
      POST: allow(capability("register", "can_create")),
      PATCH: allow(capability("register", "can_edit"), capability("orders", "can_edit")),
      DELETE: allow(capability("register", "can_delete"), capability("orders", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/orders\/split$/,
    methods: methodMap({ POST: allow(capability("register", "can_create")) }),
  },
  {
    pattern: /^\/api\/admin\/orders\/qris$/,
    methods: methodMap({ POST: allow(capability("register", "can_create")) }),
  },
  {
    pattern: /^\/api\/admin\/orders\/qris\/[^/]+$/,
    methods: methodMap({
      GET: allow(capability("register", "can_edit"), capability("orders", "can_edit")),
    }),
  },
  {
    pattern: /^\/api\/admin\/orders\/qris\/[^/]+\/retry$/,
    methods: methodMap({
      POST: allow(capability("register", "can_edit"), capability("orders", "can_edit")),
    }),
  },
  {
    pattern: /^\/api\/admin\/orders\/qris\/[^/]+\/cancel$/,
    methods: methodMap({
      POST: allow(capability("register", "can_delete"), capability("orders", "can_delete")),
    }),
  },
  {
    pattern: /^\/api\/admin\/subscription$/,
    methods: methodMap({ GET: authenticated }),
  },
  {
    pattern: /^\/api\/reports\/send-email$/,
    methods: methodMap({
      POST: all(capability("reports", "can_view"), capability("reports", "can_create")),
    }),
  },
];

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return "";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function resolveApiPolicy(path: string, method: string): ApiPolicy | null {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) return null;
  const normalizedMethod = method.trim().toUpperCase() === "HEAD" ? "GET" : method.trim().toUpperCase();
  for (const rule of rules) {
    if (rule.pattern.test(normalizedPath)) return rule.methods[normalizedMethod] ?? null;
  }
  return null;
}

export function allowsApiPolicy(policy: ApiPolicy, grants: MenuGrant[]): boolean {
  if (policy.kind === "authenticated") return true;
  const byMenu = new Map(grants.map(grant => [grant.menu, grant]));
  return policy.alternatives.some(requirements => requirements.every(requirement => {
    const grant = byMenu.get(requirement.menu);
    return !!grant && grant.can_view && grant[requirement.capability] === true;
  }));
}

export function hasMenuCapability(grants: MenuGrant[], menu: string, capabilityName: AccessCapability): boolean {
  const grant = grants.find(item => item.menu === menu);
  return !!grant && grant.can_view && grant[capabilityName] === true;
}
