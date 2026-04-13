import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

const PRESET_COLORS = [
  "hsl(0, 75%, 50%)",    // Red
  "hsl(15, 80%, 45%)",   // Dark orange
  "hsl(25, 95%, 53%)",   // Orange
  "hsl(38, 92%, 50%)",   // Amber
  "hsl(50, 80%, 48%)",   // Yellow
  "hsl(60, 70%, 45%)",   // Lime
  "hsl(90, 60%, 40%)",   // Green dark
  "hsl(120, 50%, 45%)",  // Green
  "hsl(152, 60%, 48%)",  // Emerald
  "hsl(180, 60%, 45%)",  // Teal
  "hsl(190, 70%, 45%)",  // Cyan
  "hsl(200, 80%, 50%)",  // Sky blue
  "hsl(215, 60%, 50%)",  // Blue
  "hsl(240, 50%, 55%)",  // Indigo
  "hsl(260, 60%, 55%)",  // Purple
  "hsl(280, 60%, 55%)",  // Violet
  "hsl(310, 55%, 50%)",  // Fuchsia
  "hsl(330, 70%, 55%)",  // Pink
  "hsl(340, 70%, 50%)",  // Rose
  "hsl(0, 0%, 60%)",     // Gray
];

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  size?: "sm" | "md";
}

export default function ColorPicker({ currentColor, onColorChange, size = "sm" }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [customColor, setCustomColor] = useState("");

  const sizeClass = size === "sm" ? "w-3 h-3" : "w-4 h-4";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className={`${sizeClass} rounded-full flex-shrink-0 ring-2 ring-transparent hover:ring-primary/50 transition-all cursor-pointer`}
          style={{ backgroundColor: currentColor }}
          title="Alterar cor"
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">Escolha uma cor</p>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => {
                onColorChange(color);
                setOpen(false);
              }}
              className={`w-8 h-8 rounded-lg transition-all border-2 hover:scale-110 ${
                currentColor === color ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            type="color"
            value={hslToHex(currentColor)}
            onChange={(e) => {
              const hex = e.target.value;
              const hsl = hexToHsl(hex);
              onColorChange(hsl);
            }}
            className="w-10 h-8 p-0.5 cursor-pointer"
          />
          <p className="text-[10px] text-muted-foreground self-center">Cor personalizada</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper: Convert HSL string to hex for the native color input
function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
  if (!match) return "#808080";
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper: Convert hex to HSL string
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
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
