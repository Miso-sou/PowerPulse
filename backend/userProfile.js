const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USER_PROFILE_TABLE = process.env.USER_PROFILE_TABLE || 'UserProfile';

/**
 * Handler for User Profile operations
 * Supports: GET, POST (create/update), DELETE
 */
exports.handler = async (event) => {
    console.log('User Profile Event:', JSON.stringify(event, null, 2));

    const httpMethod = event.httpMethod;
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };

    try {
        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }

        const userId = event.queryStringParameters?.userId || 
                      (event.body ? JSON.parse(event.body).userId : null);

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        // GET - Retrieve user profile
        if (httpMethod === 'GET') {
            const params = {
                TableName: USER_PROFILE_TABLE,
                Key: { userId }
            };

            const result = await dynamodb.get(params).promise();

            if (!result.Item) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Profile not found',
                        message: 'Please create a profile first to get personalized insights'
                    })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result.Item)
            };
        }

        // POST - Create or update user profile
        if (httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { location, homeType, appliances } = body;

            if (!location || !homeType || !appliances) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Missing required fields',
                        required: ['userId', 'location', 'homeType', 'appliances']
                    })
                };
            }

            // Validate appliances format
            if (typeof appliances !== 'object') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Invalid appliances format',
                        expected: '{ "AC": { "starRating": 3 }, ... }'
                    })
                };
            }

            const profileData = {
                userId,
                location,
                homeType,
                appliances,
                updatedAt: new Date().toISOString(),
                createdAt: body.createdAt || new Date().toISOString()
            };

            const params = {
                TableName: USER_PROFILE_TABLE,
                Item: profileData
            };

            await dynamodb.put(params).promise();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Profile saved successfully',
                    profile: profileData
                })
            };
        }

        // DELETE - Remove user profile
        if (httpMethod === 'DELETE') {
            const params = {
                TableName: USER_PROFILE_TABLE,
                Key: { userId }
            };

            await dynamodb.delete(params).promise();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Profile deleted successfully' })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};

