// Cross-platform Hardware-GPU-Accelerated Video Renderer for Horror Engine v3.
// Auto-detects Linux NVIDIA/DRM EGL ("angle-egl") with graceful fallback to "swangle",
// supports fast --draft preview mode (scale 0.5, MSAA off, crf 24), enforces Remotion-safe scales,
// and cleans its temporary webpack bundle on exit.
//
// Usage:
//   node scripts/render-video.mjs <CompositionId> <out.mp4> [--scale 1|0.5|1.25|1.5] [--crf 16] [--concurrency 2] [--draft] [--gl angle-egl|swangle|angle]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const rawArgs = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    if (k === "draft") {
      flags.draft = true;
    } else if (i + 1 < rawArgs.length) {
      flags[k] = rawArgs[++i];
    }
  } else {
    positional.push(a);
  }
}

const [compId, outPath] = positional;
if (!compId || !outPath) {
  console.error("Usage: node scripts/render-video.mjs <CompositionId> <out.mp4> [--scale 1] [--crf 16] [--concurrency 2] [--draft] [--gl auto]");
  process.exit(1);
}

const draft = !!flags.draft;
const scale = Number(flags.scale ?? (draft ? 0.5 : 1));
const validScales = new Set([0.5, 1, 1.25, 1.5]);
if (!validScales.has(scale)) {
  console.error(`Invalid --scale ${scale}. Use one of: 0.5, 1, 1.25, 1.5 (never non-integer 1.3333).`);
  process.exit(1);
}
const crf = Number(flags.crf ?? (draft ? 24 : 16));
const concurrency = Number(flags.concurrency ?? (draft ? 3 : 2));

const isWin = process.platform === "win32";
const defaultTmp = isWin && fs.existsSync("D:/") ? "D:/remotion-tmp" : path.join(os.tmpdir(), "remotion-tmp");
const tmpDir = process.env.REMOTION_TMP || defaultTmp;
fs.mkdirSync(tmpDir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmpDir;

const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");

const chromeCandidates = isWin
  ? ["C:/Program Files/Google/Chrome/Application/chrome.exe"]
  : process.platform === "darwin"
  ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

const detectedChrome = chromeCandidates.find((p) => fs.existsSync(p));
const browserExecutable = process.env.CHROME_EXE || detectedChrome || undefined;

function detectDefaultGl() {
  if (flags.gl && flags.gl !== "auto") return flags.gl;
  if (process.env.REMOTION_GL) return process.env.REMOTION_GL;
  if (process.platform !== "linux") return "angle";
  const hasNvidiaEgl = fs.existsSync("/usr/share/glvnd/egl_vendor.d/10_nvidia.json");
  const hasDrmGpu = fs.existsSync("/dev/dri/renderD128");
  return hasNvidiaEgl || hasDrmGpu ? "angle-egl" : "swangle";
}

const outDir = path.dirname(path.resolve(outPath));
if (outDir) fs.mkdirSync(outDir, { recursive: true });

const entryPoint = path.resolve(process.env.ENTRY || "src/index.ts");
const publicDir = path.resolve("public");
const serveUrl = await bundle({
  entryPoint,
  ...(fs.existsSync(publicDir) ? { publicDir } : {}),
});

const inputProps = draft ? { draft: true } : {};

async function renderWithGl(glMode) {
  const chromiumOptions = { gl: glMode };
  console.log(`[render-video] comp=${compId} out=${outPath} gl=${glMode} scale=${scale} crf=${crf} concurrency=${concurrency} draft=${draft}`);
  const t0 = Date.now();
  const composition = await selectComposition({
    serveUrl,
    id: compId,
    inputProps,
    ...(browserExecutable ? { browserExecutable } : {}),
    chromiumOptions,
  });

  let lastPct = -10;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf,
    scale,
    concurrency,
    inputProps,
    outputLocation: path.resolve(outPath),
    ...(browserExecutable ? { browserExecutable } : {}),
    chromiumOptions,
    timeoutInMilliseconds: 180000,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastPct + 10 || pct === 100) {
        lastPct = pct;
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`[render-video] ${pct}% (${elapsed}s)`);
      }
    },
  });
  const totalSec = (Date.now() - t0) / 1000;
  const fpsEff = composition.durationInFrames / Math.max(0.1, totalSec);
  console.log(`[render-video] DONE ${outPath} (${composition.durationInFrames}f in ${totalSec.toFixed(1)}s = ${fpsEff.toFixed(2)} fps, gl=${glMode})`);
}

const preferredGl = detectDefaultGl();
try {
  try {
    await renderWithGl(preferredGl);
  } catch (err) {
    if (!flags.gl && !process.env.REMOTION_GL && preferredGl !== "swangle") {
      console.warn(`[render-video] gl=${preferredGl} failed (${err?.message || err}); falling back to swangle...`);
      await renderWithGl("swangle");
    } else {
      throw err;
    }
  }
} finally {
  if (serveUrl && fs.existsSync(serveUrl)) {
    fs.rmSync(serveUrl, { recursive: true, force: true });
  }
}
