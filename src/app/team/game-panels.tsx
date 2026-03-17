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

function GameArt({ asset }: { asset: string }) {
  return (
    <div className="game-art" style={{ backgroundImage: `url(/games/${asset}.png)` }}>
      <span className="game-art-label">/public/games/{asset}.png</span>
    </div>
  );
}

function RapidQuiz({ seed, disabled, onComplete }: MiniGameProps) {
  const data = useMemo(() => {
    const rand = seededRandom(seed + "rapid");
    const questions = [
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
    ];
    return questions[Math.floor(rand() * questions.length)];
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
    const rand = seededRandom(seed + "math");
    const a = Math.floor(rand() * 8) + 5;
    const b = Math.floor(rand() * 7) + 3;
    const c = Math.floor(rand() * 9) + 1;
    return { a, b, c, result: a * b - c };
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
    const rand = seededRandom(seed + "tf");
    const a = Math.floor(rand() * 9) + 2;
    const b = Math.floor(rand() * 9) + 2;
    const result = a + b;
    const shown = rand() > 0.5 ? result : result + (rand() > 0.5 ? 1 : -1);
    return { text: `${a} + ${b} = ${shown}`, correct: shown === result };
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
    const rand = seededRandom(seed + "odd");
    const sets = [
      { items: ["Apple", "Banana", "Orange", "Car"], odd: "Car" },
      { items: ["Blue", "Green", "Red", "Table"], odd: "Table" },
      { items: ["Cat", "Dog", "Bird", "Chair"], odd: "Chair" },
    ];
    return sets[Math.floor(rand() * sets.length)];
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
    const words = ["planet", "mission", "galaxy", "rocket", "puzzle"];
    const word = words[Math.floor(rand() * words.length)];
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
    const rand = seededRandom(seed + "emoji");
    const clues = [
      { emoji: "\ud83c\udf27\ufe0f\ud83d\udca1", answer: "storm" },
      { emoji: "\ud83c\udf2e\ud83d\udc4d", answer: "taco" },
      { emoji: "\ud83e\uddc0\ud83c\udf55", answer: "cheese" },
      { emoji: "\ud83c\udf1f\ud83d\udcda", answer: "star" },
    ];
    return clues[Math.floor(rand() * clues.length)];
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
    const rand = seededRandom(seed + "sequence");
    const start = Math.floor(rand() * 6) + 2;
    const step = Math.floor(rand() * 4) + 1;
    const sequence = [start, start + step, start + step * 2];
    return { sequence, answer: start + step * 3 };
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
    const rand = seededRandom(seed + "riddle");
    const riddles = [
      { q: "What has keys but cannot open locks?", a: "keyboard" },
      { q: "What has a face and two hands but no arms?", a: "clock" },
      { q: "What has many teeth but cannot bite?", a: "comb" },
    ];
    return riddles[Math.floor(rand() * riddles.length)];
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
    const rand = seededRandom(seed + "trivia");
    const questions = [
      {
        q: "Which ocean is the largest?",
        options: ["Pacific", "Atlantic", "Indian", "Arctic"],
        a: "Pacific",
      },
      {
        q: "What is the capital of Japan?",
        options: ["Tokyo", "Kyoto", "Osaka", "Nagoya"],
        a: "Tokyo",
      },
      {
        q: "Which is the smallest prime number?",
        options: ["1", "2", "3", "5"],
        a: "2",
      },
    ];
    return questions[Math.floor(rand() * questions.length)];
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
    const items = [
      { word: "Sky", color: "Blue" },
      { word: "Grass", color: "Green" },
      { word: "Sun", color: "Yellow" },
      { word: "Coal", color: "Black" },
    ];
    const pick = items[Math.floor(rand() * items.length)];
    const options = shuffle([
      pick.color,
      "Red",
      "Purple",
      "Orange",
    ], rand).slice(0, 4);
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
    const words = ["mystery", "mission", "planet", "signal"];
    const word = words[Math.floor(rand() * words.length)];
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
    const sets = [
      { items: ["Bronze", "Silver", "Gold"], answer: "Bronze, Silver, Gold" },
      { items: ["Seed", "Sprout", "Tree"], answer: "Seed, Sprout, Tree" },
      { items: ["Morning", "Noon", "Night"], answer: "Morning, Noon, Night" },
    ];
    const pick = sets[Math.floor(rand() * sets.length)];
    const options = shuffle([
      pick.answer,
      `${pick.items[1]}, ${pick.items[2]}, ${pick.items[0]}`,
      `${pick.items[2]}, ${pick.items[0]}, ${pick.items[1]}`,
    ], rand);
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
    const rand = seededRandom(seed + "logic");
    const items = ["A", "B", "C"];
    const answer = items[Math.floor(rand() * items.length)];
    return {
      text: "A > B and B > C. Who is smallest?",
      options: items,
      answer: "C",
    };
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
    const rand = seededRandom(seed + "count");
    const count = Math.floor(rand() * 6) + 5;
    return { count, icon: "\ud83d\udd38" };
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
    const symbols = ["\u25b2", "\u25a0", "\u25cf", "\u2605"];
    const a = symbols[Math.floor(rand() * symbols.length)];
    const b = symbols[Math.floor(rand() * symbols.length)];
    const sequence = [a, b, a, b];
    const options = shuffle([a, b, symbols[0], symbols[1]], rand).slice(0, 4);
    return { sequence, answer: b, options };
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
