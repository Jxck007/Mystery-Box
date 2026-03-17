"use client";

import { useMemo, useState } from "react";

export type MiniGameProps = {
  seed: string;
  disabled?: boolean;
  onComplete: (result: { success: boolean; details: string }) => void;
};

type GameConfig = {
  key: string;
  title: string;
  asset: string;
};

const GAME_CONFIGS: GameConfig[] = [
  { key: "rapid-quiz", title: "Rapid Quiz", asset: "rapid-quiz" },
  { key: "quick-math", title: "Quick Math", asset: "quick-math" },
  { key: "true-false", title: "True or False", asset: "true-false" },
  { key: "odd-one-out", title: "Odd One Out", asset: "odd-one-out" },
  { key: "word-scramble", title: "Word Scramble", asset: "word-scramble" },
  { key: "emoji-guess", title: "Emoji Guess", asset: "emoji-guess" },
  { key: "number-sequence", title: "Number Sequence", asset: "number-sequence" },
  { key: "simple-riddle", title: "Simple Riddle", asset: "simple-riddle" },
  { key: "fast-trivia", title: "Fast Trivia", asset: "fast-trivia" },
  { key: "color-match", title: "Color Match", asset: "color-match" },
  { key: "missing-letter", title: "Missing Letter", asset: "missing-letter" },
  { key: "quick-arrange", title: "Quick Arrange", asset: "quick-arrange" },
  { key: "basic-logic", title: "Basic Logic", asset: "basic-logic" },
  { key: "object-count", title: "Object Count", asset: "object-count" },
  { key: "simple-pattern", title: "Simple Pattern", asset: "simple-pattern" },
];

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
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

function shuffle<T>(items: T[], rand: () => number) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildBank<T>(count: number, builder: (index: number) => T) {
  return Array.from({ length: count }, (_, index) => builder(index));
}

function pickFromBank<T>(seed: string, salt: string, bank: T[]) {
  const rand = seededRandom(seed + salt);
  return bank[Math.floor(rand() * bank.length)];
}

const RAPID_QUIZ_BANK = [
  {
    q: "Which planet is known as the Red Planet?",
    options: ["Mars", "Venus", "Jupiter", "Mercury"],
    a: "Mars",
  },
  {
    q: "How many sides does a hexagon have?",
    options: ["5", "6", "7", "8"],
    a: "6",
  },
  {
    q: "What gas do plants breathe in?",
    options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"],
    a: "Carbon dioxide",
  },
  {
    q: "Which ocean is the largest?",
    options: ["Pacific", "Atlantic", "Indian", "Arctic"],
    a: "Pacific",
  },
  {
    q: "How many days are in a leap year?",
    options: ["365", "366", "364", "360"],
    a: "366",
  },
  {
    q: "Which continent is the Sahara Desert in?",
    options: ["Africa", "Asia", "Europe", "Australia"],
    a: "Africa",
  },
  {
    q: "What is H2O commonly known as?",
    options: ["Water", "Oxygen", "Hydrogen", "Salt"],
    a: "Water",
  },
  {
    q: "Which animal is known as the King of the Jungle?",
    options: ["Lion", "Tiger", "Elephant", "Bear"],
    a: "Lion",
  },
  {
    q: "What do bees make?",
    options: ["Honey", "Milk", "Bread", "Wax"],
    a: "Honey",
  },
  {
    q: "Which is the smallest prime number?",
    options: ["1", "2", "3", "5"],
    a: "2",
  },
  {
    q: "What is the capital of Japan?",
    options: ["Tokyo", "Kyoto", "Osaka", "Nagoya"],
    a: "Tokyo",
  },
  {
    q: "Which planet is closest to the sun?",
    options: ["Mercury", "Earth", "Venus", "Mars"],
    a: "Mercury",
  },
  {
    q: "What instrument has black and white keys?",
    options: ["Piano", "Violin", "Drum", "Flute"],
    a: "Piano",
  },
  {
    q: "Which shape has four equal sides?",
    options: ["Square", "Triangle", "Circle", "Oval"],
    a: "Square",
  },
  {
    q: "How many planets are in the solar system?",
    options: ["7", "8", "9", "10"],
    a: "8",
  },
  {
    q: "Which metal is liquid at room temperature?",
    options: ["Mercury", "Gold", "Iron", "Copper"],
    a: "Mercury",
  },
  {
    q: "Which fruit keeps the doctor away?",
    options: ["Apple", "Banana", "Grape", "Pear"],
    a: "Apple",
  },
  {
    q: "What is the largest land animal?",
    options: ["Elephant", "Rhino", "Hippo", "Giraffe"],
    a: "Elephant",
  },
  {
    q: "Which planet has rings?",
    options: ["Saturn", "Mars", "Venus", "Mercury"],
    a: "Saturn",
  },
  {
    q: "How many hours are in a day?",
    options: ["12", "18", "24", "36"],
    a: "24",
  },
  {
    q: "What color do you get by mixing red and blue?",
    options: ["Purple", "Green", "Orange", "Brown"],
    a: "Purple",
  },
  {
    q: "Which animal is known for its black and white stripes?",
    options: ["Zebra", "Tiger", "Horse", "Panda"],
    a: "Zebra",
  },
  {
    q: "Which is the largest planet?",
    options: ["Jupiter", "Saturn", "Neptune", "Earth"],
    a: "Jupiter",
  },
  {
    q: "What is 3 x 4?",
    options: ["7", "12", "14", "10"],
    a: "12",
  },
  {
    q: "Which season comes after spring?",
    options: ["Summer", "Autumn", "Winter", "Monsoon"],
    a: "Summer",
  },
  {
    q: "Which is faster, sound or light?",
    options: ["Light", "Sound", "Same", "Depends"],
    a: "Light",
  },
  {
    q: "Which animal lays eggs?",
    options: ["Duck", "Dog", "Cat", "Cow"],
    a: "Duck",
  },
  {
    q: "Which is a mammal?",
    options: ["Whale", "Shark", "Trout", "Octopus"],
    a: "Whale",
  },
  {
    q: "What is the capital of France?",
    options: ["Paris", "Rome", "Madrid", "Berlin"],
    a: "Paris",
  },
  {
    q: "How many continents are there?",
    options: ["5", "6", "7", "8"],
    a: "7",
  },
  {
    q: "Which gas is most common in the air?",
    options: ["Nitrogen", "Oxygen", "Carbon dioxide", "Helium"],
    a: "Nitrogen",
  },
  {
    q: "Which month has the fewest days?",
    options: ["February", "April", "June", "September"],
    a: "February",
  },
  {
    q: "What do you call a baby dog?",
    options: ["Puppy", "Kitten", "Cub", "Calf"],
    a: "Puppy",
  },
  {
    q: "Which direction does the sun rise?",
    options: ["East", "West", "North", "South"],
    a: "East",
  },
  {
    q: "How many letters are in the English alphabet?",
    options: ["24", "25", "26", "27"],
    a: "26",
  },
  {
    q: "Which object tells time?",
    options: ["Clock", "Brush", "Spoon", "Bottle"],
    a: "Clock",
  },
  {
    q: "What is the largest mammal?",
    options: ["Blue whale", "Elephant", "Giraffe", "Hippo"],
    a: "Blue whale",
  },
  {
    q: "Which is the coldest continent?",
    options: ["Antarctica", "Europe", "Asia", "Africa"],
    a: "Antarctica",
  },
  {
    q: "Which fruit is yellow and curved?",
    options: ["Banana", "Apple", "Grape", "Pear"],
    a: "Banana",
  },
  {
    q: "What color is a stop sign?",
    options: ["Red", "Green", "Blue", "Yellow"],
    a: "Red",
  },
  {
    q: "How many wheels does a bicycle have?",
    options: ["1", "2", "3", "4"],
    a: "2",
  },
  {
    q: "Which planet do we live on?",
    options: ["Earth", "Mars", "Venus", "Saturn"],
    a: "Earth",
  },
  {
    q: "Which animal is known for a long neck?",
    options: ["Giraffe", "Bear", "Rabbit", "Fox"],
    a: "Giraffe",
  },
  {
    q: "Which shape is round?",
    options: ["Circle", "Square", "Triangle", "Rectangle"],
    a: "Circle",
  },
  {
    q: "How many minutes are in an hour?",
    options: ["30", "45", "60", "90"],
    a: "60",
  },
  {
    q: "Which is a primary color?",
    options: ["Blue", "Purple", "Green", "Orange"],
    a: "Blue",
  },
  {
    q: "What does a thermometer measure?",
    options: ["Temperature", "Speed", "Weight", "Distance"],
    a: "Temperature",
  },
  {
    q: "Which animal hops?",
    options: ["Kangaroo", "Elephant", "Dolphin", "Horse"],
    a: "Kangaroo",
  },
  {
    q: "Which planet is known for its blue color?",
    options: ["Neptune", "Mars", "Mercury", "Venus"],
    a: "Neptune",
  },
  {
    q: "What is the opposite of cold?",
    options: ["Hot", "Wet", "Dark", "Soft"],
    a: "Hot",
  },
  {
    q: "Which is the tallest animal?",
    options: ["Giraffe", "Elephant", "Zebra", "Lion"],
    a: "Giraffe",
  },
  {
    q: "Which is a vegetable?",
    options: ["Carrot", "Apple", "Grape", "Peach"],
    a: "Carrot",
  },
  {
    q: "How many legs does a spider have?",
    options: ["6", "8", "10", "12"],
    a: "8",
  },
  {
    q: "Which is a source of light?",
    options: ["Sun", "Rock", "Mud", "Leaf"],
    a: "Sun",
  },
  {
    q: "What is the capital of Italy?",
    options: ["Rome", "Milan", "Naples", "Turin"],
    a: "Rome",
  },
  {
    q: "Which tool is used to cut paper?",
    options: ["Scissors", "Spoon", "Brush", "Ruler"],
    a: "Scissors",
  },
  {
    q: "Which animal is known for its shell?",
    options: ["Turtle", "Dog", "Horse", "Rabbit"],
    a: "Turtle",
  },
  {
    q: "How many months are in a year?",
    options: ["10", "11", "12", "13"],
    a: "12",
  },
  {
    q: "Which is the largest bird?",
    options: ["Ostrich", "Eagle", "Parrot", "Sparrow"],
    a: "Ostrich",
  },
];

const QUICK_MATH_BANK = buildBank(50, (index) => {
  const a = 5 + (index % 9);
  const b = 3 + ((index * 2) % 7);
  const c = 1 + ((index * 3) % 9);
  return { a, b, c, result: a * b - c };
});

const TRUE_FALSE_BANK = buildBank(50, (index) => {
  const a = 2 + (index % 8);
  const b = 3 + ((index * 2) % 9);
  const correct = (index % 2) === 0;
  const result = a + b;
  const shown = correct ? result : result + ((index % 3) - 1 || 2);
  return { text: `${a} + ${b} = ${shown}`, correct };
});

const ODD_ONE_OUT_BASE = [
  { items: ["Apple", "Banana", "Orange"], odds: ["Car", "Chair", "Boat", "Phone", "Shoe"] },
  { items: ["Blue", "Green", "Red"], odds: ["Table", "Spoon", "Lamp", "Door", "Shoe"] },
  { items: ["Cat", "Dog", "Bird"], odds: ["Rock", "Chair", "Bowl", "Clock", "Book"] },
  { items: ["Circle", "Square", "Triangle"], odds: ["Spoon", "Glove", "Bottle", "Sock", "Cable"] },
  { items: ["Rose", "Tulip", "Daisy"], odds: ["Truck", "Pencil", "Cloud", "Plate", "Brick"] },
  { items: ["Piano", "Guitar", "Drum"], odds: ["Carpet", "Mirror", "Pillow", "Bottle", "Basket"] },
  { items: ["Milk", "Water", "Juice"], odds: ["Hammer", "Paint", "Stone", "Rope", "Papers"] },
  { items: ["Winter", "Spring", "Summer"], odds: ["Helmet", "Pillow", "Kettle", "Pocket", "Bridge"] },
  { items: ["Monday", "Tuesday", "Wednesday"], odds: ["Apple", "River", "Mountain", "Desk", "Mirror"] },
  { items: ["Gold", "Silver", "Bronze"], odds: ["Lemon", "Car", "Fence", "Board", "Shoe"] },
];

const ODD_ONE_OUT_BANK = buildBank(50, (index) => {
  const base = ODD_ONE_OUT_BASE[index % ODD_ONE_OUT_BASE.length];
  const odd = base.odds[index % base.odds.length];
  const rand = seededRandom(`odd-${index}`);
  const items = shuffle([...base.items, odd], rand);
  return { items, odd };
});

const WORD_SCRAMBLE_WORDS = [
  "planet",
  "mission",
  "galaxy",
  "rocket",
  "puzzle",
  "meteor",
  "signal",
  "comet",
  "nebula",
  "orbit",
  "launch",
  "module",
  "riddle",
  "cipher",
  "solver",
  "fusion",
  "matrix",
  "sensor",
  "compass",
  "vector",
  "target",
  "oxygen",
  "stellar",
  "cosmic",
  "cabin",
  "engine",
  "memory",
  "laser",
  "telescope",
  "terrain",
  "airlock",
  "payload",
  "landing",
  "gravity",
  "control",
  "pilot",
  "binary",
  "circuit",
  "trivia",
  "radar",
  "horizon",
  "station",
  "journey",
  "quantum",
  "cosmos",
  "orbiter",
  "capsule",
  "thruster",
  "docking",
  "beacon",
];

const EMOJI_GUESS_BANK = [
  { emoji: "\ud83c\udf27\ufe0f\ud83d\udca1", answer: "storm" },
  { emoji: "\ud83c\udf2e\ud83d\udc4d", answer: "taco" },
  { emoji: "\ud83e\uddc0\ud83c\udf55", answer: "cheese" },
  { emoji: "\ud83c\udf1f\ud83d\udcda", answer: "star" },
  { emoji: "\ud83d\udc36\ud83c\udfe0", answer: "dog" },
  { emoji: "\ud83d\udc22\ud83c\udf0a", answer: "turtle" },
  { emoji: "\ud83c\udf4c\ud83e\udd55", answer: "banana" },
  { emoji: "\ud83c\udf4e\ud83c\udf4f", answer: "apple" },
  { emoji: "\ud83c\udf4a\ud83c\udf4b", answer: "orange" },
  { emoji: "\ud83c\udf43\ud83c\udf3e", answer: "leaf" },
  { emoji: "\ud83d\udca1\ud83d\udca4", answer: "light" },
  { emoji: "\ud83d\ude80\ud83c\udf0d", answer: "rocket" },
  { emoji: "\ud83d\udd2d\ud83c\udf1d", answer: "moon" },
  { emoji: "\ud83c\udfa4\ud83c\udfb5", answer: "music" },
  { emoji: "\ud83c\udf81\ud83d\udce6", answer: "gift" },
  { emoji: "\ud83d\udd25\ud83e\udd64", answer: "hot" },
  { emoji: "\ud83c\udf0a\ud83c\udfe0", answer: "ocean" },
  { emoji: "\ud83d\udd2c\ud83e\uddea", answer: "lab" },
  { emoji: "\ud83d\ude97\ud83d\udca8", answer: "car" },
  { emoji: "\ud83c\udfc6\ud83c\udfc5", answer: "trophy" },
  { emoji: "\ud83d\udc6e\ud83d\udccc", answer: "police" },
  { emoji: "\ud83e\udde9\ud83d\udca1", answer: "idea" },
  { emoji: "\ud83d\udcd6\ud83d\udca1", answer: "book" },
  { emoji: "\ud83d\udcf7\ud83c\udf0e", answer: "camera" },
  { emoji: "\ud83d\udcf1\ud83d\udcde", answer: "phone" },
  { emoji: "\ud83c\udf0b\ud83d\udea2", answer: "volcano" },
  { emoji: "\ud83c\udfc3\ud83d\udca8", answer: "run" },
  { emoji: "\ud83c\udfaf\ud83c\udfaf", answer: "target" },
  { emoji: "\ud83d\udca7\ud83c\udf3c", answer: "water" },
  { emoji: "\ud83c\udfd6\ufe0f\ud83c\udf1e", answer: "beach" },
  { emoji: "\ud83c\udfc0\ud83c\udfc6", answer: "ball" },
  { emoji: "\ud83d\udea7\ud83d\udd27", answer: "repair" },
  { emoji: "\ud83d\udca3\ud83d\udca5", answer: "bomb" },
  { emoji: "\ud83d\udcca\ud83d\udcc8", answer: "chart" },
  { emoji: "\ud83d\udcdd\ud83d\udca1", answer: "note" },
  { emoji: "\ud83c\udfa8\ud83d\udd8c\ufe0f", answer: "paint" },
  { emoji: "\ud83d\udce1\ud83d\udcf6", answer: "signal" },
  { emoji: "\ud83c\udf81\ud83c\udf81", answer: "gift" },
  { emoji: "\ud83d\uddfa\ufe0f\ud83c\udf0d", answer: "map" },
  { emoji: "\ud83c\udf0c\ud83c\udf1f", answer: "night" },
  { emoji: "\ud83d\udca1\ud83d\udd12", answer: "lock" },
  { emoji: "\ud83d\udd2a\ud83c\udf5e", answer: "knife" },
  { emoji: "\ud83c\udfd7\ufe0f\ud83c\udfe2", answer: "city" },
  { emoji: "\ud83d\udce3\ud83d\udcc6", answer: "alarm" },
  { emoji: "\ud83c\udfb2\ud83d\udca1", answer: "game" },
  { emoji: "\ud83d\udd2d\ud83d\udca1", answer: "science" },
  { emoji: "\ud83c\udf0e\ud83d\udca1", answer: "world" },
  { emoji: "\ud83d\udcb0\ud83d\udcb8", answer: "money" },
  { emoji: "\ud83d\udcc5\ud83c\udf1e", answer: "calendar" },
  { emoji: "\ud83d\udef0\ufe0f\ud83d\ude80", answer: "satellite" },
];

const NUMBER_SEQUENCE_BANK = buildBank(50, (index) => {
  const start = 2 + (index % 8);
  const step = 1 + ((index * 3) % 5);
  const sequence = [start, start + step, start + step * 2];
  return { sequence, answer: start + step * 3 };
});

const SIMPLE_RIDDLE_BANK = [
  { q: "What has keys but cannot open locks?", a: "keyboard" },
  { q: "What has a face and two hands but no arms?", a: "clock" },
  { q: "What has many teeth but cannot bite?", a: "comb" },
  { q: "What gets wetter the more it dries?", a: "towel" },
  { q: "What goes up but never comes down?", a: "age" },
  { q: "What has words but never speaks?", a: "book" },
  { q: "What has a head and a tail but no body?", a: "coin" },
  { q: "What has a neck but no head?", a: "bottle" },
  { q: "What has legs but cannot walk?", a: "table" },
  { q: "What can you catch but not throw?", a: "cold" },
  { q: "What has a ring but no finger?", a: "phone" },
  { q: "What can travel around the world while staying in a corner?", a: "stamp" },
  { q: "What has one eye but cannot see?", a: "needle" },
  { q: "What can be broken without being touched?", a: "promise" },
  { q: "What has cities but no houses, forests but no trees?", a: "map" },
  { q: "What runs but never walks?", a: "water" },
  { q: "What has a thumb and four fingers but no hand?", a: "glove" },
  { q: "What has a bed but never sleeps?", a: "river" },
  { q: "What has a spine but no bones?", a: "book" },
  { q: "What can fill a room but takes no space?", a: "light" },
  { q: "What gets bigger the more you take away?", a: "hole" },
  { q: "What has an eye but cannot see?", a: "storm" },
  { q: "What has one head, one foot, and four legs?", a: "bed" },
  { q: "What is full of holes but still holds water?", a: "sponge" },
  { q: "What can you hold without touching?", a: "breath" },
  { q: "What has a bark but no bite?", a: "tree" },
  { q: "What is always in front of you but cannot be seen?", a: "future" },
  { q: "What goes up when rain comes down?", a: "umbrella" },
  { q: "What can be cracked, made, told, and played?", a: "joke" },
  { q: "What has four wheels and flies?", a: "garbage" },
  { q: "What is black when clean and white when dirty?", a: "chalkboard" },
  { q: "What begins with E and ends with E but has one letter?", a: "envelope" },
  { q: "What has a tongue but cannot talk?", a: "shoe" },
  { q: "What can you hear but not see or touch?", a: "sound" },
  { q: "What has a bank but no money?", a: "river" },
  { q: "What is so fragile that saying its name breaks it?", a: "silence" },
  { q: "What has four fingers and a thumb but is not alive?", a: "glove" },
  { q: "What has an eye but cannot wink?", a: "needle" },
  { q: "What has a tail but no body?", a: "coin" },
  { q: "What is made of water but sinks in water?", a: "ice" },
  { q: "What can you keep after giving to someone?", a: "word" },
  { q: "What gets sharper the more you use it?", a: "brain" },
  { q: "What has a foot but no legs?", a: "ruler" },
  { q: "What has keys but no locks and space but no room?", a: "keyboard" },
  { q: "What can you open but not close?", a: "book" },
  { q: "What can be read but never speaks?", a: "book" },
  { q: "What has a lid but no box?", a: "jar" },
  { q: "What has a head but no brain?", a: "lettuce" },
  { q: "What has a mouth but never eats?", a: "river" },
  { q: "What has hands but cannot clap?", a: "clock" },
  { q: "What can be folded but not touched?", a: "paper" },
];

const FAST_TRIVIA_BANK = [
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
  { q: "Which animal is known for black and white stripes?", options: ["Zebra", "Tiger", "Horse", "Panda"], a: "Zebra" },
  { q: "Which planet is closest to the sun?", options: ["Mercury", "Earth", "Venus", "Mars"], a: "Mercury" },
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
  { q: "Which metal is used in wiring?", options: ["Copper", "Gold", "Silver", "Iron"], a: "Copper" },
  { q: "Which animal is known for its long neck?", options: ["Giraffe", "Camel", "Llama", "Deer"], a: "Giraffe" },
  { q: "What is the largest ocean on Earth?", options: ["Pacific", "Atlantic", "Indian", "Arctic"], a: "Pacific" },
  { q: "Which planet has the Great Red Spot?", options: ["Jupiter", "Mars", "Venus", "Mercury"], a: "Jupiter" },
  { q: "Which sport uses a bat and ball?", options: ["Baseball", "Soccer", "Tennis", "Hockey"], a: "Baseball" },
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
  { q: "Which planet is known for its reddish color?", options: ["Mars", "Venus", "Earth", "Neptune"], a: "Mars" },
  { q: "Which is the tallest animal?", options: ["Giraffe", "Elephant", "Zebra", "Lion"], a: "Giraffe" },
  { q: "Which instrument measures temperature?", options: ["Thermometer", "Barometer", "Compass", "Altimeter"], a: "Thermometer" },
  { q: "Which is the largest planet in our solar system?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], a: "Jupiter" },
  { q: "Which country is famous for pizza?", options: ["Italy", "France", "Spain", "Germany"], a: "Italy" },
  { q: "Which is the smallest continent?", options: ["Australia", "Europe", "Antarctica", "South America"], a: "Australia" },
  { q: "Which is the capital of the UK?", options: ["London", "Manchester", "Bristol", "Liverpool"], a: "London" },
];

const COLOR_MATCH_BASE = [
  { word: "Sky", color: "Blue" },
  { word: "Grass", color: "Green" },
  { word: "Sun", color: "Yellow" },
  { word: "Coal", color: "Black" },
  { word: "Snow", color: "White" },
  { word: "Orange", color: "Orange" },
  { word: "Apple", color: "Red" },
  { word: "Grape", color: "Purple" },
  { word: "Lemon", color: "Yellow" },
  { word: "Ocean", color: "Blue" },
];

const COLOR_MATCH_MODS = ["Bright", "Dark", "Soft", "Bold", "Light"];

const COLOR_MATCH_BANK = buildBank(50, (index) => {
  const base = COLOR_MATCH_BASE[index % COLOR_MATCH_BASE.length];
  const mod = COLOR_MATCH_MODS[Math.floor(index / COLOR_MATCH_BASE.length) % COLOR_MATCH_MODS.length];
  return { word: `${mod} ${base.word}`, color: base.color };
});

const MISSING_LETTER_WORDS = [
  "mystery",
  "mission",
  "planet",
  "signal",
  "galaxy",
  "rocket",
  "puzzle",
  "vector",
  "sensor",
  "module",
  "launch",
  "cipher",
  "orbit",
  "lunar",
  "nebula",
  "comet",
  "meteor",
  "radar",
  "fusion",
  "cosmic",
  "engine",
  "target",
  "oxygen",
  "gravity",
  "control",
  "circuit",
  "matrix",
  "pilot",
  "system",
  "energy",
  "hazard",
  "memory",
  "portal",
  "binary",
  "cargo",
  "payload",
  "station",
  "horizon",
  "scanner",
  "journey",
  "capsule",
  "airlock",
  "thruster",
  "beacon",
  "compass",
  "terrain",
  "starlight",
  "satellite",
  "decoder",
  "receiver",
];

const QUICK_ARRANGE_SETS = [
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
  ["Quiet", "Loud", "Thunder"],
  ["Dawn", "Noon", "Dusk"],
  ["Solid", "Liquid", "Gas"],
  ["Inhale", "Hold", "Exhale"],
  ["North", "Center", "South"],
  ["Step", "Jog", "Run"],
  ["Tiny", "Small", "Large"],
  ["Leaf", "Flower", "Fruit"],
];

const QUICK_ARRANGE_BANK = buildBank(50, (index) => {
  const items = QUICK_ARRANGE_SETS[index % QUICK_ARRANGE_SETS.length];
  return { items, answer: items.join(", ") };
});

const BASIC_LOGIC_BANK = buildBank(50, (index) => {
  const letters = ["A", "B", "C", "D"];
  const first = letters[index % letters.length];
  const second = letters[(index + 1) % letters.length];
  const third = letters[(index + 2) % letters.length];
  return {
    text: `${first} > ${second} and ${second} > ${third}. Who is smallest?`,
    options: [first, second, third],
    answer: third,
  };
});

const OBJECT_COUNT_ICONS = ["\ud83d\udd38", "\ud83d\udd39", "\ud83d\udd3a", "\ud83d\udd3b", "\ud83d\udfe2"];
const OBJECT_COUNT_BANK = buildBank(50, (index) => {
  const count = 4 + (index % 9);
  const icon = OBJECT_COUNT_ICONS[index % OBJECT_COUNT_ICONS.length];
  return { count, icon };
});

const SIMPLE_PATTERN_BANK = buildBank(50, (index) => {
  const symbols = ["\u25b2", "\u25a0", "\u25cf", "\u2605", "\u25c6"];
  const a = symbols[index % symbols.length];
  const b = symbols[(index + 2) % symbols.length];
  return { sequence: [a, b, a, b], answer: b, options: symbols };
});

function GameArt({ asset }: { asset: string }) {
  return (
    <div className="game-art" style={{ backgroundImage: `url(/games/${asset}.png)` }}>
      <span className="game-art-label">/public/games/{asset}.png</span>
    </div>
  );
}

function RapidQuiz({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    return pickFromBank(seed, "rapid", RAPID_QUIZ_BANK);
  }, [seed]);

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

function QuickMath({ seed, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    return pickFromBank(seed, "math", QUICK_MATH_BANK);
  }, [seed]);

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
          onClick={() =>
            onComplete({
              success: Number(answer) === data.result,
              details: "Math result",
            })
          }
        >
          Check
        </button>
      </div>
    </div>
  );
}

function TrueFalse({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    return pickFromBank(seed, "tf", TRUE_FALSE_BANK);
  }, [seed]);

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

function OddOneOut({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    return pickFromBank(seed, "odd", ODD_ONE_OUT_BANK);
  }, [seed]);

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

function WordScramble({ seed, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    const rand = seededRandom(seed + "scramble");
    const word = pickFromBank(seed, "scramble", WORD_SCRAMBLE_WORDS);
    const scrambled = shuffle(word.split(""), rand).join("");
    return { word, scrambled };
  }, [seed]);

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
          onClick={() =>
            onComplete({
              success: answer.trim().toLowerCase() === data.word,
              details: "Scramble",
            })
          }
        >
          Check
        </button>
      </div>
    </div>
  );
}

function EmojiGuess({ seed, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    return pickFromBank(seed, "emoji", EMOJI_GUESS_BANK);
  }, [seed]);

  return (
    <div className="game-panel">
      <GameArt asset="emoji-guess" />
      <p className="game-question">Decode: {data.emoji}</p>
      <div className="game-input-row">
        <input
          className="input-field"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Your guess"
          disabled={disabled}
        />
        <button
          type="button"
          className="button-primary"
          disabled={disabled}
          onClick={() =>
            onComplete({
              success: answer.trim().toLowerCase() === data.answer,
              details: "Emoji guess",
            })
          }
        >
          Check
        </button>
      </div>
    </div>
  );
}

function NumberSequence({ seed, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    return pickFromBank(seed, "sequence", NUMBER_SEQUENCE_BANK);
  }, [seed]);

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
          onClick={() =>
            onComplete({
              success: Number(answer) === data.answer,
              details: "Sequence",
            })
          }
        >
          Check
        </button>
      </div>
    </div>
  );
}

function SimpleRiddle({ seed, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    return pickFromBank(seed, "riddle", SIMPLE_RIDDLE_BANK);
  }, [seed]);

  return (
    <div className="game-panel">
      <GameArt asset="simple-riddle" />
      <p className="game-question">{data.q}</p>
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
          onClick={() =>
            onComplete({
              success: answer.trim().toLowerCase() === data.a,
              details: "Riddle",
            })
          }
        >
          Check
        </button>
      </div>
    </div>
  );
}

function FastTrivia({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    return pickFromBank(seed, "trivia", FAST_TRIVIA_BANK);
  }, [seed]);

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

function ColorMatch({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    const rand = seededRandom(seed + "color");
    const pick = pickFromBank(seed, "color", COLOR_MATCH_BANK);
    const palette = [
      "Blue",
      "Green",
      "Yellow",
      "Red",
      "Purple",
      "Orange",
      "Black",
      "White",
      "Brown",
      "Gray",
    ];
    const options = shuffle(
      [pick.color, ...palette.filter((color) => color !== pick.color)],
      rand,
    ).slice(0, 4);
    return { ...pick, options };
  }, [seed]);

  return (
    <div className="game-panel">
      <GameArt asset="color-match" />
      <p className="game-question">Match: {data.word}</p>
      <div className="game-options">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className="game-option"
            disabled={disabled}
            onClick={() =>
              onComplete({
                success: option === data.color,
                details: "Color match",
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

function MissingLetter({ seed, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    const rand = seededRandom(seed + "missing");
    const word = pickFromBank(seed, "missing", MISSING_LETTER_WORDS);
    const index = Math.floor(rand() * word.length);
    const masked = word.slice(0, index) + "_" + word.slice(index + 1);
    return { masked, letter: word[index] };
  }, [seed]);

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
          onClick={() =>
            onComplete({
              success: answer.trim().toLowerCase() === data.letter,
              details: "Missing letter",
            })
          }
        >
          Check
        </button>
      </div>
    </div>
  );
}

function QuickArrange({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    const rand = seededRandom(seed + "arrange");
    const pick = pickFromBank(seed, "arrange", QUICK_ARRANGE_BANK);
    const options = shuffle(
      [
        pick.answer,
        `${pick.items[1]}, ${pick.items[2]}, ${pick.items[0]}`,
        `${pick.items[2]}, ${pick.items[0]}, ${pick.items[1]}`,
      ],
      rand,
    );
    return { prompt: pick.items, options, answer: pick.answer };
  }, [seed]);

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

function BasicLogic({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    return pickFromBank(seed, "logic", BASIC_LOGIC_BANK);
  }, [seed]);

  return (
    <div className="game-panel">
      <GameArt asset="basic-logic" />
      <p className="game-question">{data.text}</p>
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
                details: "Logic",
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

function ObjectCount({ seed, disabled, onComplete }: MiniGameProps) {
  const [answer, setAnswer] = useState("");
  const data = useMemo(() => {
    return pickFromBank(seed, "count", OBJECT_COUNT_BANK);
  }, [seed]);

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
          onClick={() =>
            onComplete({
              success: Number(answer) === data.count,
              details: "Count",
            })
          }
        >
          Check
        </button>
      </div>
    </div>
  );
}

function SimplePattern({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    const rand = seededRandom(seed + "pattern");
    const pick = pickFromBank(seed, "pattern", SIMPLE_PATTERN_BANK);
    const options = shuffle([...pick.options], rand).slice(0, 4);
    return { sequence: pick.sequence, answer: pick.answer, options };
  }, [seed]);

  return (
    <div className="game-panel">
      <GameArt asset="simple-pattern" />
      <p className="game-question">Complete: {data.sequence.join(" ")} ?</p>
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
                details: "Pattern",
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

export function getMiniGameConfig(title: string | null) {
  const normalized = (title ?? "").toLowerCase();
  return GAME_CONFIGS.find((config) => config.title.toLowerCase() === normalized) ?? null;
}

export function MiniGameRenderer({
  gameKey,
  seed,
  disabled,
  onComplete,
}: MiniGameProps & { gameKey: string }) {
  switch (gameKey) {
    case "rapid-quiz":
      return <RapidQuiz seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "quick-math":
      return <QuickMath seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "true-false":
      return <TrueFalse seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "odd-one-out":
      return <OddOneOut seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "word-scramble":
      return <WordScramble seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "emoji-guess":
      return <EmojiGuess seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "number-sequence":
      return <NumberSequence seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "simple-riddle":
      return <SimpleRiddle seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "fast-trivia":
      return <FastTrivia seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "color-match":
      return <ColorMatch seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "missing-letter":
      return <MissingLetter seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "quick-arrange":
      return <QuickArrange seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "basic-logic":
      return <BasicLogic seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "object-count":
      return <ObjectCount seed={seed} disabled={disabled} onComplete={onComplete} />;
    case "simple-pattern":
      return <SimplePattern seed={seed} disabled={disabled} onComplete={onComplete} />;
    default:
      return <RapidQuiz seed={seed} disabled={disabled} onComplete={onComplete} />;
  }
}

export function getGameAssets() {
  return GAME_CONFIGS.map((config) => ({ key: config.key, asset: config.asset }));
}
