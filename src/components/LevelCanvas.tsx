import type { CSSProperties } from "react";
import {
  BoxSelect,
  ClipboardPaste,
  Copy,
  Eraser,
  MousePointer2,
} from "lucide-react";

type GridStyle = CSSProperties & { "--grid-size": string };

export function LevelCanvas({
  canvasRef,
  collisionsCount,
  copySelection,
  currentDoc,
  debug,
  grid,
  erase,
  levelWidth,
  levelHeight,
  mode,
  onDown,
  onStageDown,
  onCanvasWheel,
  onMove,
  onUp,
  pasteSelection,
  placedCount,
  setEraser,
  setMode,
  stageRef,
  t,
  zoom,
}) {
  return (
    <section ref={stageRef} id="stage" className={grid ? "grid-on" : "grid-off"} style={{ "--grid-size": `${t * zoom}px` } as GridStyle} onWheel={onCanvasWheel} onPointerDown={onStageDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {debug && (
        <div className="debug-panel">
          <strong>DEBUG</strong>
          <span>tiles {placedCount}</span>
          <span>collisions {collisionsCount}</span>
          <span>mode {mode}</span>
          <span>level {currentDoc.metadata.name}</span>
        </div>
      )}
      <div className="canvas-wrap">
        <div className="map-size-overlay">{levelWidth} × {levelHeight} tiles</div>
        <div className="canvas-tools" aria-label="Selection tools">
          <button
            className={mode === "brush" ? "active" : ""}
            title="Brush (B)"
            aria-label="Brush (B)"
            onClick={() => {
              setMode("brush");
              setEraser(false);
            }}
          >
            <MousePointer2 size={16} />
          </button>
          <button
            className={mode === "select" ? "active" : ""}
            title="Rectangular select (M)"
            aria-label="Rectangular select (M)"
            onClick={() => {
              setMode("select");
              setEraser(false);
            }}
          >
            <BoxSelect size={16} />
          </button>
          <button
            className={mode === "eraser" ? "active" : ""}
            title="Eraser (E)"
            aria-label="Eraser (E)"
            onClick={erase}
          >
            <Eraser size={16} />
          </button>
          <button
            title="Copy selection (Ctrl/⌘ C)"
            aria-label="Copy selection"
            onClick={copySelection}
          >
            <Copy size={16} />
          </button>
          <button
            title="Paste at last tile (Ctrl/⌘ V)"
            aria-label="Paste selection"
            onClick={pasteSelection}
          >
            <ClipboardPaste size={16} />
          </button>
        </div>
        <div
          className="canvas-surface"
          style={{
            width: `${levelWidth * t * zoom}px`,
            height: `${levelHeight * t * zoom}px`,
            "--grid-size": `${t * zoom}px`,
          } as GridStyle}
        >
          <canvas
            ref={canvasRef}
            width={levelWidth * t}
            height={levelHeight * t}
            style={{
              width: "100%",
              height: "100%",
              touchAction: "none",
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
      </div>
    </section>
  );
}
