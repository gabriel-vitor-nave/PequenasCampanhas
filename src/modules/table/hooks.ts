import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backend } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { tableService } from "./service";

export function useTableData(campaign: string, scene: string | null) {
  const { user } = useAuth();
  const core = useQuery({
    queryKey: ["table", campaign, user?.id, "core"],
    queryFn: () => tableService.core(campaign),
    refetchInterval: 15_000,
  });
  const sceneId = scene ?? core.data?.state?.active_scene_id ?? null;
  const content = useQuery({
    queryKey: ["table", campaign, user?.id, "scene", sceneId],
    queryFn: () => tableService.scene(sceneId!),
    enabled: !!sceneId,
    refetchInterval: 15_000,
  });
  return { core, content, sceneId };
}
export function useTableRealtime(
  campaign: string,
  onPing: (point: [number, number]) => void,
) {
  const { user, session } = useAuth();
  const cache = useQueryClient();
  const [status, setStatus] = useState("Conectando");
  const [present, setPresent] = useState<string[]>([]);
  const ping = useRef(onPing);
  ping.current = onPing;
  const channelRef = useRef<ReturnType<
    ReturnType<typeof backend>["channel"]
  > | null>(null);
  useEffect(() => {
    if (!user || !session) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void cache.invalidateQueries({ queryKey: ["table", campaign] });
      }, 70);
    };
    const channel = backend().channel(`table:${campaign}`, {
      config: { private: true, presence: { key: user.id } },
    });
    channelRef.current = channel;
    for (const table of [
      "table_state",
      "table_scenes",
      "table_assets",
      "table_tokens",
      "table_drawings",
      "table_rolls",
      "table_combatants",
      "table_combat",
      "table_music",
      "table_sfx",
    ]) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `campaign_id=eq.${campaign}`,
        },
        refresh,
      );
    }
    channel.on("presence", { event: "sync" }, () =>
      setPresent(Object.keys(channel.presenceState())),
    );
    channel.on("broadcast", { event: "ping" }, (message) => {
      const point = (message.payload as { point?: unknown }).point;
      if (
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(
          (n) =>
            typeof n === "number" &&
            Number.isFinite(n) &&
            Math.abs(n) <= 100000,
        )
      )
        ping.current(point as [number, number]);
    });
    void backend()
      .realtime.setAuth(session.access_token)
      .then(() => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setStatus("Conectado");
            void channel.track({ user_id: user.id });
            refresh();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
            setStatus("Reconectando");
          else if (status === "CLOSED") setStatus("Desconectado");
        });
      });
    const online = () => {
      refresh();
      setStatus("Reconectando");
    };
    const offline = () => setStatus("Sem conexão");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      channelRef.current = null;
      void backend().removeChannel(channel);
    };
  }, [campaign, user?.id, session?.access_token, cache]);
  return {
    status,
    present,
    sendPing: (point: [number, number]) =>
      channelRef.current?.send({
        type: "broadcast",
        event: "ping",
        payload: { point },
      }),
  };
}
export function useAssetUrls(assets: Array<{ id: string; path: string }>) {
  const signature = assets.map((a) => `${a.id}:${a.path}`).join("|");
  const query = useQuery({
    queryKey: ["table-urls", signature],
    queryFn: async () => {
      const values = await Promise.all(
        assets.map(
          async (asset) =>
            [asset.id, await tableService.signedUrl(asset.path)] as const,
        ),
      );
      return Object.fromEntries(values);
    },
    enabled: assets.length > 0,
    staleTime: 25 * 60_000,
    refetchInterval: 30 * 60_000,
  });
  return { urls: query.data ?? {}, error: query.error };
}
