const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const patchedCtx = path.resolve(__dirname, 'patches/_ctx.android.js');
const virtualViewStub = path.resolve(__dirname, 'patches/VirtualViewStub.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect expo-router/_ctx to our file with static require.context() strings.
  if (moduleName === 'expo-router/_ctx' || moduleName === 'expo-router/_ctx.android') {
    console.log('[metro] Intercepted', moduleName, '→ patches/_ctx.android.js');
    return { filePath: patchedCtx, type: 'sourceFile' };
  }

  // Stub out VirtualView — it uses TC39 pattern-matching syntax (`match`)
  // that hermes-parser 0.23.x cannot parse. The app does not use this component.
  if (moduleName.endsWith('VirtualView') || moduleName.includes('virtualview/VirtualView')) {
    console.log('[metro] Stubbing VirtualView');
    return { filePath: virtualViewStub, type: 'sourceFile' };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
