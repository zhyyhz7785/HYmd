import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __dirname: string | undefined;

export interface RunResult {
  stdout: string;
  stderr: string;
}

function moduleDir(): string {
  try {
    const metaUrl = import.meta.url;
    if (metaUrl) return dirname(fileURLToPath(metaUrl));
  } catch {
    /* cjs bundle：import.meta 不可用 */
  }
  if (typeof __dirname !== 'undefined' && __dirname) return __dirname;
  return process.cwd();
}

/** 运行外部命令；非 0 退出码抛错（附 stderr 摘要） */
export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    // Windows 上 .cmd/.bat 必须经 shell 启动（Node 对其禁用了直接 spawn）
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: needsShell,
      timeout: options.timeoutMs ?? 180_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString('utf8')));

    child.on('error', (err) => {
      reject(new Error(`无法启动 ${command}：${err.message}`));
    });
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        const tail = stderr.trim().split('\n').slice(-8).join('\n');
        reject(
          new Error(
            `${command} 退出码 ${code ?? `signal:${signal}`}\n命令：${command} ${args.join(' ')}\n${tail}`,
          ),
        );
      }
    });
  });
}

/** Pandoc 可执行路径（默认 PATH 上的 pandoc） */
export function resolvePandoc(customPath?: string): string {
  return customPath?.trim() || 'pandoc';
}

/** 检查 Pandoc 可用性，返回版本首行；不可用抛中文错误 */
export async function checkPandoc(pandocPath?: string): Promise<string> {
  const exe = resolvePandoc(pandocPath);
  try {
    const { stdout } = await runCommand(exe, ['--version'], { timeoutMs: 15_000 });
    return stdout.split('\n')[0]?.trim() ?? 'pandoc';
  } catch {
    throw new Error(
      `未找到 Pandoc（尝试运行 ${exe} 失败）。请安装：https://pandoc.org/installing.html，` +
        `或在设置中指定 pandoc 可执行文件路径。`,
    );
  }
}

export interface MarpInvocation {
  command: string;
  args: string[];
}

/**
 * 解析 Marp CLI 调用方式：
 * 1. 自定义路径（可执行文件或 .cmd）
 * 2. 依赖树中的 @marp-team/marp-cli（node <marp-cli.js> 运行）
 * 3. PATH 上的 marp
 */
export function resolveMarpCli(customPath?: string, fromDir?: string): MarpInvocation {
  if (customPath?.trim()) {
    return { command: customPath.trim(), args: [] };
  }

  const searchDirs = [fromDir, moduleDir()].filter((d): d is string => !!d);
  for (const dir of searchDirs) {
    try {
      const req = createRequire(join(dir, 'noop.js'));
      const pkgJsonPath = req.resolve('@marp-team/marp-cli/package.json');
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
        bin?: string | Record<string, string>;
      };
      const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.marp;
      if (binRel) {
        const binPath = join(dirname(pkgJsonPath), binRel);
        if (existsSync(binPath)) {
          return { command: process.execPath, args: [binPath] };
        }
      }
    } catch {
      /* 尝试下一个目录 */
    }
  }

  return { command: process.platform === 'win32' ? 'marp.cmd' : 'marp', args: [] };
}

/** 常见 Chromium 系浏览器路径探测（Marp 渲染与 PDF 打印用） */
export function resolveBrowser(customPath?: string): string | undefined {
  if (customPath?.trim() && existsSync(customPath.trim())) return customPath.trim();

  const local = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.HYMD_BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    local ? join(local, 'Google\\Chrome\\Application\\chrome.exe') : undefined,
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return undefined;
}
