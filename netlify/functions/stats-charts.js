const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  parse, 
  format, 
  startOfDay, 
  endOfDay,
  eachDayOfInterval
} = require('date-fns');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;
    
    const { period, startDate, endDate } = event.queryStringParameters || {};

    let start, end;
    const now = new Date();

    if (period === 'thisMonth') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (period === 'lastMonth') {
      const lastMonth = subMonths(now, 1);
      start = startOfMonth(lastMonth);
      end = endOfMonth(lastMonth);
    } else if (startDate && endDate) {
      start = startOfDay(parse(startDate, 'yyyy-MM-dd', new Date()));
      end = endOfDay(parse(endDate, 'yyyy-MM-dd', new Date()));
    } else {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }

    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const db = getFirestore();
    const historySnapshot = await db.collection('workout_history')
      .where('userId', '==', userId)
      .where('date', '>=', startStr)
      .where('date', '<=', endStr)
      .get();

    const workoutsByDate = {};
    const workoutTypesSet = new Set();
    let totalWorkouts = 0;
    let totalPointsEarned = 0;

    for (const doc of historySnapshot.docs) {
      const historyData = doc.data();
      const date = historyData.date;
      
      const workoutDoc = await db.collection('workouts').doc(historyData.workoutId).get();
      const workoutData = workoutDoc.data();
      const workoutName = workoutData?.name || 'Unknown Workout';
      
      if (!workoutsByDate[date]) {
        workoutsByDate[date] = { overall: 0 };
      }
      
      workoutsByDate[date].overall += 1;
      workoutsByDate[date][workoutName] = (workoutsByDate[date][workoutName] || 0) + 1;
      
      workoutTypesSet.add(workoutName);
      totalWorkouts += 1;
      totalPointsEarned += historyData.pointsEarned || 0;
    }

    const allDates = eachDayOfInterval({ start, end });
    const chartData = allDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = workoutsByDate[dateStr] || { overall: 0 };
      
      return {
        date: dateStr,
        ...dayData
      };
    });

    const activeDays = Object.keys(workoutsByDate).length;
    const averagePerDay = activeDays > 0 ? totalWorkouts / activeDays : 0;

    return createResponse(200, {
      chartData,
      workoutTypes: Array.from(workoutTypesSet),
      summary: {
        totalWorkouts,
        activeDays,
        pointsEarned: totalPointsEarned,
        averagePerDay: Math.round(averagePerDay * 100) / 100
      }
    });

  } catch (error) {
    console.error('Stats charts error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};