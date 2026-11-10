import { useEffect, useRef, useState } from "react";
import type { Music, Sfx } from "./types";
export type AudioControl = {
  enabled: boolean;
  blocked: boolean;
  volume: number;
  enable: () => void;
  setVolume: (value: number) => void;
  local: (assetId: string) => void;
  stopLocal: () => void;
  position: () => number;
};
type Props = {
  campaign: string;
  music: Music | null;
  events: Sfx[];
  urls: Record<string, string>;
  clockOffset: number;
  onReady: (controls: AudioControl) => void;
  onEnded: () => void;
};
export function AudioBridge(props: Props) {
  const music = useRef<HTMLAudioElement>(null),
    effects = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    seen = useRef(new Set<string>()),
    initialized = useRef(false),
    [enabled, setEnabled] = useState(false),
    [blocked, setBlocked] = useState(false);
  const [volume, setVolume] = useState(() => {
    const value = Number(localStorage.getItem("pc:volume") ?? ".7");
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.7;
  });
  latest.current = props;
  const targetPosition = (state: Music) =>
    state.position +
    (state.playing
      ? Math.max(
          0,
          (Date.now() +
            latest.current.clockOffset -
            new Date(state.started_at).getTime()) /
            1000,
        )
      : 0);
  const reconcile = () => {
    const element = music.current,
      state = latest.current.music;
    if (!element) return;
    const url = state?.asset_id ? latest.current.urls[state.asset_id] : null;
    if (!state || !url) {
      element.pause();
      element.removeAttribute("src");
      return;
    }
    if (element.dataset.asset !== state.asset_id || element.src !== url) {
      element.dataset.asset = state.asset_id!;
      element.src = url;
      element.load();
    }
    element.volume = Math.max(0, Math.min(1, volume * state.volume));
    element.loop = state.loop;
    const sync = () => {
      let position = targetPosition(state);
      if (Number.isFinite(element.duration) && element.duration > 0)
        position = state.loop
          ? position % element.duration
          : Math.min(position, element.duration);
      if (
        Number.isFinite(position) &&
        Math.abs(element.currentTime - position) > 0.7
      )
        element.currentTime = position;
      if (state.playing && enabled)
        void element
          .play()
          .then(() => setBlocked(false))
          .catch(() => setBlocked(true));
      else element.pause();
    };
    if (element.readyState >= 1) sync();
    else element.onloadedmetadata = sync;
  };
  const stopLocal = () => {
    if (effects.current)
      for (const audio of effects.current.querySelectorAll("audio")) {
        audio.pause();
        audio.remove();
      }
  };
  const playEffect = (
    assetId: string,
    eventId: string,
    masterVolume: number,
    createdAt?: string,
  ) => {
    const url = latest.current.urls[assetId];
    if (!url || !enabled) return;
    const audio = new Audio(url);
    audio.dataset.sfx = eventId;
    audio.dataset.masterVolume = String(masterVolume);
    audio.volume = Math.max(0, Math.min(1, volume * masterVolume));
    audio.preload = "auto";
    effects.current?.appendChild(audio);
    audio.onended = () => audio.remove();
    audio.onerror = () => audio.remove();
    audio.onloadedmetadata = () => {
      const elapsed = createdAt
        ? Math.max(
            0,
            (Date.now() +
              latest.current.clockOffset -
              new Date(createdAt).getTime()) /
              1000,
          )
        : 0;
      if (
        Number.isFinite(audio.duration) &&
        elapsed >= audio.duration &&
        elapsed > 3
      ) {
        audio.remove();
        return;
      }
      audio.currentTime = elapsed < audio.duration ? elapsed : 0;
      void audio.play().catch(() => {
        setBlocked(true);
        audio.remove();
      });
    };
  };
  useEffect(() => {
    props.onReady({
      enabled,
      blocked,
      volume,
      enable: () => {
        setEnabled(true);
        setBlocked(false);
      },
      setVolume: (value) => {
        const next = Math.max(0, Math.min(1, value));
        localStorage.setItem("pc:volume", String(next));
        setVolume(next);
      },
      local: (id) => playEffect(id, crypto.randomUUID(), 1),
      stopLocal,
      position: () => music.current?.currentTime ?? 0,
    });
  }, [enabled, blocked, volume, props.onReady]);
  useEffect(() => {
    if (effects.current)
      for (const audio of effects.current.querySelectorAll("audio"))
        audio.volume = Math.max(
          0,
          Math.min(1, volume * Number(audio.dataset.masterVolume ?? 1)),
        );
  }, [volume]);
  useEffect(() => {
    reconcile();
  }, [props.music, props.urls, props.clockOffset, enabled, volume]);
  useEffect(() => {
    const timer = setInterval(reconcile, 5000);
    return () => clearInterval(timer);
  }, [enabled, volume]);
  useEffect(() => {
    if (!initialized.current) {
      for (const event of props.events) seen.current.add(event.id);
      initialized.current = true;
      return;
    }
    for (const event of [...props.events].reverse()) {
      if (seen.current.has(event.id)) continue;
      if (
        event.action === "play" &&
        event.asset_id &&
        !props.urls[event.asset_id]
      )
        continue;
      seen.current.add(event.id);
      if (event.action === "stop") {
        stopLocal();
        continue;
      }
      if (
        event.asset_id &&
        Date.now() + props.clockOffset - new Date(event.created_at).getTime() <
          8000
      )
        playEffect(event.asset_id, event.id, event.volume, event.created_at);
    }
  }, [props.events, props.urls, enabled, volume]);
  useEffect(
    () => () => {
      music.current?.pause();
      stopLocal();
    },
    [],
  );
  return (
    <>
      <audio
        ref={music}
        data-table-music="true"
        preload="metadata"
        onEnded={() => latest.current.onEnded()}
        hidden
      />
      <div ref={effects} hidden aria-hidden="true" />
    </>
  );
}
