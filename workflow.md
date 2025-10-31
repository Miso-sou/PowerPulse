## PowerPulse Website Workflow (End-to-End)

This document explains the complete flow of PowerPulse from a user’s first visit through backend processing and AWS infrastructure. It also details what each backend file and the `serverless.yml` do, why specific AWS services are used, and how requests travel through the system.

### What PowerPulse Is
- Personalized energy analytics web app: log daily usage, visualize trends, and get rule‑based plus AI‑enhanced insights.
- Frontend is a static website (HTML/CSS/JS). Backend is serverless (AWS Lambda behind API Gateway). Data is stored in DynamoDB. Auth is Amazon Cognito. Optional AI uses Hugging Face Inference Providers.

---

## 1) User Journey (From the User’s Perspective)

1. Visit the site
   - User opens `frontend/index.html` (via S3/CloudFront in production or locally).
   - Sees a login/sign‑up page with Bootstrap styling.

2. Sign up or log in
   - Sign up: enters email/password. A verification step may occur depending on Cognito settings.
   - Log in: Cognito returns an ID token (JWT). The app stores:
     - `userId` = Cognito subject (`sub`) claim
     - `idToken` = JWT used in the `Authorization: Bearer <ID_TOKEN>` header for all API calls

3. Redirect to dashboard
   - On success, user lands on `frontend/dashboard.html`.
   - The page loads charts, profile section, CSV upload, and AI insights section.

4. Create profile (once)
   - In the Profile card, the user sets `location`, `homeType`, and selects appliances with star ratings.
   - The profile is saved via `POST /profile` and used to personalize insights.

5. Add daily readings
   - Enter a date (YYYY‑MM‑DD) and a kWh value, click “Add Reading”.
   - Or upload CSV with `date,usage` pairs to add many at once.

6. View trends
   - The app calls `GET /getAnalysis?userId=...` to compute average, max, min and returns data for the Chart.js graph.

7. Generate insights (optional AI)
   - Click “Generate Insights” to call `POST /insights?userId=...`.
   - App returns rule‑based insights immediately and, if enabled, augments with AI‑generated insights (from Hugging Face) with caching and rate limiting.

8. Log out
   - “Logout” clears local storage and signs out of Cognito.

Key UX guarantees
- All API calls include the Cognito ID token for authentication.
- CORS is enabled so the browser can call API Gateway directly.

---

## 2) Frontend Flow (Files and Responsibilities)

- `frontend/index.html`: Auth page (Login/Signup/Verify). Loads Cognito SDK and app scripts.
- `frontend/dashboard.html`: Main app (add reading, CSV upload, profile, chart, insights).
- `frontend/js/config.js`: Stores AWS config (region, userPoolId, clientId, `apiGatewayUrl`). Update this after deploy.
- `frontend/js/auth.js`:
  - Initializes Cognito (`CognitoUserPool`)
  - Handles signup, verification, login, logout
  - On login success, stores `userId` and `idToken`, navigates to dashboard
- `frontend/js/dashboard.js`:
  - Guard: redirects to login if token is missing
  - Add Reading → `POST /addReading`
  - Fetch Analysis → `GET /getAnalysis`
  - CSV Upload → `POST /uploadCSV`
  - Profile CRUD → `GET/POST /profile`
  - Generate Insights → `POST /insights`
  - Renders Chart.js line chart and insight cards
- `frontend/css/styles.css`: UI styling for auth, dashboard, cards, messages.

Network headers from the browser
- `Authorization: Bearer <ID_TOKEN>` (Cognito ID token)
- `Content-Type: application/json` where relevant

---

## 3) Backend Flow (AWS API Gateway → Lambda → DynamoDB)

High‑level request path
- Browser → API Gateway (Cognito authorizer checks JWT) → Lambda function → DynamoDB (and optional external APIs like Hugging Face, OpenWeather) → Response to browser.

Primary endpoints (from `serverless.yml`)
- `POST /addReading` → `backend/addReading.handler`
- `GET  /getAnalysis` → `backend/getAnalysis.handler`
- `POST /uploadCSV` → `backend/csvUpload.handler`
- `GET/POST/DELETE /profile` → `backend/userProfile.handler`
- `GET/POST /insights` → `backend/generateInsights.handler` (AI + rule‑based)

Data storage (DynamoDB tables)
- `Readings-{stage}`: daily usage by date per user
- `UserProfile-{stage}`: profile (location, home type, appliances + star ratings)
- `Insights-{stage}`: stored insights with TTL (history)
- `InsightsCache-{stage}`: short‑term cache of AI results for identical requests
- `RateLimits-{stage}`: per‑user token bucket state

---

## 4) Backend Files Explained

- `backend/addReading.js`
  - Validates auth header and payload (`userId`, `date`, `usage >= 0`).
  - Writes one item to `Readings` table with timestamp.
  - Returns 201 on success.

- `backend/getAnalysis.js`
  - Validates auth and `userId` query param.
  - Queries all readings for the user and computes `average`, `max`, `min`.
  - Returns readings sorted by date plus a few mock tips (non‑AI) for baseline guidance.

- `backend/csvUpload.js`
  - Validates auth and request body containing `userId` and `readings[]`.
  - Batch inserts valid rows into `Readings`.
  - Returns count of inserted records.

- `backend/userProfile.js`
  - Unified handler for Profile CRUD with CORS preflight:
    - `GET /profile?userId=...`: fetch profile from `UserProfile`.
    - `POST /profile`: create/update `{ location, homeType, appliances }`.
    - `DELETE /profile?userId=...`: delete profile.

- `backend/generateInsights.js`
  - End‑to‑end insight generation pipeline:
    1) Validates `userId` and handles CORS preflight.
    2) Loads `UserProfile` and last N (default 30) `Readings`.
    3) Builds a request hash (last 7 readings + profile + model + date bucket) for cache keying.
    4) Enforces per‑user rate limits via `RateLimits` table (1 req/15s; max 4/min). If limited, returns cached/latest insights when available.
    5) Computes appliance consumption estimates using `backend/data/applianceProfiles.json`.
    6) Optionally fetches weather (OpenWeather) if location provided.
    7) Generates rule‑based insights (spikes, weekly trend, cost estimate, weather impacts, appliance hints).
    8) If `USE_AI=true` and sufficient data, calls Hugging Face v1 Chat Completions with the context to generate 3–5 short AI insights, merges with rule‑based, and writes to `InsightsCache` and `Insights`.
    9) Responds with combined insights and helpful metadata (type, cache, readingsCount, weather, applianceEsimates).

Supporting data
- `backend/data/applianceProfiles.json`: catalog with typical daily kWh by star rating for common appliances, used for estimates and personalized tips.

---

## 5) serverless.yml (What It Defines)

- Service & provider
  - `service: powerpulse`, `frameworkVersion: '4'`, runtime `nodejs20.x`, region, and stage.
  - `environment`: exports DynamoDB table names and feature flags to Lambdas (e.g., `USE_AI`, `AI_MODEL`, API keys).

- IAM role statements
  - Grants Lambdas least‑privilege access to only the DynamoDB tables this app needs and CloudWatch Logs.

- Functions and HTTP events
  - Maps handlers to HTTP paths/methods.
  - Enables CORS (`cors: true`).
  - Protects each endpoint with a Cognito User Pool Authorizer (supply your User Pool ARN).

- Custom + Plugins
  - `serverless-s3-sync` to upload the frontend to a private S3 bucket.
  - `custom.frontendBucketName` used for S3 and CloudFront resources.

- Resources (CloudFormation)
  - DynamoDB tables: `Readings`, `Users`, `UserProfile`, `Insights`, `InsightsCache`, `RateLimits` with keys, billing mode (on‑demand), and TTL where applicable.
  - S3 Bucket for frontend, blocked public access.
  - CloudFront OAI and Bucket Policy to allow CloudFront to read from S3.
  - CloudFront Distribution for HTTPS CDN delivery of the frontend (default root `index.html`).
  - Useful Outputs: bucket name, CloudFront domain, etc.

---

## 6) AWS Services Used and Why

- **Amazon Cognito**: User authentication and secure ID tokens, avoids custom auth.
- **Amazon API Gateway (REST)**: Public HTTPS API with built‑in Cognito authorizer and CORS.
- **AWS Lambda**: Pay‑per‑use backend compute that scales automatically and has strong free tier.
- **Amazon DynamoDB**: Serverless NoSQL for user‑keyed data (fast, cost‑efficient, TTL support).
- **Amazon S3 + CloudFront**: Static hosting with CDN, HTTPS, and private S3 via CloudFront OAI.
- **Amazon CloudWatch Logs**: Centralized logs for each Lambda.
- **Hugging Face Inference Providers (external)**: Zero‑cost AI insights via v1 Chat Completions API.
- **OpenWeather (external, optional)**: Weather context for insights.

---

## 7) Request Lifecycles (Step‑by‑Step)

Add Reading (`POST /addReading`)
1) Browser sends JSON `{ userId, date, usage }` with `Authorization: Bearer <ID_TOKEN>`.
2) API Gateway validates token via Cognito.
3) Lambda writes item to `Readings` and returns 201.
4) Frontend refreshes stats/graph.

Get Analysis (`GET /getAnalysis?userId=...`)
1) API Gateway checks token.
2) Lambda queries `Readings` by user, computes avg/max/min, sorts readings.
3) Returns computed stats and data points for the chart.

CSV Upload (`POST /uploadCSV`)
1) API Gateway checks token.
2) Lambda validates and batch writes to `Readings`.
3) Returns number of rows inserted.

Profile (`GET/POST/DELETE /profile`)
1) API Gateway checks token.
2) Lambda performs CRUD on `UserProfile` for the requesting user.

Generate Insights (`POST /insights?userId=...`)
1) API Gateway checks token.
2) Lambda fetches profile + readings; enforces rate limits using `RateLimits`.
3) Checks `InsightsCache` using request hash; if ready → return cached.
4) Generates rule‑based insights; if `USE_AI=true`, calls Hugging Face; stores to `Insights` and sets cache to `ready`.
5) Returns combined insights and metadata.

---

## 8) Security, Cost, and Performance

- **Security**
  - Cognito authorizer guards every endpoint; Lambdas also perform simple header checks.
  - IAM policy is scoped to exact DynamoDB tables; S3 is private behind CloudFront OAI.
  - CORS is enabled and responses include appropriate headers.

- **Cost Controls**
  - Fully serverless (pay‑per‑use). DynamoDB on‑demand billing. No idle cost.
  - AI calls cached in `InsightsCache` (~2 minutes). Rate limiting reduces duplicate AI calls.

- **Performance**
  - Fast read/write with DynamoDB. CloudFront CDN for frontend.
  - HF API may have a cold start on first call (20–30s). Subsequent requests are faster.

---

## 9) Configuration You Must Update

- `frontend/js/config.js`:
  - `region`, `userPoolId`, `clientId`, `apiGatewayUrl`

- `serverless.yml`:
  - Cognito authorizer ARN for your User Pool on all functions
  - Optional env vars: `HUGGINGFACE_API_KEY`, `OPENWEATHER_API_KEY`, `USE_AI`, `AI_MODEL`

---

## 10) Deploy, Host, and Test

Deploy backend and infra
```bash
npx serverless deploy --stage dev
```

Host frontend
- Easiest: use built‑in S3 + CloudFront from this stack (via `serverless-s3-sync`).
- Or run locally: `npx http-server frontend -p 8000` then open `http://localhost:8000`.

Test flow
1) Sign up and verify (if required), then log in
2) Save profile
3) Add readings or upload CSV
4) View chart and stats
5) Generate insights (enable AI via env vars if desired)

---

## 11) Quick Map of Files

- Frontend: `frontend/index.html`, `frontend/dashboard.html`, `frontend/js/{config,auth,dashboard}.js`, `frontend/css/styles.css`
- Backend: `backend/{addReading,getAnalysis,csvUpload,userProfile,generateInsights}.js`, `backend/data/applianceProfiles.json`
- Infra: `serverless.yml`
- Guides: `README.md`, `DEPLOYMENT_GUIDE.md`, `HUGGINGFACE_SETUP.md`

---

## 12) Why This Architecture

- Keeps costs near zero at low traffic (great for students/demos).
- Secure by default with Cognito, IAM, and private S3 behind CloudFront.
- Scales automatically without server management.
- Modular: you can swap AI models by changing environment variables.

---

If you need a visual diagram or want this exported as a PDF, let me know.

