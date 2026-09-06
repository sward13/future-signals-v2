/**
 * Project domain helpers — single source of truth for the multi-domain model.
 *
 * A project's domains live in two columns:
 *   - `domains`       text[]  — predefined labels (a subset of PREDEFINED_DOMAINS)
 *   - `custom_domain` text    — one freeform name (New Project flow only)
 *
 * The legacy single `domain` column is retained for rollback safety; these
 * readers fall back to it so pre-migration rows (or a rolled-back write) still
 * render. See migration 20260817120000_project_domains_multiselect.sql.
 */

// The sentinel tile that reveals the freeform custom-domain field.
export const CUSTOM_DOMAIN_LABEL = "Custom / Other";

// The eight predefined domains. Onboarding offers exactly these; New Project /
// Edit offer these plus the Custom / Other tile.
export const PREDEFINED_DOMAINS = [
  "Technology & AI",
  "Climate & Energy",
  "Health & Life Sciences",
  "Government & Policy",
  "Economy & Finance",
  "Education & Learning",
  "Media & Culture",
  "Defence & Security",
];

/** Predefined domains for a project, tolerating legacy single-value rows. */
export function projectDomains(project) {
  if (!project) return [];
  if (Array.isArray(project.domains) && project.domains.length) return project.domains;
  // Legacy fallback: single `domain` string (excluding the old Custom sentinel).
  if (project.domain && project.domain !== CUSTOM_DOMAIN_LABEL) return [project.domain];
  return [];
}

/** The project's freeform custom domain name, or "". */
export function projectCustomDomain(project) {
  return project?.custom_domain?.trim() || "";
}

/** Full display list: predefined domains followed by the custom name (if any). */
export function projectDomainList(project) {
  const list = [...projectDomains(project)];
  const custom = projectCustomDomain(project);
  if (custom) list.push(custom);
  return list;
}

/** Single-line label for compact display sites (cards, subtitles). "" if none. */
export function projectDomainLabel(project) {
  return projectDomainList(project).join(" · ");
}

/** Does the project have any domain at all? Drives the scanning-enabled gate. */
export function projectHasDomain(project) {
  return projectDomainList(project).length > 0;
}

/**
 * Value to write into the legacy `domain` column for rollback safety.
 * Mirrors the old behaviour: first predefined domain, else the Custom sentinel
 * when only a custom domain is set, else "".
 */
export function legacyDomainValue(domains, customDomain) {
  if (Array.isArray(domains) && domains.length) return domains[0];
  if (customDomain && customDomain.trim()) return CUSTOM_DOMAIN_LABEL;
  return "";
}
