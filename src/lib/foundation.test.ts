// @vitest-environment node
// Real PostgreSQL in WASM: no mocked RLS, tables or stored procedures.
// Supabase-managed auth and Realtime still require live integration verification.
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const gm = '10000000-0000-4000-8000-000000000001'
const player = '10000000-0000-4000-8000-000000000002'
const stranger = '10000000-0000-4000-8000-000000000003'
let db: PGlite
let campaign: string
async function identity(id: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec('set role authenticated')
}
async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await db.query<Record<string, T>>(sql, params)
  return Object.values(result.rows[0])[0]
}
async function attempted(sql: string, params: unknown[] = []) {
  await db.exec('savepoint attempted_write')
  try { return await db.query(sql, params) } finally { await db.exec('rollback to savepoint attempted_write; release savepoint attempted_write') }
}
async function invitePlayer() {
  await identity(gm)
  return scalar<string>('select public.invite_player_by_username($1,$2)', [campaign, 'jogador'])
}
async function joinPlayer() {
  const invitation = await invitePlayer()
  await identity(player)
  await db.query('select public.respond_to_invite($1,true)', [invitation])
  return invitation
}
describe('foundation migration and authorization', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}', confirmation_token text,email_change text,email_change_token_new text,email_change_token_current text,encrypted_password text default 'test-existing-hash');
      create table auth.identities(id uuid primary key,user_id uuid,provider text,identity_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      create schema realtime;
      create table realtime.messages(id bigint,topic text);
      alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
      grant usage on schema storage,realtime to authenticated;
      grant select on storage.objects to authenticated;
      grant select,insert on realtime.messages to authenticated;
      create schema extensions;
      -- PGlite platform adapter: native UUID RNG supplies the first four random bytes.
      create function extensions.gen_random_bytes(n integer) returns bytea language sql volatile as $$ select substring(decode(replace(gen_random_uuid()::text,'-',''),'hex') from 1 for n) $$;
      create publication supabase_realtime;
    `)
    const migrations = new URL('../../supabase/migrations/', import.meta.url)
    for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
      if (file.endsWith('_username_password_accounts.sql')) {
        await db.query("insert into auth.users(id,email,email_confirmed_at) values ($1,'gm@example.com',null),($2,'player@example.com',now()),($3,'stranger@example.com',now())", [gm, player, stranger])
        await db.query("insert into auth.identities(id,user_id,provider,identity_data) values($1,$1,'email','{\"email\":\"gm@example.com\"}')",[gm])
      }
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'))
    }
    await db.query("update public.profiles set username=case id when $1 then 'mestre' when $2 then 'jogador' else 'visitante' end", [gm,player])
  }, 60_000)
  beforeEach(async () => {
    await db.exec('reset role; begin')
    await identity(gm)
    campaign = await scalar<string>("select public.create_campaign('Campanha de teste','Descrição')")
  })
  afterEach(async () => { await db.exec('rollback; reset role') })
  afterAll(async () => { await db?.close() })
  it('opens a persistent scene and enforces token ownership with idempotent movement',async()=>{
    const scene=await scalar<string>('select public.ensure_table($1)',[campaign])
    expect(await scalar('select public.ensure_table($1)',[campaign])).toBe(scene)
    await joinPlayer();await identity(gm)
    const token=await scalar<string>('insert into public.table_tokens(id,campaign_id,scene_id,name,owner_ids) values(gen_random_uuid(),$1,$2,\'Herói\',array[$3::uuid]) returning id',[campaign,scene,player])
    await identity(player)
    const request=await scalar<string>('select gen_random_uuid()'),moves=[{id:token,x:128,y:64,version:1}]
    await db.query('select public.move_table_tokens($1,$2,$3)',[scene,JSON.stringify(moves),request])
    await db.query('select public.move_table_tokens($1,$2,$3)',[scene,JSON.stringify(moves),request])
    expect(await scalar('select version from public.table_tokens where id=$1',[token])).toBe(2)
    expect(await scalar('select x from public.table_tokens where id=$1',[token])).toBe(128)
    expect((await db.query('update public.table_tokens set hp=999 where id=$1 returning id',[token])).rows).toHaveLength(0)
    await identity(gm);await db.query("update public.table_tokens set owner_ids='{}' where id=$1",[token]);await identity(player)
    await expect(attempted('select public.move_table_tokens($1,$2,gen_random_uuid())',[scene,JSON.stringify([{...moves[0],version:3}])])).rejects.toThrow('PC_FORBIDDEN')
  })
  it('never sends private scenes, hidden tokens or private drawings to players',async()=>{
    const scene=await scalar<string>('select public.ensure_table($1)',[campaign]);await joinPlayer();await identity(gm)
    await db.query("insert into public.table_tokens(id,campaign_id,scene_id,name,visible) values(gen_random_uuid(),$1,$2,'Segredo',false)",[campaign,scene])
    await db.query("insert into public.table_drawings(id,campaign_id,scene_id,created_by,visibility,tool,points,text) values(gen_random_uuid(),$1,$2,$3,'gm','text','[[0,0]]','Segredo')",[campaign,scene,gm])
    const request=await scalar<string>('select gen_random_uuid()')
    await db.query("select public.manage_table_scene($1,null,'create','Preparação privada',$2)",[campaign,request])
    await identity(player)
    expect(await scalar('select count(*)::int from public.table_scenes where campaign_id=$1',[campaign])).toBe(1)
    expect(await scalar('select count(*)::int from public.table_tokens where scene_id=$1',[scene])).toBe(0)
    expect(await scalar('select count(*)::int from public.table_drawings where scene_id=$1',[scene])).toBe(0)
    await db.query("insert into public.table_drawings(id,campaign_id,scene_id,created_by,tool,points) values(gen_random_uuid(),$1,$2,$3,'line','[[0,0],[64,64]]')",[campaign,scene,player])
    await expect(attempted("insert into public.table_drawings(id,campaign_id,scene_id,created_by,visibility,tool,points) values(gen_random_uuid(),$1,$2,$3,'gm','line','[[0,0],[64,64]]')",[campaign,scene,player])).rejects.toThrow(/row-level security/)
  })
  it('calculates official dice once on the server and protects private results',async()=>{
    await joinPlayer();const request=await scalar<string>('select gen_random_uuid()')
    await db.query("select public.roll_table_dice($1,'2d20kh1+5','shared','Teste',$2)",[campaign,request])
    await db.query("select public.roll_table_dice($1,'2d20kh1+5','shared','Teste',$2)",[campaign,request])
    const result=await db.query<{values:number[];kept:number[];total:number}>('select "values",kept,total from public.table_rolls where id=$1',[request])
    expect(result.rows[0].values).toHaveLength(2);expect(result.rows[0].kept).toEqual([Math.max(...result.rows[0].values)])
    expect(result.rows[0].total).toBe(Math.max(...result.rows[0].values)+5)
    expect(await scalar('select count(*)::int from public.table_rolls where campaign_id=$1',[campaign])).toBe(1)
    await expect(attempted("select public.roll_table_dice($1,'41d6','shared','',gen_random_uuid())",[campaign])).rejects.toThrow('PC_INVALID_DICE')
    await expect(attempted("select public.roll_table_dice($1,'1d20','gm','',gen_random_uuid())",[campaign])).rejects.toThrow('PC_FORBIDDEN')
    await identity(gm);await db.query("select public.roll_table_dice($1,'1d20','gm','Segredo',gen_random_uuid())",[campaign]);await identity(player)
    expect(await scalar('select count(*)::int from public.table_rolls where campaign_id=$1',[campaign])).toBe(1)
  })
  it('persists combat rounds, HP and shared audio commands with server authorization',async()=>{
    const scene=await scalar<string>('select public.ensure_table($1)',[campaign]);await joinPlayer();await identity(gm)
    const token=await scalar<string>("insert into public.table_tokens(id,campaign_id,scene_id,name,temp_hp) values(gen_random_uuid(),$1,$2,'Herói',3) returning id",[campaign,scene])
    await db.query('insert into public.table_combatants(campaign_id,scene_id,token_id,initiative) values($1,$2,$3,15)',[campaign,scene,token])
    await db.query("select public.table_combat_action($1,'start',1,gen_random_uuid())",[scene])
    const step=await scalar<string>('select gen_random_uuid()')
    await db.query("select public.table_combat_action($1,'step',1,$2)",[scene,step]);await db.query("select public.table_combat_action($1,'step',1,$2)",[scene,step])
    expect(await scalar('select round from public.table_combat where scene_id=$1',[scene])).toBe(2)
    await db.query('select public.adjust_table_hp($1,-5,gen_random_uuid())',[token])
    expect(await scalar('select hp from public.table_tokens where id=$1',[token])).toBe(8)
    expect(await scalar('select temp_hp from public.table_tokens where id=$1',[token])).toBe(0)
    await db.exec('reset role')
    const asset=await scalar<string>("insert into public.table_assets(id,campaign_id,name,kind,path,mime,bytes,created_by) values(gen_random_uuid(),$1,'Som de teste','audio','test/audio.wav','audio/wav',100,$2) returning id",[campaign,gm])
    await identity(player);expect(await scalar('select count(*)::int from public.table_assets where id=$1',[asset])).toBe(0)
    await expect(attempted('select public.set_table_music($1,$2,true,false,0,.5,gen_random_uuid())',[campaign,asset])).rejects.toThrow('PC_FORBIDDEN')
    await identity(gm);await db.query('select public.set_table_music($1,$2,true,false,0,.5,gen_random_uuid())',[campaign,asset]);await identity(player)
    expect(await scalar('select playing from public.table_music where campaign_id=$1',[campaign])).toBe(true)
    expect(await scalar('select count(*)::int from public.table_assets where id=$1',[asset])).toBe(1)
  })
  it('preserves existing credentials until the owner supplies their password', async () => {
    await db.exec('reset role')
    const result=await db.query<{id:string;email:string;encrypted_password:string;confirmed:boolean}>('select id,email,encrypted_password,email_confirmed_at is not null as confirmed from auth.users where id=$1',[gm])
    expect(result.rows[0]).toEqual({id:gm,email:'gm@example.com',encrypted_password:'test-existing-hash',confirmed:false})
    expect(await scalar("select identity_data->>'email' from auth.identities where user_id=$1",[gm])).toBe('gm@example.com')
  })
  it('keeps usernames immutable to clients and rate limits restricted to the server', async () => {
    await expect(attempted("update public.profiles set username='stolen' where id=$1", [gm])).rejects.toThrow(/permission denied/)
    await expect(attempted("select public.claim_auth_attempt('global:access',3,60)")).rejects.toThrow(/permission denied/)
    await expect(attempted("select public.verify_legacy_password($1,'password')",[gm])).rejects.toThrow(/permission denied/)
    await expect(attempted("select public.invite_player($1,'player@example.com')",[campaign])).rejects.toThrow(/permission denied/)
    await expect(attempted("select public.invite_player_by_username($1,'missing-user')",[campaign])).rejects.toThrow('PC_USERNAME_NOT_FOUND')
    await db.exec('reset role; set role service_role')
    expect(await scalar("select public.claim_auth_attempt('test:bucket',1,60)")).toBe(true)
    expect(await scalar("select public.claim_auth_attempt('test:bucket',1,60)")).toBe(false)
  })
  it('creates campaign, master membership, profile and audit atomically', async () => {
    expect(await scalar('select role from public.campaign_members where campaign_id = $1', [campaign])).toBe('gm')
    expect(await scalar('select count(*)::int from public.activity_logs where campaign_id = $1', [campaign])).toBe(1)
    expect(await scalar('select display_name from public.profiles where id = $1', [gm])).toBe('Aventureiro')
  })
  it('denies anonymous table and RPC access', async () => {
    await db.exec('reset role; set role anon')
    await expect(attempted('select * from public.campaigns')).rejects.toThrow(/permission denied/)
    await expect(attempted("select public.create_campaign('Intrusão','')")).rejects.toThrow(/permission denied/)
  })
  it('hides campaign, roster, private profiles and activity from outsiders', async () => {
    await identity(stranger)
    expect(await scalar('select count(*)::int from public.campaigns where id = $1', [campaign])).toBe(0)
    expect(await scalar('select count(*)::int from public.campaign_roster($1)', [campaign])).toBe(0)
    expect(await scalar('select count(*)::int from public.profiles where id = $1', [gm])).toBe(0)
    expect(await scalar('select count(*)::int from public.activity_logs where campaign_id = $1', [campaign])).toBe(0)
    expect((await db.query('update public.campaigns set name = $1 where id = $2 returning id', ['Intrusão', campaign])).rows).toHaveLength(0)
  })
  it('exposes only targeted invitations and checks identity when accepting', async () => {
    const invite = await invitePlayer()
    await identity(stranger)
    expect(await scalar('select count(*)::int from public.my_invitations()')).toBe(0)
    await expect(attempted('select public.respond_to_invite($1,true)', [invite])).rejects.toThrow('PC_FORBIDDEN')
    await identity(player)
    expect(await scalar('select campaign_name from public.my_invitations()')).toBe('Campanha de teste')
    expect(await scalar('select count(*)::int from public.campaigns where id = $1', [campaign])).toBe(0)
  })
  it('accepts once as player and gives access to the shared campaign', async () => {
    const invite = await joinPlayer()
    expect(await scalar('select count(*)::int from public.campaigns where id = $1', [campaign])).toBe(1)
    expect(await scalar('select role from public.campaign_members where campaign_id = $1 and user_id = $2', [campaign, player])).toBe('player')
    await expect(attempted('select public.respond_to_invite($1,true)', [invite])).rejects.toThrow('PC_INVITE_EXPIRED')
  })
  it('prevents player edits, deletions, invites and role escalation', async () => {
    await joinPlayer()
    expect((await db.query('update public.campaigns set name = $1 where id = $2 returning id', ['Intrusão', campaign])).rows).toHaveLength(0)
    expect((await db.query('delete from public.campaigns where id = $1 returning id', [campaign])).rows).toHaveLength(0)
    await expect(attempted("update public.campaign_members set role = 'gm' where campaign_id = $1", [campaign])).rejects.toThrow(/permission denied/)
    await expect(attempted("select public.invite_player_by_username($1,'visitante')", [campaign])).rejects.toThrow('PC_FORBIDDEN')
    await expect(attempted('select public.update_member_permissions($1,$2,false,false)', [campaign, player])).rejects.toThrow('PC_FORBIDDEN')
    await expect(attempted('update public.campaigns set owner_id = $1 where id = $2', [player, campaign])).rejects.toThrow(/permission denied/)
  })
  it('lets the master edit permissions and immediately revokes database access on removal', async () => {
    await joinPlayer(); await identity(gm)
    await db.query('select public.update_member_permissions($1,$2,false,false)', [campaign, player])
    expect(await scalar('select can_draw from public.campaign_members where campaign_id = $1 and user_id = $2', [campaign, player])).toBe(false)
    await db.query('select public.remove_member($1,$2)', [campaign, player])
    await identity(player)
    expect(await scalar('select count(*)::int from public.campaigns where id = $1', [campaign])).toBe(0)
  })
  it('protects the master from removal and campaign ownership from reassignment', async () => {
    await expect(attempted('select public.remove_member($1,$2)', [campaign, gm])).rejects.toThrow('PC_MEMBER_NOT_FOUND')
    await expect(attempted('update public.campaigns set owner_id = $1 where id = $2', [player, campaign])).rejects.toThrow(/permission denied/)
  })
  it('rejects expired invitations and invitations to archived campaigns', async () => {
    const invite = await invitePlayer()
    await db.exec('reset role')
    await db.query("update public.campaign_invites set expires_at = now() - interval '1 hour' where id = $1", [invite])
    await identity(player)
    await expect(attempted('select public.respond_to_invite($1,true)', [invite])).rejects.toThrow('PC_INVITE_EXPIRED')
    await identity(gm)
    await db.query("update public.campaigns set status = 'archived' where id = $1", [campaign])
    await expect(attempted("select public.invite_player_by_username($1,'visitante')", [campaign])).rejects.toThrow('PC_ARCHIVED')
  })
  it('supports invite rejection and revocation without creating membership', async () => {
    const first = await invitePlayer()
    await identity(player); await db.query('select public.respond_to_invite($1,false)', [first])
    expect(await scalar('select count(*)::int from public.campaign_members where campaign_id = $1', [campaign])).toBe(0)
    const second = await invitePlayer()
    await db.query('select public.revoke_invite($1)', [second])
    await identity(player)
    await expect(attempted('select public.respond_to_invite($1,true)', [second])).rejects.toThrow('PC_INVITE_EXPIRED')
  })
  it('updates only own profile and rejects unsafe avatar URLs at the database', async () => {
    await identity(player)
    await db.query("update public.profiles set display_name = 'Nova Pessoa' where id = $1", [player])
    expect(await scalar('select display_name from public.profiles where id = $1', [player])).toBe('Nova Pessoa')
    await expect(attempted("update public.profiles set avatar_url = 'javascript:alert(1)' where id = $1", [player])).rejects.toThrow(/check constraint/)
    expect((await db.query("update public.profiles set display_name = 'Intrusão' where id = $1 returning id", [gm])).rows).toHaveLength(0)
  })
  it('enforces uniqueness, database input limits and cascade cleanup', async () => {
    await invitePlayer()
    await expect(attempted("select public.invite_player_by_username($1,'JOGADOR')", [campaign])).rejects.toThrow(/duplicate key/)
    await expect(attempted("select public.create_campaign('ab','')")).rejects.toThrow(/check constraint/)
    await db.query('delete from public.campaigns where id = $1', [campaign])
    expect(await scalar('select count(*)::int from public.campaign_invites where campaign_id = $1', [campaign])).toBe(0)
    expect(await scalar('select count(*)::int from public.campaign_members where campaign_id = $1', [campaign])).toBe(0)
  })
})
