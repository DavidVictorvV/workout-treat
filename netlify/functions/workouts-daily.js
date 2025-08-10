const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { workoutTypes } = require('./shared/seed-data');

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

// Get user's current levels for each workout type
const getUserWorkoutLevels = async (db, userId, userFitnessLevel = 1) => {
  try {
    const userProgressRef = db.collection('user_progress').doc(userId);
    const userProgressDoc = await userProgressRef.get();
    
    if (!userProgressDoc.exists) {
      // Initialize new user with all workouts starting at their fitness level
      const startingLevel = Math.min(userFitnessLevel, 10);
      const initialProgress = {};
      workoutTypes.forEach(workout => {
        initialProgress[workout.id] = {
          currentLevel: startingLevel,
          completionsAtCurrentLevel: 0,
          totalCompletions: 0
        };
      });
      
      await userProgressRef.set({
        workoutProgress: initialProgress,
        lastUpdated: new Date().toISOString()
      });
      
      return initialProgress;
    }
    
    return userProgressDoc.data().workoutProgress || {};
  } catch (error) {
    console.error('Error getting user workout levels:', error);
    return {};
  }
};

// Generate daily workout selection (limited to 5 workouts) with enhanced points
const generateDailyWorkouts = (userLevels, userProfile) => {
  const allPossibleWorkouts = [];
  
  // Generate all possible workouts with priorities
  const anywhereWorkouts = workoutTypes.filter(w => w.category === 'anywhere');
  const outdoorWorkouts = workoutTypes.filter(w => w.category === 'outdoor');
  const indoorWorkouts = workoutTypes.filter(w => w.category === 'indoor');
  
  // Add anywhere workouts (highest priority - ensure at least 3)
  anywhereWorkouts.forEach(workoutType => {
    // Adjust starting level based on user's overall fitness level
    const baseStartingLevel = Math.min(userProfile.fitnessLevel || 1, 10);
    const userLevel = userLevels[workoutType.id]?.currentLevel || baseStartingLevel;
    const completionsAtLevel = userLevels[workoutType.id]?.completionsAtCurrentLevel || 0;
    
    // Add current level with enhanced points calculation
    const currentLevelPoints = calculateEnhancedPoints(
      workoutType.basePoints, 
      userLevel, 
      userProfile.fitnessLevel || 1, 
      workoutType.id, 
      userProfile
    );
    allPossibleWorkouts.push({
      id: `${workoutType.id}_level_${userLevel}`,
      workoutTypeId: workoutType.id,
      name: `${workoutType.name}`,
      icon: workoutType.icon,
      category: workoutType.category,
      level: userLevel,
      duration: workoutType.levels[userLevel].duration,
      points: currentLevelPoints,
      description: workoutType.levels[userLevel].reps ? 
        `${workoutType.levels[userLevel].reps} reps` : 
        workoutType.levels[userLevel].distance ? 
        `${workoutType.levels[userLevel].distance}` :
        `Hold for ${workoutType.levels[userLevel].duration}`,
      isCurrentLevel: true,
      isActive: true,
      priority: 1 // Highest priority for anywhere workouts
    });
    
    // Add lower level options (but not too easy - minimum level 1, max 3 levels below current)
    if (userLevel > 1) {
      const minLevel = Math.max(1, userLevel - 3);
      const lowerLevel = Math.max(minLevel, userLevel - 2);
      
      if (lowerLevel < userLevel) {
        const lowerLevelPoints = calculateEnhancedPoints(
          workoutType.basePoints, 
          lowerLevel, 
          userProfile.fitnessLevel || 1, 
          workoutType.id, 
          userProfile
        );
        allPossibleWorkouts.push({
          id: `${workoutType.id}_level_${lowerLevel}`,
          workoutTypeId: workoutType.id,
          name: `${workoutType.name} (Easier)`,
          icon: workoutType.icon,
          category: workoutType.category,
          level: lowerLevel,
          duration: workoutType.levels[lowerLevel].duration,
          points: lowerLevelPoints,
          description: workoutType.levels[lowerLevel].reps ? 
            `${workoutType.levels[lowerLevel].reps} reps` : 
            workoutType.levels[lowerLevel].distance ? 
            `${workoutType.levels[lowerLevel].distance}` :
            `Hold for ${workoutType.levels[lowerLevel].duration}`,
          isCurrentLevel: false,
          isActive: true,
          priority: 2 // Lower priority for easier versions
        });
      }
    }
  });
  
  // Add outdoor workouts
  outdoorWorkouts.forEach(workoutType => {
    const baseStartingLevel = Math.min(userProfile.fitnessLevel || 1, 10);
    const userLevel = userLevels[workoutType.id]?.currentLevel || baseStartingLevel;
    const completionsAtLevel = userLevels[workoutType.id]?.completionsAtCurrentLevel || 0;
    const points = calculateEnhancedPoints(
      workoutType.basePoints, 
      userLevel, 
      userProfile.fitnessLevel || 1, 
      workoutType.id, 
      userProfile
    );
    
    allPossibleWorkouts.push({
      id: `${workoutType.id}_level_${userLevel}`,
      workoutTypeId: workoutType.id,
      name: workoutType.name,
      icon: workoutType.icon,
      category: workoutType.category,
      level: userLevel,
      duration: workoutType.levels[userLevel].duration,
      points: points,
      description: workoutType.levels[userLevel].reps ? 
        `${workoutType.levels[userLevel].reps} reps` : 
        workoutType.levels[userLevel].distance ? 
        `${workoutType.levels[userLevel].distance}` :
        workoutType.levels[userLevel].sets ||
        `Hold for ${workoutType.levels[userLevel].duration}`,
      isCurrentLevel: true,
      isActive: true,
      priority: 3 // Medium priority for outdoor workouts
    });
  });
  
  // Add indoor workouts
  indoorWorkouts.forEach(workoutType => {
    const baseStartingLevel = Math.min(userProfile.fitnessLevel || 1, 10);
    const userLevel = userLevels[workoutType.id]?.currentLevel || baseStartingLevel;
    const completionsAtLevel = userLevels[workoutType.id]?.completionsAtCurrentLevel || 0;
    const points = calculateEnhancedPoints(
      workoutType.basePoints, 
      userLevel, 
      userProfile.fitnessLevel || 1, 
      workoutType.id, 
      userProfile
    );
    
    allPossibleWorkouts.push({
      id: `${workoutType.id}_level_${userLevel}`,
      workoutTypeId: workoutType.id,
      name: workoutType.name,
      icon: workoutType.icon,
      category: workoutType.category,
      level: userLevel,
      duration: workoutType.levels[userLevel].duration,
      points: points,
      description: workoutType.levels[userLevel].reps ? 
        `${workoutType.levels[userLevel].reps} reps` : 
        workoutType.levels[userLevel].distance ? 
        `${workoutType.levels[userLevel].distance}` :
        workoutType.levels[userLevel].sets ||
        `Hold for ${workoutType.levels[userLevel].duration}`,
      isCurrentLevel: true,
      isActive: true,
      priority: 4 // Lower priority for indoor workouts
    });
  });
  
  // Sort by priority and select 5 workouts
  // Ensure at least 3 anywhere workouts
  const anywhereSelected = allPossibleWorkouts
    .filter(w => w.category === 'anywhere')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
  
  // Fill remaining slots with best workouts from all categories
  const remaining = allPossibleWorkouts
    .filter(w => !anywhereSelected.some(selected => selected.id === w.id))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 2);
  
  const dailyWorkouts = [...anywhereSelected, ...remaining];
  
  // Remove priority field from final result
  return dailyWorkouts.map(({ priority, ...workout }) => workout);
};

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;
    const db = getFirestore();
    
    // Get user's workout levels/progress and user profile
    const { getUserProfile } = require('./shared/user-helpers');
    const userProfile = await getUserProfile(userId);
    const userLevels = await getUserWorkoutLevels(db, userId, userProfile.fitnessLevel);
    
    // Generate daily workout selection with enhanced points
    const dailyWorkouts = generateDailyWorkouts(userLevels, userProfile);
    
    return createResponse(200, {
      workouts: dailyWorkouts,
      userProgress: userLevels,
      totalWorkouts: dailyWorkouts.length,
      anywhereWorkouts: dailyWorkouts.filter(w => w.category === 'anywhere').length
    });

  } catch (error) {
    console.error('Daily workouts error:', error);
    return createResponse(500, { error: "Internal server error" });
  }
};