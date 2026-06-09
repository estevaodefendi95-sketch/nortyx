import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, X } from "lucide-react";
import { getImpersonationState, stopImpersonation, type ImpersonationState } from "@/lib/superAdmin";
import { useOrganization } from "@/context/OrganizationContext";

const ImpersonationBanner = () => {
  const [state, setState] = useState<ImpersonationState | null>(null);
  const { switchOrganization } = useOrganization();
  const navigate = useNavigate();

  // Read from sessionStorage on mount and whenever it might change
  useEffect(() => {
    const check = () => setState(getImpersonationState());
    check();
    // Re-check when tab becomes visible (e.g. after navigation)
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  if (!state?.active) return null;

  const handleExit = async () => {
    const originalOrgId = stopImpersonation();
    setState(null);
    if (originalOrgId) {
      await switchOrganization(originalOrgId);
    }
    navigate("/master");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 shadow-md text-sm font-medium">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span>
          Você está visualizando como:{" "}
          <strong className="font-bold">{state.orgName}</strong>
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 bg-amber-950/15 hover:bg-amber-950/25 px-3 py-1 rounded-md transition-colors text-xs font-semibold"
      >
        <X className="w-3.5 h-3.5" />
        Sair da impersonação
      </button>
    </div>
  );
};

export default ImpersonationBanner;
