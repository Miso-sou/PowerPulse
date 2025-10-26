const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const READINGS_TABLE = process.env.READINGS_TABLE || 'Readings';

async function authorizeRequest(event) {
    const authHeader = event.headers?.Authorization;
    if (!authHeader) {
        throw new Error('Unauthorized');
    }
    return true;
}

exports.handler = async (event) => {
    console.log('CSV Upload Event:', event);

    try {
        await authorizeRequest(event);

        const body = JSON.parse(event.body);
        const { userId, readings } = body;

        if (!userId || !Array.isArray(readings) || readings.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'userId and readings array are required' })
            };
        }

        const validReadings = readings.filter(r => {
            return r.date && r.usage !== undefined && r.usage >= 0;
        });

        if (validReadings.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No valid readings found' })
            };
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

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: `${validReadings.length} readings uploaded successfully`,
                count: validReadings.length
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