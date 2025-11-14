const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const axios = require('axios');
const crypto = require('crypto');

// Environment variables
const READINGS_TABLE = process.env.READINGS_TABLE || 'Readings';
const USER_PROFILE_TABLE = process.env.USER_PROFILE_TABLE || 'UserProfile';
const INSIGHTS_TABLE = process.env.INSIGHTS_TABLE || 'Insights';
const INSIGHTS_CACHE_TABLE = process.env.INSIGHTS_CACHE_TABLE || 'InsightsCache';
const RATE_LIMITS_TABLE = process.env.RATE_LIMITS_TABLE || 'RateLimits';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const USE_AI = process.env.USE_AI === 'true';
const AI_MODEL = process.env.AI_MODEL || 'google/gemma-2-9b-it';

// Load appliance profiles
const applianceProfiles = require('./data/applianceProfiles.json');

// instrumentation: module init time for this module
const MODULE_INIT_TIME_GLOBAL = Date.now();

/**
 * Fetch user readings from DynamoDB for the last N days
 */
async function fetchUserReadings(userId, days = 30) {
    const params = {
        TableName: READINGS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId
        },
        ScanIndexForward: false,
        Limit: days
    };

    const result = await dynamodb.query(params).promise();
    return result.Items || [];
}

function computeRequestHash({ readings, userProfile, model, dateBucket }) {
    const payload = {
        readings: readings.slice(-7).map(r => ({ d: r.date, u: r.usage })),
        profile: {
            homeType: userProfile.homeType,
            appliances: userProfile.appliances
        },
        model,
        dateBucket,
        v: 1
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function getCache(userId, requestHash) {
    const res = await dynamodb.get({
        TableName: INSIGHTS_CACHE_TABLE,
        Key: { userId, requestHash }
    }).promise();
    return res.Item || null;
}

async function putCacheReady(userId, requestHash, data, ttlSeconds = 2 * 60) {
    const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
    await dynamodb.put({
        TableName: INSIGHTS_CACHE_TABLE,
        Item: { userId, requestHash, status: 'ready', insights: data, updatedAt: Date.now(), ttl }
    }).promise();
}

async function putCachePending(userId, requestHash, ttlSeconds = 30 * 60) {
    const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
    // Only create if not exists
    await dynamodb.put({
        TableName: INSIGHTS_CACHE_TABLE,
        Item: { userId, requestHash, status: 'pending', updatedAt: Date.now(), ttl },
        ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(requestHash)'
    }).promise().catch(() => { });
}

async function checkAndConsumeRateLimit(userId) {
    const now = Math.floor(Date.now() / 1000);
    const windowSec = 60;
    const capacity = 4; // 4 per minute
    const cooldown = 15; // at least 15s between calls

    const res = await dynamodb.get({ TableName: RATE_LIMITS_TABLE, Key: { userId } }).promise();
    let item = res.Item || { userId, windowStart: now, count: 0, lastTs: 0 };

    // reset window if elapsed
    if (now - item.windowStart >= windowSec) {
        item.windowStart = now;
        item.count = 0;
    }
    if (now - (item.lastTs || 0) < cooldown) {
        const retryAfter = cooldown - (now - (item.lastTs || 0));
        return { allowed: false, retryAfter };
    }
    if (item.count >= capacity) {
        const retryAfter = item.windowStart + windowSec - now;
        return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
    }
    item.count += 1;
    item.lastTs = now;
    await dynamodb.put({ TableName: RATE_LIMITS_TABLE, Item: item }).promise();
    return { allowed: true };
}

/**
 * Fetch user profile from DynamoDB
 */
async function fetchUserProfile(userId) {
    const params = {
        TableName: USER_PROFILE_TABLE,
        Key: { userId }
    };

    const result = await dynamodb.get(params).promise();
    return result.Item || null;
}

/**
 * Fetch weather data from OpenWeather API
 */
async function fetchWeatherData(location) {
    if (!OPENWEATHER_API_KEY) {
        console.warn('OpenWeather API key not configured');
        return null;
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather`;
        const response = await axios.get(url, {
            params: {
                q: location,
                appid: OPENWEATHER_API_KEY,
                units: 'metric'
            }
        });

        return {
            temperature: response.data.main.temp,
            feelsLike: response.data.main.feels_like,
            humidity: response.data.main.humidity,
            description: response.data.weather[0].description,
            location: response.data.name
        };
    } catch (error) {
        console.error('Weather API error:', error.message);
        return null;
    }
}

/**
 * Estimate appliance consumption based on user's appliances and star ratings
 */
function estimateApplianceConsumption(userAppliances) {
    const estimates = {};
    let totalEstimated = 0;

    for (const [applianceName, applianceData] of Object.entries(userAppliances)) {
        const starRating = applianceData.starRating;
        const profile = applianceProfiles.appliances[applianceName];

        if (profile && profile.dailyKwhByStarRating[starRating]) {
            const dailyKwh = profile.dailyKwhByStarRating[starRating];
            estimates[applianceName] = {
                dailyKwh,
                starRating,
                fullName: profile.name,
                category: profile.category
            };
            totalEstimated += dailyKwh;
        }
    }

    return { estimates, totalEstimated };
}

/**
 * Generate rule-based insights from usage data
 */
function generateRuleBasedInsights(readings, applianceEstimates, weather, userProfile) {
    const insights = [];

    if (readings.length < 2) {
        insights.push({
            type: 'info',
            icon: '📊',
            message: 'Start tracking for at least a week to get meaningful insights and comparisons.'
        });
        return insights;
    }

    // Sort readings by date
    const sortedReadings = readings.sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = sortedReadings[sortedReadings.length - 1];
    const previous = sortedReadings[sortedReadings.length - 2];

    // Calculate statistics
    const totalUsage = sortedReadings.reduce((sum, r) => sum + r.usage, 0);
    const avgUsage = totalUsage / sortedReadings.length;
    const maxUsage = Math.max(...sortedReadings.map(r => r.usage));
    const minUsage = Math.min(...sortedReadings.map(r => r.usage));

    // 1. Spike Detection
    if (latest.usage > avgUsage * 1.2) {
        const percentageIncrease = ((latest.usage - avgUsage) / avgUsage * 100).toFixed(0);
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Usage Spike Detected',
            message: `Your latest reading (${latest.usage.toFixed(1)} kWh) is ${percentageIncrease}% higher than your average (${avgUsage.toFixed(1)} kWh).`
        });
    }

    // 2. Day-over-day comparison
    const dayChange = ((latest.usage - previous.usage) / previous.usage * 100);
    if (Math.abs(dayChange) > 10) {
        const direction = dayChange > 0 ? 'increased' : 'decreased';
        const icon = dayChange > 0 ? '📈' : '📉';
        insights.push({
            type: dayChange > 0 ? 'warning' : 'success',
            icon,
            title: `Daily Usage ${direction.charAt(0).toUpperCase() + direction.slice(1)}`,
            message: `Usage ${direction} by ${Math.abs(dayChange).toFixed(1)}% compared to yesterday (${previous.usage.toFixed(1)} → ${latest.usage.toFixed(1)} kWh).`
        });
    }

    // 3. Weather correlation (if available)
    if (weather && weather.temperature) {
        if (weather.temperature > 30) {
            insights.push({
                type: 'info',
                icon: '🌡️',
                title: 'Hot Weather Impact',
                message: `Temperature is ${weather.temperature.toFixed(1)}°C. Cooling appliances likely consuming more energy. Consider setting AC to 25-26°C for optimal efficiency.`
            });
        } else if (weather.temperature < 15) {
            insights.push({
                type: 'info',
                icon: '❄️',
                title: 'Cold Weather Impact',
                message: `Temperature is ${weather.temperature.toFixed(1)}°C. Heating appliances may be consuming more energy. Use geysers efficiently and consider solar heating.`
            });
        }
    }

    // 4. Appliance-specific insights
    if (applianceEstimates && applianceEstimates.totalEstimated > 0) {
        const topAppliance = Object.entries(applianceEstimates.estimates)
            .sort((a, b) => b[1].dailyKwh - a[1].dailyKwh)[0];

        if (topAppliance) {
            const [name, data] = topAppliance;
            const percentage = ((data.dailyKwh / applianceEstimates.totalEstimated) * 100).toFixed(0);
            insights.push({
                type: 'info',
                icon: '🔌',
                title: 'Top Energy Consumer',
                message: `Your ${data.fullName} (${data.starRating}-star) accounts for ~${percentage}% of estimated consumption (~${data.dailyKwh} kWh/day).`
            });

            // Suggest upgrade if low star rating
            if (data.starRating < 4) {
                insights.push({
                    type: 'tip',
                    icon: '💡',
                    title: 'Upgrade Opportunity',
                    message: `Upgrading your ${data.fullName} to a 5-star model could save ~${(data.dailyKwh - applianceProfiles.appliances[name].dailyKwhByStarRating[5]).toFixed(1)} kWh/day (₹${((data.dailyKwh - applianceProfiles.appliances[name].dailyKwhByStarRating[5]) * 6 * 30).toFixed(0)}/month at ₹6/kWh).`
                });
            }
        }
    }

    // 5. Weekly trend (if enough data)
    if (sortedReadings.length >= 7) {
        const lastWeek = sortedReadings.slice(-7);
        const previousWeek = sortedReadings.slice(-14, -7);

        if (previousWeek.length === 7) {
            const lastWeekAvg = lastWeek.reduce((sum, r) => sum + r.usage, 0) / 7;
            const previousWeekAvg = previousWeek.reduce((sum, r) => sum + r.usage, 0) / 7;
            const weeklyChange = ((lastWeekAvg - previousWeekAvg) / previousWeekAvg * 100);

            if (weeklyChange < -5) {
                const savingsRupees = ((previousWeekAvg - lastWeekAvg) * 7 * 6).toFixed(0);
                insights.push({
                    type: 'success',
                    icon: '🌱',
                    title: 'Great Progress!',
                    message: `You saved ${Math.abs(weeklyChange).toFixed(1)}% energy this week compared to last week (~₹${savingsRupees} saved).`
                });
            } else if (weeklyChange > 5) {
                insights.push({
                    type: 'warning',
                    icon: '📊',
                    title: 'Weekly Increase',
                    message: `Energy usage increased by ${weeklyChange.toFixed(1)}% this week. Review your appliance usage patterns.`
                });
            }
        }
    }

    // 6. Cost estimation
    const monthlyCost = (avgUsage * 30 * 6).toFixed(0); // Assuming ₹6/kWh
    insights.push({
        type: 'info',
        icon: '💰',
        title: 'Estimated Monthly Cost',
        message: `Based on your average usage (${avgUsage.toFixed(1)} kWh/day), your estimated monthly bill is ₹${monthlyCost} (at ₹6/kWh).`
    });

    return insights;
}

/**
 * Generate AI-powered insights using Hugging Face Inference API
 */
async function generateAIInsights(readings, userProfile, applianceEstimates, weather) {
    if (!HUGGINGFACE_API_KEY) {
        console.warn('Hugging Face API key not configured, skipping AI insights');
        return null;
    }

    // Use the NEW Hugging Face v1 API endpoint (chat completions style)
    const apiUrl = 'https://router.huggingface.co/v1/chat/completions';

    try {
        // Build the prompt for Hugging Face model
        const prompt = `You are an energy efficiency expert. Analyze this electricity usage data and provide 3-5 specific, actionable insights.

USER PROFILE:
Location: ${userProfile.location}
Home: ${userProfile.homeType}
Appliances: ${Object.entries(userProfile.appliances).map(([name, data]) => `${name} (${data.starRating}★)`).join(', ')}

APPLIANCE CONSUMPTION:
${Object.entries(applianceEstimates.estimates).map(([name, data]) => `${data.fullName}: ${data.dailyKwh} kWh/day`).join('\n')}

RECENT USAGE:
${readings.slice(-7).map(r => `${r.date}: ${r.usage} kWh`).join('\n')}

${weather ? `WEATHER: ${weather.temperature}°C, ${weather.description}, ${weather.humidity}% humidity` : ''}

Provide 3-5 numbered insights focusing on:
- Cost savings (estimate ₹ saved at ₹6/kWh)
- Appliance efficiency tips
- Weather-based recommendations
- Behavioral changes

Keep each insight under 100 words. Be specific with numbers. Format as numbered list.`;

        console.log(`Using Hugging Face v1 API with model: ${AI_MODEL}`);
        console.log(`API URL: ${apiUrl}`);

        const response = await axios.post(
            apiUrl,
            {
                model: AI_MODEL,
                messages: [
                    { role: 'user', content: prompt }
                ],
                max_tokens: 800,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 28000 // 28 second timeout (less than Lambda's 29s)
            }
        );

        // Extract text from response (new v1 API format)
        const aiResponse = response.data?.choices?.[0]?.message?.content || '';

        console.log('Hugging Face API response received:', aiResponse ? aiResponse.substring(0, 100) + '...' : 'empty');

        if (!aiResponse || aiResponse.trim().length === 0) {
            console.warn('Empty response from Hugging Face API');
            return null;
        }

        // Parse AI response into structured insights
        const aiInsights = aiResponse
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map((line, index) => ({
                type: 'ai',
                icon: '🤖',
                title: `AI Insight ${index + 1}`,
                message: line
                    .replace(/^\d+\.\s*/, '')
                    .replace(/^\*\*/, '')
                    .replace(/\*\*$/, '')
                    .replace(/^Insight \d+:\s*/i, '')
                    .trim()
            }))
            .filter(insight => insight.message.length > 20)
            .slice(0, 5); // Limit to 5 insights

        console.log(`Generated ${aiInsights.length} AI insights`);
        return aiInsights.length > 0 ? aiInsights : null;

    } catch (error) {
        console.error('Hugging Face API error:', error.response?.data || error.message);
        console.error('API URL:', apiUrl);
        console.error('Model:', AI_MODEL);
        console.error('Full error:', JSON.stringify(error.response?.data || error.message, null, 2));
        return null;
    }
}

/**
 * Store insights in DynamoDB
 */
async function storeInsights(userId, insights, metadata) {
    const params = {
        TableName: INSIGHTS_TABLE,
        Item: {
            userId,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            insights: insights,
            metadata: metadata,
            ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
        }
    };

    await dynamodb.put(params).promise();
}

/**
 * Fetch latest stored insights for a user (used as fallback on rate limit)
 */
async function fetchLatestInsights(userId, limit = 1) {
    const params = {
        TableName: INSIGHTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId
        },
        ScanIndexForward: false, // newest first (date desc)
        Limit: limit
    };

    const result = await dynamodb.query(params).promise();
    return result.Items || [];
}

/**
 * Main handler
 */
exports.handler = async (event) => {
    // Warm-up short-circuit: if invoked directly by warmer, it will pass { source: 'warmer' }
    // instrumentation: module init timestamp (ms)
    const MODULE_INIT_TIME = MODULE_INIT_TIME_GLOBAL || Date.now();
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
            logger.info({ msg: 'handler.warmed', function: 'generateInsights' });
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ warmed: true, function: 'generateInsights', moduleInitTime: MODULE_INIT_TIME })
            };
        }
    } catch (e) {
        // ignore logger errors
    }

    console.log('Generate Insights Event:', JSON.stringify(event, null, 2));

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    };

    try {
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }

        // Get userId from query params or body
        const userId = event.queryStringParameters?.userId ||
            (event.body ? JSON.parse(event.body).userId : null);

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        console.log(`Generating insights for user: ${userId}`);

        // Step 1: Fetch user profile
        const userProfile = await fetchUserProfile(userId);
        if (!userProfile) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    error: 'User profile not found',
                    message: 'Please create your profile first to get personalized insights. Go to Profile Settings to add your location, home type, and appliances.'
                })
            };
        }

        // Step 2: Fetch user readings
        const readings = await fetchUserReadings(userId, 30);
        if (readings.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    insights: [{
                        type: 'info',
                        icon: '📊',
                        title: 'Get Started',
                        message: 'Start adding your daily electricity readings to get personalized insights and track your energy consumption patterns.'
                    }]
                })
            };
        }

        // Build request hash up-front (used for cache even when rate-limited)
        const dateBucket = new Date().toISOString().slice(0, 10);
        const requestHash = computeRequestHash({ readings, userProfile, model: AI_MODEL, dateBucket });

        // RATE LIMIT guard
        const rate = await checkAndConsumeRateLimit(userId);
        if (!rate.allowed) {
            // Try to serve cached insights for this exact request
            const cachedOnLimit = await getCache(userId, requestHash);
            if (cachedOnLimit && cachedOnLimit.status === 'ready' && Array.isArray(cachedOnLimit.insights)) {
                return {
                    statusCode: 429,
                    headers,
                    body: JSON.stringify({
                        error: 'Too Many Requests',
                        retryAfter: rate.retryAfter,
                        usingCache: true,
                        message: 'Too many requests. Showing previously generated insights.',
                        insights: cachedOnLimit.insights,
                        metadata: { type: 'ai-enhanced', cache: true, rateLimited: true }
                    })
                };
            }
            // Fallback: try most recent stored insights
            const latest = await fetchLatestInsights(userId, 1);
            if (latest.length > 0 && Array.isArray(latest[0].insights)) {
                return {
                    statusCode: 429,
                    headers,
                    body: JSON.stringify({
                        error: 'Too Many Requests',
                        retryAfter: rate.retryAfter,
                        usingCache: true,
                        message: 'Too many requests. Showing your most recent insights.',
                        insights: latest[0].insights,
                        metadata: { type: 'cached-latest', rateLimited: true, fromDate: latest[0].date }
                    })
                };
            }
            // Nothing available; return 429
            return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too Many Requests', retryAfter: rate.retryAfter }) };
        }

        // Request hash & cache check
        const cached = await getCache(userId, requestHash);
        if (cached && cached.status === 'ready') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ insights: cached.insights, metadata: { type: 'ai-enhanced', cache: true } })
            };
        }
        if (!cached) {
            await putCachePending(userId, requestHash);
        }

        // Step 3: Estimate appliance consumption
        const applianceEstimates = estimateApplianceConsumption(userProfile.appliances);
        console.log('Appliance estimates:', applianceEstimates);

        // Step 4: Fetch weather data
        let weather = null;
        if (userProfile.location) {
            weather = await fetchWeatherData(userProfile.location);
            console.log('Weather data:', weather);
        }

        // Step 5: Generate rule-based insights
        const ruleBasedInsights = generateRuleBasedInsights(
            readings,
            applianceEstimates,
            weather,
            userProfile
        );
        console.log(`Generated ${ruleBasedInsights.length} rule-based insights`);

        let allInsights = [...ruleBasedInsights];
        let insightsMetadata = {
            type: 'rule-based',
            readingsCount: readings.length,
            hasWeather: !!weather,
            hasProfile: true
        };

        // Step 6: Generate AI insights (if enabled)
        if (USE_AI && readings.length >= 3) {
            const aiInsights = await generateAIInsights(
                readings,
                userProfile,
                applianceEstimates,
                weather
            );

            if (aiInsights && aiInsights.length > 0) {
                allInsights = [...aiInsights, ...ruleBasedInsights];
                insightsMetadata.type = 'ai-enhanced';
                insightsMetadata.aiInsightsCount = aiInsights.length;
                await putCacheReady(userId, requestHash, allInsights);
                console.log(`Generated ${aiInsights.length} AI insights`);
            }
        }

        // Step 7: Store insights
        await storeInsights(userId, allInsights, insightsMetadata);

        // Step 8: Return insights
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                insights: allInsights,
                metadata: {
                    ...insightsMetadata,
                    generatedAt: new Date().toISOString(),
                    weather: weather,
                    applianceEstimates: applianceEstimates
                }
            })
        };

    } catch (error) {
        console.error('Error generating insights:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate insights',
                message: error.message,
                // Fallback to basic insights
                insights: [{
                    type: 'error',
                    icon: '⚠️',
                    title: 'Error',
                    message: 'Unable to generate insights at this time. Please try again later.'
                }]
            })
        };
    }
};

/**
 * Scheduled handler for daily insights generation
 * Can be triggered by EventBridge schedule
 */
exports.scheduledHandler = async (event) => {
    console.log('Scheduled insights generation:', event);

    // This would typically fetch all active users and generate insights for each
    // For now, just log that it was triggered
    console.log('Scheduled insights generation triggered');

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Scheduled insights generation completed' })
    };
};

