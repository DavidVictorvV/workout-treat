const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { parse, format, startOfDay, endOfDay } = require('date-fns');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;
    
    const { startDate, endDate } = event.queryStringParameters || {};

    const db = getFirestore();
    const workouts = [];
    let totalPointsEarned = 0;
    const uniqueWorkoutTypes = new Set();
    const activeDates = new Set();

    // Try individual workout history first (new structure)
    let individualHistoryData = [];
    try {
      let query = db.collection('users').doc(userId).collection('workout_history');

      if (startDate && endDate) {
        const start = format(startOfDay(parse(startDate, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');
        const end = format(endOfDay(parse(endDate, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');
        
        query = query.where('date', '>=', start).where('date', '<=', end);
      }

      const historySnapshot = await query.orderBy('completedAt', 'desc').get();
      
      if (historySnapshot && historySnapshot.docs && historySnapshot.docs.length > 0) {
        console.log(`Found ${historySnapshot.docs.length} workouts in individual history for stats`);
        
        for (const doc of historySnapshot.docs) {
          const historyData = doc.data();
          
          individualHistoryData.push({
            id: historyData.workoutId || doc.id,
            workoutName: historyData.workoutName || 'Unknown Workout',
            workoutIcon: historyData.workoutIcon || '💪',
            category: historyData.category || 'unknown',
            pointsEarned: historyData.pointsEarned || 0,
            completedAt: historyData.completedAt,
            date: historyData.date
          });

          totalPointsEarned += historyData.pointsEarned || 0;
          uniqueWorkoutTypes.add(historyData.workoutId);
          activeDates.add(historyData.date);
        }
      }
    } catch (error) {
      console.log('Individual workout history query failed:', error.message);
    }

    // If no individual history, try daily summaries
    if (individualHistoryData.length === 0) {
      try {
        let query = db.collection('users').doc(userId).collection('daily_workouts');

        if (startDate && endDate) {
          const start = startDate;
          const end = endDate;
          query = query.where(db.FieldPath.documentId(), '>=', start).where(db.FieldPath.documentId(), '<=', end);
        }

        const dailySnapshot = await query.orderBy(db.FieldPath.documentId(), 'desc').get();
        
        if (dailySnapshot && dailySnapshot.docs && dailySnapshot.docs.length > 0) {
          console.log(`Found ${dailySnapshot.docs.length} daily summaries for stats`);
          
          for (const doc of dailySnapshot.docs) {
            const dailyData = doc.data();
            
            if (!dailyData || !dailyData.workouts || !Array.isArray(dailyData.workouts) || !dailyData.workoutDetails) {
              continue;
            }
            
            for (const workoutId of dailyData.workouts) {
              const workoutDetail = dailyData.workoutDetails[workoutId];
              if (!workoutDetail) continue;
              
              individualHistoryData.push({
                id: workoutId,
                workoutName: workoutDetail.name || 'Unknown Workout',
                workoutIcon: workoutDetail.icon || '💪',
                category: workoutDetail.category || 'unknown',
                pointsEarned: workoutDetail.points || 0,
                completedAt: workoutDetail.completedAt || dailyData.lastCompletedAt,
                date: dailyData.date || doc.id
              });

              totalPointsEarned += workoutDetail.points || 0;
              uniqueWorkoutTypes.add(workoutId);
              activeDates.add(dailyData.date || doc.id);
            }
          }
        }
      } catch (error) {
        console.log('Daily workouts query failed:', error.message);
      }
    }

    // If still no data, try old global structure
    if (individualHistoryData.length === 0) {
      try {
        let query = db.collection('workout_history').where('userId', '==', userId);

        if (startDate && endDate) {
          const start = format(startOfDay(parse(startDate, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');
          const end = format(endOfDay(parse(endDate, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');
          
          query = query.where('date', '>=', start).where('date', '<=', end);
        }

        const historySnapshot = await query.orderBy('completedAt', 'desc').get();
        
        if (historySnapshot && historySnapshot.docs && historySnapshot.docs.length > 0) {
          console.log(`Found ${historySnapshot.docs.length} workouts in old global structure for stats`);
          
          for (const doc of historySnapshot.docs) {
            const historyData = doc.data();
            
            const workoutDoc = await db.collection('workouts').doc(historyData.workoutId).get();
            const workoutData = workoutDoc.data();
            
            individualHistoryData.push({
              id: doc.id,
              workoutName: workoutData?.name || historyData.workoutName || 'Unknown Workout',
              workoutIcon: workoutData?.icon || historyData.workoutIcon || '💪',
              category: workoutData?.category || historyData.category || 'unknown',
              pointsEarned: historyData.pointsEarned || 0,
              completedAt: historyData.completedAt,
              date: historyData.date
            });

            totalPointsEarned += historyData.pointsEarned || 0;
            uniqueWorkoutTypes.add(historyData.workoutId);
            activeDates.add(historyData.date);
          }
        }
      } catch (error) {
        console.log('Old workout_history query failed:', error.message);
      }
    }

    // Use the collected data
    workouts.push(...individualHistoryData);

    return createResponse(200, {
      workouts,
      summary: {
        totalWorkouts: workouts.length,
        pointsEarned: totalPointsEarned,
        uniqueWorkoutTypes: uniqueWorkoutTypes.size,
        activeDays: activeDates.size
      }
    });

  } catch (error) {
    console.error('Stats workouts error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};