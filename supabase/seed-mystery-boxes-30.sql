begin;

delete from mystery_boxes;

insert into mystery_boxes (
  box_number,
  game_title,
  game_description,
  game_type,
  points_value,
  round_number,
  is_locked
) values
  (1, 'Rapid Quiz', 'Answer three rapid-fire multiple-choice questions. Get at least two correct within 30 seconds.', 'task', 10, 1, false),
  (2, 'Quick Math', 'Solve a short arithmetic expression (for example: 18 x 2 - 6). Enter the correct result.', 'task', 10, 1, false),
  (3, 'True or False', 'Evaluate three short statements and mark each one true or false before time runs out.', 'task', 10, 1, false),
  (4, 'Odd One Out', 'Pick the single item that does not belong in the group of four.', 'task', 10, 1, false),
  (5, 'Word Scramble', 'Unscramble the letters to form the correct word.', 'task', 10, 1, false),
  (6, 'Emoji Guess', 'Decode the emoji sequence to identify the word or phrase.', 'task', 10, 1, false),
  (7, 'Number Sequence', 'Identify the next number in a simple sequence.', 'task', 10, 1, false),
  (8, 'Simple Riddle', 'Solve a short riddle and type the answer.', 'task', 10, 1, false),
  (9, 'Fast Trivia', 'Answer one quick trivia question with four choices.', 'task', 10, 1, false),
  (10, 'Color Match', 'Match a word to the color that best fits it (for example: sky -> blue).', 'task', 10, 1, false),
  (11, 'Missing Letter', 'Fill in the missing letters to complete the word.', 'task', 10, 1, false),
  (12, 'Quick Arrange', 'Put 3-4 items into the correct order (numbers, steps, or ranks).', 'task', 10, 1, false),
  (13, 'Basic Logic', 'Solve a simple logic statement (for example: A > B, B > C. Who is smallest?).', 'task', 10, 1, false),
  (14, 'Object Count', 'Count the number of objects shown and enter the total.', 'task', 10, 1, false),
  (15, 'Simple Pattern', 'Choose the next symbol in a repeating pattern.', 'task', 10, 1, false),
  (16, 'Memory Flash', 'Memorize a short sequence of colors or shapes, then repeat it in order.', 'task', 20, 2, false),
  (17, 'Number Memory', 'Memorize a number string shown briefly and enter it from memory.', 'task', 20, 2, false),
  (18, 'Pattern Recall', 'Study a pattern briefly and pick the exact match from options.', 'task', 20, 2, false),
  (19, 'Memory Grid', 'Watch a 3x3 grid light up, then tap the tiles in the same order.', 'task', 20, 2, false),
  (20, 'Spot the Difference', 'Find three differences between two similar images.', 'task', 20, 2, false),
  (21, 'Blurred Image Guess', 'Identify an object from a heavily blurred image.', 'task', 20, 2, false),
  (22, 'Logo Guess', 'Identify a brand from a partially hidden logo.', 'task', 20, 2, false),
  (23, 'Shape Match', 'Match each shape to its correct shadow or outline.', 'task', 20, 2, false),
  (24, 'Hidden Word', 'Find the hidden word in a letter grid.', 'task', 20, 2, false),
  (25, 'Pattern Continue', 'Pick the correct next pattern in a sequence.', 'task', 20, 2, false),
  (26, 'Reaction Tap', 'Tap the button as soon as it appears. Faster reactions score higher.', 'task', 30, 3, false),
  (27, 'Speed Click', 'Click the button ten times within five seconds.', 'task', 30, 3, false),
  (28, 'Mini Maze', 'Guide a dot through a small maze without touching the walls.', 'task', 30, 3, false),
  (29, 'Drag Puzzle', 'Drag puzzle tiles into the correct order to complete the image.', 'task', 30, 3, false),
  (30, 'Final Mystery Challenge', 'A surprise challenge appears with shorter time limits and higher intensity. Complete it for bonus glory.', 'task', 30, 3, false);

commit;