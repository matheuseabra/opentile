import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LevelCanvas } from "../src/components/LevelCanvas";

afterEach(cleanup);

const renderCanvas = (overrides = {}) => {
	const props = {
		canvasRef: createRef<HTMLCanvasElement>(),
		collisionsCount: 2,
		copySelection: vi.fn(),
		currentDoc: { metadata: { name: "Main Level" } },
		debug: true,
		grid: true,
		erase: vi.fn(),
		levelWidth: 8,
		levelHeight: 4,
		mode: "brush",
		onDown: vi.fn(),
		onStageDown: vi.fn(),
		onCanvasWheel: vi.fn(),
		onMove: vi.fn(),
		onUp: vi.fn(),
		pasteSelection: vi.fn(),
		placedCount: 3,
		setEraser: vi.fn(),
		setMode: vi.fn(),
		stageRef: createRef<HTMLElement>(),
		t: 16,
		zoom: 2,
		...overrides,
	};
	return { ...render(<LevelCanvas {...props} />), props };
};

describe("LevelCanvas", () => {
	it("renders the map surface and debug information", () => {
		const { container } = renderCanvas();
		const stage = container.querySelector("#stage");
		const canvas = container.querySelector("canvas")!;

		expect(screen.getByText("8 × 4 tiles")).toBeInTheDocument();
		expect(screen.getByText("tiles 3")).toBeInTheDocument();
		expect(screen.getByText("collisions 2")).toBeInTheDocument();
		expect(screen.getByText("level Main Level")).toBeInTheDocument();
		expect(stage).toHaveClass("grid-on");
		expect(stage).toHaveStyle("--grid-size: 32px");
		expect(canvas).toHaveAttribute("width", "128");
		expect(canvas).toHaveAttribute("height", "64");
	});

	it("forwards tool actions and pointer events", () => {
		const { container, props } = renderCanvas();
		const stage = container.querySelector("#stage")!;
		const canvas = container.querySelector("canvas")!;

		fireEvent.click(screen.getByRole("button", { name: "Rectangular select (M)" }));
		fireEvent.click(screen.getByRole("button", { name: "Brush (B)" }));
		fireEvent.click(screen.getByRole("button", { name: "Eraser (E)" }));
		fireEvent.click(screen.getByRole("button", { name: "Copy selection" }));
		fireEvent.click(screen.getByRole("button", { name: "Paste selection" }));
		fireEvent.pointerDown(stage);
		fireEvent.pointerMove(stage);
		fireEvent.pointerUp(stage);
		fireEvent.wheel(stage);
		fireEvent.pointerDown(canvas);
		fireEvent.pointerMove(canvas);
		fireEvent.pointerUp(canvas);

		expect(props.setMode).toHaveBeenNthCalledWith(1, "select");
		expect(props.setMode).toHaveBeenNthCalledWith(2, "brush");
		expect(props.setEraser).toHaveBeenCalledWith(false);
		expect(props.erase).toHaveBeenCalledOnce();
		expect(props.copySelection).toHaveBeenCalledOnce();
		expect(props.pasteSelection).toHaveBeenCalledOnce();
		expect(props.onStageDown).toHaveBeenCalledTimes(2);
		expect(props.onMove).toHaveBeenCalledTimes(3);
		expect(props.onUp).toHaveBeenCalledTimes(3);
		expect(props.onCanvasWheel).toHaveBeenCalledOnce();
		expect(props.onDown).toHaveBeenCalledOnce();
	});

	it("supports a quiet canvas without debug information or a grid", () => {
		const { container } = renderCanvas({ debug: false, grid: false });
		const stage = container.querySelector("#stage");

		expect(stage).toHaveClass("grid-off");
		expect(screen.queryByText("DEBUG")).not.toBeInTheDocument();
	});
});
