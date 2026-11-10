import { useState } from "react";
import { Check, Copy, Play, Plus, Trash2 } from "lucide-react";
import type { Scene } from "../types";
type Props = {
  scenes: Scene[];
  current: string;
  active: string | null;
  gm: boolean;
  onView: (id: string) => void;
  onAction: (scene: string | null, action: string, name?: string) => void;
  onDelete: (scene: Scene) => void;
};
export function ScenesPanel(p: Props) {
  const [name, setName] = useState("");
  return (
    <>
      <div className="table-panel-heading">
        <h2>Cenas</h2>
      </div>
      {p.gm && (
        <form
          className="table-create-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              p.onAction(null, "create", name.trim());
              setName("");
            }
          }}
        >
          <input
            aria-label="Nome da nova cena"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Nome da cena"
            required
          />
          <button title="Criar cena">
            <Plus size={17} />
          </button>
        </form>
      )}
      <div className="table-scene-list">
        {p.scenes.map((scene) => (
          <div
            className={scene.id === p.current ? "selected" : ""}
            key={scene.id}
          >
            <button className="scene-name" onClick={() => p.onView(scene.id)}>
              {scene.id === p.active && <Check size={13} />}
              <span>{scene.name}</span>
              <small>{scene.is_public ? "Compartilhada" : "Privada"}</small>
            </button>
            {p.gm && (
              <div className="table-inline-actions">
                <button
                  disabled={scene.id === p.active}
                  onClick={() => p.onAction(scene.id, "activate")}
                  title={`Ativar ${scene.name} para todos`}
                >
                  <Play size={14} />
                </button>
                <button
                  onClick={() => p.onAction(scene.id, "duplicate")}
                  title="Duplicar cena"
                >
                  <Copy size={14} />
                </button>
                <button onClick={() => p.onDelete(scene)} title="Excluir cena">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
