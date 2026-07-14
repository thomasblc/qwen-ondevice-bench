# Qwen on-device benchmark

A small, honest, reproducible benchmark of three Qwen models run **100% on-device** (Apple M5 Max, 36 GB, nothing left the machine) on hard math-reasoning problems. The point of this repo is less the leaderboard and more the **method confounds** I hit, which I think matter for anyone doing local-model reasoning evals.

> Disclosure: I work with the [QVAC](https://github.com/tetherto/qvac) team. The models here are run through the QVAC SDK, but the problem set, the brute-forced ground truth, and the grading are backend-agnostic. You can point the same harness at any local runner.

## TL;DR

1. **Decoding temperature is the dominant confound.** At default sampling the small models spiral on hard problems and look far worse than they are. Switching to **greedy (temp 0, fixed seed)** flipped a whole batch of "all three fail" problems to "all three solve." If your small-model reasoning eval samples, you are mostly measuring noise.
2. **Qwen3.5-4B and Qwen3.5-9B are effectively tied.** Across ~30 problems I found **zero** where the 9B cleanly beats the 4B; on one (`collatz27`) the 4B was right where the 9B was wrong. For reasoning, the 9B was not worth the extra memory over the 4B.
3. **The 35B-A3B MoE is the only model that clears the hardest solvable tier**, which is **long exact iterative computation** (`F(100) mod 1000`, `sum of the first 50 primes`). The counterintuitive part: it activates **~3B params per token, fewer than the 9B dense**. So the edge is total capacity and training, not per-token compute.

## Setup

| Model | Params | Active/token | Quant |
|---|---|---|---|
| Qwen3.5-4B | 4B dense | 4B | Q4_K_M |
| Qwen3.5-9B | 9B dense | 9B | Q4_K_M |
| Qwen3.6-35B-A3B (MoE) | 35B total | **~3B** | Q4_K_M |

- Hardware: Apple M5 Max, 36 GB, GPU. Fully on-device.
- Decoding: `temp: 0, seed: 1` (greedy, deterministic), `reasoning_budget: 0` (no thinking), **one completion call per problem** so no problem starves another's token budget.
- Grading: every ground-truth answer is brute-forced in Python first (see `groundtruth*.py`), so the target is unimpeachable. Model output is graded by extracting the final `ANSWER: <integer>`.

## Why the method matters (the part I did not expect)

I did not get a clean result on the first try. Each iteration exposed a confound:

- **Single-prompt battery starves later problems.** Putting a hard set in one prompt means one runaway derivation eats the whole token budget. Scores measured *not-finishing*, not capability. Fix: one call per problem, own budget.
- **Default sampling looks like incapability but is mostly noise.** On an 11-problem medium pool, sampling produced spirals and all-fail runs; **greedy decoding made all three score 11/11.** Temperature was the difference between "this model can't do it" and "this model does it every time."

## Results (combined hard + graded pools, greedy)

`.` = wrong or no answer, `OK` = correct.

| Problem | Answer | 4B | 9B | MoE | Band |
|---|---|---|---|---|---|
| ordered pairs `(a+b)\|(a*b)`, 1..100 | 170 | . | . | . | frontier (all fail) |
| count `n^2+n+41` composite, n in 1..100 | 14 | . | . | . | frontier |
| walk: 10 moves +2/-1, never neg, end 8 | 120 | . | . | . | frontier |
| `F(60) mod 1000` | 961 | . | . | . | frontier |
| `F(80) mod 1000` | 906 | . | . | . | frontier |
| `F(90) mod 1000` | 309 | . | . | . | frontier |
| **`F(100) mod 1000`** | 75 | . (315) | . (995) | **OK** | **MoE-only** |
| **sum of first 50 primes** | 5117 | . (5125) | . (5088) | **OK** | **MoE-only** |
| `collatz(27)` steps | 111 | OK | . | OK | 4B > 9B |
| 8 people into 2 unlabeled teams of 4 | 35 | OK | OK | OK | all solve |
| 7 books to 3 students, each >= 1 | 1806 | OK | OK | OK | all solve |
| subsets of {1..10}, no 2 consecutive | 144 | OK | OK | OK | all solve |
| make change for 50c (1,5,10,25) | 49 | OK | OK | OK | all solve |
| `3^100 mod 100` | 1 | OK | OK | OK | all solve |
| squares not cubes, 1..10^4 | 96 | OK | OK | OK | all solve |
| triples a<b<c, sum 15 | 12 | OK | OK | OK | all solve |
| 5-card flush hands | 5148 | OK | OK | OK | all solve |
| recurrence a(20), a_n = 2a_{n-1}+1 | 2097151 | OK | OK | OK | all solve |
| digit sum of 20! | 54 | OK | OK | OK | all solve |

**Bands that exist:** all-solve, all-fail (frontier), MoE-only.
**Band that does NOT exist:** "9B solves, 4B fails." I looked hard; it is not there.

(An earlier 11-problem medium pool was all-solve for all three; omitted here, see `results/probe.json`.)

## Findings

1. **Temperature is the hidden variable.** Greedy decoding is essential for a fair, reproducible small-model reasoning eval. This alone flipped several all-fail problems to all-solve.
2. **4B ~= 9B on reasoning.** Same generation, both small, and the 4B is strong. Zero problems where the 9B cleanly wins.
3. **The MoE clears the long-computation tier alone** (`F(100)`, sum of 50 primes), where the small models get *close* then slip (4B: 5125 vs 5117; 9B: 5088). The MoE tracks state to the end.
4. **Why the MoE wins is counterintuitive:** 35B total but ~3B active per token, *fewer* than the 9B dense's 9B active. Its advantage is capacity spread across experts plus being the most-trained model, not per-token compute. This also explains why the 9B does not dominate the 4B.
5. **There is a real frontier** none of them reach under greedy (`pairs`, `euler`, `walk`, long fibs).

## Caveats (please read)

- Small, hand-picked, adversarial set. **Illustrative, not a rigorous eval.** For that use MATH/AIME/GSM8K (Qwen publishes those; there the MoE leads more clearly).
- Single greedy draw per problem (deterministic, but one sample).
- Q4_K_M quantization; results may differ at higher precision.
- Specific model builds on one machine.

## Reproduce

```bash
npm install
# brute-force the ground truth (no model needed):
python3 groundtruth3.py   # answers for the hard pool (probe2)
python3 groundtruth4.py   # answers for the graded pool (probe3)
# run a pool (greedy + fixed seed = deterministic):
node probe2.mjs   # hard pool
node probe3.mjs   # graded/conceptual pool
```

The harness loads models via `@qvac/sdk`. Point `MODELS[].src` at your own GGUF files to run any local models through the same greedy, per-problem, brute-force-graded method.

## License

MIT. See [LICENSE](LICENSE).
