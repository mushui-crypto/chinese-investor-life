import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const electronVersion = JSON.parse(await readFile(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version;
const work = path.join(root, '.build', 'windows-portable');
const stage = path.join(work, 'app');
const packagedOut = path.join(work, 'electron-output');
const releaseDir = path.join(root, 'releases', `v${project.version}`);
const appFolderName = '中国式赌狗-Windows-便携版';
const archiveName = `中国式赌狗-v${project.version}-Windows-便携版.zip`;
const releaseArchive = path.join(releaseDir, archiveName);

await mkdir(releaseDir, { recursive: true });
for (const target of [releaseArchive, path.join(releaseDir, appFolderName)]) {
  try {
    await stat(target);
    throw new Error(`发布内容已存在，为避免覆盖，先移走它：${target}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await rm(work, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await run(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
await cp(path.join(root, 'dist'), path.join(stage, 'game'), { recursive: true });
await cp(path.join(root, 'desktop/windows/main.cjs'), path.join(stage, 'main.cjs'));
await writeFile(path.join(stage, 'package.json'), JSON.stringify({
  name: 'chinese-investor-life-desktop',
  productName: '中国式赌狗',
  version: project.version,
  description: '中国式赌狗：一生的筹码',
  author: '中国式赌狗',
  main: 'main.cjs',
}, null, 2));

const packaged = await packager({
  dir: stage,
  name: '中国式赌狗',
  platform: 'win32',
  arch: 'x64',
  out: packagedOut,
  electronVersion,
  appVersion: project.version,
  appCopyright: 'Copyright © 中国式赌狗',
  asar: true,
  prune: false,
  overwrite: true,
});
const portableFolder = path.join(releaseDir, appFolderName);
await cp(packaged[0], portableFolder, { recursive: true });
await writeFile(path.join(portableFolder, 'Windows便携版说明.txt'), `中国式赌狗 v${project.version} · Windows x64 便携版

使用方法：双击「中国式赌狗.exe」。不需要预装 Node.js、npm 或浏览器。

存档和设置保存在本文件夹中的 userdata 目录。复制或移动整个文件夹即可携带游戏及存档。若本文件夹所在位置不允许写入，程序会自动改存到当前 Windows 用户的应用数据目录。

如需将浏览器版存档带入桌面版，请先在浏览器版导出存档，再在游戏中的人生档案导入。

首次运行时，Windows 可能提示确认未知发布者；这是因为当前版本没有代码签名证书。
`);

await run('python3', ['scripts/zip_portable.py', portableFolder, releaseArchive], { cwd: root, stdio: 'inherit' });
await run('unzip', ['-tq', releaseArchive], { cwd: releaseDir, stdio: 'inherit' });
const archiveBytes = await readFile(releaseArchive);
console.log(JSON.stringify({
  version: project.version,
  electronVersion,
  platform: 'win32',
  architecture: 'x64',
  application: path.join(portableFolder, '中国式赌狗.exe'),
  archive: releaseArchive,
  bytes: archiveBytes.byteLength,
  sha256: createHash('sha256').update(archiveBytes).digest('hex'),
}, null, 2));
