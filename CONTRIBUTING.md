# Contributing to Checks & Balances: The Simulation

Thank you for contributing.

This project is designed to be friendly to both developers and subject-matter experts, including instructors who may want to add scenarios without changing the JavaScript.

## Ways to Contribute

### Add New Scenarios

You can contribute:

- new constitutional law hypotheticals
- revised answer choices
- improved doctrinal explanations
- professor notes and counter-arguments
- new precedent interactions for Campaign Mode

When adding scenario content:

1. follow the canonical schema documented in `README.md`
2. use only `correct`, `partial`, or `incorrect` for answer states
3. give every scenario a unique `id`
4. keep `doctrineArea` labels consistent with existing analytics categories when possible
5. include accurate `caseReferences`
6. test the scenario in the browser and through `tests/index.html`

### Report Bugs

Please include:

- what screen or mode you were in
- what you expected to happen
- what actually happened
- browser and device details if relevant
- any console errors you saw
- whether the issue involved saved-state restoration or analytics history

### Improve Accessibility

Accessibility contributions are especially welcome.

Helpful reports include:

- missing or unclear focus states
- screen-reader issues
- keyboard traps or missing keyboard support
- color contrast concerns
- motion or timing problems

## Development Guidelines

### Keep It Vanilla

Do not introduce frameworks, build tools, or heavy dependencies unless the project direction explicitly changes.

The application is intentionally built with:

- HTML
- CSS
- vanilla JavaScript modules
- static JSON data files

### Preserve the Data Model

Scenario data should stay declarative. Prefer storing scenario behavior in `data/scenarios.json` rather than hard-coding special-case behavior in `game.js`.

### Comment Non-Obvious Logic

Add comments when touching:

- campaign precedent handling
- persistence and resume behavior
- analytics aggregation
- accessibility-specific UI logic

## Pull Request Checklist

Before opening a pull request:

1. run the game locally
2. confirm the modified scenarios render correctly
3. verify scoring and feedback behavior
4. test save/resume if your changes affect session flow
5. run `tests/index.html`
6. update `README.md` if you changed the schema or workflow

## Content Quality Guidance

For scenario-writing contributions:

- prefer doctrinal precision over flashy facts
- make distractors plausible but distinguishable
- explain why partial-credit answers are only partly correct
- link scenarios to cases students are likely to study
- keep branch roles and constitutional authority clear

## Pull Request Style

A strong pull request usually includes:

- a concise summary of the change
- files changed
- why the change was needed
- screenshots or short recordings for UI changes
- a note on whether tests were added or updated

## Questions

If you are unsure how to model a new doctrine area, start by reviewing:

- `README.md`
- `data/scenarios.json`
- existing campaign precedent examples
- the browser test suite in `tests/`
