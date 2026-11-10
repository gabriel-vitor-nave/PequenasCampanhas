import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import type { Combat, Combatant, Token } from "../types";
type Props = {
  combat: Combat | null;
  combatants: Combatant[];
  tokens: Token[];
  gm: boolean;
  onAction: (action: string, direction?: number) => void;
  onInitiative: (token: string, value: number | null) => void;
  onRemove: (id: string) => void;
  onHp: (id: string, delta: number) => void;
  onSelect: (id: string) => void;
};
export function CombatPanel(p: Props) {
  const [amount, setAmount] = useState(1);
  const ordered = [...p.combatants].sort(
      (a, b) =>
        (b.initiative ?? -10000) - (a.initiative ?? -10000) ||
        a.created_at.localeCompare(b.created_at),
    ),
    active = p.tokens.find((t) => t.id === p.combat?.active_token_id);
  return (
    <>
      <div className="table-panel-heading">
        <h2>Combate</h2>
        <span>
          {p.combat?.started ? `Rodada ${p.combat.round}` : "Não iniciado"}
        </span>
      </div>
      {p.gm && (
        <div className="table-inline-actions combat-actions">
          <button
            disabled={!ordered.length}
            onClick={() => p.onAction("initiative")}
          >
            <Dices size={15} />
            Iniciativas
          </button>
          {p.combat?.started ? (
            <>
              <button
                onClick={() => p.onAction("step", -1)}
                title="Turno anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => p.onAction("step", 1)}
                title="Próximo turno"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => p.onAction("end")}
                title="Encerrar combate"
              >
                <Square size={14} />
              </button>
            </>
          ) : (
            <button
              disabled={!ordered.length}
              onClick={() => p.onAction("start")}
            >
              <Play size={15} />
              Iniciar
            </button>
          )}
        </div>
      )}
      {p.combat?.started && (
        <div className="combat-current">
          Turno: <strong>{active?.name ?? "Mestre"}</strong>
        </div>
      )}
      {!ordered.length && (
        <p className="table-empty">
          Selecione um token e use “Adicionar ao combate”.
        </p>
      )}
      <div className="combat-list">
        {ordered.map((entry) => {
          const token = p.tokens.find((t) => t.id === entry.token_id);
          if (!token) return null;
          return (
            <section
              key={entry.token_id}
              className={
                entry.token_id === p.combat?.active_token_id ? "active" : ""
              }
            >
              <div className="combat-identity">
                <input
                  type="number"
                  aria-label={`Iniciativa de ${token.name}`}
                  key={`${entry.token_id}:${entry.initiative}`}
                  defaultValue={entry.initiative ?? ""}
                  placeholder="—"
                  disabled={!p.gm}
                  min={-1000}
                  max={1000}
                  onBlur={(e) => {
                    const value =
                      e.target.value === "" ? null : Number(e.target.value);
                    if (e.target.validity.valid && value !== entry.initiative)
                      p.onInitiative(entry.token_id, value);
                  }}
                />
                <button onClick={() => p.onSelect(token.id)}>
                  {token.name}
                </button>
                <span>
                  {token.hp}/{token.max_hp}
                  {token.temp_hp > 0 ? ` +${token.temp_hp}` : ""}
                </span>
                {p.gm && (
                  <button
                    title={`Remover ${token.name} do combate`}
                    onClick={() => p.onRemove(token.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {token.conditions.length > 0 && (
                <div className="combat-conditions">
                  {token.conditions.join(", ")}
                  {token.concentration ? " · Concentração" : ""}
                </div>
              )}
              {p.gm && (
                <div className="table-hp-actions">
                  <input
                    type="number"
                    aria-label={`Quantidade para ${token.name}`}
                    min={1}
                    max={9999}
                    value={amount}
                    onChange={(e) =>
                      setAmount(
                        Math.max(1, Math.min(9999, Number(e.target.value))),
                      )
                    }
                  />
                  <button onClick={() => p.onHp(token.id, -amount)}>
                    Dano
                  </button>
                  <button onClick={() => p.onHp(token.id, amount)}>Cura</button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
