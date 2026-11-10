import { Music2, Pause, Play, Square, Upload, Volume2 } from "lucide-react";
import type { Asset, Music } from "../types";
import type { AudioControl } from "../AudioBridge";
import { NumberField } from "./fields";
type Props = {
  assets: Asset[];
  music: Music | null;
  control: AudioControl | null;
  gm: boolean;
  onUpload: (file: File) => void;
  onMusic: (
    asset: string | null,
    playing: boolean,
    loop: boolean,
    volume: number,
    position: number,
  ) => void;
  onSfx: (asset: string | null, action: "play" | "stop") => void;
};
export function AudioPanel(p: Props) {
  const state = p.music,
    position = () => p.control?.position() ?? 0;
  return (
    <>
      <div className="table-panel-heading">
        <h2>Áudio</h2>
        {p.gm && (
          <label className="file-button">
            <Upload size={15} />
            Enviar
            <input
              aria-label="Enviar áudio"
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4"
              onChange={(e) => {
                if (e.target.files?.[0]) p.onUpload(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {p.control && (
        <section className="audio-personal">
          <label>
            Seu volume
            <input
              aria-label="Seu volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={p.control.volume}
              onChange={(e) => p.control?.setVolume(Number(e.target.value))}
            />
          </label>
          {!p.control.enabled || p.control.blocked ? (
            <button onClick={p.control.enable}>
              <Volume2 size={15} />
              Ativar áudio neste navegador
            </button>
          ) : (
            <span className="table-help">Áudio ativado neste navegador</span>
          )}
        </section>
      )}
      <h3>Música da mesa</h3>
      <div className="audio-track">
        <Music2 size={17} />
        <span>
          {p.assets.find((a) => a.id === state?.asset_id)?.name ??
            "Nenhuma faixa selecionada"}
        </span>
      </div>
      {p.gm && (
        <section className="table-properties">
          <div className="table-inline-actions">
            <button
              disabled={!state?.asset_id}
              onClick={() =>
                p.onMusic(
                  state!.asset_id,
                  !state!.playing,
                  state!.loop,
                  state!.volume,
                  position(),
                )
              }
            >
              {state?.playing ? <Pause size={15} /> : <Play size={15} />}{" "}
              {state?.playing ? "Pausar" : "Reproduzir"}
            </button>
            <button
              disabled={!state?.asset_id}
              onClick={() =>
                p.onMusic(null, false, false, state?.volume ?? 0.7, 0)
              }
            >
              <Square size={14} />
              Parar
            </button>
          </div>
          <label className="table-check">
            <input
              type="checkbox"
              checked={state?.loop ?? false}
              onChange={(e) =>
                p.onMusic(
                  state?.asset_id ?? null,
                  state?.playing ?? false,
                  e.target.checked,
                  state?.volume ?? 0.7,
                  position(),
                )
              }
            />
            Loop
          </label>
          <NumberField
            label="Volume principal (0–100)"
            value={Math.round((state?.volume ?? 0.7) * 100)}
            min={0}
            max={100}
            onSave={(value) =>
              p.onMusic(
                state?.asset_id ?? null,
                state?.playing ?? false,
                state?.loop ?? false,
                value / 100,
                position(),
              )
            }
          />
        </section>
      )}
      <h3>Arquivos</h3>
      {!p.assets.some((a) => a.kind === "audio") && (
        <p className="table-empty">Nenhum áudio disponível.</p>
      )}
      <div className="audio-library">
        {p.assets
          .filter((a) => a.kind === "audio")
          .map((asset) => (
            <div key={asset.id}>
              <strong>{asset.name}</strong>
              <div className="table-inline-actions">
                {p.gm && (
                  <>
                    <button
                      onClick={() =>
                        p.onMusic(
                          asset.id,
                          true,
                          state?.loop ?? false,
                          state?.volume ?? 0.7,
                          0,
                        )
                      }
                    >
                      <Play size={13} />
                      Música
                    </button>
                    <button onClick={() => p.onSfx(asset.id, "play")}>
                      SFX · mesa
                    </button>
                  </>
                )}
                <button
                  onClick={() => p.control?.local(asset.id)}
                  disabled={!p.control?.enabled}
                >
                  Local
                </button>
              </div>
            </div>
          ))}
      </div>
      <div className="table-inline-actions">
        {p.gm && (
          <button onClick={() => p.onSfx(null, "stop")}>
            Parar SFX da mesa
          </button>
        )}
        <button onClick={() => p.control?.stopLocal()}>Parar SFX local</button>
      </div>
      <p className="table-help">
        Música e SFX da mesa são comandos compartilhados. “Local” toca apenas
        neste navegador.
      </p>
    </>
  );
}
