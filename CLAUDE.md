# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Local Development**: `netlify dev` - Runs the Netlify Functions locally for testing
- **Install Dependencies**: `npm install` - Install required Node.js packages

## Architecture Overview

This is a serverless backend for the Workout Treats fitness tracking application, built entirely on Netlify Functions with Firebase as the backend service.

### Core Architecture

- **Runtime**: Node.js serverless functions deployed on Netlify
- **Database**: Firebase Firestore for data persistence
- **Authentication**: Firebase Authentication with JWT token verification
- **API Pattern**: Each function handles a specific endpoint with full CRUD operations

### Directory Structure

- `netlify/functions/` - All serverless function endpoints
- `netlify/functions/shared/` - Shared utilities and middleware
- `API_MAPPING.md` - Complete endpoint documentation and mapping
- `swagger.yaml` - OpenAPI specification

### Key Shared Modules

**firebase-config.js**
- Singleton Firebase Admin SDK initialization
- Handles Firestore and Auth service connections
- Environment variable validation and error handling

**auth-middleware.js**
- JWT token verification using Firebase Auth
- CORS handling with security headers (XSS protection, content security)
- Rate limiting (60 requests/minute per IP)
- Content-Type validation
- Standardized JSON response formatting

**user-helpers.js**
- User profile management and CRUD operations
- Streak calculation and points management
- User data validation and sanitization

**validation.js**
- Input sanitization and validation utilities
- Email, display name, and ID format validation
- XSS protection through script tag removal

**seed-data.js**
- Static workout and store item data
- Auto-seeding functionality for Firestore collections

### Function Categories

**Authentication Functions**
- `google-signin.js` - OAuth Google authentication (creates user profiles for new users)
- `auth-profile.js` - GET/PUT user profile with points and streaks

**Workout Functions**
- `workouts.js` - GET all available workouts (public endpoint)
- `workouts-complete.js` - POST workout completion, points calculation, streak updates
- `workouts-history.js` - GET user's workout history with filtering

**Store Functions**
- `store-items.js` - GET store inventory (public endpoint)
- `store-purchase.js` - POST purchase processing with points deduction
- `store-purchases.js` - GET user purchase history

**Statistics Functions**
- `stats-overview.js` - GET aggregated user statistics
- `stats-workouts.js` - GET workout-specific analytics
- `stats-charts.js` - GET data formatted for chart visualization

### Authentication & Security

**Authentication Method**: Google/Firebase only
- Users sign in with Google on frontend
- Firebase returns ID token which frontend uses for all API calls
- Backend verifies Firebase tokens using Firebase Admin SDK
- User profiles automatically created for new Google sign-ins

**Security Implementation**:
- Rate limiting on all endpoints (configurable per endpoint)
- Firebase ID token verification for protected routes
- Input sanitization and XSS prevention
- CORS configuration with security headers
- Content-Type validation for POST/PUT requests
- User data isolation (all queries scoped to authenticated user)

### Environment Variables Required

```
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_SERVICE_ACCOUNT_KEY=your_firebase_service_account_json
FIREBASE_DATABASE_URL=your_firebase_database_url
```

### Database Schema (Firestore Collections)

- `users` - User profiles with points, streaks, membership data
- `workouts` - Master workout definitions (auto-seeded)
- `workout_history` - User workout completion records
- `store_items` - Store inventory (auto-seeded)
- `purchases` - User purchase transaction records

### API Response Patterns

**Success Response**:
```json
{
  "data": {...},
  "success": true
}
```

**Error Response**:
```json
{
  "error": "Error message"
}
```

### Common Development Patterns

- All functions use the same middleware pattern (CORS, rate limiting, auth)
- Firestore queries are scoped to the authenticated user's ID
- Error handling includes both console logging and user-friendly messages
- Auto-seeding handles empty collections by populating with seed data
- Date handling uses ISO strings with timezone awareness for streak calculations

### Important Development Notes

**ALWAYS UPDATE SWAGGER.YAML**: When making changes to endpoints (adding, removing, or modifying), always update the `swagger.yaml` file to keep the API documentation in sync. This includes:
- Endpoint paths and HTTP methods
- Request/response schemas
- Authentication requirements
- Error responses