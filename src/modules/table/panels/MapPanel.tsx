import { ImagePlus, Lock, Trash2 } from "lucide-react";
import type { Asset, Scene, SceneEdit } from "../types";
import { useTableUI } from "../store";
import { NumberField, TextField } from "./fields";
type Props = {
  scene: Scene;
  assets: Asset[];
  gm: boolean;
  onSave: (values: SceneEdit) => void;
  onUpload: (file: File) => void;
};
export function MapPanel(p: Props) {
  const s = p.scene,
    ui = useTableUI();
  return (
    <>
      <div className="table-panel-heading">
        <h2>Mapa e grid</h2>
      </div>
      {!p.gm ? (
        <p className="table-empty">O mestre configura o mapa e o grid.</p>
      ) : (
        <section className="table-properties">
          <TextField
            label="Nome da cena"
            value={s.name}
            onSave={(name) => p.onSave({ name })}
          />
          <label className="table-check">
            <input
              type="checkbox"
              checked={s.is_public}
              onChange={(e) => p.onSave({ is_public: e.target.checked })}
            />
            Cena compartilhada
          </label>
          <div className="table-inline-actions">
            <label className="file-button">
              <ImagePlus size={15} />
              Enviar mapa
              <input
                aria-label="Enviar mapa"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) p.onUpload(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {s.map_asset_id && (
              <button onClick={() => p.onSave({ map_asset_id: null })}>
                <Trash2 size={15} />
                Remover mapa
              </button>
            )}
          </div>
          <label>
            Imagem do mapa
            <select
              value={s.map_asset_id ?? ""}
              onChange={(e) =>
                p.onSave({ map_asset_id: e.target.value || null })
              }
            >
              <option value="">Sem mapa</option>
              {p.assets
                .filter((a) => a.kind !== "audio")
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="table-check">
            <input
              type="checkbox"
              checked={s.map_locked}
              onChange={(e) => p.onSave({ map_locked: e.target.checked })}
            />
            <Lock size={13} />
            Bloquear posição do mapa
          </label>
          <div className="table-field-grid">
            <NumberField
              label="Mapa X"
              value={s.map_x}
              onSave={(map_x) => p.onSave({ map_x })}
            />
            <NumberField
              label="Mapa Y"
              value={s.map_y}
              onSave={(map_y) => p.onSave({ map_y })}
            />
            <NumberField
              label="Largura do mapa"
              value={s.map_width}
              min={1}
              max={30000}
              onSave={(map_width) => p.onSave({ map_width })}
            />
            <NumberField
              label="Altura do mapa"
              value={s.map_height}
              min={1}
              max={30000}
              onSave={(map_height) => p.onSave({ map_height })}
            />
          </div>
          <h3>Grid</h3>
          <label className="table-check">
            <input
              type="checkbox"
              checked={s.grid_visible}
              onChange={(e) => p.onSave({ grid_visible: e.target.checked })}
            />
            Mostrar grid
          </label>
          <label>
            Formato
            <select
              value={s.grid_type}
              onChange={(e) =>
                p.onSave({ grid_type: e.target.value as Scene["grid_type"] })
              }
            >
              <option value="square">Quadrado</option>
              <option value="hex">Hexagonal</option>
            </select>
          </label>
          <div className="table-field-grid">
            <NumberField
              label="Célula (px)"
              value={s.grid_size}
              min={16}
              max={256}
              onSave={(grid_size) => p.onSave({ grid_size })}
            />
            <NumberField
              label="Escala por célula"
              value={s.unit_distance}
              min={0.1}
              max={1000}
              step={0.1}
              onSave={(unit_distance) => p.onSave({ unit_distance })}
            />
            <TextField
              label="Unidade"
              value={s.unit}
              maxLength={12}
              onSave={(unit) => p.onSave({ unit })}
            />
            <label>
              Cor das linhas
              <input
                type="color"
                value={s.grid_color}
                onChange={(e) => p.onSave({ grid_color: e.target.value })}
              />
            </label>
            <NumberField
              label="Alinhamento X"
              value={s.grid_x}
              min={-10000}
              max={10000}
              onSave={(grid_x) => p.onSave({ grid_x })}
            />
            <NumberField
              label="Alinhamento Y"
              value={s.grid_y}
              min={-10000}
              max={10000}
              onSave={(grid_y) => p.onSave({ grid_y })}
            />
            <NumberField
              label="Opacidade (0–1)"
              value={s.grid_opacity}
              min={0}
              max={1}
              step={0.05}
              onSave={(grid_opacity) => p.onSave({ grid_opacity })}
            />
          </div>
        </section>
      )}
      <label className="table-check">
        <input
          type="checkbox"
          checked={ui.snap}
          onChange={(e) => ui.set({ snap: e.target.checked })}
        />
        Encaixar tokens no grid
      </label>
      <p className="table-help">
        Espaço + arrastar: câmera. Roda: zoom. Alt + clique: ping.
      </p>
    </>
  );
}
