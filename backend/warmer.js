/**
 * Predictive Lambda warmer
 * - Invokes the configured target Lambdas sequentially
 * - Emits structured logs and simple metrics via backend/logger.js
 * - Uses SERVICE_PREFIX environment variable to build target function names
 */
'use strict';

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();
const logger = require('./logger');

const TARGETS = ['addReading', 'csvUpload', 'getAnalysis', 'generateInsights'];
const PREFIX = process.env.SERVICE_PREFIX || process.env.AWS_LAMBDA_FUNCTION_NAME || '';

/**
 * Invoke a function and return timing/result
 * @param {string} functionName
 */
async function pingFunction(functionName) {
  const payload = { source: 'warmer' };
  const start = Date.now();
  // If running locally (explicit override or no AWS_LAMBDA_FUNCTION_NAME), call handler modules directly for reliable local timing
  const isLocal = process.env.LOCAL_WARMER === 'true' || !process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SLS_DEBUG === 'true';
  if (isLocal) {
    try {
      // functionName expected to be like `${prefix}-${t}`; extract the last part
      const parts = functionName.split('-');
      const fn = parts[parts.length - 1];
      // map to backend module
      const modulePath = `./${fn}`;
      // require the module and call its handler directly
      // eslint-disable-next-line global-require
      const mod = require(modulePath);
      const res = await mod.handler(payload);
      const durationMs = Date.now() - start;
      let statusCode = res && res.statusCode ? res.statusCode : null;
      const ok = !(statusCode && statusCode >= 400);
      logger.info({ msg: 'warmer.ping', functionName, durationMs, ok, raw: res });
      logger.metric('warmer.ping.duration_ms', durationMs, { functionName });
      return { functionName, ok, durationMs, statusCode };
    } catch (err) {
      const durationMs = Date.now() - start;
      logger.error({ msg: 'warmer.ping.error', functionName, error: err && err.message, durationMs });
      logger.metric('warmer.ping.error', 1, { functionName });
      return { functionName, ok: false, durationMs, error: err && err.message };
    }
  }
  try {
    const res = await lambda.invoke({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload)
    }).promise();
    const durationMs = Date.now() - start;
    let ok = true;
    let statusCode = null;
    try {
      const parsed = JSON.parse(res.Payload);
      statusCode = parsed && parsed.statusCode ? parsed.statusCode : null;
      if (statusCode && statusCode >= 400) ok = false;
    } catch (e) {
      // payload may not be JSON or handler returned non-APIGW shape
    }
    logger.info({ msg: 'warmer.ping', functionName, durationMs, ok, raw: res });
    logger.metric('warmer.ping.duration_ms', durationMs, { functionName });
    return { functionName, ok, durationMs, statusCode };
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error({ msg: 'warmer.ping.error', functionName, error: err && err.message, durationMs });
    logger.metric('warmer.ping.error', 1, { functionName });
    return { functionName, ok: false, durationMs, error: err && err.message };
  }
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  logger.info({ msg: 'warmer.start', scheduleEvent: event && event['detail-type'] ? event['detail-type'] : 'manual' });

  const prefix = PREFIX || '';
  const results = [];
  for (const t of TARGETS) {
    // Serverless default naming convention: {service}-{stage}-{function}
    const functionName = prefix ? `${prefix}-${t}` : t;
    // invoke
    // eslint-disable-next-line no-await-in-loop
    const r = await pingFunction(functionName);
    results.push(r);
  }

  const succeeded = results.filter(r => r.ok).length;
  logger.info({ msg: 'warmer.complete', resultsSummary: { total: results.length, succeeded } });
  return {
    statusCode: 200,
    body: JSON.stringify({ warmed: true, results })
  };
};
