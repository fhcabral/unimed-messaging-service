import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, copyFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'messaging-api');
const frontend = join(root, 'frontend');
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';

function start(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    // npm.cmd requires the command interpreter on Windows; all npm args are fixed.
    shell: windows && command === npm,
    ...options,
  });
}

function run(command, args, options) {
  return new Promise((accept, reject) => {
    const child = start(command, args, options);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) accept();
      else reject(new Error(`${command} ${args.join(' ')} encerrou com ${signal ?? code}.`));
    });
  });
}

async function exists(path) {
  try { await access(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function prepareEnv(directory) {
  try {
    await copyFile(join(directory, '.env.example'), join(directory, '.env'), constants.COPYFILE_EXCL);
    console.log(`Criado ${directory === backend ? 'messaging-api' : 'frontend'}/.env.`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Preservado ${directory === backend ? 'messaging-api' : 'frontend'}/.env existente.`);
  }
}

function compose(args) {
  return run('docker', ['compose', '--project-directory', backend, '--env-file', join(backend, '.env'), '-f', join(backend, 'compose.yaml'), ...args]);
}

async function setup() {
  for (const directory of [frontend, backend]) {
    await run(npm, [await exists(join(directory, 'package-lock.json')) ? 'ci' : 'install'], { cwd: directory });
  }
  for (const directory of [frontend, backend]) await prepareEnv(directory);
  await compose(['up', '-d', '--wait', '--wait-timeout', '90', 'postgres']);
  await run(npm, ['run', 'migration:run'], { cwd: backend });
  console.log('Preparação concluída. Execute make dev ou npm run dev. O seed ocorrerá no bootstrap, antes das notificações.');
}

async function dev() {
  for (const directory of [frontend, backend]) {
    if (!await exists(join(directory, '.env'))) throw new Error('Execute make setup ou npm run setup antes de iniciar.');
  }
  const apiEnv = parseEnv(await readFile(join(backend, '.env'), 'utf8'));
  const children = [
    start(npm, ['run', 'start:dev'], {
      cwd: backend,
      detached: !windows,
      env: { ...process.env, DEMO_SEED_ENABLED: process.env.DEMO_SEED_ENABLED ?? apiEnv.DEMO_SEED_ENABLED ?? 'true' },
    }),
    start(npm, ['run', 'dev'], { cwd: frontend, detached: !windows }),
  ];
  let stopping = false;
  const live = new Set(children);
  let finish;
  const finished = new Promise((accept) => { finish = accept; });
  let forceTimer;

  function stop(exitCode) {
    if (stopping) return;
    stopping = true;
    process.exitCode = exitCode;
    for (const child of children) {
      if (!child.pid) continue;
      if (windows) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        killer.on('error', () => child.kill());
      } else {
        try { process.kill(-child.pid, 'SIGTERM'); }
        catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
      }
    }
    if (!live.size) finish();
    forceTimer = setTimeout(() => {
      if (!windows) for (const child of children) {
        if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already stopped. */ }
      }
      finish();
    }, 5000);
    forceTimer.unref();
  }

  const interrupt = () => stop(0);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  for (const child of children) {
    child.once('error', (error) => {
      console.error(error.message);
      live.delete(child);
      stop(1);
      if (!live.size) finish();
    });
    child.once('exit', (code, signal) => {
      live.delete(child);
      if (!stopping) {
        console.error(`Um serviço encerrou (${signal ?? code}); encerrando o outro.`);
        stop(code || 1);
      }
      if (!live.size) finish();
    });
  }
  await finished;
  clearTimeout(forceTimer);
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}

try {
  switch (process.argv[2]) {
    case 'setup': await setup(); break;
    case 'dev': await dev(); break;
    case 'stop': await compose(['stop']); break;
    case 'build':
      await run(npm, ['run', 'build'], { cwd: backend });
      await run(npm, ['run', 'build'], { cwd: frontend });
      break;
    default: throw new Error('Use setup, dev, stop ou build.');
  }
} catch (error) {
  console.error(`Falha: ${error.message}`);
  process.exitCode = 1;
}
