// Data layer. Two backends with the same interface:
//  - LocalBackend: stores everything in this browser (used when Supabase isn't configured)
//  - SupabaseBackend: shared, synced data for the whole family
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const TABLES = ['profiles', 'recipes', 'plan_items', 'weights'];
const LS_KEY = 'fdp-data-v1';
const LS_CONF = 'fdp-supabase-conf';

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
function safeDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

export function getSupabaseConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, fromFile: true };
  try { const c = JSON.parse(safeGet(LS_CONF) || 'null'); if (c && c.url && c.key) return c; } catch { /* ignore */ }
  return null;
}
export function saveSupabaseConfig(url, key) { safeSet(LS_CONF, JSON.stringify({ url: url.trim(), key: key.trim() })); }
export function clearSupabaseConfig() { safeDel(LS_CONF); }

class LocalBackend {
  constructor() { this.kind = 'local'; this.listeners = []; }
  _read() {
    try { const d = JSON.parse(safeGet(LS_KEY) || 'null'); if (d) return d; } catch { /* ignore */ }
    return { profiles: [], recipes: [], plan_items: [], weights: [] };
  }
  _write(d) { safeSet(LS_KEY, JSON.stringify(d)); }
  async init() { return true; }
  async session() { return { local: true }; }
  async loadAll() { const d = this._read(); TABLES.forEach(t => (d[t] ||= [])); return d; }
  async upsert(table, rows) {
    const d = this._read(); d[table] ||= [];
    for (const row of [].concat(rows)) {
      const i = d[table].findIndex(r => r.id === row.id);
      if (i >= 0) d[table][i] = { ...d[table][i], ...row }; else d[table].push(row);
    }
    this._write(d);
  }
  async remove(table, ids) {
    const d = this._read(); const set = new Set([].concat(ids));
    d[table] = (d[table] || []).filter(r => !set.has(r.id)); this._write(d);
  }
  subscribe(cb) {
    // Keep multiple tabs on this device in step.
    window.addEventListener('storage', e => { if (e.key === LS_KEY) cb(); });
  }
  async replaceAll(data) { this._write(data); }
}

class SupabaseBackend {
  constructor(conf) { this.kind = 'supabase'; this.conf = conf; }
  async init() {
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    this.sb = mod.createClient(this.conf.url, this.conf.key, { auth: { persistSession: true, autoRefreshToken: true } });
    return true;
  }
  async session() { const { data } = await this.sb.auth.getSession(); return data.session; }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async signOut() { await this.sb.auth.signOut(); }
  async loadAll() {
    const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
    const out = {};
    await Promise.all(TABLES.map(async t => {
      let q = this.sb.from(t).select('*');
      if (t === 'plan_items' || t === 'weights') q = q.gte('date', since);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      out[t] = data;
    }));
    return out;
  }
  async upsert(table, rows) {
    const { error } = await this.sb.from(table).upsert([].concat(rows));
    if (error) throw error;
  }
  async remove(table, ids) {
    const { error } = await this.sb.from(table).delete().in('id', [].concat(ids));
    if (error) throw error;
  }
  subscribe(cb) {
    let timer;
    const debounced = () => { clearTimeout(timer); timer = setTimeout(cb, 400); };
    const ch = this.sb.channel('family-diet');
    TABLES.forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, debounced));
    ch.subscribe();
  }
  async replaceAll(data) {
    for (const t of TABLES) if (data[t]?.length) await this.upsert(t, data[t]);
  }
}

export function makeBackend() {
  const conf = getSupabaseConfig();
  return conf ? new SupabaseBackend(conf) : new LocalBackend();
}
