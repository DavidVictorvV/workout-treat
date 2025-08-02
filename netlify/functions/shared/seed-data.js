const workouts = [
  { 
    id: "workout_1", 
    name: "Running or Jogging", 
    icon: "🏃‍♂️", 
    category: "outdoor", 
    duration: "30 min", 
    points: 15,
    isActive: true 
  },
  { 
    id: "workout_2", 
    name: "Cycling", 
    icon: "🚴‍♂️", 
    category: "outdoor", 
    duration: "45 min", 
    points: 15,
    isActive: true 
  },
  { 
    id: "workout_3", 
    name: "Hiking or Trail Running", 
    icon: "🥾", 
    category: "outdoor", 
    duration: "60 min", 
    points: 20,
    isActive: true 
  },
  { 
    id: "workout_4", 
    name: "Outdoor Bootcamp", 
    icon: "🏋️‍♂️", 
    category: "outdoor", 
    duration: "45 min", 
    points: 25,
    isActive: true 
  },
  { 
    id: "workout_5", 
    name: "Calisthenics", 
    icon: "🤸‍♂️", 
    category: "outdoor", 
    duration: "30 min", 
    points: 20,
    isActive: true 
  },
  { 
    id: "workout_6", 
    name: "Rock Climbing", 
    icon: "🧗‍♂️", 
    category: "outdoor", 
    duration: "60 min", 
    points: 30,
    isActive: true 
  },
  { 
    id: "workout_7", 
    name: "Rollerblading", 
    icon: "⛸️", 
    category: "outdoor", 
    duration: "30 min", 
    points: 20,
    isActive: true 
  },
  { 
    id: "workout_8", 
    name: "10 Push-ups", 
    icon: "💪", 
    category: "indoor", 
    duration: "5 min", 
    points: 10,
    isActive: true 
  },
  { 
    id: "workout_9", 
    name: "30 Jumping Jacks", 
    icon: "🤾‍♂️", 
    category: "indoor", 
    duration: "5 min", 
    points: 10,
    isActive: true 
  },
  { 
    id: "workout_10", 
    name: "20 Squats", 
    icon: "🏋️‍♂️", 
    category: "indoor", 
    duration: "5 min", 
    points: 10,
    isActive: true 
  },
  { 
    id: "workout_11", 
    name: "60s Plank Hold", 
    icon: "🏋️‍♀️", 
    category: "indoor", 
    duration: "1 min", 
    points: 15,
    isActive: true 
  }
];

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
  storeItems
};