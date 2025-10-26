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

        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Reading added successfully',
                data: params.Item
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