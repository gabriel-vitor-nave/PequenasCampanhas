import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  Camera,
  Drawing,
  DrawingInput,
  Point,
  Scene,
  Token,
  TokenMove,
  Tool,
} from "../types";
import { TableEngine, type Preview } from "./engine";
import {
  fitCamera,
  hitDrawing,
  hitToken,
  screenToWorld,
  snapToken,
  beginPinch,
  pinchCamera,
  clientToCanvas,
  type Pinch,
} from "./geometry";
import { useTableUI } from "../store";

export type CanvasHandle = {
  fit: () => void;
  zoom: (factor: number) => void;
  center: () => Point;
  ping: (point: Point) => void;
};
type Props = {
  scene: Scene;
  tokens: Token[];
  drawings: Drawing[];
  urls: Record<string, string>;
  userId: string;
  gm: boolean;
  canDraw: boolean;
  canMove: boolean;
  rotated?: boolean;
  activeToken: string | null;
  onMove: (moves: TokenMove[]) => void;
  onDraw: (drawing: DrawingInput) => void;
  onErase: (drawing: Drawing) => void;
  onMoveDrawing: (drawing: Drawing, points: Point[]) => void;
  onMoveMap: (point: Point) => void;
  onContext: (value: {
    x: number;
    y: number;
    point: Point;
    token: Token | null;
  }) => void;
  onPing: (point: Point) => void;
  onError: (error: Error) => void;
};
type Interaction =
  | { kind: "pan"; start: Point; camera: Camera }
  | { kind: "tokens"; start: Point; tokens: Token[] }
  | { kind: "drawing"; start: Point; drawing: Drawing }
  | { kind: "map"; start: Point; position: Point }
  | { kind: "draw"; tool: Drawing["tool"]; points: Point[] }
  | { kind: "box"; start: Point }
  | { kind: "erase"; ids: Set<string> };
export const TableCanvas = forwardRef<CanvasHandle, Props>(
  function TableCanvas(props, ref) {
    const host = useRef<HTMLDivElement>(null),
      engine = useRef<TableEngine | null>(null),
      latest = useRef(props),
      interaction = useRef<Interaction | null>(null),
      space = useRef(false),
      resetInput = useRef<(() => void) | null>(null),
      preview = useRef<Preview>({});
    const [camera, setCameraState] = useState<Camera>({
        x: 80,
        y: 80,
        scale: 1,
      }),
      cameraRef = useRef(camera),
      [ready, setReady] = useState(false);
    const ui = useTableUI();
    const uiRef = useRef(ui);
    uiRef.current = ui;
    latest.current = props;
    const changeCamera = (next: Camera) => {
      cameraRef.current = next;
      setCameraState(next);
    };
    const repaint = () => engine.current?.setPreview(preview.current);
    const center = (): Point =>
      screenToWorld(
        [
          (host.current?.clientWidth ?? 0) / 2,
          (host.current?.clientHeight ?? 0) / 2,
        ],
        cameraRef.current,
      );
    const zoom = (factor: number) => {
      const current = cameraRef.current,
        w = host.current?.clientWidth ?? 0,
        h = host.current?.clientHeight ?? 0,
        point = screenToWorld([w / 2, h / 2], current),
        scale = Math.min(4, Math.max(0.15, current.scale * factor));
      changeCamera({
        x: w / 2 - point[0] * scale,
        y: h / 2 - point[1] * scale,
        scale,
      });
    };
    useImperativeHandle(ref, () => ({
      fit: () => {
        if (host.current)
          changeCamera(
            fitCamera(
              host.current.clientWidth,
              host.current.clientHeight,
              latest.current.scene,
            ),
          );
      },
      zoom,
      center,
      ping: (point) => {
        preview.current = {
          ...preview.current,
          ping: { point, until: Date.now() + 1800 },
        };
        repaint();
      },
    }));
    useEffect(() => {
      if (!host.current) return;
      const renderer = new TableEngine(host.current, (error) =>
        latest.current.onError(error),
      );
      engine.current = renderer;
      let alive = true;
      void renderer
        .init()
        .then(() => {
          if (alive) setReady(true);
        })
        .catch(() =>
          latest.current.onError(new Error("PC_CANVAS_UNAVAILABLE")),
        );
      return () => {
        alive = false;
        engine.current = null;
        renderer.destroy();
      };
    }, []);
    useEffect(() => {
      resetInput.current?.();
      interaction.current = null;
      preview.current = {};
      if (host.current)
        changeCamera(
          fitCamera(
            host.current.clientWidth,
            host.current.clientHeight,
            props.scene,
          ),
        );
      useTableUI.getState().set({ selection: [], drawingSelection: null });
    }, [props.scene.id]);
    useEffect(() => {
      resetInput.current?.();
    }, [props.rotated]);
    useEffect(() => {
      engine.current?.update({
        scene: props.scene,
        tokens: props.tokens,
        drawings: props.drawings,
        urls: props.urls,
        camera,
        selection: ui.selection,
        drawingSelection: ui.drawingSelection,
        activeToken: props.activeToken,
      });
    }, [
      props.scene,
      props.tokens,
      props.drawings,
      props.urls,
      props.activeToken,
      camera,
      ui.selection,
      ui.drawingSelection,
      ready,
    ]);
    const canMove = (token: Token) =>
      !token.locked &&
      (latest.current.gm ||
        (latest.current.canMove &&
          token.owner_ids.includes(latest.current.userId)));
    const canEditDrawing = (drawing: Drawing) =>
      latest.current.gm ||
      (latest.current.canDraw && drawing.created_by === latest.current.userId);
    useEffect(() => {
      const key = (event: KeyboardEvent) => {
        if (
          (event.target as HTMLElement).closest(
            'input,textarea,select,[contenteditable="true"]',
          )
        )
          return;
        if (event.code === "Space") {
          space.current = event.type === "keydown";
          event.preventDefault();
          return;
        }
        if (event.type !== "keydown") return;
        if (event.key === "Escape") {
          interaction.current = null;
          preview.current = {};
          repaint();
          useTableUI.getState().set({ selection: [], drawingSelection: null });
          return;
        }
        const state = useTableUI.getState(),
          p = latest.current;
        if (
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          ) &&
          state.selection.length
        ) {
          event.preventDefault();
          const step = event.shiftKey
              ? p.scene.grid_size / 4
              : p.scene.grid_size,
            dx =
              event.key === "ArrowLeft"
                ? -step
                : event.key === "ArrowRight"
                  ? step
                  : 0,
            dy =
              event.key === "ArrowUp"
                ? -step
                : event.key === "ArrowDown"
                  ? step
                  : 0;
          p.onMove(
            p.tokens
              .filter((t) => state.selection.includes(t.id) && canMove(t))
              .map((t) => ({
                id: t.id,
                x: t.x + dx,
                y: t.y + dy,
                version: t.version,
              })),
          );
        }
        const tools: Record<string, Tool> = {
          v: "select",
          h: "pan",
          p: "pencil",
          l: "line",
          r: "rect",
          o: "ellipse",
          a: "arrow",
          t: "text",
          e: "eraser",
        };
        if (!event.ctrlKey && !event.metaKey && tools[event.key.toLowerCase()])
          state.set({ tool: tools[event.key.toLowerCase()] });
      };
      window.addEventListener("keydown", key);
      window.addEventListener("keyup", key);
      const blur = () => {
        resetInput.current?.();
        space.current = false;
        interaction.current = null;
        preview.current = {};
        repaint();
      };
      window.addEventListener("blur", blur);
      return () => {
        window.removeEventListener("keydown", key);
        window.removeEventListener("keyup", key);
        window.removeEventListener("blur", blur);
      };
    }, []);
    useEffect(() => {
      const element = host.current;
      if (!element) return;
      const touches = new Map<number, Point>();
      let pinch: Pinch | null = null,
        navigation = false;
      let press: ReturnType<typeof setTimeout> | undefined;
      let touchStart: Point | null = null;
      let blockContextClick = false;
      const stopPress = () => {
        clearTimeout(press);
        press = undefined;
      };
      const position = (event: PointerEvent | WheelEvent): Point => {
        const bounds = element.getBoundingClientRect();
        return clientToCanvas(
          [event.clientX, event.clientY],
          bounds,
          latest.current.rotated ?? false,
        );
      };
      const world = (event: PointerEvent | WheelEvent) =>
        screenToWorld(position(event), cameraRef.current);
      const erase = (point: Point) => {
        const active = interaction.current;
        if (active?.kind !== "erase") return;
        const hit = hitDrawing(
          point,
          latest.current.drawings,
          8 / cameraRef.current.scale,
        );
        if (hit && canEditDrawing(hit) && !active.ids.has(hit.id)) {
          active.ids.add(hit.id);
        }
      };
      const down = (event: PointerEvent) => {
        if (event.button === 2) return;
        const p = latest.current,
          u = uiRef.current,
          point = world(event);
        stopPress();
        // Synthetic accessibility events have no active native pointer to capture.
        if (event.isTrusted) element.setPointerCapture(event.pointerId);
        if (event.pointerType === "touch") {
          touches.set(event.pointerId, position(event));
          if (touches.size >= 2) {
            const points = [...touches.values()];
            pinch = beginPinch(cameraRef.current, points[0], points[1]);
            navigation = true;
            interaction.current = null;
            preview.current = {};
            repaint();
            return;
          }
          if (navigation) return;
          touchStart = position(event);
          if (u.tool === "select")
            press = setTimeout(() => {
              blockContextClick = true;
              interaction.current = null;
              preview.current = {};
              repaint();
              const token =
                hitToken(point, latest.current.tokens, latest.current.scene) ??
                null;
              if (token)
                useTableUI
                  .getState()
                  .set({ selection: [token.id], drawingSelection: null });
              latest.current.onContext({
                x: event.clientX,
                y: event.clientY,
                point,
                token,
              });
            }, 550);
        }
        if (event.button === 1 || u.tool === "pan" || space.current) {
          interaction.current = {
            kind: "pan",
            start: position(event),
            camera: cameraRef.current,
          };
          event.preventDefault();
          return;
        }
        if (event.altKey) {
          p.onPing(point);
          return;
        }
        if (u.tool === "eraser") {
          if (!p.canDraw && !p.gm) return;
          interaction.current = { kind: "erase", ids: new Set() };
          erase(point);
          return;
        }
        if (u.tool !== "select") {
          if (!p.canDraw && !p.gm) return;
          if (u.tool === "text" && !u.text.trim()) {
            p.onError(new Error("PC_TEXT_REQUIRED"));
            return;
          }
          interaction.current = { kind: "draw", tool: u.tool, points: [point] };
          return;
        }
        const token = hitToken(point, p.tokens, p.scene);
        if (token) {
          let ids = u.selection.includes(token.id) ? u.selection : [token.id];
          const extend =
            event.shiftKey || (event.pointerType === "touch" && u.multiSelect);
          if (extend)
            ids = u.selection.includes(token.id)
              ? u.selection.filter((id) => id !== token.id)
              : [...u.selection, token.id].slice(0, 64);
          u.set({ selection: ids, drawingSelection: null });
          if (!extend && canMove(token))
            interaction.current = {
              kind: "tokens",
              start: point,
              tokens: p.tokens.filter((t) => ids.includes(t.id) && canMove(t)),
            };
          return;
        }
        const drawing = hitDrawing(
          point,
          p.drawings,
          5 / cameraRef.current.scale,
        );
        if (drawing && canEditDrawing(drawing)) {
          u.set({ drawingSelection: drawing.id, selection: [] });
          interaction.current = { kind: "drawing", start: point, drawing };
          return;
        }
        if (
          p.gm &&
          !p.scene.map_locked &&
          p.scene.map_asset_id &&
          !event.shiftKey &&
          point[0] >= p.scene.map_x &&
          point[0] <= p.scene.map_x + p.scene.map_width &&
          point[1] >= p.scene.map_y &&
          point[1] <= p.scene.map_y + p.scene.map_height
        ) {
          interaction.current = {
            kind: "map",
            start: point,
            position: [p.scene.map_x, p.scene.map_y],
          };
          return;
        }
        u.set({ selection: [], drawingSelection: null });
        interaction.current =
          event.pointerType === "touch" && !u.multiSelect
            ? { kind: "pan", start: position(event), camera: cameraRef.current }
            : { kind: "box", start: point };
      };
      const move = (event: PointerEvent) => {
        if (event.pointerType === "touch") {
          if (!touches.has(event.pointerId)) return;
          touches.set(event.pointerId, position(event));
          if (navigation) {
            if (pinch && touches.size >= 2) {
              const points = [...touches.values()];
              changeCamera(pinchCamera(pinch, points[0], points[1]));
            }
            return;
          }
          if (
            touchStart &&
            Math.hypot(
              ...([
                position(event)[0] - touchStart[0],
                position(event)[1] - touchStart[1],
              ] as Point),
            ) < 8
          )
            return;
          stopPress();
        }
        const active = interaction.current;
        if (!active) return;
        const p = latest.current,
          u = uiRef.current,
          point = world(event);
        if (active.kind === "pan") {
          const screen = position(event);
          changeCamera({
            ...active.camera,
            x: active.camera.x + screen[0] - active.start[0],
            y: active.camera.y + screen[1] - active.start[1],
          });
          return;
        }
        if (active.kind === "tokens")
          preview.current = {
            ...preview.current,
            moves: new Map(
              active.tokens.map((token) => [
                token.id,
                snapToken(
                  [
                    token.x + point[0] - active.start[0],
                    token.y + point[1] - active.start[1],
                  ],
                  token.size,
                  p.scene,
                  u.snap,
                ),
              ]),
            ),
          };
        else if (active.kind === "drawing")
          preview.current = {
            ...preview.current,
            drawingMove: {
              id: active.drawing.id,
              points: active.drawing.points.map((pos) => [
                pos[0] + point[0] - active.start[0],
                pos[1] + point[1] - active.start[1],
              ]),
            },
          };
        else if (active.kind === "map")
          preview.current = {
            ...preview.current,
            map: [
              active.position[0] + point[0] - active.start[0],
              active.position[1] + point[1] - active.start[1],
            ],
          };
        else if (active.kind === "box")
          preview.current = { ...preview.current, box: [active.start, point] };
        else if (active.kind === "erase") {
          erase(point);
          return;
        } else if (active.kind === "draw") {
          if (active.tool === "pencil") {
            const last = active.points.at(-1)!;
            if (
              Math.hypot(point[0] - last[0], point[1] - last[1]) >
              2 / cameraRef.current.scale
            )
              active.points.push(point);
            if (active.points.length >= 2000)
              active.points = active.points.filter((_, i) => i % 2 === 0);
          } else active.points = [active.points[0], point];
          preview.current = {
            ...preview.current,
            drawing: {
              tool: active.tool,
              points: active.points,
              color: u.color,
              width: u.width,
              opacity: u.opacity,
              text: u.text,
            },
          };
        }
        repaint();
      };
      const up = (event: PointerEvent) => {
        stopPress();
        if (event.pointerType === "touch") {
          touches.delete(event.pointerId);
          if (navigation) {
            if (touches.size >= 2) {
              const points = [...touches.values()];
              pinch = beginPinch(cameraRef.current, points[0], points[1]);
            }
            if (touches.size === 0) {
              navigation = false;
              pinch = null;
              touchStart = null;
            }
            return;
          }
          touchStart = null;
        }
        const active = interaction.current;
        if (!active) return;
        const p = latest.current,
          u = uiRef.current,
          point = world(event),
          view = preview.current;
        interaction.current = null;
        if (active.kind === "tokens" && view.moves)
          p.onMove(
            active.tokens.map((t) => ({
              id: t.id,
              x: view.moves!.get(t.id)![0],
              y: view.moves!.get(t.id)![1],
              version: t.version,
            })),
          );
        else if (active.kind === "drawing" && view.drawingMove)
          p.onMoveDrawing(active.drawing, view.drawingMove.points);
        else if (active.kind === "map" && view.map) p.onMoveMap(view.map);
        else if (active.kind === "erase")
          for (const id of active.ids) {
            const drawing = p.drawings.find((d) => d.id === id);
            if (drawing && canEditDrawing(drawing)) p.onErase(drawing);
          }
        else if (active.kind === "box") {
          const a = active.start;
          u.set({
            selection: p.tokens
              .filter(
                (t) =>
                  t.x >= Math.min(a[0], point[0]) &&
                  t.x <= Math.max(a[0], point[0]) &&
                  t.y >= Math.min(a[1], point[1]) &&
                  t.y <= Math.max(a[1], point[1]),
              )
              .slice(0, 64)
              .map((t) => t.id),
          });
        } else if (active.kind === "draw") {
          const points =
            active.tool === "text"
              ? [active.points[0]]
              : active.points.length === 1
                ? [active.points[0], [point[0] + 0.1, point[1] + 0.1] as Point]
                : active.points;
          p.onDraw({
            id: crypto.randomUUID(),
            campaign_id: p.scene.campaign_id,
            scene_id: p.scene.id,
            created_by: p.userId,
            visibility: p.gm && u.privateDrawing ? "gm" : "shared",
            tool: active.tool,
            points,
            color: u.color,
            width: u.width,
            opacity: u.opacity,
            text: active.tool === "text" ? u.text : "",
          });
        }
        preview.current = { ping: view.ping };
        repaint();
      };
      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        const screen = position(event),
          point = world(event),
          scale = Math.min(
            4,
            Math.max(
              0.15,
              cameraRef.current.scale * Math.exp(-event.deltaY * 0.001),
            ),
          );
        changeCamera({
          x: screen[0] - point[0] * scale,
          y: screen[1] - point[1] * scale,
          scale,
        });
      };
      const context = (event: MouseEvent) => {
        event.preventDefault();
        stopPress();
        if (navigation) return;
        blockContextClick = true;
        const bounds = element.getBoundingClientRect(),
          point = screenToWorld(
            clientToCanvas(
              [event.clientX, event.clientY],
              bounds,
              latest.current.rotated ?? false,
            ),
            cameraRef.current,
          ),
          p = latest.current;
        p.onContext({
          x: event.clientX,
          y: event.clientY,
          point,
          token: hitToken(point, p.tokens, p.scene) ?? null,
        });
      };
      const cancel = () => {
        stopPress();
        touches.clear();
        pinch = null;
        navigation = false;
        touchStart = null;
        interaction.current = null;
        preview.current = {};
        repaint();
      };
      // A long press can open a menu directly under the held finger. Its release
      // must not activate whichever menu item happens to appear at that point.
      const freshPress = () => {
        blockContextClick = false;
      };
      const contextClick = (event: MouseEvent) => {
        if (blockContextClick && event.detail > 0) {
          event.preventDefault();
          event.stopImmediatePropagation();
          blockContextClick = false;
        }
      };
      document.addEventListener("pointerdown", freshPress, true);
      document.addEventListener("click", contextClick, true);
      resetInput.current = cancel;
      element.addEventListener("pointerdown", down);
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerup", up);
      element.addEventListener("pointercancel", cancel);
      element.addEventListener("wheel", wheel, { passive: false });
      element.addEventListener("contextmenu", context);
      return () => {
        document.removeEventListener("pointerdown", freshPress, true);
        document.removeEventListener("click", contextClick, true);
        cancel();
        resetInput.current = null;
        element.removeEventListener("pointerdown", down);
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerup", up);
        element.removeEventListener("pointercancel", cancel);
        element.removeEventListener("wheel", wheel);
        element.removeEventListener("contextmenu", context);
      };
    }, []);
    return (
      <div
        ref={host}
        className={`table-canvas tool-${ui.tool}`}
        role="application"
        aria-label="Mesa virtual"
        data-camera-x={camera.x}
        data-camera-y={camera.y}
        data-camera-scale={camera.scale}
        tabIndex={0}
      >
        <div className="table-zoom-readout">
          {Math.round(camera.scale * 100)}%
        </div>
        <div className="sr-only">
          {props.tokens.map((token) => (
            <button
              key={token.id}
              onClick={() =>
                ui.set({ selection: [token.id], drawingSelection: null })
              }
            >
              Selecionar token {token.name}
            </button>
          ))}
        </div>
      </div>
    );
  },
);
