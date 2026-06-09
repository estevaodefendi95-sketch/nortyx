import { useEffect } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { hexToHSL } from "@/utils/color";

export interface WhiteLabelConfig {
  appName: string;
  logoUrl: string | null;
  primaryColor: string; // hex
  faviconUrl: string | null;
  isCustomBranded: boolean;
}

// CSS variables set by applyBrandVars — same list that clearBrandVars removes.
const BRAND_VARS = [
  "--primary",
  "--ring",
  "--sidebar-primary",
  "--sidebar-ring",
  "--brand-primary",       // raw hex, for non-HSL contexts
] as const;

/**
 * Apply all brand-related CSS variables from a hex color.
 * Safe to call outside a React component (e.g., Auth page).
 */
export function applyBrandVars(hex: string): void {
  const hsl = hexToHSL(hex);
  if (!hsl) return;
  const s = document.documentElement.style;
  // shadcn/ui components consume --primary as "H S% L%"
  s.setProperty("--primary", hsl);
  s.setProperty("--ring", hsl);
  // shadcn Sidebar component
  s.setProperty("--sidebar-primary", hsl);
  s.setProperty("--sidebar-ring", hsl);
  // Raw hex for Recharts, gradients and any inline style that needs it
  s.setProperty("--brand-primary", hex);
}

export function clearBrandVars(): void {
  const s = document.documentElement.style;
  BRAND_VARS.forEach((v) => s.removeProperty(v));
}

/**
 * Primary white-label hook.
 *
 * • Reads the active organization from OrganizationContext (works with
 *   impersonation — the context already returns the impersonated org).
 * • Applies brand CSS variables whenever the org's color changes.
 * • Returns { appName, logoUrl, primaryColor, faviconUrl, isCustomBranded }.
 *
 * Mount this once (via AppHeader or a root-level applier) so every protected
 * route inherits the correct brand without extra hook calls.
 */
export function useWhiteLabel(): WhiteLabelConfig {
  const { organization } = useOrganization();
  // Cast to `any` because the DB columns added by migration aren't yet in
  // the generated TypeScript types file.
  const org = organization as any;

  const primaryColor: string = org?.primary_color ?? "#3B82F6";
  const appName: string     = org?.custom_app_name || org?.name || "Nortyx";
  const logoUrl: string | null = org?.logo_url ?? null;
  const faviconUrl: string | null = org?.custom_favicon_url ?? null;
  const isCustomBranded: boolean =
    !!(org?.custom_app_name || org?.logo_url);

  // Apply brand color whenever it changes (includes impersonation switches).
  useEffect(() => {
    applyBrandVars(primaryColor);
    return () => clearBrandVars();
  }, [primaryColor]);

  // Swap the favicon when one is configured.
  useEffect(() => {
    if (!faviconUrl) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) return;
    const prev = link.href;
    link.href = faviconUrl;
    return () => { link.href = prev; };
  }, [faviconUrl]);

  return { appName, logoUrl, primaryColor, faviconUrl, isCustomBranded };
}
