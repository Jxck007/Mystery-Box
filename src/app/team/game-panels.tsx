"use client";

import { useMemo, useState } from "react";

// ─────────────────────────────────────────────
//  SEEDED RANDOM HELPERS
// ─────────────────────────────────────────────

export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickFromBank<T>(seed: string, salt: string, bank: T[]): T {
  const rand = seededRandom(seed + salt);
  return bank[Math.floor(rand() * bank.length)];
}

export function pickFromBankIndexed<T>(
  seed: string,
  salt: string,
  bank: T[],
  index: number,
): T {
  const order = shuffle(
    bank.map((_, idx) => idx),
    seededRandom(`${seed}-${salt}-order`),
  );
  return bank[order[index % bank.length]];
}

export type MiniGameProps = {
  seed: string;
  questionIndex: number;
  disabled?: boolean;
  onComplete: (result: { success: boolean; details: string }) => void;
};

// ─────────────────────────────────────────────
//  1. RAPID QUIZ  (50 questions)
//     Pick the correct answer from four options
// ─────────────────────────────────────────────

export type QuizQuestion = {
  q: string;
  options: [string, string, string, string];
  a: string;
};

export const RAPID_QUIZ_BANK: QuizQuestion[] = [
  { q: "Which planet is known as the Red Planet?", options: ["Mars", "Venus", "Jupiter", "Mercury"], a: "Mars" },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], a: "6" },
  { q: "What gas do plants absorb from the air?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], a: "Carbon dioxide" },
  { q: "Which ocean is the largest?", options: ["Pacific", "Atlantic", "Indian", "Arctic"], a: "Pacific" },
  { q: "How many days are in a leap year?", options: ["365", "366", "364", "360"], a: "366" },
  { q: "Which continent is the Sahara Desert in?", options: ["Africa", "Asia", "Europe", "Australia"], a: "Africa" },
  { q: "What is H₂O commonly known as?", options: ["Water", "Oxygen", "Hydrogen", "Salt"], a: "Water" },
  { q: "Which animal is known as the King of the Jungle?", options: ["Lion", "Tiger", "Elephant", "Bear"], a: "Lion" },
  { q: "What do bees produce?", options: ["Honey", "Milk", "Bread", "Wax"], a: "Honey" },
  { q: "Which is the smallest prime number?", options: ["1", "2", "3", "5"], a: "2" },
  { q: "What is the capital of Japan?", options: ["Tokyo", "Kyoto", "Osaka", "Nagoya"], a: "Tokyo" },
  { q: "Which planet is closest to the Sun?", options: ["Mercury", "Earth", "Venus", "Mars"], a: "Mercury" },
  { q: "Which instrument has black and white keys?", options: ["Piano", "Violin", "Drum", "Flute"], a: "Piano" },
  { q: "Which shape has four equal sides?", options: ["Square", "Triangle", "Circle", "Oval"], a: "Square" },
  { q: "How many planets are in the solar system?", options: ["7", "8", "9", "10"], a: "8" },
  { q: "Which metal is liquid at room temperature?", options: ["Mercury", "Gold", "Iron", "Copper"], a: "Mercury" },
  { q: "Which fruit is said to keep the doctor away?", options: ["Apple", "Banana", "Grape", "Pear"], a: "Apple" },
  { q: "What is the largest land animal?", options: ["Elephant", "Rhino", "Hippo", "Giraffe"], a: "Elephant" },
  { q: "Which planet has rings around it?", options: ["Saturn", "Mars", "Venus", "Mercury"], a: "Saturn" },
  { q: "How many hours are in a day?", options: ["12", "18", "24", "36"], a: "24" },
  { q: "What color do you get mixing red and blue?", options: ["Purple", "Green", "Orange", "Brown"], a: "Purple" },
  { q: "Which animal has black and white stripes?", options: ["Zebra", "Tiger", "Horse", "Panda"], a: "Zebra" },
  { q: "Which is the largest planet?", options: ["Jupiter", "Saturn", "Neptune", "Earth"], a: "Jupiter" },
  { q: "What is 3 × 4?", options: ["7", "12", "14", "10"], a: "12" },
  { q: "Which season comes after spring?", options: ["Summer", "Autumn", "Winter", "Monsoon"], a: "Summer" },
  { q: "Which is faster — sound or light?", options: ["Light", "Sound", "Same speed", "Depends"], a: "Light" },
  { q: "Which common bird lays eggs?", options: ["Duck", "Dog", "Cat", "Cow"], a: "Duck" },
  { q: "Which is a mammal?", options: ["Whale", "Shark", "Trout", "Octopus"], a: "Whale" },
  { q: "What is the capital of France?", options: ["Paris", "Rome", "Madrid", "Berlin"], a: "Paris" },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], a: "7" },
  { q: "Which gas is most common in the air?", options: ["Nitrogen", "Oxygen", "Carbon dioxide", "Helium"], a: "Nitrogen" },
  { q: "Which month has the fewest days?", options: ["February", "April", "June", "September"], a: "February" },
  { q: "What do you call a baby dog?", options: ["Puppy", "Kitten", "Cub", "Calf"], a: "Puppy" },
  { q: "In which direction does the Sun rise?", options: ["East", "West", "North", "South"], a: "East" },
  { q: "How many letters are in the English alphabet?", options: ["24", "25", "26", "27"], a: "26" },
  { q: "Which object is used to tell time?", options: ["Clock", "Brush", "Spoon", "Bottle"], a: "Clock" },
  { q: "What is the largest mammal?", options: ["Blue whale", "Elephant", "Giraffe", "Hippo"], a: "Blue whale" },
  { q: "Which is the coldest continent?", options: ["Antarctica", "Europe", "Asia", "Africa"], a: "Antarctica" },
  { q: "Which fruit is yellow and curved?", options: ["Banana", "Apple", "Grape", "Pear"], a: "Banana" },
  { q: "What color is a stop sign?", options: ["Red", "Green", "Blue", "Yellow"], a: "Red" },
  { q: "How many wheels does a bicycle have?", options: ["1", "2", "3", "4"], a: "2" },
  { q: "Which planet do we live on?", options: ["Earth", "Mars", "Venus", "Saturn"], a: "Earth" },
  { q: "Which animal is known for its long neck?", options: ["Giraffe", "Bear", "Rabbit", "Fox"], a: "Giraffe" },
  { q: "How many minutes are in an hour?", options: ["30", "45", "60", "90"], a: "60" },
  { q: "Which is a primary color?", options: ["Blue", "Purple", "Green", "Orange"], a: "Blue" },
  { q: "What does a thermometer measure?", options: ["Temperature", "Speed", "Weight", "Distance"], a: "Temperature" },
  { q: "Which animal hops?", options: ["Kangaroo", "Elephant", "Dolphin", "Horse"], a: "Kangaroo" },
  { q: "Which planet is known for its blue color?", options: ["Neptune", "Mars", "Mercury", "Venus"], a: "Neptune" },
  { q: "What is the opposite of cold?", options: ["Hot", "Wet", "Dark", "Soft"], a: "Hot" },
  { q: "How many legs does a spider have?", options: ["6", "8", "10", "12"], a: "8" },
];

// ─────────────────────────────────────────────
//  2. FAST TRIVIA  (50 questions)
//     One-tap multiple-choice trivia
// ─────────────────────────────────────────────

export const FAST_TRIVIA_BANK: QuizQuestion[] = [
  { q: "Which ocean is the largest?", options: ["Pacific", "Atlantic", "Indian", "Arctic"], a: "Pacific" },
  { q: "What is the capital of Japan?", options: ["Tokyo", "Kyoto", "Osaka", "Nagoya"], a: "Tokyo" },
  { q: "Which is the smallest prime number?", options: ["1", "2", "3", "5"], a: "2" },
  { q: "Which planet is known as the Morning Star?", options: ["Venus", "Mars", "Jupiter", "Mercury"], a: "Venus" },
  { q: "What is the largest mammal?", options: ["Blue whale", "Elephant", "Giraffe", "Hippo"], a: "Blue whale" },
  { q: "Which country has the maple leaf on its flag?", options: ["Canada", "USA", "UK", "Australia"], a: "Canada" },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], a: "7" },
  { q: "Which planet has the most moons?", options: ["Saturn", "Earth", "Mars", "Venus"], a: "Saturn" },
  { q: "What is the hardest natural substance?", options: ["Diamond", "Gold", "Iron", "Silver"], a: "Diamond" },
  { q: "Which organ pumps blood?", options: ["Heart", "Liver", "Brain", "Lung"], a: "Heart" },
  { q: "What is the capital of Italy?", options: ["Rome", "Milan", "Venice", "Turin"], a: "Rome" },
  { q: "Which gas do humans need to breathe?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], a: "Oxygen" },
  { q: "Which planet is known for its rings?", options: ["Saturn", "Mars", "Venus", "Mercury"], a: "Saturn" },
  { q: "How many sides does a triangle have?", options: ["3", "4", "5", "6"], a: "3" },
  { q: "Which continent is Brazil in?", options: ["South America", "Africa", "Europe", "Asia"], a: "South America" },
  { q: "What is the capital of Spain?", options: ["Madrid", "Barcelona", "Valencia", "Seville"], a: "Madrid" },
  { q: "Which is the tallest mountain?", options: ["Everest", "K2", "Kilimanjaro", "Denali"], a: "Everest" },
  { q: "Which animal has black and white stripes?", options: ["Zebra", "Tiger", "Horse", "Panda"], a: "Zebra" },
  { q: "Which planet is closest to the Sun?", options: ["Mercury", "Earth", "Venus", "Mars"], a: "Mercury" },
  { q: "Which is the largest desert?", options: ["Sahara", "Gobi", "Kalahari", "Mojave"], a: "Sahara" },
  { q: "What is the capital of Germany?", options: ["Berlin", "Munich", "Hamburg", "Frankfurt"], a: "Berlin" },
  { q: "Which animal is a marsupial?", options: ["Kangaroo", "Elephant", "Lion", "Horse"], a: "Kangaroo" },
  { q: "Which is a primary color?", options: ["Red", "Green", "Purple", "Orange"], a: "Red" },
  { q: "How many bones are in the human body?", options: ["206", "201", "212", "198"], a: "206" },
  { q: "Which river is the longest?", options: ["Nile", "Amazon", "Yangtze", "Mississippi"], a: "Nile" },
  { q: "What is the capital of Australia?", options: ["Canberra", "Sydney", "Melbourne", "Perth"], a: "Canberra" },
  { q: "Which planet is known as the Blue Planet?", options: ["Earth", "Neptune", "Uranus", "Saturn"], a: "Earth" },
  { q: "Which is the largest bird?", options: ["Ostrich", "Eagle", "Penguin", "Parrot"], a: "Ostrich" },
  { q: "What do you call a baby cat?", options: ["Kitten", "Puppy", "Cub", "Calf"], a: "Kitten" },
  { q: "Which instrument has six strings?", options: ["Guitar", "Piano", "Flute", "Drum"], a: "Guitar" },
  { q: "Which planet is known for strong winds?", options: ["Neptune", "Mars", "Mercury", "Venus"], a: "Neptune" },
  { q: "What is the capital of Egypt?", options: ["Cairo", "Giza", "Alexandria", "Luxor"], a: "Cairo" },
  { q: "Which metal is most used in wiring?", options: ["Copper", "Gold", "Silver", "Iron"], a: "Copper" },
  { q: "Which animal is known for its long neck?", options: ["Giraffe", "Camel", "Llama", "Deer"], a: "Giraffe" },
  { q: "Which planet has the Great Red Spot?", options: ["Jupiter", "Mars", "Venus", "Mercury"], a: "Jupiter" },
  { q: "Which sport uses a bat and a ball?", options: ["Baseball", "Soccer", "Tennis", "Hockey"], a: "Baseball" },
  { q: "How many hours are in a day?", options: ["12", "18", "24", "36"], a: "24" },
  { q: "Which is the largest continent?", options: ["Asia", "Africa", "Europe", "Australia"], a: "Asia" },
  { q: "What is the capital of Greece?", options: ["Athens", "Sparta", "Thessaloniki", "Corfu"], a: "Athens" },
  { q: "Which animal is known for its shell?", options: ["Turtle", "Rabbit", "Dog", "Fox"], a: "Turtle" },
  { q: "Which gas is most common in the atmosphere?", options: ["Nitrogen", "Oxygen", "Carbon dioxide", "Helium"], a: "Nitrogen" },
  { q: "Which season comes after winter?", options: ["Spring", "Autumn", "Summer", "Monsoon"], a: "Spring" },
  { q: "Which planet is the hottest?", options: ["Venus", "Mercury", "Mars", "Jupiter"], a: "Venus" },
  { q: "What is the capital of South Korea?", options: ["Seoul", "Busan", "Daegu", "Incheon"], a: "Seoul" },
  { q: "Which is a renewable energy source?", options: ["Wind", "Coal", "Oil", "Gas"], a: "Wind" },
  { q: "Which organ helps you breathe?", options: ["Lungs", "Heart", "Kidneys", "Liver"], a: "Lungs" },
  { q: "Which is the tallest animal?", options: ["Giraffe", "Elephant", "Zebra", "Lion"], a: "Giraffe" },
  { q: "Which instrument measures temperature?", options: ["Thermometer", "Barometer", "Compass", "Altimeter"], a: "Thermometer" },
  { q: "Which country is famous for pizza?", options: ["Italy", "France", "Spain", "Germany"], a: "Italy" },
  { q: "Which is the capital of the UK?", options: ["London", "Manchester", "Bristol", "Liverpool"], a: "London" },
];

// ─────────────────────────────────────────────
//  3. TRUE OR FALSE  (50 questions)
//     Is the math or fact statement correct?
// ─────────────────────────────────────────────

export type TrueFalseQuestion = { text: string; correct: boolean };

export const TRUE_FALSE_BANK: TrueFalseQuestion[] = [
  { text: "5 + 7 = 12", correct: true },
  { text: "8 × 3 = 25", correct: false },
  { text: "15 - 6 = 9", correct: true },
  { text: "4 × 4 = 18", correct: false },
  { text: "9 + 9 = 18", correct: true },
  { text: "100 ÷ 5 = 25", correct: false },
  { text: "7 × 6 = 42", correct: true },
  { text: "3 + 8 = 12", correct: false },
  { text: "6 × 7 = 42", correct: true },
  { text: "50 - 13 = 38", correct: false },
  { text: "9 × 9 = 81", correct: true },
  { text: "4 + 17 = 22", correct: false },
  { text: "12 × 3 = 36", correct: true },
  { text: "8 + 9 = 18", correct: false },
  { text: "11 × 4 = 44", correct: true },
  { text: "6 × 8 = 50", correct: false },
  { text: "7 + 14 = 21", correct: true },
  { text: "9 × 6 = 55", correct: false },
  { text: "5 × 8 = 40", correct: true },
  { text: "17 - 9 = 7", correct: false },
  { text: "4 × 9 = 36", correct: true },
  { text: "13 + 8 = 22", correct: false },
  { text: "3 × 12 = 36", correct: true },
  { text: "25 ÷ 5 = 6", correct: false },
  { text: "8 × 8 = 64", correct: true },
  { text: "5 × 7 = 38", correct: false },
  { text: "6 + 18 = 24", correct: true },
  { text: "11 × 5 = 60", correct: false },
  { text: "7 × 7 = 49", correct: true },
  { text: "14 + 9 = 24", correct: false },
  { text: "6 × 9 = 54", correct: true },
  { text: "9 + 13 = 23", correct: false },
  { text: "5 × 5 = 25", correct: true },
  { text: "3 × 9 = 28", correct: false },
  { text: "8 + 16 = 24", correct: true },
  { text: "7 × 8 = 58", correct: false },
  { text: "4 × 7 = 28", correct: true },
  { text: "9 + 14 = 24", correct: false },
  { text: "11 × 3 = 33", correct: true },
  { text: "6 × 6 = 37", correct: false },
  { text: "5 + 16 = 21", correct: true },
  { text: "8 × 4 = 33", correct: false },
  { text: "7 × 9 = 63", correct: true },
  { text: "12 + 9 = 22", correct: false },
  { text: "3 × 8 = 24", correct: true },
  { text: "5 × 9 = 46", correct: false },
  { text: "6 + 19 = 25", correct: true },
  { text: "4 × 8 = 33", correct: false },
  { text: "9 × 4 = 36", correct: true },
  { text: "7 + 18 = 26", correct: false },
];

// ─────────────────────────────────────────────
//  4. ODD ONE OUT  (50 sets)
//     Find the item that doesn't belong
// ─────────────────────────────────────────────

export type OddOneOutQuestion = { items: string[]; odd: string };

const ODD_ONE_OUT_RAW: Array<{ group: string[]; odd: string }> = [
  { group: ["Apple", "Banana", "Orange"], odd: "Car" },
  { group: ["Blue", "Green", "Red"], odd: "Table" },
  { group: ["Cat", "Dog", "Bird"], odd: "Rock" },
  { group: ["Circle", "Square", "Triangle"], odd: "Spoon" },
  { group: ["Rose", "Tulip", "Daisy"], odd: "Truck" },
  { group: ["Piano", "Guitar", "Drum"], odd: "Carpet" },
  { group: ["Milk", "Water", "Juice"], odd: "Hammer" },
  { group: ["Winter", "Spring", "Summer"], odd: "Helmet" },
  { group: ["Monday", "Tuesday", "Wednesday"], odd: "Apple" },
  { group: ["Gold", "Silver", "Bronze"], odd: "Lemon" },
  { group: ["Tiger", "Lion", "Leopard"], odd: "Pencil" },
  { group: ["Mango", "Pineapple", "Papaya"], odd: "Brick" },
  { group: ["Train", "Bus", "Car"], odd: "Mountain" },
  { group: ["Doctor", "Nurse", "Surgeon"], odd: "River" },
  { group: ["Shirt", "Pants", "Jacket"], odd: "Cloud" },
  { group: ["Hammer", "Screwdriver", "Wrench"], odd: "Pillow" },
  { group: ["Mars", "Venus", "Jupiter"], odd: "Ocean" },
  { group: ["Violin", "Cello", "Viola"], odd: "Chair" },
  { group: ["Wheat", "Rice", "Barley"], odd: "Candle" },
  { group: ["Eagle", "Hawk", "Falcon"], odd: "Laptop" },
  { group: ["Salmon", "Tuna", "Trout"], odd: "Glove" },
  { group: ["French", "Spanish", "Italian"], odd: "Copper" },
  { group: ["Carrot", "Potato", "Onion"], odd: "Mirror" },
  { group: ["Cricket", "Football", "Tennis"], odd: "Pillow" },
  { group: ["Iron", "Steel", "Copper"], odd: "Banana" },
  { group: ["Earth", "Mars", "Venus"], odd: "Sofa" },
  { group: ["Socks", "Shoes", "Boots"], odd: "River" },
  { group: ["Honey", "Jam", "Syrup"], odd: "Wrench" },
  { group: ["Sparrow", "Pigeon", "Robin"], odd: "Table" },
  { group: ["Coffee", "Tea", "Cocoa"], odd: "Brick" },
  { group: ["Cheetah", "Panther", "Jaguar"], odd: "Bottle" },
  { group: ["Square", "Rectangle", "Rhombus"], odd: "Spoon" },
  { group: ["Oak", "Maple", "Pine"], odd: "Ruler" },
  { group: ["Cotton", "Silk", "Wool"], odd: "Candle" },
  { group: ["Hammer", "Nail", "Bolt"], odd: "Parrot" },
  { group: ["Cup", "Mug", "Glass"], odd: "Stone" },
  { group: ["Africa", "Europe", "Asia"], odd: "Clock" },
  { group: ["Plumber", "Electrician", "Carpenter"], odd: "Grape" },
  { group: ["Broccoli", "Spinach", "Lettuce"], odd: "Drum" },
  { group: ["Swimming", "Cycling", "Running"], odd: "Brick" },
  { group: ["Nose", "Eye", "Ear"], odd: "Bucket" },
  { group: ["January", "March", "May"], odd: "Helmet" },
  { group: ["Flute", "Trumpet", "Saxophone"], odd: "Chair" },
  { group: ["Sand", "Clay", "Mud"], odd: "Candle" },
  { group: ["Knife", "Fork", "Spoon"], odd: "Laptop" },
  { group: ["Parrot", "Peacock", "Flamingo"], odd: "Stone" },
  { group: ["Hydrogen", "Helium", "Oxygen"], odd: "Chair" },
  { group: ["Cucumber", "Zucchini", "Celery"], odd: "Piano" },
  { group: ["Wallet", "Purse", "Handbag"], odd: "Volcano" },
  { group: ["Laptop", "Tablet", "Phone"], odd: "Cabbage" },
];

export const ODD_ONE_OUT_BANK: OddOneOutQuestion[] = ODD_ONE_OUT_RAW.map((entry, index) => {
  const rand = seededRandom(`odd-${index}`);
  const items = shuffle([...entry.group, entry.odd], rand);
  return { items, odd: entry.odd };
});

// ─────────────────────────────────────────────
//  5. NUMBER SEQUENCE  (50 sequences)
//     What is the next number in the pattern?
// ─────────────────────────────────────────────

export type SequenceQuestion = { sequence: number[]; answer: number };

export const NUMBER_SEQUENCE_BANK: SequenceQuestion[] = [
  { sequence: [2, 4, 6], answer: 8 },
  { sequence: [3, 6, 9], answer: 12 },
  { sequence: [5, 10, 15], answer: 20 },
  { sequence: [1, 3, 5], answer: 7 },
  { sequence: [10, 20, 30], answer: 40 },
  { sequence: [4, 8, 12], answer: 16 },
  { sequence: [7, 14, 21], answer: 28 },
  { sequence: [2, 5, 8], answer: 11 },
  { sequence: [3, 7, 11], answer: 15 },
  { sequence: [1, 4, 9], answer: 16 },
  { sequence: [2, 4, 8], answer: 16 },
  { sequence: [5, 15, 45], answer: 135 },
  { sequence: [100, 90, 80], answer: 70 },
  { sequence: [50, 45, 40], answer: 35 },
  { sequence: [1, 2, 4], answer: 8 },
  { sequence: [3, 9, 27], answer: 81 },
  { sequence: [6, 11, 16], answer: 21 },
  { sequence: [8, 16, 24], answer: 32 },
  { sequence: [4, 9, 14], answer: 19 },
  { sequence: [12, 24, 36], answer: 48 },
  { sequence: [20, 17, 14], answer: 11 },
  { sequence: [1, 5, 9], answer: 13 },
  { sequence: [2, 6, 10], answer: 14 },
  { sequence: [9, 18, 27], answer: 36 },
  { sequence: [15, 12, 9], answer: 6 },
  { sequence: [4, 6, 8], answer: 10 },
  { sequence: [7, 12, 17], answer: 22 },
  { sequence: [10, 13, 16], answer: 19 },
  { sequence: [3, 6, 12], answer: 24 },
  { sequence: [25, 50, 75], answer: 100 },
  { sequence: [11, 22, 33], answer: 44 },
  { sequence: [2, 3, 5], answer: 8 },
  { sequence: [1, 1, 2], answer: 3 },
  { sequence: [5, 8, 11], answer: 14 },
  { sequence: [6, 12, 18], answer: 24 },
  { sequence: [8, 10, 12], answer: 14 },
  { sequence: [30, 25, 20], answer: 15 },
  { sequence: [4, 16, 64], answer: 256 },
  { sequence: [0, 3, 6], answer: 9 },
  { sequence: [9, 7, 5], answer: 3 },
  { sequence: [5, 11, 17], answer: 23 },
  { sequence: [2, 7, 12], answer: 17 },
  { sequence: [10, 8, 6], answer: 4 },
  { sequence: [1, 3, 7], answer: 15 },
  { sequence: [6, 10, 14], answer: 18 },
  { sequence: [4, 12, 36], answer: 108 },
  { sequence: [3, 5, 7], answer: 9 },
  { sequence: [8, 14, 20], answer: 26 },
  { sequence: [5, 10, 20], answer: 40 },
  { sequence: [9, 11, 13], answer: 15 },
];

// ─────────────────────────────────────────────
//  6. QUICK MATH  (50 problems)
//     Solve: a × b − c
// ─────────────────────────────────────────────

export type MathQuestion = { a: number; b: number; c: number; result: number };

export const QUICK_MATH_BANK: MathQuestion[] = [
  { a: 3, b: 4, c: 2, result: 10 },
  { a: 5, b: 3, c: 4, result: 11 },
  { a: 6, b: 2, c: 3, result: 9 },
  { a: 4, b: 5, c: 6, result: 14 },
  { a: 7, b: 3, c: 5, result: 16 },
  { a: 8, b: 2, c: 4, result: 12 },
  { a: 9, b: 3, c: 7, result: 20 },
  { a: 5, b: 5, c: 5, result: 20 },
  { a: 6, b: 4, c: 8, result: 16 },
  { a: 3, b: 7, c: 6, result: 15 },
  { a: 4, b: 6, c: 9, result: 15 },
  { a: 7, b: 4, c: 8, result: 20 },
  { a: 8, b: 3, c: 6, result: 18 },
  { a: 5, b: 6, c: 7, result: 23 },
  { a: 9, b: 2, c: 5, result: 13 },
  { a: 6, b: 5, c: 8, result: 22 },
  { a: 3, b: 8, c: 4, result: 20 },
  { a: 7, b: 5, c: 9, result: 26 },
  { a: 4, b: 7, c: 3, result: 25 },
  { a: 8, b: 4, c: 7, result: 25 },
  { a: 5, b: 7, c: 8, result: 27 },
  { a: 9, b: 4, c: 6, result: 30 },
  { a: 6, b: 6, c: 9, result: 27 },
  { a: 3, b: 9, c: 5, result: 22 },
  { a: 7, b: 6, c: 4, result: 38 },
  { a: 4, b: 8, c: 6, result: 26 },
  { a: 8, b: 5, c: 9, result: 31 },
  { a: 5, b: 8, c: 7, result: 33 },
  { a: 9, b: 5, c: 8, result: 37 },
  { a: 6, b: 7, c: 5, result: 37 },
  { a: 3, b: 6, c: 8, result: 10 },
  { a: 7, b: 7, c: 9, result: 40 },
  { a: 4, b: 9, c: 7, result: 29 },
  { a: 8, b: 6, c: 4, result: 44 },
  { a: 5, b: 9, c: 6, result: 39 },
  { a: 9, b: 6, c: 7, result: 47 },
  { a: 6, b: 8, c: 9, result: 39 },
  { a: 3, b: 5, c: 4, result: 11 },
  { a: 7, b: 8, c: 6, result: 50 },
  { a: 4, b: 4, c: 5, result: 11 },
  { a: 8, b: 7, c: 8, result: 48 },
  { a: 5, b: 4, c: 9, result: 11 },
  { a: 9, b: 7, c: 4, result: 59 },
  { a: 6, b: 9, c: 8, result: 46 },
  { a: 3, b: 3, c: 2, result: 7 },
  { a: 7, b: 9, c: 5, result: 58 },
  { a: 4, b: 3, c: 7, result: 5 },
  { a: 8, b: 9, c: 6, result: 66 },
  { a: 5, b: 2, c: 3, result: 7 },
  { a: 9, b: 8, c: 9, result: 63 },
];

// ─────────────────────────────────────────────
//  7. OBJECT COUNT  (50 questions)
//     Count the icons shown on screen
// ─────────────────────────────────────────────

export type CountQuestion = { count: number; icon: string };

export const OBJECT_COUNT_BANK: CountQuestion[] = [
  { count: 4, icon: "🔶" }, { count: 7, icon: "🔷" }, { count: 5, icon: "🔺" },
  { count: 9, icon: "🔻" }, { count: 6, icon: "🟢" }, { count: 11, icon: "🔶" },
  { count: 8, icon: "🔷" }, { count: 3, icon: "🔺" }, { count: 12, icon: "🔻" },
  { count: 10, icon: "🟢" }, { count: 5, icon: "🔶" }, { count: 8, icon: "🔺" },
  { count: 6, icon: "🟢" }, { count: 9, icon: "🔷" }, { count: 7, icon: "🔻" },
  { count: 4, icon: "🔺" }, { count: 11, icon: "🔷" }, { count: 3, icon: "🟢" },
  { count: 10, icon: "🔶" }, { count: 12, icon: "🔺" }, { count: 6, icon: "🔷" },
  { count: 8, icon: "🟢" }, { count: 5, icon: "🔻" }, { count: 9, icon: "🔶" },
  { count: 7, icon: "🔺" }, { count: 4, icon: "🔷" }, { count: 11, icon: "🟢" },
  { count: 3, icon: "🔻" }, { count: 12, icon: "🔷" }, { count: 10, icon: "🔺" },
  { count: 6, icon: "🔶" }, { count: 5, icon: "🟢" }, { count: 8, icon: "🔻" },
  { count: 7, icon: "🔷" }, { count: 9, icon: "🔶" }, { count: 4, icon: "🟢" },
  { count: 11, icon: "🔺" }, { count: 3, icon: "🔶" }, { count: 12, icon: "🟢" },
  { count: 10, icon: "🔻" }, { count: 6, icon: "🔺" }, { count: 5, icon: "🔶" },
  { count: 8, icon: "🔷" }, { count: 7, icon: "🟢" }, { count: 9, icon: "🔻" },
  { count: 4, icon: "🔶" }, { count: 11, icon: "🔻" }, { count: 3, icon: "🔷" },
  { count: 12, icon: "🔶" }, { count: 10, icon: "🟢" },
];

// ─────────────────────────────────────────────
//  8. WORD SCRAMBLE  (50 words)
//     Unscramble the letters to form a real word
// ─────────────────────────────────────────────

export const WORD_SCRAMBLE_WORDS: string[] = [
  "planet", "mission", "galaxy", "rocket", "puzzle",
  "meteor", "signal", "comet", "nebula", "orbit",
  "launch", "module", "riddle", "cipher", "solver",
  "fusion", "matrix", "sensor", "compass", "vector",
  "target", "oxygen", "cosmic", "cabin", "engine",
  "memory", "laser", "terrain", "airlock", "payload",
  "landing", "gravity", "control", "pilot", "binary",
  "circuit", "trivia", "radar", "horizon", "station",
  "journey", "quantum", "cosmos", "orbiter", "capsule",
  "thruster", "docking", "beacon", "stellar", "eclipse",
];

// ─────────────────────────────────────────────
//  9. MISSING LETTER  (50 words)
//     Fill in the missing letter to complete the word
// ─────────────────────────────────────────────

export const MISSING_LETTER_WORDS: string[] = [
  "planet", "bridge", "garden", "window", "flower",
  "school", "rocket", "castle", "silver", "monkey",
  "pencil", "jungle", "bucket", "candle", "pillow",
  "dragon", "mirror", "rabbit", "sunset", "bottle",
  "carpet", "fabric", "forest", "island", "jungle",
  "kitten", "locket", "magnet", "napkin", "oyster",
  "parrot", "quartz", "rafter", "saddle", "timber",
  "turban", "unfold", "valley", "walnut", "yarrow",
  "zipper", "anchor", "badger", "cactus", "donkey",
  "falcon", "goblin", "harbor", "insect", "jigsaw",
];

// ─────────────────────────────────────────────
//  10. QUICK ARRANGE  (50 sets)
//      Put 3 items in the correct order
// ─────────────────────────────────────────────

export type ArrangeQuestion = { items: [string, string, string]; answer: string };

const QUICK_ARRANGE_SETS: Array<[string, string, string]> = [
  ["Bronze", "Silver", "Gold"],
  ["Seed", "Sprout", "Tree"],
  ["Morning", "Noon", "Night"],
  ["Small", "Medium", "Large"],
  ["Baby", "Teen", "Adult"],
  ["First", "Second", "Third"],
  ["Winter", "Spring", "Summer"],
  ["Monday", "Tuesday", "Wednesday"],
  ["Low", "Medium", "High"],
  ["Pebble", "Rock", "Boulder"],
  ["Mercury", "Venus", "Earth"],
  ["Earth", "Mars", "Jupiter"],
  ["One", "Two", "Three"],
  ["Copper", "Silver", "Gold"],
  ["Start", "Middle", "End"],
  ["Caterpillar", "Cocoon", "Butterfly"],
  ["Cold", "Warm", "Hot"],
  ["Quiet", "Loud", "Deafening"],
  ["Dawn", "Noon", "Dusk"],
  ["Solid", "Liquid", "Gas"],
  ["Inhale", "Hold", "Exhale"],
  ["North", "Center", "South"],
  ["Walk", "Jog", "Run"],
  ["Tiny", "Small", "Large"],
  ["Leaf", "Flower", "Fruit"],
  ["Drizzle", "Rain", "Storm"],
  ["Kitten", "Cat", "Elder cat"],
  ["Puppy", "Dog", "Old dog"],
  ["Cub", "Lion", "Elder lion"],
  ["Egg", "Chick", "Hen"],
  ["Bud", "Bloom", "Wither"],
  ["Worm", "Cocoon", "Butterfly"],
  ["Second", "Minute", "Hour"],
  ["Hour", "Day", "Week"],
  ["Day", "Month", "Year"],
  ["Millimeter", "Centimeter", "Meter"],
  ["Gram", "Kilogram", "Ton"],
  ["Milliliter", "Liter", "Gallon"],
  ["Penny", "Dime", "Dollar"],
  ["Inch", "Foot", "Yard"],
  ["Sunrise", "Noon", "Sunset"],
  ["New moon", "Half moon", "Full moon"],
  ["Drip", "Stream", "Flood"],
  ["Spark", "Flame", "Blaze"],
  ["Whisper", "Talk", "Shout"],
  ["Crawl", "Walk", "Fly"],
  ["Tadpole", "Froglet", "Frog"],
  ["Acorn", "Sapling", "Oak"],
  ["Pup", "Wolf", "Pack leader"],
  ["Stone", "Brick", "Castle"],
];

export const QUICK_ARRANGE_BANK: ArrangeQuestion[] = QUICK_ARRANGE_SETS.map((items) => ({
  items,
  answer: items.join(", "),
}));

// ─────────────────────────────────────────────
//  GAME CONFIG REGISTRY
// ─────────────────────────────────────────────

export type GameConfig = {
  key: string;
  title: string;
  description: string;
  questionCount: number;
};

export const GAME_CONFIGS: GameConfig[] = [
  { key: "rapid-quiz",       title: "Rapid Quiz",       description: "Pick the correct answer from four options", questionCount: RAPID_QUIZ_BANK.length },
  { key: "fast-trivia",      title: "Fast Trivia",      description: "One-tap multiple-choice trivia",            questionCount: FAST_TRIVIA_BANK.length },
  { key: "true-false",       title: "True or False",    description: "Is the statement correct?",                 questionCount: TRUE_FALSE_BANK.length },
  { key: "odd-one-out",      title: "Odd One Out",      description: "Find the item that doesn't belong",         questionCount: ODD_ONE_OUT_BANK.length },
  { key: "number-sequence",  title: "Number Sequence",  description: "What is the next number in the pattern?",   questionCount: NUMBER_SEQUENCE_BANK.length },
  { key: "quick-math",       title: "Quick Math",       description: "Solve a × b − c",                          questionCount: QUICK_MATH_BANK.length },
  { key: "object-count",     title: "Object Count",     description: "Count the icons shown on screen",           questionCount: OBJECT_COUNT_BANK.length },
  { key: "word-scramble",    title: "Word Scramble",    description: "Unscramble the letters",                    questionCount: WORD_SCRAMBLE_WORDS.length },
  { key: "missing-letter",   title: "Missing Letter",   description: "Fill in the missing letter",                questionCount: MISSING_LETTER_WORDS.length },
  { key: "quick-arrange",    title: "Quick Arrange",    description: "Put the 3 items in the correct order",      questionCount: QUICK_ARRANGE_BANK.length },
];

export function getMiniGameConfig(title: string | null): GameConfig | null {
  const normalized = (title ?? "").toLowerCase();
  return GAME_CONFIGS.find((c) => c.title.toLowerCase() === normalized) ?? null;
}

function GameArt({ asset }: { asset: string }) {
  return (
    <div className="game-art" style={{ backgroundImage: `url(/games/${asset}.png)` }}>
      <span className="game-art-label">/public/games/{asset}.png</span>
    </div>
  );
}

function RapidQuiz({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "rapid", RAPID_QUIZ_BANK, questionIndex),
    [seed, questionIndex],
  );

  return (
    <div className="game-panel">
      <GameArt asset="rapid-quiz" />
      <p className="game-question">{data.q}</p>
      <div className="game-options">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className="game-option"
            disabled={disabled}
            onClick={() =>
              onComplete({
                success: option === data.a,
                details: option === data.a ? "Quiz correct" : "Quiz wrong",
              })
            }
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function FastTrivia({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "trivia", FAST_TRIVIA_BANK, questionIndex),
    [seed, questionIndex],
  );

  return (
    <div className="game-panel">
      <GameArt asset="fast-trivia" />
      <p className="game-question">{data.q}</p>
      <div className="game-options">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className="game-option"
            disabled={disabled}
            onClick={() =>
              onComplete({
                success: option === data.a,
                details: "Trivia",
              })
            }
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function TrueFalse({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "tf", TRUE_FALSE_BANK, questionIndex),
    [seed, questionIndex],
  );

  return (
    <div className="game-panel">
      <GameArt asset="true-false" />
      <p className="game-question">{data.text}</p>
      <div className="game-options">
        {["True", "False"].map((option) => (
          <button
            key={option}
            type="button"
            className="game-option"
            disabled={disabled}
            onClick={() =>
              onComplete({
                success: (option === "True") === data.correct,
                details: "True/False",
              })
            }
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function OddOneOut({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "odd", ODD_ONE_OUT_BANK, questionIndex),
    [seed, questionIndex],
  );

  return (
    <div className="game-panel">
      <GameArt asset="odd-one-out" />
      <p className="game-question">Pick the odd one out.</p>
      <div className="game-options">
        {data.items.map((item) => (
          <button
            key={item}
            type="button"
            className="game-option"
            disabled={disabled}
            onClick={() =>
              onComplete({
                success: item === data.odd,
                details: "Odd one out",
              })
            }
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberSequence({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(
    () => pickFromBankIndexed(seed, "sequence", NUMBER_SEQUENCE_BANK, questionIndex),
    [seed, questionIndex],
  );

  return (
    <div className="game-panel">
      <GameArt asset="number-sequence" />
      <p className="game-question">Next number: {data.sequence.join(", ")}, ?</p>
      <div className="game-input-row">
        <input
          className="input-field"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Your answer"
          disabled={disabled}
        />
        <button
          type="button"
          className="button-primary"
          disabled={disabled}
          onClick={() => {
            onComplete({
              success: Number(answer) === data.answer,
              details: "Sequence",
            });
            setAnswer("");
          }}
        >
          Check
        </button>
      </div>
    </div>
  );
}

function QuickMath({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(
    () => pickFromBankIndexed(seed, "math", QUICK_MATH_BANK, questionIndex),
    [seed, questionIndex],
  );

  return (
    <div className="game-panel">
      <GameArt asset="quick-math" />
      <p className="game-question">Solve: {data.a} x {data.b} - {data.c}</p>
      <div className="game-input-row">
        <input
          className="input-field"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Your answer"
          disabled={disabled}
        />
        <button
          type="button"
          className="button-primary"
          disabled={disabled}
          onClick={() => {
            onComplete({
              success: Number(answer) === data.result,
              details: "Math result",
            });
            setAnswer("");
          }}
        >
          Check
        </button>
      </div>
    </div>
  );
}

function ObjectCount({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(
    () => pickFromBankIndexed(seed, "count", OBJECT_COUNT_BANK, questionIndex),
    [seed, questionIndex],
  );

  return (
    <div className="game-panel">
      <GameArt asset="object-count" />
      <div className="game-grid">
        {Array.from({ length: data.count }).map((_, index) => (
          <span key={index} className="game-icon">
            {data.icon}
          </span>
        ))}
      </div>
      <div className="game-input-row">
        <input
          className="input-field"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Count"
          disabled={disabled}
        />
        <button
          type="button"
          className="button-primary"
          disabled={disabled}
          onClick={() => {
            onComplete({
              success: Number(answer) === data.count,
              details: "Count",
            });
            setAnswer("");
          }}
        >
          Check
        </button>
      </div>
    </div>
  );
}

function WordScramble({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    const rand = seededRandom(`${seed}-scramble-${questionIndex}`);
    const word = pickFromBankIndexed(
      seed,
      "scramble",
      WORD_SCRAMBLE_WORDS,
      questionIndex,
    );
    const scrambled = shuffle(word.split(""), rand).join("");
    return { word, scrambled };
  }, [seed, questionIndex]);

  return (
    <div className="game-panel">
      <GameArt asset="word-scramble" />
      <p className="game-question">Unscramble: {data.scrambled}</p>
      <div className="game-input-row">
        <input
          className="input-field"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Your word"
          disabled={disabled}
        />
        <button
          type="button"
          className="button-primary"
          disabled={disabled}
          onClick={() => {
            onComplete({
              success: answer.trim().toLowerCase() === data.word,
              details: "Scramble",
            });
            setAnswer("");
          }}
        >
          Check
        </button>
      </div>
    </div>
  );
}

function MissingLetter({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    const rand = seededRandom(`${seed}-missing-${questionIndex}`);
    const word = pickFromBankIndexed(
      seed,
      "missing",
      MISSING_LETTER_WORDS,
      questionIndex,
    );
    const index = Math.floor(rand() * word.length);
    const masked = word.slice(0, index) + "_" + word.slice(index + 1);
    return { masked, letter: word[index] };
  }, [seed, questionIndex]);

  return (
    <div className="game-panel">
      <GameArt asset="missing-letter" />
      <p className="game-question">Fill the missing letter: {data.masked}</p>
      <div className="game-input-row">
        <input
          className="input-field"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Letter"
          disabled={disabled}
        />
        <button
          type="button"
          className="button-primary"
          disabled={disabled}
          onClick={() => {
            onComplete({
              success: answer.trim().toLowerCase() === data.letter,
              details: "Missing letter",
            });
            setAnswer("");
          }}
        >
          Check
        </button>
      </div>
    </div>
  );
}

function QuickArrange({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    const rand = seededRandom(`${seed}-arrange-${questionIndex}`);
    const pick = pickFromBankIndexed(
      seed,
      "arrange",
      QUICK_ARRANGE_BANK,
      questionIndex,
    );
    const options = shuffle(
      [
        pick.answer,
        `${pick.items[1]}, ${pick.items[2]}, ${pick.items[0]}`,
        `${pick.items[2]}, ${pick.items[0]}, ${pick.items[1]}`,
      ],
      rand,
    );
    return { prompt: pick.items, options, answer: pick.answer };
  }, [seed, questionIndex]);

  return (
    <div className="game-panel">
      <GameArt asset="quick-arrange" />
      <p className="game-question">Pick the correct order:</p>
      <div className="game-options">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className="game-option"
            disabled={disabled}
            onClick={() =>
              onComplete({
                success: option === data.answer,
                details: "Arrange",
              })
            }
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MiniGameRenderer({
  gameKey,
  seed,
  questionIndex,
  disabled,
  onComplete,
}: MiniGameProps & { gameKey: string }) {
  switch (gameKey) {
    case "rapid-quiz":
      return (
        <RapidQuiz
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "fast-trivia":
      return (
        <FastTrivia
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "true-false":
      return (
        <TrueFalse
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "odd-one-out":
      return (
        <OddOneOut
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "number-sequence":
      return (
        <NumberSequence
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "quick-math":
      return (
        <QuickMath
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "object-count":
      return (
        <ObjectCount
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "word-scramble":
      return (
        <WordScramble
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "missing-letter":
      return (
        <MissingLetter
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    case "quick-arrange":
      return (
        <QuickArrange
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
    default:
      return (
        <RapidQuiz
          seed={seed}
          questionIndex={questionIndex}
          disabled={disabled}
          onComplete={onComplete}
        />
      );
  }
}