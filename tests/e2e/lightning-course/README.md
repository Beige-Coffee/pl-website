# Lightning Production Smoke Checks

These are the narrow production smoke checks for the Lightning course.

Use these when you want to verify the real student-facing technical items on
`https://programminglightning.com` without running the broader Playwright
course harness.

They are intentionally focused on:

- coding exercises
- transaction generators
- Bitcoin Node terminal flows

They provision a fresh learner account through the admin launch-testing API, so
they avoid dirty-account state and are reproducible across runs.

## Required environment

Set these before running any of the production smoke commands:

- `PL_ADMIN_PASSWORD`
- `PL_NODE_LOAD_TEST_BYPASS_TOKEN`

Optional:

- `PL_PROD_BASE_URL`
  - defaults to `https://programminglightning.com`
- `PL_SMOKE_PREFIX`
  - learner email prefix used during provisioning

## Main commands

Run the full narrow production smoke:

```bash
npm run test:lightning:prod:smoke
```

Run all coding exercise smoke groups only:

```bash
npm run test:lightning:prod:exercises
```

Run the generator + Bitcoin Node flow only:

```bash
npm run test:lightning:prod:tech-flow
```

## Exercise groups

These exercise commands run in dependency-aware sequence order:

```bash
npm run test:lightning:prod:exercise:early
npm run test:lightning:prod:exercise:mid
npm run test:lightning:prod:exercise:commitment
npm run test:lightning:prod:exercise:htlc
```

They all use canonical correct code from
`client/src/data/lightning-exercises.ts`.

## Custom exercise runs

To run a custom subset, use `production-exercise-sequence.ts` directly.

Sequence format:

```text
chapterId:exerciseId;chapterId:exerciseId
```

Example:

```bash
PL_EXERCISE_SEQUENCE='commitment-assembly:ln-exercise-commitment-tx;commitment-finalization:ln-exercise-finalize-commitment' \
node --import tsx tests/e2e/lightning-course/production-exercise-sequence.ts
```

Useful optional overrides:

- `PL_EXERCISE_SEQUENCE`
- `PL_EXERCISE_CHAPTER_ID`
- `PL_EXERCISE_ID`

Backward-compatible legacy debug env names are still accepted:

- `PL_DEBUG_SEQUENCE`
- `PL_DEBUG_CHAPTER_ID`
- `PL_DEBUG_EXERCISE_ID`
- `PL_DEBUG_PREFIX`

## What each script does

`production-exercise-sequence.ts`

- provisions a fresh learner
- logs into production
- seeds prerequisite exercises with canonical solutions
- opens the requested exercise(s)
- clicks `RUN TESTS`
- verifies completion from server checkpoint state

`production-tech-flow.ts`

- provisions a fresh learner
- logs into production
- runs the tracked transaction generators
- runs the Bitcoin Node commands used by the course
- verifies notebook state and expected command results

## Recommended usage

Small content-only change:

- usually no production smoke needed

Exercise change:

- run the affected exercise group

Generator or Bitcoin Node change:

- run `npm run test:lightning:prod:tech-flow`

Major Lightning tutorial release check:

- run `npm run test:lightning:prod:smoke`

## Guidance for another agent

If Claude or another agent is using this:

- prefer these narrow production smoke checks over the broad full-course
  Playwright harness
- test only the student-facing technical items first
- if a smoke check fails, diagnose that exact item before touching broader
  automation
- do not hardcode credentials into repo files
