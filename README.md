# Checks & Balances: The Simulation

## Project Overview

**Checks & Balances: The Simulation** is a browser-based educational game for constitutional law students, instructors, academic support programs, and bar or exam-prep users who want structured practice with U.S. separation of powers and federalism doctrine.

Players rotate among the constitutional branches and work through scenario-driven crises involving doctrines such as:

- the Youngstown framework
- executive privilege
- presidential immunity
- removal power and the unitary executive
- legislative vetoes and bicameralism/presentment
- the Commerce Clause
- the Spending Clause
- anti-commandeering
- foreign affairs and executive agreements
- political questions and justiciability

The codebase uses **vanilla HTML, CSS, and JavaScript only**. There is no build step, framework, bundler, or package dependency required to run the game itself.

## Features

### Play Modes

- **Standard Mode**: shuffled scenarios with immediate feedback after each crisis.
- **Exam Prep Mode**: timed play with deferred review at the end.
- **Campaign Mode**: a fixed doctrinal sequence where earlier rulings create later precedents.

### Educational Features

- scenario-based constitutional hypotheticals
- multi-step decision trees
- argument-builder exercises with positive and negative scoring
- counter-argument prompts
- doctrinal explanations and professor notes
- case-reference buttons with tooltip summaries
- end-of-session score report and grade
- doctrine-level analytics across sessions
- CSV export for performance history

### Player Experience Features

- persistent save/resume using `localStorage`
- “Save & Quit” support from the game screen
- dark mode toggle
- responsive layout for desktop and mobile
- accessibility improvements for keyboard users and screen readers

## Getting Started

### Run Locally

The project is static and does not require installation.

1. Open the project folder.
2. Open `index.html` in a browser.

### Important Fetch Caveat

The game loads `data/scenarios.json` and `data/cases.json` with `fetch()`. Some browsers block local `file://` fetches for security reasons.

If opening `index.html` directly does not load the game data, start a simple static server instead.

Example options:

```bash
python3 -m http.server
```

Then open the local address shown by the server, usually something like:

```text
http://localhost:8000/
```

### Recommended Local Workflow

- run the game through a local static server
- run `tests/index.html` through the same server
- edit the JSON files and refresh the browser

## Project Structure

```text
checks-and-balances/
├── index.html
├── styles.css
├── game.js
├── scenarios.js
├── cases.js
├── scoring.js
├── timer.js
├── ui.js
├── analytics.js
├── data/
│   ├── scenarios.json
│   └── cases.json
├── tests/
│   ├── index.html
│   ├── test-runner.js
│   ├── test-utils.js
│   ├── scoring.test.js
│   ├── data-validation.test.js
│   └── integration.test.js
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

### File-by-File Description

#### `index.html`
Main application markup for:

- landing screen
- game screen
- feedback modal
- generic app modal
- performance dashboard
- end screen
- case popup
- live region for screen readers

#### `styles.css`
Application styling, including:

- layout and responsive design
- branch-specific visual language
- feedback states
- dashboard styling
- modal presentation
- focus states and accessibility fixes
- dark mode and reduced-motion behavior

#### `game.js`
The core game controller. It handles:

- mode selection
- scenario ordering
- state transitions
- campaign precedent tracking
- `localStorage` persistence
- timer coordination
- end-of-game analytics recording

#### `scenarios.js`
Renders scenario content and interactive step types:

- multiple-choice steps
- argument-builder steps
- counter-argument steps
- feedback modal contents
- end-of-game summary
- exam-prep review panels

#### `cases.js`
Loads and searches `cases.json` and renders case-tooltip popups from scenario case references, including doctrinal and constitutional authority entries.

#### `scoring.js`
Pure scoring logic for:

- difficulty multipliers
- correct / partial / incorrect handling
- maximum point calculations
- percentage calculation
- final grade assignment

#### `timer.js`
Exam Prep timer logic with support for:

- start
- restore
- pause
- resume
- extend
- stop

#### `ui.js`
Shared UI helpers for:

- screen transitions
- progress bar updates
- score updates
- timer display updates
- live region announcements
- dark mode
- accessible modal focus trapping

#### `analytics.js`
Persistent session-history and dashboard support, including:

- recording completed sessions
- doctrine-level breakdowns
- weakest-topic identification
- CSV export
- dashboard rendering

#### `data/scenarios.json`
Canonical scenario content file. This project now uses a single standardized schema throughout.

#### `data/cases.json`
Reference catalog used for case popups and search. Entries may be judicial decisions or doctrinal/constitutional authorities.

#### `tests/`
Lightweight browser-based test suite with no framework dependency.

## Scenario Data Schema

The scenario data file is an array of scenario objects.

### Top-Level Scenario Object

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Unique identifier for the scenario. Must be unique across the entire file. |
| `title` | string | yes | The scenario title shown to the player. |
| `branch` | string | yes | Which branch the player is occupying. Expected values are `judiciary`, `president`, or `congress`. |
| `doctrineArea` | string | yes | Human-readable doctrine tag shown in the UI and analytics. |
| `difficulty` | string | yes | `easy`, `medium`, or `hard`. |
| `description` | string | yes | The factual setup shown before the step prompt. |
| `steps` | array | yes | Ordered list of steps for the scenario. |
| `overallExplanation` | string | yes | Longer doctrinal explanation shown in feedback/end review. |
| `caseReferences` | array of strings | yes | Labels shown as clickable case-reference buttons. |
| `professorNote` | string | no | Optional teaching note shown in feedback. |
| `analyticalLens` | string | no | Optional value such as `formalist`, `functionalist`, or `both`. |
| `otherSide` | string | no | Optional explanation of the strongest counter-position. |
| `precedentConditions` | array | no | Optional list of campaign-mode downstream effects triggered by earlier precedent flags. |

### Step Object

Each item in `steps` is a step object.

| Field | Type | Required | Description |
|---|---|---:|---|
| `type` | string | recommended | Step type. Supported values are `multiple_choice`, `argument_builder`, and `counter_argument`. If omitted, the renderer treats the step like a standard multiple-choice step. |
| `prompt` | string | yes | The question or instruction shown for that step. |
| `choices` | array | for multiple-choice and counter-argument steps | The answer choices shown as buttons. |
| `contextText` | string | for argument-builder steps | Short instruction/context block shown alongside argument options. |
| `argumentOptions` | array | for argument-builder steps | Selectable sub-arguments with positive or negative point values. |
| `counterText` | string | optional for counter-argument steps | Supplemental framing text shown above the counter-argument choices. |

### Choice Object

Every choice in a multiple-choice or counter-argument step must use the canonical schema below.

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | recommended | Stable internal identifier for that choice. |
| `text` | string | yes | The player-facing answer text. |
| `points` | number | yes | Reference value for the step. Full credit is based on the highest step value. |
| `correct` | string | yes | Must be `correct`, `partial`, or `incorrect`. |
| `explanation` | string | yes | Feedback text shown after selection. |
| `setsPrecedent` | object | no | Optional campaign precedent update. Example: `{ "broadCommerceClause": true }`. |

### `correct` Values

Only these values are valid:

- `correct`
- `partial`
- `incorrect`

Scoring behavior:

- `correct` = full credit for the step
- `partial` = half credit for the step, rounded up
- `incorrect` = zero

### Argument Builder Option Object

Argument-builder steps use `argumentOptions` instead of normal answer choices.

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | recommended | Stable internal identifier. |
| `text` | string | yes | The argument text shown next to the checkbox. |
| `points` | number | yes | Positive values reward good arguments; negative values penalize weak ones. |
| `feedback` | string | recommended | Explanation shown in the argument evaluation review. |

### Campaign `precedentConditions`

`precedentConditions` lets later scenarios respond to earlier campaign choices.

Each condition object can include:

| Field | Type | Required | Description |
|---|---|---:|---|
| `precedent` | string | yes | The precedent flag to inspect. |
| `value` | boolean | yes | Which value must be present for the condition to activate. |
| `descriptionAppend` | string | no | Text appended to the scenario description when the condition is active. |
| `stepModifications` | array | no | List of step/choice edits applied when the condition is active. |

Each `stepModifications` item may contain:

| Field | Type | Description |
|---|---|
| `stepIndex` | number | Zero-based step index to modify. |
| `choiceIndex` | number | Zero-based choice index to modify. |
| `promptAppend` | string | Appends text to the step prompt. |
| `textAppend` | string | Appends text to the choice text. |
| `textOverride` | string | Replaces the choice text. |
| `explanationAppend` | string | Appends text to the explanation. |
| `explanationOverride` | string | Replaces the explanation. |
| `pointsOverride` | number | Replaces the choice point value. |
| `pointsDelta` | number | Adds or subtracts from the choice point value. |
| `correctOverride` | string | Replaces the correctness state. |

### Minimal Example Scenario

```json
{
  "id": "example-commerce-scenario",
  "title": "The Federal Market Rule",
  "branch": "judiciary",
  "doctrineArea": "Commerce Clause",
  "difficulty": "medium",
  "description": "Congress regulates a local activity and claims the activity substantially affects interstate commerce.",
  "steps": [
    {
      "type": "multiple_choice",
      "prompt": "Which doctrine best frames the issue?",
      "choices": [
        {
          "id": "choice_a",
          "text": "Apply the substantial-effects framework.",
          "points": 10,
          "correct": "correct",
          "explanation": "This is the central Commerce Clause issue.",
          "setsPrecedent": {
            "broadCommerceClause": true
          }
        },
        {
          "id": "choice_b",
          "text": "Treat the issue as a Speech and Debate Clause question.",
          "points": 0,
          "correct": "incorrect",
          "explanation": "That doctrine is unrelated here."
        }
      ]
    }
  ],
  "overallExplanation": "Commerce Clause questions typically ask whether Congress is regulating channels, instrumentalities, or activities with a substantial effect on interstate commerce.",
  "caseReferences": [
    "Wickard v. Filburn",
    "United States v. Lopez"
  ],
  "professorNote": "Always separate the doctrinal test from the policy argument.",
  "analyticalLens": "both",
  "otherSide": "A narrower view would emphasize limits on aggregation and non-economic conduct."
}
```

## Case Data Schema

The case data file is an array of reference objects. Most entries are case summaries, but the file may also include doctrinal or constitutional authorities used by the popup system.

| Field | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Unique machine-readable identifier. |
| `name` | string | yes | Full case name. |
| `year` | number or null | yes | Year of decision when applicable. Use `null` for doctrinal or constitutional authority entries without a single decision year. |
| `citation` | string | yes | Reporter citation. |
| `holding` | string | yes | Brief statement of the holding. |
| `significance` | string | yes | Why the case matters doctrinally. |
| `doctrineAreas` | array of strings | yes | Searchable doctrine tags. |
| `keyQuote` | string | yes | Optional notable quotation; may be an empty string. |

### Example Case Object

```json
{
  "id": "youngstown-v-sawyer",
  "name": "Youngstown Sheet & Tube Co. v. Sawyer",
  "year": 1952,
  "citation": "343 U.S. 579 (1952)",
  "holding": "The President could not seize steel mills without statutory or constitutional authority.",
  "significance": "Established the modern framework for evaluating clashes between presidential and congressional power.",
  "doctrineAreas": ["Youngstown Framework", "Presidential Power"],
  "keyQuote": "The framers suspected that emergency powers would tend to kindle emergencies."
}
```

### Example Authority Entry

```json
{
  "id": "federal-preemption-framework",
  "name": "Federal Preemption Framework (Supremacy Clause, Article VI)",
  "year": null,
  "citation": "U.S. Const. art. VI, cl. 2",
  "holding": "Federal law preempts state law when Congress intends it.",
  "significance": "Captures the preemption framework when a scenario references constitutional authority rather than a single judicial opinion.",
  "doctrineAreas": ["Federal Preemption", "Supremacy Clause"],
  "keyQuote": ""
}
```

## Adding New Scenarios

This section is written for contributors who may be subject-matter experts rather than JavaScript developers.

### Step 1: Choose an ID

Create a unique `id` such as:

```text
appointments-clause-special-counsel
```

Use lowercase letters, numbers, and hyphens or underscores. Do not reuse an existing ID.

### Step 2: Add the Scenario Shell

Add a new object to `data/scenarios.json` with:

- `id`
- `title`
- `branch`
- `doctrineArea`
- `difficulty`
- `description`
- `steps`
- `overallExplanation`
- `caseReferences`

### Step 3: Define the Steps

For ordinary questions, use `multiple_choice` steps.

Each choice must include:

- `text`
- `points`
- `correct`
- `explanation`

Use `partial` only when you want the player to receive half credit.

### Step 4: Add Case References

Under `caseReferences`, list the cases or doctrinal authorities that should appear as clickable references.

Example:

```json
"caseReferences": [
  "Buckley v. Valeo",
  "Lucia v. SEC"
]
```

The UI will try to match those strings against `data/cases.json`, including doctrinal authority entries when present.

### Step 5: Add Optional Teaching Layers

You may also add:

- `professorNote`
- `analyticalLens`
- `otherSide`

These make the feedback richer but are not required.

### Step 6: Add Campaign Precedent Logic if Needed

If the scenario should **set** a precedent, add `setsPrecedent` to a choice.

Example:

```json
"setsPrecedent": {
  "strongAntiCommandeering": true
}
```

If the scenario should **react to** an earlier precedent, add `precedentConditions` at the scenario level.

Example:

```json
"precedentConditions": [
  {
    "precedent": "strongAntiCommandeering",
    "value": true,
    "descriptionAppend": "Because the campaign previously reinforced anti-commandeering, the parties frame the federal order as especially suspect.",
    "stepModifications": [
      {
        "stepIndex": 0,
        "choiceIndex": 1,
        "textAppend": "This option is strengthened by the campaign's earlier anti-commandeering precedent."
      }
    ]
  }
]
```

### Step 7: Test the New Scenario

After saving `scenarios.json`:

1. reload the app
2. play the scenario in Standard mode
3. if it is a campaign scenario, verify that the precedent flag is set or consumed correctly
4. run the test suite in `tests/index.html`

## Campaign Mode Precedent System

Campaign Mode stores doctrine flags in the session state. These flags are set by certain choices and later consumed by other scenarios through `precedentConditions`.

### Current Precedent Flags

| Flag | Set By | Downstream Effect |
|---|---|---|
| `strongExecutiveAuthority` | `youngstown-steel-seizure` | reframes `scenario_032` (war powers) |
| `permissiveNonDelegation` | `nondelegation-intelligible-principle` | reframes `spending-clause-coercion` |
| `strongUnitaryExecutive` | `removal-independent-agency-head` | reframes `removal-multi-member-commission` |
| `strictBicameralismPresentment` | `ins-v-chadha-legislative-veto` | reframes `scenario_032` |
| `broadCommerceClause` | `scenario_021` | reframes `scenario_022` |
| `expansiveSpendingPower` | `spending-clause-coercion` | reframes `scenario_026` |
| `strongAntiCommandeering` | `scenario_026` | reframes `scenario_030` |
| `expansivePresidentialImmunity` | `presidential-immunity-framework` | reframes `scenario_009` |
| `strongExecutiveConfidentiality` | `scenario_009` | reframes `scenario_029` |
| `broadWarPowers` | `scenario_032` | reframes `scenario_029` |
| `robustPoliticalQuestionDoctrine` | `scenario_033` | reframes `scenario_030` |
| `strongForeignAffairsDeference` | `scenario_029` | reframes `scenario_030` |

### How It Works Internally

1. a player makes a choice in campaign mode
2. the choice may attach a `setsPrecedent` object
3. `game.js` merges that object into `gameState.precedentState`
4. when a later scenario loads, `game.js` clones the scenario
5. `precedentConditions` are checked against the stored flags
6. the cloned scenario is modified before rendering

This approach keeps the source data declarative. Most downstream effects are stored in `data/scenarios.json`, not hard-coded into the rendering layer.

## Running Tests

The test suite is lightweight and framework-free.

### Included Tests

- **`scoring.test.js`**
  - difficulty multipliers
  - partial-credit behavior
  - grade thresholds
  - zero / perfect / negative-score edge cases

- **`data-validation.test.js`**
  - scenario schema validation
  - campaign ID validation
  - valid `correct` states
  - case schema validation

- **`integration.test.js`**
  - starting games in different modes
  - score updates after a choice
  - scenario advancement
  - campaign precedent application
  - exam timer countdown
  - final score and grade rendering

### Running the Browser Test Runner

Serve the project from a static server, then open:

```text
/tests/index.html
```

Example:

```bash
python3 -m http.server
```

Then visit:

```text
http://localhost:8000/tests/
```

## Deployment

Because the project is fully static, it can be deployed to any static hosting platform.

### GitHub Pages

1. push the repository to GitHub
2. enable GitHub Pages in repository settings
3. choose the branch and folder that contains `index.html`
4. confirm that `data/` and `tests/` deploy alongside the main files

### Netlify / Static CDNs

1. drag-and-drop the project folder or connect the repository
2. set the publish directory to the project root
3. no build command is required

### Any Static File Server

The only requirement is that these paths remain available:

- `index.html`
- `styles.css`
- `game.js`
- `data/scenarios.json`
- `data/cases.json`

## Accessibility

The project now targets **WCAG 2.1 Level AA-oriented behavior** for core flows.

Implemented features include:

- skip link for keyboard users
- visible focus indicators
- focus-trapped modals with Escape support and focus return
- touch-friendly button sizing
- keyboard-accessible dialogs and controls
- live region announcements for score and timer changes
- pause/resume/extend controls for timed mode
- icon + text labels for correct / partial / incorrect states so meaning is not conveyed by color alone
- reduced-motion support for users who prefer less animation

## License

This project ships with the **MIT License** by default. See `LICENSE`.

If you intend to publish the project institutionally, replace the placeholder author name with the correct rights holder.
