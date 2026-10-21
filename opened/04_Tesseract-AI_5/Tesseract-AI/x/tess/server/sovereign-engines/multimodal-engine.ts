export class SovereignMultimodalEngine {
  analyzeColor(hex: string): {
    rgb: [number, number, number];
    hsl: [number, number, number];
    name: string;
    luminance: number;
    isLight: boolean;
    complementary: string;
    triadic: [string, string];
    analogous: [string, string];
  } {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      else if (max === gn) h = ((bn - rn) / d + 2) / 6;
      else h = ((rn - gn) / d + 4) / 6;
    }
    const hDeg = Math.round(h * 360);
    const sPercent = Math.round(s * 100);
    const lPercent = Math.round(l * 100);
    const luminance = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn;

    const hslToHex = (h2: number, s2: number, l2: number): string => {
      h2 = ((h2 % 360) + 360) % 360;
      const c = (1 - Math.abs(2 * l2 - 1)) * s2;
      const x = c * (1 - Math.abs((h2 / 60) % 2 - 1));
      const m = l2 - c / 2;
      let r2 = 0, g2 = 0, b2 = 0;
      if (h2 < 60) { r2 = c; g2 = x; }
      else if (h2 < 120) { r2 = x; g2 = c; }
      else if (h2 < 180) { g2 = c; b2 = x; }
      else if (h2 < 240) { g2 = x; b2 = c; }
      else if (h2 < 300) { r2 = x; b2 = c; }
      else { r2 = c; b2 = x; }
      const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
      return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
    };

    const colorNames: [string, number, number, number][] = [
      ["red", 0, 100, 50], ["orange", 30, 100, 50], ["yellow", 60, 100, 50],
      ["green", 120, 100, 40], ["cyan", 180, 100, 50], ["blue", 240, 100, 50],
      ["purple", 270, 100, 50], ["magenta", 300, 100, 50], ["pink", 330, 80, 70],
      ["white", 0, 0, 100], ["black", 0, 0, 0], ["gray", 0, 0, 50],
      ["brown", 30, 60, 30],
    ];
    let bestName = "unknown";
    let bestDist = Infinity;
    for (const [name, ch, cs, cl] of colorNames) {
      const dist = Math.abs(hDeg - ch) + Math.abs(sPercent - cs) * 0.5 + Math.abs(lPercent - cl) * 0.5;
      if (dist < bestDist) { bestDist = dist; bestName = name; }
    }

    return {
      rgb: [r, g, b],
      hsl: [hDeg, sPercent, lPercent],
      name: bestName,
      luminance: Math.round(luminance * 1000) / 1000,
      isLight: luminance > 0.5,
      complementary: hslToHex((hDeg + 180) % 360, s, l),
      triadic: [hslToHex((hDeg + 120) % 360, s, l), hslToHex((hDeg + 240) % 360, s, l)],
      analogous: [hslToHex((hDeg + 30) % 360, s, l), hslToHex((hDeg - 30 + 360) % 360, s, l)],
    };
  }

  generateColorPalette(baseHex: string, type: "monochromatic" | "complementary" | "triadic" | "analogous" | "split-complementary", count = 5): string[] {
    const analysis = this.analyzeColor(baseHex);
    const [h, s, l] = analysis.hsl;
    const palette: string[] = [baseHex];

    const hslToHex = (h2: number, s2: number, l2: number): string => {
      h2 = ((h2 % 360) + 360) % 360;
      const sn = s2 / 100, ln = l2 / 100;
      const c = (1 - Math.abs(2 * ln - 1)) * sn;
      const x = c * (1 - Math.abs((h2 / 60) % 2 - 1));
      const m = ln - c / 2;
      let r = 0, g = 0, b = 0;
      if (h2 < 60) { r = c; g = x; }
      else if (h2 < 120) { r = x; g = c; }
      else if (h2 < 180) { g = c; b = x; }
      else if (h2 < 240) { g = x; b = c; }
      else if (h2 < 300) { r = x; b = c; }
      else { r = c; b = x; }
      const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    switch (type) {
      case "monochromatic":
        for (let i = 1; i < count; i++) palette.push(hslToHex(h, s, Math.max(10, Math.min(90, l + (i - count / 2) * 15))));
        break;
      case "complementary":
        palette.push(hslToHex((h + 180) % 360, s, l));
        for (let i = 2; i < count; i++) palette.push(hslToHex(h, s, l + (i % 2 === 0 ? 15 : -15)));
        break;
      case "triadic":
        palette.push(hslToHex((h + 120) % 360, s, l));
        palette.push(hslToHex((h + 240) % 360, s, l));
        for (let i = 3; i < count; i++) palette.push(hslToHex(h + i * 30, s, l));
        break;
      case "analogous":
        for (let i = 1; i < count; i++) palette.push(hslToHex((h + i * 30) % 360, s, l));
        break;
      case "split-complementary":
        palette.push(hslToHex((h + 150) % 360, s, l));
        palette.push(hslToHex((h + 210) % 360, s, l));
        for (let i = 3; i < count; i++) palette.push(hslToHex(h, s, l + i * 10));
        break;
    }
    return palette.slice(0, count);
  }

  generateSVG(type: string, options: { width?: number; height?: number; color?: string; text?: string } = {}): string {
    const w = options.width || 200;
    const h = options.height || 200;
    const c = options.color || "#4a9eff";
    const t = options.text || "";

    switch (type) {
      case "circle":
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)/3}" fill="${c}" />${t ? `<text x="${w/2}" y="${h/2}" text-anchor="middle" fill="white" font-size="14">${t}</text>` : ""}</svg>`;
      case "rect":
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="${w*0.1}" y="${h*0.1}" width="${w*0.8}" height="${h*0.8}" fill="${c}" rx="8" />${t ? `<text x="${w/2}" y="${h/2}" text-anchor="middle" fill="white" font-size="14">${t}</text>` : ""}</svg>`;
      case "chart_bar": {
        const bars = [0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6];
        const barW = w / (bars.length * 2);
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${bars.map((v, i) => `<rect x="${barW + i * barW * 2}" y="${h - v * h * 0.8}" width="${barW}" height="${v * h * 0.8}" fill="${c}" rx="2" />`).join("")}</svg>`;
      }
      case "chart_pie": {
        const data = [30, 25, 20, 15, 10];
        const colors = ["#4a9eff", "#ff6b6b", "#ffd93d", "#6bcb77", "#9d65c9"];
        let angle = 0;
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 3;
        const slices = data.map((v, i) => {
          const startAngle = angle;
          angle += (v / 100) * 360;
          const endAngle = angle;
          const x1 = cx + r * Math.cos((startAngle - 90) * Math.PI / 180);
          const y1 = cy + r * Math.sin((startAngle - 90) * Math.PI / 180);
          const x2 = cx + r * Math.cos((endAngle - 90) * Math.PI / 180);
          const y2 = cy + r * Math.sin((endAngle - 90) * Math.PI / 180);
          const large = endAngle - startAngle > 180 ? 1 : 0;
          return `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${colors[i]}" />`;
        });
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${slices.join("")}</svg>`;
      }
      case "icon_check":
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)/3}" fill="${c}" /><path d="M${w*0.35} ${h*0.5} L${w*0.45} ${h*0.6} L${w*0.65} ${h*0.4}" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case "logo":
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><polygon points="${w/2},${h*0.15} ${w*0.85},${h*0.85} ${w*0.15},${h*0.85}" fill="${c}" /><text x="${w/2}" y="${h*0.65}" text-anchor="middle" fill="white" font-size="${Math.min(w,h)/6}" font-weight="bold">${t || "T"}</text></svg>`;
      case "flowchart": {
        const boxes = [
          { x: w * 0.3, y: h * 0.05, label: "Start" },
          { x: w * 0.3, y: h * 0.35, label: "Process" },
          { x: w * 0.3, y: h * 0.65, label: "End" },
        ];
        const bw = w * 0.4, bh = h * 0.15;
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${boxes.map(b => `<rect x="${b.x}" y="${b.y}" width="${bw}" height="${bh}" fill="${c}" rx="6" /><text x="${b.x + bw/2}" y="${b.y + bh/2 + 5}" text-anchor="middle" fill="white" font-size="12">${b.label}</text>`).join("")}${boxes.slice(0, -1).map((b, i) => `<line x1="${b.x + bw/2}" y1="${b.y + bh}" x2="${boxes[i+1].x + bw/2}" y2="${boxes[i+1].y}" stroke="${c}" stroke-width="2" marker-end="url(#arrow)"/>`).join("")}<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${c}" /></marker></defs></svg>`;
      }
      default:
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${c}" /><text x="${w/2}" y="${h/2}" text-anchor="middle" fill="white" font-size="16">${t || type}</text></svg>`;
    }
  }

  analyzeImageMetadata(data: { width: number; height: number; format: string; fileSize: number; channels?: number }): {
    aspectRatio: string;
    orientation: string;
    megapixels: number;
    compressionRatio: number;
    qualityEstimate: string;
    recommendedUse: string;
  } {
    const { width, height, format, fileSize, channels = 3 } = data;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(width, height);
    const rawSize = width * height * channels;
    const ratio = rawSize / Math.max(fileSize, 1);

    let qualityEstimate: string;
    if (ratio < 2) qualityEstimate = "lossless/high";
    else if (ratio < 10) qualityEstimate = "high";
    else if (ratio < 30) qualityEstimate = "medium";
    else qualityEstimate = "low";

    const mp = (width * height) / 1000000;
    let recommendedUse: string;
    if (mp > 8) recommendedUse = "print/poster";
    else if (mp > 2) recommendedUse = "web/presentation";
    else if (mp > 0.5) recommendedUse = "thumbnail/icon";
    else recommendedUse = "avatar/small icon";

    return {
      aspectRatio: `${width / g}:${height / g}`,
      orientation: width > height ? "landscape" : width < height ? "portrait" : "square",
      megapixels: Math.round(mp * 100) / 100,
      compressionRatio: Math.round(ratio * 10) / 10,
      qualityEstimate,
      recommendedUse,
    };
  }

  analyzeComposition(regions: { x: number; y: number; width: number; height: number; label: string }[], canvasWidth: number, canvasHeight: number): {
    ruleOfThirds: boolean;
    symmetry: number;
    balance: string;
    dominantRegion: string;
    coverage: number;
  } {
    const thirds = {
      x: [canvasWidth / 3, canvasWidth * 2 / 3],
      y: [canvasHeight / 3, canvasHeight * 2 / 3],
    };

    const onThirds = regions.some(r => {
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      return (Math.abs(cx - thirds.x[0]) < canvasWidth * 0.1 || Math.abs(cx - thirds.x[1]) < canvasWidth * 0.1) &&
        (Math.abs(cy - thirds.y[0]) < canvasHeight * 0.1 || Math.abs(cy - thirds.y[1]) < canvasHeight * 0.1);
    });

    const leftWeight = regions.filter(r => r.x + r.width / 2 < canvasWidth / 2).reduce((s, r) => s + r.width * r.height, 0);
    const rightWeight = regions.filter(r => r.x + r.width / 2 >= canvasWidth / 2).reduce((s, r) => s + r.width * r.height, 0);
    const totalWeight = leftWeight + rightWeight;
    const symmetry = totalWeight > 0 ? 1 - Math.abs(leftWeight - rightWeight) / totalWeight : 0;

    let dominantRegion = "none";
    let maxArea = 0;
    for (const r of regions) {
      const area = r.width * r.height;
      if (area > maxArea) { maxArea = area; dominantRegion = r.label; }
    }

    const totalArea = regions.reduce((s, r) => s + r.width * r.height, 0);
    const coverage = totalArea / (canvasWidth * canvasHeight);

    return {
      ruleOfThirds: onThirds,
      symmetry: Math.round(symmetry * 100) / 100,
      balance: symmetry > 0.7 ? "balanced" : symmetry > 0.4 ? "slightly unbalanced" : "unbalanced",
      dominantRegion,
      coverage: Math.round(coverage * 100) / 100,
    };
  }

  contrastRatio(hex1: string, hex2: string): { ratio: number; wcagAA: boolean; wcagAAA: boolean } {
    const luminance = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };
    const l1 = luminance(hex1), l2 = luminance(hex2);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return {
      ratio: Math.round(ratio * 100) / 100,
      wcagAA: ratio >= 4.5,
      wcagAAA: ratio >= 7,
    };
  }

  generateDataVisualization(data: { label: string; value: number }[], type: "bar" | "line" | "scatter" | "area"): string {
    const w = 400, h = 300;
    const maxVal = Math.max(...data.map(d => d.value));
    const padding = 50;

    switch (type) {
      case "bar": {
        const barW = (w - padding * 2) / data.length * 0.7;
        const gap = (w - padding * 2) / data.length * 0.3;
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#1a1a2e" />${data.map((d, i) => {
          const bh = (d.value / maxVal) * (h - padding * 2);
          const x = padding + i * (barW + gap);
          return `<rect x="${x}" y="${h - padding - bh}" width="${barW}" height="${bh}" fill="#4a9eff" rx="3" /><text x="${x + barW/2}" y="${h - padding + 15}" text-anchor="middle" fill="#aaa" font-size="10">${d.label}</text>`;
        }).join("")}</svg>`;
      }
      case "line": {
        const points = data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * (w - padding * 2);
          const y = h - padding - (d.value / maxVal) * (h - padding * 2);
          return `${x},${y}`;
        });
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#1a1a2e" /><polyline points="${points.join(' ')}" fill="none" stroke="#4a9eff" stroke-width="2" />${data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * (w - padding * 2);
          const y = h - padding - (d.value / maxVal) * (h - padding * 2);
          return `<circle cx="${x}" cy="${y}" r="4" fill="#4a9eff" />`;
        }).join("")}</svg>`;
      }
      default:
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="${w/2}" y="${h/2}" text-anchor="middle" fill="white">${type} chart</text></svg>`;
    }
  }

  textToASCIIArt(text: string): string {
    const charMap: Record<string, string[]> = {
      A: [" # ", "# #", "###", "# #", "# #"],
      B: ["## ", "# #", "## ", "# #", "## "],
      C: [" ##", "#  ", "#  ", "#  ", " ##"],
      D: ["## ", "# #", "# #", "# #", "## "],
      E: ["###", "#  ", "## ", "#  ", "###"],
      T: ["###", " # ", " # ", " # ", " # "],
      S: [" ##", "#  ", " # ", "  #", "## "],
    };
    const chars = text.toUpperCase().split('');
    const lines: string[] = ["", "", "", "", ""];
    for (const ch of chars) {
      const art = charMap[ch] || ["   ", "   ", "   ", "   ", "   "];
      for (let i = 0; i < 5; i++) lines[i] += art[i] + " ";
    }
    return lines.join("\n");
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    check("Color analysis red", (() => {
      const c = this.analyzeColor("#ff0000");
      return c.rgb[0] === 255 && c.rgb[1] === 0 && c.name === "red";
    })());
    check("Color analysis blue", (() => {
      const c = this.analyzeColor("#0000ff");
      return c.rgb[2] === 255 && c.name === "blue";
    })());
    check("Color luminance white", this.analyzeColor("#ffffff").luminance > 0.9);
    check("Color luminance black", this.analyzeColor("#000000").luminance < 0.1);
    check("Color complementary", this.analyzeColor("#ff0000").complementary.length === 7);
    check("Color palette monochromatic", this.generateColorPalette("#4a9eff", "monochromatic", 5).length === 5);
    check("Color palette triadic", this.generateColorPalette("#ff0000", "triadic", 4).length === 4);
    check("Color palette analogous", this.generateColorPalette("#00ff00", "analogous", 3).length === 3);

    check("SVG circle", this.generateSVG("circle").includes("<circle"));
    check("SVG rect", this.generateSVG("rect").includes("<rect"));
    check("SVG bar chart", this.generateSVG("chart_bar").includes("<rect"));
    check("SVG pie chart", this.generateSVG("chart_pie").includes("<path"));
    check("SVG logo", this.generateSVG("logo", { text: "T" }).includes("<polygon"));
    check("SVG flowchart", this.generateSVG("flowchart").includes("Start"));
    check("SVG icon", this.generateSVG("icon_check").includes("<path"));

    check("Image metadata landscape", (() => {
      const m = this.analyzeImageMetadata({ width: 1920, height: 1080, format: "jpg", fileSize: 500000 });
      return m.orientation === "landscape" && m.aspectRatio === "16:9" && m.megapixels > 2;
    })());
    check("Image metadata portrait", this.analyzeImageMetadata({ width: 1080, height: 1920, format: "png", fileSize: 1000000 }).orientation === "portrait");

    check("Composition analysis", (() => {
      const c = this.analyzeComposition(
        [{ x: 100, y: 100, width: 200, height: 200, label: "main" }],
        800, 600
      );
      return c.dominantRegion === "main" && c.coverage > 0;
    })());

    check("Contrast ratio black/white", (() => {
      const c = this.contrastRatio("#000000", "#ffffff");
      return c.ratio > 20 && c.wcagAAA;
    })());
    check("Contrast ratio similar colors", (() => {
      const c = this.contrastRatio("#333333", "#444444");
      return c.ratio < 4.5 && !c.wcagAA;
    })());

    check("Data viz bar", this.generateDataVisualization([{ label: "A", value: 10 }, { label: "B", value: 20 }], "bar").includes("<svg"));
    check("Data viz line", this.generateDataVisualization([{ label: "A", value: 10 }, { label: "B", value: 20 }, { label: "C", value: 15 }], "line").includes("<polyline"));

    check("ASCII art", this.textToASCIIArt("TEST").includes("#"));

    return { passed, total, details };
  }
}

export const multimodalEngine = new SovereignMultimodalEngine();
