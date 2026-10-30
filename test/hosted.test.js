import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

test('hosted mode requires setup configuration and uses secure sessions behind HTTPS proxy', async () => {
  const dir=await mkdtemp(join(tmpdir(),'commuteads-hosted-'));
  const env={...process.env,DATA_DIR:dir,PORT:'0',HOST:'127.0.0.1',NODE_ENV:'production',PUBLIC_URL:'https://team.example.com',SETUP_CODE:''};
  const invalid=spawn(process.execPath,['server.js'],{env,stdio:'ignore'});
  assert.notEqual((await once(invalid,'exit'))[0],0);
  env.SETUP_CODE='hosted-test-setup-token-123456789';
  const server=spawn(process.execPath,['server.js'],{env,stdio:['ignore','pipe','pipe']});
  try {
    const base=await new Promise((resolve,reject)=>{
      server.stdout.on('data',chunk=>{const match=String(chunk).match(/port (\d+)/);if(match)resolve('http://127.0.0.1:'+match[1]);});
      server.once('error',reject); server.once('exit',()=>reject(Error('Hosted server stopped')));
    });
    const post=(path,data,origin='https://team.example.com',cookie='')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(data)});
    assert.equal((await post('/api/auth/setup',{code:'wrong',email:'owner@example.com',name:'Owner',password:'hosted-owner-password'})).status,403);
    const response=await post('/api/auth/setup',{code:env.SETUP_CODE,email:'owner@example.com',name:'Owner',password:'hosted-owner-password'});
    assert.equal(response.status,200);
    const cookie=response.headers.get('set-cookie');
    assert.match(cookie,/__Host-commuteads=/); assert.match(cookie,/HttpOnly/); assert.match(cookie,/Secure/); assert.match(cookie,/SameSite=Strict/);
    const session=cookie.split(';')[0];
    assert.equal((await fetch(base+'/api/state',{headers:{Cookie:session}})).status,200);
    assert.equal((await post('/api/generate',{type:'post',topic:'hosted draft'},'https://attacker.example',session)).status,403);
    assert.equal((await post('/api/generate',{type:'post',topic:'hosted draft'},'https://team.example.com',session)).status,200);
    const anonymous=await fetch(base+'/api/state');
    assert.equal(anonymous.status,401); assert.equal(anonymous.headers.get('cache-control'),'no-store');
    assert.ok(anonymous.headers.get('strict-transport-security'));
  } finally {
    const ended=once(server,'exit'); server.kill(); await ended; await rm(dir,{recursive:true,force:true});
  }
});
