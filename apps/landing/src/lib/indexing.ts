export function shouldIndexSite(vercelEnvironment?: string, siteIndexable?: string): boolean {
  return vercelEnvironment !== "preview" && siteIndexable?.trim().toLowerCase() !== "false";
}
