// Test-only Node 22 ESM hook: resolves extensionless .ts/.tsx relative imports and bare packages from shorts-project/node_modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP_NODE_MODULES = path.join(REPO_ROOT, "shorts-project", "node_modules");

registerHooks({
  resolve(specifier, context, nextResolve) {
    // 1. Extensionless relative imports inside templates/engine or tests
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
    // 2. Bare package specifiers resolved against shorts-project/node_modules when root has no node_modules
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
});
