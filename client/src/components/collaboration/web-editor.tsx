import { useState, useEffect, useRef, useCallback } from "react";
import Editor, { OnMount, OnChange } from "@monaco-editor/react";
import Split from "react-split";
import { motion, AnimatePresence } from "framer-motion";
import {
    Play,
    RotateCcw,
    Download,
    Settings,
    Check,
    Copy,
    Eye,
    Code2,
    Layout,
    FileCode,
    FileType,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Plus,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useThemeStore, useAuthStore, useEditorStore } from "@/lib/stores";
import { getSocket, emitCodeEvent } from "@/lib/socket";
import { apiRequest } from "@/lib/queryClient";
import { zipSync, strToU8 } from "fflate";

import type { editor } from "monaco-editor";

interface WebEditorProps {
    roomId: string;
    initialFiles?: Record<string, string>;
}

export function WebEditor({ roomId, initialFiles }: WebEditorProps) {
    const { theme } = useThemeStore();
    const { fontSize } = useEditorStore();
    const { user } = useAuthStore();

    const [activeFile, setActiveFile] = useState<string>("index.html");
    const [files, setFiles] = useState<Record<string, string>>(() => {
        const defaultFiles = {
            "index.html": "",
            "style.css": "",
            "script.js": ""
        };
        return { ...defaultFiles, ...(initialFiles || {}) };
    });

    const [iframeKey, setIframeKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const isRemoteUpdate = useRef(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isFolderOpen, setIsFolderOpen] = useState(true);
    const [showNewFileForm, setShowNewFileForm] = useState(false);
    const [newFileName, setNewFileName] = useState("");

    // Update local state when initialFiles changes
    useEffect(() => {
        if (initialFiles) {
            setFiles((prev) => ({ ...prev, ...initialFiles }));
        }
    }, [initialFiles]);

    const getSrcDoc = useCallback(() => {
        const html = files["index.html"] || "";
        let cssTags = "";
        let jsTags = "";

        Object.entries(files).forEach(([filename, content]) => {
            if (filename.endsWith('.css')) cssTags += `<style>\n${content}\n</style>\n`;
            if (filename.endsWith('.js')) jsTags += `<script>\n${content}\n</script>\n`;
        });

        return `
      <!DOCTYPE html>
      <html>
        <head>
          ${cssTags}
        </head>
        <body>
          ${html}
          ${jsTags}
        </body>
      </html>
    `;
    }, [files]);

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;

        editor.onDidChangeCursorPosition((e) => {
            if (isRemoteUpdate.current) return;
            emitCodeEvent(roomId, {
                type: "cursor",
                data: {
                    lineNumber: e.position.lineNumber,
                    column: e.position.column,
                    file: activeFile
                },
                userId: user?.id,
            });
        });

        editor.onDidChangeCursorSelection((e) => {
            if (isRemoteUpdate.current) return;
            if (!e.selection.isEmpty()) {
                emitCodeEvent(roomId, {
                    type: "selection",
                    data: {
                        startLineNumber: e.selection.startLineNumber,
                        startColumn: e.selection.startColumn,
                        endLineNumber: e.selection.endLineNumber,
                        endColumn: e.selection.endColumn,
                        file: activeFile
                    },
                    userId: user?.id,
                });
            }
        });
    };

    const handleEditorChange: OnChange = useCallback((value) => {
        const newContent = value || "";

        setFiles((prev) => ({
            ...prev,
            [activeFile]: newContent
        }));

        if (!isRemoteUpdate.current && user) {
            emitCodeEvent(roomId, {
                type: "change",
                data: {
                    file: activeFile,
                    content: newContent
                },
                userId: user.id,
            });

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
                saveFiles({ ...files, [activeFile]: newContent });
            }, 2000);
        }
    }, [roomId, user, activeFile, files]);

    const saveFiles = async (currentFiles: typeof files) => {
        try {
            await apiRequest("PATCH", `/api/rooms/${roomId}/state`, {
                webFiles: currentFiles
            });
        } catch (error) {
            console.error("Failed to save files:", error);
        }
    };

    useEffect(() => {
        const socket = getSocket();
        const handleCodeEvent = (event: any) => {
            if (event.userId === user?.id) return;

            if (event.type === "change" && event.data.file) {
                setFiles((prev) => ({
                    ...prev,
                    [event.data.file]: event.data.content
                }));

                if (event.data.file === activeFile && editorRef.current) {
                    const currentPosition = editorRef.current.getPosition();
                    isRemoteUpdate.current = true;
                    editorRef.current.setValue(event.data.content);
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
    }, [user?.id, activeFile]);

    const refreshPreview = () => {
        setIsRefreshing(true);
        setIframeKey((prev) => prev + 1);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleExport = () => {
        // fflate is a pure-browser ZIP library — no Node.js Buffer required
        const fileMap: Record<string, Uint8Array> = {};
        Object.entries(files).forEach(([filename, content]) => {
            fileMap[filename] = strToU8(content);
        });
        const zipped = zipSync(fileMap, { level: 6 });
        const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "project.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const getFileIcon = (fileName: string) => {
        if (fileName.endsWith(".html")) return <FileType className="h-4 w-4 text-orange-500" />;
        if (fileName.endsWith(".css")) return <FileCode className="h-4 w-4 text-blue-500" />;
        if (fileName.endsWith(".js")) return <FileCode className="h-4 w-4 text-yellow-500" />;
        return <FileCode className="h-4 w-4" />;
    };

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0">
                <div className="flex items-center gap-2 font-medium text-sm">
                    <Layout className="h-4 w-4 text-muted-foreground delay-300" />
                    <span>Web Editor</span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshPreview}
                        className="h-8 gap-1.5"
                        disabled={isRefreshing}
                    >
                        <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span className="text-xs">Run / Refresh</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        className="h-8 gap-1.5"
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span className="text-xs">Export</span>
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* File Explorer Sidebar */}
                <div className="w-48 border-r bg-muted/30 flex flex-col">
                    <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Explorer
                    </div>
                    <div className="px-2">
                        <div
                            className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-sm group select-none"
                        >
                            <div className="flex items-center gap-1.5 cursor-pointer flex-1" onClick={() => setIsFolderOpen(!isFolderOpen)}>
                                {isFolderOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <FolderOpen className="h-4 w-4 text-sky-500" />
                                <span className="font-medium text-sm">Project</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowNewFileForm(true);
                                    setIsFolderOpen(true);
                                }}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {isFolderOpen && (
                            <div className="ml-4 mt-1 space-y-0.5">
                                {showNewFileForm && (
                                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                                        <FileCode className="h-4 w-4 text-muted-foreground" />
                                        <input
                                            autoFocus
                                            type="text"
                                            className="flex-1 bg-background border px-1.5 py-0.5 text-xs rounded-sm outline-none focus:border-primary"
                                            placeholder="filename.ext"
                                            value={newFileName}
                                            onChange={(e) => setNewFileName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && newFileName.trim()) {
                                                    const name = newFileName.trim();
                                                    if (!files[name]) {
                                                        const newFiles = { ...files, [name]: "" };
                                                        setFiles(newFiles);
                                                        setActiveFile(name);
                                                        saveFiles(newFiles);
                                                        if (user) {
                                                            emitCodeEvent(roomId, {
                                                                type: "change",
                                                                data: { file: name, content: "" },
                                                                userId: user.id
                                                            });
                                                        }
                                                    }
                                                    setNewFileName("");
                                                    setShowNewFileForm(false);
                                                } else if (e.key === "Escape") {
                                                    setNewFileName("");
                                                    setShowNewFileForm(false);
                                                }
                                            }}
                                            onBlur={() => {
                                                setNewFileName("");
                                                setShowNewFileForm(false);
                                            }}
                                        />
                                    </div>
                                )}
                                {Object.keys(files).map((fileName) => (
                                    <div
                                        key={fileName}
                                        className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer border-l-2 ${activeFile === fileName
                                            ? "bg-accent border-primary text-accent-foreground"
                                            : "border-transparent hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                                            }`}
                                        onClick={() => setActiveFile(fileName)}
                                    >
                                        {getFileIcon(fileName)}
                                        <span>{fileName}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor & Preview Split */}
                <div className="flex-1 flex overflow-hidden">
                    <Split
                        className="flex-1 flex overflow-hidden"
                        sizes={[50, 50]}
                        minSize={200}
                        gutterSize={8}
                        gutterAlign="center"
                        cursor="col-resize"
                    >
                        {/* Editor */}
                        <div className="h-full overflow-hidden bg-[#1e1e1e] flex flex-col">
                            <div className="h-8 flex items-center px-4 bg-[#1e1e1e] border-b border-[#2b2b2b] text-xs text-zinc-400 select-none">
                                {activeFile}
                            </div>
                            <Editor
                                height="100%"
                                language={activeFile.endsWith(".html") ? "html" : activeFile.endsWith(".css") ? "css" : "javascript"}
                                value={files[activeFile]}
                                theme={theme === "dark" ? "vs-dark" : "light"}
                                onMount={handleEditorMount}
                                onChange={handleEditorChange}
                                options={{
                                    fontSize,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    minimap: { enabled: false },
                                    padding: { top: 16 },
                                    smoothScrolling: true,
                                    wordWrap: "on",
                                }}
                            />
                        </div>

                        {/* Preview */}
                        <div className="h-full flex flex-col bg-white overflow-hidden relative">
                            <div className="h-8 flex items-center px-4 bg-zinc-100 border-b text-xs font-medium text-zinc-500 select-none justify-between">
                                <span>Output</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                </div>
                            </div>
                            <iframe
                                key={iframeKey}
                                srcDoc={getSrcDoc()}
                                title="preview"
                                sandbox="allow-scripts"
                                className="w-full flex-1 border-none bg-white"
                            />
                        </div>
                    </Split>
                </div>
            </div>
        </div>
    );
}
