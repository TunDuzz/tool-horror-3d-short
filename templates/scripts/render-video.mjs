// Cross-platform Hardware-GPU-Accelerated Video Renderer for Horror Engine v15.0 (GTX 960 VRAM-Safe).
// Auto-detects Linux NVIDIA/DRM EGL ("angle-egl") with graceful fallback to "swangle",
// defaults to `concurrency=1` to protect 4-6GB VRAM GPUs from OOM / swangle fallback,
// logs GPU mode + live/final FPS, supports --draft / --low-vram, and cleans temp webpack bundles on exit.
//
// Usage:
//   node scripts/render-video.mjs <CompositionId> <out.mp4> [--scale 1|0.5|1.25|1.5] [--crf 16] [--concurrency 1] [--draft] [--low-vram|--no-low-vram] [--gl auto|angle-egl|swangle|angle]

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
    } else if (k === "low-vram") {
      flags.lowVram = true;
    } else if (k === "no-low-vram") {
      flags.lowVram = false;
    } else if (i + 1 < rawArgs.length) {
      flags[k] = rawArgs[++i];
    }
  } else {
    positional.push(a);
  }
}

const [compId, outPath] = positional;
if (!compId || !outPath) {
  console.error(
    "Usage: node scripts/render-video.mjs <CompositionId> <out.mp4> [--scale 1] [--crf 16] [--concurrency 1] [--draft] [--low-vram|--no-low-vram] [--gl auto]",
  );
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
// Default concurrency=1 prevents 4-6GB VRAM overflow (e.g. GTX 960 / 960M) and avoids software swangle fallback!
const concurrency = Math.max(1, Number(flags.concurrency ?? 1));

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
  const hasNvidiaEgl = fs.existsSync("/usr/share/glvnd/egl_vendor.d/10_nvidia.json");
  const hasDrmGpu = fs.existsSync("/dev/dri/renderD128");
  if (flags.gl && flags.gl !== "auto") {
    return { gl: flags.gl, reason: "explicit --gl", hasNvidiaEgl, hasDrmGpu };
  }
  if (process.env.REMOTION_GL) {
    return { gl: process.env.REMOTION_GL, reason: "REMOTION_GL env", hasNvidiaEgl, hasDrmGpu };
  }
  if (process.platform !== "linux") {
    return { gl: "angle", reason: `platform=${process.platform}`, hasNvidiaEgl, hasDrmGpu };
  }
  if (hasNvidiaEgl || hasDrmGpu) {
    return { gl: "angle-egl", reason: hasNvidiaEgl ? "NVIDIA EGL detected" : "DRM GPU detected", hasNvidiaEgl, hasDrmGpu };
  }
  return { gl: "swangle", reason: "no hardware EGL/DRM device", hasNvidiaEgl, hasDrmGpu };
}

const outDir = path.dirname(path.resolve(outPath));
if (outDir) fs.mkdirSync(outDir, { recursive: true });

const entryPoint = path.resolve(process.env.ENTRY || "src/index.ts");
const publicDir = path.resolve("public");
const serveUrl = await bundle({
  entryPoint,
  ...(fs.existsSync(publicDir) ? { publicDir } : {}),
});

const inputProps = {
  ...(draft ? { draft: true } : {}),
  ...(flags.lowVram !== undefined ? { lowVram: flags.lowVram } : {}),
};

async function renderWithGl(glMode, glReason) {
  const chromiumOptions = { gl: glMode };
  const hwLabel = glMode === "swangle" ? "SOFTWARE (swangle)" : `HARDWARE GPU (${glMode})`;
  console.log(
    `[render-video] comp=${compId} out=${outPath} gpu=${hwLabel} [${glReason}] scale=${scale} crf=${crf} concurrency=${concurrency} draft=${draft} lowVram=${flags.lowVram ?? "auto"}`,
  );
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
    onProgress: ({ progress, renderedFrames }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastPct + 10 || pct === 100) {
        lastPct = pct;
        const elapsed = Math.max(0.1, (Date.now() - t0) / 1000);
        const curFrames = typeof renderedFrames === "number" ? renderedFrames : Math.round(progress * composition.durationInFrames);
        const liveFps = curFrames / elapsed;
        console.log(`[render-video] ${pct}% (${curFrames}/${composition.durationInFrames}f in ${elapsed.toFixed(1)}s | ${liveFps.toFixed(2)} fps | gl=${glMode})`);
      }
    },
  });
  const totalSec = (Date.now() - t0) / 1000;
  const fpsEff = composition.durationInFrames / Math.max(0.1, totalSec);
  console.log(
    `[render-video] DONE ${outPath} (${composition.durationInFrames}f in ${totalSec.toFixed(1)}s = ${fpsEff.toFixed(2)} fps, gl=${glMode}, concurrency=${concurrency})`,
  );
}

const detected = detectDefaultGl();
try {
  try {
    await renderWithGl(detected.gl, detected.reason);
  } catch (err) {
    if (!flags.gl && !process.env.REMOTION_GL && detected.gl !== "swangle") {
      console.warn(`[render-video] gl=${detected.gl} failed (${err?.message || err}); falling back to swangle...`);
      await renderWithGl("swangle", "fallback after hardware GL error");
    } else {
      throw err;
    }
  }
} finally {
  if (serveUrl && fs.existsSync(serveUrl)) {
    fs.rmSync(serveUrl, { recursive: true, force: true });
  }
}
