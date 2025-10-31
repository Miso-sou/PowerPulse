// tools/local_benchmark.js
// Usage: node tools/local_benchmark.js <handlerPath> <iterations>
// Example: node tools/local_benchmark.js backend/csvUpload 3

const path = require('path');

async function run(handlerPath, iterations = 3) {
  const abs = path.resolve(handlerPath);
  console.log('Handler module:', abs);
  for (let i = 0; i < iterations; i++) {
    // simulate cold load by deleting require cache for the module
    delete require.cache[require.resolve(abs)];
    const tStart = Date.now();
    const mod = require(abs);
    const handler = mod.handler;
    // measure handler invocation (pass warm payload for warmed short-circuit)
    const payload = { source: 'warmer' };
    let resp;
    try {
      resp = await handler(payload);
    } catch (e) {
      resp = { error: String(e) };
    }
    const tEnd = Date.now();
    let moduleInitTime = null;
    try {
      const parsed = resp && resp.body ? (typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body) : null;
      moduleInitTime = parsed && parsed.moduleInitTime ? parsed.moduleInitTime : null;
    } catch (e) { /* ignore */ }
    console.log(`Run #${i + 1}: total_ms=${tEnd - tStart}, moduleInitTime=${moduleInitTime}, response=${JSON.stringify(resp)}`);
  }

  // Now run a few warm (no require cache clear)
  console.log('\nNow running warm (no require cache clear):');
  const mod2 = require(abs);
  for (let i = 0; i < 3; i++) {
    const tStart = Date.now();
    let resp;
    try {
      resp = await mod2.handler({ source: 'warmer' });
    } catch (e) {
      resp = { error: String(e) };
    }
    const tEnd = Date.now();
    let moduleInitTime = null;
    try {
      const parsed = resp && resp.body ? (typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body) : null;
      moduleInitTime = parsed && parsed.moduleInitTime ? parsed.moduleInitTime : null;
    } catch (e) { }
    console.log(`Warm run #${i + 1}: total_ms=${tEnd - tStart}, moduleInitTime=${moduleInitTime}, response=${JSON.stringify(resp)}`);
  }
}

const [,, handlerPath, iterations] = process.argv;
if (!handlerPath) {
  console.error('Usage: node tools/local_benchmark.js <handlerPath> [iterations]');
  process.exit(2);
}
run(handlerPath, iterations ? Number(iterations) : 3).catch(err => { console.error(err); process.exit(1); });
