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
    // Warmer short-circuit: direct Lambda invocation from warmer will send { source: 'warmer' }
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
                if (event.body) {
                    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
                    if (body && body.source === 'warmer') return true;
                }
            } catch (e) { }
            return false;
        })();
        if (isWarmer) {
            logger.info({ msg: 'handler.warmed', function: 'addReading' });
            return makeResponse(200, { warmed: true, function: 'addReading' });
        }
    } catch (e) {
        // ignore logger errors
    }

    console.log('Add Reading Event:', event);

    try {
        await authorizeRequest(event);

        const body = JSON.parse(event.body);
        const { userId, date, usage } = body;

        if (!userId || !date || usage === undefined) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        if (usage < 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Usage cannot be negative' })
            };
        }

        const params = {
            TableName: READINGS_TABLE,
            Item: {
                userId,
                date,
                usage: parseFloat(usage),
                timestamp: new Date().toISOString()
            }
        };

        await dynamodb.put(params).promise();

        return makeResponse(201, {
            message: 'Reading added successfully',
            data: params.Item
        });
    } catch (error) {
        console.error('Error:', error);
        return makeResponse(error.message === 'Unauthorized' ? 401 : 500, { error: error.message });
    }
};