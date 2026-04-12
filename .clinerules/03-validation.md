# Lint and Validate (Enhanced)

## Purpose
Ensure all generated or modified code is clean, correct, secure, and production-ready.

## Core Rule
No code is considered complete unless it passes validation checks.

---

## Universal Quality Checklist

Before finalizing any code:

- No syntax errors
- No unused variables or imports
- Consistent formatting
- Logical correctness verified
- Edge cases considered

---

## Node.js / TypeScript

1. Lint & Fix:
   npm run lint OR npx eslint . --fix

2. Type Check:
   npx tsc --noEmit

3. Security:
   npm audit --audit-level=high

---

## Python

1. Lint:
   ruff check . --fix

2. Type Check:
   mypy .

3. Security:
   bandit -r . -ll

---

## Validation Workflow

1. Write or modify code
2. Run lint and type checks
3. Identify issues
4. Fix issues immediately
5. Repeat until clean

---

## Error Handling Rules

- If lint fails → fix style/syntax immediately
- If type check fails → fix logic/types before continuing
- If tool not available → suggest setup (eslint, tsconfig, etc.)

---

## Output Requirement

Before marking task complete:

- Confirm validation status
- Ensure no known errors remain
- Provide clean final code only

---

## Strict Enforcement

- Do NOT skip validation
- Do NOT ignore warnings blindly
- Do NOT finalize incomplete code