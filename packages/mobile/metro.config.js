const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = getDefaultConfig(projectRoot);

// Only this package is the project root (entry point lives here)
config.projectRoot = projectRoot;

// Watch the shared package for live changes
config.watchFolders = [sharedRoot];

// Resolve packages from both mobile/node_modules and root/node_modules (hoisted)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
