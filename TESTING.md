# 🧪 PowerPulse Testing Guide

This guide helps you test all features of PowerPulse locally and on AWS.

## Quick Start Testing

### 1. Start Local Server

```bash
# Option 1: Using npm (if http-server is available)
npm run serve

# Option 2: Using Python
npm run serve:python

# Option 3: Using Node.js directly
npx http-server frontend -p 8000
```

Visit: http://localhost:8000

## Test Cases

### ✅ Test 1: User Signup

**Steps:**
1. Open http://localhost:8000
2. Click "Sign up"
3. Enter email: `test@example.com`
4. Enter password: `Test@123456`
5. Confirm password: `Test@123456`
6. Click "Sign Up"

**Expected Result:**
- Success message: "Signup successful! Please check your email for verification code."
- Form toggles to login after 2 seconds

**Troubleshooting:**
- If "User already exists": User already registered, try login
- If password validation error: Ensure password meets requirements (8+ chars, uppercase, lowercase, number)

---

### ✅ Test 2: User Login

**Steps:**
1. Click "Login" (if on signup page)
2. Enter email: `test@example.com`
3. Enter password: `Test@123456`
4. Click "Login"

**Expected Result:**
- Redirected to dashboard (dashboard.html)
- Welcome message or dashboard loads

**Troubleshooting:**
- If "User is not confirmed": Run AWS CLI command:
  ```bash
  aws cognito-idp admin-confirm-sign-up \
    --user-pool-id <YOUR_USER_POOL_ID> \
    --username test@example.com
  ```
- If "Incorrect username or password": Check credentials or create new user

---

### ✅ Test 3: Add Single Reading

**Pre-requisite:** User must be logged in

**Steps:**
1. On dashboard, select today's date
2. Enter usage: `14.5`
3. Click "Add Reading"

**Expected Result:**
- Success message: "Reading added successfully!"
- Chart updates with new data point
- Statistics (Avg, Max, Min) update
- Usage input clears, date resets to today

**Verify in AWS:**
```bash
aws dynamodb scan --table-name Readings-dev
```

**Troubleshooting:**
- If "Unauthorized": Check that idToken is in localStorage
- If "Failed to add reading": Check CloudWatch logs:
  ```bash
  npm run logs:addReading
  ```

---

### ✅ Test 4: View Usage Chart

**Pre-requisite:** At least one reading added

**Steps:**
1. View the "Usage Trends" chart
2. Hover over data points
3. Check statistics panel

**Expected Result:**
- Line chart displays with dates on X-axis, usage on Y-axis
- Hover shows exact values
- Average, Max, Min calculated correctly
- Chart is responsive

**Test Data Points:**
- Single reading: Chart shows one point
- Multiple readings: Chart shows trend line
- Same date multiple readings: Latest value shown

---

### ✅ Test 5: CSV Bulk Upload

**Pre-requisite:** Prepare CSV file

**Test CSV (`test-readings.csv`):**
```csv
2025-10-01,12.5
2025-10-02,14.3
2025-10-03,11.8
2025-10-04,15.2
2025-10-05,13.7
```

**Steps:**
1. Click "Choose File" in CSV Upload section
2. Select `test-readings.csv`
3. Click "Upload CSV"

**Expected Result:**
- Success message: "5 readings uploaded successfully!"
- Chart updates with all readings
- Statistics recalculated

**Verify in AWS:**
```bash
aws dynamodb scan --table-name Readings-dev --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid":{"S":"<YOUR_USER_ID>"}}'
```

**Troubleshooting:**
- If CSV format error: Ensure format is `date,usage` with no headers
- If partial upload: Check CloudWatch logs for specific errors

---

### ✅ Test 6: Generate AI Tips

**Pre-requisite:** At least one reading added

**Steps:**
1. Scroll to "AI Energy Efficiency Tips" section
2. Click "Generate Tips"

**Expected Result:**
- 3 energy-saving tips displayed
- Each tip has number and description
- Tips are relevant (mock data in current version)

**Expected Tips (Mock):**
1. Switch off devices completely when not in use instead of leaving them in standby mode.
2. Use LED bulbs instead of incendescent lights to reduce energy consumption by up to 80%.
3. Run washing machines and dishwashers only with full loads to maximize efficiency.

---

### ✅ Test 7: Logout

**Steps:**
1. Click "Logout" button in navigation
2. Observe behavior

**Expected Result:**
- Redirected to login page (index.html)
- Local storage cleared (userId, idToken)
- User session ended

**Verify:**
- Open DevTools → Application → Local Storage
- Should be empty after logout

---

### ✅ Test 8: Unauthorized Access Protection

**Steps:**
1. Logout (if logged in)
2. Manually navigate to: http://localhost:8000/dashboard.html

**Expected Result:**
- Immediately redirected to index.html (login page)
- Cannot access dashboard without authentication

**Test in Code:**
```javascript
// In dashboard.js init()
if (!userId || !idToken) {
    window.location.href = 'index.html';
    return;
}
```

---

## API Endpoint Testing

### Test with cURL

**1. Add Reading (requires auth token)**

```bash
# First, get the ID token from browser localStorage after login
# Then test:

curl -X POST https://YOUR_API_URL/dev/addReading \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "date": "2025-10-09",
    "usage": 14.7
  }'
```

**Expected Response:**
```json
{
  "message": "Reading added successfully",
  "data": {
    "userId": "YOUR_USER_ID",
    "date": "2025-10-09",
    "usage": 14.7,
    "timestamp": "2025-10-09T10:30:00.000Z"
  }
}
```

**2. Get Analysis**

```bash
curl -X GET "https://YOUR_API_URL/dev/getAnalysis?userId=YOUR_USER_ID" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

**Expected Response:**
```json
{
  "average": 13.5,
  "max": 15.2,
  "min": 11.8,
  "readings": [
    {"userId": "...", "date": "2025-10-01", "usage": 12.5},
    {"userId": "...", "date": "2025-10-02", "usage": 14.3}
  ],
  "tips": [
    "Switch off devices completely...",
    "Use LED bulbs...",
    "Run washing machines..."
  ]
}
```

**3. Upload CSV**

```bash
curl -X POST https://YOUR_API_URL/dev/uploadCSV \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "readings": [
      {"date": "2025-10-01", "usage": 12.5},
      {"date": "2025-10-02", "usage": 14.3}
    ]
  }'
```

## Browser DevTools Testing

### 1. Check Local Storage

**Open DevTools → Application → Local Storage**

Should contain:
```
userId: "abc123-def456-ghi789..."
idToken: "eyJraWQiOiJ..."
```

### 2. Monitor Network Requests

**Open DevTools → Network**

Test each action and verify:
- **Add Reading**: POST to `/addReading` → Status 201
- **Get Analysis**: GET to `/getAnalysis?userId=...` → Status 200
- **Upload CSV**: POST to `/uploadCSV` → Status 200

### 3. Console Logs

**Open DevTools → Console**

Check for:
- No errors (red messages)
- Successful fetch confirmations
- Chart initialization logs

## AWS Console Verification

### 1. DynamoDB Tables

**Check Readings Table:**
```bash
aws dynamodb scan --table-name Readings-dev --max-items 10
```

**Expected Output:**
```json
{
  "Items": [
    {
      "date": {"S": "2025-10-01"},
      "userId": {"S": "abc123..."},
      "usage": {"N": "12.5"},
      "timestamp": {"S": "2025-10-09T10:30:00.000Z"}
    }
  ]
}
```

### 2. Cognito Users

**List users:**
```bash
aws cognito-idp list-users --user-pool-id YOUR_USER_POOL_ID
```

**Check user status:**
```bash
aws cognito-idp admin-get-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username test@example.com
```

### 3. Lambda Logs

**View recent logs:**
```bash
# Add Reading logs
serverless logs -f addReading --tail

# Get Analysis logs
serverless logs -f getAnalysis --tail

# CSV Upload logs
serverless logs -f csvUpload --tail
```

### 4. API Gateway

**Test endpoint directly:**
```bash
aws apigateway test-invoke-method \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_RESOURCE_ID \
  --http-method GET \
  --path-with-query-string "/getAnalysis?userId=YOUR_USER_ID"
```

## Performance Testing

### Load Test Script

Create `load-test.js`:

```javascript
const userId = 'YOUR_USER_ID';
const idToken = 'YOUR_ID_TOKEN';
const apiUrl = 'YOUR_API_URL';

async function addMultipleReadings(count) {
  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const response = await fetch(`${apiUrl}/addReading`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        date: dateStr,
        usage: Math.random() * 20 + 5 // Random between 5-25
      })
    });
    
    console.log(`Added reading ${i+1}/${count}:`, await response.json());
  }
}

addMultipleReadings(30); // Add 30 readings
```

**Run:**
```bash
node load-test.js
```

## Error Scenarios

### 1. Test Invalid Input

**Negative Usage:**
```json
{"userId": "abc123", "date": "2025-10-09", "usage": -5}
```
**Expected:** 400 Bad Request - "Usage cannot be negative"

**Missing Fields:**
```json
{"userId": "abc123"}
```
**Expected:** 400 Bad Request - "Missing required fields"

### 2. Test Unauthorized Access

**No Token:**
```bash
curl -X POST https://YOUR_API_URL/dev/addReading \
  -H "Content-Type: application/json" \
  -d '{"userId":"abc","date":"2025-10-09","usage":10}'
```
**Expected:** 401 Unauthorized

**Invalid Token:**
```bash
curl -X POST https://YOUR_API_URL/dev/addReading \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"abc","date":"2025-10-09","usage":10}'
```
**Expected:** 401 Unauthorized

### 3. Test Edge Cases

**Very Large Usage:**
```json
{"userId": "abc123", "date": "2025-10-09", "usage": 999999}
```
**Expected:** Should work (no max limit currently)

**Future Date:**
```json
{"userId": "abc123", "date": "2030-01-01", "usage": 15}
```
**Expected:** Should work (no date validation currently)

**Duplicate Date:**
- Add reading for 2025-10-09
- Add another for 2025-10-09
**Expected:** Overwrites (DynamoDB put behavior)

## Checklist

- [ ] User signup successful
- [ ] User login successful
- [ ] Add single reading works
- [ ] Chart displays correctly
- [ ] Statistics calculate correctly
- [ ] CSV upload successful
- [ ] AI tips generated
- [ ] Logout works
- [ ] Unauthorized access blocked
- [ ] API endpoints respond correctly
- [ ] DynamoDB stores data
- [ ] CloudWatch logs accessible
- [ ] No console errors
- [ ] Mobile responsive (test on phone)

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| CORS error | Missing headers | Check `cors: true` in serverless.yml |
| 401 Unauthorized | Invalid/missing token | Re-login to get fresh token |
| Chart not showing | No data | Add at least one reading |
| Signup fails | Weak password | Use 8+ chars with upper, lower, number |
| CSV upload fails | Wrong format | Use `date,usage` format, no headers |
| Redirect loop | Config error | Check userId/idToken in localStorage |

## Testing Completion

Once all tests pass:
1. ✅ Take screenshots of working features
2. ✅ Document any issues found
3. ✅ Prepare demo data (use `sample-readings.csv`)
4. ✅ Test on different browsers (Chrome, Firefox, Safari)
5. ✅ Test on mobile device
6. ✅ Verify AWS Free Tier usage

## Next Steps

- Create test user accounts for demo
- Prepare presentation slides
- Document API with Postman collection
- Set up monitoring/alerts
- Plan for future enhancements

---

Happy Testing! 🚀

