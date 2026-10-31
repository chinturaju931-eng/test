import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

export async function createStore(dir, connection = process.env.DATABASE_URL) {
  if (!connection) {
    if (process.env.REQUIRE_DATABASE === 'true') throw Error('DATABASE_URL is required. Free hosting must not save team data on an ephemeral filesystem.');
    await mkdir(dir,{recursive:true});
    return {
      remote:false,
      async read(key,fallback) { try { return JSON.parse(await readFile(join(dir,key+'.json'),'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; return structuredClone(fallback); } },
      async write(key,value) { const file=join(dir,key+'.json'); await writeFile(file+'.tmp',JSON.stringify(value,null,2),{mode:0o600}); await rename(file+'.tmp',file); },
      async close() {}
    };
  }
  let url;
  try { url=new URL(connection); if(!['postgres:','postgresql:'].includes(url.protocol)) throw Error(); }
  catch { throw Error('DATABASE_URL must be a PostgreSQL connection URL.'); }
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  // Explicit TLS configuration prevents connection-string options from disabling verification.
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
  const { Pool }=await import('pg');
  const client=new Pool({max:2,idleTimeoutMillis:10000,connectionString:url.href,ssl:local?false:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:15000});
  client.on('error',()=>{ console.error('An idle database connection closed; the next request will reconnect.'); });
  try {
    await client.query('CREATE TABLE IF NOT EXISTS commuteads_documents (key text PRIMARY KEY, value jsonb NOT NULL, revision bigint NOT NULL DEFAULT 1)');
  } catch { await client.end().catch(()=>{}); throw Error('Could not initialize the database. Check DATABASE_URL, access, and TLS configuration in hosting settings.'); }
  const versions=new Map();
  return {
    remote:true,
    async health() { try { await client.query('SELECT 1'); return true; } catch { return false; } },
    async read(key,fallback) {
      const result=await client.query('SELECT value, revision FROM commuteads_documents WHERE key=$1',[key]);
      versions.set(key,result.rows[0]?.revision || '0');
      return result.rows[0]?.value ?? structuredClone(fallback);
    },
    async write(key,value) {
      const revision=versions.get(key);
      if(revision===undefined) throw Error('Read the document before updating it.');
      const result=revision==='0'
        ? await client.query('INSERT INTO commuteads_documents (key,value) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING RETURNING revision',[key,JSON.stringify(value)])
        : await client.query('UPDATE commuteads_documents SET value=$2::jsonb, revision=revision+1 WHERE key=$1 AND revision=$3 RETURNING revision',[key,JSON.stringify(value),revision]);
      if(!result.rowCount) throw Object.assign(Error('A teammate updated the workspace. Refresh before saving your changes.'),{status:409});
      versions.set(key,result.rows[0].revision);
    },
    async close() { await client.end(); }
  };
}
