const fs = require('fs');
const path = require('path');

console.log('[patch-expo-router] Starting patch...');
console.log('[patch-expo-router] cwd:', process.cwd());
console.log('[patch-expo-router] __dirname:', __dirname);

const projectRoot = process.cwd();
const expoRouterDir = path.join(projectRoot, 'node_modules', 'expo-router');
const appDir = path.join(projectRoot, 'app');

// Relative path from node_modules/expo-router/ to app/
// e.g. '../../app'
const relPath = path.relative(expoRouterDir, appDir).split(path.sep).join('/');
console.log('[patch-expo-router] Computed relPath:', relPath);

// Content to write for android/ios/default _ctx files
const androidContent = `export const ctx = require.context(
  '${relPath}',
  true,
  /^(?:\\.\\/)(?!(?:(?:(?:.*\\+api)|(?:\\+html)))\\.[tj]sx?$).*(?:\\.ios|\\.web)?\\.[tj]sx?$/,
  'sync'
);
`;

const defaultContent = `export const ctx = require.context(
  '${relPath}',
  true,
  // Ignore root \`./+html.js\` and API route files \`./generate+api.tsx\`.
  /^(?:\\.\\/)(?!(?:(?:(?:.*\\+api)|(?:\\+html)))\\.[tj]sx?$).*\\.[tj]sx?$/
);
`;

const iosContent = `export const ctx = require.context(
  '${relPath}',
  true,
  /^(?:\\.\\/)(?!(?:(?:(?:.*\\+api)|(?:\\+html)))\\.[tj]sx?$).*(?:\\.android|\\.web)?\\.[tj]sx?$/,
  'sync'
);
`;

const webContent = `export const ctx = require.context(
  '${relPath}',
  true,
  /^(?:\\.\\/)(?!(?:(?:(?:.*\\+api)|(?:\\+(html|native-intent))))\\.[tj]sx?$).*(?:\\.android|\\.ios|\\.native)?\\.[tj]sx?$/,
  'sync'
);
`;

const htmlContent = `/** Optionally import \`app/+html.js\` file. */
export const ctx = require.context(
  '${relPath}',
  false,
  /\\+html\\.[tj]sx?$/,
  'sync'
);
`;

const filesToPatch = [
  { file: path.join(expoRouterDir, '_ctx.android.js'), content: androidContent },
  { file: path.join(expoRouterDir, '_ctx.ios.js'), content: iosContent },
  { file: path.join(expoRouterDir, '_ctx.js'), content: defaultContent },
  { file: path.join(expoRouterDir, '_ctx.web.js'), content: webContent },
  { file: path.join(expoRouterDir, '_ctx-html.js'), content: htmlContent },
];

for (const { file, content } of filesToPatch) {
  if (!fs.existsSync(file)) {
    console.log('[patch-expo-router] File not found (skip):', file);
    continue;
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log('[patch-expo-router] Patched:', path.basename(file));
}

console.log('[patch-expo-router] Done. relPath used:', relPath);
