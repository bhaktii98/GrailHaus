// Monorepo-aware Metro config: lets the app resolve the @grailhaus/shared
// workspace package and hoisted root node_modules.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// shared/ writes NodeNext-style relative imports (e.g. "./types.js" pointing
// at types.ts) so tsc/Node resolve it correctly — but Metro has no built-in
// notion of that convention and only knows how to resolve a literal .js
// file. Retry any relative ".js" specifier as ".ts" before falling through
// to Metro's normal resolution.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName.replace(/\.js$/, ".ts"), platform);
    } catch {
      // fall through
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
