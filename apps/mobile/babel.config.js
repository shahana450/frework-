module.exports = function (api) {
  api.cache(true);

  // Inline EXPO_ROUTER_APP_ROOT and EXPO_ROUTER_IMPORT_MODE so that
  // expo-router's _ctx.android.js gets a static string in require.context().
  const inlineExpoRouterEnvVars = () => ({
    visitor: {
      MemberExpression(path) {
        if (!path.get('object').matchesPattern('process.env')) return;
        const key = path.node.property.name || path.node.property.value;
        if (key === 'EXPO_ROUTER_APP_ROOT') {
          path.replaceWith({ type: 'StringLiteral', value: process.env.EXPO_ROUTER_APP_ROOT || 'app' });
        } else if (key === 'EXPO_ROUTER_IMPORT_MODE') {
          path.replaceWith({ type: 'StringLiteral', value: process.env.EXPO_ROUTER_IMPORT_MODE || 'sync' });
        }
      },
    },
  });

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      inlineExpoRouterEnvVars,
      'react-native-reanimated/plugin',
    ],
  };
};
