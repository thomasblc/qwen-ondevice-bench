# Prompts

Every problem is sent as a single user message: the fixed template below, then a blank line, then the problem text. Decoding is greedy (`temp: 0, seed: 1`), one completion call per problem, no thinking (`reasoning_budget: 0`). These are also defined inline in `probe.mjs`, `probe2.mjs`, and `probe3.mjs`; this file lists them verbatim for readers who do not want to open the harness.

## Prompt template (prepended to every problem)

```
Solve this math problem. Think step by step and show your working. Then, on the final line, write exactly "ANSWER: <integer>" and nothing else after it.

<the problem text from the pools below goes here>
```

## Answer extraction

The grader takes the model's full output and keeps the **last** match of this regex (commas stripped from the number):

```
/ANSWER:?\s*\**\s*(-?\d[\d,]*)/gi
```

So only the final `ANSWER: <integer>` line is scored; the working above it is ignored.

---

## Pool 1 - medium (`probe.mjs`)

Calibration pool. Under greedy decoding all three models solved all 11, so these are omitted from the difficulty matrix in the README. Listed here for completeness. `answer` is the brute-forced ground truth (`groundtruth*.py`).

| id | answer | prompt |
|---|---|---|
| A_balls | 44 | `In how many ways can 10 identical balls be distributed into 4 distinct boxes so that each box contains at least 1 and at most 4 balls?` |
| B_base12z | 48 | `How many trailing zeros does 100! (100 factorial) have when it is written in base 12?` |
| C_paths | 126 | `On a grid, how many shortest lattice paths go from (0, 0) to (5, 4), moving only one unit right or one unit up at each step?` |
| D_committee | 666 | `A group has 12 people, 3 of whom are officers. How many different 5-person committees can be formed that include at least one officer?` |
| E_crt | 59 | `What is the smallest positive integer that leaves remainder 1 when divided by 2, remainder 2 when divided by 3, remainder 3 when divided by 4, remainder 4 when divided by 5, and remainder 5 when divided by 6?` |
| F_distinct4 | 4536 | `How many 4-digit numbers (from 1000 to 9999) have all four digits distinct?` |
| G_div | 401 | `How many integers from 1 to 1000 inclusive are divisible by 3 or by 5, but not by 7?` |
| H_domino | 89 | `In how many ways can a 2-by-10 rectangle be completely tiled using 1-by-2 dominoes (each domino placed horizontally or vertically)?` |
| I_coeff | 1452 | `What is the coefficient of x^5 in the expansion of (1 + x + x^2)^10?` |
| J_div20fact | 41040 | `How many positive divisors does 20! (20 factorial) have?` |
| K_digitsum | 66 | `How many 3-digit numbers (from 100 to 999) have digits that sum to exactly 12?` |

## Pool 2 - hard (`probe2.mjs`)

| id | answer | prompt |
|---|---|---|
| pairs | 170 | `How many ordered pairs of positive integers (a, b) with 1 <= a <= 100 and 1 <= b <= 100 satisfy that (a + b) divides (a * b)?` |
| euler | 14 | `For how many integers n with 1 <= n <= 100 is n^2 + n + 41 a composite number (not prime)?` |
| fib | 75 | `Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(100) is divided by 1000?` |
| walk | 120 | `A token starts at position 0 and makes exactly 10 moves, each +2 or -1. The position must never be negative after any move, and must equal 8 after the 10th move. How many different move sequences satisfy this?` |
| subsets | 144 | `How many subsets of {1, 2, 3, 4, 5, 6, 7, 8, 9, 10} contain no two consecutive integers? (The empty set counts.)` |
| change50 | 49 | `In how many ways can you make 50 cents using pennies (1 cent), nickels (5 cents), dimes (10 cents), and quarters (25 cents)?` |
| mod3 | 1 | `What is the remainder when 3^100 is divided by 100?` |
| sqnotcube | 96 | `How many integers from 1 to 10000 inclusive are perfect squares but not perfect cubes?` |
| triples | 12 | `How many triples of integers (a, b, c) with a < b < c and each at least 1 satisfy a + b + c = 15?` |
| flush | 5148 | `From a standard 52-card deck (13 ranks in each of 4 suits), how many 5-card hands consist of 5 cards all of the same suit?` |

## Pool 3 - graded / conceptual (`probe3.mjs`)

| id | answer | prompt |
|---|---|---|
| fib60 | 961 | `Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(60) is divided by 1000?` |
| fib80 | 906 | `Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(80) is divided by 1000?` |
| fib90 | 309 | `Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(90) is divided by 1000?` |
| sumprimes50 | 5117 | `What is the sum of the first 50 prime numbers?` |
| collatz27 | 111 | `Start with the number 27. Repeat this rule: if the number is even, divide it by 2; if it is odd, multiply by 3 and add 1. How many steps does it take to first reach 1?` |
| teams | 35 | `In how many ways can 8 people be divided into two teams of 4, where the two teams are indistinguishable (unlabeled)?` |
| surj | 1806 | `In how many ways can 7 distinct books be distributed to 3 different students so that each student receives at least one book?` |
| recur20 | 2097151 | `A sequence is defined by a(1) = 3 and a(n) = 2*a(n-1) + 1 for n >= 2. What is a(20)?` |
| digit20fact | 54 | `What is the sum of the decimal digits of 20! (20 factorial)?` |

---

## Creative tasks (hand-scored)

The same three models were also given two open-ended generation tasks, shown in the announcement thread. Unlike the reasoning pools these have **no single correct answer**, so they are **hand-scored** and are deliberately kept out of the difficulty matrix in the README (the matrix is the auto-graded, brute-forced reasoning set). They are documented here for transparency. Decoding for these differs from the reasoning runs: **default sampling** (not greedy), `reasoning_budget: 0`, one call per model, on the same M5 Max.

### SVG (`run.mjs`, predict budget 4096)

```
Output ONLY a single self-contained SVG image (start with <svg ...> and end with </svg>, include a viewBox) depicting a Tyrannosaurus Rex knitting a wool sweater with knitting needles. Make it colorful, recognizable, and a little funny. Do not write any explanation, output the SVG markup only.
```

### Animation (`run_anim.mjs`, predict budget 8000)

```
Output ONLY a single self-contained HTML document (inline CSS and JavaScript, no external libraries, fonts, or assets).
Animate a small robot walking.
Requirements:
- The robot has a clear head, a torso, two arms, and two legs.
- It does a continuous walking cycle: the legs step and the arms swing, looping forever.
- The robot moves forward, walking across the screen from left to right (then loops back).
- It walks on green grass, with a simple natural landscape behind it: a sky, the sun or some clouds, and hills or trees.
- The motion is smooth and auto-plays on load.
Keep it simple and clearly readable. Output the HTML only. No markdown fences, no explanation.
```
