import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  /** Icon shown when there is no src or the image fails to load. */
  fallbackClassName?: string;
}

/**
 * Renders a company logo with a graceful fallback.
 * If the image is missing or fails to load (404, expired URL, CORS, etc.)
 * it shows a Building2 icon instead of a broken-image glyph.
 */
const LogoImage = ({ src, alt = "Logo", className, fallbackClassName }: LogoImageProps) => {
  const [errored, setErrored] = useState(false);

  // Reset error state when the src changes (e.g. org switch / new upload)
  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (!src || errored) {
    return <Building2 className={cn("text-muted-foreground", fallbackClassName)} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
};

export default LogoImage;
