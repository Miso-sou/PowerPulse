# 🚀 Google Gemini Pro Integration Guide

## ✅ Why Gemini?

- **100% FREE** - No credit card required
- **Generous limits** - 60 requests/minute
- **High quality** - Comparable to GPT-4
- **Easy setup** - Get API key in 2 minutes

---

## 🔑 Step 1: Get Your Gemini API Key

### Option A: Google AI Studio (Recommended)

1. **Visit:** https://makersuite.google.com/app/apikey
2. **Sign in** with your Google account
3. **Click "Create API Key"**
4. **Select or create** a Google Cloud project
5. **Copy the API key** (starts with `AIza...`)

### Option B: Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Enable the "Generative Language API"
3. Create credentials → API key
4. Copy the key

---

## 🛠️ Step 2: Configure Environment Variables

### Using Lambda Console (Easiest - No Redeployment Needed!)

1. **Go to AWS Lambda Console**
   - https://ap-south-1.console.aws.amazon.com/lambda/

2. **Open function:** `powerpulse-dev-generateInsights`

3. **Configuration → Environment variables → Edit**

4. **Add/Update these variables:**
   ```
   Key: GEMINI_API_KEY
   Value: AIza... (your actual Gemini API key)
   
   Key: USE_AI
   Value: true
   
   Key: OPENWEATHER_API_KEY
   Value: your-weather-key (if you have it)
   ```

5. **Click Save**

6. **Test immediately!**
   - Go to your dashboard
   - Click "Generate Insights"
   - Should see AI insights with 🤖 icon!

### Using Deployment (Alternative)

If you want to deploy with the keys:

```bash
# In Git Bash or PowerShell
export GEMINI_API_KEY="AIza-your-actual-key"
export OPENWEATHER_API_KEY="your-weather-key"
export USE_AI="true"

# Deploy
cd /d/Coding/powerPulse/powerpulse
serverless deploy --stage dev
```

---

## 🧪 Step 3: Test It!

1. **Open your dashboard**
2. **Click "Generate Insights"**
3. **Watch the loading animation**
4. **You should see:**
   - ✅ Insights Type: **ai-enhanced**
   - ✅ Insights with 🤖 icon
   - ✅ Personalized, conversational recommendations
   - ✅ Weather data integrated
   - ✅ Appliance-specific tips

---

## 📊 Example: What You'll Get

**Before (Rule-Based Only):**
```
📉 Daily Usage Decreased
Usage decreased by 18.4% compared to yesterday.

🔌 Top Energy Consumer
Your AC accounts for ~42% of consumption.
```

**After (Gemini AI-Enhanced):**
```
🤖 AI Insight 1
Given Indore's current pleasant weather at 24°C with light rain, 
your AC consumption should naturally decrease. This is a great 
opportunity to keep windows open during the day and rely on 
natural ventilation - you could save ₹400-500 this month!

🤖 AI Insight 2
I notice your 2-star Geyser is consuming 3.5 kWh daily. In the 
current mild weather, consider heating water only when needed 
rather than keeping it on continuously. A timer switch could 
automate this and cut geyser costs by 40%.

🤖 AI Insight 3
Excellent news! Your 18% drop in usage yesterday shows great 
energy consciousness. Your current consumption of 16.3 kWh is 
well below the typical 20+ kWh for similar homes in Indore. 
Keep up these habits!

PLUS all your rule-based insights!
```

**Much more personalized and actionable!** 🎉

---

## 🔍 Verify It's Working

### Method 1: Check Logs

```bash
serverless logs -f generateInsights --tail --stage dev
```

**Look for:**
```
✅ Gemini API response received: ...
✅ Generated 5 AI insights
✅ Generated 4 rule-based insights
```

### Method 2: Check Browser

1. Open DevTools (F12)
2. Network tab
3. Click "Generate Insights"
4. Find the `/insights` request
5. Check Response:
   ```json
   {
     "metadata": {
       "type": "ai-enhanced",  ← Confirms AI working!
       "aiInsightsCount": 5
     }
   }
   ```

---

## 💰 API Limits & Pricing

### Free Tier (What You Get)

- **Requests:** 60 per minute
- **Daily limit:** Extremely generous (thousands of requests)
- **Cost:** $0 (completely free!)
- **Quota reset:** Every minute

**For PowerPulse usage:**
- Each insight generation = 1 request
- Typical user = 5-10 requests/day
- **You can support 100+ users easily on free tier!** 🎉

### If You Hit Limits (Unlikely)

Error in logs:
```
Gemini API error: Resource exhausted
```

**Solutions:**
1. Wait 60 seconds (quota resets)
2. Implement caching (generate insights once/day)
3. Upgrade to paid tier (still very cheap)

---

## 🐛 Troubleshooting

### "Gemini API key not configured"

**Check:**
1. Lambda environment variable `GEMINI_API_KEY` exists
2. Value starts with `AIza`
3. No extra spaces in the key

### "API key not valid"

**Solutions:**
1. Regenerate key at https://makersuite.google.com/app/apikey
2. Ensure API is enabled in Google Cloud Console
3. Check key hasn't expired

### "API error: 403 Forbidden"

**Cause:** Generative Language API not enabled

**Fix:**
1. Go to https://console.cloud.google.com/
2. Search "Generative Language API"
3. Click "Enable"
4. Try again in 1-2 minutes

### Still Getting Rule-Based Only

**Checklist:**
- [ ] `GEMINI_API_KEY` set in Lambda
- [ ] `USE_AI` = `true` (exactly, lowercase)
- [ ] At least 3 usage readings in database
- [ ] Check CloudWatch logs for errors

---

## 📈 Comparison: Gemini vs OpenAI

| Feature | Gemini Pro | OpenAI GPT-4o-mini |
|---------|------------|-------------------|
| **Cost** | ✅ FREE | ❌ $0.15/1M tokens |
| **Credit Card** | ✅ Not needed | ❌ Required |
| **Quality** | ✅ Excellent | ✅ Excellent |
| **Speed** | ✅ Fast (~1-2s) | ✅ Fast (~1-2s) |
| **Limits** | 60/min free | Based on tier |
| **Best for** | ✅ Students, projects | Production apps |

**For PowerPulse: Gemini is perfect!** ✅

---

## 🎓 For Your Project/Demo

You can say:
- ✅ "Integrated Google Gemini Pro AI for personalized insights"
- ✅ "Hybrid system: Rule-based + AI-enhanced recommendations"
- ✅ "Zero-cost AI implementation using Google's free tier"
- ✅ "Contextual weather-aware energy recommendations"
- ✅ "Generates 5+ actionable insights per analysis"

---

## 🚀 Next Steps

1. **Get Gemini API key** (2 minutes)
2. **Add to Lambda environment variables** (1 minute)
3. **Test insights** (30 seconds)
4. **Show off your AI-powered app!** 🎉

---

## 🔗 Useful Links

- **Get API Key:** https://makersuite.google.com/app/apikey
- **Gemini Docs:** https://ai.google.dev/docs
- **API Reference:** https://ai.google.dev/api/rest/v1beta/models
- **Rate Limits:** https://ai.google.dev/pricing

---

**Ready to test? Add your Gemini API key to Lambda and click "Generate Insights"!** 🚀

