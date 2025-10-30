# ⚡ PowerPulse — Personalized Energy Analytics (Serverless)

PowerPulse is a serverless web application to log daily electricity usage, visualize trends, and receive AI‑powered insights. It’s designed to be low‑cost (pay‑per‑use), secure, and easy to deploy on AWS.

## 🔭 Overview
- Log daily readings (manual form or CSV upload)
- View trends and statistics (average, max, min)
- Create a profile (location, home type, appliances + star ratings)
- Rule‑based insights instantly; optional AI‑enhanced insights
- Built‑in rate limiting and short‑term caching to control cost

## 🧰 Tech Stack
- Frontend: HTML, CSS, Bootstrap 5, Chart.js (static site)
- Backend: Node.js on AWS Lambda (Serverless Framework v4)
- Data: DynamoDB tables — Readings, UserProfile, Insights, InsightsCache, RateLimits
- Auth: Amazon Cognito (ID token)
- Hosting: S3 (private) behind CloudFront CDN
- AI: Hugging Face Inference Providers API (v1 chat completions)

## 🧱 AWS Services (and why)
- API Gateway: Secured REST endpoints with Cognito authorizer
- Lambda: Pay‑per‑use compute for all backend functions
- DynamoDB:
  - Readings‑{stage}: daily readings (PK userId, SK date)
  - UserProfile‑{stage}: profile & appliances
  - Insights‑{stage}: stored insights (TTL)
  - InsightsCache‑{stage}: AI cache (~2 minutes TTL)
  - RateLimits‑{stage}: per‑user token bucket
- Cognito: Authentication with ID tokens for API access
- S3 + CloudFront: Static frontend hosting with HTTPS/CDN
- IAM: Least‑privilege roles; CloudFront OAI for S3

## ✨ Features
- Add daily usage; upload CSV (YYYY‑MM‑DD, kWh)
- Trend chart; avg / max / min
- Profile: location, home type, appliances (1–5 star)
- Rule‑based insights: spikes, weekly trend, weather correlation, cost estimate
- AI insights (e.g., google/gemma‑2‑9b‑it via HF v1 chat completions)
- Caching: identical requests served from DynamoDB (~2 minutes)
- Rate limiting: 1 req/15s; max 4/min; on limit we return cached/latest insights

## 📁 Project Structure

```
powerpulse/
├── backend/                    # Lambda functions
│   ├── addReading.js          # Add daily reading
│   ├── getAnalysis.js         # Get usage analysis & AI tips
│   ├── csvUpload.js           # Bulk CSV upload
│   └── package.json           # Backend dependencies
├── frontend/                   # Static web files
│   ├── index.html             # Login/Signup page
│   ├── dashboard.html         # Main dashboard
│   ├── css/
│   │   └── styles.css         # Styling
│   └── js/
│       ├── config.js          # AWS configuration
│       ├── auth.js            # Authentication logic
│       └── dashboard.js       # Dashboard functionality
├── serverless.yml             # Serverless Framework config
└── README.md                  # This file
```

## 🚀 Features

1. **User Authentication**
   - Sign up with email and password
   - Login with AWS Cognito
   - Secure session management

2. **Daily Usage Tracking**
   - Add daily electricity readings (kWh)
   - View historical data

3. **Usage Analytics**
   - Interactive line chart visualization
   - Average, Max, and Min usage statistics
   - Trend analysis over time

4. **AI Energy Tips**
   - Mock AI-powered energy efficiency suggestions
   - Tips based on usage patterns

5. **Bulk CSV Upload**
   - Upload multiple readings at once
   - Format: `date,usage` (one per line)

## 📋 Prerequisites

- Node.js 18.x or higher
- AWS CLI configured with credentials
- Serverless Framework CLI installed globally
- An AWS account (Free Tier eligible)

## 🔧 Setup Instructions

### 1. Install Serverless Framework

```bash
npm install -g serverless
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: ap-south-1 (or your preferred region)
# Default output format: json
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Create AWS Cognito User Pool

**Option A: Via AWS Console**
1. Go to AWS Cognito Console
2. Create a new User Pool
3. Configure:
   - Sign-in option: Email
   - Password policy: Default
   - MFA: Optional
   - App client: Create without secret
4. Note down:
   - User Pool ID (e.g., `ap-south-1_XXXXXXXXX`)
   - App Client ID (e.g., `xxxxxxxxxxxxxxxxxxxx`)

**Option B: Via AWS CLI**
```bash
aws cognito-idp create-user-pool --pool-name PowerPulse-Users --auto-verified-attributes email
aws cognito-idp create-user-pool-client --user-pool-id <YOUR_POOL_ID> --client-name PowerPulseWebClient --no-generate-secret
```

### 5. Update Configuration Files

**Update `serverless.yml`** (lines 47, 58, 69):
```yaml
authorizer:
  type: COGNITO_USER_POOLS
  arn: arn:aws:cognito-idp:<REGION>:<ACCOUNT_ID>:userpool/<YOUR_USER_POOL_ID>
```

**Update `frontend/js/config.js`**:
```javascript
const AWS_CONFIG = {
    region: 'ap-south-1',              // Your AWS region
    userPoolId: 'YOUR_USER_POOL_ID',   // From Cognito
    clientId: 'YOUR_CLIENT_ID',        // From Cognito app client
    apiGatewayUrl: 'YOUR_API_URL'      // From deployment output (see step 6)
};
```

### 6. Deploy to AWS

```bash
serverless deploy
```

**Expected Output:**
```
✔ Service deployed to stack powerpulse-dev (120s)

endpoint: 
  POST - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/addReading
  GET - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/getAnalysis
  POST - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/uploadCSV

functions:
  addReading: powerpulse-dev-addReading
  getAnalysis: powerpulse-dev-getAnalysis
  csvUpload: powerpulse-dev-csvUpload
```

**Copy the base API URL** (e.g., `https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev`) and update `frontend/js/config.js`.

### 7. Run Frontend Locally

Open `frontend/index.html` in your browser, or use a simple HTTP server:

```bash
# Using Python
cd frontend
python -m http.server 8000

# Using Node.js
npx http-server frontend -p 8000
```

Visit: `http://localhost:8000`

### 8. (Optional) Host Frontend on S3

```bash
# Create S3 bucket
aws s3 mb s3://powerpulse-frontend-yourname --region ap-south-1

# Enable static website hosting
aws s3 website s3://powerpulse-frontend-yourname --index-document index.html

# Upload files
aws s3 sync frontend/ s3://powerpulse-frontend-yourname --acl public-read

# Make bucket public (set bucket policy)
```

## 🧪 Testing the Application

### 1. Create a User Account
1. Open the application
2. Click "Sign up"
3. Enter email and password (min 8 characters)
4. Check email for verification code (if required)

### 2. Add Daily Readings
1. Login with your credentials
2. Select date and enter usage in kWh
3. Click "Add Reading"
4. View updated chart and statistics

### 3. Upload CSV File
Create a CSV file (`readings.csv`):
```csv
2025-10-01,12.5
2025-10-02,14.3
2025-10-03,11.8
2025-10-04,15.2
```

Upload via the CSV Upload section.

### 4. Get Energy Tips
Click "Generate Tips" to see AI-powered energy efficiency suggestions.

## 🗄️ DynamoDB Schema

### Readings Table
- **Partition Key**: `userId` (String)
- **Sort Key**: `date` (String, format: YYYY-MM-DD)
- **Attributes**:
  - `usage` (Number) - Energy consumption in kWh
  - `timestamp` (String) - ISO timestamp of record creation

### Users Table
- **Partition Key**: `userId` (String)
- **Attributes**: (Reserved for future use)

## 🔐 API Endpoints

All endpoints require Cognito authentication (`Authorization: Bearer <ID_TOKEN>`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/addReading` | Add a daily reading |
| GET | `/getAnalysis?userId={id}` | Get usage analysis and tips |
| POST | `/uploadCSV` | Upload bulk readings |

### Request/Response Examples

**POST /addReading**
```json
// Request
{
  "userId": "user-123",
  "date": "2025-10-09",
  "usage": 14.7
}

// Response
{
  "message": "Reading added successfully",
  "data": { "userId": "user-123", "date": "2025-10-09", "usage": 14.7 }
}
```

**GET /getAnalysis?userId=user-123**
```json
// Response
{
  "average": 13.5,
  "max": 15.2,
  "min": 11.8,
  "readings": [
    { "userId": "user-123", "date": "2025-10-01", "usage": 12.5 },
    { "userId": "user-123", "date": "2025-10-02", "usage": 14.3 }
  ],
  "tips": [
    "Switch off devices completely when not in use...",
    "Use LED bulbs instead of incandescent lights...",
    "Run washing machines and dishwashers only with full loads..."
  ]
}
```

## 🧹 Cleanup (Remove Resources)

To avoid AWS charges:

```bash
# Remove Lambda functions and API Gateway
serverless remove

# Delete DynamoDB tables (if needed)
aws dynamodb delete-table --table-name Readings-dev
aws dynamodb delete-table --table-name Users-dev

# Delete Cognito User Pool
aws cognito-idp delete-user-pool --user-pool-id <YOUR_POOL_ID>

# Delete S3 bucket (if used)
aws s3 rb s3://powerpulse-frontend-yourname --force
```

## 🐛 Troubleshooting

### CORS Errors
- Ensure API Gateway has CORS enabled in `serverless.yml` (`cors: true`)
- Check that Lambda responses include CORS headers

### Authentication Issues
- Verify Cognito User Pool ID and Client ID in `config.js`
- Check that authorizer ARN is correct in `serverless.yml`
- Ensure user is verified in Cognito console

### DynamoDB Errors
- Verify IAM role has DynamoDB permissions
- Check table names match environment variables
- Ensure partition key and sort key are correct

### Lambda Function Errors
- Check CloudWatch Logs for detailed error messages:
  ```bash
  serverless logs -f addReading
  ```

## 📊 Future Enhancements

- [ ] Integrate OpenAI API for real AI tips
- [ ] Add monthly/yearly reports
- [ ] Email notifications for high usage
- [ ] Comparison with average household usage
- [ ] Mobile responsive improvements
- [ ] Export data as PDF reports

## 📝 License

This project is created for educational purposes as part of a Cloud Computing semester project.

## 👨‍💻 Author

Semester Project - Cloud Computing Course

---

**Note**: This application uses AWS Free Tier services, but please monitor your usage to avoid unexpected charges. Always clean up resources when not in use.
