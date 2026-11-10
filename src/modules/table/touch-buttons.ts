import { useRef, type HTMLAttributes } from "react";

// Browsers may suppress compatibility clicks immediately after a canvas pinch
// or stroke. Activate a stationary touch on release, then discard only its
// duplicate native click. Scrolling, multi-touch and keyboard clicks stay native.
export function useTouchButtons(active: boolean): HTMLAttributes<HTMLElement> {
  const pressed = useRef<{
    id: number;
    button: HTMLButtonElement;
    x: number;
    y: number;
  } | null>(null);
  return {
    onPointerDownCapture: (event) => {
      if (!active || event.pointerType !== "touch") return;
      const button = (event.target as Element).closest("button");
      pressed.current =
        event.isPrimary && button && !button.disabled
          ? { id: event.pointerId, button, x: event.clientX, y: event.clientY }
          : null;
    },
    onPointerMoveCapture: (event) => {
      const start = pressed.current;
      if (
        start &&
        event.pointerId === start.id &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
      )
        pressed.current = null;
    },
    onPointerCancelCapture: () => {
      pressed.current = null;
    },
    onPointerUpCapture: (event) => {
      const start = pressed.current;
      pressed.current = null;
      if (
        !active ||
        event.pointerType !== "touch" ||
        !start ||
        event.pointerId !== start.id ||
        start.button.disabled
      )
        return;
      if ((event.target as Element).closest("button") !== start.button) return;
      event.preventDefault();
      // The first click can replace/close a panel. Its native duplicate may
      // therefore target a different control, or even the next route.
      let timer: ReturnType<typeof setTimeout>;
      const cleanup = () => {
        document.removeEventListener("click", duplicate, true);
        clearTimeout(timer);
      };
      const duplicate = (native: MouseEvent) => {
        if (
          native.detail > 0 &&
          Math.hypot(
            native.clientX - event.clientX,
            native.clientY - event.clientY,
          ) < 15
        ) {
          native.preventDefault();
          native.stopImmediatePropagation();
          cleanup();
        }
      };
      document.addEventListener("click", duplicate, true);
      timer = setTimeout(cleanup, 700);
      start.button.click();
    },
  };
}
