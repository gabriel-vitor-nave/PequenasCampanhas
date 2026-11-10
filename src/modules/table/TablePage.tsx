import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CaseSensitive,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Eraser,
  EyeOff,
  Hand,
  ImagePlus,
  Layers,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  Music2,
  Pencil,
  Plus,
  Redo2,
  Settings2,
  Square,
  Swords,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { campaignService } from "../campaigns/service";
import { errorMessage } from "../../lib/errors";
import { tableService } from "./service";
import { useAssetUrls, useTableData, useTableRealtime } from "./hooks";
import { useTableUI, type Panel } from "./store";
import { TableCanvas, type CanvasHandle } from "./canvas/TableCanvas";
import { snapPoint } from "./canvas/geometry";
import { TokensPanel } from "./panels/TokensPanel";
import { ScenesPanel } from "./panels/ScenesPanel";
import { MapPanel } from "./panels/MapPanel";
import { CombatPanel } from "./panels/CombatPanel";
import { AudioPanel } from "./panels/AudioPanel";
import { AudioBridge, type AudioControl } from "./AudioBridge";
import { DiceDock } from "./DiceDock";
import type {
  Drawing,
  DrawingInput,
  Point,
  Scene,
  Token,
  TokenInput,
  Tool,
} from "./types";
import "./table.css";

type HistoryEntry = {
  undo: () => Promise<unknown>;
  redo: () => Promise<unknown>;
};
const tools: Array<{
  id: Tool;
  label: string;
  key: string;
  icon: typeof MousePointer2;
}> = [
  { id: "select", label: "Selecionar", key: "V", icon: MousePointer2 },
  { id: "pan", label: "Mover câmera", key: "H", icon: Hand },
  { id: "pencil", label: "Lápis", key: "P", icon: Pencil },
  { id: "line", label: "Linha", key: "L", icon: Minus },
  { id: "rect", label: "Retângulo", key: "R", icon: Square },
  { id: "ellipse", label: "Círculo", key: "O", icon: Circle },
  { id: "arrow", label: "Seta", key: "A", icon: ArrowUpRight },
  { id: "text", label: "Texto", key: "T", icon: CaseSensitive },
  { id: "eraser", label: "Borracha", key: "E", icon: Eraser },
];
const tabs: Array<{
  id: Exclude<Panel, null>;
  label: string;
  icon: typeof Users;
}> = [
  { id: "tokens", label: "Tokens", icon: Users },
  { id: "scenes", label: "Cenas", icon: Layers },
  { id: "combat", label: "Combate", icon: Swords },
  { id: "audio", label: "Áudio", icon: Music2 },
  { id: "settings", label: "Mapa e grid", icon: Settings2 },
];
function inputOf(d: Drawing): DrawingInput {
  const { version: _v, created_at: _c, updated_at: _u, ...input } = d;
  return input;
}
function tokenCopy(t: Token, offset: number): TokenInput {
  const { id: _id, version: _v, created_at: _c, updated_at: _u, ...input } = t;
  return {
    ...input,
    id: crypto.randomUUID(),
    name: (t.name + " — cópia").slice(0, 80),
    x: t.x + offset,
    y: t.y + offset,
  };
}

export function TablePage() {
  const { id: campaignId = "" } = useParams(),
    { user } = useAuth(),
    cache = useQueryClient(),
    ui = useTableUI();
  const [viewScene, setViewScene] = useState<string | null>(null),
    [error, setError] = useState<unknown>(null),
    [pending, setPending] = useState(0),
    [audio, setAudio] = useState<AudioControl | null>(null),
    [confirm, setConfirm] = useState<{
      text: string;
      action: () => void;
    } | null>(null);
  const [context, setContext] = useState<{
      x: number;
      y: number;
      point: Point;
      token: Token | null;
    } | null>(null),
    [historyVersion, setHistoryVersion] = useState(0);
  const canvas = useRef<CanvasHandle>(null),
    history = useRef<HistoryEntry[]>([]),
    future = useRef<HistoryEntry[]>([]),
    clipboard = useRef<Token[]>([]),
    sceneRef = useRef<Scene | null>(null),
    latest = useRef<{ tokens: Token[]; drawings: Drawing[] }>({
      tokens: [],
      drawings: [],
    });
  const valid = /^[0-9a-f-]{36}$/i.test(campaignId);
  const campaign = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => campaignService.get(campaignId),
    enabled: valid,
    refetchInterval: 15_000,
  });
  const gm = !!user && campaign.data?.owner_id === user.id;
  const initialized = useQuery({
    queryKey: ["table-init", campaignId, user?.id],
    queryFn: () => tableService.ensure(campaignId),
    enabled: gm,
    staleTime: Infinity,
  });
  const { core, content, sceneId } = useTableData(campaignId, viewScene);
  const scene = core.data?.scenes.find((s) => s.id === sceneId) ?? null;
  sceneRef.current = scene;
  const tokens = content.data?.tokens ?? [],
    drawings = content.data?.drawings ?? [];
  latest.current = { tokens, drawings };
  const { urls, error: urlError } = useAssetUrls(core.data?.assets ?? []);
  const realtime = useTableRealtime(campaignId, (point) =>
    canvas.current?.ping(point),
  );
  const member = core.data?.roster.find((m) => m.user_id === user?.id);
  const refresh = useCallback(
    () => cache.invalidateQueries({ queryKey: ["table", campaignId] }),
    [cache, campaignId],
  );
  const run = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
      setPending((n) => n + 1);
      try {
        const result = await work();
        setError(null);
        await refresh();
        return result;
      } catch (reason) {
        setError(reason);
        await refresh();
        return undefined;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [refresh],
  );
  const pushHistory = (entry: HistoryEntry) => {
    history.current.push(entry);
    if (history.current.length > 100) history.current.shift();
    future.current = [];
    setHistoryVersion((n) => n + 1);
  };
  const undo = () =>
    run(async () => {
      const entry = history.current.at(-1);
      if (!entry) return;
      await entry.undo();
      history.current.pop();
      future.current.push(entry);
      setHistoryVersion((n) => n + 1);
    });
  const redo = () =>
    run(async () => {
      const entry = future.current.at(-1);
      if (!entry) return;
      await entry.redo();
      future.current.pop();
      history.current.push(entry);
      setHistoryVersion((n) => n + 1);
    });
  useEffect(() => {
    if (initialized.isSuccess) void refresh();
  }, [initialized.data, initialized.isSuccess, refresh]);
  useEffect(() => {
    if (!gm) setViewScene(null);
  }, [core.data?.state?.active_scene_id, gm]);
  useEffect(() => {
    history.current = [];
    future.current = [];
    setHistoryVersion(0);
    setContext(null);
  }, [sceneId]);
  useEffect(() => {
    if (scene?.map_asset_id) canvas.current?.fit();
  }, [scene?.map_asset_id]);
  const select = (id: string) =>
    ui.set({ selection: [id], drawingSelection: null, panel: "tokens" });
  const addToken = () => {
    if (!scene) return;
    const point = snapPoint(
      canvas.current?.center() ?? [scene.map_width / 2, scene.map_height / 2],
      scene,
      ui.snap,
    );
    void run(async () => {
      const token = await tableService.addToken({
        id: crypto.randomUUID(),
        campaign_id: campaignId,
        scene_id: scene.id,
        name: `Token ${tokens.length + 1}`,
        x: point[0],
        y: point[1],
        owner_ids: [user!.id],
      });
      if (token) select(token.id);
    });
  };
  const duplicate = (token: Token) => {
    void run(async () => {
      const copied = await tableService.addToken(
        tokenCopy(token, scene?.grid_size ?? 64),
      );
      if (copied) select(copied.id);
    });
  };
  const removeTokens = (ids: string[]) =>
    setConfirm({
      text: `Excluir ${ids.length} token(s)?`,
      action: () => {
        setConfirm(null);
        void run(async () => {
          await tableService.deleteTokens(ids);
          ui.set({ selection: [] });
        });
      },
    });
  const draw = (input: DrawingInput) => {
    void run(async () => {
      let row = await tableService.addDrawing(input);
      if (!row) return;
      pushHistory({
        undo: async () => {
          await tableService.deleteDrawing(row!);
        },
        redo: async () => {
          row = await tableService.addDrawing(input);
        },
      });
    });
  };
  const erase = (drawing: Drawing) => {
    void run(async () => {
      await tableService.deleteDrawing(drawing);
      let row = drawing;
      pushHistory({
        undo: async () => {
          row = (await tableService.addDrawing(inputOf(drawing)))!;
        },
        redo: () => tableService.deleteDrawing(row),
      });
    });
  };
  const moveDrawing = (drawing: Drawing, points: Point[]) => {
    void run(async () => {
      let row = await tableService.saveDrawing(drawing, points);
      pushHistory({
        undo: async () => {
          row = await tableService.saveDrawing(row!, drawing.points);
        },
        redo: async () => {
          row = await tableService.saveDrawing(row!, points);
        },
      });
    });
  };
  const uploadMap = (file: File) => {
    if (!scene) return;
    void run(async () => {
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width,
        height = bitmap.height;
      bitmap.close();
      if (width > 8192 || height > 8192) throw new Error("PC_IMAGE_DIMENSIONS");
      const asset = await tableService.upload(campaignId, file, "map");
      await tableService.saveScene(scene.id, scene.version, {
        map_asset_id: asset.id,
        map_width: width,
        map_height: height,
        map_x: 0,
        map_y: 0,
      });
    });
  };
  const addCombat = (token: Token) => {
    if (scene)
      void run(() => tableService.addCombatant(campaignId, scene.id, token.id));
  };
  const sceneAction = (id: string | null, action: string, name = "Cena") => {
    void run(async () => {
      const result = await tableService.sceneAction(
        campaignId,
        id,
        action,
        name,
      );
      if (action === "create" || action === "duplicate") setViewScene(result);
      if (action === "activate") setViewScene(null);
    });
  };
  const clearLayer = () => {
    const selected = drawings.filter(
      (d) => d.visibility === (gm && ui.privateDrawing ? "gm" : "shared"),
    );
    if (!selected.length) return;
    setConfirm({
      text: `Apagar ${selected.length} desenho(s) desta camada?`,
      action: () => {
        setConfirm(null);
        void run(async () => {
          await tableService.clearDrawings(selected.map((d) => d.id));
          pushHistory({
            undo: () =>
              Promise.all(
                selected.map((d) => tableService.addDrawing(inputOf(d))),
              ),
            redo: () => tableService.clearDrawings(selected.map((d) => d.id)),
          });
        });
      },
    });
  };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) void redo();
        else void undo();
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        void redo();
      }
      if (command && event.key.toLowerCase() === "c" && gm) {
        clipboard.current = latest.current.tokens.filter((t) =>
          useTableUI.getState().selection.includes(t.id),
        );
        if (clipboard.current.length) event.preventDefault();
      }
      if (
        command &&
        event.key.toLowerCase() === "v" &&
        gm &&
        sceneRef.current &&
        clipboard.current.length
      ) {
        event.preventDefault();
        const s = sceneRef.current;
        void run(async () => {
          const rows = await Promise.all(
            clipboard.current.map((t) =>
              tableService.addToken({
                ...tokenCopy(t, s.grid_size),
                scene_id: s.id,
              }),
            ),
          );
          ui.set({ selection: rows.flatMap((t) => (t ? [t.id] : [])) });
        });
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const state = useTableUI.getState();
        if (gm && state.selection.length) {
          event.preventDefault();
          removeTokens(state.selection);
        } else {
          const drawing = latest.current.drawings.find(
            (d) => d.id === state.drawingSelection,
          );
          if (drawing && (gm || drawing.created_by === user?.id)) {
            event.preventDefault();
            erase(drawing);
          }
        }
      }
      if (event.key === "Escape") {
        setContext(null);
        setConfirm(null);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [gm, sceneId, user?.id, run, historyVersion]);
  useEffect(() => {
    if (!context) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".table-context"))
        setContext(null);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [context]);
  const exportData = () => {
    void run(async () => {
      if (!core.data) return;
      const scenes = await Promise.all(
        core.data.scenes.map(async (scene) => ({
          scene,
          ...(await tableService.scene(scene.id)),
        })),
      );
      const data = {
        format: "pequenas-campanhas:1",
        exported_at: new Date().toISOString(),
        campaign: campaign.data,
        roster: core.data.roster,
        assets: core.data.assets,
        state: core.data.state,
        rolls: core.data.rolls,
        music: core.data.music,
        scenes,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "campanha-" + campaignId + ".json";
      link.click();
      URL.revokeObjectURL(url);
    });
  };
  const issue =
    error ??
    campaign.error ??
    initialized.error ??
    core.error ??
    content.error ??
    urlError;
  if (!valid || campaign.isError || (!campaign.isPending && !campaign.data))
    return (
      <main className="table-fallback">
        <p>Campanha indisponível.</p>
        <Link to="/campanhas">Voltar</Link>
      </main>
    );
  if (campaign.isPending || core.isPending || (gm && initialized.isPending))
    return (
      <main className="table-fallback">
        <LoaderCircle className="spin" size={20} />
        Abrindo mesa
      </main>
    );
  return (
    <main id="main-content" className="table-shell">
      <header className="table-topbar">
        <Link
          to={`/campanhas/${campaignId}`}
          className="table-back"
          aria-label="Voltar à campanha"
        >
          <ArrowLeft size={17} />
        </Link>
        <strong className="table-campaign-name">{campaign.data?.name}</strong>
        <span className="table-current-scene">
          {scene?.name ?? "Sem cena"}
          {scene &&
            (!scene.is_public ||
              scene.id !== core.data?.state?.active_scene_id) && (
              <small>Preparação</small>
            )}
        </span>
        <span className="table-spacer" />
        <details className="table-presence">
          <summary>
            <Users size={15} />
            {realtime.present.length} conectado(s)
            <ChevronDown size={12} />
          </summary>
          <div>
            {core.data?.roster.map((m) => (
              <span key={m.user_id}>
                <i
                  className={
                    realtime.present.includes(m.user_id) ? "online" : ""
                  }
                />
                {m.display_name}
                {m.role === "gm" ? " · mestre" : ""}
              </span>
            ))}
          </div>
        </details>
        <span className={`table-sync ${issue ? "failed" : ""}`} role="status">
          {pending ? (
            <>
              <LoaderCircle size={12} className="spin" />
              Salvando
            </>
          ) : issue ? (
            "Falha ao salvar"
          ) : (
            <>
              <Check size={12} />
              {realtime.status}
            </>
          )}
        </span>
        <button onClick={() => ui.togglePanel("settings")} title="Mapa e grid">
          <Settings2 size={17} />
        </button>
      </header>
      {issue && (
        <div className="table-error" role="alert">
          <span>{errorMessage(issue)}</span>
          <button
            onClick={() => {
              setError(null);
              void refresh();
              void cache.invalidateQueries({ queryKey: ["table-urls"] });
            }}
          >
            Recarregar dados
          </button>
          <button title="Fechar aviso" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="table-workspace">
        <aside className="table-tools" aria-label="Ferramentas">
          {tools.map(({ id, label, key, icon: Icon }) => (
            <button
              key={id}
              title={`${label} (${key})`}
              aria-label={label}
              aria-pressed={ui.tool === id}
              className={ui.tool === id ? "selected" : ""}
              disabled={
                !["select", "pan"].includes(id) && !gm && !member?.can_draw
              }
              onClick={() => ui.set({ tool: id })}
            >
              <Icon size={19} />
            </button>
          ))}
          <span className="tool-divider" />
          <button
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
            disabled={!history.current.length || pending > 0}
            onClick={() => void undo()}
          >
            <Undo2 size={18} />
          </button>
          <button
            title="Refazer (Ctrl+Y)"
            aria-label="Refazer"
            disabled={!future.current.length || pending > 0}
            onClick={() => void redo()}
          >
            <Redo2 size={18} />
          </button>
          <span className="table-spacer" />
          <button onClick={() => canvas.current?.zoom(1 / 1.2)} title="Afastar">
            <Minus size={18} />
          </button>
          <button onClick={() => canvas.current?.zoom(1.2)} title="Aproximar">
            <Plus size={18} />
          </button>
          <button
            onClick={() => canvas.current?.fit()}
            title="Centralizar mapa"
          >
            <Maximize size={18} />
          </button>
        </aside>
        <div className="table-map-area">
          {scene && user ? (
            <>
              <TableCanvas
                ref={canvas}
                scene={scene}
                tokens={tokens}
                drawings={drawings}
                urls={urls}
                gm={gm}
                userId={user.id}
                canDraw={member?.can_draw ?? false}
                canMove={member?.can_move_tokens ?? false}
                activeToken={
                  content.data?.combat?.started
                    ? content.data.combat.active_token_id
                    : null
                }
                onMove={(moves) => {
                  if (moves.length)
                    void run(() => tableService.moveTokens(scene.id, moves));
                }}
                onDraw={draw}
                onErase={erase}
                onMoveDrawing={moveDrawing}
                onMoveMap={(point) => {
                  void run(() =>
                    tableService.saveScene(scene.id, scene.version, {
                      map_x: point[0],
                      map_y: point[1],
                    }),
                  );
                }}
                onContext={setContext}
                onPing={(point) => {
                  canvas.current?.ping(point);
                  void realtime.sendPing(point);
                }}
                onError={setError}
              />
              {gm && !scene.map_asset_id && (
                <label className="table-empty-map file-button">
                  <ImagePlus size={16} />
                  Enviar mapa
                  <input
                    aria-label="Enviar primeiro mapa"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      if (e.target.files?.[0]) uploadMap(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </>
          ) : (
            <div className="table-waiting">
              {gm ? (
                <>
                  <span>Nenhuma cena.</span>
                  <button onClick={() => sceneAction(null, "create", "Cena 1")}>
                    <Plus size={15} />
                    Criar cena
                  </button>
                </>
              ) : (
                <span>Aguardando uma cena compartilhada pelo mestre.</span>
              )}
            </div>
          )}
          {ui.tool !== "select" && ui.tool !== "pan" && (
            <div className="drawing-options">
              <label title="Cor">
                <input
                  aria-label="Cor do desenho"
                  type="color"
                  value={ui.color}
                  onChange={(e) => ui.set({ color: e.target.value })}
                />
              </label>
              <label>
                Espessura
                <input
                  aria-label="Espessura"
                  type="number"
                  min={1}
                  max={40}
                  value={ui.width}
                  onChange={(e) =>
                    ui.set({
                      width: Math.max(1, Math.min(40, Number(e.target.value))),
                    })
                  }
                />
              </label>
              <label>
                Opacidade
                <input
                  aria-label="Opacidade do desenho"
                  type="number"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={ui.opacity}
                  onChange={(e) =>
                    ui.set({
                      opacity: Math.max(
                        0.05,
                        Math.min(1, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
              {gm && (
                <label className="table-check">
                  <input
                    type="checkbox"
                    checked={ui.privateDrawing}
                    onChange={(e) =>
                      ui.set({ privateDrawing: e.target.checked })
                    }
                  />
                  <EyeOff size={13} />
                  Privado
                </label>
              )}
              {ui.tool === "text" && (
                <input
                  aria-label="Texto do desenho"
                  value={ui.text}
                  maxLength={2000}
                  onChange={(e) => ui.set({ text: e.target.value })}
                  placeholder="Texto para inserir"
                />
              )}
              {gm && (
                <button onClick={clearLayer} title="Limpar camada">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )}
          {confirm && (
            <div
              className="table-confirm"
              role="alertdialog"
              aria-label="Confirmar ação"
            >
              <span>{confirm.text}</span>
              <button onClick={confirm.action}>Confirmar</button>
              <button onClick={() => setConfirm(null)}>Cancelar</button>
            </div>
          )}
        </div>
        <nav className="table-tabs" aria-label="Painéis da mesa">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              title={label}
              aria-label={label}
              aria-expanded={ui.panel === id}
              className={ui.panel === id ? "selected" : ""}
              onClick={() => ui.togglePanel(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {ui.panel && (
          <aside
            className="table-panel"
            style={{ width: ui.panelWidth }}
            aria-label={`Painel ${ui.panel}`}
          >
            <div
              className="panel-resizer"
              role="separator"
              aria-label="Redimensionar painel"
              aria-orientation="vertical"
              onPointerDown={(event) => {
                const start = event.clientX,
                  width = ui.panelWidth;
                event.currentTarget.setPointerCapture(event.pointerId);
                const move = (e: PointerEvent) =>
                  useTableUI
                    .getState()
                    .set({
                      panelWidth: Math.min(
                        520,
                        Math.max(260, width + start - e.clientX),
                      ),
                    });
                const end = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", end);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", end);
              }}
            />
            <button
              className="table-panel-close"
              title="Recolher painel"
              onClick={() => ui.set({ panel: null })}
            >
              <ChevronRight size={16} />
            </button>
            <div className="table-panel-scroll">
              {ui.panel === "tokens" && scene && (
                <TokensPanel
                  tokens={tokens}
                  assets={core.data?.assets ?? []}
                  roster={core.data?.roster ?? []}
                  selection={ui.selection}
                  gm={gm}
                  userId={user!.id}
                  canMove={member?.can_move_tokens ?? false}
                  combatIds={
                    content.data?.combatants.map((c) => c.token_id) ?? []
                  }
                  onSelect={select}
                  onCreate={addToken}
                  onSave={(token, values) => {
                    void run(() =>
                      tableService.saveToken(token.id, token.version, values),
                    );
                  }}
                  onMove={(moves) => {
                    void run(() => tableService.moveTokens(scene.id, moves));
                  }}
                  onDuplicate={duplicate}
                  onDelete={(token) => removeTokens([token.id])}
                  onUpload={(token, file) => {
                    void run(async () => {
                      const asset = await tableService.upload(
                        campaignId,
                        file,
                        "token",
                      );
                      await tableService.saveToken(token.id, token.version, {
                        asset_id: asset.id,
                      });
                    });
                  }}
                  onCombat={addCombat}
                  onHp={(token, delta) => {
                    void run(() => tableService.hp(token.id, delta));
                  }}
                />
              )}
              {ui.panel === "scenes" && (
                <ScenesPanel
                  scenes={core.data?.scenes ?? []}
                  current={sceneId ?? ""}
                  active={core.data?.state?.active_scene_id ?? null}
                  gm={gm}
                  onView={setViewScene}
                  onAction={sceneAction}
                  onDelete={(s) =>
                    setConfirm({
                      text: `Excluir a cena “${s.name}” e seus tokens e desenhos?`,
                      action: () => {
                        setConfirm(null);
                        void run(async () => {
                          await tableService.sceneAction(
                            campaignId,
                            s.id,
                            "delete",
                          );
                          setViewScene(null);
                        });
                      },
                    })
                  }
                />
              )}
              {ui.panel === "settings" && scene && (
                <>
                  <MapPanel
                    scene={scene}
                    assets={core.data?.assets ?? []}
                    gm={gm}
                    onSave={(values) => {
                      void run(() =>
                        tableService.saveScene(scene.id, scene.version, values),
                      );
                    }}
                    onUpload={uploadMap}
                  />
                  {gm && (
                    <button onClick={exportData}>
                      <Download size={15} />
                      Exportar dados da campanha
                    </button>
                  )}
                </>
              )}
              {ui.panel === "combat" && scene && (
                <CombatPanel
                  combat={content.data?.combat ?? null}
                  combatants={content.data?.combatants ?? []}
                  tokens={tokens}
                  gm={gm}
                  onAction={(action, direction) => {
                    void run(() =>
                      tableService.combatAction(scene.id, action, direction),
                    );
                  }}
                  onInitiative={(token, value) => {
                    void run(() => tableService.initiative(token, value));
                  }}
                  onRemove={(id) => {
                    void run(() => tableService.removeCombatant(id));
                  }}
                  onHp={(id, delta) => {
                    void run(() => tableService.hp(id, delta));
                  }}
                  onSelect={select}
                />
              )}
              {ui.panel === "audio" && (
                <AudioPanel
                  assets={core.data?.assets ?? []}
                  music={core.data?.music ?? null}
                  control={audio}
                  gm={gm}
                  onUpload={(file) => {
                    void run(() =>
                      tableService.upload(campaignId, file, "audio"),
                    );
                  }}
                  onMusic={(asset, playing, loop, volume, position) => {
                    void run(() =>
                      tableService.music(campaignId, {
                        asset_id: asset,
                        playing,
                        loop,
                        volume,
                        position,
                      }),
                    );
                  }}
                  onSfx={(asset, action) => {
                    void run(() => tableService.sfx(campaignId, asset, action));
                  }}
                />
              )}
            </div>
          </aside>
        )}
      </div>
      <footer className="table-bottom">
        <DiceDock
          rolls={core.data?.rolls ?? []}
          roster={core.data?.roster ?? []}
          gm={gm}
          busy={pending > 0}
          onRoll={(expression, visibility) => {
            void run(() =>
              tableService.roll(campaignId, expression, visibility),
            );
          }}
        />
        <div className="table-audio-strip">
          <Music2 size={14} />
          <span>
            {core.data?.assets.find((a) => a.id === core.data?.music?.asset_id)
              ?.name ?? "Sem música"}
          </span>
          {audio && (
            <>
              <button
                onClick={audio.enable}
                disabled={audio.enabled && !audio.blocked}
              >
                {!audio.enabled || audio.blocked
                  ? "Ativar áudio"
                  : "Áudio ativo"}
              </button>
              <input
                aria-label="Volume individual"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={audio.volume}
                onChange={(e) => audio.setVolume(Number(e.target.value))}
              />
            </>
          )}
          <button
            onClick={() => ui.togglePanel("audio")}
            title="Painel de áudio"
          >
            <ChevronLeft size={15} />
          </button>
        </div>
      </footer>
      {core.data && (
        <AudioBridge
          campaign={campaignId}
          music={core.data.music}
          events={core.data.sfx}
          urls={urls}
          clockOffset={core.data.clockOffset}
          onReady={setAudio}
          onEnded={() => {
            const m = core.data?.music;
            if (gm && m?.playing && !m.loop)
              void run(() =>
                tableService.music(campaignId, {
                  ...m,
                  playing: false,
                  position: audio?.position() ?? m.position,
                }),
              );
          }}
        />
      )}
      {context && (
        <div
          className="table-context"
          style={{
            left: Math.min(context.x, window.innerWidth - 210),
            top: Math.min(context.y, window.innerHeight - 230),
          }}
          role="menu"
        >
          {context.token ? (
            <>
              <strong>{context.token.name}</strong>
              <button
                role="menuitem"
                onClick={() => {
                  select(context.token!.id);
                  setContext(null);
                }}
              >
                <Settings2 size={14} />
                Editar
              </button>
              {gm && (
                <>
                  <button
                    role="menuitem"
                    onClick={() => {
                      duplicate(context.token!);
                      setContext(null);
                    }}
                  >
                    <Copy size={14} />
                    Duplicar
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      void run(() =>
                        tableService.saveToken(
                          context.token!.id,
                          context.token!.version,
                          { visible: !context.token!.visible },
                        ),
                      );
                      setContext(null);
                    }}
                  >
                    <EyeOff size={14} />
                    {context.token.visible ? "Ocultar" : "Mostrar"}
                  </button>
                  <button
                    role="menuitem"
                    disabled={content.data?.combatants.some(
                      (c) => c.token_id === context.token!.id,
                    )}
                    onClick={() => {
                      addCombat(context.token!);
                      setContext(null);
                    }}
                  >
                    <Swords size={14} />
                    Adicionar ao combate
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      removeTokens([context.token!.id]);
                      setContext(null);
                    }}
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  canvas.current?.ping(context.point);
                  void realtime.sendPing(context.point);
                  setContext(null);
                }}
              >
                Ping
              </button>
              {gm && (
                <button
                  role="menuitem"
                  onClick={() => {
                    addToken();
                    setContext(null);
                  }}
                >
                  Criar token
                </button>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
