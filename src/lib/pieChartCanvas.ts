export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export function renderPieChartPNG(slices: PieSlice[], size = 600): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;
  const inner = radius * 0.58;

  if (total <= 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#f3f4f6";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    return canvas.toDataURL("image/png");
  }

  let start = -Math.PI / 2;
  for (const s of slices) {
    const angle = (Math.max(0, s.value) / total) * Math.PI * 2;
    if (angle <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    start += angle;
  }

  // Thin white separators
  start = -Math.PI / 2;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.008;
  for (const s of slices) {
    const angle = (Math.max(0, s.value) / total) * Math.PI * 2;
    if (angle <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius);
    ctx.stroke();
    start += angle;
  }

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  return canvas.toDataURL("image/png");
}
