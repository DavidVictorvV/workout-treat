const { verifyToken, createResponse, handleCORS, checkRateLimit, validateContentType } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { getUserProfile, updateUserProfile, calculateStreak, hasCompletedWorkoutToday } = require('./shared/user-helpers');
const { validateWorkoutId, validateRequestBody, sanitizeInput } = require('./shared/validation');
const { workoutTypes } = require('./shared/seed-data');
const { format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

// Helper function to parse workout ID and extract level information
const parseWorkoutId = (workoutId) => {
  // New format: workoutTypeId_level_N (e.g., "pushups_level_3")
  const levelMatch = workoutId.match(/^(.+)_level_(\d+)$/);
  if (levelMatch) {
    return {
      isLevelBased: true,
      workoutTypeId: levelMatch[1],
      level: parseInt(levelMatch[2], 10),
      originalId: workoutId
    };
  }
  
  // Legacy format: direct workout ID
  return {
    isLevelBased: false,
    workoutTypeId: workoutId,
    level: null,
    originalId: workoutId
  };
};

// Enhanced points calculation system considering user fitness level and variety
const calculateEnhancedPoints = (basePoints, workoutLevel, userFitnessLevel, workoutTypeId, userProfile) => {
  // 1. Base level multiplier (workout difficulty)
  const workoutLevelMultiplier = 0.3 + (workoutLevel * 0.17); // Scales from 0.47 to 2.0
  
  // 2. User fitness level adjustment - rewards doing workouts above your level
  let fitnessLevelMultiplier = 1.0;
  const levelDifference = workoutLevel - userFitnessLevel;
  
  if (levelDifference > 0) {
    // Doing workouts above your level = more points (reward challenge)
    fitnessLevelMultiplier = 1.0 + (levelDifference * 0.2); // +20% per level above
  } else if (levelDifference < 0) {
    // Doing workouts below your level = fewer points (discourage comfort zone)
    fitnessLevelMultiplier = Math.max(0.3, 1.0 + (levelDifference * 0.15)); // -15% per level below, min 30%
  }
  
  // 3. Variety multiplier - encourage workout diversity
  const workoutFrequency = userProfile.workoutFrequency || {};
  const timesCompletedRecently = workoutFrequency[workoutTypeId] || 0;
  
  let varietyMultiplier = 1.0;
  if (timesCompletedRecently >= 1) varietyMultiplier = 0.85; // -15% if done once recently
  if (timesCompletedRecently >= 2) varietyMultiplier = 0.7;  // -30% if done twice recently
  if (timesCompletedRecently >= 3) varietyMultiplier = 0.5;  // -50% if done 3+ times recently
  
  // 4. Same-day repetition penalty (existing logic)
  const userProgress = userProfile.workoutProgress || {};
  const completionsAtLevel = userProgress[workoutTypeId]?.completionsAtCurrentLevel || 0;
  let sameDayMultiplier = 1.0;
  if (completionsAtLevel >= 2) sameDayMultiplier = 0.75;
  if (completionsAtLevel >= 4) sameDayMultiplier = 0.5;
  if (completionsAtLevel >= 6) sameDayMultiplier = 0.25;
  
  const finalPoints = Math.floor(basePoints * workoutLevelMultiplier * fitnessLevelMultiplier * varietyMultiplier * sameDayMultiplier);
  
  // Ensure minimum points (never give 0 points)
  return Math.max(1, finalPoints);
};

// Legacy function for backward compatibility
const calculateLevelPoints = (basePoints, level, repetitionCount = 1) => {
  const levelMultiplier = 0.3 + (level * 0.17);
  let repetitionMultiplier = 1.0;
  if (repetitionCount >= 2) repetitionMultiplier = 0.75;
  if (repetitionCount >= 4) repetitionMultiplier = 0.5;
  if (repetitionCount >= 6) repetitionMultiplier = 0.25;
  return Math.floor(basePoints * levelMultiplier * repetitionMultiplier);
};

// Update workout frequency tracking for variety system
const updateWorkoutFrequency = async (transaction, db, userId, workoutTypeId) => {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await transaction.get(userRef);
  const userData = userDoc.data() || {};
  
  // Get current frequency tracking
  const workoutFrequency = userData.workoutFrequency || {};
  
  // Increment frequency for this workout type
  workoutFrequency[workoutTypeId] = (workoutFrequency[workoutTypeId] || 0) + 1;
  
  // Decay frequency over time (reset weekly)
  const now = new Date();
  const lastReset = userData.frequencyLastReset ? new Date(userData.frequencyLastReset) : new Date(0);
  const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
  
  // Reset frequency tracking weekly (every 7 days)
  if (daysSinceReset >= 7) {
    // Reset all frequencies
    Object.keys(workoutFrequency).forEach(key => {
      workoutFrequency[key] = key === workoutTypeId ? 1 : 0;
    });
    userData.frequencyLastReset = now.toISOString();
  }
  
  // Update user profile with new frequency data
  await transaction.update(userRef, {
    workoutFrequency,
    frequencyLastReset: userData.frequencyLastReset || now.toISOString(),
    updatedAt: now.toISOString()
  });
  
  return workoutFrequency[workoutTypeId];
};

// Update user workout progress and check for level ups
const updateWorkoutProgress = async (transaction, db, userId, workoutInfo, completedAt) => {
  if (!workoutInfo.isLevelBased) return null;
  
  const progressRef = db.collection('user_progress').doc(userId);
  const progressDoc = await transaction.get(progressRef);
  
  let progressData = {
    workoutProgress: {},
    lastUpdated: completedAt
  };
  
  if (progressDoc.exists) {
    progressData = progressDoc.data();
  }
  
  const workoutProgress = progressData.workoutProgress[workoutInfo.workoutTypeId] || {
    currentLevel: 1,
    completionsAtCurrentLevel: 0,
    totalCompletions: 0
  };
  
  // Update progress
  workoutProgress.totalCompletions += 1;
  
  if (workoutInfo.level === workoutProgress.currentLevel) {
    workoutProgress.completionsAtCurrentLevel += 1;
    
    // Check for level up (every 5 completions at current level)
    if (workoutProgress.completionsAtCurrentLevel >= 5 && workoutProgress.currentLevel < 10) {
      workoutProgress.currentLevel += 1;
      workoutProgress.completionsAtCurrentLevel = 0;
    }
  }
  
  progressData.workoutProgress[workoutInfo.workoutTypeId] = workoutProgress;
  progressData.lastUpdated = completedAt;
  
  transaction.set(progressRef, progressData);
  
  return {
    levelUp: workoutInfo.level === workoutProgress.currentLevel - 1 && workoutProgress.completionsAtCurrentLevel === 0,
    newLevel: workoutProgress.currentLevel,
    completionsAtLevel: workoutProgress.completionsAtCurrentLevel
  };
};

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
    
    // Parse workout ID to handle both legacy and new level-based format
    const workoutInfo = parseWorkoutId(workoutId);
    let workout = null;
    
    if (workoutInfo.isLevelBased) {
      // New level-based system
      const workoutType = workoutTypes.find(w => w.id === workoutInfo.workoutTypeId);
      if (!workoutType || !workoutType.isActive || !workoutType.levels[workoutInfo.level]) {
        return createResponse(404, { error: "Workout not found" });
      }
      
      // Get user's current progress for this workout type to calculate points
      const progressRef = db.collection('user_progress').doc(userId);
      const progressDoc = await progressRef.get();
      
      let completionsAtLevel = 1; // Default for first-time completion
      if (progressDoc.exists) {
        const progressData = progressDoc.data();
        const workoutProgress = progressData.workoutProgress?.[workoutInfo.workoutTypeId];
        if (workoutProgress && workoutProgress.currentLevel === workoutInfo.level) {
          completionsAtLevel = workoutProgress.completionsAtCurrentLevel + 1;
        }
      }
      
      // Get user profile for enhanced points calculation
      const userProfile = await getUserProfile(userId);
      
      const calculatedPoints = calculateEnhancedPoints(
        workoutType.basePoints, 
        workoutInfo.level, 
        userProfile.fitnessLevel || 1, 
        workoutInfo.workoutTypeId, 
        userProfile
      );
      
      workout = {
        name: `${workoutType.name} (Level ${workoutInfo.level})`,
        icon: workoutType.icon,
        category: workoutType.category,
        points: calculatedPoints,
        level: workoutInfo.level,
        workoutTypeId: workoutType.id,
        duration: workoutType.levels[workoutInfo.level].duration,
        description: workoutType.levels[workoutInfo.level].reps ? 
          `${workoutType.levels[workoutInfo.level].reps} reps` : 
          workoutType.levels[workoutInfo.level].distance ? 
          `${workoutType.levels[workoutInfo.level].distance}` :
          `Hold for ${workoutType.levels[workoutInfo.level].duration}`,
        isActive: true
      };
    } else {
      // Legacy system - look up in Firestore
      const workoutDoc = await db.collection('workouts').doc(workoutId).get();
      if (!workoutDoc.exists) {
        return createResponse(404, { error: "Workout not found" });
      }
      
      workout = workoutDoc.data();
      if (workout.isActive === false) {
        return createResponse(404, { error: "Workout is inactive" });
      }
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
      // For level-based workouts, check if this specific level was completed
      // For legacy workouts, use original logic
      const checkId = workoutInfo.isLevelBased ? workoutId : workoutId;
      
      // Check if workout already completed today using new structure
      const dailyWorkoutRef = db.collection('users').doc(userId).collection('daily_workouts').doc(dateStr);
      const dailyWorkoutDoc = await transaction.get(dailyWorkoutRef);
      
      if (dailyWorkoutDoc.exists && dailyWorkoutDoc.data().workouts && dailyWorkoutDoc.data().workouts.includes(checkId)) {
        throw new Error("This workout level already completed today");
      }

      // Also check individual workout history for duplicates
      const individualHistoryQuery = db.collection('users').doc(userId).collection('workout_history')
        .where('workoutId', '==', checkId)
        .where('date', '==', dateStr)
        .limit(1);
      
      const individualHistorySnapshot = await individualHistoryQuery.get();
      if (!individualHistorySnapshot.empty) {
        throw new Error("This workout level already completed today");
      }

      // Also check old global structure for backward compatibility
      const oldWorkoutQuery = db.collection('workout_history')
        .where('userId', '==', userId)
        .where('workoutId', '==', checkId)
        .where('date', '==', dateStr)
        .limit(1);
      
      const oldWorkoutSnapshot = await oldWorkoutQuery.get();
      if (!oldWorkoutSnapshot.empty) {
        throw new Error("This workout level already completed today");
      }

      const userProfile = await getUserProfile(userId);
      const streakInfo = await calculateStreak(userId, completedAt);
      
      // Update workout frequency for variety tracking
      await updateWorkoutFrequency(transaction, db, userId, workoutInfo.workoutTypeId);
      
      const newTotalPoints = userProfile.totalPoints + workout.points;

      // Update user workout progress if this is a level-based workout
      const progressUpdate = await updateWorkoutProgress(transaction, db, userId, workoutInfo, completedAt);
      
      // Create individual workout history entry for complete historical record
      const workoutHistoryRef = db.collection('users').doc(userId).collection('workout_history').doc();
      const historyEntry = {
        workoutId: workoutId,
        workoutName: workout.name,
        workoutIcon: workout.icon,
        category: workout.category,
        pointsEarned: workout.points,
        completedAt: completedAt,
        date: dateStr,
        userId: userId
      };
      
      // Add level information for level-based workouts
      if (workoutInfo.isLevelBased) {
        historyEntry.level = workoutInfo.level;
        historyEntry.workoutTypeId = workoutInfo.workoutTypeId;
        historyEntry.description = workout.description;
        if (progressUpdate) {
          historyEntry.levelUp = progressUpdate.levelUp;
          historyEntry.newLevel = progressUpdate.newLevel;
        }
      }
      
      transaction.set(workoutHistoryRef, historyEntry);

      // Update or create daily workout document (for daily summaries and duplicate checking)
      const workoutDetails = {
        name: workout.name,
        icon: workout.icon,
        category: workout.category,
        points: workout.points,
        completedAt: completedAt
      };
      
      // Add level information for level-based workouts
      if (workoutInfo.isLevelBased) {
        workoutDetails.level = workoutInfo.level;
        workoutDetails.workoutTypeId = workoutInfo.workoutTypeId;
        workoutDetails.description = workout.description;
      }
      
      if (dailyWorkoutDoc.exists) {
        // Add workout to existing day
        const dailyData = dailyWorkoutDoc.data();
        transaction.update(dailyWorkoutRef, {
          workouts: [...dailyData.workouts, workoutId],
          totalPoints: dailyData.totalPoints + workout.points,
          lastCompletedAt: completedAt,
          workoutDetails: {
            ...dailyData.workoutDetails,
            [workoutId]: workoutDetails
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
            [workoutId]: workoutDetails
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

      return { newTotalPoints, streakInfo, progressUpdate };
    });

    const { newTotalPoints, streakInfo, progressUpdate } = result;

    const response = {
      success: true,
      pointsEarned: workout.points,
      newTotalPoints,
      streakInfo
    };
    
    // Add level progression info if applicable
    if (progressUpdate && workoutInfo.isLevelBased) {
      response.levelInfo = {
        levelUp: progressUpdate.levelUp,
        currentLevel: progressUpdate.newLevel,
        completionsAtLevel: progressUpdate.completionsAtLevel,
        workoutType: workoutInfo.workoutTypeId
      };
    }
    
    return createResponse(200, response);

  } catch (error) {
    console.error('Complete workout error:', error);
    
    if (error.message.includes('already completed today')) {
      return createResponse(400, { error: error.message });
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