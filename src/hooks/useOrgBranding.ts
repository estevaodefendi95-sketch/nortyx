import { useEffect } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { hexToHSL } from "@/utils/color";

export function useOrgBranding() {
  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization?.primary_color) return;

    const hsl = hexToHSL(organization.primary_color);
    if (!hsl) return; // invalid color — keep default theme

    document.documentElement.style.setProperty("--primary", hsl);
    document.documentElement.style.setProperty("--ring", hsl);

    return () => {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--ring");
    };
  }, [organization?.primary_color]);

  return {
    logoUrl: organization?.logo_url ?? null,
    companyName: organization?.name ?? "nortyx",
    primaryColor: organization?.primary_color ?? "#3B82F6",
  };
}
