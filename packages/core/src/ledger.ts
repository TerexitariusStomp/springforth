import { createHash } from 'node:crypto';

// FR-9/NFR-10 — hash-chained audit ledger. Every state change is an event;
// each event commits to its predecessor. Tampering anywhere breaks the
// chain verifiably. Append-only by construction.

export interface LedgerEvent<T = unknown> {
  seq: number;
  at: string; // ISO datetime
  actor: string;
  kind: string; // e.g. 'possibility.declared', 'overlap.confirmed'
  payload: T;
  prevHash: string;
  hash: string;
}

const digest = (s: string) => createHash('sha256').update(s).digest('hex');

const eventHash = (e: Omit<LedgerEvent, 'hash'>) =>
  digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prevHash]));

export class AuditLedger {
  private events: LedgerEvent[] = [];

  append<T>(actor: string, kind: string, payload: T, at = new Date().toISOString()): LedgerEvent<T> {
    const prevHash = this.events.length ? this.events[this.events.length - 1]!.hash : '0'.repeat(64);
    const base = { seq: this.events.length, at, actor, kind, payload, prevHash };
    const ev: LedgerEvent<T> = { ...base, hash: eventHash(base) };
    this.events.push(ev);
    return ev;
  }

  verify(): { ok: boolean; brokenAt?: number } {
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i]!;
      const prev = i === 0 ? '0'.repeat(64) : this.events[i - 1]!.hash;
      if (e.prevHash !== prev || e.hash !== eventHash(e)) return { ok: false, brokenAt: i };
    }
    return { ok: true };
  }

  get length() { return this.events.length; }
  get head() { return this.events[this.events.length - 1]?.hash ?? '0'.repeat(64); }
  toJSON() { return structuredClone(this.events); }
  // Load a previously exported chain (e.g. from storage) for verification.
  static fromJSON(events: LedgerEvent[]): AuditLedger {
    const l = new AuditLedger();
    l.events = structuredClone(events);
    return l;
  }
}
