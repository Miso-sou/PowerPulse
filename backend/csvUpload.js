const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const READINGS_TABLE = process.env.READINGS_TABLE || 'Readings';

// instrumentation: module init timestamp (ms)
const MODULE_INIT_TIME = Date.now();

function makeResponse(status, bodyObj) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(Object.assign({}, bodyObj, { moduleInitTime: MODULE_INIT_TIME }))
    };
}

async function authorizeRequest(event) {
    const authHeader = event.headers?.Authorization;
    if (!authHeader) {
        throw new Error('Unauthorized');
    }
    return true;
}

exports.handler = async (event) => {
    // Warmer short-circuit: accept multiple event shapes
    try {
        const logger = require('./logger');
        const isWarmer = (() => {
            try {
                if (!event) return false;
                if (typeof event === 'string') {
                    const parsed = JSON.parse(event);
                    if (parsed && parsed.source === 'warmer') return true;
                }
                if (event.source === 'warmer') return true;
                // API Gateway shape: event.body may be a JSON string
                if (event.body) {
                    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
                    if (body && body.source === 'warmer') return true;
                }
            } catch (e) {
                // ignore parse errors
            }
            return false;
        })();
        if (isWarmer) {
            logger.info({ msg: 'handler.warmed', function: 'csvUpload' });
            return makeResponse(200, { warmed: true, function: 'csvUpload' });
        }
    } catch (e) {
        // ignore logger errors
    }

    console.log('CSV Upload Event:', event);

    try {
        await authorizeRequest(event);

        const body = JSON.parse(event.body);
        const { userId, readings } = body;

        if (!userId || !Array.isArray(readings) || readings.length === 0) {
            return makeResponse(400, { error: 'userId and readings array are required' });
        }

        const validReadings = readings.filter(r => {
            return r.date && r.usage !== undefined && r.usage >= 0;
        });

        if (validReadings.length === 0) {
            return makeResponse(400, { error: 'No valid readings found' });
        }

        const promises = validReadings.map(reading => {
            return dynamodb.put({
                TableName: READINGS_TABLE,
                Item: {
                    userId,
                    date: reading.date,
                    usage: parseFloat(reading.usage),
                    timestamp: new Date().toISOString()
                }
            }).promise();
        });

        await Promise.all(promises);

        return makeResponse(200, {
            message: `${validReadings.length} readings uploaded successfully`,
            count: validReadings.length
        });
    } catch (error) {
        console.error('Error:', error);
        return makeResponse(error.message === 'Unauthorized' ? 401 : 500, { error: error.message });
    }
};