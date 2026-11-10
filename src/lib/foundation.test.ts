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
