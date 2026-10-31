import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../storage.js';

const database=process.env.COMMUTEADS_TEST_DATABASE_URL;
test('PostgreSQL retains private team data across ephemeral hosts and rejects concurrent overwrites', {skip:!database}, async()=>{
  const {Client}=await import('pg');
  const admin=new Client({connectionString:database}); await admin.connect();
  const schema='commuteads_test_'+randomUUID().replaceAll('-','');
  const url=new URL(database); url.searchParams.set('options','-c search_path='+schema);
  const processes=[],directories=[];
  let first,second;
  async function launch() {
    const dir=await mkdtemp(join(tmpdir(),'commuteads-db-')); directories.push(dir);
    const child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'production',PUBLIC_URL:'https://team.example.com',SETUP_CODE:'database-test-setup-code-123456789',HOST:'127.0.0.1',PORT:'0',DATA_DIR:dir,DATABASE_URL:url.href,REQUIRE_DATABASE:'true'},stdio:['ignore','pipe','pipe']});
    processes.push(child);
    const base=await new Promise((resolve,reject)=>{
      child.stdout.on('data',chunk=>{const m=String(chunk).match(/port (\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});
      child.once('error',reject);child.once('exit',()=>reject(Error('Database-backed app failed to start.')));
    });
    return {base,child,cookie:''};
  }
  async function post(app,path,data,expected=200,extra={}) {
    const r=await fetch(app.base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://team.example.com',Cookie:app.cookie,...extra},body:JSON.stringify(data)});
    const value=await r.json(); assert.equal(r.status,expected,JSON.stringify(value));
    if(r.headers.get('set-cookie')) app.cookie=r.headers.get('set-cookie').split(';')[0];
    return value;
  }
  async function get(app) { const r=await fetch(app.base+'/api/state',{headers:{Cookie:app.cookie}}); assert.equal(r.status,200);return r.json(); }
  async function stop(app) { const exited=once(app.child,'exit');app.child.kill();await exited; }
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    first=await createStore(tmpdir(),url.href); second=await createStore(tmpdir(),url.href);
    await first.read('storage-test',{}); await second.read('storage-test',{});
    await first.write('storage-test',{kept:true});
    await assert.rejects(second.write('storage-test',{kept:false}),{status:409});
    assert.deepEqual(await second.read('storage-test',{}),{kept:true});
    const a=await launch();
    const credentials={email:'owner@example.com',password:'Database-owner-password'};
    await post(a,'auth/setup',{...credentials,name:'Owner',code:'database-test-setup-code-123456789'});
    await post(a,'generate',{type:'post',topic:'Persist this campaign'});
    const b=await launch(); await post(b,'auth/login',credentials);
    assert.equal((await get(b)).drafts.length,3);
    const added=await post(a,'team/add',{name:'Member',email:'member@example.com',password:'Database-member-password'});
    const member=added.users.find(u=>u.role==='member');
    await post(b,'auth/login',{email:member.email,password:'Database-member-password'});
    await post(a,'team/remove',{id:member.id});
    assert.equal((await fetch(b.base+'/api/state',{headers:{Cookie:b.cookie}})).status,401);
    await post(b,'auth/login',credentials);
    const version=(await get(a)).version;
    await post(a,'generate',{type:'post',topic:'First editor'},200,{'If-Match':String(version)});
    await post(b,'generate',{type:'post',topic:'Stale editor'},409,{'If-Match':String(version)});
    await stop(a); await stop(b);
    for(const dir of directories) await rm(dir,{recursive:true,force:true});
    const restored=await launch(); await post(restored,'auth/login',credentials);
    assert.equal((await get(restored)).drafts.length,6);
    assert.equal((await fetch(restored.base+'/api/auth/status')).status,200);
    const stored=await admin.query(`SELECT value FROM "${schema}".commuteads_documents WHERE key='accounts'`);
    assert.ok(!JSON.stringify(stored.rows).includes(credentials.password));
    await stop(restored);
  } finally {
    for(const child of processes) if(child.exitCode===null && !child.killed) { const exited=once(child,'exit');child.kill();await exited; }
    await first?.close(); await second?.close();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();
    for(const dir of directories) await rm(dir,{recursive:true,force:true});
  }
});
