import {
  inspectTableFile,
  imageLimit,
  audioLimit,
} from "../../../shared/table-files.ts";
type Env = { url: string; serviceKey: string; publicKey: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origins = new Set([
  "https://pequenas-campanhas.ripplingantelope.chatgpt.site",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
]);
export function createAssetHandler(env: Env, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    };
    if (origin && origins.has(origin))
      headers["Access-Control-Allow-Origin"] = origin;
    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.has(origin))
      return respond({ code: "PC_FORBIDDEN" }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (!["POST", "DELETE"].includes(request.method))
      return respond({ code: "PC_INVALID_INPUT" }, 405);
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer "))
      return respond({ code: "PC_UNAUTHENTICATED" }, 401);
    try {
      const publicHeaders = {
        apikey: env.publicKey,
        Authorization: authorization,
      };
      const identity = await fetcher(env.url + "/auth/v1/user", {
        headers: publicHeaders,
      });
      if (!identity.ok) return respond({ code: "PC_UNAUTHENTICATED" }, 401);
      const user = (await identity.json()) as { id: string };
      if (request.method === "DELETE") {
        const campaign =
          new URL(request.url).searchParams.get("campaign_id") ?? "";
        if (!uuid.test(campaign))
          return respond({ code: "PC_INVALID_INPUT" }, 400);
        const membership = await fetcher(
          env.url +
            `/rest/v1/campaign_members?select=role&campaign_id=eq.${campaign}&user_id=eq.${user.id}`,
          { headers: publicHeaders },
        );
        if (
          !membership.ok ||
          ((await membership.json()) as Array<{ role: string }>)[0]?.role !==
            "gm"
        )
          return respond({ code: "PC_FORBIDDEN" }, 403);
        const adminHeaders = {
          apikey: env.serviceKey,
          Authorization: `Bearer ${env.serviceKey}`,
          "Content-Type": "application/json",
        };
        // Remove files before metadata. A failed cleanup retains the campaign so the GM can retry.
        let offset = 0;
        while (true) {
          const resources = await fetcher(
            env.url +
              `/rest/v1/table_assets?select=path&campaign_id=eq.${campaign}&order=id&offset=${offset}&limit=100`,
            { headers: adminHeaders },
          );
          if (!resources.ok) return respond({ code: "PC_DELETE_FAILED" }, 503);
          const rows = (await resources.json()) as Array<{ path: string }>;
          if (!rows.length) break;
          const removed = await fetcher(
            env.url + "/storage/v1/object/campaign-assets",
            {
              method: "DELETE",
              headers: adminHeaders,
              body: JSON.stringify({ prefixes: rows.map((row) => row.path) }),
            },
          );
          if (!removed.ok) return respond({ code: "PC_DELETE_FAILED" }, 503);
          offset += rows.length;
        }
        const deleted = await fetcher(
          env.url + `/rest/v1/campaigns?id=eq.${campaign}&select=id`,
          {
            method: "DELETE",
            headers: { ...publicHeaders, Prefer: "return=representation" },
          },
        );
        if (!deleted.ok) return respond({ code: "PC_DELETE_FAILED" }, 503);
        const rows = (await deleted.json()) as Array<{ id: string }>;
        if (!rows.length) return respond({ code: "PC_FORBIDDEN" }, 403);
        return respond({ id: campaign });
      }
      if (
        Number(request.headers.get("content-length") ?? 0) >
        audioLimit + 65536
      )
        return respond({ code: "PC_FILE_TOO_LARGE" }, 413);
      const reader = request.body?.getReader();
      if (!reader) return respond({ code: "PC_INVALID_INPUT" }, 400);
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > audioLimit + 65536) {
          await reader.cancel();
          return respond({ code: "PC_FILE_TOO_LARGE" }, 413);
        }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const part of chunks) {
        bytes.set(part, offset);
        offset += part.byteLength;
      }
      const form = await new Response(bytes, {
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      }).formData();
      const campaign = String(form.get("campaign_id") ?? "");
      const id = String(form.get("id") ?? "");
      const kind = String(form.get("kind") ?? "");
      const file = form.get("file");
      if (
        !uuid.test(campaign) ||
        !uuid.test(id) ||
        !["map", "token", "audio"].includes(kind) ||
        !(file instanceof File)
      )
        return respond({ code: "PC_INVALID_INPUT" }, 400);
      const membership = await fetcher(
        env.url +
          `/rest/v1/campaign_members?select=role&campaign_id=eq.${campaign}&user_id=eq.${user.id}`,
        { headers: publicHeaders },
      );
      if (
        !membership.ok ||
        ((await membership.json()) as Array<{ role: string }>)[0]?.role !== "gm"
      )
        return respond({ code: "PC_FORBIDDEN" }, 403);
      const content = new Uint8Array(await file.arrayBuffer());
      const checked = inspectTableFile(content);
      if (!checked || (kind === "audio") !== (checked.media === "audio"))
        return respond({ code: "PC_INVALID_FILE" }, 400);
      if (
        content.byteLength >
          (checked.media === "image" ? imageLimit : audioLimit) ||
        content.byteLength === 0
      )
        return respond({ code: "PC_FILE_TOO_LARGE" }, 413);
      const adminHeaders = {
        apikey: env.serviceKey,
        Authorization: `Bearer ${env.serviceKey}`,
      };
      const existing = await fetcher(
        env.url +
          `/rest/v1/table_assets?id=eq.${id}&campaign_id=eq.${campaign}`,
        { headers: adminHeaders },
      );
      if (!existing.ok) return respond({ code: "PC_UPLOAD_FAILED" }, 503);
      const prior = (await existing.json()) as unknown[];
      if (prior.length) return respond({ asset: prior[0] });
      const path = `${campaign}/${id}.${checked.extension}`;
      const upload = await fetcher(
        env.url + "/storage/v1/object/campaign-assets/" + path,
        {
          method: "POST",
          headers: {
            ...adminHeaders,
            "Content-Type": checked.mime,
            "x-upsert": "false",
          },
          body: content,
        },
      );
      if (!upload.ok) return respond({ code: "PC_UPLOAD_FAILED" }, 503);
      const asset = {
        id,
        campaign_id: campaign,
        name: file.name.slice(0, 160) || "Arquivo",
        kind,
        path,
        mime: checked.mime,
        bytes: content.byteLength,
        created_by: user.id,
      };
      const saved = await fetcher(env.url + "/rest/v1/table_assets", {
        method: "POST",
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(asset),
      });
      if (!saved.ok) {
        await fetcher(env.url + "/storage/v1/object/campaign-assets", {
          method: "DELETE",
          headers: { ...adminHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [path] }),
        });
        return respond({ code: "PC_UPLOAD_FAILED" }, 503);
      }
      const rows = (await saved.json()) as unknown[];
      return respond({ asset: rows[0] });
    } catch {
      return respond(
        {
          code:
            request.method === "DELETE"
              ? "PC_DELETE_FAILED"
              : "PC_UPLOAD_FAILED",
        },
        503,
      );
    }
  };
}
