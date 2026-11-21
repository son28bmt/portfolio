import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
};
const adminEsbuild = path.join(root, 'admin', 'node_modules', 'esbuild', 'bin', 'esbuild');
const tempValidation = path.join(root, 'admin', '__layout-schema-test.mjs');
const tempRenderer = path.join(root, 'admin', '__renderer-static-test.mjs');
const tempCss = path.join(root, 'admin', '__renderer-static-test.css');
const cleanup = () => [tempValidation, tempRenderer, tempCss].forEach(file => { if (existsSync(file)) rmSync(file, { force: true }); });

try {
  run(process.execPath, ['--test', 'tests'], path.join(root, 'server'));
  run(process.execPath, ['--test', 'rendererUtils.test.js'], path.join(root, 'shared', 'layout-post-renderer'));
  run(process.execPath, ['--test', 'src/features/block-post/store/history.test.js', 'src/features/block-post/store/useBlockPostStore.test.js', 'src/features/block-post/utils/blockContent.test.js'], path.join(root, 'admin'));
  run(process.execPath, [adminEsbuild, 'admin/src/features/block-post/validation/layoutSchema.test.js', '--bundle', '--platform=node', '--format=esm', '--external:dompurify', '--alias:@layout-post-renderer=' + path.join(root, 'shared', 'layout-post-renderer'), '--outfile=' + tempValidation], root);
  run(process.execPath, [tempValidation], root);
  run(process.execPath, [adminEsbuild, 'shared/layout-post-renderer/BlockPostRenderer.static.test.jsx', '--bundle', '--platform=node', '--format=esm', '--jsx=automatic', '--external:react', '--external:react-dom/server', '--external:dompurify', '--outfile=' + tempRenderer], root);
  run(process.execPath, [tempRenderer], root);
} finally { cleanup(); }