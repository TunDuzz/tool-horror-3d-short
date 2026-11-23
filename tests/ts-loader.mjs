// Test-only Node 22 ESM hook: resolves extensionless .ts/.tsx relative imports, .tsx JSX via esbuild,
// and bare packages from shorts-project/node_modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks, createRequire } from "node:module";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP_NODE_MODULES = path.join(REPO_ROOT, "shorts-project", "node_modules");
const spRequire = createRequire(path.join(SP_NODE_MODULES, "_synthetic.js"));
const esbuild = spRequire("esbuild");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier) && context.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
        const candidate = path.resolve(parentDir, specifier + ext);
        if (fs.existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
      const idx = path.resolve(parentDir, specifier, "index.ts");
      if (fs.existsSync(idx)) {
        return { url: pathToFileURL(idx).href, shortCircuit: true };
      }
    }
    if (!specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("node:") && !specifier.startsWith("file:")) {
      try {
        return nextResolve(specifier, context);
      } catch {
        const syntheticParent = pathToFileURL(path.join(SP_NODE_MODULES, "_synthetic.js")).href;
        return nextResolve(specifier, { ...context, parentURL: syntheticParent });
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) {
      const filePath = fileURLToPath(url);
      const src = fs.readFileSync(filePath, "utf-8");
      const out = esbuild.transformSync(src, { loader: "tsx", format: "esm", jsx: "automatic", target: "node22" });
      return { format: "module", source: out.code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
