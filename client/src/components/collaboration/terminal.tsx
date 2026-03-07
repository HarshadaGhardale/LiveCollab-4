import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getSocket } from "@/lib/socket";

interface TerminalProps {
  roomId: string;
  onExit?: () => void;
}

export function Terminal({ roomId, onExit }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: "#18181b", // zinc-950
        foreground: "#f4f4f5", // zinc-50
        cursor: "#f4f4f5",
        selectionBackground: "rgba(255, 255, 255, 0.3)",
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const socket = getSocket();

    // Handle incoming data from backend
    const handleOutput = ({ data }: { data: string }) => {
      term.write(data);
    };

    // Handle process exit
    const handleExit = ({ exitCode }: { exitCode: number }) => {
      term.write(`\r\n\x1b[38;5;242m--- Process exited with code ${exitCode} ---\x1b[0m\r\n`);
      if (onExitRef.current) onExitRef.current();
    };

    socket.on("execute:output", handleOutput);
    socket.on("execute:exit", handleExit);

    // Send user input to backend
    term.onData((data) => {
      // If user hit Enter (\r), send CRLF to properly flush PTY
      if (data === '\r') {
        socket.emit("execute:input", { roomId, data: '\r\n' });
      } else {
        socket.emit("execute:input", { roomId, data });
      }
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      socket.off("execute:output", handleOutput);
      socket.off("execute:exit", handleExit);
      window.removeEventListener("resize", handleResize);
      term.dispose();

      // Stop execution on unmount just in case
      socket.emit("execute:stop", { roomId });
    };
  }, [roomId]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full p-2 bg-zinc-950 overflow-hidden"
      style={{ minHeight: "200px" }}
      data-testid="terminal-container"
    />
  );
}
