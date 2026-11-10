import { useEffect, useState, type CSSProperties } from "react";

// Only the table rotates. Campaigns and login keep their normal page orientation.
export function useTableViewport() {
  const read = (previous?: { portrait: boolean; layoutWidth: number }) => {
    const viewport = window.visualViewport;
    const editing = document.activeElement?.matches(
      "input,textarea,select,[contenteditable=true]",
    );
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const mobile = window.matchMedia(
      "(pointer: coarse), (max-width: 760px)",
    ).matches;
    // Opening a software keyboard must not flip the table back to portrait.
    const portrait =
      editing &&
      previous &&
      Math.abs(previous.layoutWidth - window.innerWidth) < 1
        ? previous.portrait
        : window.innerHeight > window.innerWidth;
    return {
      width,
      height,
      mobile,
      portrait,
      layoutWidth: window.innerWidth,
      left: viewport?.offsetLeft ?? 0,
      top: viewport?.offsetTop ?? 0,
    };
  };
  const [viewport, setViewport] = useState(() => read());
  useEffect(() => {
    const update = () => setViewport((previous) => read(previous));
    const rotate = () => setViewport(read());
    const media = window.matchMedia("(pointer: coarse), (max-width: 760px)");
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", rotate);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    media.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", rotate);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      media.removeEventListener("change", update);
    };
  }, []);
  const rotated = viewport.mobile && viewport.portrait;
  const style: CSSProperties | undefined = viewport.mobile
    ? ({
        "--table-height": `${rotated ? viewport.width : viewport.height}px`,
        position: "fixed",
        width: rotated ? viewport.height : viewport.width,
        height: rotated ? viewport.width : viewport.height,
        left: viewport.left + (rotated ? viewport.width : 0),
        top: viewport.top,
        transformOrigin: "top left",
        transform: rotated ? "rotate(90deg)" : "none",
      } as CSSProperties)
    : undefined;
  return { mobile: viewport.mobile, rotated, style };
}
