import * as THREE from "three";
import type { Repo } from "@/content/repos";

/**
 * Card textures, drawn once per project into canvases.
 *   cover  — the live-site screenshot, or for repos without a site a
 *            generated cover: a deep gradient, the name in the display
 *            serif, and the description set as monospaced "source"
 *   info   — the PRJCT /NN details sheet that fades in on the focused card
 */
const W = 624;
const H = 800;

function family(v: string) {
  return getComputedStyle(document.body).getPropertyValue(v).split(",")[0].trim() || "serif";
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > max && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function generatedCover(r: Repo) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0d14");
  bg.addColorStop(1, "#1a1f2e");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // soft light, so the hue tint has something to sit on
  const glow = g.createRadialGradient(W * 0.7, H * 0.25, 10, W * 0.7, H * 0.25, W * 0.9);
  glow.addColorStop(0, "rgba(255,255,255,0.14)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // monospaced "source": the description, the stack, the language, repeated
  g.font = `500 15px ${family("--font-mono")}`;
  g.fillStyle = "rgba(255,255,255,0.12)";
  const src = [`// ${r.name}`, `lang: "${r.lang}"`, `stack: [${r.stack.map((s) => `"${s}"`).join(", ")}]`, ...wrap(g, r.line, W - 80).map((l) => `// ${l}`)];
  for (let y = 40, i = 0; y < H; y += 24, i++) g.fillText(src[i % src.length], 32, y);

  g.fillStyle = "#ffffff";
  g.font = `400 92px ${family("--font-serif")}`;
  const lines = wrap(g, r.name, W - 80);
  lines.forEach((l, i) => g.fillText(l, 36, H - 150 - (lines.length - 1 - i) * 88));
  g.font = `500 16px ${family("--font-mono")}`;
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillText(`${r.lang.toUpperCase()}  /  ${r.type.toUpperCase()}`, 38, H - 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function infoSheet(r: Repo, index: number) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.font = `500 22px ${family("--font-mono")}`;
  g.textBaseline = "top";
  const right = (s: string, y: number) => g.fillText(s, W - 36 - g.measureText(s).width, y);
  let y = 250;
  g.fillText("PRJCT", 36, y);
  right(`/${String(index + 1).padStart(2, "0")}`, y);
  const rows: [string, string[], number][] = [
    ["CREATED AT:", [r.created], 80],
    ["NAME:", [r.name.toUpperCase()], 130],
    ["TYPE:", [r.type.toUpperCase()], 230],
    ["SCOPE:", r.scope.map((s) => s.toUpperCase()), 190],
    ["STACK:", r.stack.map((s) => s.toUpperCase()), 36],
  ];
  y += 36;
  for (const [k, vals, x] of rows) {
    g.fillText(k, x, y);
    vals.forEach((v, i) => right(v, y + i * 28));
    y += Math.max(1, vals.length) * 28 + 10;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
