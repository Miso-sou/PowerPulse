const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const handlerRel = './backend/csvUpload'; // used when child process cwd=root
const handlerPath = path.resolve(root, 'backend', 'csvUpload');

function nowIso() {
  return new Date().toISOString();
}
function msFrom(hrtime) {
  return Number(hrtime) / 1e6;
}

async function runColdInProcess() {
  try {
    // clear require cache to simulate module reload
    delete require.cache[require.resolve(handlerPath)];
  } catch (e) {
    // ignore if not cached
  }
  const t0 = process.hrtime.bigint();
  const handler = require(handlerPath);
  const start = process.hrtime.bigint();
  const res = await handler.handler({ source: 'warmer' });
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1e6;
  console.log(JSON.stringify({
    ts: nowIso(),
    phase: 'cold-in-process',
    durationMs: Math.round(totalMs),
    result: res
  }));
}

async function runWarmInProcess() {
  const handler = require(handlerPath);
  const start = process.hrtime.bigint();
  const res = await handler.handler({ source: 'warmer' });
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1e6;
  console.log(JSON.stringify({
    ts: nowIso(),
    phase: 'warm-in-process',
    durationMs: Math.round(totalMs),
    result: res
  }));
}

function runFreshProcessCold() {
  const cmd = `node -e "require('./backend/csvUpload').handler({source:'warmer'}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error('ERR',e)})"`;
  const t0 = process.hrtime.bigint();
  try {
    const out = cp.execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const t1 = process.hrtime.bigint();
    const dur = Number(t1 - t0) / 1e6;
    // child prints the handler JSON; include it raw
    console.log(JSON.stringify({
      ts: nowIso(),
      phase: 'fresh-process-cold',
      durationMs: Math.round(dur),
      childOutput: out.trim()
    }));
  } catch (err) {
    const t1 = process.hrtime.bigint();
    const dur = Number(t1 - t0) / 1e6;
    console.error(JSON.stringify({ ts: nowIso(), phase: 'fresh-process-cold', durationMs: Math.round(dur), error: String(err) }));
  }
}

(async function main() {
  console.log(JSON.stringify({ ts: nowIso(), note: 'csv_warm_demo starting' }));
  await runColdInProcess();
  // small pause
  await new Promise(r => setTimeout(r, 250));
  await runWarmInProcess();
  await new Promise(r => setTimeout(r, 250));
  // run a fresh process to show a separate process cold start
  runFreshProcessCold();
})();
