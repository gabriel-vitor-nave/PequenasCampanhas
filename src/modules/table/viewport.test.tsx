import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTableViewport } from "./viewport";

afterEach(() => vi.unstubAllGlobals());
it("keeps a portrait device horizontal when its keyboard opens, and still responds to physical rotation", () => {
  const viewport = Object.assign(new EventTarget(), {
    width: 390,
    height: 844,
    offsetLeft: 0,
    offsetTop: 0,
  });
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const { result } = renderHook(() => useTableViewport());
  expect(result.current.rotated).toBe(true);
  expect(result.current.style).toMatchObject({
    width: 844,
    height: 390,
    transform: "rotate(90deg)",
  });
  const input = document.createElement("input");
  document.body.appendChild(input);
  input.focus();
  act(() => {
    vi.stubGlobal("innerHeight", 300);
    viewport.height = 300;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(result.current.rotated).toBe(true);
  act(() => {
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    viewport.width = 844;
    viewport.height = 390;
    window.dispatchEvent(new Event("resize"));
  });
  expect(result.current.rotated).toBe(false);
  expect(result.current.style).toMatchObject({
    width: 844,
    height: 390,
    transform: "none",
  });
  input.remove();
});
it("preserves the desktop page layout", () => {
  vi.stubGlobal("innerWidth", 1440);
  vi.stubGlobal("innerHeight", 1000);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const { result } = renderHook(() => useTableViewport());
  expect(result.current.mobile).toBe(false);
  expect(result.current.style).toBeUndefined();
});
