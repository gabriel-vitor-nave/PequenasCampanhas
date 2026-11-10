import { useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Dices, Lock } from "lucide-react";
import type { Member } from "../../types/database";
import type { Roll } from "./types";
type Props = {
  rolls: Roll[];
  roster: Member[];
  gm: boolean;
  busy: boolean;
  onRoll: (expression: string, visibility: "shared" | "gm") => void;
};
export function DiceDock(p: Props) {
  const [open, setOpen] = useState(false),
    [controls, setControls] = useState(false),
    [expression, setExpression] = useState("1d20"),
    [privateRoll, setPrivate] = useState(false),
    [mode, setMode] = useState("normal"),
    [modifier, setModifier] = useState(0);
  const visibility = p.gm && privateRoll ? "gm" : "shared";
  const roll = (sides: number) => {
    const dice =
        sides === 20 && mode !== "normal"
          ? `2d20${mode === "advantage" ? "kh1" : "kl1"}`
          : `1d${sides}`,
      value = dice + (modifier ? `${modifier > 0 ? "+" : ""}${modifier}` : "");
    p.onRoll(value, visibility);
    setOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    p.onRoll(expression, visibility);
    setOpen(true);
  };
  return (
    <section
      className={`dice-dock ${open ? "expanded" : ""} ${controls ? "controls-expanded" : ""}`}
      aria-label="Dados"
    >
      <div className="dice-mobile-summary table-mobile-only">
        <button
          aria-label={controls ? "Fechar rolador" : "Abrir rolador"}
          aria-expanded={controls}
          onClick={() => setControls(!controls)}
        >
          <Dices size={18} />
          Dados{controls ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          disabled={p.busy}
          onClick={() => roll(20)}
          aria-label="Rolar d20"
        >
          d20
        </button>
        <output aria-live="polite">
          {p.rolls[0]
            ? `${p.rolls[0].expression}: ${p.rolls[0].total}`
            : "Sem rolagens"}
        </output>
      </div>
      <div className="dice-content">
        <div className="dice-controls">
          <button
            aria-label={
              open ? "Recolher histórico de dados" : "Abrir histórico de dados"
            }
            onClick={() => setOpen(!open)}
          >
            <Dices size={17} />
            {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
          <div className="quick-dice">
            {[4, 6, 8, 10, 12, 20, 100].map((n) => (
              <button
                key={n}
                disabled={p.busy}
                onClick={() => roll(n)}
                aria-label={`Rolar d${n}`}
              >
                d{n}
              </button>
            ))}
          </div>
          <select
            aria-label="Modo do d20"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="advantage">Vantagem</option>
            <option value="disadvantage">Desvantagem</option>
          </select>
          <input
            aria-label="Modificador de dados"
            title="Modificador"
            type="number"
            value={modifier}
            min={-9999}
            max={9999}
            onChange={(e) => setModifier(Number(e.target.value))}
          />
          <form onSubmit={submit}>
            <input
              aria-label="Expressão de dados"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              maxLength={64}
              placeholder="2d6+3"
              required
            />
            <button disabled={p.busy} type="submit">
              Rolar
            </button>
          </form>
          {p.gm && (
            <label className="table-check">
              <input
                type="checkbox"
                checked={privateRoll}
                onChange={(e) => setPrivate(e.target.checked)}
              />
              <Lock size={13} />
              Privada
            </label>
          )}
        </div>
        {open && (
          <div className="roll-history" aria-live="polite">
            {!p.rolls.length && <p className="table-empty">Nenhuma rolagem.</p>}
            {p.rolls.map((roll) => (
              <article key={roll.id} data-roll-id={roll.id}>
                <header>
                  <strong>
                    {p.roster.find((m) => m.user_id === roll.user_id)
                      ?.display_name ?? "Participante"}
                  </strong>
                  {roll.visibility === "gm" && <Lock size={12} />}
                  <span>{roll.label || roll.expression}</span>
                  <time>
                    {new Date(roll.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </header>
                <span className="roll-breakdown">
                  [{roll.values.join(", ")}]
                  {roll.kept.length !== roll.values.length
                    ? ` → [${roll.kept.join(", ")}]`
                    : ""}
                  {roll.modifier
                    ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}`
                    : ""}
                </span>
                <strong className="roll-total">{roll.total}</strong>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
