// Cross-platform Hardware-GPU-Accelerated Pre-Final Still Gate & v12.0 5-Layer Semantic Auditor.
// Reuses a single Chromium browser instance across all frames and optionally captures 3D Frustum + 9-Ray Occlusion
// telemetry (`--audit` / `--strict-audit`), invoking `scripts/audit_storyboard.py` to generate `storyboard_proof.html`!
//
// Usage:
//   node scripts/render-stills.mjs <CompositionId> <outPrefix> <frame,frame,...> [scale]
//   node scripts/render-stills.mjs <CompositionId> <outPrefix> --manifest <still_manifest.json> [scale] [--audit] [--strict-audit]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const rawArgs = process.argv.slice(2);
let audit = false;
let strictAudit = false;
let scaleOverride = null;
const cleanArgs = [];

for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === "--audit") {
    audit = true;
  } else if (a === "--strict-audit") {
    audit = true;
    strictAudit = true;
  } else if (a === "--scale" && i + 1 < rawArgs.length) {
    scaleOverride = rawArgs[++i];
  } else {
    cleanArgs.push(a);
  }
}

const [compId, prefix] = cleanArgs;
if (!compId || !prefix || cleanArgs.length < 3) {
  console.error(
    "Usage: node scripts/render-stills.mjs <CompositionId> <outPrefix> <frame,frame,... | --manifest still_manifest.json> [scale] [--audit] [--strict-audit]",
  );
  process.exit(1);
}

let jobs = [];
let scale = "1";
let manifestPathUsed = null;

if (cleanArgs[2] === "--manifest") {
  const manifestPath = cleanArgs[3];
  scale = scaleOverride || cleanArgs[4] || "0.75";
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.error("Manifest file not found:", manifestPath);
    process.exit(1);
  }
  manifestPathUsed = path.resolve(manifestPath);
  const items = JSON.parse(fs.readFileSync(manifestPathUsed, "utf-8"));
  jobs = items
    .filter((it) => Number.isFinite(Number(it.peakFrame)))
    .map((it, idx) => {
      const fNum = Number(it.peakFrame);
      const baseTag = it.tag || `${it.beatId || `B${idx + 1}`}`;
      const tag = `${baseTag}_f${fNum}`;
      return {
        index: idx,
        frame: fNum,
        tag,
        intent: it.cameraIntent || "",
        spokenAtFrame: it.spokenAtFrame || "",
        mustShow: Array.isArray(it.mustShow) ? it.mustShow : [],
      };
    });
} else {
  const framesArg = cleanArgs[2];
  scale = scaleOverride || cleanArgs[3] || "0.5";
  jobs = framesArg
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n, idx) => ({ index: idx, frame: n, tag: String(n), intent: "", spokenAtFrame: "", mustShow: [] }));
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

const outDir = path.dirname(path.resolve(prefix));
fs.mkdirSync(outDir, { recursive: true });

const entryPoint = path.resolve(process.env.ENTRY || "src/index.ts");
const publicDir = path.resolve("public");
const serveUrl = await bundle({
  entryPoint,
  ...(fs.existsSync(publicDir) ? { publicDir } : {}),
});

const auditByFrame = {};
const AUDIT_PREFIX = "__HORROR_AUDIT__";

const onBrowserLog = (l) => {
  if (typeof l.text === "string" && l.text.includes(AUDIT_PREFIX)) {
    const idx = l.text.indexOf(AUDIT_PREFIX);
    const rawJson = l.text.slice(idx + AUDIT_PREFIX.length).trim();
    try {
      const parsed = JSON.parse(rawJson);
      if (typeof parsed.frame === "number") {
        auditByFrame[parsed.frame] = parsed;
      }
    } catch {
      // ignore malformed log chunk
    }
    return;
  }
  if (l.type === "error" || l.type === "warning") {
    console.log(`[${l.type}]`, l.text.slice(0, 300));
  }
};

const inputProps = audit ? { auditStills: true } : {};

async function runWithGl(glMode) {
  const chromiumOptions = { gl: glMode };
  console.log(`[render-stills] gl=${glMode} scale=${scale} frames=${jobs.length} audit=${audit}`);
  const browser = await openBrowser("chrome", {
    ...(browserExecutable ? { browserExecutable } : {}),
    chromiumOptions,
  });
  try {
    const composition = await selectComposition({
      serveUrl,
      id: compId,
      inputProps,
      puppeteerInstance: browser,
      chromiumOptions,
    });
    const tAll = Date.now();
    for (const job of jobs) {
      const t0 = Date.now();
      const output = `${prefix}${job.tag}.jpg`;
      job.imagePath = path.resolve(output);
      await renderStill({
        composition,
        serveUrl,
        puppeteerInstance: browser,
        frame: job.frame,
        inputProps,
        output,
        imageFormat: "jpeg",
        jpegQuality: 90,
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
        job.spokenAtFrame ? `| ${job.spokenAtFrame}` : job.intent ? `| ${job.intent}` : "",
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

if (audit) {
  const rawAuditPath = path.join(outDir, "still_audit_raw.json");
  const payload = {
    compositionId: compId,
    scale: Number(scale),
    jobs: jobs.map((j) => ({
      index: j.index,
      frame: j.frame,
      tag: j.tag,
      imagePath: j.imagePath,
    })),
    frames: auditByFrame,
  };
  fs.writeFileSync(rawAuditPath, JSON.stringify(payload, null, 2));

  const auditPyCandidates = [
    path.resolve("scripts/audit_storyboard.py"),
    path.resolve("../templates/scripts/audit_storyboard.py"),
  ];
  const auditPy = auditPyCandidates.find((p) => fs.existsSync(p));
  if (auditPy && manifestPathUsed) {
    const pyCmd = process.platform === "win32" ? "python" : "python3";
    const pyArgs = [auditPy, "--manifest", manifestPathUsed, "--raw", rawAuditPath, "--out-dir", outDir];
    if (strictAudit) pyArgs.push("--strict");
    const res = spawnSync(pyCmd, pyArgs, { stdio: "inherit" });
    if ((res.status ?? 1) !== 0) {
      process.exit(res.status ?? 1);
    }
  }
}
