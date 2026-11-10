import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Plus,
  Swords,
  Trash2,
  Unlock,
} from "lucide-react";
import type { Member } from "../../../types/database";
import type { Asset, Token, TokenEdit, TokenMove } from "../types";
import { NumberField, TextField } from "./fields";
type Props = {
  tokens: Token[];
  assets: Asset[];
  roster: Member[];
  selection: string[];
  gm: boolean;
  userId: string;
  canMove: boolean;
  combatIds: string[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSave: (token: Token, value: TokenEdit) => void;
  onMove: (moves: TokenMove[]) => void;
  onDuplicate: (token: Token) => void;
  onDelete: (token: Token) => void;
  onUpload: (token: Token, file: File) => void;
  onCombat: (token: Token) => void;
  onHp: (token: Token, delta: number) => void;
};
export function TokensPanel(p: Props) {
  const [search, setSearch] = useState(""),
    [amount, setAmount] = useState(1);
  const token = p.tokens.find((t) => p.selection.includes(t.id));
  const movable =
    token &&
    !token.locked &&
    (p.gm || (p.canMove && token.owner_ids.includes(p.userId)));
  return (
    <>
      <div className="table-panel-heading">
        <h2>Tokens</h2>
        {p.gm && (
          <button onClick={p.onCreate} title="Criar token">
            <Plus size={17} />
            Criar
          </button>
        )}
      </div>
      <input
        aria-label="Buscar tokens"
        placeholder="Buscar token"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="table-token-list">
        {p.tokens
          .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
          .map((t) => (
            <button
              key={t.id}
              className={p.selection.includes(t.id) ? "selected" : ""}
              onClick={() => p.onSelect(t.id)}
              aria-label={`Selecionar token ${t.name}`}
            >
              <span className="token-color" style={{ background: t.color }} />
              <span>{t.name}</span>
              {!t.visible && <EyeOff size={13} />}{" "}
              {t.locked && <Lock size={13} />}
              <small>{t.show_hp ? `${t.hp}/${t.max_hp}` : ""}</small>
            </button>
          ))}
        {!p.tokens.length && (
          <p className="table-empty">Nenhum token nesta cena.</p>
        )}
      </div>
      {token && (
        <section className="table-properties" key={token.id}>
          <TextField
            label="Nome do token"
            value={token.name}
            disabled={!p.gm}
            onSave={(name) => p.onSave(token, { name })}
          />
          <div className="table-inline-actions">
            {p.gm && (
              <>
                <label className="file-button">
                  <ImagePlus size={15} />
                  Imagem
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        p.onUpload(token, e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={() => p.onDuplicate(token)}
                  title="Duplicar token"
                >
                  <Copy size={15} />
                </button>
                <button
                  onClick={() => p.onSave(token, { visible: !token.visible })}
                  title={
                    token.visible
                      ? "Ocultar dos jogadores"
                      : "Mostrar para jogadores"
                  }
                >
                  {token.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button
                  onClick={() => p.onSave(token, { locked: !token.locked })}
                  title={
                    token.locked ? "Desbloquear posição" : "Bloquear posição"
                  }
                >
                  {token.locked ? <Lock size={15} /> : <Unlock size={15} />}
                </button>
                <button onClick={() => p.onDelete(token)} title="Excluir token">
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
          {p.gm && (
            <label>
              Imagem existente
              <select
                value={token.asset_id ?? ""}
                onChange={(e) =>
                  p.onSave(token, { asset_id: e.target.value || null })
                }
              >
                <option value="">Sem imagem</option>
                {p.assets
                  .filter((a) => a.kind !== "audio")
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="table-field-grid">
            <NumberField
              label="Posição X"
              value={token.x}
              disabled={!movable}
              onSave={(x) =>
                p.onMove([
                  { id: token.id, x, y: token.y, version: token.version },
                ])
              }
            />
            <NumberField
              label="Posição Y"
              value={token.y}
              disabled={!movable}
              onSave={(y) =>
                p.onMove([
                  { id: token.id, x: token.x, y, version: token.version },
                ])
              }
            />
          </div>
          <div className="table-field-grid">
            <NumberField
              label="Tamanho (células)"
              value={token.size}
              min={0.25}
              max={20}
              step={0.25}
              disabled={!p.gm}
              onSave={(size) => p.onSave(token, { size })}
            />
            <NumberField
              label="Rotação"
              value={token.rotation}
              min={-360}
              max={360}
              disabled={!p.gm}
              onSave={(rotation) => p.onSave(token, { rotation })}
            />
          </div>
          {p.gm && (
            <div className="table-field-grid">
              <label>
                Moldura
                <select
                  value={token.shape}
                  onChange={(e) =>
                    p.onSave(token, { shape: e.target.value as Token["shape"] })
                  }
                >
                  <option value="circle">Circular</option>
                  <option value="square">Quadrada</option>
                  <option value="none">Sem moldura</option>
                </select>
              </label>
              <label>
                Cor
                <input
                  type="color"
                  value={token.color}
                  onChange={(e) => p.onSave(token, { color: e.target.value })}
                />
              </label>
            </div>
          )}
          <div className="table-field-grid">
            <NumberField
              label="PV atual"
              value={token.hp}
              min={0}
              max={9999}
              disabled={!p.gm}
              onSave={(hp) => p.onSave(token, { hp })}
            />
            <NumberField
              label="PV máximo"
              value={token.max_hp}
              min={1}
              max={9999}
              disabled={!p.gm}
              onSave={(max_hp) =>
                p.onSave(token, { max_hp, hp: Math.min(token.hp, max_hp) })
              }
            />
            <NumberField
              label="PV temporário"
              value={token.temp_hp}
              min={0}
              max={9999}
              disabled={!p.gm}
              onSave={(temp_hp) => p.onSave(token, { temp_hp })}
            />
            <NumberField
              label="CA"
              value={token.ac}
              min={0}
              max={100}
              disabled={!p.gm}
              onSave={(ac) => p.onSave(token, { ac })}
            />
          </div>
          {p.gm && (
            <>
              <div className="table-hp-actions">
                <input
                  type="number"
                  aria-label="Quantidade de dano ou cura"
                  min={1}
                  max={9999}
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      Math.max(1, Math.min(9999, Number(e.target.value))),
                    )
                  }
                />
                <button onClick={() => p.onHp(token, -amount)}>Dano</button>
                <button onClick={() => p.onHp(token, amount)}>Cura</button>
              </div>
              <label className="table-check">
                <input
                  type="checkbox"
                  checked={token.show_hp}
                  onChange={(e) =>
                    p.onSave(token, { show_hp: e.target.checked })
                  }
                />
                Mostrar barra de vida
              </label>
              <NumberField
                label="Bônus de iniciativa"
                value={token.initiative_bonus}
                min={-30}
                max={30}
                onSave={(initiative_bonus) =>
                  p.onSave(token, { initiative_bonus })
                }
              />
              <TextField
                label="Condições (separadas por vírgula)"
                value={token.conditions.join(", ")}
                maxLength={500}
                onSave={(value) =>
                  p.onSave(token, {
                    conditions: value
                      .split(",")
                      .map((s) => s.trim().slice(0, 40))
                      .filter(Boolean)
                      .slice(0, 16),
                  })
                }
              />
              <label className="table-check">
                <input
                  type="checkbox"
                  checked={token.concentration}
                  onChange={(e) =>
                    p.onSave(token, { concentration: e.target.checked })
                  }
                />
                Concentração
              </label>
              <NumberField
                label="Ordem de sobreposição"
                value={token.z_index}
                min={-100000}
                max={100000}
                onSave={(z_index) => p.onSave(token, { z_index })}
              />
              <fieldset>
                <legend>Quem pode mover</legend>
                {p.roster.map((member) => (
                  <label className="table-check" key={member.user_id}>
                    <input
                      type="checkbox"
                      checked={token.owner_ids.includes(member.user_id)}
                      onChange={(e) =>
                        p.onSave(token, {
                          owner_ids: e.target.checked
                            ? [...token.owner_ids, member.user_id]
                            : token.owner_ids.filter(
                                (id) => id !== member.user_id,
                              ),
                        })
                      }
                    />
                    {member.display_name}
                  </label>
                ))}
              </fieldset>
              <button
                disabled={p.combatIds.includes(token.id)}
                onClick={() => p.onCombat(token)}
              >
                <Swords size={15} />
                {p.combatIds.includes(token.id)
                  ? "No combate"
                  : "Adicionar ao combate"}
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
}
