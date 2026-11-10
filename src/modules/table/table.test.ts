// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { inspectTableFile } from "../../../shared/table-files";
import { createAssetHandler } from "../../../supabase/functions/table-assets/handler";
import {
  screenToWorld,
  snapPoint,
  snapToken,
  clientToCanvas,
  beginPinch,
  pinchCamera,
} from "./canvas/geometry";
import type { Scene } from "./types";

describe("camera and grid coordinates", () => {
  it("maps physical touch coordinates into a clockwise landscape canvas", () => {
    expect(
      clientToCanvas([300, 180], { left: 40, top: 80, right: 360 }, true),
    ).toEqual([100, 60]);
    expect(
      clientToCanvas([300, 180], { left: 40, top: 80, right: 360 }, false),
    ).toEqual([260, 100]);
  });
  it("keeps the world point between two fingers anchored while pinching and panning", () => {
    const pinch = beginPinch(
      { x: 20, y: 30, scale: 1 },
      [100, 100],
      [200, 100],
    );
    const camera = pinchCamera(pinch, [80, 130], [280, 130]);
    expect(camera.scale).toBe(2);
    expect(screenToWorld([180, 130], camera)).toEqual(
      screenToWorld([150, 100], pinch.camera),
    );
    expect(pinchCamera(pinch, [-10000, 0], [10000, 0]).scale).toBe(4);
    expect(pinchCamera(pinch, [100, 100], [100, 100]).scale).toBe(0.1);
  });
  const scene = {
    grid_type: "square",
    grid_size: 50,
    grid_x: 10,
    grid_y: 20,
  } as Scene;
  it("converts pointer positions independently of zoom and camera movement", () => {
    expect(screenToWorld([210, 120], { x: 10, y: 20, scale: 2 })).toEqual([
      100, 50,
    ]);
  });
  it("snaps against an offset square grid and preserves free movement", () => {
    expect(snapPoint([81, 108], scene, true)).toEqual([60, 120]);
    expect(snapPoint([81, 108], scene, false)).toEqual([81, 108]);
  });
  it("centers a token on a hex cell, including negative coordinates", () => {
    const hex = { ...scene, grid_type: "hex" } as Scene;
    expect(snapToken([-14, -4], 1, hex, true)).toEqual([-15, -5]);
    const center = snapPoint([-95, 45], hex, true);
    expect(snapPoint(center, hex, true)[0]).toBeCloseTo(center[0]);
    expect(snapPoint(center, hex, true)[1]).toBeCloseTo(center[1]);
  });
});
describe("private asset upload boundary", () => {
  const env = {
    url: "https://test.supabase.co",
    publicKey: "public-key",
    serviceKey: "server-only-key",
  };
  const gm = "00000000-0000-4000-8000-000000000001",
    campaign = "00000000-0000-4000-8000-000000000002";
  const request = (type = "image/png") => {
    const form = new FormData();
    form.set("id", crypto.randomUUID());
    form.set("campaign_id", campaign);
    form.set("kind", "map");
    form.set(
      "file",
      new File(['<svg onload="alert(1)"></svg>'], "fake.png", { type }),
    );
    return new Request("https://test/table-assets", {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: form,
    });
  };
  it("does not trust the extension or supplied MIME type", () => {
    expect(
      inspectTableFile(new TextEncoder().encode("<svg></svg>")),
    ).toBeNull();
    expect(
      inspectTableFile(new TextEncoder().encode("<html>bad</html>")),
    ).toBeNull();
  });
  it("rejects an unauthenticated upload before any network access", async () => {
    const fetcher = vi.fn();
    const result = await createAssetHandler(
      env,
      fetcher,
    )(new Request("https://test/table-assets", { method: "POST" }));
    expect(result.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a player even with a valid Auth identity", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: gm }))
      .mockResolvedValueOnce(Response.json([{ role: "player" }]));
    const result = await createAssetHandler(env, fetcher)(request());
    expect(result.status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects forged image content before calling service-role storage", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: gm }))
      .mockResolvedValueOnce(Response.json([{ role: "gm" }]));
    const result = await createAssetHandler(env, fetcher)(request());
    expect(result.status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not let a player delete a campaign or its files", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: gm }))
      .mockResolvedValueOnce(Response.json([{ role: "player" }]));
    const result = await createAssetHandler(
      env,
      fetcher,
    )(
      new Request("https://test/table-assets?campaign_id=" + campaign, {
        method: "DELETE",
        headers: { authorization: "Bearer player-token" },
      }),
    );
    expect(result.status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("retains campaign metadata when file cleanup fails, so deletion can be retried", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: gm }))
      .mockResolvedValueOnce(Response.json([{ role: "gm" }]))
      .mockResolvedValueOnce(Response.json([{ path: campaign + "/map.png" }]))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const result = await createAssetHandler(
      env,
      fetcher,
    )(
      new Request("https://test/table-assets?campaign_id=" + campaign, {
        method: "DELETE",
        headers: { authorization: "Bearer gm-token" },
      }),
    );
    expect(result.status).toBe(503);
    expect(
      fetcher.mock.calls.some(
        ([url, options]) =>
          String(url).includes("/rest/v1/campaigns?") &&
          options.method === "DELETE",
      ),
    ).toBe(false);
  });
});
