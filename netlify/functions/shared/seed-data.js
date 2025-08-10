// Workout types with level-based progression system
const workoutTypes = [
  {
    id: "pushups",
    name: "Push-ups",
    icon: "💪",
    category: "anywhere", // Can be done anywhere
    basePoints: 10,
    levels: {
      1: { reps: 5, duration: "3 min" },
      2: { reps: 10, duration: "5 min" },
      3: { reps: 15, duration: "7 min" },
      4: { reps: 20, duration: "8 min" },
      5: { reps: 25, duration: "10 min" },
      6: { reps: 30, duration: "12 min" },
      7: { reps: 35, duration: "13 min" },
      8: { reps: 40, duration: "15 min" },
      9: { reps: 45, duration: "17 min" },
      10: { reps: 50, duration: "20 min" }
    },
    isActive: true
  },
  {
    id: "squats",
    name: "Squats",
    icon: "🏋️‍♂️",
    category: "anywhere",
    basePoints: 12,
    levels: {
      1: { reps: 10, duration: "3 min" },
      2: { reps: 20, duration: "5 min" },
      3: { reps: 30, duration: "7 min" },
      4: { reps: 40, duration: "9 min" },
      5: { reps: 50, duration: "12 min" },
      6: { reps: 60, duration: "14 min" },
      7: { reps: 70, duration: "16 min" },
      8: { reps: 80, duration: "18 min" },
      9: { reps: 90, duration: "20 min" },
      10: { reps: 100, duration: "25 min" }
    },
    isActive: true
  },
  {
    id: "jumpingjacks",
    name: "Jumping Jacks",
    icon: "🤾‍♂️",
    category: "anywhere",
    basePoints: 8,
    levels: {
      1: { reps: 20, duration: "3 min" },
      2: { reps: 40, duration: "5 min" },
      3: { reps: 60, duration: "7 min" },
      4: { reps: 80, duration: "9 min" },
      5: { reps: 100, duration: "12 min" },
      6: { reps: 120, duration: "14 min" },
      7: { reps: 140, duration: "16 min" },
      8: { reps: 160, duration: "18 min" },
      9: { reps: 180, duration: "20 min" },
      10: { reps: 200, duration: "25 min" }
    },
    isActive: true
  },
  {
    id: "plank",
    name: "Plank Hold",
    icon: "🏋️‍♀️",
    category: "anywhere",
    basePoints: 15,
    levels: {
      1: { duration: "30s" },
      2: { duration: "45s" },
      3: { duration: "60s" },
      4: { duration: "90s" },
      5: { duration: "2 min" },
      6: { duration: "2.5 min" },
      7: { duration: "3 min" },
      8: { duration: "4 min" },
      9: { duration: "5 min" },
      10: { duration: "6 min" }
    },
    isActive: true
  },
  {
    id: "burpees",
    name: "Burpees",
    icon: "🤸‍♂️",
    category: "anywhere",
    basePoints: 20,
    levels: {
      1: { reps: 3, duration: "3 min" },
      2: { reps: 5, duration: "5 min" },
      3: { reps: 8, duration: "7 min" },
      4: { reps: 10, duration: "9 min" },
      5: { reps: 12, duration: "12 min" },
      6: { reps: 15, duration: "14 min" },
      7: { reps: 18, duration: "16 min" },
      8: { reps: 20, duration: "18 min" },
      9: { reps: 25, duration: "20 min" },
      10: { reps: 30, duration: "25 min" }
    },
    isActive: true
  },
  {
    id: "running",
    name: "Running or Jogging",
    icon: "🏃‍♂️",
    category: "outdoor",
    basePoints: 18,
    levels: {
      1: { distance: "0.5 km", duration: "10 min" },
      2: { distance: "1 km", duration: "15 min" },
      3: { distance: "1.5 km", duration: "20 min" },
      4: { distance: "2 km", duration: "25 min" },
      5: { distance: "3 km", duration: "30 min" },
      6: { distance: "4 km", duration: "35 min" },
      7: { distance: "5 km", duration: "40 min" },
      8: { distance: "6 km", duration: "45 min" },
      9: { distance: "7 km", duration: "50 min" },
      10: { distance: "10 km", duration: "60 min" }
    },
    isActive: true
  },
  {
    id: "cycling",
    name: "Cycling",
    icon: "🚴‍♂️",
    category: "outdoor",
    basePoints: 16,
    levels: {
      1: { distance: "2 km", duration: "15 min" },
      2: { distance: "5 km", duration: "20 min" },
      3: { distance: "8 km", duration: "30 min" },
      4: { distance: "12 km", duration: "40 min" },
      5: { distance: "15 km", duration: "45 min" },
      6: { distance: "20 km", duration: "60 min" },
      7: { distance: "25 km", duration: "75 min" },
      8: { distance: "30 km", duration: "90 min" },
      9: { distance: "35 km", duration: "105 min" },
      10: { distance: "50 km", duration: "150 min" }
    },
    isActive: true
  },
  {
    id: "hiking",
    name: "Hiking or Trail Walking",
    icon: "🥾",
    category: "outdoor",
    basePoints: 22,
    levels: {
      1: { distance: "1 km", duration: "20 min" },
      2: { distance: "2 km", duration: "30 min" },
      3: { distance: "3 km", duration: "45 min" },
      4: { distance: "4 km", duration: "60 min" },
      5: { distance: "5 km", duration: "75 min" },
      6: { distance: "6 km", duration: "90 min" },
      7: { distance: "7 km", duration: "105 min" },
      8: { distance: "8 km", duration: "120 min" },
      9: { distance: "10 km", duration: "150 min" },
      10: { distance: "12 km", duration: "180 min" }
    },
    isActive: true
  },
  {
    id: "swimming",
    name: "Swimming",
    icon: "🏊‍♂️",
    category: "indoor",
    basePoints: 25,
    levels: {
      1: { distance: "200m", duration: "15 min" },
      2: { distance: "400m", duration: "20 min" },
      3: { distance: "600m", duration: "25 min" },
      4: { distance: "800m", duration: "30 min" },
      5: { distance: "1000m", duration: "35 min" },
      6: { distance: "1200m", duration: "40 min" },
      7: { distance: "1400m", duration: "45 min" },
      8: { distance: "1600m", duration: "50 min" },
      9: { distance: "1800m", duration: "55 min" },
      10: { distance: "2000m", duration: "60 min" }
    },
    isActive: true
  },
  {
    id: "weightlifting",
    name: "Weight Training",
    icon: "🏋️",
    category: "indoor",
    basePoints: 20,
    levels: {
      1: { sets: "2 sets", duration: "20 min" },
      2: { sets: "3 sets", duration: "25 min" },
      3: { sets: "4 sets", duration: "30 min" },
      4: { sets: "5 sets", duration: "35 min" },
      5: { sets: "6 sets", duration: "40 min" },
      6: { sets: "7 sets", duration: "45 min" },
      7: { sets: "8 sets", duration: "50 min" },
      8: { sets: "9 sets", duration: "55 min" },
      9: { sets: "10 sets", duration: "60 min" },
      10: { sets: "12 sets", duration: "75 min" }
    },
    isActive: true
  }
];

// Legacy workout format for backward compatibility
const workouts = workoutTypes.map(workoutType => ({
  id: workoutType.id,
  name: workoutType.name,
  icon: workoutType.icon,
  category: workoutType.category,
  duration: workoutType.levels[1].duration,
  points: workoutType.basePoints,
  isActive: workoutType.isActive
}));

const storeItems = [
  { 
    id: "item_1", 
    name: "Coca-Cola", 
    description: "Classic 330ml", 
    price: 100, 
    icon: "🥤", 
    category: "drinks",
    isAvailable: true 
  },
  { 
    id: "item_2", 
    name: "Water Bottle", 
    description: "Pure 500ml", 
    price: 50, 
    icon: "💧", 
    category: "drinks",
    isAvailable: true 
  },
  { 
    id: "item_3", 
    name: "Energy Drink", 
    description: "Boost 250ml", 
    price: 80, 
    icon: "⚡", 
    category: "drinks",
    isAvailable: true 
  },
  { 
    id: "item_4", 
    name: "Orange Juice", 
    description: "Fresh 300ml", 
    price: 80, 
    icon: "🍊", 
    category: "drinks",
    isAvailable: true 
  },
  { 
    id: "item_5", 
    name: "Cold Coffee", 
    description: "Iced 350ml", 
    price: 120, 
    icon: "☕", 
    category: "drinks",
    isAvailable: true 
  },
  { 
    id: "item_6", 
    name: "Protein Bar", 
    description: "Chocolate", 
    price: 150, 
    icon: "🍫", 
    category: "all",
    isAvailable: true 
  },
  { 
    id: "item_7", 
    name: "Nuts Mix", 
    description: "Healthy 100g", 
    price: 180, 
    icon: "🥜", 
    category: "all",
    isAvailable: true 
  },
  { 
    id: "item_8", 
    name: "Apple", 
    description: "Fresh & crispy", 
    price: 60, 
    icon: "🍎", 
    category: "all",
    isAvailable: true 
  },
  { 
    id: "item_9", 
    name: "Greek Yogurt", 
    description: "Protein 150g", 
    price: 90, 
    icon: "🥛", 
    category: "all",
    isAvailable: true 
  }
];

module.exports = {
  workouts,
  workoutTypes, // New level-based system
  storeItems
};