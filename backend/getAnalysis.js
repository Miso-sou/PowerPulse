const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const READINGS_TABLE = process.env.READINGS_TABLE || 'Readings';

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
    console.log('Get Analysis Event:', event);

    try {
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