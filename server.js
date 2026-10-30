import http from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { defaultProfile, createPosts } from './brand.js';
import { createAuth } from './auth.js';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = resolve(process.env.DATA_DIR || resolve(root, '.data'), 'workspace.json');
const production = process.env.NODE_ENV === 'production';
const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
if (production && (!publicUrl || new URL(publicUrl).protocol !== 'https:')) throw Error('Hosted mode requires PUBLIC_URL (or RENDER_EXTERNAL_URL) with HTTPS.');
const auth = await createAuth(dirname(dataFile), production);
let apiQueue = Promise.resolve();
let requestActor = null;
const initial = () => ({ profile: { ...defaultProfile }, leads: [], drafts: [], activity: [] });
let state;
try { state = JSON.parse(await readFile(dataFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; state = initial(); }
// Fill new preference fields without replacing an existing workspace's values.
state.profile = { ...defaultProfile, ...state.profile };
state.version ??= 0;
let writes = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(state, null, 2);
  writes = writes.catch(() => {}).then(async () => {
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile + '.tmp', snapshot, { mode: 0o600 });
    await rename(dataFile + '.tmp', dataFile);
  });
  return writes;
}
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function text(value, name, max = 5000, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(`Enter a valid ${name} (up to ${max} characters).`);
  return value.trim();
}
function link(value) {
  const str = text(value || '', 'LinkedIn URL', 500);
  if (!str) return '';
  let url;
  try { url = new URL(str); } catch { throw fail('Enter a full https://www.linkedin.com/ URL.'); }
  if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname) || url.username || url.password) throw fail('Use a LinkedIn HTTPS URL.');
  return url.href;
}
function website(value) {
  const str = text(value, 'website', 500);
  if (!str) return '';
  let url;
  try { url = new URL(str); } catch { throw fail('Enter a full HTTPS website URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw fail('Use an HTTPS website URL without credentials.');
  return url.href;
}
function record(action, detail) { state.activity.unshift({ id: randomUUID(), action, detail, actor: requestActor?.name || 'Workspace', at: new Date().toISOString() }); state.activity = state.activity.slice(0, 300); }
function draft(type, title, body, extra = {}) { return { id: randomUUID(), type, title, body, status: 'draft', scheduledAt: '', createdAt: new Date().toISOString(), ...extra }; }
function generatePosts(topic) {
  return createPosts(state.profile, topic).map(({ title, body, ...extra }) => draft('post', title, body, extra));
}
async function body(req) {
  let buffer = '';
  for await (const chunk of req) { buffer += chunk; if (Buffer.byteLength(buffer) > 64000) throw fail('Request is too large.', 413); }
  try { const value = JSON.parse(buffer || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; } catch { throw fail('Invalid JSON request.'); }
}
const send = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  let release;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if(production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const previous = apiQueue;
      apiQueue = new Promise(resolve => { release = resolve; });
      await previous;
      const expectedOrigin = publicUrl ? new URL(publicUrl).origin : `http://${req.headers.host}`;
      if (!publicUrl && !/^((127\.0\.0\.1)|(localhost))(:\d+)?$/.test(req.headers.host || '')) throw fail('Unrecognized host.',403);
      if (req.headers.origin && req.headers.origin !== expectedOrigin) throw fail('Cross-origin requests are not allowed.',403);
      if(req.method === 'GET' && url.pathname === '/api/health') return send(res,200,{app:'commuteads',ready:true});
      if(req.method === 'GET' && url.pathname === '/api/auth/status') return send(res,200,auth.status(req));
      requestActor = auth.user(req);
      const authRoute = url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/team/');
      if(!authRoute && !requestActor) throw fail('Please sign in to your workspace.',401);
      if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, state);
      if (req.method !== 'POST') throw fail('Route not found.', 404);
      if (!req.headers['content-type']?.startsWith('application/json')) throw fail('Use application/json.', 415);
      const b = await body(req);
      if(authRoute) return send(res,200,await auth.handle(url.pathname,req,res,b));
      if(req.headers['if-match'] !== undefined && req.headers['if-match'] !== String(state.version)) throw fail('A teammate updated the workspace. Refresh before saving your changes.',409);
      switch (url.pathname) {
        case '/api/profile': {
          const p = { company: text(b.company, 'company', 100, true), city: text(b.city, 'city', 100, true), cabs: text(b.cabs || '', 'fleet details', 200), pricing: text(b.pricing || '', 'packages', 1000), contact: text(b.contact || '', 'contact', 200), page: link(b.page) };
          for (const [key, max] of [['tablets', 100], ['email', 200], ['phone', 100], ['audience', 1000]]) p[key] = text(b[key] ?? state.profile[key], key, max);
          p.website = website(b.website ?? state.profile.website);
          p.languages = b.languages ?? state.profile.languages;
          if (!['en', 'te', 'both'].includes(p.languages)) throw fail('Choose English, Telugu, or both.');
          p.cadenceDays = String(b.cadenceDays ?? state.profile.cadenceDays);
          if (!/^[1-9]\d*$/.test(p.cadenceDays) || Number(p.cadenceDays) > 30) throw fail('Post frequency must be between 1 and 30 days.');
          state.profile = p; record('Settings saved', p.company); break;
        }
        case '/api/leads': {
          const lead = { id: randomUUID(), company: text(b.company, 'company', 100, true), name: text(b.name || '', 'contact name', 100), sector: text(b.sector || '', 'sector', 100), context: text(b.context || '', 'personalization notes', 1000), url: link(b.url), optedOut: false };
          state.leads.push(lead); record('Lead added', lead.company); break;
        }
        case '/api/leads/opt-out': {
          const lead = state.leads.find(l => l.id === b.id); if (!lead) throw fail('Lead not found.', 404);
          lead.optedOut = true;
          state.drafts.filter(d => d.leadId === lead.id && d.status !== 'completed').forEach(d => { d.status = 'rejected'; d.scheduledAt = ''; });
          record('Contact suppressed', lead.company); break;
        }
        case '/api/generate': {
          if (b.type === 'post') state.drafts.unshift(...generatePosts(text(b.topic, 'campaign topic', 300, true)));
          else if (b.type === 'message') {
            const lead = state.leads.find(l => l.id === b.leadId); if (!lead) throw fail('Choose a lead.'); if (lead.optedOut) throw fail('This contact is suppressed.');
            const p = state.profile;
            state.drafts.unshift(draft('message', `Introduction to ${lead.company}`, `Hi ${lead.name || 'there'},\n\n${lead.context ? `I noticed ${lead.context.replace(/[.!?]+$/, '')}. ` : ''}I’m reaching out from ${p.company}. We offer advertising on tablets inside cabs in ${p.city}.\n\nWould this be worth exploring for ${lead.company}’s next local campaign? Happy to share the format and discuss your goals.\n\nIf this isn’t relevant, let me know and I won’t follow up.`, { leadId: lead.id, url: lead.url }));
          } else if (b.type === 'comment') {
            const source = text(b.source, 'post text', 3000, true);
            const insight = text(b.insight, 'your observation about the post', 1000, true);
            state.drafts.unshift(draft('comment', text(b.brand, 'brand', 100, true), `${insight}\n\nHow are you thinking about the role of local, in-person touchpoints in this campaign?`, { source, url: link(b.url) }));
          } else throw fail('Unknown draft type.');
          record('Drafts generated', b.type); break;
        }
        case '/api/drafts/update': {
          const d = state.drafts.find(d => d.id === b.id); if (!d) throw fail('Draft not found.', 404);
          if (d.status === 'completed') throw fail('Completed items are read-only.');
          const editedBody = b.body !== undefined ? text(b.body, 'draft', 5000, true) : undefined;
          if (b.status !== undefined) {
            if (!['draft', 'approved', 'rejected', 'completed'].includes(b.status)) throw fail('Invalid status.');
            if (b.status === 'completed' && (d.status !== 'approved' || editedBody !== undefined)) throw fail('Approve this item first.');
            if (state.leads.find(l => l.id === d.leadId)?.optedOut && b.status !== 'rejected') throw fail('This contact is suppressed.');
          }
          if (editedBody !== undefined) { d.body = editedBody; d.status = 'draft'; d.scheduledAt = ''; }
          if (b.status !== undefined) {
            d.status = b.status;
            if (b.status === 'completed') d.completedAt = new Date().toISOString();
            if (b.status !== 'approved') d.scheduledAt = '';
          }
          record('Draft updated', `${d.title}: ${d.status}`); break;
        }
        case '/api/drafts/schedule': {
          const d = state.drafts.find(d => d.id === b.id);
          if (!d || d.type !== 'post' || d.status !== 'approved') throw fail('Approve a post before planning its date.');
          const time = new Date(b.at); if (!Number.isFinite(time.getTime()) || time <= new Date()) throw fail('Choose a future date and time.');
          d.scheduledAt = time.toISOString(); record('Post date planned', d.title); break;
        }
        default: throw fail('Route not found.', 404);
      }
      state.version++;
      await persist(); return send(res, 200, state);
    }
    if (req.method !== 'GET') throw fail('Method not allowed.', 405);
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    const entry = files[url.pathname]; if (!entry) throw fail('Not found.', 404);
    res.writeHead(200, { 'Content-Type': entry[1] + '; charset=utf-8' }); res.end(await readFile(resolve(root, 'public', entry[0])));
  } catch (error) { if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'Could not save or load data. Check the server log.' }); else res.end(); if (!error.status) console.error(error); } finally { requestActor = null; release?.(); }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`CommuteAds listening on port ${server.address().port}`));
