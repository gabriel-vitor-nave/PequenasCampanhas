import { render, fireEvent, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useTouchButtons } from "./touch-buttons";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});
function Controls({
  click,
  active = true,
}: {
  click: () => void;
  active?: boolean;
}) {
  return (
    <main {...useTouchButtons(active)}>
      <button onClick={click}>Abrir</button>
      <button onClick={click}>Outro</button>
    </main>
  );
}
function pointer(type: string, values: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerType: "touch",
    pointerId: 1,
    isPrimary: true,
    clientX: 20,
    clientY: 20,
    ...values,
  });
  fireEvent(screen.getByRole("button", { name: "Abrir" }), event);
}
it("activates a touch without relying on a compatibility click, and does not activate twice", () => {
  const click = vi.fn();
  render(<Controls click={click} />);
  pointer("pointerdown");
  pointer("pointerup");
  expect(click).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Outro" }), {
    detail: 1,
    clientX: 20,
    clientY: 20,
  });
  expect(click).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Abrir" }), { detail: 0 });
  expect(click).toHaveBeenCalledTimes(2);
});
it("does not activate while scrolling or after a cancelled/multi-touch gesture", () => {
  const click = vi.fn();
  render(<Controls click={click} />);
  pointer("pointerdown");
  pointer("pointermove", { clientY: 70 });
  pointer("pointerup", { clientY: 70 });
  expect(click).not.toHaveBeenCalled();
  pointer("pointerdown");
  pointer("pointercancel");
  pointer("pointerup");
  expect(click).not.toHaveBeenCalled();
  pointer("pointerdown");
  pointer("pointerdown", { isPrimary: false, pointerId: 2 });
  pointer("pointerup");
  expect(click).not.toHaveBeenCalled();
});
it("keeps normal desktop clicks unchanged", () => {
  const click = vi.fn();
  render(<Controls click={click} active={false} />);
  pointer("pointerdown");
  pointer("pointerup");
  expect(click).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Abrir" }), { detail: 1 });
  expect(click).toHaveBeenCalledTimes(1);
});
