import {
  BoxSelect,
  ClipboardPaste,
  Copy,
  Eraser,
  MousePointer2,
} from "lucide-react";

export function LevelCanvas({
  canvasRef,
  collisionsCount,
  copySelection,
  currentDoc,
  debug,
  erase,
  levelWidth,
  mode,
  onDown,
  onMove,
  onUp,
  pasteSelection,
  placedCount,
  setEraser,
  setMode,
  t,
  zoom,
}) {
  return (
    <section id="stage">
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
        <div className="axis-x">
          {Array.from({ length: levelWidth }, (_, index) => (
            <span key={index} style={{ left: `${index * t * zoom + 3}px` }}>
              {index}
            </span>
          ))}
        </div>
        <div className="axis-y">
          {Array.from({ length: Math.floor(576 / t) }, (_, index) => (
            <span key={index} style={{ top: `${index * t * zoom + 3}px` }}>
              {index}
            </span>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={levelWidth * t}
          height="576"
          style={{
            width: `${levelWidth * t * zoom}px`,
            height: `${576 * zoom}px`,
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
    </section>
  );
}
