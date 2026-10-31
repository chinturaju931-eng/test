import { randomBytes, randomUUID, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
const scrypt = promisify(rawScrypt);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const digest = value => createHash('sha256').update(value).digest('hex');
const safe = u => ({ id:u.id, name:u.name, email:u.email, role:u.role });
const email = value => {
  if (typeof value !== 'string' || value.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw fail('Enter a valid email address.');
  return value.toLowerCase().trim();
};
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 200) throw fail('Use a password between 12 and 200 characters.');
  return value;
}
async function hash(value, salt = randomBytes(16).toString('hex')) {
  return { salt, hash:(await scrypt(value, salt, 64)).toString('hex') };
}
async function matches(value, user) {
  const computed = await hash(typeof value === 'string' && value.length <= 200 ? value : '', user?.salt || 'dummy-authentication-salt');
  return timingSafeEqual(Buffer.from(computed.hash,'hex'), Buffer.from(user?.hash || '0'.repeat(128),'hex'));
}
export async function createAuth(dir, production, store) {
  await mkdir(dir, { recursive:true });
  let users = await store.read('accounts',[]);
  let setupCode = process.env.SETUP_CODE || '';
  const setupFile = join(dir,'setup-code.txt');
  if (!users.length) {
    if (production && setupCode.length < 24) throw Error('Set SETUP_CODE to a random value of at least 24 characters before starting the hosted app.');
    if (!setupCode) {
      try { setupCode = (await readFile(setupFile,'utf8')).trim(); }
      catch(e) { if(e.code !== 'ENOENT') throw e; setupCode = randomBytes(32).toString('hex'); await writeFile(setupFile, setupCode, { mode:0o600 }); }
    }
  }
  const sessions = new Map(), attempts = new Map();
  const cookieName = production ? '__Host-commuteads' : 'commuteads_session';
  const cookie = token => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? 43200 : 0}${production ? '; Secure' : ''}`;
  function sessionKey(req) { return digest((req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1) || ''); }
  function current(req) {
    const key = sessionKey(req), session = sessions.get(key);
    if (!session || session.expires < Date.now()) { sessions.delete(key); return null; }
    return users.find(u=>u.id === session.id && u.hash === session.authHash) || null;
  }
  function issue(res,user) {
    for (const [key,s] of sessions) if(s.expires < Date.now()) sessions.delete(key);
    if(sessions.size > 1000) sessions.delete(sessions.keys().next().value);
    const token=randomBytes(32).toString('hex');
    sessions.set(digest(token),{ id:user.id, authHash:user.hash, expires:Date.now()+43200000 });
    res.setHeader('Set-Cookie',cookie(token));
  }
  async function save(next) {
    await store.write('accounts',next); users=next;
  }
  function limit(req,b) {
    const now=Date.now();
    for (const [k,v] of attempts) if(v.until < now) attempts.delete(k);
    const keys=['ip:'+req.socket.remoteAddress,'email:'+String(b.email || '').toLowerCase()];
    for (const key of keys) {
      const value=attempts.get(key) || {count:0,until:now+900000};
      if(value.count >= (key.startsWith('ip:') ? 100 : 15)) throw fail('Too many sign-in attempts. Try again in 15 minutes.',429);
      value.count++; attempts.set(key,value);
    }
  }
  async function newUser(b,role) {
    const normalized=email(b.email);
    if(users.some(u=>u.email===normalized)) throw fail('This email already has an account.');
    if(typeof b.name !== 'string' || !b.name.trim() || b.name.length>100) throw fail('Enter your name.');
    return {id:randomUUID(),name:b.name.trim(),email:normalized,role,...await hash(password(b.password))};
  }
  return {
    async refresh() { if(store.remote) users=await store.read('accounts',[]); },
    user:req=>{const u=current(req);return u?safe(u):null;},
    status:req=>({ user:current(req)?safe(current(req)):null, setupRequired:users.length===0 }),
    async handle(path, req, res, b) {
      const actor=current(req);
      if(path==='/api/auth/setup') {
        if(users.length) throw fail('Workspace setup is already complete.',409);
        if(setupCode.length < 24) throw fail('Setup is unavailable. Restart with a valid setup code.',503);
        limit(req,b);
        if(typeof b.code !== 'string' || !timingSafeEqual(Buffer.from(digest(b.code)),Buffer.from(digest(setupCode)))) throw fail('The setup code is incorrect.',403);
        const owner=await newUser(b,'owner'); await save([owner]); setupCode='';
        await unlink(setupFile).catch(e=>{if(e.code!=='ENOENT') console.warn('Could not remove the consumed local setup code.');});
        issue(res,owner); return {user:safe(owner)};
      }
      if(path==='/api/auth/login') {
        limit(req,b);
        const user=users.find(u=>u.email===String(b.email || '').trim().toLowerCase());
        if(!await matches(b.password,user) || !user) throw fail('Email or password is incorrect.',401);
        issue(res,user); return {user:safe(user)};
      }
      if(path==='/api/auth/logout') { sessions.delete(sessionKey(req)); res.setHeader('Set-Cookie',cookie('')); return {ok:true}; }
      if(!actor) throw fail('Please sign in.',401);
      if(path==='/api/auth/password') {
        if(!await matches(b.currentPassword,actor)) throw fail('Your current password is incorrect.',403);
        const updated={...actor,...await hash(password(b.password))};
        await save(users.map(u=>u.id===actor.id?updated:u));
        for(const [key,s] of sessions) if(s.id===actor.id) sessions.delete(key);
        issue(res,updated); return {ok:true};
      }
      if(actor.role!=='owner') throw fail('Only the workspace owner can manage team access.',403);
      if(path==='/api/team/list') return {users:users.map(safe)};
      if(path==='/api/team/add') {
        if(users.length>=50) throw fail('This workspace supports up to 50 accounts.');
        const member=await newUser(b,'member'); await save([...users,member]); return {users:users.map(safe)};
      }
      if(path==='/api/team/remove') {
        const target=users.find(u=>u.id===b.id);
        if(!target || target.role==='owner') throw fail('The owner account cannot be removed.');
        await save(users.filter(u=>u.id!==b.id));
        for(const [key,s] of sessions) if(s.id===b.id) sessions.delete(key);
        return {users:users.map(safe)};
      }
      throw fail('Route not found.',404);
    }
  };
}
