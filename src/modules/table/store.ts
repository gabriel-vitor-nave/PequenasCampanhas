import { create } from "zustand";
import type { Tool } from "./types";
export type Panel =
  | "tokens"
  | "scenes"
  | "combat"
  | "settings"
  | "audio"
  | null;
type TableUI = {
  tool: Tool;
  panel: Panel;
  panelWidth: number;
  selection: string[];
  drawingSelection: string | null;
  multiSelect: boolean;
  color: string;
  width: number;
  opacity: number;
  privateDrawing: boolean;
  snap: boolean;
  text: string;
  set: (values: Partial<Omit<TableUI, "set" | "togglePanel">>) => void;
  togglePanel: (panel: Panel) => void;
};
export const useTableUI = create<TableUI>((set) => ({
  tool: "select",
  panel: null,
  panelWidth: 320,
  selection: [],
  drawingSelection: null,
  multiSelect: false,
  color: "#86b1f2",
  width: 3,
  opacity: 1,
  privateDrawing: false,
  snap: true,
  text: "",
  set: (values) => set(values),
  togglePanel: (panel) =>
    set((state) => ({ panel: state.panel === panel ? null : panel })),
}));
