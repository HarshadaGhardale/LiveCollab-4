import { useRef, useEffect, useCallback, useState } from "react";
import Editor, { OnMount, OnChange } from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Settings, Copy, Check, Play, Terminal, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore, useThemeStore, useAuthStore } from "@/lib/stores";
import { emitCodeEvent, getSocket } from "@/lib/socket";
import { CODE_LANGUAGES } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import type { editor } from "monaco-editor";
import { Terminal as InteractiveTerminal } from "./terminal";

interface CodeEditorProps {
  roomId: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

export function CodeEditor({ roomId, initialContent = "// Start coding here...\n", onContentChange }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [copied, setCopied] = useState(false);
  const { language, fontSize, setLanguage, setFontSize } = useEditorStore();
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isRemoteUpdate = useRef(false);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Set up cursor position tracking
    editor.onDidChangeCursorPosition((e) => {
      // Only emit if not a remote update (though cursor updates are usually local interactions)
      if (isRemoteUpdate.current) return;

      emitCodeEvent(roomId, {
        type: "cursor",
        data: {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        },
        userId: user?.id,
      });
    });

    // Set up selection tracking
    editor.onDidChangeCursorSelection((e) => {
      if (isRemoteUpdate.current) return;

      const selection = e.selection;
      if (!selection.isEmpty()) {
        emitCodeEvent(roomId, {
          type: "selection",
          data: {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          },
          userId: user?.id,
        });
      }
    });
  };

  const handleEditorChange: OnChange = useCallback((value) => {
    const newContent = value || "";
    setContent(newContent);
    onContentChange?.(newContent);

    // Only emit if this change originated locally
    if (!isRemoteUpdate.current) {
      emitCodeEvent(roomId, {
        type: "change",
        data: newContent,
        userId: user?.id,
      });
    }

    // Auto-save with debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newContent);
    }, 2000);
  }, [roomId, user?.id, onContentChange]);

  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage);

    // Emit language change to other users
    emitCodeEvent(roomId, {
      type: "language",
      data: newLanguage,
      userId: user?.id,
    });
  }, [roomId, user?.id, setLanguage]);

  const handleSave = useCallback(async (contentToSave?: string) => {
    setIsSaving(true);
    try {
      // The actual save will be handled by the parent component
      // This is just for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (!content) return;

    setIsRunning(true);
    setShowOutput(true);

    // Clear previous markers
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        import("monaco-editor").then(monaco => {
          monaco.editor.setModelMarkers(model, "owner", []);
        });
      }
    }

    try {
      const socket = getSocket();
      socket.emit("execute:start", {
        code: content,
        language,
        roomId
      });

      // The socket event execute:started, execute:output, and execute:exit 
      // are handled by the Terminal component. We just wait for exit to stop the spinner.
      const handleExit = () => {
        setIsRunning(false);
        socket.off("execute:exit", handleExit);
      };

      socket.on("execute:exit", handleExit);

    } catch (error) {
      setIsRunning(false);
    }
  }, [content, language, roomId]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  // Update editor content when initial content changes
  useEffect(() => {
    if (editorRef.current && initialContent !== content) {
      const currentPosition = editorRef.current.getPosition();

      // Mark as remote update to prevent echo
      isRemoteUpdate.current = true;
      editorRef.current.setValue(initialContent);
      isRemoteUpdate.current = false;

      if (currentPosition) {
        editorRef.current.setPosition(currentPosition);
      }
      setContent(initialContent);
    }
  }, [initialContent]);

  // Listen for code events from other users
  useEffect(() => {
    const socket = getSocket();
    const handleCodeEvent = (event: any) => {
      if (event.userId === user?.id) return; // Ignore own events

      if (event.type === "language") {
        setLanguage(event.data);
      } else if (event.type === "change") {
        // Guard: Don't update if content is identical
        if (event.data === content) return;

        setContent(event.data);
        if (editorRef.current) {
          const currentPosition = editorRef.current.getPosition();

          // Mark as remote update
          isRemoteUpdate.current = true;
          editorRef.current.setValue(event.data);
          isRemoteUpdate.current = false;

          if (currentPosition) {
            editorRef.current.setPosition(currentPosition);
          }
        }
      }
    };

    socket.on("code:event", handleCodeEvent);

    return () => {
      socket.off("code:event", handleCodeEvent);
    };
  }, [user?.id, setLanguage, content]);

  return (
    <div className="flex flex-col h-full bg-card rounded-md border overflow-hidden">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between gap-2 border-b bg-card shrink-0">
        <span className="text-sm font-medium">Code Editor</span>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="h-7 w-28 text-xs" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.id} value={lang.id}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
                data-testid="button-code-copy"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied!" : "Copy code"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleSave(content)}
                disabled={isSaving}
                data-testid="button-code-save"
              >
                <Save className={`h-3.5 w-3.5 ${isSaving ? "animate-pulse" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save</TooltipContent>
          </Tooltip>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 text-xs ${showOutput ? "bg-accent" : ""}`}
            onClick={() => { setShowOutput(!showOutput); }}
            data-testid="button-code-terminal"
          >
            Output
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleRun}
            disabled={isRunning}
            data-testid="button-code-run"
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span className="text-xs">Run</span>
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden" data-testid="container-code-editor">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme={theme === "dark" ? "vs-dark" : "light"}
          onMount={handleEditorMount}
          onChange={handleEditorChange}
          options={{
            fontSize,
            fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 12 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "gutter",
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>


      {/* Output Panel / Terminal */}
      <AnimatePresence>
        {showOutput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "40%", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t bg-zinc-950 text-zinc-50 flex flex-col shrink-0"
          >
            <div className="h-8 px-3 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                <Terminal className="h-3.5 w-3.5" />
                <span>Console</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                onClick={() => {
                  setShowOutput(false);
                  const socket = getSocket();
                  socket.emit("execute:stop", { roomId });
                  setIsRunning(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {isRunning && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-2 text-zinc-500 text-xs bg-zinc-900/80 px-2 py-1 rounded-md">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Executing...</span>
                </div>
              )}
              {showOutput && <InteractiveTerminal roomId={roomId} onExit={() => setIsRunning(false)} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status bar */}
      <div className="h-6 px-3 flex items-center justify-between text-xs text-muted-foreground border-t bg-card shrink-0">
        <div className="flex items-center gap-3">
          <span>{language.charAt(0).toUpperCase() + language.slice(1)}</span>
          <span>|</span>
          <span>
            {content.split("\n").length} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Saving...
            </motion.span>
          )}
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
