import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

interface ExecutionResult {
    success: boolean;
    output: string;
    error?: string;
}

const TIMEOUT_MS = 5000;
const TEMP_DIR = path.join(process.cwd(), ".temp_execution");

// Ensure temp dir exists
(async () => {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (err) {
        console.error("Failed to create temp dir:", err);
    }
})();

async function cleanup(files: string[]) {
    for (const file of files) {
        try {
            await fs.unlink(file);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

export async function executeCode(code: string, language: string): Promise<ExecutionResult> {
    const id = randomBytes(4).toString("hex");

    try {
        switch (language) {
            case "python":
            case "python3":
                return await executePython(code, id);
            case "c":
                return await executeC(code, id);
            case "cpp":
            case "c++":
                return await executeCpp(code, id);
            case "java":
                return await executeJava(code, id);
            case "javascript":
            case "js":
                return await executeJavaScript(code);
            default:
                return { success: false, output: "", error: "Unsupported language" };
        }
    } catch (error: any) {
        return {
            success: false,
            output: "",
            error: error.message || String(error),
        };
    }
}

async function executePython(code: string, id: string): Promise<ExecutionResult> {
    const filePath = path.join(TEMP_DIR, `${id}.py`);
    await fs.writeFile(filePath, code);

    try {
        const { stdout, stderr } = await execAsync(`python3 "${filePath}"`, { timeout: TIMEOUT_MS });
        return { success: true, output: stdout + (stderr || "") };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout || "",
            error: error.stderr || `Runtime Error: Process exited with code ${error.code}`
        };
    } finally {
        await cleanup([filePath]);
    }
}

async function executeC(code: string, id: string): Promise<ExecutionResult> {
    const sourcePath = path.join(TEMP_DIR, `${id}.c`);
    const outPath = path.join(TEMP_DIR, `${id}.out`);

    await fs.writeFile(sourcePath, code);

    try {
        // Compile
        try {
            await execAsync(`gcc "${sourcePath}" -o "${outPath}"`, { timeout: TIMEOUT_MS });
        } catch (compileError: any) {
            return {
                success: false,
                output: "",
                error: `Compilation Error:\n${compileError.stderr || compileError.message}`
            };
        }

        // Execute
        const { stdout, stderr } = await execAsync(`"${outPath}"`, { timeout: TIMEOUT_MS });
        return { success: true, output: stdout + (stderr || "") };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout || "",
            error: error.stderr || `Runtime Error: Process exited with code ${error.code}`
        };
    } finally {
        await cleanup([sourcePath, outPath]);
    }
}

async function executeCpp(code: string, id: string): Promise<ExecutionResult> {
    const sourcePath = path.join(TEMP_DIR, `${id}.cpp`);
    const outPath = path.join(TEMP_DIR, `${id}.out`);

    await fs.writeFile(sourcePath, code);

    try {
        // Compile
        try {
            await execAsync(`g++ "${sourcePath}" -o "${outPath}"`, { timeout: TIMEOUT_MS });
        } catch (compileError: any) {
            return {
                success: false,
                output: "",
                error: `Compilation Error:\n${compileError.stderr || compileError.message}`
            };
        }

        // Execute
        const { stdout, stderr } = await execAsync(`"${outPath}"`, { timeout: TIMEOUT_MS });
        return { success: true, output: stdout + (stderr || "") };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout || "",
            error: error.stderr || `Runtime Error: Process exited with code ${error.code}`
        };
    } finally {
        await cleanup([sourcePath, outPath]);
    }
}

async function executeJava(code: string, id: string): Promise<ExecutionResult> {
    const jobDir = path.join(TEMP_DIR, id);
    await fs.mkdir(jobDir, { recursive: true });

    const sourcePath = path.join(jobDir, "Main.java");
    await fs.writeFile(sourcePath, code);

    try {
        // Compile
        try {
            await execAsync(`javac "${sourcePath}"`, { timeout: TIMEOUT_MS });
        } catch (compileError: any) {
            return {
                success: false,
                output: "",
                error: `Compilation Error:\n${compileError.stderr || compileError.message}`
            };
        }

        // Execute
        const { stdout, stderr } = await execAsync(`cd "${jobDir}" && java Main`, { timeout: TIMEOUT_MS });
        return { success: true, output: stdout + (stderr || "") };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout || "",
            error: error.stderr || `Runtime Error: Process exited with code ${error.code}`
        };
    } finally {
        try {
            await fs.rm(jobDir, { recursive: true, force: true });
        } catch (e) { }
    }
}

async function executeJavaScript(code: string): Promise<ExecutionResult> {
    // Keep existing safe-ish eval logic or use node child process?
    // The user asked for "working fine without error".
    // The previous implementation used `new Function`. Let's stick to that for JS 
    // to maintain the same behavior as before (which was working), BUT wrapped in this interface.
    // OR, better, run it via `node` for consistency?
    // Running via `node` is safer against crashing the main process.
    // Let's switch JS to child_process 'node' execution as well for consistency and safety.

    const id = randomBytes(4).toString("hex");
    const filePath = path.join(TEMP_DIR, `${id}.js`);
    await fs.writeFile(filePath, code);

    try {
        const { stdout, stderr } = await execAsync(`node "${filePath}"`, { timeout: TIMEOUT_MS });
        return { success: true, output: stdout + (stderr || "") };
    } catch (error: any) {
        return { success: false, output: error.stdout || "", error: error.stderr || error.message };
    } finally {
        await cleanup([filePath]);
    }
}
