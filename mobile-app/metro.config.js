const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
const appNodeModules = path.resolve(projectRoot, 'node_modules');

// Keep Metro resolution scoped to this Expo app instead of the workspace root,
// while still allowing React Native to resolve its nested internal packages.
config.resolver.nodeModulesPaths = [
  appNodeModules,
  path.resolve(appNodeModules, 'react-native', 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = false;
config.resolver.unstable_enablePackageExports = true;
config.resolver.extraNodeModules = {
  '@firebase/app': path.resolve(appNodeModules, '@firebase', 'app'),
  '@firebase/auth': path.resolve(appNodeModules, '@firebase', 'auth'),
  '@react-native/virtualized-lists': path.resolve(appNodeModules, '@react-native', 'virtualized-lists'),
  'prop-types': path.resolve(appNodeModules, 'prop-types'),
  'react-native-svg': path.resolve(appNodeModules, 'react-native-svg'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('event-target-shim') &&
    context.originModulePath.includes('react-native-webrtc')
  ) {
    return {
      filePath: path.resolve(appNodeModules, 'event-target-shim', 'es5.js'),
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
