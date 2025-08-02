# Workout Treats Backend API - Endpoint Mapping

## Netlify Functions to API Endpoint Mapping

Your required API endpoints map to these Netlify functions:

### Authentication & User Profile

| Required Endpoint | Netlify Function | Method |
|-------------------|------------------|--------|
| `POST /api/auth/login` | `/.netlify/functions/login` | POST |
| `GET /api/auth/profile` | `/.netlify/functions/auth-profile` | GET |
| `PUT /api/auth/profile` | `/.netlify/functions/auth-profile` | PUT |

### Points & Streaks

| Required Endpoint | Netlify Function | Method |
|-------------------|------------------|--------|
| `GET /api/user/points` | `/.netlify/functions/auth-profile` | GET |
| `POST /api/user/points/add` | `/.netlify/functions/workouts-complete` | POST |
| `GET /api/user/streak` | `/.netlify/functions/auth-profile` | GET |

### Workouts

| Required Endpoint | Netlify Function | Method |
|-------------------|------------------|--------|
| `GET /api/workouts` | `/.netlify/functions/workouts` | GET |
| `POST /api/workouts/complete` | `/.netlify/functions/workouts-complete` | POST |
| `GET /api/workouts/history` | `/.netlify/functions/workouts-history` | GET |
| `GET /api/workouts/stats` | `/.netlify/functions/stats-workouts` | GET |

### Store & Purchases

| Required Endpoint | Netlify Function | Method |
|-------------------|------------------|--------|
| `GET /api/store/items` | `/.netlify/functions/store-items` | GET |
| `POST /api/store/purchase` | `/.netlify/functions/store-purchase` | POST |
| `GET /api/store/purchases` | `/.netlify/functions/store-purchases` | GET |

### Statistics

| Required Endpoint | Netlify Function | Method |
|-------------------|------------------|--------|
| `GET /api/stats/overview` | `/.netlify/functions/stats-overview` | GET |
| `GET /api/stats/workouts` | `/.netlify/functions/stats-workouts` | GET |
| `GET /api/stats/charts` | `/.netlify/functions/stats-charts` | GET |

## Environment Variables Required

Add these environment variables to your Netlify site:

```
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_SERVICE_ACCOUNT_KEY=your_firebase_service_account_json
FIREBASE_DATABASE_URL=your_firebase_database_url
```

## Authentication

All endpoints except `/workouts` and `/store-items` require authentication.

Include the Firebase ID token in the Authorization header:
```
Authorization: Bearer {firebase_id_token}
```

## Security Features Implemented

- Rate limiting (60 requests per minute per IP)
- Input validation and sanitization
- Content-Type validation
- CORS protection
- XSS protection headers
- SQL injection prevention
- Firebase token verification
- User data isolation

## Database Collections

The following Firestore collections are created:

- `users` - User profiles with points and streaks
- `workouts` - Master workout data (seeded automatically)
- `workout_history` - User workout completion records
- `store_items` - Store items (seeded automatically)
- `purchases` - User purchase records

## Sample API Calls

### Login
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Get Profile
```bash
curl -X GET https://your-site.netlify.app/.netlify/functions/auth-profile \
  -H "Authorization: Bearer {firebase_token}"
```

### Complete Workout
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/workouts-complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {firebase_token}" \
  -d '{"workoutId": "workout_1"}'
```

### Purchase Item
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/store-purchase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {firebase_token}" \
  -d '{"itemId": "item_1"}'
```

## Response Formats

All endpoints return JSON with consistent error handling:

### Success Response
```json
{
  "data": {...},
  "success": true
}
```

### Error Response
```json
{
  "error": "Error message"
}
```

## Installation & Deployment

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in Netlify dashboard

3. Deploy to Netlify (auto-deploys from git)

4. Functions will be available at:
`https://your-site.netlify.app/.netlify/functions/{function-name}`