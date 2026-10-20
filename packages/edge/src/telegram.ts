import { Possibility, Participation, Appreciation, Pass } from '@springforth/core';
import { PlanNode, canonicalize, effectiveStatus, quorumMet } from '@springforth/coordination';
import type { OverlapRecord } from '@springforth/coordination';
import { get, list, put, ledgerAppend } from './store.js';

// Telegram lane — POST /tg webhook. Commands mirror the possibility-card
// lifecycle: declare → join/bring → flag needs → appreciate after the event.
// Actors are `tg:<username>` (falls back to tg:<id>) — the same identity
// space the ledger, trust graph, and portal use, so Telegram activity is
// indistinguishable from web activity downstream.

export interface TgEnv {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const BASE = 'https://springforth.widespread.workers.dev';

interface TgUser { id: number; username?: string; first_name?: string }
interface TgMessage {
  message_id: number; text?: string; chat: { id: number; type: string };
  from?: TgUser;
}
export interface TgUpdate { update_id: number; message?: TgMessage }

async function api(env: TgEnv, method: string, body: Record<string, unknown>) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export async function sendTelegram(env: TgEnv, chatId: number | string, text: string) {
  await api(env, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
  });
}

const actorOf = (u?: TgUser) => `tg:${u?.username ?? u?.id ?? 'anon'}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cardUrl = (id: string) => `${BASE}/possibilities#${id}`;

async function resolve(env: TgEnv, q: string): Promise<Possibility | undefined> {
  const poss = await list<Possibility>(env.DB, 'possibility');
  const exact = poss.find((p) => p.id === q);
  if (exact) return exact;
  const lower = q.toLowerCase();
  return poss.find((p) => p.id.toLowerCase().startsWith(lower))
      ?? poss.find((p) => p.title.toLowerCase().includes(lower));
}

const HELP = `Springforth — declare possibilities, reach quorum.

/cards — live possibility cards
/new &lt;title&gt; | bring &lt;a, b&gt; | need &lt;c&gt; | quorum &lt;n&gt; | place &lt;where&gt; | by &lt;date&gt;
/join &lt;card&gt; [bring &lt;x&gt;]
/need &lt;card&gt; &lt;text&gt; — flag a new need
/pass &lt;card&gt;
/appreciate &lt;card&gt; @user &lt;note&gt;
/done &lt;card&gt; &lt;summary&gt; — completion report
Deck: ${BASE}/possibilities`;

async function liveCards(env: TgEnv): Promise<string> {
  const [poss, nodes, recs, parts] = await Promise.all([
    list<Possibility>(env.DB, 'possibility'), list<PlanNode>(env.DB, 'plannode'),
    list<OverlapRecord>(env.DB, 'overlap'), list<Participation>(env.DB, 'participation'),
  ]);
  const live = poss.filter((p) => ['active', 'draft', 'quorum'].includes(effectiveStatus(p)))
    .slice(0, 8);
  if (!live.length) return 'No live cards — declare one with /new';
  const now = Date.now();
  return live.map((p) => {
    const n = parts.filter((x) => x.possibilityId === p.id).length;
    const q = quorumMet(p, nodes, recs, n);
    const st = effectiveStatus(p, now);
    return `• <a href="${cardUrl(p.id)}">${esc(p.title)}</a> — ${n}${p.minParticipants ? `/${p.minParticipants}` : ''} in, ${st}${q.met ? ' ✓' : ''}`;
  }).join('\n');
}

// /new Title | bring a, b | need c | quorum 4 | place X | by 2025-12-01
function parseNew(text: string) {
  const segs = text.split('|').map((s) => s.trim()).filter(Boolean);
  const title = segs.shift() ?? '';
  const out: Record<string, unknown> = {
    title, needs: [] as { title: string }[], bringing: [] as { title: string }[],
  };
  for (const s of segs) {
    const m = s.match(/^(bring|need|quorum|place|by)\s+(.+)$/i);
    if (!m) { if (!out.description) out.description = s; continue; }
    const [, k, v] = m as [string, string, string];
    const key = k.toLowerCase();
    if (key === 'bring') out.bringing = v!.split(',').map((t) => ({ title: t.trim() })).filter((t) => t.title);
    else if (key === 'need') out.needs = v!.split(',').map((t) => ({ title: t.trim() })).filter((t) => t.title);
    else if (key === 'quorum') out.minParticipants = parseInt(v!, 10) || undefined;
    else if (key === 'place') out.place = v;
    else if (key === 'by') out.deadline = /^\d{4}-\d{2}-\d{2}$/.test(v!) ? `${v}T23:59:59Z` : v;
  }
  return out;
}

// Mirrors POST /possibilities — composite declaration: needs become need
// nodes, bringing becomes offer nodes, declaration lands on the ledger.
async function declare(env: TgEnv, b: Record<string, unknown>, actor: string, chatId: number): Promise<Possibility> {
  const iso = new Date().toISOString();
  const pid = `poss-${String(b.title).toLowerCase().replace(/\W+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36)}`;
  const p = Possibility.parse({
    id: pid, title: b.title, description: String(b.description ?? ''),
    declarerId: actor, place: b.place, deadline: b.deadline,
    minParticipants: Number(b.minParticipants ?? 0),
    status: 'active', createdAt: iso,
  });
  await put(env.DB, 'possibility', p.id, p);
  const mk = (t: string, i: number, kind: string) =>
    `${pid}-${kind}-${i}-${t.toLowerCase().replace(/\W+/g, '-').slice(0, 24)}`;
  for (const [i, n] of (b.needs as { title: string }[]).entries()) {
    await put(env.DB, 'plannode', mk(n.title, i, 'need'), PlanNode.parse({
      id: mk(n.title, i, 'need'), kind: 'need', label: n.title,
      canonical: canonicalize(n.title), source: `possibility:${pid}`,
      possibilityId: pid, required: true, flaggedBy: actor,
      orgIds: [actor], placeId: p.place,
      tags: ['possibility'], timeframe: { to: p.deadline },
    }));
  }
  for (const [i, o] of (b.bringing as { title: string }[]).entries()) {
    await put(env.DB, 'plannode', mk(o.title, i, 'offer'), PlanNode.parse({
      id: mk(o.title, i, 'offer'), kind: 'offer', label: o.title,
      canonical: canonicalize(o.title), source: `possibility:${pid}`,
      possibilityId: pid, orgIds: [actor], placeId: p.place,
      tags: ['possibility', 'bringing'], timeframe: { from: iso },
    }));
  }
  await ledgerAppend(env.DB, actor, 'possibility.declared',
    { id: pid, needs: (b.needs as unknown[]).length, bringing: (b.bringing as unknown[]).length, via: 'telegram' });
  // Remember the declaring chat so quorum announcements land in the right group.
  await put(env.DB, 'poss-chat', p.id, { possibilityId: p.id, chatId });
  return p;
}

export async function handleTelegramUpdate(env: TgEnv, u: TgUpdate): Promise<void> {
  const msg = u.message;
  if (!msg?.text || !msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  const actor = actorOf(msg.from);
  const [raw, ...rest] = msg.text.trim().split(/\s+/);
  const cmd = raw!.toLowerCase().replace(/@springforth_bot$/, '');
  const arg = rest.join(' ');

  if (cmd === '/start' || cmd === '/help') return sendTelegram(env, chatId, HELP);
  if (cmd === '/cards' || cmd === '/deck') return sendTelegram(env, chatId, await liveCards(env));

  if (cmd === '/new') {
    const b = parseNew(arg);
    if (!b.title) return sendTelegram(env, chatId, 'Usage: /new &lt;title&gt; | bring &lt;x&gt; | need &lt;y&gt; | quorum &lt;n&gt;');
    const p = await declare(env, b, actor, chatId);
    return sendTelegram(env, chatId,
      `Declared: <a href="${cardUrl(p.id)}">${esc(p.title)}</a>\n` +
      `${(b.needs as unknown[]).length} need(s), ${(b.bringing as unknown[]).length} offer(s)` +
      (p.minParticipants ? `, quorum ${p.minParticipants}` : '') +
      ` — /join ${p.id.split('-').slice(1, 3).join('-')} to opt in`);
  }

  if (cmd === '/join' || cmd === '/need' || cmd === '/pass' || cmd === '/appreciate' || cmd === '/done') {
    if (!arg) return sendTelegram(env, chatId, `Usage: ${cmd} &lt;card id or title&gt; …`);
    // Resolve card: try longest prefixes of the arg as the card query.
    let p: Possibility | undefined, tail = '';
    for (const words of arg.split(' ').map((_, i, a) => a.slice(0, a.length - i).join(' '))) {
      p = await resolve(env, words);
      if (p) { tail = arg.slice(words.length).trim(); break; }
    }
    if (!p) return sendTelegram(env, chatId, `No card matching "${esc(arg.split(' ').slice(0, 4).join(' '))}" — /cards to list`);
    const iso = new Date().toISOString();

    if (cmd === '/join') {
      const st = effectiveStatus(p);
      if (st !== 'active' && st !== 'draft') return sendTelegram(env, chatId, `Card is ${st}`);
      const bring = tail.match(/^bring\s+(.+)$/i)?.[1];
      let bringingNodeId: string | undefined;
      if (bring) {
        bringingNodeId = `${p.id}-offer-${actor.toLowerCase().replace(/\W+/g, '-')}-${Date.now().toString(36)}`;
        await put(env.DB, 'plannode', bringingNodeId, PlanNode.parse({
          id: bringingNodeId, kind: 'offer', label: bring,
          canonical: canonicalize(bring), source: `possibility:${p.id}`,
          possibilityId: p.id, orgIds: [actor], placeId: p.place,
          tags: ['possibility', 'bringing'], timeframe: { from: iso },
        }));
      }
      const part = Participation.parse({
        id: `part-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}`,
        possibilityId: p.id, actor, bringingNodeId, at: iso,
      });
      await put(env.DB, 'participation', part.id, part);
      await ledgerAppend(env.DB, actor, 'possibility.joined', { id: p.id, bringingNodeId, via: 'telegram' });
      return sendTelegram(env, chatId,
        `${esc(actor)} joined <a href="${cardUrl(p.id)}">${esc(p.title)}</a>` +
        (bring ? ` bringing “${esc(bring)}”` : ''));
    }

    if (cmd === '/need') {
      const title = tail || arg.split(' ').slice(1).join(' ');
      if (!title) return sendTelegram(env, chatId, 'Usage: /need &lt;card&gt; &lt;what is needed&gt;');
      const nid = `${p.id}-need-${title.toLowerCase().replace(/\W+/g, '-').slice(0, 24)}-${Date.now().toString(36)}`;
      await put(env.DB, 'plannode', nid, PlanNode.parse({
        id: nid, kind: 'need', label: title, canonical: canonicalize(title),
        source: `possibility:${p.id}`, possibilityId: p.id, required: false,
        flaggedBy: actor, orgIds: [actor], placeId: p.place,
        tags: ['possibility', 'flagged'], timeframe: { to: p.deadline },
      }));
      await ledgerAppend(env.DB, actor, 'possibility.need_flagged', { id: p.id, nodeId: nid, via: 'telegram' });
      return sendTelegram(env, chatId, `Need flagged on <a href="${cardUrl(p.id)}">${esc(p.title)}</a>: ${esc(title)}`);
    }

    if (cmd === '/pass') {
      await put(env.DB, 'pass', `pass-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}`,
        Pass.parse({ id: `pass-${p.id}-${actor.toLowerCase().replace(/\W+/g, '-')}`,
          possibilityId: p.id, actor, at: iso }));
      await ledgerAppend(env.DB, actor, 'possibility.passed', { id: p.id, via: 'telegram' });
      return sendTelegram(env, chatId, `Logged — ${esc(p.title)} won't surface for ${esc(actor)} again`);
    }

    if (cmd === '/appreciate') {
      const m = tail.match(/^@?(\w+)\s+(.+)$/s);
      if (!m) return sendTelegram(env, chatId, 'Usage: /appreciate &lt;card&gt; @user &lt;note&gt;');
      const to = `tg:${m[1]}`;
      if (to === actor) return sendTelegram(env, chatId, 'Self-appreciation does not count');
      const ap = Appreciation.parse({
        id: `app-${actor.toLowerCase().replace(/\W+/g, '-')}-${to.toLowerCase()}-${Date.now().toString(36)}`,
        fromActor: actor, toActor: to, possibilityId: p.id,
        note: m[2]!.slice(0, 300), at: iso,
      });
      await put(env.DB, 'appreciation', ap.id, ap);
      await ledgerAppend(env.DB, actor, 'possibility.appreciated', { id: p.id, to, via: 'telegram' });
      return sendTelegram(env, chatId,
        `Appreciation ${esc(actor)} → ${esc(to)} on <a href="${cardUrl(p.id)}">${esc(p.title)}</a> — trust edge strengthened`);
    }

    if (cmd === '/done') {
      const st = effectiveStatus(p);
      if (st !== 'quorum' && st !== 'completed')
        return sendTelegram(env, chatId, `Card is ${st} — only quorum cards report completion`);
      const report = {
        summary: (tail || arg).slice(0, 2000), evidence: '', learnings: '', at: iso,
      };
      await put(env.DB, 'possibility', p.id, { ...p, status: 'completed', report });
      await ledgerAppend(env.DB, actor, 'possibility.completed', { id: p.id, via: 'telegram' });
      return sendTelegram(env, chatId,
        `Completion reported on <a href="${cardUrl(p.id)}">${esc(p.title)}</a> — /appreciate to close the recognition loop`);
    }
  }

  return sendTelegram(env, chatId, 'Unknown command — /help');
}
