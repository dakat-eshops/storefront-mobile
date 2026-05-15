// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
// Workspace root is two levels up — note: contains a space ("VS CODE"), Metro handles it.
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the cross-repo BO packages/db so we can import shared types/schemas.
config.watchFolders = [workspaceRoot];

// Resolve modules from this project first, then fall back to workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

// Block server-only files from @eshops/db so React Native bundle stays lean.
// Allow only the types entry point.
config.resolver.blockList = [
  /BO\/e-Shops\/packages\/db\/src\/(?!index\.ts$).*\.ts$/,
];

module.exports = config;
