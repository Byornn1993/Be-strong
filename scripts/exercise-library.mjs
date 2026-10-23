// Bronlijst van de standaardoefeningen. `npm run gen:exercises` maakt hieruit:
//  - src/data/exercises.json (gebundeld in de app, ook offline beschikbaar)
//  - supabase/migrations/20261023000200_standard_exercises.sql
// De UUID's zijn deterministisch (v5 op de naam), zodat app en database dezelfde ids gebruiken.
// Velden: [naam, primaire spiergroep, secundaire spiergroepen, materiaal, type]

export const LIBRARY = [
  // Chest
  ['Bench Press (Barbell)', 'chest', ['triceps', 'shoulders'], 'barbell', 'weight_reps'],
  ['Bench Press (Dumbbell)', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'weight_reps'],
  ['Incline Bench Press (Barbell)', 'chest', ['shoulders', 'triceps'], 'barbell', 'weight_reps'],
  ['Incline Bench Press (Dumbbell)', 'chest', ['shoulders', 'triceps'], 'dumbbell', 'weight_reps'],
  ['Close Grip Bench Press (Barbell)', 'triceps', ['chest'], 'barbell', 'weight_reps'],
  ['Chest Press (Machine)', 'chest', ['triceps', 'shoulders'], 'machine', 'weight_reps'],
  ['Incline Chest Press (Machine)', 'chest', ['shoulders'], 'machine', 'weight_reps'],
  ['Iso-Lateral Chest Press (Machine)', 'chest', ['triceps'], 'machine', 'weight_reps'],
  ['Chest Fly (Dumbbell)', 'chest', [], 'dumbbell', 'weight_reps'],
  ['Chest Fly (Band)', 'chest', [], 'other', 'weight_reps'],
  ['Pec Deck (Machine)', 'chest', [], 'machine', 'weight_reps'],
  ['Cable Crossover', 'chest', ['shoulders'], 'cable', 'weight_reps'],
  ['Push Up', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'bodyweight_reps'],
  ['Dip', 'triceps', ['chest', 'shoulders'], 'bodyweight', 'weighted_bodyweight'],
  ['Assisted Dip (Machine)', 'triceps', ['chest'], 'machine', 'assisted_bodyweight'],

  // Back
  ['Chin Up', 'back', ['biceps'], 'bodyweight', 'weighted_bodyweight'],
  ['Pull Up', 'back', ['biceps'], 'bodyweight', 'weighted_bodyweight'],
  ['Assisted Chin Up (Machine)', 'back', ['biceps'], 'machine', 'assisted_bodyweight'],
  ['Lat Pulldown (Cable)', 'back', ['biceps'], 'cable', 'weight_reps'],
  ['Lat Pulldown (Machine)', 'back', ['biceps'], 'machine', 'weight_reps'],
  ['Seated Row (Cable)', 'back', ['biceps'], 'cable', 'weight_reps'],
  ['Seated Row (Machine)', 'back', ['biceps'], 'machine', 'weight_reps'],
  ['Bent Over Row (Barbell)', 'back', ['biceps'], 'barbell', 'weight_reps'],
  ['Bent Over Row (Dumbbell)', 'back', ['biceps'], 'dumbbell', 'weight_reps'],
  ['Bent Over Row (Band)', 'back', ['biceps'], 'other', 'weight_reps'],
  ['Iso-Lateral Row (Machine)', 'back', ['biceps'], 'machine', 'weight_reps'],
  ['T Bar Row', 'back', ['biceps'], 'plate_loaded', 'weight_reps'],
  ['Deadlift (Barbell)', 'back', ['legs', 'glutes'], 'barbell', 'weight_reps'],
  ['Shrug (Barbell)', 'back', ['shoulders'], 'barbell', 'weight_reps'],
  ['Shrug (Dumbbell)', 'back', ['shoulders'], 'dumbbell', 'weight_reps'],
  ['Shrug (Machine)', 'back', ['shoulders'], 'machine', 'weight_reps'],
  ['Back Extension', 'back', ['glutes'], 'bodyweight', 'weighted_bodyweight'],

  // Shoulders
  ['Overhead Press (Barbell)', 'shoulders', ['triceps'], 'barbell', 'weight_reps'],
  ['Strict Military Press (Barbell)', 'shoulders', ['triceps'], 'barbell', 'weight_reps'],
  ['Shoulder Press (Dumbbell)', 'shoulders', ['triceps'], 'dumbbell', 'weight_reps'],
  ['Shoulder Press (Machine)', 'shoulders', ['triceps'], 'machine', 'weight_reps'],
  ['Lateral Raise (Dumbbell)', 'shoulders', [], 'dumbbell', 'weight_reps'],
  ['Lateral Raise (Cable)', 'shoulders', [], 'cable', 'weight_reps'],
  ['Lateral Raise (Machine)', 'shoulders', [], 'machine', 'weight_reps'],
  ['Front Raise (Dumbbell)', 'shoulders', [], 'dumbbell', 'weight_reps'],
  ['Reverse Fly (Cable)', 'shoulders', ['back'], 'cable', 'weight_reps'],
  ['Reverse Fly (Dumbbell)', 'shoulders', ['back'], 'dumbbell', 'weight_reps'],
  ['Reverse Fly (Machine)', 'shoulders', ['back'], 'machine', 'weight_reps'],
  ['Face Pull (Cable)', 'shoulders', ['back'], 'cable', 'weight_reps'],
  ['Upright Row (Barbell)', 'shoulders', ['back'], 'barbell', 'weight_reps'],
  ['Upright Row (Cable)', 'shoulders', ['back'], 'cable', 'weight_reps'],
  ['Upright Row (Dumbbell)', 'shoulders', ['back'], 'dumbbell', 'weight_reps'],

  // Biceps
  ['Bicep Curl (Barbell)', 'biceps', [], 'barbell', 'weight_reps'],
  ['Bicep Curl (Dumbbell)', 'biceps', [], 'dumbbell', 'weight_reps'],
  ['Bicep Curl (Cable)', 'biceps', [], 'cable', 'weight_reps'],
  ['Bicep Curl (Machine)', 'biceps', [], 'machine', 'weight_reps'],
  ['Hammer Curl (Dumbbell)', 'biceps', [], 'dumbbell', 'weight_reps'],
  ['Hammer Curl (Cable)', 'biceps', [], 'cable', 'weight_reps'],
  ['Preacher Curl (Barbell)', 'biceps', [], 'barbell', 'weight_reps'],
  ['Preacher Curl (Dumbbell)', 'biceps', [], 'dumbbell', 'weight_reps'],
  ['Preacher Curl (Machine)', 'biceps', [], 'machine', 'weight_reps'],
  ['Concentration Curl (Dumbbell)', 'biceps', [], 'dumbbell', 'weight_reps'],

  // Triceps
  ['Triceps Pushdown (Cable - Straight Bar)', 'triceps', [], 'cable', 'weight_reps'],
  ['Triceps Pushdown (Cable - Rope)', 'triceps', [], 'cable', 'weight_reps'],
  ['Triceps Extension', 'triceps', [], 'other', 'weight_reps'],
  ['Triceps Extension (Cable)', 'triceps', [], 'cable', 'weight_reps'],
  ['Triceps Extension (Dumbbell)', 'triceps', [], 'dumbbell', 'weight_reps'],
  ['Triceps Extension (Machine)', 'triceps', [], 'machine', 'weight_reps'],
  ['Skullcrusher (Barbell)', 'triceps', [], 'barbell', 'weight_reps'],
  ['Skullcrusher (Dumbbell)', 'triceps', [], 'dumbbell', 'weight_reps'],

  // Legs
  ['Squat (Barbell)', 'legs', ['glutes', 'core'], 'barbell', 'weight_reps'],
  ['Front Squat (Barbell)', 'legs', ['glutes', 'core'], 'barbell', 'weight_reps'],
  ['Goblet Squat (Kettlebell)', 'legs', ['glutes'], 'kettlebell', 'weight_reps'],
  ['Goblet Squat (Dumbbell)', 'legs', ['glutes'], 'dumbbell', 'weight_reps'],
  ['Hack Squat', 'legs', ['glutes'], 'machine', 'weight_reps'],
  ['Leg Press (Machine)', 'legs', ['glutes'], 'machine', 'weight_reps'],
  ['Lunge (Dumbbell)', 'legs', ['glutes'], 'dumbbell', 'weight_reps'],
  ['Lunge (Barbell)', 'legs', ['glutes'], 'barbell', 'weight_reps'],
  ['Bulgarian Split Squat (Dumbbell)', 'legs', ['glutes'], 'dumbbell', 'weight_reps'],
  ['Leg Extension (Machine)', 'legs', [], 'machine', 'weight_reps'],
  ['Lying Leg Curl (Machine)', 'legs', [], 'machine', 'weight_reps'],
  ['Seated Leg Curl (Machine)', 'legs', [], 'machine', 'weight_reps'],
  ['Stiff Leg Deadlift (Barbell)', 'legs', ['back', 'glutes'], 'barbell', 'weight_reps'],
  ['Romanian Deadlift (Barbell)', 'legs', ['back', 'glutes'], 'barbell', 'weight_reps'],
  ['Romanian Deadlift (Dumbbell)', 'legs', ['back', 'glutes'], 'dumbbell', 'weight_reps'],
  ['Trap Bar Deadlift', 'legs', ['back', 'glutes'], 'barbell', 'weight_reps'],
  ['Hip Adductor (Machine)', 'legs', [], 'machine', 'weight_reps'],
  ['Sled Push', 'legs', ['full_body'], 'other', 'distance_duration'],

  // Glutes
  ['Hip Abductor (Machine)', 'glutes', [], 'machine', 'weight_reps'],
  ['Hip Thrust (Barbell)', 'glutes', ['legs'], 'barbell', 'weight_reps'],
  ['Hip Thrust (Machine)', 'glutes', ['legs'], 'machine', 'weight_reps'],
  ['Glute Kickback (Cable)', 'glutes', [], 'cable', 'weight_reps'],

  // Calves
  ['Standing Calf Raise (Dumbbell)', 'calves', [], 'dumbbell', 'weight_reps'],
  ['Standing Calf Raise (Machine)', 'calves', [], 'machine', 'weight_reps'],
  ['Standing Calf Raise (Barbell)', 'calves', [], 'barbell', 'weight_reps'],
  ['Seated Calf Raise (Plate Loaded)', 'calves', [], 'plate_loaded', 'weight_reps'],
  ['Seated Calf Raise (Machine)', 'calves', [], 'machine', 'weight_reps'],
  ['Calf Press (Machine)', 'calves', [], 'machine', 'weight_reps'],

  // Core
  ['Crunch', 'core', [], 'bodyweight', 'bodyweight_reps'],
  ['Crunch (Machine)', 'core', [], 'machine', 'weight_reps'],
  ['Cable Crunch', 'core', [], 'cable', 'weight_reps'],
  ['Cross Body Crunch', 'core', [], 'bodyweight', 'bodyweight_reps'],
  ['Hanging Leg Raise', 'core', [], 'bodyweight', 'bodyweight_reps'],
  ['Flat Leg Raise', 'core', [], 'bodyweight', 'bodyweight_reps'],
  ['Russian Twist', 'core', [], 'bodyweight', 'bodyweight_reps'],
  ['Ab Wheel', 'core', [], 'other', 'bodyweight_reps'],
  ['Torso Rotation (Machine)', 'core', [], 'machine', 'weight_reps'],
  ['Plank', 'core', [], 'bodyweight', 'duration'],

  // Full body / cardio
  ['Kettlebell Swing', 'full_body', ['glutes', 'legs'], 'kettlebell', 'weight_reps'],
  ['Burpee', 'full_body', [], 'bodyweight', 'bodyweight_reps'],
  ['Farmers Walk', 'full_body', ['core'], 'dumbbell', 'weight_distance'],
  ['Running (Treadmill)', 'full_body', ['legs'], 'machine', 'distance_duration'],
  ['Cycling (Indoor)', 'full_body', ['legs'], 'machine', 'distance_duration'],
  ['Rowing (Machine)', 'full_body', ['back', 'legs'], 'machine', 'distance_duration'],
  ['Walking', 'full_body', ['legs'], 'other', 'distance_duration'],
  ['Jump Rope', 'full_body', ['calves'], 'other', 'duration'],
];
