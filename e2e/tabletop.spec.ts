import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deployedBackend } from "../src/lib/deployment";

// Opt-in: real Auth, PostgreSQL, Storage and Realtime. Never uses an admin key.
test.use({ trace: "off", viewport: { width: 1440, height: 1000 } });
test("mestre e jogador usam a mesma mesa e recuperam o estado salvo", async ({
  browser,
}, info) => {
  test.skip(
    process.env.E2E_TABLE_LIVE !== "1" || info.project.name !== "desktop",
    "Hosted acceptance, desktop only",
  );
  test.setTimeout(240_000);
  const url = deployedBackend.VITE_SUPABASE_URL,
    key = deployedBackend.VITE_SUPABASE_PUBLISHABLE_KEY;
  const fixturePath = ".tmp/table-acceptance.local";
  type Account = { username: string; password: string; id?: string };
  type Fixture = { gm: Account; player: Account; campaign?: string };
  mkdirSync(".tmp", { recursive: true });
  const existing = existsSync(fixturePath);
  const seed = randomUUID().replaceAll("-", "").slice(0, 10);
  const fixture: Fixture = existing
    ? JSON.parse(readFileSync(fixturePath, "utf8"))
    : {
        gm: { username: "mesa_gm_" + seed, password: randomUUID() + "Aa1!" },
        player: {
          username: "mesa_player_" + seed,
          password: randomUUID() + "Aa1!",
        },
      };
  const clients: SupabaseClient[] = [];
  for (const account of [fixture.gm, fixture.player]) {
    const response = await fetch(url + "/functions/v1/account-access", {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: existing ? "login" : "register",
        username: account.username,
        password: account.password,
      }),
    });
    expect(response.ok, "Disposable account authentication").toBe(true);
    const body = await response.json();
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await client.auth.setSession(body.session);
    expect(signed.error).toBeNull();
    account.id = signed.data.user!.id;
    clients.push(client);
  }
  writeFileSync(fixturePath, JSON.stringify(fixture));
  const [gmApi, playerApi] = clients;
  const rpc = async (
    client: SupabaseClient,
    name: string,
    args: Record<string, unknown>,
  ) => {
    const result = await client.rpc(name, args);
    expect(result.error, name).toBeNull();
    return result.data;
  };
  if (fixture.campaign) {
    // Re-run only touches the campaign created by this test, never user campaigns.
    const deleted = await gmApi.functions.invoke(
      "table-assets?campaign_id=" + fixture.campaign,
      { method: "DELETE" },
    );
    expect(deleted.error).toBeNull();
  }
  fixture.campaign = await rpc(gmApi, "create_campaign", {
    p_name: "Teste da mesa",
    p_description: "Campanha temporária de validação",
  });
  writeFileSync(fixturePath, JSON.stringify(fixture));
  const campaign = fixture.campaign!;
  await rpc(gmApi, "invite_player_by_username", {
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
  await rpc(gmApi, "update_member_permissions", {
    p_campaign_id: campaign,
    p_user_id: fixture.player.id,
    p_can_draw: true,
    p_can_move_tokens: true,
  });
  const gmContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const playerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const gm = await gmContext.newPage(),
    player = await playerContext.newPage();
  const errors: string[] = [];
  for (const page of [gm, player])
    page.on("pageerror", (error) => errors.push(error.message));
  let playerDrawings: Array<{ visibility: string }> = [];
  player.on("response", async (response) => {
    if (response.url().includes("/rest/v1/table_drawings?") && response.ok())
      playerDrawings = await response.json();
  });
  const login = async (page: Page, account: Account) => {
    await page.goto("/entrar");
    await page
      .getByRole("textbox", { name: "Usuário", exact: true })
      .fill(account.username);
    await page.getByLabel("Senha", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Campanhas", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await page.goto("/campanhas/" + campaign);
    await page.getByRole("link", { name: "Abrir mesa", exact: true }).click();
    await expect(page.locator("canvas[data-table-canvas]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(".table-sync")).toHaveText("Conectado", {
      timeout: 20_000,
    });
  };
  await login(gm, fixture.gm);
  await login(player, fixture.player);
  await expect(gm.locator(".table-presence summary")).toContainText(
    "1 jogador",
    { timeout: 10_000 },
  );

  // Real image upload from the GM browser; renderer receives a private signed URL.
  const png = await gm.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#69717b";
    ctx.fillRect(0, 0, 1000, 700);
    ctx.fillStyle = "#353d48";
    ctx.fillRect(90, 70, 820, 550);
    ctx.fillStyle = "#a3a8ac";
    ctx.fillRect(110, 90, 780, 510);
    ctx.fillStyle = "#474f59";
    ctx.fillRect(450, 90, 30, 210);
    ctx.fillRect(450, 400, 30, 200);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await gm.getByLabel("Enviar primeiro mapa").setInputFiles({
    name: "mapa-teste.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(gm.getByLabel("Enviar primeiro mapa")).toHaveCount(0, {
    timeout: 20_000,
  });
  await gm
    .locator(".table-tabs")
    .getByRole("button", { name: "Mapa e grid", exact: true })
    .click();
  await gm.getByLabel("Célula (px)", { exact: true }).fill("50");
  await gm.getByLabel("Célula (px)", { exact: true }).press("Enter");
  await expect
    .poll(
      async () =>
        (
          await playerApi
            .from("table_scenes")
            .select("grid_size")
            .eq("campaign_id", campaign)
            .single()
        ).data?.grid_size,
    )
    .toBe(50);
  await gm.getByRole("button", { name: "Tokens", exact: true }).click();
  await gm.getByRole("button", { name: "Criar", exact: true }).click();
  await gm.getByLabel("Nome do token", { exact: true }).fill("Herói");
  await gm.getByLabel("Nome do token", { exact: true }).press("Enter");
  await expect(gm.locator(".table-token-list")).toContainText("Herói");
  await gm
    .getByRole("checkbox", { name: fixture.player.username, exact: true })
    .click();
  const tokenQuery = () =>
    gmApi
      .from("table_tokens")
      .select("*")
      .eq("campaign_id", campaign)
      .eq("name", "Herói")
      .single();
  await expect
    .poll(async () =>
      (await tokenQuery()).data?.owner_ids.includes(fixture.player.id),
    )
    .toBe(true);
  await player.getByRole("button", { name: "Tokens", exact: true }).click();
  await expect(player.locator(".table-token-list")).toContainText("Herói", {
    timeout: 10_000,
  });
  await player
    .locator(".table-token-list")
    .getByRole("button", { name: "Selecionar token Herói", exact: true })
    .click();
  const initialX = (await tokenQuery()).data!.x;
  await player
    .getByLabel("Posição X", { exact: true })
    .fill(String(initialX + 100));
  await player.getByLabel("Posição X", { exact: true }).press("Enter");
  await expect(gm.getByLabel("Posição X", { exact: true })).toHaveValue(
    String(initialX + 100),
    { timeout: 10_000 },
  );
  const hero = (await tokenQuery()).data!;
  const forbidden = await playerApi
    .from("table_tokens")
    .update({ hp: 999 })
    .eq("id", hero.id)
    .select();
  expect(forbidden.error || forbidden.data?.length === 0).toBeTruthy();
  const unauthorized = await rpc(gmApi, "manage_table_scene", {
    p_campaign_id: campaign,
    p_scene_id: null,
    p_action: "create",
    p_name: "Segredo",
    p_request_id: randomUUID(),
  });
  expect(
    (await playerApi.from("table_scenes").select("*").eq("id", unauthorized))
      .data,
  ).toEqual([]);
  const hiddenId = randomUUID();
  const hidden = await gmApi.from("table_tokens").insert({
    id: hiddenId,
    campaign_id: campaign,
    scene_id: hero.scene_id,
    name: "Segredo GM",
    visible: false,
  });
  expect(hidden.error).toBeNull();
  const deniedMove = await playerApi.rpc("move_table_tokens", {
    p_scene_id: hero.scene_id,
    p_moves: [{ id: hiddenId, x: 0, y: 0, version: 1 }],
    p_request_id: randomUUID(),
  });
  expect(deniedMove.error?.message).toContain("PC_FORBIDDEN");
  await expect(player.locator(".table-token-list")).not.toContainText(
    "Segredo GM",
  );

  // Drawing through Pixi canvas input; other browser receives it through Realtime.
  await player.getByRole("button", { name: "Lápis", exact: true }).click();
  const bounds = (await player.locator(".table-canvas").boundingBox())!;
  await player.mouse.move(bounds.x + 160, bounds.y + 200);
  await player.mouse.down();
  await player.mouse.move(bounds.x + 260, bounds.y + 240, { steps: 12 });
  await player.mouse.up();
  await expect.poll(() => playerDrawings.length, { timeout: 10_000 }).toBe(1);
  await gm.getByRole("button", { name: "Lápis", exact: true }).click();
  await gm.getByRole("checkbox", { name: "Privado", exact: true }).check();
  const gb = (await gm.locator(".table-canvas").boundingBox())!;
  await gm.mouse.move(gb.x + 180, gb.y + 320);
  await gm.mouse.down();
  await gm.mouse.move(gb.x + 290, gb.y + 330, { steps: 8 });
  await gm.mouse.up();
  await expect
    .poll(
      async () =>
        (
          await gmApi
            .from("table_drawings")
            .select("id")
            .eq("campaign_id", campaign)
        ).data?.length,
    )
    .toBe(2);
  expect(playerDrawings.every((d) => d.visibility === "shared")).toBe(true);
  expect(
    (
      await playerApi
        .from("table_drawings")
        .select("*")
        .eq("campaign_id", campaign)
    ).data,
  ).toHaveLength(1);

  await player
    .getByLabel("Expressão de dados", { exact: true })
    .fill("2d20kh1+5");
  await player.getByRole("button", { name: "Rolar", exact: true }).click();
  await gm
    .getByRole("button", { name: "Abrir histórico de dados", exact: true })
    .click();
  await expect(gm.locator(".roll-history")).toContainText("2d20kh1+5", {
    timeout: 10_000,
  });
  const rolls = (
    await gmApi.from("table_rolls").select("*").eq("campaign_id", campaign)
  ).data!;
  expect(rolls).toHaveLength(1);
  expect(rolls[0].total).toBe(Math.max(...rolls[0].values) + 5);
  await rpc(playerApi, "roll_table_dice", {
    p_campaign_id: campaign,
    p_expression: "2d20kh1+5",
    p_label: "",
    p_visibility: "shared",
    p_request_id: rolls[0].id,
  });
  expect(
    (
      await playerApi
        .from("table_rolls")
        .select("id")
        .eq("campaign_id", campaign)
    ).data,
  ).toHaveLength(1);
  await gm
    .getByRole("button", { name: "Recolher histórico de dados", exact: true })
    .click();
  await gm.getByRole("button", { name: "Selecionar", exact: true }).click();
  await gm
    .getByRole("button", { name: "Adicionar ao combate", exact: true })
    .click();
  await gm.getByRole("button", { name: "Combate", exact: true }).click();
  await gm.getByRole("button", { name: "Iniciativas", exact: true }).click();
  await expect(
    gm.getByLabel("Iniciativa de Herói", { exact: true }),
  ).not.toHaveValue("");
  await gm.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(gm.locator(".combat-current")).toContainText("Herói");
  await gm.getByRole("button", { name: "Dano", exact: true }).click();
  await expect.poll(async () => (await tokenQuery()).data?.hp).toBe(9);

  // A 20-second, quiet PCM tone exercises real browser decoding and shared timing.
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
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 220) / 16000) * 100),
      44 + i * 2,
    );
  for (const page of [gm, player])
    await page
      .getByRole("button", { name: "Ativar áudio", exact: true })
      .click();
  await gm.getByRole("button", { name: "Áudio", exact: true }).click();
  await gm.getByLabel("Enviar áudio", { exact: true }).setInputFiles({
    name: "som-teste.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await expect(gm.locator(".audio-library")).toContainText("som-teste.wav", {
    timeout: 20_000,
  });
  await gm.getByRole("button", { name: "Música", exact: true }).click();
  for (const page of [gm, player])
    await expect
      .poll(
        () =>
          page
            .locator("audio[data-table-music]")
            .evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0),
        { timeout: 15_000 },
      )
      .toBe(true);
  const a = await gm
    .locator("audio[data-table-music]")
    .evaluate((e: HTMLAudioElement) => e.currentTime);
  const b = await player
    .locator("audio[data-table-music]")
    .evaluate((e: HTMLAudioElement) => e.currentTime);
  expect(Math.abs(a - b)).toBeLessThan(1.5);
  await gm.getByRole("button", { name: "SFX · mesa", exact: true }).click();
  await expect(player.locator("audio[data-sfx]")).toHaveCount(1, {
    timeout: 10_000,
  });
  await gm.getByRole("button", { name: "Local", exact: true }).click();
  expect(
    (await gmApi.from("table_sfx").select("id").eq("campaign_id", campaign))
      .data,
  ).toHaveLength(1);
  await gm
    .getByRole("button", { name: "Parar SFX da mesa", exact: true })
    .click();
  await expect(player.locator("audio[data-sfx]")).toHaveCount(0, {
    timeout: 10_000,
  });
  await gm.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect
    .poll(
      () =>
        player
          .locator("audio[data-table-music]")
          .evaluate((a: HTMLAudioElement) => a.paused),
      { timeout: 10_000 },
    )
    .toBe(true);

  for (const page of [gm, player]) {
    await page.reload();
    await expect(page.locator("canvas[data-table-canvas]")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Tokens", exact: true }).click();
    await page
      .locator(".table-token-list")
      .getByRole("button", { name: "Selecionar token Herói", exact: true })
      .click();
    await expect(page.getByLabel("Posição X", { exact: true })).toHaveValue(
      String(initialX + 100),
    );
    await expect(page.getByLabel("PV atual", { exact: true })).toHaveValue("9");
    await expect(page.locator(".table-error")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Recolher painel", exact: true })
      .click();
  }
  expect(
    (
      await playerApi
        .from("table_scenes")
        .select("map_asset_id,grid_size")
        .eq("id", hero.scene_id)
        .single()
    ).data,
  ).toMatchObject({ grid_size: 50, map_asset_id: expect.any(String) });
  expect(
    (
      await playerApi
        .from("table_drawings")
        .select("id")
        .eq("campaign_id", campaign)
    ).data,
  ).toHaveLength(1);
  await gm.screenshot({ path: info.outputPath("mesa-mestre.png") });
  await player.screenshot({ path: info.outputPath("mesa-jogador.png") });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      acceptance: "passed",
      campaign,
      gm: fixture.gm.id,
      player: fixture.player.id,
    }),
  );
  const removed = await gmApi.functions.invoke(
    "table-assets?campaign_id=" + campaign,
    { method: "DELETE" },
  );
  expect(removed.error).toBeNull();
  delete fixture.campaign;
  writeFileSync(fixturePath, JSON.stringify(fixture));
  await gmContext.close();
  await playerContext.close();
});
