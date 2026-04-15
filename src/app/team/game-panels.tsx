"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Seeded PRNG (keep exactly as is) ──
function seededRandom(seed: string): () => number {
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

// ── Shuffle with seed (keep exactly as is) ──
function shuffle<T>(array: T[], rand: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Pick from bank by index (keep exactly as is) ──
function pickFromBankIndexed<T>(
  seed: string,
  namespace: string,
  bank: T[],
  index: number,
): T {
  const order = shuffle(
    bank.map((_, idx) => idx),
    seededRandom(`${seed}-${namespace}-order`),
  );
  return bank[order[index % bank.length]];
}

export type MiniGameResult = { success: boolean; details: string };

export type MiniGameProps = {
  seed: string;
  questionIndex: number;
  disabled: boolean;
  onComplete: (result: MiniGameResult) => void;
};

type QuizQuestion = { q: string; options: [string, string, string, string]; a: string };
type TrueFalseQuestion = { statement: string; answer: boolean };
type OddOneOutQuestion = { items: [string, string, string, string]; odd: string };
type NumberSequenceQuestion = { sequence: [number, number, number]; answer: number };
type QuickMathQuestion = { display: string; answer: number; options: [number, number, number, number] };
type ObjectCountQuestion = { grid: string[]; target: string; count: number };
type WordScrambleQuestion = { word: string; scrambled: string; options: [string, string, string, string] };
type MissingLetterQuestion = { word: string; blankIndex: number; options: [string, string, string, string] };
type QuickArrangeQuestion = {
  items: [string, string, string];
  shuffled: [string, string, string];
  options: [string, string, string, string];
};

function toTuple4<T>(arr: T[]): [T, T, T, T] {
  return [arr[0], arr[1], arr[2], arr[3]];
}

function uniqueNumbers(values: number[], fallbackSeed: string): [number, number, number, number] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  const rand = seededRandom(fallbackSeed);
  while (out.length < 4) {
    const next = Math.floor(rand() * 100) + 1;
    if (!seen.has(next)) {
      seen.add(next);
      out.push(next);
    }
  }
  return [out[0], out[1], out[2], out[3]];
}

const RAPID_CAPITALS: Array<[string, string]> = [
  ["Australia", "Canberra"], ["Canada", "Ottawa"], ["Brazil", "Brasilia"], ["Japan", "Tokyo"],
  ["India", "New Delhi"], ["Turkey", "Ankara"], ["Egypt", "Cairo"], ["South Korea", "Seoul"],
  ["South Africa", "Pretoria"], ["Switzerland", "Bern"], ["New Zealand", "Wellington"],
  ["Nigeria", "Abuja"], ["Argentina", "Buenos Aires"], ["Thailand", "Bangkok"], ["Norway", "Oslo"],
  ["Sweden", "Stockholm"], ["Denmark", "Copenhagen"], ["Poland", "Warsaw"], ["Portugal", "Lisbon"],
  ["Austria", "Vienna"], ["Belgium", "Brussels"], ["Netherlands", "Amsterdam"], ["Finland", "Helsinki"],
  ["Ireland", "Dublin"], ["Pakistan", "Islamabad"], ["Indonesia", "Jakarta"], ["Malaysia", "Kuala Lumpur"],
  ["Kenya", "Nairobi"], ["Morocco", "Rabat"], ["Peru", "Lima"], ["Chile", "Santiago"],
  ["Colombia", "Bogota"], ["Greece", "Athens"], ["Hungary", "Budapest"], ["Czechia", "Prague"],
];

const RAPID_FACTS: Array<{ q: string; a: string; options: [string, string, string, string] }> = [
  { q: "Closest planet to Sun?", a: "Mercury", options: ["Mercury", "Venus", "Mars", "Earth"] },
  { q: "Largest planet?", a: "Jupiter", options: ["Jupiter", "Saturn", "Neptune", "Earth"] },
  { q: "Hottest planet?", a: "Venus", options: ["Venus", "Mercury", "Mars", "Jupiter"] },
  { q: "Gas plants absorb?", a: "Carbon dioxide", options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Helium"] },
  { q: "Chemical symbol for gold?", a: "Au", options: ["Au", "Ag", "Gd", "Go"] },
  { q: "Hardest natural substance?", a: "Diamond", options: ["Diamond", "Quartz", "Granite", "Iron"] },
  { q: "Largest ocean?", a: "Pacific", options: ["Pacific", "Atlantic", "Indian", "Arctic"] },
  { q: "Fastest land animal?", a: "Cheetah", options: ["Cheetah", "Leopard", "Gazelle", "Tiger"] },
  { q: "Tallest mountain?", a: "Everest", options: ["Everest", "K2", "Kilimanjaro", "Denali"] },
  { q: "Smallest prime number?", a: "2", options: ["2", "1", "3", "5"] },
  { q: "Square root of 81?", a: "9", options: ["9", "8", "7", "6"] },
  { q: "Water boils at sea level?", a: "100°C", options: ["100°C", "90°C", "80°C", "110°C"] },
  { q: "How many continents?", a: "7", options: ["7", "6", "5", "8"] },
  { q: "How many sides hexagon?", a: "6", options: ["6", "5", "7", "8"] },
  { q: "Largest mammal?", a: "Blue whale", options: ["Blue whale", "Elephant", "Giraffe", "Hippo"] },
  { q: "Planet with rings?", a: "Saturn", options: ["Saturn", "Jupiter", "Mars", "Venus"] },
  { q: "Who wrote Hamlet?", a: "Shakespeare", options: ["Shakespeare", "Dickens", "Homer", "Twain"] },
  { q: "First month of year?", a: "January", options: ["January", "March", "December", "June"] },
  { q: "What is H2O?", a: "Water", options: ["Water", "Hydrogen", "Oxygen", "Salt"] },
  { q: "Main gas in air?", a: "Nitrogen", options: ["Nitrogen", "Oxygen", "Argon", "Carbon dioxide"] },
  { q: "Which metal is liquid?", a: "Mercury", options: ["Mercury", "Gallium", "Silver", "Aluminum"] },
  { q: "Currency of Japan?", a: "Yen", options: ["Yen", "Won", "Yuan", "Ringgit"] },
  { q: "Who painted Mona Lisa?", a: "Da Vinci", options: ["Da Vinci", "Van Gogh", "Picasso", "Monet"] },
  { q: "Olympic symbol has rings?", a: "Five", options: ["Five", "Four", "Six", "Seven"] },
  { q: "Animal called ship desert?", a: "Camel", options: ["Camel", "Horse", "Donkey", "Llama"] },
  { q: "Largest desert on Earth?", a: "Antarctica", options: ["Antarctica", "Sahara", "Gobi", "Arabian"] },
  { q: "How many bones adult?", a: "206", options: ["206", "201", "212", "198"] },
  { q: "Red Planet nickname?", a: "Mars", options: ["Mars", "Venus", "Mercury", "Jupiter"] },
  { q: "Earth satellite called?", a: "Moon", options: ["Moon", "Sun", "Mars", "Pluto"] },
  { q: "Instrument with keys?", a: "Piano", options: ["Piano", "Guitar", "Drum", "Violin"] },
  { q: "First element periodic table?", a: "Hydrogen", options: ["Hydrogen", "Helium", "Lithium", "Oxygen"] },
  { q: "Closest star to Earth?", a: "Sun", options: ["Sun", "Sirius", "Polaris", "Alpha Centauri"] },
  { q: "Largest internal organ?", a: "Liver", options: ["Liver", "Lung", "Heart", "Kidney"] },
  { q: "Language in Brazil?", a: "Portuguese", options: ["Portuguese", "Spanish", "French", "English"] },
  { q: "How many minutes hour?", a: "60", options: ["60", "50", "100", "30"] },
  { q: "How many hours day?", a: "24", options: ["24", "12", "18", "36"] },
  { q: "Device measures quakes?", a: "Seismograph", options: ["Seismograph", "Barometer", "Thermometer", "Compass"] },
  { q: "Animal with trunk?", a: "Elephant", options: ["Elephant", "Rhino", "Hippo", "Tapir"] },
  { q: "Fastest bird dive?", a: "Peregrine", options: ["Peregrine", "Eagle", "Falcon", "Hawk"] },
  { q: "Most spoken language?", a: "Mandarin", options: ["Mandarin", "English", "Spanish", "Hindi"] },
  { q: "Who discovered penicillin?", a: "Fleming", options: ["Fleming", "Curie", "Einstein", "Pasteur"] },
  { q: "Which blood type universal donor?", a: "O negative", options: ["O negative", "O positive", "AB negative", "A negative"] },
  { q: "Great Wall visible from Moon?", a: "No", options: ["No", "Yes", "Sometimes", "Only night"] },
  { q: "Capital city of USA?", a: "Washington", options: ["Washington", "New York", "Boston", "Chicago"] },
  { q: "Country shaped like boot?", a: "Italy", options: ["Italy", "Spain", "Portugal", "Greece"] },
  { q: "Which sport uses wickets?", a: "Cricket", options: ["Cricket", "Baseball", "Hockey", "Tennis"] },
  { q: "Inertia law by whom?", a: "Newton", options: ["Newton", "Galileo", "Einstein", "Kepler"] },
  { q: "Largest island world?", a: "Greenland", options: ["Greenland", "Iceland", "Borneo", "Madagascar"] },
  { q: "Smallest continent?", a: "Australia", options: ["Australia", "Europe", "Antarctica", "South America"] },
  { q: "First Olympics held where?", a: "Greece", options: ["Greece", "Italy", "France", "Egypt"] },
];

function buildRapidQuizBank(): QuizQuestion[] {
  const capitals = RAPID_CAPITALS.slice(0, 12).map((entry, i) => {
    const capitalsPool = RAPID_CAPITALS.map((x) => x[1]).filter((c) => c !== entry[1]);
    const rand = seededRandom(`rapid-capital-${i}`);
    const wrongs = shuffle(capitalsPool, rand).slice(0, 3);
    return {
      q: `Capital of ${entry[0]}?`,
      a: entry[1],
      options: toTuple4(shuffle([entry[1], wrongs[0], wrongs[1], wrongs[2]], seededRandom(`rapid-opt-${i}`))),
    };
  });
  const facts = RAPID_FACTS.map((item, i) => ({
    q: item.q,
    a: item.a,
    options: toTuple4(shuffle([...item.options], seededRandom(`rapid-fact-${i}`))),
  }));
  return [...facts, ...capitals, ...facts, ...facts].slice(0, 140);
}

const FAST_TRIVIA_RAW: QuizQuestion[] = [
  { q: "India won 2011 Cricket World Cup?", options: ["India", "Australia", "England", "Sri Lanka"], a: "India" },
  { q: "National animal of India?", options: ["Tiger", "Lion", "Elephant", "Leopard"], a: "Tiger" },
  { q: "Bollywood in which city?", options: ["Mumbai", "Delhi", "Kolkata", "Chennai"], a: "Mumbai" },
  { q: "Indian currency symbol?", options: ["₹", "$", "€", "¥"], a: "₹" },
  { q: "River through Varanasi?", options: ["Ganga", "Yamuna", "Godavari", "Narmada"], a: "Ganga" },
  { q: "Most IPL titles team?", options: ["Mumbai Indians", "CSK", "KKR", "RCB"], a: "Mumbai Indians" },
  { q: "Who is called Master Blaster?", options: ["Tendulkar", "Kohli", "Dhoni", "Dravid"], a: "Tendulkar" },
  { q: "India's southern tip?", options: ["Kanyakumari", "Rameswaram", "Kochi", "Goa"], a: "Kanyakumari" },
  { q: "Primary language in Pakistan?", options: ["Urdu", "Punjabi", "Hindi", "Bengali"], a: "Urdu" },
  { q: "Capital of Bangladesh?", options: ["Dhaka", "Chittagong", "Sylhet", "Khulna"], a: "Dhaka" },
  { q: "Dish: rice and lentils?", options: ["Khichdi", "Biryani", "Pulao", "Idli"], a: "Khichdi" },
  { q: "Festival of lights in India?", options: ["Diwali", "Holi", "Eid", "Onam"], a: "Diwali" },
  { q: "Taj Mahal city?", options: ["Agra", "Jaipur", "Lucknow", "Delhi"], a: "Agra" },
  { q: "India's space agency?", options: ["ISRO", "DRDO", "NASA", "JAXA"], a: "ISRO" },
  { q: "Who composed Jana Gana Mana?", options: ["Tagore", "Nehru", "Gandhi", "Bose"], a: "Tagore" },
  { q: "Capital of Nepal?", options: ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar"], a: "Kathmandu" },
  { q: "Indian state famous for tea?", options: ["Assam", "Punjab", "Goa", "Gujarat"], a: "Assam" },
  { q: "Who was first PM India?", options: ["Nehru", "Patel", "Indira", "Shastri"], a: "Nehru" },
  { q: "Samosa filling usually?", options: ["Potato", "Paneer", "Chicken", "Fish"], a: "Potato" },
  { q: "Which city is Pink City?", options: ["Jaipur", "Jodhpur", "Udaipur", "Bikaner"], a: "Jaipur" },
  { q: "Most FIFA World Cups?", options: ["Brazil", "Germany", "Italy", "Argentina"], a: "Brazil" },
  { q: "NBA legend called King?", options: ["LeBron", "Jordan", "Kobe", "Curry"], a: "LeBron" },
  { q: "Olympics held every?", options: ["4 years", "2 years", "3 years", "5 years"], a: "4 years" },
  { q: "Tennis surface at Wimbledon?", options: ["Grass", "Clay", "Hard", "Carpet"], a: "Grass" },
  { q: "Sport with touchdown?", options: ["American football", "Rugby", "Basketball", "Baseball"], a: "American football" },
  { q: "Michael Phelps sport?", options: ["Swimming", "Running", "Cycling", "Rowing"], a: "Swimming" },
  { q: "Formula 1 uses?", options: ["Open-wheel cars", "Bikes", "Rally cars", "Karts"], a: "Open-wheel cars" },
  { q: "Cricket has how many stumps?", options: ["3", "2", "4", "5"], a: "3" },
  { q: "NHL is which sport?", options: ["Ice hockey", "Basketball", "Baseball", "Soccer"], a: "Ice hockey" },
  { q: "Usain Bolt event?", options: ["Sprinting", "Marathon", "Long jump", "Hurdles"], a: "Sprinting" },
  { q: "Super Bowl is which sport?", options: ["American football", "Basketball", "Baseball", "Rugby"], a: "American football" },
  { q: "Badminton uses?", options: ["Shuttlecock", "Ball", "Puck", "Disc"], a: "Shuttlecock" },
  { q: "Highest score in tennis?", options: ["40", "30", "50", "45"], a: "40" },
  { q: "Tour de France is?", options: ["Cycling race", "Marathon", "Ski event", "Car race"], a: "Cycling race" },
  { q: "Table tennis ball color?", options: ["White", "Blue", "Green", "Black"], a: "White" },
  { q: "Olympic symbol has colors?", options: ["5", "4", "6", "7"], a: "5" },
  { q: "Wrestling ring shape usually?", options: ["Square", "Circle", "Triangle", "Oval"], a: "Square" },
  { q: "Chess world champion 2024?", options: ["Ding Liren", "Carlsen", "Nepo", "Anand"], a: "Ding Liren" },
  { q: "UEFA Champions League sport?", options: ["Football", "Cricket", "Hockey", "Basketball"], a: "Football" },
  { q: "Davis Cup is?", options: ["Tennis", "Golf", "Rugby", "Volleyball"], a: "Tennis" },
  { q: "Iron Man is from?", options: ["Marvel", "DC", "Image", "Dark Horse"], a: "Marvel" },
  { q: "Hogwarts appears in?", options: ["Harry Potter", "Narnia", "Twilight", "Avatar"], a: "Harry Potter" },
  { q: "Who is Batman's city?", options: ["Gotham", "Metropolis", "Star City", "Central City"], a: "Gotham" },
  { q: "Elsa is from?", options: ["Frozen", "Moana", "Tangled", "Brave"], a: "Frozen" },
  { q: "Avatar director?", options: ["James Cameron", "Spielberg", "Nolan", "Scorsese"], a: "James Cameron" },
  { q: "Singer of Thriller?", options: ["Michael Jackson", "Prince", "Madonna", "Elvis"], a: "Michael Jackson" },
  { q: "One Piece genre?", options: ["Anime", "Sitcom", "Documentary", "Soap"], a: "Anime" },
  { q: "Movie with Joker 2019?", options: ["Joker", "Batman", "Suicide Squad", "Watchmen"], a: "Joker" },
  { q: "Who plays Jack Sparrow?", options: ["Johnny Depp", "Brad Pitt", "Tom Cruise", "Will Smith"], a: "Johnny Depp" },
  { q: "Streaming giant with N logo?", options: ["Netflix", "Hulu", "Prime", "Disney+"], a: "Netflix" },
  { q: "Wakanda belongs to?", options: ["Black Panther", "Iron Man", "Thor", "Hulk"], a: "Black Panther" },
  { q: "The Beatles were from?", options: ["Liverpool", "London", "Manchester", "Dublin"], a: "Liverpool" },
  { q: "Taylor Swift album 2024?", options: ["Tortured Poets", "Midnights", "Lover", "Reputation"], a: "Tortured Poets" },
  { q: "Blue alien movie 2009?", options: ["Avatar", "Dune", "Interstellar", "Prometheus"], a: "Avatar" },
  { q: "Who says 'I am Groot'?", options: ["Groot", "Rocket", "Drax", "Gamora"], a: "Groot" },
  { q: "Sonic is what animal?", options: ["Hedgehog", "Fox", "Cat", "Rabbit"], a: "Hedgehog" },
  { q: "K-pop group BTS from?", options: ["South Korea", "Japan", "China", "Thailand"], a: "South Korea" },
  { q: "Sherlock Holmes creator?", options: ["Conan Doyle", "Agatha Christie", "Rowling", "Tolkien"], a: "Conan Doyle" },
  { q: "Pixar lamp mascot?", options: ["Luxo", "Nemo", "Woody", "Buzz"], a: "Luxo" },
  { q: "Mario's brother?", options: ["Luigi", "Wario", "Yoshi", "Toad"], a: "Luigi" },
  { q: "First country on Moon?", options: ["USA", "USSR", "China", "France"], a: "USA" },
  { q: "What does CPU stand for?", options: ["Central Processing Unit", "Computer Power Unit", "Core Program Utility", "Control Process User"], a: "Central Processing Unit" },
  { q: "Most used phone OS?", options: ["Android", "iOS", "Windows", "Linux"], a: "Android" },
  { q: "Binary uses digits?", options: ["0 and 1", "1 and 2", "0 to 9", "A and B"], a: "0 and 1" },
  { q: "Web pages use language?", options: ["HTML", "SQL", "C", "Swift"], a: "HTML" },
  { q: "AI stands for?", options: ["Artificial Intelligence", "Automated Internet", "Adaptive Interface", "Auto Input"], a: "Artificial Intelligence" },
  { q: "Storage measured in?", options: ["Bytes", "Meters", "Watts", "Liters"], a: "Bytes" },
  { q: "Search engine by Google?", options: ["Google Search", "Bing", "DuckDuckGo", "Yahoo"], a: "Google Search" },
  { q: "Cloud means data on?", options: ["Remote servers", "USB drives", "CD disks", "SIM cards"], a: "Remote servers" },
  { q: "USB-C is a?", options: ["Connector", "Battery", "Screen", "App"], a: "Connector" },
  { q: "Programming language by Guido?", options: ["Python", "Java", "C#", "Ruby"], a: "Python" },
  { q: "HTTP is for?", options: ["Web transfer", "Audio files", "Video games", "Printing"], a: "Web transfer" },
  { q: "5G relates to?", options: ["Mobile network", "Graphics card", "Game genre", "Storage"], a: "Mobile network" },
  { q: "QR code stores?", options: ["Data", "Electricity", "Heat", "Sound"], a: "Data" },
  { q: "App store for iPhone?", options: ["App Store", "Play Store", "Galaxy Store", "Aptoide"], a: "App Store" },
  { q: "GPU handles mostly?", options: ["Graphics", "Emails", "Typing", "Networking"], a: "Graphics" },
  { q: "Who discovered America 1492?", options: ["Columbus", "Magellan", "Cook", "Vespucci"], a: "Columbus" },
  { q: "World War II ended in?", options: ["1945", "1944", "1946", "1939"], a: "1945" },
  { q: "Pyramids are in?", options: ["Egypt", "Mexico", "India", "Peru"], a: "Egypt" },
  { q: "Roman numeral for 50?", options: ["L", "X", "V", "C"], a: "L" },
  { q: "Great Wall is in?", options: ["China", "Japan", "Mongolia", "Korea"], a: "China" },
  { q: "Liberty statue city?", options: ["New York", "Boston", "Chicago", "LA"], a: "New York" },
  { q: "Largest country area?", options: ["Russia", "Canada", "China", "USA"], a: "Russia" },
  { q: "Suez Canal connects?", options: ["Mediterranean-Red Sea", "Atlantic-Pacific", "Black-Caspian", "Arctic-Atlantic"], a: "Mediterranean-Red Sea" },
  { q: "Where is Machu Picchu?", options: ["Peru", "Chile", "Bolivia", "Ecuador"], a: "Peru" },
  { q: "Berlin Wall fell in?", options: ["1989", "1991", "1985", "1979"], a: "1989" },
  { q: "Country with Eiffel Tower?", options: ["France", "Italy", "Spain", "Belgium"], a: "France" },
  { q: "Ancient Olympics birthplace?", options: ["Olympia", "Athens", "Sparta", "Rome"], a: "Olympia" },
  { q: "Who was Cleopatra?", options: ["Egyptian queen", "Roman empress", "Greek poet", "Persian ruler"], a: "Egyptian queen" },
  { q: "Time zone UTC starts at?", options: ["Greenwich", "Paris", "New York", "Tokyo"], a: "Greenwich" },
  { q: "Continent with Amazon rainforest?", options: ["South America", "Africa", "Asia", "Europe"], a: "South America" },
];

const TRUE_FALSE_FACTS: TrueFalseQuestion[] = [
  { statement: "Honey never expires.", answer: true },
  { statement: "Bats are blind.", answer: false },
  { statement: "The Great Wall is visible from Moon.", answer: false },
  { statement: "A group of flamingos is flamboyance.", answer: true },
  { statement: "Humans have five senses only.", answer: false },
  { statement: "Lightning is hotter than Sun surface.", answer: true },
  { statement: "Bananas grow on trees.", answer: false },
  { statement: "Octopus has three hearts.", answer: true },
  { statement: "Sharks are mammals.", answer: false },
  { statement: "Tomatoes are botanically fruits.", answer: true },
  { statement: "Sound travels faster than light.", answer: false },
  { statement: "Venus rotates opposite most planets.", answer: true },
  { statement: "Goldfish memory lasts three seconds.", answer: false },
  { statement: "Water expands when freezing.", answer: true },
  { statement: "The Sun is a planet.", answer: false },
  { statement: "Koalas are bears.", answer: false },
  { statement: "Polar bears have black skin.", answer: true },
  { statement: "Mount Everest keeps growing slightly.", answer: true },
  { statement: "Humans can breathe in space unaided.", answer: false },
  { statement: "An ostrich can fly briefly.", answer: false },
  { statement: "Jellyfish have no brain.", answer: true },
  { statement: "Camels store water in humps.", answer: false },
  { statement: "Earth has one natural moon.", answer: true },
  { statement: "Pluto is still a major planet.", answer: false },
  { statement: "Vatican City is a country.", answer: true },
  { statement: "Coffee is made from berries.", answer: true },
  { statement: "Mammals lay eggs rarely.", answer: true },
  { statement: "Penguins live only at North Pole.", answer: false },
  { statement: "The Pacific is smallest ocean.", answer: false },
  { statement: "Lightning never strikes same place twice.", answer: false },
];

const TRUE_FALSE_MISCONCEPTIONS: TrueFalseQuestion[] = [
  { statement: "Humans use only ten percent brain.", answer: false },
  { statement: "Sugar makes kids hyperactive.", answer: false },
  { statement: "Cracking knuckles causes arthritis.", answer: false },
  { statement: "Bulls hate red color.", answer: false },
  { statement: "Vikings wore horned helmets.", answer: false },
  { statement: "Napoleon was very short.", answer: false },
  { statement: "Glass is actually liquid.", answer: false },
  { statement: "You lose most heat from head.", answer: false },
  { statement: "Hair and nails grow after death.", answer: false },
  { statement: "Chameleons match any background perfectly.", answer: false },
  { statement: "Coriolis drains differ by hemisphere visibly.", answer: false },
  { statement: "Deserts are always hot.", answer: false },
  { statement: "Diamonds form from compressed coal.", answer: false },
  { statement: "Bamboo is a grass.", answer: true },
  { statement: "Humans and dinosaurs coexisted.", answer: false },
  { statement: "Venus is closest planet to Earth always.", answer: false },
  { statement: "The Moon has no gravity.", answer: false },
  { statement: "Einstein failed school math.", answer: false },
  { statement: "Pirates mostly buried treasure chests.", answer: false },
  { statement: "Sydney is capital of Australia.", answer: false },
  { statement: "Africa is a country.", answer: false },
  { statement: "Pandas hibernate every winter.", answer: false },
  { statement: "Human blood is blue in veins.", answer: false },
  { statement: "Cambridge is UK capital.", answer: false },
  { statement: "Mercury is hottest planet.", answer: false },
  { statement: "Spiders are insects.", answer: false },
  { statement: "Bacteria are always harmful.", answer: false },
  { statement: "The tongue has separate taste zones.", answer: false },
  { statement: "Mount Kilimanjaro is in Kenya.", answer: false },
  { statement: "Lightning only strikes during rain.", answer: false },
];

function buildTrueFalseMath(): TrueFalseQuestion[] {
  const rows: TrueFalseQuestion[] = [];
  for (let i = 2; i <= 11; i++) {
    const correct = i * 8;
    rows.push({ statement: `${i} × 8 = ${correct}`, answer: true });
    rows.push({ statement: `${i} × 8 = ${correct + 1}`, answer: false });
    rows.push({ statement: `${i} × 7 = ${i * 7 - 1}`, answer: false });
  }
  return rows.slice(0, 30);
}

const ODD_TEMPLATE: Array<{ group: [string, string, string]; odds: [string, string, string] }> = [
  { group: ["Mercury", "Venus", "Earth"], odds: ["Pluto", "Neptune", "Mars"] },
  { group: ["Monday", "March", "July"], odds: ["August", "Friday", "June"] },
  { group: ["Iron", "Gold", "Copper"], odds: ["Steel", "Brass", "Bronze"] },
  { group: ["Eagle", "Sparrow", "Pigeon"], odds: ["Bat", "Whale", "Rabbit"] },
  { group: ["Shirt", "Pants", "Jacket"], odds: ["Apron", "Spoon", "Fork"] },
  { group: ["Apple", "Banana", "Orange"], odds: ["Tomato", "Potato", "Carrot"] },
  { group: ["Cat", "Dog", "Horse"], odds: ["Wolf", "Lion", "Lizard"] },
  { group: ["Circle", "Square", "Triangle"], odds: ["Cube", "Rectangle", "Oval"] },
  { group: ["Ruby", "Python", "Java"], odds: ["SQL", "HTML", "Cobalt"] },
  { group: ["Copper", "Silver", "Gold"], odds: ["Bronze", "Brass", "Platinum"] },
  { group: ["Dribble", "Pass", "Shoot"], odds: ["Serve", "Spike", "Dunk"] },
  { group: ["Hydrogen", "Oxygen", "Nitrogen"], odds: ["Water", "Helium", "Carbon"] },
  { group: ["Paris", "Rome", "Madrid"], odds: ["Berlin", "Sydney", "Lisbon"] },
  { group: ["Pen", "Pencil", "Marker"], odds: ["Eraser", "Paper", "Keyboard"] },
  { group: ["Rose", "Tulip", "Lily"], odds: ["Sunflower", "Oak", "Fern"] },
  { group: ["Sine", "Cosine", "Tangent"], odds: ["Cotangent", "Logarithm", "Secant"] },
  { group: ["Milk", "Cheese", "Yogurt"], odds: ["Butter", "Bread", "Cream"] },
  { group: ["CPU", "GPU", "RAM"], odds: ["SSD", "Monitor", "Cache"] },
  { group: ["Hindi", "Tamil", "Bengali"], odds: ["Urdu", "Punjabi", "Nepali"] },
  { group: ["A", "E", "I"], odds: ["O", "U", "B"] },
  { group: ["Saturn", "Jupiter", "Uranus"], odds: ["Neptune", "Venus", "Mars"] },
  { group: ["Chess", "Checkers", "Go"], odds: ["Ludo", "Poker", "Carrom"] },
  { group: ["January", "April", "August"], odds: ["December", "Monday", "October"] },
  { group: ["Violin", "Cello", "Viola"], odds: ["Guitar", "Flute", "Harp"] },
  { group: ["Triangle", "Pyramid", "Cone"], odds: ["Cylinder", "Circle", "Prism"] },
  { group: ["Falcon", "Hawk", "Kite"], odds: ["Eagle", "Penguin", "Owl"] },
  { group: ["Mercury", "Gold", "Silver"], odds: ["Aluminum", "Steel", "Lead"] },
  { group: ["Dolphin", "Whale", "Seal"], odds: ["Shark", "Octopus", "Penguin"] },
  { group: ["Google", "Bing", "DuckDuckGo"], odds: ["Firefox", "Yahoo", "Baidu"] },
  { group: ["Spring", "Summer", "Autumn"], odds: ["Monsoon", "Winter", "Noon"] },
];

function buildOddOneOutBank(): OddOneOutQuestion[] {
  const out: OddOneOutQuestion[] = [];
  ODD_TEMPLATE.forEach((tpl, i) => {
    tpl.odds.forEach((odd, j) => {
      const items = shuffle([tpl.group[0], tpl.group[1], tpl.group[2], odd], seededRandom(`odd-${i}-${j}`));
      out.push({ items: toTuple4(items), odd });
    });
  });
  return out;
}

function buildNumberSequenceBank(): NumberSequenceQuestion[] {
  const out: NumberSequenceQuestion[] = [];
  for (let step = 2; step <= 15; step++) {
    for (let start = 1; start <= 3; start++) {
      out.push({
        sequence: [start, start + step, start + step * 2],
        answer: start + step * 3,
      });
    }
  }
  for (const mul of [2, 3]) {
    for (let start = 1; start <= 12; start++) {
      out.push({
        sequence: [start, start * mul, start * mul * mul],
        answer: start * mul * mul * mul,
      });
    }
  }
  for (let n = 1; n <= 15; n++) {
    out.push({ sequence: [n * n, (n + 1) * (n + 1), (n + 2) * (n + 2)], answer: (n + 3) * (n + 3) });
  }
  for (let i = 1; i <= 20; i++) {
    out.push({ sequence: [i, i + 2, i + 5], answer: i + 9 });
  }
  for (let start = 40; start >= 18; start -= 2) {
    out.push({ sequence: [start, start - 3, start - 6], answer: start - 9 });
  }
  const fibs = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  for (let i = 0; i < fibs.length - 3; i++) {
    out.push({ sequence: [fibs[i], fibs[i + 1], fibs[i + 2]], answer: fibs[i + 3] });
  }
  return [...out, ...out].slice(0, 140);
}

function buildQuickMathBank(): QuickMathQuestion[] {
  const out: QuickMathQuestion[] = [];
  const makeOptions = (answer: number, a: number, b: number): [number, number, number, number] => {
    const values = uniqueNumbers(
      [answer, answer + 1, answer - 1, answer + a, answer - b, a * b, a + b, Math.abs(a - b)],
      `qm-${answer}-${a}-${b}`,
    );
    return toTuple4(shuffle([...values], seededRandom(`qm-opt-${answer}-${a}-${b}`)));
  };

  for (let a = 5; a <= 24; a++) {
    const b = (a % 9) + 3;
    const answer = a + b;
    out.push({ display: `${a} + ${b} = ?`, answer, options: makeOptions(answer, a, b) });
  }
  for (let a = 2; a <= 12; a++) {
    for (let b = 2; b <= 9; b += 2) {
      const answer = a * b;
      out.push({ display: `${a} × ${b} = ?`, answer, options: makeOptions(answer, a, b) });
    }
  }
  for (let a = 3; a <= 11; a++) {
    const b = (a % 7) + 2;
    const c = (a % 5) + 1;
    const answer = a * b - c;
    out.push({ display: `${a} × ${b} − ${c} = ?`, answer, options: makeOptions(answer, a, b) });
  }
  for (let a = 2; a <= 12; a++) {
    const answer = a * a;
    out.push({ display: `${a}² = ?`, answer, options: makeOptions(answer, a, a) });
  }
  for (let a = 3; a <= 17; a++) {
    const b = (a % 6) + 2;
    const c = (a % 5) + 3;
    const answer = a + b + c;
    out.push({ display: `${a} + ${b} + ${c} = ?`, answer, options: makeOptions(answer, a, b) });
  }
  return [...out, ...out].slice(0, 140);
}

const EMOJI_POOL = ["🔶", "🔷", "🔺", "🔻", "🟢", "🟡", "🟠", "🔴", "🟣", "🔵"] as const;

function buildObjectCountBank(): ObjectCountQuestion[] {
  const out: ObjectCountQuestion[] = [];
  for (let i = 0; i < 140; i++) {
    const rand = seededRandom(`obj-${i}`);
    const target = EMOJI_POOL[Math.floor(rand() * EMOJI_POOL.length)];
    const tier = i % 3;
    const count = tier === 0 ? 3 + Math.floor(rand() * 5) : tier === 1 ? 8 + Math.floor(rand() * 7) : 15 + Math.floor(rand() * 6);
    const filler = 6 + Math.floor(rand() * 8);
    const grid: string[] = Array.from({ length: count }).map(() => target);
    for (let j = 0; j < filler; j++) {
      const choices = EMOJI_POOL.filter((e) => e !== target);
      grid.push(choices[Math.floor(rand() * choices.length)]);
    }
    out.push({ target, count, grid: shuffle(grid, rand) });
  }
  return out;
}

const WORD_SOURCE = [
  "planet", "mission", "galaxy", "rocket", "puzzle", "meteor", "signal", "comet",
  "nebula", "orbit", "launch", "module", "riddle", "cipher", "solver", "fusion",
  "matrix", "sensor", "compass", "vector", "target", "oxygen", "cosmic", "engine",
  "memory", "laser", "terrain", "airlock", "payload", "landing", "gravity", "control",
  "pilot", "binary", "circuit", "trivia", "radar", "horizon", "station", "journey",
  "quantum", "cosmos", "orbiter", "capsule", "thruster", "docking", "beacon", "stellar",
  "eclipse", "bridge", "garden", "window", "flower", "school", "castle", "silver",
  "monkey", "pencil", "jungle", "bucket", "candle", "pillow", "dragon", "mirror",
  "rabbit", "sunset", "bottle", "carpet", "forest", "island", "kitten", "magnet",
  "parrot", "valley", "walnut", "zipper", "anchor", "badger", "cactus", "donkey",
  "falcon", "goblin", "harbor", "insect", "jigsaw", "marble", "noodle", "oyster",
] as const;

function scrambleWord(word: string, seed: string): string {
  const chars = word.split("");
  let scrambled = word;
  let tries = 0;
  while (scrambled === word && tries < 10) {
    scrambled = shuffle(chars, seededRandom(`${seed}-${tries}`)).join("");
    tries++;
  }
  return scrambled;
}

function makeWordDecoys(word: string, seed: string): [string, string, string] {
  const sameLength = WORD_SOURCE.filter((w) => w.length === word.length && w !== word);
  const rand = seededRandom(`decoy-${seed}-${word}`);
  const picked: string[] = shuffle([...sameLength], rand).slice(0, 3);
  while (picked.length < 3) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const idx = Math.floor(rand() * word.length);
    const letter = alphabet[Math.floor(rand() * alphabet.length)];
    const mutated = `${word.slice(0, idx)}${letter}${word.slice(idx + 1)}`;
    if (mutated !== word && !picked.includes(mutated)) picked.push(mutated);
  }
  return [picked[0], picked[1], picked[2]];
}

function buildWordScrambleBank(): WordScrambleQuestion[] {
  const base = WORD_SOURCE.map((word, i) => {
    const scrambled = scrambleWord(word, `scramble-${i}`);
    const [d1, d2, d3] = makeWordDecoys(word, `scramble-${i}`);
    const options = toTuple4(shuffle([word, d1, d2, d3], seededRandom(`scramble-opt-${i}`)));
    return { word, scrambled, options };
  });
  return [...base, ...base].slice(0, 140);
}

function chooseBlankIndex(word: string): number {
  const vowels = new Set(["a", "e", "i", "o", "u"]);
  for (let i = 1; i < word.length - 1; i++) {
    if (vowels.has(word[i])) return i;
  }
  return Math.min(Math.max(1, Math.floor(word.length / 2)), word.length - 2);
}

function buildMissingLetterBank(): MissingLetterQuestion[] {
  const base = WORD_SOURCE.map((word, i) => {
    const blankIndex = chooseBlankIndex(word);
    const correct = word[blankIndex].toUpperCase();
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const rand = seededRandom(`miss-${i}-${word}`);
    const wrongs: string[] = [];
    while (wrongs.length < 3) {
      const pick = alphabet[Math.floor(rand() * alphabet.length)];
      if (pick !== correct && !wrongs.includes(pick)) wrongs.push(pick);
    }
    const options = toTuple4(shuffle([correct, wrongs[0], wrongs[1], wrongs[2]], rand));
    return { word, blankIndex, options };
  });
  return [...base, ...base].slice(0, 140);
}

const ARRANGE_BASE: Array<[string, string, string]> = [
  ["Seed", "Sprout", "Tree"], ["Bronze", "Silver", "Gold"], ["Cold", "Warm", "Hot"],
  ["Tiny", "Small", "Large"], ["Dawn", "Noon", "Night"], ["Egg", "Larva", "Butterfly"],
  ["Crawl", "Walk", "Run"], ["Child", "Teen", "Adult"], ["Low", "Medium", "High"],
  ["Mercury", "Venus", "Earth"], ["Penny", "Nickel", "Dime"], ["Single", "Double", "Triple"],
  ["Hydrogen", "Helium", "Lithium"], ["Solid", "Liquid", "Gas"], ["Drop", "Stream", "River"],
  ["Page", "Chapter", "Book"], ["Minute", "Hour", "Day"], ["Day", "Week", "Month"],
  ["Millimeter", "Centimeter", "Meter"], ["Gram", "Kilogram", "Ton"], ["Bud", "Flower", "Fruit"],
  ["Draft", "Review", "Publish"], ["Stone", "Brick", "Wall"], ["Village", "Town", "City"],
  ["Idea", "Plan", "Action"], ["Spark", "Flame", "Blaze"], ["Inhale", "Hold", "Exhale"],
  ["Caterpillar", "Cocoon", "Butterfly"], ["Question", "Hint", "Answer"], ["Start", "Middle", "End"],
];

function permute3(items: [string, string, string]): string[] {
  const [a, b, c] = items;
  return [
    `${a} → ${b} → ${c}`,
    `${a} → ${c} → ${b}`,
    `${b} → ${a} → ${c}`,
    `${b} → ${c} → ${a}`,
    `${c} → ${a} → ${b}`,
    `${c} → ${b} → ${a}`,
  ];
}

function buildQuickArrangeBank(): QuickArrangeQuestion[] {
  const out: QuickArrangeQuestion[] = [];
  ARRANGE_BASE.forEach((items, i) => {
    const all = permute3(items);
    const correct = all[0];
    for (let variant = 0; variant < 3; variant++) {
      const rand = seededRandom(`arr-${i}-${variant}`);
      const wrongChoices = shuffle(all.slice(1), rand).slice(0, 3);
      const options = toTuple4(shuffle([correct, wrongChoices[0], wrongChoices[1], wrongChoices[2]], rand));
      const shuffledText = all[Math.floor(rand() * 5) + 1].split(" → ") as [string, string, string];
      out.push({ items, shuffled: shuffledText, options });
    }
  });
  return [...out, ...out].slice(0, 140);
}

export const RAPID_QUIZ_BANK: QuizQuestion[] = buildRapidQuizBank();
export const FAST_TRIVIA_BANK: QuizQuestion[] = FAST_TRIVIA_RAW;
export const TRUE_FALSE_BANK: TrueFalseQuestion[] = [...buildTrueFalseMath(), ...TRUE_FALSE_FACTS, ...TRUE_FALSE_MISCONCEPTIONS];
export const ODD_ONE_OUT_BANK: OddOneOutQuestion[] = buildOddOneOutBank();
export const NUMBER_SEQUENCE_BANK: NumberSequenceQuestion[] = buildNumberSequenceBank();
export const QUICK_MATH_BANK: QuickMathQuestion[] = buildQuickMathBank();
export const OBJECT_COUNT_BANK: ObjectCountQuestion[] = buildObjectCountBank();
export const WORD_SCRAMBLE_BANK: WordScrambleQuestion[] = buildWordScrambleBank();
export const MISSING_LETTER_BANK: MissingLetterQuestion[] = buildMissingLetterBank();
export const QUICK_ARRANGE_BANK: QuickArrangeQuestion[] = buildQuickArrangeBank();

export type GameConfig = {
  key: string;
  title: string;
  description: string;
  questionCount: number;
};

export const GAME_CONFIGS: GameConfig[] = [
  { key: "rapid-quiz", title: "Rapid Quiz", description: "Pick the correct answer — fast!", questionCount: RAPID_QUIZ_BANK.length },
  { key: "fast-trivia", title: "Fast Trivia", description: "Quick-fire trivia — themed topics", questionCount: FAST_TRIVIA_BANK.length },
  { key: "true-false", title: "True or False", description: "Fact or fiction — split-second judgement", questionCount: TRUE_FALSE_BANK.length },
  { key: "odd-one-out", title: "Odd One Out", description: "Find the one that doesn't belong", questionCount: ODD_ONE_OUT_BANK.length },
  { key: "number-sequence", title: "Number Sequence", description: "What comes next in the pattern?", questionCount: NUMBER_SEQUENCE_BANK.length },
  { key: "quick-math", title: "Quick Math", description: "Solve the expression — tap fast", questionCount: QUICK_MATH_BANK.length },
  { key: "object-count", title: "Emoji Cluster", description: "Count the right emojis in the cluster", questionCount: OBJECT_COUNT_BANK.length },
  { key: "word-scramble", title: "Word Scramble", description: "Spot the scrambled word — tap the answer", questionCount: WORD_SCRAMBLE_BANK.length },
  { key: "missing-letter", title: "Missing Letter", description: "Which letter completes the word?", questionCount: MISSING_LETTER_BANK.length },
  { key: "quick-arrange", title: "Quick Arrange", description: "Tap the correct sequence order", questionCount: QUICK_ARRANGE_BANK.length },
];

export function getMiniGameConfig(title: string | null): GameConfig | null {
  const normalized = (title ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return GAME_CONFIGS.find((cfg) => cfg.title.toLowerCase() === normalized) ?? null;
}

const GAME_ART_STYLES = `
.gm-rapid-grid{display:grid;grid-template-columns:repeat(2,30px);gap:10px}
.gm-rapid-cell{width:30px;height:30px;border:1px solid rgba(180,255,57,.4);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-weight:800;color:#b4ff39}
.gm-rapid-cell.d1,.gm-rapid-cell.d4{background:rgba(180,255,57,.18);animation:gm-pulse 1.4s ease-in-out infinite}
.gm-rapid-cell.d2,.gm-rapid-cell.d3{background:#0a0a0a;animation:gm-pulse 1.4s ease-in-out infinite .4s}
.gm-trivia-core{position:relative;width:88px;height:88px;display:flex;align-items:center;justify-content:center;animation:gm-spin-slow 8s linear infinite}
.gm-trivia-lines{position:absolute;inset:8px;border:1px dashed rgba(180,255,57,.5);border-radius:50%}
.gm-trivia-q{font-size:60px;line-height:1;color:#b4ff39;font-weight:900}
.gm-tf-wrap{display:flex;width:220px;height:82px;border:1px solid rgba(66,74,53,.5)}
.gm-tf-half{flex:1;display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-size:40px;font-weight:900}
.gm-tf-left{background:#0a0a0a;color:#b4ff39;border-right:1px solid #b4ff39}
.gm-tf-right{background:#151515;color:var(--error)}
.gm-tf-mid{position:absolute;width:2px;height:64px;background:#b4ff39;box-shadow:0 0 8px rgba(180,255,57,.8)}
.gm-odd-wrap{display:flex;align-items:center;gap:18px}
.gm-odd-cluster{display:flex;align-items:center}
.gm-odd-circle{width:36px;height:36px;border-radius:50%;border:1px solid rgba(180,255,57,.8);background:rgba(180,255,57,.2);margin-left:-8px}
.gm-odd-circle:first-child{margin-left:0}
.gm-odd-out{width:36px;height:36px;border-radius:50%;border:1px solid var(--error);display:flex;align-items:center;justify-content:center;color:var(--error);font-size:18px;font-weight:900;animation:gm-pulse 1.2s ease-in-out infinite}
.gm-seq-row{display:flex;align-items:center;gap:8px}
.gm-seq-box{min-width:36px;height:40px;padding:0 6px;background:#0a0a0a;border-bottom:2px solid #b4ff39;color:#e5e2e1;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:20px;font-weight:700}
.gm-seq-arrow{width:10px;height:2px;background:#b4ff39}
.gm-seq-q{animation:gm-blink 1.1s ease-in-out infinite}
.gm-math{font-family:var(--font-mono);font-size:34px;font-weight:800;color:#e5e2e1}
.gm-math .eq{color:#b4ff39}
.gm-math .cursor{display:inline-block;color:#b4ff39;animation:gm-blink 1s steps(1,end) infinite}
`;

const STYLE_ID = "mini-game-art-styles";
function useInjectGameArtStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = GAME_ART_STYLES;
    document.head.appendChild(style);
  }, []);
}

function useTapAnswer(disabled: boolean, onComplete: (result: MiniGameResult) => void, resetKey: string) {
  const [chosen, setChosen] = useState<string | null>(null);
  const submitLockedRef = useRef(false);

  useEffect(() => {
    setChosen(null);
    submitLockedRef.current = false;
  }, [resetKey]);

  const submit = (value: string, correct: boolean) => {
    if (disabled || submitLockedRef.current) return;
    submitLockedRef.current = true;
    setChosen(value);
    // Resolve immediately to avoid timeout race at the last second.
    onComplete({ success: correct, details: correct ? "Correct" : "Wrong" });
  };

  return { chosen, submit };
}

function RapidQuizArt() {
  return (
    <div className="game-art-panel">
      <div className="gm-rapid-grid">
        <div className="gm-rapid-cell d1">A</div>
        <div className="gm-rapid-cell d2">B</div>
        <div className="gm-rapid-cell d3">C</div>
        <div className="gm-rapid-cell d4">D</div>
      </div>
    </div>
  );
}

function FastTriviaArt() {
  return (
    <div className="game-art-panel">
      <div className="gm-trivia-core">
        <div className="gm-trivia-lines" />
        <div className="gm-trivia-q">?</div>
      </div>
    </div>
  );
}

function TrueFalseArt() {
  return (
    <div className="game-art-panel">
      <div className="gm-tf-wrap">
        <div className="gm-tf-half gm-tf-left">T</div>
        <div className="gm-tf-half gm-tf-right">F</div>
      </div>
      <div className="gm-tf-mid" />
    </div>
  );
}

function OddOneOutArt() {
  return (
    <div className="game-art-panel">
      <div className="gm-odd-wrap">
        <div className="gm-odd-cluster">
          <div className="gm-odd-circle" />
          <div className="gm-odd-circle" />
          <div className="gm-odd-circle" />
        </div>
        <div className="gm-odd-out">×</div>
      </div>
    </div>
  );
}

function NumberSequenceArt() {
  return (
    <div className="game-art-panel">
      <div className="gm-seq-row">
        <div className="gm-seq-box">n</div>
        <div className="gm-seq-arrow" />
        <div className="gm-seq-box">n</div>
        <div className="gm-seq-arrow" />
        <div className="gm-seq-box">n</div>
        <div className="gm-seq-arrow" />
        <div className="gm-seq-box gm-seq-q">?</div>
      </div>
    </div>
  );
}

function QuickMathArt() {
  return (
    <div className="game-art-panel">
      <div className="gm-math">
        a × b − c <span className="eq">=</span> ?<span className="cursor">|</span>
      </div>
    </div>
  );
}

export function RapidQuiz({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "rapid", RAPID_QUIZ_BANK, questionIndex),
    [seed, questionIndex],
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <RapidQuizArt />
      <p className="game-question">{data.q}</p>
      <div className="game-options cols-2">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`game-option${chosen === option ? (option === data.a ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(option, option === data.a)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FastTrivia({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "trivia", FAST_TRIVIA_BANK, questionIndex),
    [seed, questionIndex],
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <FastTriviaArt />
      <p className="game-question">{data.q}</p>
      <div className="game-options cols-2">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`game-option${chosen === option ? (option === data.a ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(option, option === data.a)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrueFalse({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "tf", TRUE_FALSE_BANK, questionIndex),
    [seed, questionIndex],
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);
  const opts = ["TRUE", "FALSE"] as const;

  return (
    <div className="game-panel">
      <TrueFalseArt />
      <p className="game-question">{data.statement}</p>
      <div className="game-options cols-1">
        {opts.map((opt) => {
          const isCorrect = (opt === "TRUE") === data.answer;
          return (
            <button
              key={opt}
              type="button"
              className={`game-option${chosen === opt ? (isCorrect ? " correct" : " wrong") : ""}`}
              disabled={disabled || !!chosen}
              onClick={() => submit(opt, isCorrect)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OddOneOut({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "odd", ODD_ONE_OUT_BANK, questionIndex),
    [seed, questionIndex],
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <OddOneOutArt />
      <p className="game-question">Which one does not belong?</p>
      <div className="game-options cols-2">
        {data.items.map((item) => (
          <button
            key={item}
            type="button"
            className={`game-option${chosen === item ? (item === data.odd ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(item, item === data.odd)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberSequence({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "seq", NUMBER_SEQUENCE_BANK, questionIndex),
    [seed, questionIndex],
  );
  const rand = seededRandom(`${seed}-seq-opt-${questionIndex}`);
  const wrongPattern = data.sequence[2] + (data.sequence[2] - data.sequence[1]);
  const options = toTuple4(
    shuffle(
      [...uniqueNumbers([data.answer, data.answer + 1, data.answer - 1, data.answer + 2, data.answer - 2, wrongPattern], `${seed}-seq-${questionIndex}`)],
      rand,
    ).slice(0, 4),
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <NumberSequenceArt />
      <p className="game-question">{`${data.sequence[0]}, ${data.sequence[1]}, ${data.sequence[2]}, ?`}</p>
      <div className="game-options cols-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`game-option${chosen === String(option) ? (option === data.answer ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(String(option), option === data.answer)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuickMath({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "math", QUICK_MATH_BANK, questionIndex),
    [seed, questionIndex],
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <QuickMathArt />
      <p className="game-question">{data.display}</p>
      <div className="game-options cols-2">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`game-option${chosen === String(option) ? (option === data.answer ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(String(option), option === data.answer)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ObjectCount({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "count", OBJECT_COUNT_BANK, questionIndex),
    [seed, questionIndex],
  );
  const rand = seededRandom(`${seed}-cnt-${questionIndex}`);
  const options = toTuple4(
    shuffle(
      [...uniqueNumbers([data.count, data.count - 1, data.count + 1, data.count - 2, data.count + 2, data.count + 3], `${seed}-cnt-opt-${questionIndex}`)],
      rand,
    ).slice(0, 4),
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <div className="game-icon-grid" style={{ minHeight: 120 }}>
        {data.grid.map((emoji, index) => (
          <span
            key={`${emoji}-${index}`}
            className="game-icon"
            style={{ transform: `rotate(${((index * 17) % 11) - 5}deg)` }}
          >
            {emoji}
          </span>
        ))}
      </div>
      <p className="game-question">How many {data.target} can you count?</p>
      <div className="game-options cols-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`game-option${chosen === String(option) ? (option === data.count ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(String(option), option === data.count)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WordScramble({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "scramble", WORD_SCRAMBLE_BANK, questionIndex),
    [seed, questionIndex],
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <div className="scramble-letters">
        {data.scrambled.toUpperCase().split("").map((letter, index) => (
          <span key={`${letter}-${index}`} className="scramble-letter">
            {letter}
          </span>
        ))}
      </div>
      <p className="game-question">Pick the correct word.</p>
      <div className="game-options cols-2">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`game-option${chosen === option ? (option === data.word ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(option, option === data.word)}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MissingLetter({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "missing", MISSING_LETTER_BANK, questionIndex),
    [seed, questionIndex],
  );
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <div className="missing-word-display">
        {data.word.toUpperCase().split("").map((letter, index) => (
          <span key={`${letter}-${index}`} className={`letter-tile${index === data.blankIndex ? " blank" : ""}`}>
            {index === data.blankIndex ? "?" : letter}
          </span>
        ))}
      </div>
      <p className="game-question">Which letter completes the word?</p>
      <div className="game-options cols-4">
        {data.options.map((option) => {
          const correct = option === data.word[data.blankIndex].toUpperCase();
          return (
            <button
              key={option}
              type="button"
              className={`game-option${chosen === option ? (correct ? " correct" : " wrong") : ""}`}
              disabled={disabled || !!chosen}
              onClick={() => submit(option, correct)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QuickArrange({ seed, questionIndex, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(
    () => pickFromBankIndexed(seed, "arrange", QUICK_ARRANGE_BANK, questionIndex),
    [seed, questionIndex],
  );
  const correct = `${data.items[0]} → ${data.items[1]} → ${data.items[2]}`;
  const { chosen, submit } = useTapAnswer(disabled, onComplete, `${seed}-${questionIndex}`);

  return (
    <div className="game-panel">
      <div className="arrange-items">
        {data.shuffled.map((item) => (
          <span key={item} className="arrange-chip">{item}</span>
        ))}
      </div>
      <p className="game-question">Put these in order:</p>
      <div className="game-options cols-1">
        {data.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`game-option${chosen === option ? (option === correct ? " correct" : " wrong") : ""}`}
            disabled={disabled || !!chosen}
            onClick={() => submit(option, option === correct)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MiniGame({
  gameType,
  seed,
  questionIndex,
  disabled,
  onComplete,
}: MiniGameProps & { gameType: string }) {
  useInjectGameArtStyles();
  switch (gameType) {
    case "rapid-quiz": return <RapidQuiz seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "fast-trivia": return <FastTrivia seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "true-false": return <TrueFalse seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "odd-one-out": return <OddOneOut seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "number-sequence": return <NumberSequence seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "quick-math": return <QuickMath seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "object-count": return <ObjectCount seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "word-scramble": return <WordScramble seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "missing-letter": return <MissingLetter seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    case "quick-arrange": return <QuickArrange seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
    default: return <RapidQuiz seed={seed} questionIndex={questionIndex} disabled={disabled} onComplete={onComplete} />;
  }
}

export function MiniGameRenderer({
  gameKey,
  seed,
  questionIndex,
  disabled = false,
  onComplete,
}: MiniGameProps & { gameKey: string }) {
  return (
    <MiniGame
      gameType={gameKey}
      seed={seed}
      questionIndex={questionIndex}
      disabled={disabled}
      onComplete={onComplete}
    />
  );
}
