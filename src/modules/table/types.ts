export type Point = [number, number];
export type Tool =
  | "select"
  | "pan"
  | "pencil"
  | "line"
  | "rect"
  | "ellipse"
  | "arrow"
  | "text"
  | "eraser";
export type Asset = {
  id: string;
  campaign_id: string;
  name: string;
  kind: "map" | "token" | "audio";
  path: string;
  mime: string;
  bytes: number;
  created_by: string;
  created_at: string;
};
export type Scene = {
  id: string;
  campaign_id: string;
  name: string;
  is_public: boolean;
  map_asset_id: string | null;
  map_x: number;
  map_y: number;
  map_width: number;
  map_height: number;
  map_locked: boolean;
  grid_visible: boolean;
  grid_type: "square" | "hex";
  grid_size: number;
  grid_x: number;
  grid_y: number;
  grid_color: string;
  grid_opacity: number;
  unit_distance: number;
  unit: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type TableState = {
  campaign_id: string;
  active_scene_id: string | null;
  version: number;
  updated_at: string;
};
export type Token = {
  id: string;
  campaign_id: string;
  scene_id: string;
  name: string;
  asset_id: string | null;
  x: number;
  y: number;
  size: number;
  rotation: number;
  shape: "circle" | "square" | "none";
  color: string;
  owner_ids: string[];
  visible: boolean;
  locked: boolean;
  show_hp: boolean;
  hp: number;
  max_hp: number;
  temp_hp: number;
  ac: number;
  initiative_bonus: number;
  conditions: string[];
  concentration: boolean;
  z_index: number;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Drawing = {
  id: string;
  campaign_id: string;
  scene_id: string;
  created_by: string;
  visibility: "shared" | "gm";
  tool: Exclude<Tool, "select" | "pan" | "eraser">;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  text: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Roll = {
  id: string;
  campaign_id: string;
  user_id: string;
  expression: string;
  label: string;
  visibility: "shared" | "gm";
  values: number[];
  kept: number[];
  modifier: number;
  total: number;
  created_at: string;
};
export type Combatant = {
  campaign_id: string;
  scene_id: string;
  token_id: string;
  initiative: number | null;
  created_at: string;
};
export type Combat = {
  scene_id: string;
  campaign_id: string;
  started: boolean;
  round: number;
  active_token_id: string | null;
  version: number;
  updated_at: string;
};
export type Music = {
  campaign_id: string;
  asset_id: string | null;
  playing: boolean;
  loop: boolean;
  volume: number;
  position: number;
  started_at: string;
  version: number;
  updated_at: string;
};
export type Sfx = {
  id: string;
  campaign_id: string;
  asset_id: string | null;
  action: "play" | "stop";
  volume: number;
  created_at: string;
};
export type Camera = { x: number; y: number; scale: number };
export type TokenMove = { id: string; x: number; y: number; version: number };
export type SceneEdit = Partial<
  Omit<Scene, "id" | "campaign_id" | "version" | "created_at" | "updated_at">
>;
export type TokenEdit = Partial<
  Omit<
    Token,
    "id" | "campaign_id" | "scene_id" | "version" | "created_at" | "updated_at"
  >
>;
export type DrawingInput = Omit<
  Drawing,
  "version" | "created_at" | "updated_at"
>;
export type TokenInput = Pick<
  Token,
  "id" | "campaign_id" | "scene_id" | "name" | "x" | "y"
> &
  TokenEdit;
