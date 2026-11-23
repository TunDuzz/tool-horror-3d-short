// Cross-platform Hardware-GPU-Accelerated Pre-Final Still Gate renderer (Linux NVIDIA/Mesa EGL / macOS / Windows).
// Reuses a single Chromium browser instance across all frames (5-15x faster than cold-relaunching per still!)
// and auto-cleans its temporary webpack bundle on exit.
//
// Usage:
//   node scripts/render-stills.mjs <CompositionId> <outPrefix> <frame,frame,...> [scale]
//   node scripts/render-stills.mjs <CompositionId> <outPrefix> --manifest <still_manifest.json> [scale]
// Env:
//   REMOTION_TMP : temp/bundle directory (defaults to D:/remotion-tmp on Windows if D:/ exists, else os.tmpdir()/remotion-tmp)
//   ENTRY        : bundler entry point (defaults to src/index.ts)
//   CHROME_EXE   : optional browser executable override
//   REMOTION_GL  : override chromium gl backend (default: auto-detects Linux GPU -> "angle-egl", fallback "swangle"; Win/Mac -> "angle")

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const [compId, prefix] = args;
if (!compId || !prefix || args.length < 3) {
  console.error("Usage: node scripts/render-stills.mjs <CompositionId> <outPrefix> <frame,frame,... | --manifest still_manifest.json> [scale]");
  process.exit(1);
}

let jobs = [];
let scale = "1";
if (args[2] === "--manifest") {
  const manifestPath = args[3];
  scale = args[4] || "1";
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.error("Manifest file not found:", manifestPath);
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  jobs = items
    .filter((it) => Number.isFinite(Number(it.peakFrame)))
    .map((it) => ({
      frame: Number(it.peakFrame),
      tag: `${it.beatId || "B"}_f${it.peakFrame}`,
      intent: it.cameraIntent || "",
    }));
} else {
  const framesArg = args[2];
  scale = args[3] || "0.5";
  jobs = framesArg
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n) => ({ frame: n, tag: String(n), intent: "" }));
}
if (!jobs.length) {
  console.error("No valid frame numbers provided.");
  process.exit(1);
}

const isWin = process.platform === "win32";
const defaultTmp = isWin && fs.existsSync("D:/") ? "D:/remotion-tmp" : path.join(os.tmpdir(), "remotion-tmp");
const tmpDir = process.env.REMOTION_TMP || defaultTmp;
fs.mkdirSync(tmpDir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmpDir;

const { bundle } = await import("@remotion/bundler");
const { openBrowser, renderStill, selectComposition } = await import("@remotion/renderer");

const chromeCandidates = isWin
  ? ["C:/Program Files/Google/Chrome/Application/chrome.exe"]
  : process.platform === "darwin"
  ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

const detectedChrome = chromeCandidates.find((p) => fs.existsSync(p));
const browserExecutable = process.env.CHROME_EXE || detectedChrome || undefined;

function detectDefaultGl() {
  if (process.env.REMOTION_GL) return process.env.REMOTION_GL;
  if (process.platform !== "linux") return "angle";
  const hasNvidiaEgl = fs.existsSync("/usr/share/glvnd/egl_vendor.d/10_nvidia.json");
  const hasDrmGpu = fs.existsSync("/dev/dri/renderD128");
  return hasNvidiaEgl || hasDrmGpu ? "angle-egl" : "swangle";
}

const outDir = path.dirname(prefix);
if (outDir && outDir !== ".") fs.mkdirSync(outDir, { recursive: true });

const entryPoint = path.resolve(process.env.ENTRY || "src/index.ts");
const publicDir = path.resolve("public");
const serveUrl = await bundle({
  entryPoint,
  ...(fs.existsSync(publicDir) ? { publicDir } : {}),
});

const onBrowserLog = (l) => {
  if (l.type === "error" || l.type === "warning") {
    console.log(`[${l.type}]`, l.text.slice(0, 300));
  }
};

async function runWithGl(glMode) {
  const chromiumOptions = { gl: glMode };
  console.log(`[render-stills] gl=${glMode} scale=${scale} frames=${jobs.length}`);
  const browser = await openBrowser("chrome", {
    ...(browserExecutable ? { browserExecutable } : {}),
    chromiumOptions,
  });
  try {
    const composition = await selectComposition({
      serveUrl,
      id: compId,
      puppeteerInstance: browser,
      chromiumOptions,
    });
    const tAll = Date.now();
    for (const job of jobs) {
      const t0 = Date.now();
      const output = `${prefix}${job.tag}.jpg`;
      await renderStill({
        composition,
        serveUrl,
        puppeteerInstance: browser,
        frame: job.frame,
        output,
        imageFormat: "jpeg",
        jpegQuality: 88,
        scale: Number(scale),
        chromiumOptions,
        timeoutInMilliseconds: 180000,
        onBrowserLog,
      });
      console.log(
        "still",
        job.frame,
        "->",
        output,
        ((Date.now() - t0) / 1000).toFixed(1) + "s",
        job.intent ? `| ${job.intent}` : "",
      );
    }
    console.log(`[render-stills] done ${jobs.length} stills in ${((Date.now() - tAll) / 1000).toFixed(1)}s (gl=${glMode})`);
  } finally {
    await browser.close({ silent: true }).catch(() => {});
  }
}

const preferredGl = detectDefaultGl();
try {
  try {
    await runWithGl(preferredGl);
  } catch (err) {
    if (!process.env.REMOTION_GL && preferredGl !== "swangle") {
      console.warn(`[render-stills] gl=${preferredGl} failed (${err?.message || err}); falling back to swangle...`);
      await runWithGl("swangle");
    } else {
      throw err;
    }
  }
} finally {
  if (serveUrl && fs.existsSync(serveUrl)) {
    fs.rmSync(serveUrl, { recursive: true, force: true });
  }
}
