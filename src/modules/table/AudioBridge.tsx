import { useEffect, useRef, useState } from "react";
import type { Music, Sfx } from "./types";
function silentWav() {
  const bytes = new Uint8Array(364),
    data = new DataView(bytes.buffer);
  for (const [offset, text] of [
    [0, "RIFF"],
    [8, "WAVEfmt "],
    [36, "data"],
  ] as const)
    for (let i = 0; i < text.length; i++)
      bytes[offset + i] = text.charCodeAt(i);
  data.setUint32(4, 356, true);
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, 8000, true);
  data.setUint32(28, 16000, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  data.setUint32(40, 320, true);
  return "data:audio/wav;base64," + btoa(String.fromCharCode(...bytes));
}
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
    pool = useRef<HTMLAudioElement[]>([]),
    audioContext = useRef<AudioContext | null>(null),
    gains = useRef(new Map<HTMLAudioElement, GainNode>()),
    unlocking = useRef(false),
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
  const audioVolume = (audio: HTMLAudioElement, value: number) => {
    const gain = gains.current.get(audio),
      volume = Math.max(0, Math.min(1, value));
    if (gain) {
      audio.volume = 1;
      gain.gain.value = volume;
    } else audio.volume = volume;
  };
  // Unlock these same elements inside the tap handler. WebKit grants media
  // playback per element; creating a new <audio> for each remote SFX loses it.
  // https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/
  const enable = () => {
    if (unlocking.current) return;
    unlocking.current = true;
    const AudioClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!audioContext.current && AudioClass)
      audioContext.current = new AudioClass();
    const resume = audioContext.current?.resume();
    while (pool.current.length < 16) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      pool.current.push(audio);
      effects.current?.appendChild(audio);
    }
    const ready = [music.current, ...pool.current]
      .filter((audio): audio is HTMLAudioElement => !!audio)
      .map((audio) => {
        audio.pause();
        audio.onloadedmetadata = null;
        delete audio.dataset.sfx;
        delete audio.dataset.asset;
        if (audioContext.current && !gains.current.has(audio)) {
          const gain = audioContext.current.createGain();
          audioContext.current.createMediaElementSource(audio).connect(gain);
          gain.connect(audioContext.current.destination);
          gains.current.set(audio, gain);
        }
        audioVolume(audio, 0);
        audio.loop = false;
        audio.src = silentWav();
        return audio.play().then(() => audio.pause());
      });
    void Promise.allSettled([resume, ...ready]).then((results) => {
      unlocking.current = false;
      setEnabled(true);
      setBlocked(results.some((result) => result.status === "rejected"));
    });
  };
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
    if (unlocking.current) return;
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
    audioVolume(element, volume * state.volume);
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
        delete audio.dataset.sfx;
        audio.onloadedmetadata = null;
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
    const audio =
      pool.current.find((audio) => !audio.dataset.sfx) ?? pool.current[0];
    if (!audio) return;
    audio.pause();
    audio.src = url;
    audio.dataset.sfx = eventId;
    audio.dataset.masterVolume = String(masterVolume);
    audioVolume(audio, volume * masterVolume);
    audio.preload = "auto";
    const release = () => {
      audio.pause();
      delete audio.dataset.sfx;
      audio.onloadedmetadata = null;
    };
    audio.onended = release;
    audio.onerror = release;
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
        release();
        return;
      }
      audio.currentTime = elapsed < audio.duration ? elapsed : 0;
      void audio.play().catch(() => {
        setBlocked(true);
        release();
      });
    };
  };
  useEffect(() => {
    props.onReady({
      enabled,
      blocked,
      volume,
      enable,
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
        audioVolume(audio, volume * Number(audio.dataset.masterVolume ?? 1));
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
      void audioContext.current?.close();
    },
    [],
  );
  return (
    <>
      <audio
        ref={music}
        data-table-music="true"
        preload="metadata"
        crossOrigin="anonymous"
        onEnded={() => {
          if (music.current?.dataset.asset && !unlocking.current)
            latest.current.onEnded();
        }}
        hidden
      />
      <div ref={effects} hidden aria-hidden="true" />
    </>
  );
}
