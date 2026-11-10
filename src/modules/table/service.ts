import { backend } from "../../lib/supabase";
import { campaignService } from "../campaigns/service";
import type {
  DrawingInput,
  Drawing,
  SceneEdit,
  TokenEdit,
  TokenInput,
  TokenMove,
  Music,
  Asset,
} from "./types";

async function checked<T>(
  query: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    if (
      typeof error === "object" &&
      "code" in error &&
      error.code === "PGRST116"
    )
      throw new Error("PC_CONFLICT");
    throw error;
  }
  return data;
}
export const tableService = {
  ensure: (id: string) =>
    checked(backend().rpc("ensure_table", { p_campaign_id: id })),
  async core(id: string) {
    const sent = Date.now();
    const [state, scenes, assets, rolls, music, sfx, roster, clock] =
      await Promise.all([
        checked(
          backend()
            .from("table_state")
            .select("*")
            .eq("campaign_id", id)
            .maybeSingle(),
        ),
        checked(
          backend()
            .from("table_scenes")
            .select("*")
            .eq("campaign_id", id)
            .order("created_at"),
        ),
        checked(
          backend()
            .from("table_assets")
            .select("*")
            .eq("campaign_id", id)
            .order("created_at", { ascending: false }),
        ),
        checked(
          backend()
            .from("table_rolls")
            .select("*")
            .eq("campaign_id", id)
            .order("created_at", { ascending: false })
            .limit(80),
        ),
        checked(
          backend()
            .from("table_music")
            .select("*")
            .eq("campaign_id", id)
            .maybeSingle(),
        ),
        checked(
          backend()
            .from("table_sfx")
            .select("*")
            .eq("campaign_id", id)
            .order("created_at", { ascending: false })
            .limit(30),
        ),
        campaignService.roster(id),
        checked(backend().rpc("table_server_time")),
      ]);
    if (!clock) throw new Error("PC_CONNECTION_FAILED");
    return {
      state,
      scenes: scenes ?? [],
      assets: assets ?? [],
      rolls: rolls ?? [],
      music,
      sfx: sfx ?? [],
      roster,
      clockOffset: new Date(clock).getTime() - (sent + Date.now()) / 2,
    };
  },
  async scene(id: string) {
    const [tokens, drawings, combatants, combat] = await Promise.all([
      checked(
        backend()
          .from("table_tokens")
          .select("*")
          .eq("scene_id", id)
          .order("z_index"),
      ),
      checked(
        backend()
          .from("table_drawings")
          .select("*")
          .eq("scene_id", id)
          .order("created_at"),
      ),
      checked(
        backend().from("table_combatants").select("*").eq("scene_id", id),
      ),
      checked(
        backend()
          .from("table_combat")
          .select("*")
          .eq("scene_id", id)
          .maybeSingle(),
      ),
    ]);
    return {
      tokens: tokens ?? [],
      drawings: drawings ?? [],
      combatants: combatants ?? [],
      combat,
    };
  },
  sceneAction: (
    campaign: string,
    scene: string | null,
    action: string,
    name = "Cena",
    requestId = crypto.randomUUID(),
  ) =>
    checked(
      backend().rpc("manage_table_scene", {
        p_campaign_id: campaign,
        p_scene_id: scene,
        p_action: action,
        p_name: name,
        p_request_id: requestId,
      }),
    ),
  saveScene: (id: string, version: number, values: SceneEdit) =>
    checked(
      backend()
        .from("table_scenes")
        .update(values)
        .eq("id", id)
        .eq("version", version)
        .select()
        .single(),
    ),
  addToken: (values: TokenInput) =>
    checked(backend().from("table_tokens").insert(values).select().single()),
  saveToken: (id: string, version: number, values: TokenEdit) =>
    checked(
      backend()
        .from("table_tokens")
        .update(values)
        .eq("id", id)
        .eq("version", version)
        .select()
        .single(),
    ),
  deleteToken: (id: string) =>
    checked(
      backend()
        .from("table_tokens")
        .delete()
        .eq("id", id)
        .select("id")
        .single(),
    ),
  deleteTokens: (ids: string[]) =>
    checked(backend().from("table_tokens").delete().in("id", ids).select("id")),
  moveTokens: (
    scene: string,
    moves: TokenMove[],
    requestId = crypto.randomUUID(),
  ) =>
    checked(
      backend().rpc("move_table_tokens", {
        p_scene_id: scene,
        p_moves: moves.map((m) => ({ ...m })),
        p_request_id: requestId,
      }),
    ),
  addDrawing: (values: DrawingInput) =>
    checked(backend().from("table_drawings").insert(values).select().single()),
  saveDrawing: (drawing: Drawing, points: Drawing["points"]) =>
    checked(
      backend()
        .from("table_drawings")
        .update({ points })
        .eq("id", drawing.id)
        .eq("version", drawing.version)
        .select()
        .single(),
    ),
  deleteDrawing: (drawing: Drawing) =>
    checked(
      backend()
        .from("table_drawings")
        .delete()
        .eq("id", drawing.id)
        .eq("version", drawing.version)
        .select("id")
        .single(),
    ),
  clearDrawings: (ids: string[]) =>
    checked(
      backend().from("table_drawings").delete().in("id", ids).select("id"),
    ),
  roll: (
    campaign: string,
    expression: string,
    visibility: "shared" | "gm",
    label = "",
    requestId = crypto.randomUUID(),
  ) =>
    checked(
      backend().rpc("roll_table_dice", {
        p_campaign_id: campaign,
        p_expression: expression,
        p_visibility: visibility,
        p_label: label,
        p_request_id: requestId,
      }),
    ),
  addCombatant: (campaign: string, scene: string, token: string) =>
    checked(
      backend()
        .from("table_combatants")
        .insert({ campaign_id: campaign, scene_id: scene, token_id: token })
        .select()
        .single(),
    ),
  removeCombatant: (token: string) =>
    checked(
      backend()
        .from("table_combatants")
        .delete()
        .eq("token_id", token)
        .select("token_id")
        .single(),
    ),
  initiative: (token: string, value: number | null) =>
    checked(
      backend()
        .from("table_combatants")
        .update({ initiative: value })
        .eq("token_id", token)
        .select()
        .single(),
    ),
  combatAction: (
    scene: string,
    action: string,
    direction = 1,
    requestId = crypto.randomUUID(),
  ) =>
    checked(
      backend().rpc("table_combat_action", {
        p_scene_id: scene,
        p_action: action,
        p_direction: direction,
        p_request_id: requestId,
      }),
    ),
  hp: (token: string, delta: number, requestId = crypto.randomUUID()) =>
    checked(
      backend().rpc("adjust_table_hp", {
        p_token_id: token,
        p_delta: delta,
        p_request_id: requestId,
      }),
    ),
  music: (
    campaign: string,
    values: Pick<
      Music,
      "asset_id" | "playing" | "loop" | "position" | "volume"
    >,
    requestId = crypto.randomUUID(),
  ) =>
    checked(
      backend().rpc("set_table_music", {
        p_campaign_id: campaign,
        p_asset_id: values.asset_id,
        p_playing: values.playing,
        p_loop: values.loop,
        p_position: values.position,
        p_volume: values.volume,
        p_request_id: requestId,
      }),
    ),
  sfx: (
    campaign: string,
    asset: string | null,
    action: "play" | "stop",
    volume = 1,
    requestId = crypto.randomUUID(),
  ) =>
    checked(
      backend().rpc("emit_table_sfx", {
        p_campaign_id: campaign,
        p_asset_id: asset,
        p_action: action,
        p_volume: volume,
        p_request_id: requestId,
      }),
    ),
  async signedUrl(path: string) {
    const result = await checked(
      backend().storage.from("campaign-assets").createSignedUrl(path, 3600),
    );
    if (!result?.signedUrl) throw new Error("PC_ASSET_UNAVAILABLE");
    return result.signedUrl;
  },
  async upload(
    campaign: string,
    file: File,
    kind: Asset["kind"],
    id = crypto.randomUUID(),
  ) {
    const body = new FormData();
    body.set("campaign_id", campaign);
    body.set("id", id);
    body.set("kind", kind);
    body.set("file", file);
    const { data, error } = await backend().functions.invoke("table-assets", {
      body,
    });
    if (error) {
      if ("context" in error && error.context instanceof Response) {
        const payload = (await error.context.json().catch(() => null)) as {
          code?: string;
        } | null;
        if (payload?.code) throw new Error(payload.code);
      }
      throw error;
    }
    return (data as { asset: Asset }).asset;
  },
};
export type TableCore = Awaited<ReturnType<typeof tableService.core>>;
export type SceneData = Awaited<ReturnType<typeof tableService.scene>>;
