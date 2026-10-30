import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { defaultProfile, createPosts } from '../brand.js';

let processHandle, base, dir, cookie = '';
const nativeFetch = globalThis.fetch;
const fetch = (url, options = {}) => nativeFetch(url, { ...options, headers: { Cookie: cookie, ...options.headers } });
const ownerLogin = {email:'owner@example.com',password:'Owner-test-password-123'};
async function start() {
  processHandle = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '0', DATA_DIR: dir, SETUP_CODE: 'test-setup-code-only-123456789' }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolve, reject) => {
    let output = '';
    processHandle.stdout.on('data', chunk => { output += chunk; const port = output.match(/port (\d+)/); if (port) resolve(`http://127.0.0.1:${port[1]}`); });
    processHandle.once('error', reject);
    processHandle.once('exit', code => reject(Error(`Server exited: ${code}`)));
    processHandle.stderr.on('data', data => { output += data; });
  });
  if(cookie) await post('auth/login',ownerLogin);
}
async function stop() { const exited = once(processHandle, 'exit'); processHandle.kill(); await exited; }
async function post(path, body, expected = 200, headers = {}) {
  const response = await fetch(`${base}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const setCookie=response.headers.get('set-cookie'); if(setCookie) cookie=setCookie.split(';')[0];
  const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
}
before(async () => { dir = await mkdtemp(join(tmpdir(), 'commuteads-')); await start(); await post('auth/setup',{...ownerLogin,name:'Owner',code:'test-setup-code-only-123456789'}); });
after(async () => { await stop(); await rm(dir, { recursive:true, force:true }); });

test('CommuteAds facts, bilingual copy, and every-two-days planning', async () => {
  const s = await (await fetch(`${base}/api/state`)).json();
  assert.equal(s.profile.tablets, '10');
  assert.equal(s.profile.cabs, '');
  assert.equal(s.profile.page, 'https://www.linkedin.com/company/commuteads/');
  const posts = createPosts(s.profile, 'a premium retail campaign');
  assert.deepEqual(posts.map(p => p.planDay), [1,3,5]);
  for (const p of posts) {
    assert.match(p.body, /ENGLISH/); assert.match(p.body, /తెలుగు/);
    assert.match(p.body, /connect@commuteads.com/); assert.match(p.body, /6300081436/);
    assert.match(p.body, /https:\/\/commuteads.com\//);
    assert.doesNotMatch(p.body, /10 cabs|wealthy passengers|guaranteed/i);
    assert.ok(p.body.length <= 5000);
    assert.equal(p.scheduledAt, undefined);
  }
  const english = createPosts({ ...defaultProfile, languages: 'en' }, 'launch');
  assert.doesNotMatch(english[0].body, /తెలుగు/);
  const telugu = createPosts({ ...defaultProfile, languages: 'te', cadenceDays:'3' }, 'launch');
  assert.doesNotMatch(telugu[0].body, /ENGLISH/);
  assert.deepEqual(telugu.map(p => p.planDay), [1,4,7]);
});

test('campaign workflow: edit, approve, plan, complete, persist across restart', async () => {
  let s = await post('generate', { type: 'post', topic:'a store launch' });
  assert.equal(s.drafts.length, 3);
  assert.match(s.drafts[0].body, /Hyderabad/);
  assert.match(s.drafts[0].body, /a store launch/);
  const id = s.drafts[0].id;
  await post('drafts/schedule', { id, at:'2099-01-01T10:00:00+05:30' }, 400);
  await post('drafts/update', { id, status:'completed' }, 400);
  await post('drafts/update', { id, status:'approved' });
  await post('drafts/update', { id, body:'Must not be applied', status:'invalid' }, 400);
  const unchanged = await (await fetch(`${base}/api/state`)).json();
  assert.equal(unchanged.drafts[0].status, 'approved');
  assert.notEqual(unchanged.drafts[0].body, 'Must not be applied');
  s = await post('drafts/schedule', { id, at:'2099-01-01T10:00:00+05:30' });
  assert.equal(s.drafts[0].scheduledAt, '2099-01-01T04:30:00.000Z');
  await post('drafts/schedule', { id, at:'2020-01-01T10:00:00Z' }, 400);
  s = await post('drafts/update', { id, body:'Updated campaign copy' });
  assert.equal(s.drafts[0].status,'draft'); assert.equal(s.drafts[0].scheduledAt,'');
  await post('drafts/update', { id, status:'approved' });
  await post('drafts/update', { id, status:'completed' });
  await post('drafts/update', { id, body:'change' }, 400);
  await stop(); await start();
  const saved = await (await fetch(`${base}/api/state`)).json();
  assert.equal(saved.drafts[0].status,'completed'); assert.equal(saved.drafts[0].body,'Updated campaign copy');
});
test('lead personalization and opt-out enforcement', async () => {
  let s = await post('leads', { company:'Example Retail', name:'Priya', context:'your Hyderabad store launch', url:'https://www.linkedin.com/company/example/' });
  const lead = s.leads.at(-1);
  s = await post('generate', { type:'message', leadId:lead.id });
  const d = s.drafts[0];
  assert.match(d.body,/Hi Priya/); assert.match(d.body,/your Hyderabad store launch/);
  await post('drafts/update',{ id:d.id, status:'approved' });
  s = await post('leads/opt-out', { id:lead.id });
  assert.equal(s.drafts.find(x=>x.id===d.id).status,'rejected');
  await post('generate', { type:'message', leadId:lead.id }, 400);
  await post('drafts/update', { id:d.id, status:'approved' }, 400);
});
test('comment context, validation, and cross-origin protection', async () => {
  const s = await post('generate', { type:'comment', brand:'Example Media', source:'We launched a campaign.', insight:'The location-specific creative is a useful detail.', url:'https://www.linkedin.com/posts/example' });
  assert.match(s.drafts[0].body,/location-specific creative/);
  assert.equal(s.drafts[0].source,'We launched a campaign.');
  await post('generate', { type:'comment', brand:'Example', source:'Post', insight:'' }, 400);
  await post('leads', { company:'Bad URL', url:'javascript:alert(1)' }, 400);
  await post('leads', { company:'Bad host', url:'https://www.linkedin.com.attacker.example/' }, 400);
  await post('leads', { company:'Blocked' }, 403, { Origin:'https://attacker.example' });
  await post('generate', { type:'unknown' }, 400);
});
test('application and static resources are served with security headers', async () => {
  for (const path of ['/', '/app.js', '/style.css']) { const r = await fetch(base+path); assert.equal(r.status,200); assert.ok((await r.text()).length > 100); assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/); }
  assert.equal((await fetch(base+'/server.js')).status,404);
});

test('brand preferences validate, persist, and survive older profile clients', async () => {
  const original = (await (await fetch(`${base}/api/state`)).json()).profile;
  for (const invalid of [{ languages:'unknown' }, { cadenceDays:'0' }, { cadenceDays:'2.5' }, { website:'javascript:alert(1)' }]) {
    await post('profile', { ...original, ...invalid }, 400);
    assert.deepEqual((await (await fetch(`${base}/api/state`)).json()).profile, original);
  }
  await post('profile', { ...original, languages:'te', cadenceDays:'4', email:'updated@example.com' });
  await post('profile', { company:original.company, city:original.city, cabs:'', pricing:original.pricing, contact:'', page:original.page });
  await stop(); await start();
  const saved = (await (await fetch(`${base}/api/state`)).json()).profile;
  assert.equal(saved.languages,'te'); assert.equal(saved.cadenceDays,'4');
  assert.equal(saved.tablets,'10'); assert.equal(saved.email,'updated@example.com');
});


test('private workspace denies anonymous access and enforces owner-only account management', async () => {
  const ownerCookie=cookie;
  for(const route of ['/api/state','/.data/accounts.json','/auth.js']) {
    const r=await fetch(base+route,{headers:{Cookie:''}});
    assert.equal(r.status,route==='/api/state'?401:404);
  }
  await post('generate',{type:'post',topic:'anonymous'},401,{Cookie:''});
  await post('auth/setup',{...ownerLogin,code:'test-setup-code-only-123456789'},409,{Cookie:''});
  await post('auth/login',{email:ownerLogin.email,password:'incorrect'},401,{Cookie:''});
  await post('auth/login',ownerLogin,403,{Cookie:'',Origin:'https://attacker.example'});
  const team=await post('team/add',{name:'Teammate',email:'member@example.com',password:'Initial-member-password'});
  const member=team.users.find(u=>u.email==='member@example.com');
  assert.equal(member.role,'member'); assert.equal(member.hash,undefined);
  await post('auth/login',{email:member.email,password:'Initial-member-password'});
  const originalMemberCookie=cookie;
  assert.match(cookie,/commuteads_session=/);
  await post('team/add',{name:'Bad',email:'bad@example.com',password:'Invalid-grant-password'},403);
  await post('team/list',{},403);
  let s=await post('generate',{type:'post',topic:'Team campaign'});
  assert.equal(s.activity[0].actor,'Teammate');
  await post('auth/password',{currentPassword:'Initial-member-password',password:'Changed-member-password'});
  assert.equal((await fetch(base+'/api/state',{headers:{Cookie:originalMemberCookie}})).status,401);
  const memberCookie=cookie;
  cookie=ownerCookie;
  await post('team/remove',{id:member.id});
  assert.equal((await fetch(base+'/api/state',{headers:{Cookie:memberCookie}})).status,401);
  await post('auth/login',{email:member.email,password:'Changed-member-password'},401,{Cookie:''});
  const current=await (await fetch(base+'/api/state')).json();
  const results=await Promise.all([1,2].map(n=>fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json','If-Match':String(current.version)},body:JSON.stringify({type:'post',topic:'Concurrent '+n})})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  await post('auth/logout',{});
  assert.equal((await fetch(base+'/api/state',{headers:{Cookie:ownerCookie}})).status,401);
  await post('auth/login',ownerLogin);
});
