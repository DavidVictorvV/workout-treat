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
    if (!workoutDoc.exists) {
      return createResponse(404, { error: "Workout not found" });
    }
    
    const workout = workoutDoc.data();
    // Check if workout is active (default to true if isActive field doesn't exist)
    if (workout.isActive === false) {
      return createResponse(404, { error: "Workout is inactive" });
    }
    
    // Validate required workout fields
    if (!workout.name || typeof workout.points !== 'number' || workout.points < 0) {
      console.error('Invalid workout data:', workout);
      return createResponse(500, { error: "Workout data is invalid" });
    }
    const completedAt = new Date().toISOString();
    const dateStr = format(new Date(completedAt), 'yyyy-MM-dd');

    // Use a transaction to prevent race conditions
    const result = await db.runTransaction(async (transaction) => {
      // Check if workout already completed today using new structure
      const dailyWorkoutRef = db.collection('users').doc(userId).collection('daily_workouts').doc(dateStr);
      const dailyWorkoutDoc = await transaction.get(dailyWorkoutRef);
      
      if (dailyWorkoutDoc.exists && dailyWorkoutDoc.data().workouts && dailyWorkoutDoc.data().workouts.includes(workoutId)) {
        throw new Error("Workout already completed today");
      }

      // Also check individual workout history for duplicates
      const individualHistoryQuery = db.collection('users').doc(userId).collection('workout_history')
        .where('workoutId', '==', workoutId)
        .where('date', '==', dateStr)
        .limit(1);
      
      const individualHistorySnapshot = await individualHistoryQuery.get();
      if (!individualHistorySnapshot.empty) {
        throw new Error("Workout already completed today");
      }

      // Also check old global structure for backward compatibility
      const oldWorkoutQuery = db.collection('workout_history')
        .where('userId', '==', userId)
        .where('workoutId', '==', workoutId)
        .where('date', '==', dateStr)
        .limit(1);
      
      const oldWorkoutSnapshot = await oldWorkoutQuery.get();
      if (!oldWorkoutSnapshot.empty) {
        throw new Error("Workout already completed today");
      }

      const userProfile = await getUserProfile(userId);
      const streakInfo = await calculateStreak(userId, completedAt);
      
      const newTotalPoints = userProfile.totalPoints + workout.points;

      // Create individual workout history entry for complete historical record
      const workoutHistoryRef = db.collection('users').doc(userId).collection('workout_history').doc();
      transaction.set(workoutHistoryRef, {
        workoutId: workoutId,
        workoutName: workout.name,
        workoutIcon: workout.icon,
        category: workout.category,
        pointsEarned: workout.points,
        completedAt: completedAt,
        date: dateStr,
        userId: userId
      });

      // Update or create daily workout document (for daily summaries and duplicate checking)
      if (dailyWorkoutDoc.exists) {
        // Add workout to existing day
        const dailyData = dailyWorkoutDoc.data();
        transaction.update(dailyWorkoutRef, {
          workouts: [...dailyData.workouts, workoutId],
          totalPoints: dailyData.totalPoints + workout.points,
          lastCompletedAt: completedAt,
          workoutDetails: {
            ...dailyData.workoutDetails,
            [workoutId]: {
              name: workout.name,
              icon: workout.icon,
              category: workout.category,
              points: workout.points,
              completedAt: completedAt
            }
          }
        });
      } else {
        // Create new daily workout document
        transaction.set(dailyWorkoutRef, {
          date: dateStr,
          workouts: [workoutId],
          totalPoints: workout.points,
          firstCompletedAt: completedAt,
          lastCompletedAt: completedAt,
          workoutDetails: {
            [workoutId]: {
              name: workout.name,
              icon: workout.icon,
              category: workout.category,
              points: workout.points,
              completedAt: completedAt
            }
          }
        });
      }

      // Update user profile
      transaction.update(db.collection('users').doc(userId), {
        totalPoints: newTotalPoints,
        currentStreak: streakInfo.currentStreak,
        longestStreak: streakInfo.longestStreak,
        lastWorkoutDate: completedAt
      });

      return { newTotalPoints, streakInfo };
    });

    const { newTotalPoints, streakInfo } = result;

    return createResponse(200, {
      success: true,
      pointsEarned: workout.points,
      newTotalPoints,
      streakInfo
    });

  } catch (error) {
    console.error('Complete workout error:', error);
    
    if (error.message === 'Workout already completed today') {
      return createResponse(400, { error: "Workout already completed today" });
    }
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    if (error.message.includes('Database') || error.message.includes('Firestore')) {
      return createResponse(503, { error: "Service temporarily unavailable" });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};