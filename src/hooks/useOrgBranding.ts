/**
 * Thin compatibility wrapper — delegates to useWhiteLabel.
 * New code should import useWhiteLabel directly.
 */
import { useWhiteLabel } from "@/hooks/useWhiteLabel";

export function useOrgBranding() {
  const { appName, logoUrl, primaryColor, faviconUrl } = useWhiteLabel();
  return {
    /** Display name — respects custom_app_name white-label override. */
    companyName: appName,
    logoUrl,
    primaryColor,
    faviconUrl,
  };
}
