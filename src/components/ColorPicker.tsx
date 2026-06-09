import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

// ── Color presets (HSL) ───────────────────────────────────────────────────────
const PRESET_COLORS_HSL = [
  "hsl(0, 75%, 50%)",    "hsl(15, 80%, 45%)",  "hsl(25, 95%, 53%)",
  "hsl(38, 92%, 50%)",   "hsl(50, 80%, 48%)",  "hsl(60, 70%, 45%)",
  "hsl(90, 60%, 40%)",   "hsl(120, 50%, 45%)", "hsl(152, 60%, 48%)",
  "hsl(180, 60%, 45%)",  "hsl(190, 70%, 45%)", "hsl(200, 80%, 50%)",
  "hsl(215, 60%, 50%)",  "hsl(240, 50%, 55%)", "hsl(260, 60%, 55%)",
  "hsl(280, 60%, 55%)",  "hsl(310, 55%, 50%)", "hsl(330, 70%, 55%)",
  "hsl(340, 70%, 50%)",  "hsl(0, 0%, 60%)",
];

// ── Prop types ────────────────────────────────────────────────────────────────
// Two modes: HSL (legacy) or Hex (new white-label editor).
type HslProps = {
  currentColor: string;
  onColorChange: (hsl: string) => void;
  value?: never;
  onChange?: never;
  size?: "sm" | "md";
};

type HexProps = {
  value: string;           // hex  e.g. "#3B82F6"
  onChange: (hex: string) => void;
  currentColor?: never;
  onColorChange?: never;
  size?: "sm" | "md";
};

type ColorPickerProps = HslProps | HexProps;

// ── Conversion helpers ────────────────────────────────────────────────────────
function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\(\s*(\d+),\s*(\d+)%?,\s*(\d+)%?\s*\)/);
  if (!match) return "#808080";
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6) return "hsl(215, 60%, 50%)";
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function isValidHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ColorPicker(props: ColorPickerProps) {
  const isHexMode = props.value !== undefined;
  const { size = "sm" } = props;

  // Normalise to hex internally regardless of mode.
  const hexValue = isHexMode
    ? props.value
    : hslToHex(props.currentColor ?? "hsl(215,60%,50%)");

  const [open, setOpen] = useState(false);
  // Local hex text input state — only tracks while the user is typing
  const [hexInput, setHexInput] = useState(hexValue);
  const hexInputRef = useRef<HTMLInputElement>(null);

  // Keep local input in sync when parent value changes
  useEffect(() => {
    setHexInput(hexValue);
  }, [hexValue]);

  const emit = (hex: string) => {
    if (isHexMode) {
      props.onChange(hex);
    } else {
      props.onColorChange(hexToHsl(hex));
    }
  };

  const handlePreset = (hsl: string) => {
    emit(hslToHex(hsl));
    setOpen(false);
  };

  const handleNativeColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    emit(e.target.value);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexInput(v);
    if (isValidHex(v)) emit(v);
  };

  const handleHexBlur = () => {
    // Reset to last known-good hex if the input is invalid
    if (!isValidHex(hexInput)) setHexInput(hexValue);
  };

  const swatchSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(true); }
          }}
          className={`${swatchSize} inline-block rounded-full flex-shrink-0 ring-2 ring-transparent hover:ring-primary/50 transition-all cursor-pointer`}
          style={{ backgroundColor: hexValue }}
          title="Alterar cor"
        />
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-muted-foreground mb-2">Escolha uma cor</p>

        {/* Preset swatches */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {PRESET_COLORS_HSL.map((hsl) => {
            const hex = hslToHex(hsl);
            return (
              <button
                key={hsl}
                onClick={() => handlePreset(hsl)}
                className={`w-8 h-8 rounded-lg transition-all border-2 hover:scale-110 ${
                  hexValue.toLowerCase() === hex.toLowerCase()
                    ? "border-foreground scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>

        {/* Hex text input + native color picker */}
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={hexValue}
            onChange={handleNativeColor}
            className="w-9 h-9 rounded cursor-pointer border border-border p-0.5 flex-shrink-0"
            title="Cor personalizada"
          />
          <Input
            ref={hexInputRef}
            value={hexInput}
            onChange={handleHexInput}
            onBlur={handleHexBlur}
            placeholder="#3B82F6"
            className="h-9 font-mono text-xs"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
