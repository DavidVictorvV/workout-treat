const { getFirestore } = require('./firebase-config');
const { startOfDay, isSameDay, parseISO, format } = require('date-fns');

async function getUserProfile(userId) {
  const db = getFirestore();
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) {
    const defaultProfile = {
      id: userId,
      totalPoints: 300,
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      memberSince: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('users').doc(userId).set(defaultProfile);
    return defaultProfile;
  }
  
  return { id: userId, ...userDoc.data() };
}

async function updateUserProfile(userId, updates) {
  const db = getFirestore();
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await db.collection('users').doc(userId).update(updateData);
  return await getUserProfile(userId);
}

async function calculateStreak(userId, completedAt) {
  const db = getFirestore();
  const user = await getUserProfile(userId);
  
  const today = startOfDay(new Date(completedAt));
  const lastWorkoutDate = user.lastWorkoutDate ? startOfDay(new Date(user.lastWorkoutDate)) : null;
  
  let newStreak = 1;
  
  if (lastWorkoutDate) {
    const daysDiff = Math.floor((today - lastWorkoutDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      newStreak = user.currentStreak + 1;
    } else if (daysDiff === 0) {
      newStreak = user.currentStreak;
    } else {
      newStreak = 1;
    }
  }
  
  const newLongestStreak = Math.max(user.longestStreak, newStreak);
  
  return {
    currentStreak: newStreak,
    longestStreak: newLongestStreak,
    isNewRecord: newLongestStreak > user.longestStreak
  };
}

async function hasCompletedWorkoutToday(userId, workoutId, date) {
  const db = getFirestore();
  const dateStr = format(new Date(date), 'yyyy-MM-dd');
  
  const query = await db.collection('workout_history')
    .where('userId', '==', userId)
    .where('workoutId', '==', workoutId)
    .where('date', '==', dateStr)
    .limit(1)
    .get();
    
  return !query.empty;
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  calculateStreak,
  hasCompletedWorkoutToday
};