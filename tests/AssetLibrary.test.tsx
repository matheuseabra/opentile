import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetLibrary } from "../src/components/AssetLibrary";

const categories = ["terrain", "trees", "objects"];
const grass = { name: "grass.png", category: "terrain", url: "blob:grass" };
const tree = { name: "tree.png", category: "trees", url: "blob:tree" };
const rock = { name: "rock.png", url: "blob:rock" };

afterEach(cleanup);

const renderLibrary = () => {
	const props = {
		assetCategory: "terrain",
		assets: [grass, tree, rock],
		categories,
		deleteAsset: vi.fn(),
		onFiles: vi.fn(),
		select: vi.fn(),
		selected: grass,
		setAssetCategory: vi.fn(),
	};
	return { ...render(<AssetLibrary {...props} />), props };
};

describe("AssetLibrary", () => {
	it("groups assets by category and marks the selected asset", () => {
		renderLibrary();

		expect(screen.getByText("grass.png").closest(".asset")).toHaveClass(
			"selected",
		);
		expect(screen.getByText("rock.png").closest(".catalog-group")).toHaveTextContent(
			"terrain",
		);
		expect(screen.getByText("tree.png").closest(".catalog-group")).toHaveTextContent(
			"trees",
		);
	});

	it("forwards category changes and file selection", () => {
		const { props, container } = renderLibrary();
		const category = screen.getByRole("combobox", { name: "Asset category" });
		const file = new File(["image"], "new.png", { type: "image/png" });
		const input = container.querySelector('input[type="file"]');

		fireEvent.change(category, { target: { value: "trees" } });
		fireEvent.change(input!, { target: { files: [file] } });

		expect(props.setAssetCategory).toHaveBeenCalledWith("trees");
		expect(props.onFiles).toHaveBeenCalledOnce();
	});

	it("selects catalog assets and stops delete clicks from selecting", () => {
		const { props } = renderLibrary();
		fireEvent.click(screen.getByText("tree.png"));
		expect(props.select).toHaveBeenCalledWith(tree);

		props.select.mockClear();
		fireEvent.click(screen.getByRole("button", { name: "Delete grass.png" }));
		expect(props.deleteAsset).toHaveBeenCalledWith(grass);
		expect(props.select).not.toHaveBeenCalled();
	});
});
