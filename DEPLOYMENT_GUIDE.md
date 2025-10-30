# 🚀 PowerPulse Deployment Guide (AWS, Serverless)

This is the fastest path to deploy both backend and frontend (S3 + CloudFront).

## Prerequisites
- Node.js 18+
- AWS account
- Serverless Framework (installed via project devDependency)
- Optional: AWS CLI for some convenience commands

## 1) Install dependencies
```bash
npm install
cd backend && npm install && cd ..
```

## 2) Configure Cognito (once)

### Option A: AWS Console

1. Go to **AWS Cognito Console**: https://console.aws.amazon.com/cognito/
2. Click **Create user pool**
3. Configure sign-in experience:
   - Sign-in options: ✅ Email
4. Configure security requirements:
   - Password policy: Cognito defaults (or customize)
   - Multi-factor authentication: No MFA (or optional)
5. Configure sign-up experience:
   - Self-registration: ✅ Enable
   - Attribute verification: Email
6. Configure message delivery:
   - Email provider: Send email with Cognito
7. Integrate your app:
   - User pool name: `PowerPulse-Users`
   - App client name: `PowerPulseWebClient`
   - ⚠️ **Important**: Uncheck "Generate client secret"
8. Review and create
9. **Save these values**:
   - User Pool ID: `ap-south-1_XXXXXXXXX`
   - App Client ID: `xxxxxxxxxxxxxxxxxxxx`
   - Region: `ap-south-1`

### Option B: AWS CLI

```bash
# Create User Pool
aws cognito-idp create-user-pool \
  --pool-name PowerPulse-Users \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }'

# Note the "Id" from the output (User Pool ID)

# Create App Client (replace <USER_POOL_ID>)
aws cognito-idp create-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-name PowerPulseWebClient \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH

# Note the "ClientId" from the output
```

## 3) Update configuration

```bash
# Get your AWS Account ID
aws sts get-caller-identity --query Account --output text

# Construct ARN
# Format: arn:aws:cognito-idp:<REGION>:<ACCOUNT_ID>:userpool/<USER_POOL_ID>
# Example: arn:aws:cognito-idp:ap-south-1:123456789012:userpool/ap-south-1_ABC123XYZ
```

### serverless.yml

### 1. Update `serverless.yml`

Find and replace the Cognito ARN in **3 places** (lines 47, 58, 69):

```yaml
authorizer:
  type: COGNITO_USER_POOLS
  arn: arn:aws:cognito-idp:<REGION>:<ACCOUNT_ID>:userpool/<USER_POOL_ID>
```

**Example:**
```yaml
authorizer:
  type: COGNITO_USER_POOLS
  arn: arn:aws:cognito-idp:ap-south-1:123456789012:userpool/ap-south-1_ABC123XYZ
```

## 4) Deploy (backend + frontend infra)

```bash
 npx serverless deploy --stage dev
```

Creates: API Gateway + Lambda, DynamoDB tables, S3 bucket, CloudFront distribution.

**Expected Output:**
```
✔ Service deployed to stack powerpulse-dev (120s)

endpoints:
  POST - https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev/addReading
  GET - https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev/getAnalysis
  POST - https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev/uploadCSV

functions:
  addReading: powerpulse-dev-addReading (5.1 kB)
  getAnalysis: powerpulse-dev-getAnalysis (5.3 kB)
  csvUpload: powerpulse-dev-csvUpload (5.2 kB)
```

**📝 Copy the base API URL** (everything before `/addReading`):
- Example: `https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev`

## 5) Update Frontend Configuration

Edit `frontend/js/config.js`:

```javascript
const AWS_CONFIG = {
    region: 'ap-south-1',                    // Your AWS region
    userPoolId: 'ap-south-1_ABC123XYZ',     // From Step 3
    clientId: '1234567890abcdefghij',        // From Step 3
    identityPoolId: '',                      // Leave empty
    apiGatewayUrl: 'https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev'  // From Step 6
};
```

## 6) Test Locally (optional)

### Option 1: Open HTML file directly
```bash
# Windows
start frontend/index.html

# macOS
open frontend/index.html

# Linux
xdg-open frontend/index.html
```

### Option 2: Use HTTP Server (Recommended)

**Using Python:**
```bash
cd frontend
python -m http.server 8000
# Visit http://localhost:8000
```

**Using Node.js:**
```bash
npx http-server frontend -p 8000
# Visit http://localhost:8000
```

**Using Live Server (VS Code):**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

## 7) Test the Application

### 1. Create Account
1. Open the application
2. Click "Sign up"
3. Enter email: `your-email@example.com`
4. Enter password: `Test@1234` (min 8 chars, includes uppercase, lowercase, number)
5. Confirm password
6. Click "Sign Up"

⚠️ **Note**: Check your email for verification code if required by Cognito settings.

### 2. Verify User (if email verification required)

If user is not verified, run:
```bash
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id <USER_POOL_ID> \
  --username <EMAIL>
```

### 3. Login
1. Click "Login" (or toggle if on signup page)
2. Enter email and password
3. Click "Login"
4. You should be redirected to dashboard

### 4. Add Readings
1. Select date
2. Enter usage (e.g., 14.5)
3. Click "Add Reading"
4. See chart update with new data

### 5. Upload CSV
1. Use `sample-readings.csv` provided in project root
2. Click "Choose File" in CSV Upload section
3. Select the file
4. Click "Upload CSV"
5. See multiple readings added

### 6. Generate Tips
1. Click "Generate Tips" button
2. See energy efficiency suggestions

## 8) (Optional) Custom Domain for Frontend
Use ACM (us-east-1) for a free certificate and Route 53 A/ALIAS record to the CloudFront distribution. Then attach the cert + domain as Alternate Domain Name in CloudFront.

### Create S3 Bucket
```bash
# Replace 'yourname' with your unique identifier
aws s3 mb s3://powerpulse-yourname --region ap-south-1
```

### Configure Static Website Hosting
```bash
aws s3 website s3://powerpulse-yourname \
  --index-document index.html \
  --error-document index.html
```

### Upload Frontend Files
```bash
aws s3 sync frontend/ s3://powerpulse-yourname --acl public-read
```

### Make Bucket Public (Bucket Policy)

Create file `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::powerpulse-yourname/*"
    }
  ]
}
```

Apply policy:
```bash
aws s3api put-bucket-policy \
  --bucket powerpulse-yourname \
  --policy file://bucket-policy.json
```

### Access Your App
```
http://powerpulse-yourname.s3-website.ap-south-1.amazonaws.com
```

## 🔍 Verification Checklist

- [ ] Lambda functions deployed successfully
- [ ] DynamoDB tables created (Readings-dev, Users-dev)
- [ ] API Gateway endpoints accessible
- [ ] Cognito User Pool configured
- [ ] Frontend config.js updated
- [ ] User can sign up and login
- [ ] Dashboard displays correctly
- [ ] Can add readings
- [ ] Chart displays data
- [ ] CSV upload works
- [ ] Tips generation works

## 🐛 Common Issues & Solutions

### Issue 1: "Unauthorized" Error on API Calls

**Cause**: Cognito authorizer not configured correctly

**Solution**:
1. Verify Cognito ARN in `serverless.yml` is correct
2. Ensure all 3 endpoints have the same authorizer ARN
3. Redeploy: `serverless deploy`

### Issue 2: CORS Error

**Cause**: Missing CORS headers

**Solution**:
- Ensure `cors: true` in `serverless.yml` for each endpoint
- Check Lambda responses include CORS headers (already implemented)
- Clear browser cache

### Issue 3: User Not Found / Invalid Credentials

**Cause**: User not verified in Cognito

**Solution**:
```bash
# List users
aws cognito-idp list-users --user-pool-id <USER_POOL_ID>

# Confirm user manually
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id <USER_POOL_ID> \
  --username <EMAIL>
```

### Issue 4: DynamoDB Access Denied

**Cause**: IAM role lacks permissions

**Solution**:
- Check `serverless.yml` IAM role statements
- Redeploy: `serverless deploy`
- Verify in AWS IAM Console

### Issue 5: Chart Not Displaying

**Cause**: No data or Chart.js not loaded

**Solution**:
1. Check browser console for errors
2. Verify Chart.js CDN is accessible
3. Add at least one reading
4. Check `fetchAnalysis()` response in Network tab

## 📊 View AWS Resources

### Lambda Functions
```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `powerpulse`)].FunctionName'
```

### DynamoDB Tables
```bash
aws dynamodb list-tables --query 'TableNames[?contains(@, `Readings`) || contains(@, `Users`)]'
```

### API Gateway APIs
```bash
aws apigateway get-rest-apis --query 'items[?name==`powerpulse-dev`].{Name:name, ID:id}'
```

### Cognito User Pools
```bash
aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?Name==`PowerPulse-Users`]'
```

## 🧹 Cleanup (Remove All Resources)

⚠️ **Warning**: This will delete all data and resources

```bash
# Remove serverless stack
serverless remove

# Delete Cognito User Pool
aws cognito-idp delete-user-pool --user-pool-id <USER_POOL_ID>

# Delete S3 bucket (if created)
aws s3 rb s3://powerpulse-yourname --force

# Verify removal
aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `powerpulse`)]'
```

## 📈 Monitor Usage (Avoid Charges)

### Check AWS Free Tier Usage
1. Go to AWS Billing Console
2. Click "Free Tier" in left menu
3. Monitor:
   - Lambda: 1M requests/month free
   - DynamoDB: 25GB storage, 25 read/write units
   - API Gateway: 1M requests/month free

### Set Up Billing Alerts
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name powerpulse-billing-alert \
  --alarm-description "Alert when estimated charges exceed $5" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

## 🎉 Success!

Your PowerPulse application is now deployed and running on AWS!

**Next Steps:**
- Add more readings to see trends
- Share with friends for demo
- Consider enhancements from README

**For Questions:**
- Check CloudWatch Logs: `serverless logs -f <function-name>`
- Review AWS documentation
- Check troubleshooting section

---

Happy Energy Tracking! ⚡

