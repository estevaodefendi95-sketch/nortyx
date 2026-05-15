import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Wraps route content with a smooth fade transition keyed by pathname.
 * Also resets scroll on route change so we never inherit the previous
 * page's scroll position (which causes the "stale view" feeling).
 */
export const RouteTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    // Reset scroll on real navigation
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="animate-fade-in">
      {children}
    </div>
  );
};

export const FullscreenLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center animate-fade-in">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

/**
 * Lightweight overlay shown while React.lazy chunk is loading.
 * Sits on top of any previous content to hide stale UI.
 */
export const SuspenseOverlay = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Slight delay so very fast loads don't flash the spinner
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center">
      {show && <Loader2 className="w-7 h-7 animate-spin text-primary" />}
    </div>
  );
};
