# 🚀 Deployment Checklist - PowerPulse AI Insights

## Pre-Deployment

- [ ] Obtain OpenAI API Key from https://platform.openai.com/api-keys
- [ ] Obtain OpenWeather API Key from https://openweathermap.org/api
- [ ] Set environment variables:
  ```bash
  export OPENAI_API_KEY=sk-proj-xxxxx
  export OPENWEATHER_API_KEY=xxxxx
  export USE_AI=true
  ```

## Backend Setup

- [ ] Navigate to backend directory: `cd backend`
- [ ] Install dependencies: `npm install`
- [ ] Verify package.json includes `axios` dependency
- [ ] Check that all Lambda functions exist:
  - [ ] `backend/userProfile.js`
  - [ ] `backend/generateInsights.js`
  - [ ] `backend/addReading.js`
  - [ ] `backend/getAnalysis.js`
  - [ ] `backend/csvUpload.js`
- [ ] Verify data file exists: `backend/data/applianceProfiles.json`

## Serverless Configuration

- [ ] Review `serverless.yml`:
  - [ ] userProfile function defined
  - [ ] generateInsights function defined
  - [ ] UserProfileTable resource defined
  - [ ] InsightsTable resource defined
  - [ ] Environment variables configured
  - [ ] IAM permissions updated

## Deploy to AWS

```bash
# Development deployment
serverless deploy --stage dev

# Production deployment
serverless deploy --stage prod
```

- [ ] Deployment successful
- [ ] Note down API Gateway endpoints
- [ ] Verify Lambda functions created:
  - [ ] powerpulse-{stage}-userProfile
  - [ ] powerpulse-{stage}-generateInsights
- [ ] Verify DynamoDB tables created:
  - [ ] UserProfile-{stage}
  - [ ] Insights-{stage}
  - [ ] Readings-{stage} (existing)
  - [ ] Users-{stage} (existing)

## Frontend Configuration

- [ ] Update `frontend/js/config.js` with API Gateway URL (if needed)
- [ ] Test dashboard.html loads properly
- [ ] Verify all new UI elements visible:
  - [ ] User Profile section
  - [ ] AI Insights section

## Testing

### 1. User Profile
- [ ] Open dashboard in browser
- [ ] Verify User Profile section appears
- [ ] Click on appliances to show star ratings
- [ ] Fill profile form:
  - [ ] Location: Mumbai
  - [ ] Home Type: Apartment
  - [ ] Select 2-3 appliances with ratings
- [ ] Click "Save Profile"
- [ ] Verify success message appears
- [ ] Profile displays in read-only mode
- [ ] Click "Edit Profile" to verify edit mode works

### 2. Usage Data
- [ ] Add at least 3 daily readings
- [ ] Or upload sample CSV file
- [ ] Verify readings appear in chart

### 3. Insights Generation

#### Rule-Based Mode (without AI)
- [ ] Set `USE_AI=false`
- [ ] Click "Generate Insights"
- [ ] Verify loading spinner appears
- [ ] Wait 2-5 seconds
- [ ] Verify insights appear as cards
- [ ] Check for:
  - [ ] Statistics insight (usage counts)
  - [ ] Trend insights
  - [ ] Cost estimation

#### AI-Enhanced Mode (with AI)
- [ ] Set `USE_AI=true`
- [ ] Ensure OPENAI_API_KEY is valid
- [ ] Click "Generate Insights"
- [ ] Wait 5-15 seconds (AI processing)
- [ ] Verify AI insights appear (🤖 icon)
- [ ] Verify rule-based insights also appear
- [ ] Check metadata bar shows:
  - [ ] Insights type: "ai-enhanced"
  - [ ] Weather data (if available)
  - [ ] Data points count

#### Weather Integration
- [ ] Ensure OPENWEATHER_API_KEY is set
- [ ] Verify weather data in metadata
- [ ] Check for weather-related insights

## Monitoring & Verification

### CloudWatch Logs
```bash
# View generateInsights logs
serverless logs -f generateInsights --tail --stage dev

# View userProfile logs
serverless logs -f userProfile --tail --stage dev
```

- [ ] No error messages in logs
- [ ] Successful API calls logged

### DynamoDB Tables
```bash
# Check UserProfile table
aws dynamodb scan --table-name UserProfile-dev --region ap-south-1

# Check Insights table
aws dynamodb scan --table-name Insights-dev --region ap-south-1
```

- [ ] User profile stored correctly
- [ ] Insights stored with TTL

### API Testing (Optional)
```bash
# Test profile endpoint
curl -X GET "https://YOUR-API-ID.execute-api.ap-south-1.amazonaws.com/dev/profile?userId=test-user" \
  -H "Authorization: Bearer YOUR-TOKEN"

# Test insights endpoint
curl -X POST "https://YOUR-API-ID.execute-api.ap-south-1.amazonaws.com/dev/insights" \
  -H "Authorization: Bearer YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user"}'
```

## Error Handling Tests

- [ ] Test with no profile created:
  - [ ] Generate insights
  - [ ] Verify "Profile not found" message
- [ ] Test with no readings:
  - [ ] After creating profile, generate insights
  - [ ] Verify "Add readings" message
- [ ] Test with invalid API keys:
  - [ ] Set invalid OPENAI_API_KEY
  - [ ] Verify fallback to rule-based insights
- [ ] Test network errors:
  - [ ] Disconnect internet
  - [ ] Verify error messages display

## Performance Checks

- [ ] Insights generation completes in <30 seconds
- [ ] Profile save/load is instant (<2 seconds)
- [ ] Dashboard loads without errors
- [ ] No console errors in browser

## Cost Monitoring

- [ ] Check OpenAI usage: https://platform.openai.com/usage
- [ ] Verify OpenWeather calls: https://home.openweathermap.org/
- [ ] Review AWS Lambda invocations in CloudWatch
- [ ] Check DynamoDB read/write metrics

## Documentation Review

- [ ] `AI_INSIGHTS_GUIDE.md` - Comprehensive guide
- [ ] `SETUP_AI_INSIGHTS.md` - Quick setup
- [ ] `IMPLEMENTATION_SUMMARY.md` - What was built
- [ ] `ENV_SETUP.txt` - Environment variables
- [ ] `DEPLOYMENT_CHECKLIST.md` - This file

## Security Checklist

- [ ] API keys not committed to Git
- [ ] Environment variables properly set
- [ ] Cognito authentication enabled on all endpoints
- [ ] CORS configured correctly
- [ ] IAM roles follow least privilege

## Final Verification

- [ ] All Lambda functions executing successfully
- [ ] All DynamoDB tables accessible
- [ ] API Gateway endpoints responding
- [ ] Frontend UI working properly
- [ ] User flow complete: Profile → Readings → Insights
- [ ] No errors in browser console
- [ ] No errors in CloudWatch logs

## Post-Deployment

- [ ] Share API endpoint with team
- [ ] Set up billing alerts in AWS
- [ ] Monitor OpenAI usage for first 24 hours
- [ ] Gather user feedback
- [ ] Plan for improvements

---

## Rollback Plan (If Issues Arise)

```bash
# Remove deployment
serverless remove --stage dev

# Or remove specific resources
aws dynamodb delete-table --table-name UserProfile-dev --region ap-south-1
aws dynamodb delete-table --table-name Insights-dev --region ap-south-1
```

---

## Success Criteria ✅

You can mark deployment as successful when:
1. ✅ User can create/edit profile
2. ✅ User can add usage readings
3. ✅ Insights generate successfully
4. ✅ AI insights appear (if USE_AI=true)
5. ✅ Weather data integrated (if key provided)
6. ✅ No errors in logs
7. ✅ Cost within expected range

---

## Support Resources

- **CloudWatch Logs**: AWS Console → CloudWatch → Log Groups
- **DynamoDB**: AWS Console → DynamoDB → Tables
- **OpenAI Dashboard**: https://platform.openai.com/usage
- **OpenWeather Dashboard**: https://home.openweathermap.org/
- **Serverless Docs**: https://www.serverless.com/framework/docs

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Stage:** [ ] Dev [ ] Prod
**Status:** [ ] Success [ ] Issues [ ] Rolled Back

**Notes:**
_______________________________________________________
_______________________________________________________
_______________________________________________________

