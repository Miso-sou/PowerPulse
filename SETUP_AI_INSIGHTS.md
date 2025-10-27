# 🚀 Quick Setup Guide - AI Insights Feature

## Prerequisites

Before you begin, ensure you have:
- AWS account with appropriate permissions
- Serverless Framework installed (`npm install -g serverless`)
- Node.js 20.x or later
- AWS CLI configured

## Step-by-Step Setup

### 1. Get API Keys

#### OpenAI API Key (Optional - for AI insights)
1. Visit https://platform.openai.com/api-keys
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `sk-proj-...`)

#### OpenWeather API Key (Optional - for weather data)
1. Visit https://openweathermap.org/api
2. Sign up for a free account
3. Generate an API key
4. Copy the key

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENWEATHER_API_KEY=xxxxxxxxxxxxx
USE_AI=true
```

**Note:** Both API keys are optional. The system will work with rule-based insights only if you don't have them.

### 3. Install Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Deploy to AWS

For development:
```bash
serverless deploy --stage dev
```

For production:
```bash
serverless deploy --stage prod
```

### 5. Verify Deployment

After deployment, you should see:

```
endpoints:
  POST - https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev/profile
  GET - https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev/profile
  DELETE - https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev/profile
  POST - https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev/insights
  GET - https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev/insights

functions:
  userProfile: powerpulse-dev-userProfile
  generateInsights: powerpulse-dev-generateInsights

resources:
  UserProfile-dev (DynamoDB Table)
  Insights-dev (DynamoDB Table)
```

### 6. Test the Feature

1. **Open the dashboard** in your browser
2. **Create your profile:**
   - Scroll to "User Profile" section
   - Enter your location (e.g., "Mumbai", "Delhi", "Bangalore")
   - Select your home type
   - Check all appliances you have
   - Set star ratings (check appliance labels for actual ratings)
   - Click "Save Profile"

3. **Add some usage data:**
   - Add at least 3-7 days of readings manually
   - Or upload a CSV file with historical data

4. **Generate insights:**
   - Click "Generate Insights" button
   - Wait 5-10 seconds for analysis
   - Review your personalized recommendations!

---

## 🎯 Testing Different Modes

### Rule-Based Only (No API Keys Required)

Set in `.env`:
```bash
USE_AI=false
OPENWEATHER_API_KEY=
OPENAI_API_KEY=
```

Redeploy:
```bash
serverless deploy --stage dev
```

You'll get:
- Spike detection
- Trend analysis
- Basic appliance insights
- Cost estimates

### With Weather Data Only

Set in `.env`:
```bash
USE_AI=false
OPENWEATHER_API_KEY=your-key-here
OPENAI_API_KEY=
```

You'll get all rule-based insights plus:
- Temperature correlation
- Weather-aware recommendations

### Full AI Mode (Recommended)

Set in `.env`:
```bash
USE_AI=true
OPENWEATHER_API_KEY=your-key-here
OPENAI_API_KEY=sk-proj-your-key-here
```

You'll get:
- All rule-based insights
- Weather correlation
- 3-5 AI-generated personalized tips
- Context-aware recommendations

---

## 🔍 Troubleshooting

### "Profile not found" Error
**Solution:** Create your profile first in the User Profile section.

### No Insights Generated
**Solution:** Add at least 2-3 days of usage readings.

### Weather Data Not Showing
**Possible causes:**
1. OPENWEATHER_API_KEY not set or invalid
2. Location name incorrect (use city name, e.g., "Mumbai" not "Mumbai, India")
3. API rate limit exceeded (free tier: 60 calls/minute)

**Solution:** Check CloudWatch logs for the `generateInsights` function.

### AI Insights Not Appearing
**Possible causes:**
1. USE_AI is not set to 'true'
2. OPENAI_API_KEY is invalid or expired
3. OpenAI API rate limit or quota exceeded

**Solution:** 
- Verify environment variables in AWS Lambda console
- Check CloudWatch logs for OpenAI API errors
- System will fallback to rule-based insights

### Deployment Fails

**Error: "Table already exists"**
```bash
# Delete existing tables
aws dynamodb delete-table --table-name UserProfile-dev --region ap-south-1
aws dynamodb delete-table --table-name Insights-dev --region ap-south-1

# Then redeploy
serverless deploy --stage dev
```

**Error: "Timeout"**
- Lambda timeout is set to 30s
- Check internet connectivity for API calls
- Review CloudWatch logs for bottlenecks

---

## 📊 Monitoring

### View Lambda Logs

```bash
# View generateInsights logs
serverless logs -f generateInsights --tail

# View userProfile logs
serverless logs -f userProfile --tail
```

### Check DynamoDB Tables

```bash
# Scan UserProfile table
aws dynamodb scan --table-name UserProfile-dev --region ap-south-1

# Scan Insights table
aws dynamodb scan --table-name Insights-dev --region ap-south-1
```

### API Cost Monitoring

**OpenAI:**
- Visit https://platform.openai.com/usage
- Monitor token usage and costs
- Set usage limits if needed

**OpenWeather:**
- Free tier: 1M calls/month
- Typical usage: 1 call per insight generation
- Monitor at https://home.openweathermap.org/

---

## 💡 Usage Tips

1. **Accurate Profile = Better Insights**
   - Use actual star ratings from appliance labels
   - Update profile when buying new appliances
   - Be specific with location (city name)

2. **Consistent Data Entry**
   - Add readings daily for best trend analysis
   - Use CSV upload for historical data
   - Check readings for accuracy

3. **Insight Frequency**
   - Generate insights weekly for trends
   - Generate after unusual usage days
   - Compare insights over time

4. **Cost Optimization**
   - Use rule-based mode if budget-conscious
   - OpenAI cost: <$0.001 per generation
   - Weather API is free (up to 1M calls/month)

---

## 🔐 Security Best Practices

1. **Never commit `.env` file to Git**
   ```bash
   # Already in .gitignore
   echo ".env" >> .gitignore
   ```

2. **Rotate API keys periodically**
   - OpenAI: Every 90 days
   - OpenWeather: If compromised

3. **Use different keys for dev/prod**
   ```bash
   # Use serverless variables
   OPENAI_API_KEY=${env:OPENAI_API_KEY_${self:provider.stage}}
   ```

4. **Monitor API usage**
   - Set up billing alerts in OpenAI
   - Track Lambda invocations in CloudWatch

---

## 📞 Support

**Issues?** Check these in order:
1. CloudWatch Logs (Lambda execution details)
2. DynamoDB Tables (data integrity)
3. Browser Console (frontend errors)
4. Network Tab (API responses)

**Still stuck?** Create an issue with:
- Error message (from logs)
- Steps to reproduce
- Environment (dev/prod)
- Lambda function name

---

## ✅ Success Checklist

- [ ] Environment variables configured
- [ ] Backend dependencies installed
- [ ] Deployed to AWS successfully
- [ ] User profile created
- [ ] Usage data added (3+ days)
- [ ] Insights generated successfully
- [ ] AI insights appearing (if USE_AI=true)
- [ ] Weather data showing (if OPENWEATHER_API_KEY set)

---

**Congratulations! 🎉**

Your AI-powered energy insights feature is now live!

Start saving energy and money with personalized recommendations.

