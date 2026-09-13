# 🦊 Logic Riddle Fox Puzzle Solver

A mobile-friendly browser-based solver for the **Logic Riddle** color-grid puzzle. Built with plain HTML, CSS and JavaScript with no dependencies or build step.

## 🎮 Play the Original Game

The solver is designed for **Logic Riddle - Dog Puzzle Game** by Easybrain. The game is available on Google Play:

👉 [Play Logic Riddle on Google Play](https://play.google.com/store/apps/details?id=com.easybrain.logic.riddle.puzzle)

## 🦊 Use the Solver

👉 [Open the Live Logic Riddle Solver](https://dog-puzzle-solver.m7503345712.workers.dev/)

Use the solver to scan a screenshot from the game, automatically detect the board size and connected regions, and find the solution.

## 🧩 Puzzle Rules

- Exactly one fox in every row
- Exactly one fox in every column
- Exactly one fox in every connected colored region
- Foxes cannot touch each other, including diagonally

## ✨ Features

- 🦊 Constraint-based backtracking solver
- 📱 Mobile-friendly responsive interface
- 📷 Screenshot upload
- ✂️ Interactive screenshot cropping with touch-friendly corner handles
- 🔍 Automatic board-size detection
- 🧩 Connected-region detection
- 🎨 Does not require a fixed list of board sizes
- 🔁 Designed to handle new sizes such as 12×12, 13×13, 14×14 and larger without code changes
- 🖌️ Manual board painting with an arbitrary board size
- 📊 Displays the final fox position for every row
- ⚡ Runs entirely in the browser
- 🚫 No external dependencies or build process required

## 📷 Screenshot Workflow

1. Play a level in **Logic Riddle**.
2. Take a screenshot of the puzzle.
3. Open the [Live Solver](https://dog-puzzle-solver.m7503345712.workers.dev/).
4. Tap **Scan Screenshot**.
5. Select your Logic Riddle screenshot.
6. Use the crop handles to select only the puzzle grid.
7. Move or resize the crop area if needed.
8. Tap **Crop & Detect**.
9. The solver automatically determines the **N×N board size** and the connected colored regions.
10. Check the detected board.
11. Tap **🦊 Solve**.

Cropping is especially useful on mobile screenshots because it removes the status bar, puzzle title, hearts, instructions and other UI elements before detection.

## 🧠 Solver

The solver models the puzzle using **connected regions**, not just color names. This is important because two separate regions can theoretically use the same color.

For a detected `N×N` board, the solver enforces:

- One fox per row
- One fox per column
- One fox per connected region
- No two foxes may be adjacent horizontally, vertically or diagonally

The search uses minimum-remaining-candidates row selection to reduce unnecessary backtracking.

## 🔄 Dynamic Board Size

The scanner no longer has a hard-coded `4×4 ... 15×15` detection range.

Conceptually the flow is:

```text
Screenshot
   ↓
Detect cell grid
   ↓
Infer N × N
   ↓
Sample cell colors
   ↓
Build connected regions
   ↓
Validate N regions
   ↓
Solve
```

So when the game introduces a larger level, the application does **not** need a new code change just because the board changed from 12×12 to 13×13, 14×14, and so on.

## 🛠️ Technology

- HTML5
- CSS3
- Vanilla JavaScript
- HTML Canvas for screenshot processing
- Pointer Events for mobile/desktop crop interaction

## 🚀 Run Locally

No installation is required.

Open `index.html` in any modern browser.

## 📁 Project Structure

```text
.
├── index.html
├── style.css
├── script.js
├── scan-fix.js
├── crop-fix.js
└── README.md
```

## 🌐 Repository

GitHub: https://github.com/adityaparsad01/dog-puzzle-solver

## 📄 License

This project is provided for personal and educational use.
