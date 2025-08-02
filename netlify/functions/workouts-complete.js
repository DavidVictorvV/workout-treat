const { verifyToken, createResponse, handleCORS, checkRateLimit, validateContentType } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { getUserProfile, updateUserProfile, calculateStreak, hasCompletedWorkoutToday } = require('./shared/user-helpers');
const { validateWorkoutId, validateRequestBody, sanitizeInput } = require('./shared/validation');
const { format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  const rateLimitResponse = checkRateLimit(event, 30, 60 * 1000);
  if (rateLimitResponse) return rateLimitResponse;

  const contentTypeResponse = validateContentType(event);
  if (contentTypeResponse) return contentTypeResponse;

  if (event.httpMethod !== "POST") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;
    
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return createResponse(400, { error: "Invalid JSON in request body" });
    }

    const validationErrors = validateRequestBody(requestBody, ['workoutId']);
    if (validationErrors.length > 0) {
      return createResponse(400, { error: validationErrors.join(', ') });
    }

    const workoutId = sanitizeInput(requestBody.workoutId);

    if (!validateWorkoutId(workoutId)) {
      return createResponse(400, { error: "Invalid workout ID format" });
    }

    const db = getFirestore();
    
    const workoutDoc = await db.collection('workouts').doc(workoutId).get();
    if (!workoutDoc.exists || !workoutDoc.data().isActive) {
      return createResponse(404, { error: "Workout not found or inactive" });
    }

    const workout = workoutDoc.data();
    const completedAt = new Date().toISOString();
    const dateStr = format(new Date(completedAt), 'yyyy-MM-dd');

    const alreadyCompleted = await hasCompletedWorkoutToday(userId, workoutId, completedAt);
    if (alreadyCompleted) {
      return createResponse(400, { error: "Workout already completed today" });
    }

    const userProfile = await getUserProfile(userId);
    const streakInfo = await calculateStreak(userId, completedAt);
    
    const historyEntry = {
      id: uuidv4(),
      userId,
      workoutId,
      pointsEarned: workout.points,
      completedAt,
      date: dateStr
    };

    const newTotalPoints = userProfile.totalPoints + workout.points;

    await Promise.all([
      db.collection('workout_history').doc(historyEntry.id).set(historyEntry),
      updateUserProfile(userId, {
        totalPoints: newTotalPoints,
        currentStreak: streakInfo.currentStreak,
        longestStreak: streakInfo.longestStreak,
        lastWorkoutDate: completedAt
      })
    ]);

    return createResponse(200, {
      success: true,
      pointsEarned: workout.points,
      newTotalPoints,
      streakInfo
    });

  } catch (error) {
    console.error('Complete workout error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    if (error.message.includes('Database') || error.message.includes('Firestore')) {
      return createResponse(503, { error: "Service temporarily unavailable" });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};