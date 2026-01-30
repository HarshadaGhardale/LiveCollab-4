import { useEffect, useRef, useCallback, useState } from "react";
import { Canvas, PencilBrush, Rect, Circle as FabricCircle, Line, IText, FabricObject, TPointerEventInfo, TPointerEvent, FabricImage } from "fabric";
import { motion } from "framer-motion";
import {
  Download,
  Undo2,
  Redo2,
  Trash2,
  MousePointer2,
  Pencil,
  Eraser,
  Square,
  Circle as CircleIcon,
  Minus,
  Type,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWhiteboardStore, useAuthStore } from "@/lib/stores";
import { emitWhiteboardEvent, getSocket } from "@/lib/socket";
import { DRAWING_TOOLS, COLOR_PALETTE, type DrawingTool } from "@shared/schema";

const TOOL_ICONS: Record<string, any> = {
  select: MousePointer2,
  pen: Pencil,
  eraser: Eraser,
  rectangle: Square,
  circle: CircleIcon,
  line: Minus,
  text: Type,
};

interface WhiteboardProps {
  roomId: string;
  onEvent?: (event: any) => void;
  initialData?: string;
}

export function Whiteboard({ roomId, onEvent, initialData }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isDrawingRef = useRef(false);

  const { user } = useAuthStore();
  const {
    activeTool,
    activeColor,
    brushSize,
    canUndo,
    canRedo,
    setActiveTool,
    setActiveColor,
    setBrushSize,
    setUndoRedo,
  } = useWhiteboardStore();

  const [isReady, setIsReady] = useState(false);

  const saveToHistory = useCallback(() => {
    if (!fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());

    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;

    setUndoRedo(historyIndexRef.current > 0, false);
  }, [setUndoRedo]);

  const handleUndo = useCallback(() => {
    if (!fabricRef.current || historyIndexRef.current <= 0) return;

    historyIndexRef.current--;
    const json = historyRef.current[historyIndexRef.current];
    fabricRef.current.loadFromJSON(JSON.parse(json)).then(() => {
      fabricRef.current?.renderAll();
      setUndoRedo(
        historyIndexRef.current > 0,
        historyIndexRef.current < historyRef.current.length - 1
      );

      emitWhiteboardEvent(roomId, {
        type: "undo",
        data: json,
        userId: user?.id,
      });
    });
  }, [roomId, user?.id, setUndoRedo]);

  const handleRedo = useCallback(() => {
    if (!fabricRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;

    historyIndexRef.current++;
    const json = historyRef.current[historyIndexRef.current];
    fabricRef.current.loadFromJSON(JSON.parse(json)).then(() => {
      fabricRef.current?.renderAll();
      setUndoRedo(
        historyIndexRef.current > 0,
        historyIndexRef.current < historyRef.current.length - 1
      );

      emitWhiteboardEvent(roomId, {
        type: "redo",
        data: json,
        userId: user?.id,
      });
    });
  }, [roomId, user?.id, setUndoRedo]);

  const handleClear = useCallback(() => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = "#ffffff";
    fabricRef.current.renderAll();
    saveToHistory();

    emitWhiteboardEvent(roomId, {
      type: "clear",
      userId: user?.id,
    });
  }, [roomId, user?.id, saveToHistory]);

  const handleExport = useCallback(() => {
    if (!fabricRef.current) return;
    const dataUrl = fabricRef.current.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });

    const link = document.createElement("a");
    link.download = `whiteboard-${roomId}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [roomId]);

  const handleImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = f.target?.result as string;
      if (data) {
        try {
          const img = await FabricImage.fromURL(data);
          const canvas = fabricRef.current;
          if (!canvas) return;

          // Scale down if too big
          const maxSize = Math.min(canvas.width || 800, canvas.height || 600) * 0.5;
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

          img.scale(scale);
          img.set({
            left: (canvas.width || 0) / 2 - (img.width * scale) / 2,
            top: (canvas.height || 0) / 2 - (img.height * scale) / 2
          });

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveToHistory();

          emitWhiteboardEvent(roomId, {
            type: "object-added",
            data: JSON.stringify(canvas.toJSON()),
            userId: user?.id,
          });
        } catch (err) {
          console.error("Error loading image", err);
        }
      }
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = "";
  }, [roomId, user?.id, saveToHistory]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();

    const canvas = new Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "#ffffff",
      isDrawingMode: true,
    });

    fabricRef.current = canvas;

    // Set up brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = brushSize;

    // Save initial state
    historyRef.current = [JSON.stringify(canvas.toJSON())];
    historyIndexRef.current = 0;

    // Load initial data if provided
    if (initialData && initialData !== "{}") {
      try {
        canvas.loadFromJSON(JSON.parse(initialData)).then(() => {
          canvas.renderAll();
          saveToHistory();
        });
      } catch (e) {
        console.error("Failed to load whiteboard data:", e);
      }
    }

    // Handle object events
    const handleObjectModified = () => {
      saveToHistory();
      emitWhiteboardEvent(roomId, {
        type: "object-modified",
        data: JSON.stringify(canvas.toJSON()),
        userId: user?.id,
      });
    };

    canvas.on("object:modified", handleObjectModified);
    canvas.on("path:created", handleObjectModified);

    // Handle resize
    const handleResize = () => {
      const { width: newWidth, height: newHeight } = container.getBoundingClientRect();
      canvas.setDimensions({ width: newWidth, height: newHeight });
      canvas.renderAll();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Listen for whiteboard events from other users
    const socket = getSocket();
    const handleWhiteboardEvent = (event: any) => {
      if (event.userId === user?.id) return; // Ignore own events

      if (event.type === "clear") {
        canvas.clear();
        canvas.backgroundColor = "#ffffff";
        canvas.renderAll();
      } else if (event.type === "object-modified" || event.type === "undo" || event.type === "redo") {
        try {
          canvas.loadFromJSON(JSON.parse(event.data)).then(() => {
            canvas.renderAll();
          });
        } catch (e) {
          console.error("Failed to sync whiteboard:", e);
        }
      }
    };

    socket.on("whiteboard:event", handleWhiteboardEvent);

    setIsReady(true);

    return () => {
      resizeObserver.disconnect();
      socket.off("whiteboard:event", handleWhiteboardEvent);
      canvas.dispose();
    };
  }, [user?.id]);

  // Update brush settings
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    if (activeTool === "pen") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = brushSize;
    } else if (activeTool === "eraser") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = "#ffffff";
      canvas.freeDrawingBrush.width = brushSize * 3;
    } else if (activeTool === "select") {
      canvas.isDrawingMode = false;
    } else {
      canvas.isDrawingMode = false;
    }
  }, [activeTool, activeColor, brushSize]);

  // Handle shape drawing
  useEffect(() => {
    if (!fabricRef.current || !isReady) return;
    const canvas = fabricRef.current;

    if (["rectangle", "circle", "line", "text"].includes(activeTool)) {
      let startPoint: { x: number; y: number } | null = null;
      let tempShape: FabricObject | null = null;

      const handleMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
        if (!opt.scenePoint) return;
        isDrawingRef.current = true;
        startPoint = { x: opt.scenePoint.x, y: opt.scenePoint.y };

        if (activeTool === "text") {
          const text = new IText("Type here", {
            left: startPoint.x,
            top: startPoint.y,
            fontSize: 20,
            fill: activeColor,
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          saveToHistory();
          return;
        }
      };

      const handleMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
        if (!isDrawingRef.current || !startPoint || !opt.scenePoint) return;

        if (tempShape) {
          canvas.remove(tempShape);
        }

        const { x, y } = opt.scenePoint;
        const width = x - startPoint.x;
        const height = y - startPoint.y;

        if (activeTool === "rectangle") {
          tempShape = new Rect({
            left: width < 0 ? x : startPoint.x,
            top: height < 0 ? y : startPoint.y,
            width: Math.abs(width),
            height: Math.abs(height),
            fill: "transparent",
            stroke: activeColor,
            strokeWidth: brushSize,
          });
        } else if (activeTool === "circle") {
          const radius = Math.sqrt(width * width + height * height) / 2;
          tempShape = new FabricCircle({
            left: startPoint.x - radius,
            top: startPoint.y - radius,
            radius,
            fill: "transparent",
            stroke: activeColor,
            strokeWidth: brushSize,
          });
        } else if (activeTool === "line") {
          tempShape = new Line([startPoint.x, startPoint.y, x, y], {
            stroke: activeColor,
            strokeWidth: brushSize,
          });
        }

        if (tempShape) {
          canvas.add(tempShape);
          canvas.renderAll();
        }
      };

      const handleMouseUp = () => {
        if (isDrawingRef.current && tempShape) {
          saveToHistory();
          emitWhiteboardEvent(roomId, {
            type: "object-added",
            data: JSON.stringify(canvas.toJSON()),
            userId: user?.id,
          });
        }
        isDrawingRef.current = false;
        startPoint = null;
        tempShape = null;
      };

      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:move", handleMouseMove);
      canvas.on("mouse:up", handleMouseUp);

      return () => {
        canvas.off("mouse:down");
        canvas.off("mouse:move");
        canvas.off("mouse:up");
      };
    }
  }, [activeTool, activeColor, brushSize, isReady, roomId, user?.id, saveToHistory]);

  return (
    <div className="flex flex-col h-full bg-card rounded-md border overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
        data-testid="input-whiteboard-image"
      />
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between gap-2 border-b bg-card shrink-0">
        <span className="text-sm font-medium">Whiteboard</span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleUndo}
                disabled={!canUndo}
                data-testid="button-whiteboard-undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRedo}
                disabled={!canRedo}
                data-testid="button-whiteboard-redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <div className="w-px h-4 bg-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClear}
                data-testid="button-whiteboard-clear"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleExport}
                data-testid="button-whiteboard-export"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export PNG</TooltipContent>
          </Tooltip>
          <div className="w-px h-4 bg-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleImageClick}
                data-testid="button-whiteboard-image"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Image</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} data-testid="canvas-whiteboard" />
      </div>

      {/* Toolbar */}
      <div className="h-12 px-3 flex items-center justify-between gap-4 border-t bg-card shrink-0">
        {/* Tools */}
        <div className="flex items-center gap-1">
          {DRAWING_TOOLS.map((tool) => {
            const Icon = TOOL_ICONS[tool.id];
            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === tool.id ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setActiveTool(tool.id as DrawingTool)}
                    data-testid={`button-tool-${tool.id}`}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{tool.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLOR_PALETTE.slice(0, 8).map((color) => (
            <button
              key={color}
              className={`w-6 h-6 rounded-md border-2 transition-all ${activeColor === color ? "scale-110 ring-2 ring-offset-1 ring-primary" : ""
                }`}
              style={{ backgroundColor: color, borderColor: color === "#FFFFFF" ? "#e5e7eb" : color }}
              onClick={() => setActiveColor(color)}
              data-testid={`button-color-${color.slice(1)}`}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Size</span>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-20 h-1 accent-primary"
            data-testid="slider-brush-size"
          />
          <span className="text-xs w-4">{brushSize}</span>
        </div>
      </div>
    </div>
  );
}
