import { exec, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

const IS_WIN = process.platform === "win32";
const TIMEOUT_MS = 10000;
const TEMP_DIR = path.join(process.cwd(), ".temp_execution");

// Ensure temp dir exists
(async () => {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (err) {
        console.error("Failed to create temp dir:", err);
    }
})();

// Cache of resolved absolute binary paths
const resolvedBinaries: Record<string, string | null> = {};

/**
 * Resolves the absolute path of a system binary.
 * Uses `where` on Windows, `which` on Mac/Linux.
 * Returns null if not found.
 */
async function resolveBinary(name: string): Promise<string | null> {
    if (name in resolvedBinaries) return resolvedBinaries[name];
    try {
        const cmd = IS_WIN ? `where ${name}` : `which ${name}`;
        const { stdout } = await execAsync(cmd);
        // `where` on Windows may return multiple lines; take the first
        const resolved = stdout.split(/\r?\n/)[0].trim();
        resolvedBinaries[name] = resolved || null;
    } catch {
        resolvedBinaries[name] = null;
    }
    return resolvedBinaries[name];
}

/** User-friendly error message when a required tool is missing. */
function missingToolError(tool: string, language: string): string {
    const hints: Record<string, string> = {
        python3:  "Linux: sudo apt-get install python3 | Mac: brew install python3 | Windows: https://python.org",
        python:   "Windows: https://python.org",
        node:     "All platforms: https://nodejs.org",
        gcc:      "Linux: sudo apt-get install gcc | Mac: brew install gcc | Windows: https://mingw-w64.org",
        "g++":    "Linux: sudo apt-get install g++ | Mac: brew install gcc | Windows: https://mingw-w64.org",
        javac:    "Linux: sudo apt-get install default-jdk | Mac: brew install openjdk | Windows: https://adoptium.net",
        java:     "Linux: sudo apt-get install default-jre | Mac: brew install openjdk | Windows: https://adoptium.net",
    };
    const hint = hints[tool] ?? `Please install '${tool}' on the server.`;
    return `❌ Cannot run ${language}: '${tool}' is not installed on this server.\r\n💡 ${hint}\r\n`;
}

// ─── Map of running interactive sessions ──────────────────────────────────────
const activeSessions = new Map<string, { process: any; timeout: ReturnType<typeof setTimeout> }>();

// ─── Public API ───────────────────────────────────────────────────────────────

export async function executeCode(): Promise<{ success: boolean; output: string; error?: string }> {
    return { success: false, output: "", error: "Use interactive execution for inputs." };
}

/**
 * JavaScript prompt() shim injected at the top of every JS file so that
 * code using prompt() in Node.js reads synchronously from stdin.
 */
const JS_PROMPT_SHIM = `
const { execFileSync } = require('child_process');
function prompt(msg) {
  if (msg) process.stdout.write(msg);
  try {
    // Read one line synchronously from stdin
    const buf = Buffer.alloc(1024);
    let total = '';
    const fd = require('fs').openSync('/dev/stdin', 'rs');
    while (true) {
      const n = require('fs').readSync(fd, buf, 0, 1, null);
      if (n === 0) break;
      const ch = buf.slice(0, n).toString();
      total += ch;
      if (ch === '\\n') break;
    }
    return total.trimEnd();
  } catch { return ''; }
}
`;

const JS_PROMPT_SHIM_WIN = `
function prompt(msg) {
  if (msg) process.stdout.write(msg);
  const lines = require('fs').readFileSync('\\\\.\\\\CON').toString();
  return lines.split('\\n')[0].trimEnd();
}
`;

export async function startInteractiveExecution(
    code: string,
    language: string,
    roomId: string,
    onData: (data: string) => void,
    onExit: (code: number) => void,
): Promise<string> {
    if (activeSessions.has(roomId)) stopInteractiveExecution(roomId);

    const id = randomBytes(4).toString("hex");
    const jobDir = path.join(TEMP_DIR, id);
    await fs.mkdir(jobDir, { recursive: true });

    let command = "";
    let args: string[] = [];
    const normLang = language.toLowerCase();

    // ── Compile / prepare ─────────────────────────────────────────────────────
    try {
        if (normLang === "python" || normLang === "python3") {
            // Try python3 first, fall back to python (Windows)
            const bin = (await resolveBinary("python3")) ?? (await resolveBinary("python"));
            if (!bin) throw new Error(missingToolError("python3", "Python"));
            const fp = path.join(jobDir, "main.py");
            await fs.writeFile(fp, code);
            command = bin;
            args = ["-u", "main.py"]; // -u = unbuffered

        } else if (normLang === "javascript" || normLang === "js") {
            const bin = await resolveBinary("node");
            if (!bin) throw new Error(missingToolError("node", "JavaScript"));
            // Inject a prompt() shim so browser-style JS code works in Node
            const shim = IS_WIN ? JS_PROMPT_SHIM_WIN : JS_PROMPT_SHIM;
            const fp = path.join(jobDir, "main.js");
            await fs.writeFile(fp, shim + "\n" + code);
            command = bin;
            args = ["main.js"];

        } else if (normLang === "c") {
            const gcc = (await resolveBinary("gcc")) ?? (await resolveBinary("gcc.exe"));
            if (!gcc) throw new Error(missingToolError("gcc", "C"));
            const src = path.join(jobDir, "main.c");
            const out = path.join(jobDir, IS_WIN ? "main.exe" : "main.out");
            await fs.writeFile(src, code);
            try {
                await execAsync(`"${gcc}" "${src}" -o "${out}"`, { timeout: TIMEOUT_MS });
            } catch (err: any) {
                throw new Error(`Compilation error:\r\n${err.stderr || err.message}`);
            }
            command = out;

        } else if (normLang === "cpp" || normLang === "c++") {
            const gpp = (await resolveBinary("g++")) ?? (await resolveBinary("g++.exe"));
            if (!gpp) throw new Error(missingToolError("g++", "C++"));
            const src = path.join(jobDir, "main.cpp");
            const out = path.join(jobDir, IS_WIN ? "main.exe" : "main.out");
            await fs.writeFile(src, code);
            try {
                await execAsync(`"${gpp}" "${src}" -o "${out}"`, { timeout: TIMEOUT_MS });
            } catch (err: any) {
                throw new Error(`Compilation error:\r\n${err.stderr || err.message}`);
            }
            command = out;

        } else if (normLang === "java") {
            const javac = (await resolveBinary("javac")) ?? (await resolveBinary("javac.exe"));
            if (!javac) throw new Error(missingToolError("javac", "Java"));
            const javaRt = (await resolveBinary("java")) ?? (await resolveBinary("java.exe"));
            if (!javaRt) throw new Error(missingToolError("java", "Java"));
            // Java requires the filename matches the public class name
            const match = code.match(/public\s+class\s+(\w+)/);
            const className = match ? match[1] : "Main";
            const src = path.join(jobDir, `${className}.java`);
            await fs.writeFile(src, code);
            try {
                await execAsync(`"${javac}" "${src}"`, { timeout: TIMEOUT_MS });
            } catch (err: any) {
                throw new Error(`Compilation error:\r\n${err.stderr || err.message}`);
            }
            command = javaRt;
            args = [className];

        } else {
            throw new Error(`Language '${language}' is not supported yet.`);
        }
    } catch (err: any) {
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });
        throw new Error(err.message ?? "Compilation failed");
    }

    // ── Spawn the process ─────────────────────────────────────────────────────
    let ptyProcess: any;
    try {
        let pty: any;
        try { pty = require("node-pty"); }
        catch { const m = await import("node-pty"); pty = (m as any).default ?? m; }

        ptyProcess = pty.spawn(command, args, {
            name: "xterm-color",
            cols: 80, rows: 24,
            cwd: jobDir,
            env: process.env,
        });
        ptyProcess.onData((data: string) => onData(data));
        ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
            onExit(exitCode);
            activeSessions.delete(roomId);
            fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });
        });

    } catch (e: any) {
        console.warn("[EXEC] node-pty unavailable, using spawn fallback. Reason:", e.message);

        ptyProcess = spawn(command, args, { cwd: jobDir });
        ptyProcess.stdout.on("data", (d: Buffer) => onData(d.toString()));
        ptyProcess.stderr.on("data", (d: Buffer) => onData(d.toString()));
        ptyProcess.on("close", (code: number) => {
            onExit(code ?? 0);
            activeSessions.delete(roomId);
            fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });
        });
        ptyProcess.on("error", (err: Error) => onData(`Process error: ${err.message}\r\n`));
    }

    // Hard 30-second timeout
    const timeout = setTimeout(() => {
        if (activeSessions.has(roomId)) {
            onData("\r\n--- Execution timed out after 30 seconds ---\r\n");
            stopInteractiveExecution(roomId);
        }
    }, 30000);

    activeSessions.set(roomId, { process: ptyProcess, timeout });
    return id;
}

export function writeInteractiveInput(roomId: string, data: string) {
    const session = activeSessions.get(roomId);
    if (!session?.process) return;
    if (typeof session.process.write === "function") {
        session.process.write(data);           // node-pty
    } else if (session.process.stdin) {
        try { session.process.stdin.write(data); } catch { } // spawn
    }
}

export function stopInteractiveExecution(roomId: string) {
    const session = activeSessions.get(roomId);
    if (!session) return;
    clearTimeout(session.timeout);
    try { session.process.kill("SIGKILL"); } catch { }
    activeSessions.delete(roomId);
}
