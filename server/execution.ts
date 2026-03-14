import { exec, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

// Map of running interactive sessions
const activeSessions = new Map<string, any>();

interface ExecutionResult {
    success: boolean;
    output: string;
    error?: string;
}

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

export async function executeCode(code: string, language: string, input: string = ""): Promise<ExecutionResult> {
    // This is synchronous REST execution, but interactive runs will use startInteractiveExecution.
    // We provide a basic fallback here.
    return { success: false, output: "", error: "Use interactive execution for inputs." };
}

// ==========================================
// INTERACTIVE EXECUTION (node-pty / spawn fallback)
// ==========================================

export async function startInteractiveExecution(
    code: string,
    language: string,
    roomId: string,
    onData: (data: string) => void,
    onExit: (code: number) => void
): Promise<string> {
    // If there's an existing session for this room, kill it
    if (activeSessions.has(roomId)) {
        stopInteractiveExecution(roomId);
    }

    const id = randomBytes(4).toString("hex");
    const jobDir = path.join(TEMP_DIR, id);
    await fs.mkdir(jobDir, { recursive: true });

    let command = "";
    let args: string[] = [];
    let cwd = jobDir;

    // Normalization to catch Piston/Frontend lang names
    const normLang = language.toLowerCase();

    try {
        if (normLang === "python" || normLang === "python3") {
            const filePath = path.join(jobDir, "main.py");
            await fs.writeFile(filePath, code);
            command = "python3";
            args = ["-u", "main.py"]; // -u for unbuffered output
        } else if (normLang === "javascript" || normLang === "js") {
            const filePath = path.join(jobDir, "main.js");
            await fs.writeFile(filePath, code);
            command = "node";
            args = ["main.js"];
        } else if (normLang === "c") {
            const sourcePath = path.join(jobDir, "main.c");
            const outPath = path.join(jobDir, "main.out");
            await fs.writeFile(sourcePath, code);
            try {
                await execAsync(`gcc "${sourcePath}" -o "${outPath}"`, { timeout: TIMEOUT_MS });
            } catch (err: any) {
                throw new Error(`Compilation error: ${err.stderr || err.message}`);
            }
            command = outPath;
        } else if (normLang === "cpp" || normLang === "c++") {
            const sourcePath = path.join(jobDir, "main.cpp");
            const outPath = path.join(jobDir, "main.out");
            await fs.writeFile(sourcePath, code);
            try {
                await execAsync(`g++ "${sourcePath}" -o "${outPath}"`, { timeout: TIMEOUT_MS });
            } catch (err: any) {
                throw new Error(`Compilation error: ${err.stderr || err.message}`);
            }
            command = outPath;
        } else if (normLang === "java") {
            // Detect the public class name to use as the filename (Java requirement)
            const classNameMatch = code.match(/public\s+class\s+(\w+)/);
            const className = classNameMatch ? classNameMatch[1] : "Main";
            const sourcePath = path.join(jobDir, `${className}.java`);
            await fs.writeFile(sourcePath, code);
            try {
                await execAsync(`javac "${sourcePath}"`, { timeout: TIMEOUT_MS });
            } catch (err: any) {
                throw new Error(`Compilation error: ${err.stderr || err.message}`);
            }
            command = "java";
            args = [className];
        } else {
            throw new Error(`Language '${language}' is not supported yet.`);
        }
    } catch (err: any) {
        // Cleanup on compile error
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });
        throw new Error(err.message || "Compilation failed");
    }

    let ptyProcess: any;
    try {
        let executablePath = command;

        // For node-pty, we need fully resolved paths or it fails with posix_spawnp
        if (normLang !== "c" && normLang !== "cpp" && normLang !== "c++") {
            try {
                const { stdout } = await execAsync(`which ${command}`);
                if (stdout.trim()) {
                    executablePath = stdout.trim();
                }
            } catch (e) {
                // Ignore if which fails
            }
        }

        // Try node-pty first
        let pty;
        try {
            pty = require("node-pty");
        } catch (e) {
            const ptyModule = await import("node-pty");
            pty = ptyModule.default || ptyModule;
        }

        // For C/C++ our command is an absolute path to the out file
        // To avoid posix_spawnp fail (which happens if bash can't resolve command directly)
        // We will just directly spawn the executable for c/c++, and spawn 'python3', 'node', 'javac', etc directly.
        ptyProcess = pty.spawn(executablePath, args, {
            name: "xterm-color",
            cols: 80,
            rows: 24,
            cwd: cwd,
            env: process.env
        });

        ptyProcess.onData((data: string) => {
            onData(data);
        });

        ptyProcess.onExit((event: { exitCode: number, signal: number }) => {
            onExit(event.exitCode);
            activeSessions.delete(roomId);
            fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });
        });
    } catch (e: any) {
        console.warn("node-pty not available, falling back to spawn. Reason:", e.message);

        // Fallback to standard spawn
        ptyProcess = spawn(command, args, { cwd });

        ptyProcess.stdout.on("data", (data: Buffer) => {
            // Because fallback spawn doesn't have a PTY, text usually won't flush until the end for C++.
            onData(data.toString());
        });

        ptyProcess.stderr.on("data", (data: Buffer) => {
            onData(data.toString());
        });

        ptyProcess.on("close", (code: number) => {
            onExit(code ?? 0);
            activeSessions.delete(roomId);
            fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });
        });

        ptyProcess.on("error", (err: Error) => {
            const missingTool = err.message.includes("ENOENT") ? `Ensure compiler/runtime is installed for '${language}'.` : "";
            onData(`Process error: ${err.message}\n${missingTool}`);
        });

    }

    // Set absolute hard timeout of 30 seconds
    const timeout = setTimeout(() => {
        if (activeSessions.has(roomId)) {
            onData("\r\n--- Execution timed out after 30 seconds ---\r\n");
            stopInteractiveExecution(roomId);
        }
    }, 30000);

    activeSessions.set(roomId, {
        process: ptyProcess,
        timeout
    });

    return id;
}

export function writeInteractiveInput(roomId: string, data: string) {
    const session = activeSessions.get(roomId);
    if (session && session.process) {
        if (typeof session.process.write === "function") {
            // It's a node-pty process
            session.process.write(data);
        } else if (session.process.stdin) {
            // It's a standard spawn process
            try {
                session.process.stdin.write(data);

                // Native spawn does not echo inputted characters back to stdout like a PTY does. 
                // We have to simulate the echo so the user can see what they type in the terminal.
                // Import the SocketServer IO instance or simply rely on the fact that the receiver 
                // is already emitting this data directly? Actually, wait. Let's just pass an `onEcho` into `startInteractiveExecution` instead.
            } catch (e) { }
        }
    }
}

export function stopInteractiveExecution(roomId: string) {
    const session = activeSessions.get(roomId);
    if (session) {
        clearTimeout(session.timeout);
        if (typeof session.process.kill === "function") {
            try {
                session.process.kill("SIGKILL");
            } catch (e) { }
        }
        activeSessions.delete(roomId);
    }
}
