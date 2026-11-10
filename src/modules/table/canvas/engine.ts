import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import { initials } from "../../../lib/validation";
import type { Camera, Drawing, Point, Scene, Token } from "../types";
import { drawingBounds } from "./geometry";

export type RenderState = {
  scene: Scene;
  tokens: Token[];
  drawings: Drawing[];
  urls: Record<string, string>;
  camera: Camera;
  selection: string[];
  drawingSelection: string | null;
  activeToken: string | null;
};
export type Preview = {
  drawing?: Pick<
    Drawing,
    "tool" | "points" | "color" | "width" | "opacity" | "text"
  >;
  moves?: Map<string, Point>;
  drawingMove?: { id: string; points: Point[] };
  map?: Point;
  box?: [Point, Point];
  ping?: { point: Point; until: number };
};
const color = (value: string) => Number.parseInt(value.replace("#", ""), 16);
function destroyChildren(container: Container) {
  for (const child of container.removeChildren())
    child.destroy({ children: true });
}

export class TableEngine {
  readonly app = new Application();
  private world = new Container();
  private map = new Container();
  private grid = new Graphics();
  private drawings = new Container();
  private tokens = new Container();
  private overlay = new Container();
  private textures = new Map<string, Texture>();
  private pending = new Set<string>();
  private tokenNodes = new Map<string, Container>();
  private state: RenderState | null = null;
  private preview: Preview = {};
  private frame = 0;
  private stopped = false;
  private resizeObserver: ResizeObserver | null = null;
  private tokenKey = "";
  private drawingKey = "";
  private mapKey = "";
  constructor(
    private host: HTMLDivElement,
    private onError: (error: Error) => void,
  ) {}
  async init() {
    await this.app.init({
      width: Math.max(1, this.host.clientWidth),
      height: Math.max(1, this.host.clientHeight),
      background: "#14171c",
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      autoStart: false,
      preference: "webgl",
    });
    if (this.stopped) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute("aria-label", "Mapa da mesa");
    this.app.canvas.dataset.tableCanvas = "true";
    this.world.addChild(
      this.map,
      this.grid,
      this.drawings,
      this.tokens,
      this.overlay,
    );
    this.app.stage.addChild(this.world);
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.stopped) {
        this.app.renderer.resize(
          Math.max(1, this.host.clientWidth),
          Math.max(1, this.host.clientHeight),
        );
        this.request();
      }
    });
    this.resizeObserver.observe(this.host);
    this.request();
  }
  update(state: RenderState) {
    if (this.state?.scene.id !== state.scene.id) {
      this.tokenKey = "";
      this.drawingKey = "";
      this.mapKey = "";
      this.preview = {};
    }
    this.state = state;
    this.request();
  }
  setPreview(preview: Preview) {
    this.preview = preview;
    this.request();
  }
  private request() {
    if (this.stopped || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.app.renderer) this.paint();
    });
  }
  private texture(url: string | undefined): Texture | undefined {
    if (!url) return;
    const known = this.textures.get(url);
    if (known) return known;
    if (!this.pending.has(url)) {
      this.pending.add(url);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (this.stopped) return;
        this.textures.set(url, Texture.from(img));
        this.tokenKey = "";
        this.mapKey = "";
        this.request();
      };
      img.onerror = () => {
        if (!this.stopped) this.onError(new Error("PC_ASSET_UNAVAILABLE"));
      };
      img.src = url;
    }
  }
  private drawGrid(state: RenderState) {
    const { scene: s, camera: c } = state;
    this.grid.clear();
    if (!s.grid_visible) return;
    const left = -c.x / c.scale,
      right = (this.app.screen.width - c.x) / c.scale,
      top = -c.y / c.scale,
      bottom = (this.app.screen.height - c.y) / c.scale,
      size = s.grid_size;
    if (s.grid_type === "square") {
      for (
        let x = Math.floor((left - s.grid_x) / size) * size + s.grid_x;
        x < right;
        x += size
      )
        this.grid.moveTo(x, top).lineTo(x, bottom);
      for (
        let y = Math.floor((top - s.grid_y) / size) * size + s.grid_y;
        y < bottom;
        y += size
      )
        this.grid.moveTo(left, y).lineTo(right, y);
    } else {
      const radius = size / 2,
        h = Math.sqrt(3) * radius,
        step = 1.5 * radius;
      for (
        let q = Math.floor((left - s.grid_x) / step) - 1;
        q < Math.ceil((right - s.grid_x) / step) + 1;
        q++
      ) {
        for (
          let r = Math.floor((top - s.grid_y) / h - q / 2) - 1;
          r < Math.ceil((bottom - s.grid_y) / h - q / 2) + 1;
          r++
        ) {
          const x = s.grid_x + q * step,
            y = s.grid_y + h * (r + q / 2);
          for (let n = 0; n <= 6; n++) {
            const angle = (n * Math.PI) / 3,
              px = x + radius * Math.cos(angle),
              py = y + radius * Math.sin(angle);
            if (n === 0) this.grid.moveTo(px, py);
            else this.grid.lineTo(px, py);
          }
        }
      }
    }
    this.grid.stroke({
      color: color(s.grid_color),
      width: 1 / c.scale,
      alpha: s.grid_opacity,
    });
  }
  private drawObject(
    target: Container,
    d: Pick<
      Drawing,
      "tool" | "points" | "color" | "width" | "opacity" | "text"
    >,
  ) {
    if (!d.points.length) return;
    const first = d.points[0],
      last = d.points.at(-1)!,
      g = new Graphics(),
      style = {
        color: color(d.color),
        width: d.width,
        alpha: d.opacity,
        cap: "round" as const,
        join: "round" as const,
      };
    if (d.tool === "text") {
      const label = new Text({
        text: d.text,
        style: {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: 16 + d.width * 2,
          fill: d.color,
          wordWrap: true,
          wordWrapWidth: 500,
        },
      });
      label.position.set(...first);
      label.alpha = d.opacity;
      target.addChild(label);
      return;
    }
    if (d.tool === "rect")
      g.rect(
        Math.min(first[0], last[0]),
        Math.min(first[1], last[1]),
        Math.max(1, Math.abs(last[0] - first[0])),
        Math.max(1, Math.abs(last[1] - first[1])),
      ).stroke(style);
    else if (d.tool === "ellipse")
      g.ellipse(
        (first[0] + last[0]) / 2,
        (first[1] + last[1]) / 2,
        Math.max(1, Math.abs(last[0] - first[0]) / 2),
        Math.max(1, Math.abs(last[1] - first[1]) / 2),
      ).stroke(style);
    else {
      g.moveTo(...first);
      for (const point of d.points.slice(1)) g.lineTo(...point);
      g.stroke(style);
      if (d.tool === "arrow") {
        const angle = Math.atan2(last[1] - first[1], last[0] - first[0]),
          length = Math.max(12, d.width * 4);
        g.moveTo(
          last[0] - length * Math.cos(angle - 0.45),
          last[1] - length * Math.sin(angle - 0.45),
        )
          .lineTo(...last)
          .lineTo(
            last[0] - length * Math.cos(angle + 0.45),
            last[1] - length * Math.sin(angle + 0.45),
          )
          .stroke(style);
      }
    }
    target.addChild(g);
  }
  private paint() {
    const state = this.state;
    if (!state) {
      this.app.render();
      return;
    }
    const s = state.scene,
      c = state.camera;
    this.world.position.set(c.x, c.y);
    this.world.scale.set(c.scale);
    this.drawGrid(state);
    const mapKey = JSON.stringify([
      s.map_asset_id,
      s.map_x,
      s.map_y,
      s.map_width,
      s.map_height,
      state.urls[s.map_asset_id ?? ""],
    ]);
    if (mapKey !== this.mapKey) {
      this.mapKey = mapKey;
      destroyChildren(this.map);
      if (s.map_asset_id) {
        const texture = this.texture(state.urls[s.map_asset_id]);
        if (texture) {
          const sprite = new Sprite(texture);
          sprite.width = s.map_width;
          sprite.height = s.map_height;
          this.map.addChild(sprite);
        } else
          this.map.addChild(
            new Graphics()
              .rect(0, 0, s.map_width, s.map_height)
              .fill("#242932"),
          );
      }
    }
    this.map.position.set(...(this.preview.map ?? [s.map_x, s.map_y]));
    const drawingKey = JSON.stringify([
      state.drawings.map((d) => [d.id, d.version]),
      state.drawingSelection,
      this.preview.drawingMove,
    ]);
    if (drawingKey !== this.drawingKey) {
      this.drawingKey = drawingKey;
      destroyChildren(this.drawings);
      for (const drawing of state.drawings) {
        const view =
          this.preview.drawingMove?.id === drawing.id
            ? { ...drawing, points: this.preview.drawingMove.points }
            : drawing;
        this.drawObject(this.drawings, {
          ...view,
          opacity: view.opacity * (view.visibility === "gm" ? 0.6 : 1),
        });
        if (state.drawingSelection === drawing.id) {
          const b = drawingBounds(view);
          this.drawings.addChild(
            new Graphics()
              .rect(
                b.x - 4,
                b.y - 4,
                Math.max(8, b.width + 8),
                Math.max(8, b.height + 8),
              )
              .stroke({ color: "#86b1f2", width: 1 / c.scale }),
          );
        }
      }
    }
    const tokenKey = JSON.stringify([
      state.tokens.map((t) => [t.id, t.version]),
      state.selection,
      state.activeToken,
      s.grid_size,
      state.urls,
    ]);
    if (tokenKey !== this.tokenKey) {
      this.tokenKey = tokenKey;
      destroyChildren(this.tokens);
      this.tokenNodes.clear();
      for (const token of state.tokens) {
        const node = new Container(),
          size = token.size * s.grid_size,
          chosen = state.selection.includes(token.id),
          active = state.activeToken === token.id;
        node.alpha = token.visible ? 1 : 0.45;
        node.position.set(token.x, token.y);
        this.tokens.addChild(node);
        this.tokenNodes.set(token.id, node);
        const portrait = new Container();
        portrait.pivot.set(size / 2, size / 2);
        portrait.position.set(size / 2, size / 2);
        portrait.rotation = (token.rotation * Math.PI) / 180;
        node.addChild(portrait);
        const background = new Graphics();
        if (token.shape === "circle")
          background.circle(size / 2, size / 2, size / 2).fill(token.color);
        else if (token.shape === "square")
          background.rect(0, 0, size, size).fill(token.color);
        portrait.addChild(background);
        const texture = this.texture(state.urls[token.asset_id ?? ""]);
        if (texture) {
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.position.set(size / 2, size / 2);
          sprite.scale.set(
            token.shape === "none"
              ? Math.min(size / texture.width, size / texture.height)
              : Math.max(size / texture.width, size / texture.height),
          );
          portrait.addChild(sprite);
          if (token.shape !== "none") {
            const mask = new Graphics();
            if (token.shape === "circle")
              mask.circle(size / 2, size / 2, size / 2).fill(0xffffff);
            else mask.rect(0, 0, size, size).fill(0xffffff);
            portrait.addChild(mask);
            sprite.mask = mask;
          }
        } else {
          const text = new Text({
            text: initials(token.name),
            style: {
              fontFamily: "Segoe UI",
              fontSize: Math.max(12, size * 0.3),
              fill: "#ffffff",
              fontWeight: "600",
            },
          });
          text.anchor.set(0.5);
          text.position.set(size / 2, size / 2);
          portrait.addChild(text);
        }
        const border = new Graphics(),
          stroke = {
            color: chosen ? "#94bfff" : active ? "#f0c26f" : "#bac6d5",
            width: chosen || active ? 3 : 1.5,
            alpha: chosen || active ? 1 : 0.7,
          };
        if (token.shape === "circle")
          border.circle(size / 2, size / 2, size / 2).stroke(stroke);
        else if (token.shape === "square" || chosen || active)
          border.rect(0, 0, size, size).stroke(stroke);
        node.addChild(border);
        if (token.show_hp) {
          node.addChild(
            new Graphics()
              .rect(0, size + 4, size, 5)
              .fill("#353c47")
              .rect(
                0,
                size + 4,
                size * Math.max(0, Math.min(1, token.hp / token.max_hp)),
                5,
              )
              .fill(token.hp / token.max_hp < 0.25 ? "#dd7979" : "#5f97df"),
          );
        }
        const label = new Text({
          text: token.name,
          style: {
            fontFamily: "Segoe UI",
            fontSize: 11,
            fill: "#e2e6ed",
            stroke: { color: "#12151a", width: 3 },
          },
        });
        label.anchor.set(0.5, 0);
        label.position.set(size / 2, size + (token.show_hp ? 12 : 5));
        node.addChild(label);
        if (token.conditions.length || token.concentration) {
          const marks = new Text({
            text: [
              token.concentration ? "C" : "",
              ...token.conditions.map((x) => x.slice(0, 2).toUpperCase()),
            ]
              .filter(Boolean)
              .join(" "),
            style: {
              fontSize: 10,
              fontFamily: "Segoe UI",
              fill: "#f5d28e",
              stroke: { color: "#12151a", width: 3 },
            },
          });
          marks.position.set(0, -14);
          node.addChild(marks);
        }
      }
    }
    for (const token of state.tokens) {
      const pos = this.preview.moves?.get(token.id) ?? [token.x, token.y];
      this.tokenNodes.get(token.id)?.position.set(pos[0], pos[1]);
    }
    destroyChildren(this.overlay);
    if (this.preview.drawing)
      this.drawObject(this.overlay, this.preview.drawing);
    if (this.preview.box) {
      const [a, b] = this.preview.box;
      this.overlay.addChild(
        new Graphics()
          .rect(
            Math.min(a[0], b[0]),
            Math.min(a[1], b[1]),
            Math.abs(b[0] - a[0]),
            Math.abs(b[1] - a[1]),
          )
          .fill({ color: "#83b0f1", alpha: 0.08 })
          .stroke({ color: "#83b0f1", width: 1 / c.scale }),
      );
    }
    if (this.preview.ping && Date.now() < this.preview.ping.until) {
      this.overlay.addChild(
        new Graphics()
          .circle(...this.preview.ping.point, 24 / c.scale)
          .stroke({ color: "#8fbaff", width: 2 / c.scale }),
      );
      setTimeout(
        () => this.request(),
        Math.max(1, this.preview.ping.until - Date.now()),
      );
    }
    this.app.render();
  }
  destroy() {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    if (this.app.renderer) this.app.destroy(true, { children: true });
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
  }
}
