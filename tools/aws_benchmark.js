// tools/aws_benchmark.js
// Usage: AWS credentials configured; node tools/aws_benchmark.js <functionName> <runs>
// Example: node tools/aws_benchmark.js powerpulse-dev-csvUpload 2

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION || 'ap-south-1' });

function now() { return Date.now(); }

async function invokeOnce(functionName, payload) {
  const start = now();
  const res = await lambda.invoke({
    FunctionName: functionName,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(payload)
  }).promise();
  const elapsed = now() - start;
  let payloadObj = null;
  try {
    payloadObj = JSON.parse(res.Payload);
  } catch (e) {
    payloadObj = res.Payload;
  }
  let moduleInitTime = null;
  try {
    const body = typeof payloadObj.body === 'string' ? JSON.parse(payloadObj.body) : payloadObj.body;
    moduleInitTime = body && body.moduleInitTime ? body.moduleInitTime : null;
  } catch (e) { }
  return { functionName, elapsed, statusCode: payloadObj && payloadObj.statusCode ? payloadObj.statusCode : res.StatusCode, moduleInitTime, payloadObj };
}

async function run(functionName, runs = 2) {
  console.log('Function:', functionName);
  console.log('WARNING: to measure a true cold start, ensure the function has not been invoked for several minutes.');
  for (let i = 0; i < runs; i++) {
    const payload = { source: 'warmer' };
    const r = await invokeOnce(functionName, payload);
    console.log(`Run ${i+1}: elapsed_ms=${r.elapsed}, status=${r.statusCode}, moduleInitTime=${r.moduleInitTime}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Done.');
}

const [,, functionName, runs] = process.argv;
if (!functionName) {
  console.error('Usage: node tools/aws_benchmark.js <functionName> [runs]');
  process.exit(2);
}
run(functionName, runs ? Number(runs) : 2).catch(err => { console.error(err); process.exit(1); });
