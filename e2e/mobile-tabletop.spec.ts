import { test, expect, type Page, type CDPSession } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deployedBackend } from "../src/lib/deployment";

test.use({ trace: "off", actionTimeout: 15_000 });
test("mesa horizontal por toque: preparação solo, persistência e entrada posterior de jogador", async ({
  browser,
  page,
  browserName,
}, info) => {
  test.skip(
    process.env.E2E_MOBILE_LIVE !== "1" || info.project.name !== "mobile",
    "Explicit mobile acceptance with disposable accounts",
  );
  test.setTimeout(240_000);
  type Account = { username: string; password: string; id?: string };
  type Fixture = { gm: Account; player?: Account; campaign?: string };
  const path = ".tmp/mobile-acceptance.local",
    config = deployedBackend;
  mkdirSync(".tmp", { recursive: true });
  const existing = existsSync(path);
  const fixture: Fixture = existing
    ? JSON.parse(readFileSync(path, "utf8"))
    : {
        gm: {
          username: "mob_gm_" + randomUUID().replaceAll("-", "").slice(0, 10),
          password: randomUUID() + "Aa1!",
        },
      };
  const save = () => writeFileSync(path, JSON.stringify(fixture));
  const authenticate = async (account: Account, register = false) => {
    const client = createClient(
      config.VITE_SUPABASE_URL,
      config.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const result = await client.functions.invoke("account-access", {
      body: {
        action: register ? "register" : "login",
        username: account.username,
        password: account.password,
      },
    });
    expect(result.error, "Disposable account authentication").toBeNull();
    const session = await client.auth.setSession(result.data.session);
    expect(session.error).toBeNull();
    account.id = session.data.user!.id;
    return client;
  };
  const api = await authenticate(fixture.gm, !existing);
  save();
  const rpc = async (
    client: SupabaseClient,
    name: string,
    args: Record<string, unknown>,
  ) => {
    const result = await client.rpc(name, args);
    expect(result.error, name).toBeNull();
    return result.data;
  };
  if (fixture.campaign)
    expect(
      (
        await api.functions.invoke(
          "table-assets?campaign_id=" + fixture.campaign,
          { method: "DELETE" },
        )
      ).error,
    ).toBeNull();
  const campaign: string = await rpc(api, "create_campaign", {
    p_name: "Preparação solo mobile",
    p_description: "Fixture de validação sem jogadores",
  });
  fixture.campaign = campaign;
  save();
  expect(
    (
      await api
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaign)
    ).data,
  ).toEqual([{ role: "gm" }]);
  expect(
    (
      await api
        .from("campaign_invites")
        .select("id")
        .eq("campaign_id", campaign)
    ).data,
  ).toHaveLength(0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const login = async (target: Page, account: Account) => {
    await target.goto("/entrar");
    await target
      .getByRole("textbox", { name: "Usuário", exact: true })
      .fill(account.username);
    await target.getByLabel("Senha", { exact: true }).fill(account.password);
    await target.getByRole("button", { name: "Entrar", exact: true }).tap();
    await expect(
      target.getByRole("heading", { name: "Campanhas", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await target.goto("/campanhas/" + campaign);
    await target.getByRole("link", { name: "Abrir mesa", exact: true }).tap();
    await expect(target.locator("canvas[data-table-canvas]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(target.locator(".table-sync")).toHaveText("Conectado", {
      timeout: 20_000,
    });
  };
  await login(page, fixture.gm);
  const shell = page.locator(".table-shell"),
    canvas = page.locator(".table-canvas");
  await expect(shell).toHaveAttribute("data-rotated", "true");
  await expect(page.locator(".table-presence summary")).toContainText(
    "0 jogador",
  );
  expect(
    await shell.evaluate(
      (element) => element.clientWidth > element.clientHeight,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#75818d";
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "#3b4653";
    ctx.fillRect(60, 60, 680, 480);
    ctx.fillStyle = "#9da7ad";
    ctx.fillRect(80, 80, 640, 440);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Enviar primeiro mapa")
    .setInputFiles({
      name: "mapa-solo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(page.getByLabel("Enviar primeiro mapa")).toHaveCount(0, {
    timeout: 20_000,
  });
  await page
    .locator(".table-tabs")
    .getByRole("button", { name: "Mapa e grid", exact: true })
    .tap();
  const editNumber = async (label: string, value: number) => {
    const field = page.getByLabel(label, { exact: true });
    await field.fill(String(value));
    await field.press("Enter");
    await expect(page.locator(".table-sync")).not.toContainText("Salvando");
  };
  await editNumber("Célula (px)", 50);
  await expect
    .poll(
      async () =>
        (
          await api
            .from("table_scenes")
            .select("grid_size")
            .eq("campaign_id", campaign)
            .single()
        ).data?.grid_size,
    )
    .toBe(50);
  await page
    .locator(".table-tabs")
    .getByRole("button", { name: "Tokens", exact: true })
    .tap();
  await page.getByRole("button", { name: "Criar", exact: true }).tap();
  await page.getByLabel("Nome do token", { exact: true }).fill("Guardião");
  await page.getByLabel("Nome do token", { exact: true }).press("Enter");
  await expect(page.locator(".table-token-list")).toContainText("Guardião");
  const token = async () =>
    (
      await api
        .from("table_tokens")
        .select("*")
        .eq("campaign_id", campaign)
        .eq("name", "Guardião")
        .single()
    ).data!;
  await editNumber("Posição X", 300);
  await expect.poll(async () => (await token()).x).toBe(300);
  await editNumber("Posição Y", 250);
  await expect.poll(async () => (await token()).y).toBe(250);
  await page
    .getByRole("button", { name: "Recolher painel", exact: true })
    .tap();
  await page
    .getByRole("button", { name: "Centralizar mapa", exact: true })
    .tap();

  const screenPoint = async (x: number, y: number) =>
    canvas.evaluate(
      (element, point) => {
        const b = element.getBoundingClientRect(),
          rotated =
            element.closest(".table-shell")?.getAttribute("data-rotated") ===
            "true";
        return rotated
          ? { x: b.right - point.y, y: b.top + point.x }
          : { x: b.left + point.x, y: b.top + point.y };
      },
      { x, y },
    );
  let cdp: CDPSession | null =
    browserName === "chromium"
      ? await page.context().newCDPSession(page)
      : null;
  const touch = async (
    type: "touchStart" | "touchMove" | "touchEnd",
    points: Array<{ x: number; y: number; id?: number }>,
  ) => {
    if (cdp)
      await cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map((point, index) => ({
          ...point,
          id: point.id ?? index,
          radiusX: 2,
          radiusY: 2,
          force: 1,
        })),
      });
    else
      await page.evaluate(
        ({ type, points }) => {
          const element = document.querySelector(".table-canvas")!;
          for (const [index, p] of points.entries())
            element.dispatchEvent(
              new PointerEvent(
                type === "touchStart" ? "pointerdown" : "pointermove",
                {
                  bubbles: true,
                  pointerType: "touch",
                  pointerId: (p.id ?? index) + 1,
                  clientX: p.x,
                  clientY: p.y,
                  buttons: 1,
                },
              ),
            );
          if (type === "touchEnd")
            for (let i = 1; i <= 2; i++)
              element.dispatchEvent(
                new PointerEvent("pointerup", {
                  bubbles: true,
                  pointerType: "touch",
                  pointerId: i,
                }),
              );
        },
        { type, points },
      );
  };
  const drag = async (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => {
    await touch("touchStart", [a]);
    await touch("touchMove", [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]);
    await touch("touchMove", [b]);
    await touch("touchEnd", []);
  };
  const camera = async () =>
    canvas.evaluate((element) => ({
      x: Number((element as HTMLElement).dataset.cameraX),
      y: Number((element as HTMLElement).dataset.cameraY),
      scale: Number((element as HTMLElement).dataset.cameraScale),
    }));
  const before = await camera(),
    a = await screenPoint(170, 110),
    b = await screenPoint(270, 110),
    c = await screenPoint(140, 130),
    d = await screenPoint(300, 130);
  const revision = (
    await api
      .from("table_state")
      .select("version")
      .eq("campaign_id", campaign)
      .single()
  ).data!.version;
  await touch("touchStart", [a, b]);
  await touch("touchMove", [c, d]);
  await touch("touchEnd", []);
  await expect
    .poll(async () => (await camera()).scale)
    .toBeGreaterThan(before.scale * 1.4);
  expect(
    (
      await api
        .from("table_state")
        .select("version")
        .eq("campaign_id", campaign)
        .single()
    ).data!.version,
  ).toBe(revision);
  const priorPan = await camera();
  await drag(await screenPoint(60, 70), await screenPoint(95, 95));
  await expect.poll(async () => (await camera()).x).not.toBe(priorPan.x);
  let hero = await token(),
    view = await camera();
  await drag(
    await screenPoint(
      view.x + (hero.x + 25) * view.scale,
      view.y + (hero.y + 25) * view.scale,
    ),
    await screenPoint(
      view.x + (hero.x + 125) * view.scale,
      view.y + (hero.y + 25) * view.scale,
    ),
  );
  await expect.poll(async () => (await token()).x).toBe(hero.x + 100);
  hero = await token();
  view = await camera();
  await touch("touchStart", [
    await screenPoint(
      view.x + (hero.x + 25) * view.scale,
      view.y + (hero.y + 25) * view.scale,
    ),
  ]);
  await expect(page.getByRole("menu", { name: "Ações da mesa" })).toBeVisible();
  await touch("touchEnd", []);
  await page.screenshot({ path: info.outputPath("mobile-menu.png") });
  expect((await token()).visible).toBe(true);
  await page.getByRole("menuitem", { name: "Editar", exact: true }).tap();
  await expect(page.getByLabel("Posição X", { exact: true })).toHaveValue(
    String(hero.x),
  );
  await page.screenshot({
    path: info.outputPath("mobile-painel-horizontal.png"),
  });
  await page
    .getByRole("button", { name: "Adicionar ao combate", exact: true })
    .tap();
  await page
    .locator(".table-tabs")
    .getByRole("button", { name: "Combate", exact: true })
    .tap();
  await page.getByRole("button", { name: "Iniciativas", exact: true }).tap();
  await expect(page.getByLabel("Iniciativa de Guardião")).not.toHaveValue("");
  await page.getByRole("button", { name: "Iniciar", exact: true }).tap();
  await expect(page.locator(".combat-current")).toContainText("Guardião");
  await page.getByRole("button", { name: "Dano", exact: true }).tap();
  await expect.poll(async () => (await token()).hp).toBe(9);
  await page
    .getByRole("button", { name: "Recolher painel", exact: true })
    .tap();
  await page.getByRole("button", { name: "Lápis", exact: true }).tap();
  // A pinch must cancel the first finger's pending stroke without saving it.
  await touch("touchStart", [a, b]);
  await touch("touchMove", [c, d]);
  await touch("touchEnd", []);
  expect(
    (await api.from("table_drawings").select("id").eq("campaign_id", campaign))
      .data,
  ).toHaveLength(0);
  await drag(await screenPoint(130, 120), await screenPoint(230, 170));
  await expect
    .poll(
      async () =>
        (
          await api
            .from("table_drawings")
            .select("id")
            .eq("campaign_id", campaign)
        ).data?.length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "Abrir rolador", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Fechar rolador", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("mobile-dice.png") });
  await page.getByLabel("Expressão de dados", { exact: true }).fill("2d6+3");
  await page.getByRole("button", { name: "Rolar", exact: true }).tap();
  await expect(page.locator(".roll-history")).toContainText("2d6+3");
  await page.getByRole("button", { name: "Fechar rolador", exact: true }).tap();

  const samples = 16000 * 20,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  const verifyPlayback = !(
    browserName === "webkit" && process.platform === "win32"
  );
  if (!verifyPlayback)
    info.annotations.push({
      type: "verification-limit",
      description:
        "The installed Windows WebKit has no AudioContext and returns NotSupportedError for PCM WAV. Playback is verified in Chromium; physical Safari audio still needs device verification.",
    });
  if (verifyPlayback) {
    await page.getByRole("button", { name: "Ativar áudio", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Áudio ativo", exact: true }),
    ).toBeVisible();
  }
  await page
    .locator(".table-tabs")
    .getByRole("button", { name: "Áudio", exact: true })
    .tap();
  await page
    .getByLabel("Enviar áudio", { exact: true })
    .setInputFiles({
      name: "ambiente-solo.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await expect(page.locator(".audio-library")).toContainText(
    "ambiente-solo.wav",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Música", exact: true }).tap();
  await expect
    .poll(
      async () =>
        (
          await api
            .from("table_music")
            .select("playing")
            .eq("campaign_id", campaign)
            .single()
        ).data?.playing,
    )
    .toBe(true);
  if (verifyPlayback)
    await expect
      .poll(() =>
        page
          .locator("audio[data-table-music]")
          .evaluate(
            (element: HTMLAudioElement) =>
              !element.paused && element.currentTime > 0,
          ),
      )
      .toBe(true);
  await page.getByRole("button", { name: "SFX · mesa", exact: true }).tap();
  if (verifyPlayback)
    await expect(page.locator("audio[data-sfx]")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Parar SFX da mesa", exact: true })
    .tap();
  await expect(page.locator("audio[data-sfx]")).toHaveCount(0);
  await page.getByRole("button", { name: "Pausar", exact: true }).tap();
  await page
    .locator(".table-tabs")
    .getByRole("button", { name: "Cenas", exact: true })
    .tap();
  await page.getByLabel("Nome da nova cena").fill("Encontro preparado");
  await page.getByRole("button", { name: "Criar cena", exact: true }).tap();
  await expect(page.locator(".table-current-scene")).toContainText(
    "Encontro preparado",
  );
  await expect(page.locator(".table-current-scene")).toContainText(
    "Preparação",
  );
  await page
    .getByRole("button", {
      name: "Ativar Encontro preparado para todos",
      exact: true,
    })
    .tap();
  await expect
    .poll(
      async () =>
        (
          await api
            .from("table_scenes")
            .select("id")
            .eq("campaign_id", campaign)
        ).data?.length,
    )
    .toBe(2);
  await page
    .getByRole("button", { name: "Recolher painel", exact: true })
    .tap();
  await expect(page.locator(".drawing-options")).not.toHaveClass(
    /options-open/,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(shell).toHaveAttribute("data-rotated", "false");
  await expect(page.locator("canvas[data-table-canvas]")).toBeVisible();
  await page.screenshot({ path: info.outputPath("mobile-landscape.png") });
  await page.reload();
  await expect(page.locator("canvas[data-table-canvas]")).toBeVisible();
  await expect(page.locator(".table-presence summary")).toContainText(
    "0 jogador",
  );
  expect(
    (
      await api
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaign)
    ).data,
  ).toEqual([{ role: "gm" }]);
  expect(
    (
      await api
        .from("campaign_invites")
        .select("id")
        .eq("campaign_id", campaign)
    ).data,
  ).toHaveLength(0);
  expect((await token()).hp).toBe(9);
  expect(
    (await api.from("table_drawings").select("id").eq("campaign_id", campaign))
      .data,
  ).toHaveLength(1);

  // Create and invite the first player only after the whole solo preparation.
  const registered = !!fixture.player;
  fixture.player ??= {
    username: "mob_player_" + randomUUID().replaceAll("-", "").slice(0, 10),
    password: randomUUID() + "Aa1!",
  };
  const playerApi = await authenticate(fixture.player, !registered);
  save();
  await rpc(api, "invite_player_by_username", {
    p_campaign_id: campaign,
    p_username: fixture.player.username,
  });
  const invites = await rpc(playerApi, "my_invitations", {});
  await rpc(playerApi, "respond_to_invite", {
    p_invite_id: invites.find(
      (i: { campaign_id: string }) => i.campaign_id === campaign,
    ).id,
    p_accept: true,
  });
  const joiningContext = await browser.newContext({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const joining = await joiningContext.newPage();
  joining.on("pageerror", (error) => errors.push(error.message));
  await login(joining, fixture.player);
  await expect(joining.locator(".table-current-scene")).toContainText(
    "Encontro preparado",
  );
  await joining
    .locator(".table-tabs")
    .getByRole("button", { name: "Cenas", exact: true })
    .tap();
  await joining.getByRole("button", { name: /Cena 1/ }).tap();
  await joining
    .locator(".table-tabs")
    .getByRole("button", { name: "Tokens", exact: true })
    .tap();
  await expect(joining.locator(".table-token-list")).toContainText("Guardião");
  await joining.screenshot({
    path: info.outputPath("mobile-jogador-preparado.png"),
  });
  expect(errors).toEqual([]);
  await joiningContext.close();
  await cdp?.detach();
  cdp = null;
  console.log(
    JSON.stringify({
      mobileAcceptance: "passed",
      soloPreparation: true,
      gm: fixture.gm.id,
      player: fixture.player.id,
    }),
  );
  expect(
    (
      await api.functions.invoke("table-assets?campaign_id=" + campaign, {
        method: "DELETE",
      })
    ).error,
  ).toBeNull();
  delete fixture.campaign;
  save();
});
