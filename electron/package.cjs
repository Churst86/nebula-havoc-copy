const fs = require('fs');
const path = require('path');
const { packager } = require('@electron/packager');

const projectDir = path.resolve(__dirname, '..');
const releaseDir = path.join(projectDir, 'release', 'desktop');

async function main() {
  fs.rmSync(releaseDir, { recursive: true, force: true });

  await packager({
    dir: projectDir,
    out: releaseDir,
    overwrite: true,
    platform: 'win32',
    arch: 'x64',
    prune: true,
    asar: true,
    name: 'Nebula Havoc',
    executableName: 'Nebula Havoc',
    ignore: [
      /^\/\.git($|\\)/,
      /^\/base44($|\\)/,
      /^\/public($|\\)/,
      /^\/src($|\\)/,
      /^\/release($|\\)/,
      /^\/Launch-Nebula-Havoc\.bat$/,
    ],
  });

  console.log('Desktop package created in release\\desktop');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});