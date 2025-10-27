# 🧠 AI-Powered Energy Insights - Implementation Guide

## Overview

This document describes the new AI-powered energy insights feature added to PowerPulse. This feature provides personalized, contextual energy-saving recommendations by analyzing user consumption patterns, appliance profiles, and weather data.

---

## 🎯 Features Implemented

### 1. **User Profile Management**
- Users can create and manage their energy profile
- Profile includes:
  - **Location** (city/region for weather data)
  - **Home Type** (Apartment, Bungalow, Villa, Studio)
  - **Appliances** with star ratings (1-5 stars)

### 2. **Appliance Consumption Profiles**
- Pre-configured typical consumption data for common appliances
- Star rating-based estimation (5-star = most efficient)
- Categories: Cooling, Heating, Appliances, Entertainment

Supported Appliances:
- Air Conditioner
- Refrigerator
- Washing Machine
- Water Heater/Geyser
- Television
- Microwave Oven
- Ceiling Fan
- Dishwasher
- Iron Box

### 3. **Weather Integration**
- Fetches real-time weather data using OpenWeather API
- Correlates temperature/humidity with energy usage
- Provides context-aware recommendations

### 4. **Dual-Mode Insights Generation**

#### **Rule-Based Insights (Always Active)**
- Spike detection
- Day-over-day comparisons
- Weekly trend analysis
- Weather correlation
- Cost estimation
- Appliance-specific recommendations

#### **AI-Enhanced Insights (Optional)**
- Uses OpenAI GPT-4o-mini
- Generates 3-5 personalized, actionable tips
- Considers all context: usage, appliances, weather, trends
- Natural language recommendations

---

## 🏗️ Architecture

### Backend Components

#### **1. Lambda Functions**

##### `userProfile` (backend/userProfile.js)
- **Endpoints**: `/profile`
- **Methods**: GET, POST, DELETE
- **Functionality**: CRUD operations for user profiles

##### `generateInsights` (backend/generateInsights.js)
- **Endpoints**: `/insights`
- **Methods**: GET, POST
- **Timeout**: 30 seconds (for AI processing)
- **Functionality**: 
  - Fetches user data and profile
  - Estimates appliance consumption
  - Retrieves weather data
  - Generates rule-based insights
  - Optionally calls OpenAI API for AI insights
  - Stores results in DynamoDB

#### **2. DynamoDB Tables**

##### `UserProfile-{stage}`
```
Primary Key: userId (String)
Attributes:
  - userId: String
  - location: String
  - homeType: String
  - appliances: Map { applianceName: { starRating: Number } }
  - createdAt: ISO timestamp
  - updatedAt: ISO timestamp
```

##### `Insights-{stage}`
```
Primary Key: userId (String)
Sort Key: date (String)
Attributes:
  - userId: String
  - date: String (YYYY-MM-DD)
  - timestamp: ISO timestamp
  - insights: List of insight objects
  - metadata: Object { type, readingsCount, hasWeather, etc. }
  - ttl: Number (90 days auto-deletion)
```

#### **3. Data Files**

##### `backend/data/applianceProfiles.json`
Contains typical consumption patterns for all supported appliances by star rating.

### Frontend Components

#### **1. Updated Files**

##### `frontend/dashboard.html`
- Added User Profile section with form
- Added AI Insights display section
- Interactive appliance selection with star ratings

##### `frontend/js/dashboard.js`
New Functions:
- `initializeApplianceCheckboxes()` - Creates appliance selection UI
- `fetchUserProfile()` - Loads user profile
- `displayUserProfile()` - Shows profile in read-only mode
- `saveProfile()` - Saves/updates user profile
- `generateInsights()` - Triggers insight generation
- `displayInsights()` - Renders insights as styled cards

##### `frontend/css/styles.css`
- Added styles for insight cards
- Profile display badges
- Enhanced form controls

---

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file or environment:

```bash
# OpenAI API Key (for AI-enhanced insights)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# OpenWeather API Key (for weather data)
OPENWEATHER_API_KEY=xxxxxxxxxxxxx

# Enable/Disable AI insights (true/false)
USE_AI=true
```

### Serverless Configuration

The `serverless.yml` has been updated with:
- New Lambda functions
- New DynamoDB tables
- Environment variables
- Increased timeout for generateInsights (30s)

---

## 📦 Deployment

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install the new dependency: `axios`

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENWEATHER_API_KEY=your_openweather_api_key_here
USE_AI=true
```

### 3. Deploy to AWS

```bash
serverless deploy --stage dev
```

Or for production:

```bash
serverless deploy --stage prod
```

### 4. Verify Deployment

Check that all resources were created:
- Lambda functions: `userProfile`, `generateInsights`
- DynamoDB tables: `UserProfile-dev`, `Insights-dev`
- API Gateway endpoints: `/profile`, `/insights`

---

## 🎮 Usage Guide

### For End Users

1. **Create Profile**
   - Navigate to the User Profile section
   - Enter your location (e.g., "Mumbai")
   - Select your home type
   - Check all appliances you have
   - Set star ratings for each appliance
   - Click "Save Profile"

2. **Add Usage Data**
   - Continue adding daily readings as before
   - Upload historical data via CSV if available

3. **Generate Insights**
   - Click "Generate Insights" button
   - Wait while the system analyzes your data
   - Review personalized recommendations

### Insight Types

Insights are color-coded:
- 🟦 **Blue (Info)**: General information and statistics
- 🟨 **Yellow (Warning)**: Alerts for increased usage
- 🟢 **Green (Success)**: Positive feedback and savings
- 🔵 **Cyan (AI)**: AI-generated recommendations
- 🔴 **Red (Error)**: Errors or critical issues

---

## 🔌 API Reference

### User Profile Endpoints

#### GET `/profile?userId={userId}`
Retrieve user profile

**Response:**
```json
{
  "userId": "user123",
  "location": "Mumbai",
  "homeType": "Apartment",
  "appliances": {
    "AC": { "starRating": 3 },
    "Fridge": { "starRating": 4 }
  },
  "createdAt": "2025-10-27T10:00:00.000Z",
  "updatedAt": "2025-10-27T10:00:00.000Z"
}
```

#### POST `/profile`
Create or update user profile

**Request Body:**
```json
{
  "userId": "user123",
  "location": "Mumbai",
  "homeType": "Apartment",
  "appliances": {
    "AC": { "starRating": 3 },
    "Fridge": { "starRating": 4 }
  }
}
```

### Insights Endpoints

#### POST `/insights`
Generate insights for a user

**Request Body:**
```json
{
  "userId": "user123"
}
```

**Response:**
```json
{
  "insights": [
    {
      "type": "ai",
      "icon": "🤖",
      "title": "AI Insight 1",
      "message": "Your AC contributed ~45% of today's usage..."
    }
  ],
  "metadata": {
    "type": "ai-enhanced",
    "readingsCount": 15,
    "hasWeather": true,
    "weather": {
      "temperature": 32,
      "humidity": 65,
      "description": "clear sky"
    },
    "applianceEstimates": { ... }
  }
}
```

---

## 💡 How It Works

### Insight Generation Flow

```
1. User clicks "Generate Insights"
   ↓
2. Frontend calls POST /insights
   ↓
3. Lambda fetches user profile
   ↓
4. Lambda fetches last 30 days of readings
   ↓
5. Lambda estimates appliance consumption
   ↓
6. Lambda fetches weather data (OpenWeather API)
   ↓
7. Lambda generates rule-based insights
   ↓
8. [If USE_AI=true] Lambda calls OpenAI API
   ↓
9. Lambda combines all insights
   ↓
10. Lambda stores in Insights table
   ↓
11. Lambda returns insights to frontend
   ↓
12. Frontend displays insights as cards
```

### Rule-Based Insights

The system analyzes:
- **Consumption Spikes**: Usage >20% above average
- **Day-over-Day Changes**: >10% increase/decrease
- **Weekly Trends**: Compare current week vs previous
- **Weather Correlation**: High/low temperature impacts
- **Appliance Efficiency**: Identifies upgrade opportunities
- **Cost Estimation**: Monthly bill predictions

### AI-Enhanced Insights

When enabled, the system:
1. Constructs a context-rich prompt with:
   - Usage data (dates + kWh)
   - User profile (location, home type, appliances)
   - Appliance consumption estimates
   - Weather conditions
2. Sends to OpenAI GPT-4o-mini
3. Receives 3-5 personalized recommendations
4. Parses and displays alongside rule-based insights

---

## 🔒 Security & Privacy

- All API endpoints require Cognito authentication
- User data is isolated by userId
- API keys stored as environment variables (not in code)
- Insights auto-delete after 90 days (TTL)
- Weather API only uses city-level data (no precise location)

---

## 💰 Cost Optimization

### DynamoDB
- Using PAY_PER_REQUEST billing (no idle costs)
- TTL enabled for automatic data cleanup

### Lambda
- Efficient query patterns to minimize execution time
- 30s timeout only for insights generation
- Rule-based mode works without AI (no OpenAI costs)

### External APIs
- **OpenAI**: ~$0.15 per 1M input tokens (GPT-4o-mini)
  - Each insight generation: ~500 tokens
  - Cost: <$0.001 per generation
- **OpenWeather**: Free tier supports 1M calls/month

---

## 🐛 Troubleshooting

### Profile Not Loading
- Check Cognito authentication is valid
- Verify UserProfile table exists in DynamoDB
- Check browser console for errors

### Insights Generation Fails
**Error: "Profile not found"**
- User must create profile first
- Solution: Fill out User Profile section

**Error: "No readings available"**
- User needs to add usage data
- Solution: Add at least 2-3 days of readings

**AI Insights Not Showing**
- Check `USE_AI` environment variable is `true`
- Verify `OPENAI_API_KEY` is set correctly
- Review Lambda logs for OpenAI API errors
- Fallback: Rule-based insights will still work

**Weather Data Missing**
- Verify `OPENWEATHER_API_KEY` is valid
- Check location name is correct (city name)
- Non-critical: System works without weather

### Deployment Issues

**DynamoDB Table Creation Failed**
- Delete existing tables with same name
- Check AWS region is correct

**Lambda Timeout**
- Increase timeout in serverless.yml
- Check for slow API responses (OpenAI/Weather)

---

## 🚀 Future Enhancements

Potential improvements:
1. **Historical Insights**: Store and compare insights over time
2. **Email Reports**: Weekly/monthly insight summaries
3. **Scheduled Generation**: Auto-generate insights daily
4. **Appliance Breakdown Charts**: Visual consumption by appliance
5. **Peer Comparison**: Compare with similar households
6. **Goal Setting**: Track savings targets
7. **Integration with Smart Meters**: Real-time data sync

---

## 📚 Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenWeather API Documentation](https://openweathermap.org/api)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

---

## 🤝 Support

For issues or questions:
1. Check CloudWatch logs for Lambda errors
2. Review DynamoDB tables for data integrity
3. Test API endpoints directly using Postman/curl
4. Check browser console for frontend errors

---

**Built with ❤️ for PowerPulse**
*Empowering users to make smarter energy choices*

