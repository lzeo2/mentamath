# Mentamath

Minimal mental math trainer — a single-file web app. No dependencies, no build, no install.

## Modes

| Mode | Example | Answer type |
|---|---|---|
| `+ − × ÷` | `7 × 8` | integer |
| Exponents | `3⁴` | integer |
| n Choose r | `C(12, 5)` | integer |
| Factoring | `Factor 72` | prime factorization |
| Mixed | random pick from all four | varies |
| Combo | **your choice** — toggle which types are included | varies |

## How to use

Open `index.html` in any browser — works on phone and desktop. Type the answer, press Enter, get instant feedback (✓ streak / ✗ shows the right answer), next question auto-loads.

**Features:**
- 🎓 **Onboarding** on first visit (skip anytime, remembered)
- ⚡ **Auto-submit** — the moment your typed answer is correct it submits itself; Enter still checks wrong answers
- 🎚️ **Range filter** — cap generated numbers (≤30 / ≤100 / ≤1000 / ≤10000) alongside difficulty
- 🔄 **Dynamic factoring** — composites built from 2–4 primes with a repeat-guard, so questions stay fresh

**Factoring answers** accept flexible formats:
`2^4×3`, `2^4 * 3`, `2x2x2x2x3`, `2^4,3` — all valid for 48.

## Host it on your Pi (optional)

```bash
python3 -m http.server 8080 --directory ~/mentamath
# open http://<pi-ip>:8080
```

## Tech

- Single `index.html` — vanilla HTML/CSS/JS, zero dependencies
- Three difficulty tiers scale number ranges per mode
- Keyboard-first: Enter submits, next question auto-focuses
