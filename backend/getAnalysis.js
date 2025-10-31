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

function getMockTips(avgUsage) {
    const tips = [
        'Switch off devices completely when not in use instead of leaving them in standby mode.',
        'Use LED bulbs instead of incandescent lights to reduce energy consumption by up to 80%.',
        'Run washing machines and dishwashers only with full loads to maximize efficiency.'
    ];
    return tips;
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
            logger.info({ msg: 'handler.warmed', function: 'getAnalysis' });
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ warmed: true, function: 'getAnalysis' })
            };
        }
    } catch (e) {
        // ignore logger errors
    }

    console.log('Get Analysis Event:', event);

    try {
        // check warmer first
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
                logger.info({ msg: 'handler.warmed', function: 'getAnalysis' });
                return makeResponse(200, { warmed: true, function: 'getAnalysis' });
            }
        } catch (e) { }
        await authorizeRequest(event);

        const userId = event.queryStringParameters?.userId;

        if (!userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        const params = {
            TableName: READINGS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        const result = await dynamodb.query(params).promise();
        const readings = result.Items || [];

        if (readings.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    average: 0,
                    max: 0,
                    min: 0,
                    readings: [],
                    tips: getMockTips(0)
                })
            };
        }

        const usages = readings.map(r => r.usage);
        const average = usages.reduce((a, b) => a + b) / usages.length;
        const max = Math.max(...usages);
        const min = Math.min(...usages);

        const tips = getMockTips(average);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                average,
                max,
                min,
                readings: readings.sort((a, b) => new Date(a.date) - new Date(b.date)),
                tips
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: error.message === 'Unauthorized' ? 401 : 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};