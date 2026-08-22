"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea", "#db2777"];
const DEFAULT_COLOR = COLORS[0];
const DEFAULT_LABELS = ["A", "B", "C", "D", "E"];

const POSITIONS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: .5, y: .5 }],
  2: [{ x: .39, y: .5 }, { x: .61, y: .5 }],
  3: [{ x: .42, y: .4 }, { x: .58, y: .4 }, { x: .5, y: .62 }],
  4: [{ x: .41, y: .39 }, { x: .59, y: .39 }, { x: .41, y: .61 }, { x: .59, y: .61 }],
  5: [{ x: .5, y: .32 }, { x: .65, y: .44 }, { x: .59, y: .64 }, { x: .41, y: .64 }, { x: .35, y: .44 }],
};

type RegionStyle = { filled: boolean; color: string };
type Regions = Record<number, RegionStyle>;

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255] as const;
}

function getGeometry(width: number, height: number, count: number) {
  const radius = Math.min(width, height) * (count >= 4 ? .225 : .275);
  return POSITIONS[count].map((point) => ({ x: point.x * width, y: point.y * height, radius }));
}

function getMask(x: number, y: number, geometry: ReturnType<typeof getGeometry>) {
  return geometry.reduce((mask, circle, index) => {
    const inside = (x - circle.x) ** 2 + (y - circle.y) ** 2 <= circle.radius ** 2;
    return inside ? mask | (1 << index) : mask;
  }, 0);
}

function regionName(mask: number, count: number, labels: string[]) {
  const names = labels.slice(0, count).map((label, index) => label.trim() || `Circle ${index + 1}`);
  if (mask === 0) return "Outside all circles";
  const inside = names.filter((_, index) => mask & (1 << index));
  const outside = names.filter((_, index) => !(mask & (1 << index)));
  if (!outside.length) return `Inside ${inside.join(" + ")}`;
  return `Inside ${inside.join(" + ")}; outside ${outside.join(" + ")}`;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(3);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [regions, setRegions] = useState<Regions>({});
  const [selectedMask, setSelectedMask] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState("");

  const selected = selectedMask === null ? null : regions[selectedMask] ?? { filled: false, color: DEFAULT_COLOR };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.min(1200, Math.max(1, Math.round(canvas.clientWidth)));
    const height = Math.min(800, Math.max(1, Math.round(canvas.clientHeight)));
    const scale = 1;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    const geometry = getGeometry(width, height, count);
    const image = context.createImageData(canvas.width, canvas.height);
    const data = image.data;

    for (let py = 0; py < canvas.height; py += 1) {
      for (let px = 0; px < canvas.width; px += 1) {
        const mask = getMask(px / scale, py / scale, geometry);
        const region = regions[mask];
        const color = hexToRgb(region?.color ?? DEFAULT_COLOR);
        const strength = region?.filled ? .32 : 0;
        const offset = (py * canvas.width + px) * 4;
        data[offset] = Math.round(255 + (color[0] - 255) * strength);
        data[offset + 1] = Math.round(255 + (color[1] - 255) * strength);
        data[offset + 2] = Math.round(255 + (color[2] - 255) * strength);
        data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.lineWidth = 2;
    context.strokeStyle = "#555";
    context.fillStyle = "#171717";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "600 16px Arial";
    geometry.forEach((circle, index) => {
      context.beginPath();
      context.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      context.stroke();
      const label = labels[index]?.trim();
      if (label) context.fillText(label, circle.x, circle.y, circle.radius * 1.15);
    });
  }, [count, labels, regions]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(draw);
    const handleResize = () => window.requestAnimationFrame(draw);
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [draw]);

  useEffect(() => {
    if (!window.location.hash.startsWith("#diagram=")) return;
    try {
      const saved = JSON.parse(decodeURIComponent(window.location.hash.slice(9))) as {
        count?: number;
        labels?: string[];
        regions?: Regions;
      };
      if (saved.count && saved.count >= 1 && saved.count <= 5) setCount(saved.count);
      if (Array.isArray(saved.labels)) setLabels(DEFAULT_LABELS.map((fallback, i) => typeof saved.labels?.[i] === "string" ? saved.labels[i].slice(0, 24) : fallback));
      if (saved.regions && typeof saved.regions === "object") setRegions(saved.regions);
    } catch {
      setShareStatus("Could not read this share link");
    }
  }, []);

  function updateSelected(values: Partial<RegionStyle>) {
    if (selectedMask === null) return;
    setRegions((current) => {
      const existing = current[selectedMask] ?? { filled: false, color: DEFAULT_COLOR };
      return { ...current, [selectedMask]: { ...existing, ...values } };
    });
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mask = getMask(event.clientX - rect.left, event.clientY - rect.top, getGeometry(rect.width, rect.height, count));
    setSelectedMask(mask);
    setRegions((current) => ({
      ...current,
      [mask]: {
        color: current[mask]?.color ?? DEFAULT_COLOR,
        filled: !(current[mask]?.filled ?? false),
      },
    }));
  }

  function reset() {
    setCount(3);
    setLabels(DEFAULT_LABELS);
    setRegions({});
    setSelectedMask(null);
    setShareStatus("");
    window.history.replaceState(null, "", `${window.location.origin}${window.location.pathname}`);
  }

  async function copyShareLink() {
    const payload = encodeURIComponent(JSON.stringify({ count, labels: labels.slice(0, count), regions }));
    const url = `${window.location.origin}${window.location.pathname}#diagram=${payload}`;
    try {
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", url);
      setShareStatus("Link copied");
      window.setTimeout(() => setShareStatus(""), 1800);
    } catch {
      setShareStatus("Copy failed");
    }
  }

  return (
    <main>
      <header>
        <div>
          <h1>Venn diagram tool</h1>
          <p>Click any distinct region to highlight or clear it.</p>
        </div>
        <div className="header-actions">
          <span className="share-status" aria-live="polite">{shareStatus}</span>
          <button className="primary" type="button" onClick={copyShareLink}>Copy share link</button>
          <button className="secondary" type="button" onClick={reset}>Reset</button>
        </div>
      </header>

      <div className="app">
        <aside aria-label="Diagram settings">
          <section className="count-row">
            <label>Number of circles</label>
            <div className="stepper">
              <button type="button" onClick={() => { setCount((n) => Math.max(1, n - 1)); setSelectedMask(null); }} disabled={count === 1} aria-label="Remove circle">−</button>
              <output aria-live="polite">{count}</output>
              <button type="button" onClick={() => { setCount((n) => Math.min(5, n + 1)); setSelectedMask(null); }} disabled={count === 5} aria-label="Add circle">+</button>
            </div>
          </section>

          <section className="labels-setting">
            <strong>Circle labels</strong>
            <p>Optional</p>
            {labels.slice(0, count).map((label, index) => (
              <label className="label-row" key={index}>
                <span>{index + 1}</span>
                <input value={label} maxLength={24} placeholder={`Circle ${index + 1}`} onChange={(e) => setLabels((items) => items.map((item, i) => i === index ? e.target.value : item))} />
              </label>
            ))}
          </section>

          <section className={`region-setting ${selectedMask === null ? "empty" : ""}`}>
            <strong>Selected region</strong>
            {selectedMask === null ? (
              <p>Click a region in the diagram.</p>
            ) : (
              <>
                <p className="region-name">{regionName(selectedMask, count, labels)}</p>
                <label className="fill-toggle"><input type="checkbox" checked={selected?.filled ?? false} onChange={(e) => updateSelected({ filled: e.target.checked })} /> Highlight this region</label>
                <span className="field-label">Highlight colour</span>
                <div className="colors">
                  {COLORS.map((color) => (
                    <label key={color}>
                      <input type="radio" name="region-color" checked={selected?.color === color} onChange={() => updateSelected({ color })} />
                      <i style={{ background: color }} />
                    </label>
                  ))}
                </div>
              </>
            )}
          </section>
        </aside>

        <section className="preview" aria-label="Venn diagram preview">
          <p className="hint">Each overlap is its own selectable region. Click once to highlight, again to clear.</p>
          <canvas ref={canvasRef} className="canvas" onClick={handleCanvasClick} aria-label="Interactive Venn diagram" />
        </section>
      </div>
    </main>
  );
}
