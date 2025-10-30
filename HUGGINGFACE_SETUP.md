# 🤗 Hugging Face Integration & AI Insights

## ✅ Why Hugging Face?

- **100% FREE** - No credit card ever needed
- **No quotas** - Generous rate limits on free tier
- **Thousands of models** - Choose what works best
- **Easy setup** - Get API key in 1 minute
- **Always free** - Not a trial, actually free forever

---

## 🔑 Step 1: Get Your Hugging Face API Key (1 Minute!)

1. **Visit:** https://huggingface.co/settings/tokens
2. **Sign up** with email (or Google/GitHub)
3. **Click "New token"**
4. **Name it:** `powerpulse-api`
5. **Role:** Select "Read"
6. **Copy the token** (starts with `hf_...`)

**That's it!** No credit card, no verification, completely free.

---

## 🚀 Step 2: Add to Lambda (No Redeployment!)

### Fastest Way - Lambda Console:

1. **Go to AWS Lambda Console**
   - https://ap-south-1.console.aws.amazon.com/lambda/

2. **Open function:** `powerpulse-dev-generateInsights`

3. **Configuration → Environment variables → Edit**

4. **Add these:**
   ```
   Key: HUGGINGFACE_API_KEY
   Value: hf_your_actual_token_here
   
   Key: USE_AI
   Value: true
   
   Key: AI_MODEL (optional)
   Value: mistralai/Mistral-7B-Instruct-v0.2
   ```

5. **Click Save**

6. **Test immediately!** - Go to dashboard and click "Generate Insights"

---

## 🤖 Available FREE Models

You can change the `AI_MODEL` environment variable to any of these:

### **Recommended Models:**

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| **`mistralai/Mistral-7B-Instruct-v0.2`** | ⚡⚡ Fast | ⭐⭐⭐⭐⭐ | **Best overall (RECOMMENDED)** |
| **`microsoft/Phi-3-mini-4k-instruct`** | ⚡⚡⚡ Very Fast | ⭐⭐⭐⭐ | Quick responses |
| **`google/flan-t5-large`** | ⚡⚡⚡ Very Fast | ⭐⭐⭐ | Structured output |
| **`meta-llama/Meta-Llama-3-8B-Instruct`** | ⚡⚡ Fast | ⭐⭐⭐⭐⭐ | High quality |
| **`HuggingFaceH4/zephyr-7b-beta`** | ⚡⚡ Fast | ⭐⭐⭐⭐ | Good balance |

**Default model in this project:** `google/gemma-2-9b-it` (override with env `AI_MODEL`).

---

## 🧪 Step 3: Test It!

1. **Open your dashboard**
2. **Click "Generate Insights"**
3. **First request may take 20-30 seconds** (model loading - only first time!)
4. **Subsequent requests: 2-5 seconds** ⚡

### What You'll See:

```
🤖 AI Insight 1
Your Air Conditioner (3-star) is consuming 5.5 kWh daily, which is 
42% of your total usage. With Indore's current pleasant 24°C weather, 
you could save ₹360/month by using it 2 hours less per day.

🤖 AI Insight 2
Your 2-star Geyser and Fridge are less efficient. Upgrading both 
to 5-star models could reduce consumption by 2.5 kWh/day, saving 
approximately ₹450/month (₹6/kWh rate).

🤖 AI Insight 3
Excellent! Your usage dropped 18% yesterday. The rainy weather 
helped reduce cooling needs. Maintain this pattern by using natural 
ventilation when temperature is below 25°C.

PLUS all your rule-based insights!
```

---

## 🧠 How AI Insights Are Generated
1) User requests `/insights` with Cognito ID token.
2) Backend loads last 30 days of readings + user profile + optional weather.
3) Rule‑based insights are generated immediately (spikes, trends, weather, cost).
4) We compute a request hash (last 7 readings + profile + model + date bucket) and check DynamoDB `InsightsCache`.
   - If cached (status=ready): return cached AI insights immediately.
   - If not cached: call Hugging Face v1 Chat Completions:
     - POST `https://router.huggingface.co/v1/chat/completions`
     - `{ model, messages: [{ role: 'user', content: <context> }], max_tokens, temperature }`
5) Parse the text into 3–5 cards and store in `InsightsCache` (TTL ~2 min) and `Insights` history.
6) Response includes metadata (type, cache, readingsCount, etc.).

## ⏱️ Request Limiting & Caching
- Rate limiting: token‑bucket (1 request/15s, max 4/min per user).
- On limit, API responds 429 and includes cached insights when available (or most recent insights).
- `InsightsCache`: avoids duplicate calls for identical inputs for ~2 minutes.

### **First Request (Cold Start):**
- **Time:** 20-30 seconds
- **Why:** Model needs to load into memory
- **Solution:** Just wait, only happens once

### **Subsequent Requests:**
- **Time:** 2-5 seconds
- **Why:** Model is already loaded
- **Great for:** Regular usage

### **If Model Goes to Sleep:**
- **After:** ~30 minutes of inactivity
- **Solution:** First request takes 20-30s again
- **Totally normal** for free tier

---

## ⚡ Performance Notes

### **What You Get FREE:**

- **Rate Limit:** ~1000 requests/day
- **Concurrent:** 10 requests at once
- **Model Loading:** Sometimes slow (acceptable for free!)
- **Cost:** $0 forever

### **For PowerPulse:**
- **Typical usage:** 5-10 requests/user/day
- **Your app:** Can support 100+ users easily
- **Perfect for:** Student projects, demos, small apps

---

## 🐛 Troubleshooting

### "Model is loading" (503 Error)

**Normal!** This happens on first request or after inactivity.

**What to do:**
- Wait 20-30 seconds
- Try again
- Model will be warm for next requests

**In logs you'll see:**
```
Hugging Face model is loading, this may take 20-30 seconds
```

### "Unauthorized" (401 Error)

**Check:**
1. API key starts with `hf_`
2. No extra spaces in key
3. Token is "Read" role (not "Write")

### "Rate limit exceeded" (429 Error)

**Unlikely but possible:**
- Wait 1 minute
- Free tier resets frequently
- Consider caching insights (generate once/day)

### Model Not Working Well?

**Try a different model:**
```
AI_MODEL = microsoft/Phi-3-mini-4k-instruct  (faster)
AI_MODEL = google/flan-t5-large             (simpler)
AI_MODEL = HuggingFaceH4/zephyr-7b-beta     (alternative)
```

---

## 🔄 Deploy with Environment Variables

If you prefer to deploy (instead of manual Lambda update):

```bash
# In Git Bash
cd /d/Coding/powerPulse/powerpulse

# Set environment variables
export HUGGINGFACE_API_KEY="hf_your_token"
export OPENWEATHER_API_KEY="your_weather_key"
export USE_AI="true"
export AI_MODEL="mistralai/Mistral-7B-Instruct-v0.2"

# Deploy
serverless deploy --stage dev
```

---

## 📊 Comparison: Hugging Face vs Others

| Feature | Hugging Face | Gemini | OpenAI |
|---------|--------------|--------|---------|
| **Cost** | ✅ FREE | ⚠️ Free but complex | ❌ Paid |
| **Credit Card** | ✅ Not needed | ✅ Not needed | ❌ Required |
| **Setup** | ✅ 1 minute | ⚠️ 5 minutes | ⚠️ 10 minutes |
| **Cold Start** | ⚠️ 20-30s first time | ✅ Fast always | ✅ Fast always |
| **Quality** | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **Rate Limits** | ✅ Generous | ⚠️ Can be confusing | ✅ High |
| **Best for** | ✅ **Students, demos** | Production | Production |

---

## 🎓 For Your Project

You can say:
- ✅ "Integrated Hugging Face Mistral-7B AI model"
- ✅ "Zero-cost AI implementation"
- ✅ "Supports multiple AI models via configuration"
- ✅ "Hybrid approach: Rule-based + AI-enhanced"
- ✅ "Scalable to 1000+ users on free tier"

---

## 🔗 Useful Links

- **Get API Token:** https://huggingface.co/settings/tokens
- **Browse Models:** https://huggingface.co/models
- **API Docs:** https://huggingface.co/docs/inference-providers
- **Inference Providers API:** https://router.huggingface.co/hf-inference
- **Migration Guide:** https://huggingface.co/docs/inference-providers/migration

---

## ✅ Success Checklist

- [ ] Created Hugging Face account
- [ ] Generated API token (starts with `hf_`)
- [ ] Added `HUGGINGFACE_API_KEY` to Lambda
- [ ] Set `USE_AI = true`
- [ ] Clicked "Generate Insights"
- [ ] Waited 20-30 seconds (first time only)
- [ ] Saw AI insights with 🤖 icon
- [ ] Subsequent requests are fast (2-5s)

---

**Ready? Get your token and add it to Lambda environment variables!** 🚀

**No redeployment needed - just update Lambda env vars and test!**

