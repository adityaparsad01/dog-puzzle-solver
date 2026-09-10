# 🦊 Logic Riddle Fox Puzzle Solver

A mobile-friendly browser-based solver for the **Logic Riddle** color-grid puzzle. Built with plain HTML, CSS and JavaScript with no dependencies or build step.

## 🎮 Play the Original Game

The solver is designed for **Logic Riddle - Dog Puzzle Game** by Easybrain. The game is available on Google Play:

👉 [Play Logic Riddle on Google Play](https://play.google.com/store/apps/details?id=com.easybrain.logic.riddle.puzzle)

## 🦊 Use the Solver

👉 [Open the Live Logic Riddle Solver](https://dog-puzzle-solver.m7503345712.workers.dev/)

Use the solver to scan a screenshot from the game, detect the puzzle board, and find the solution.

## 🧩 Puzzle Rules

- Exactly one fox in every row
- Exactly one fox in every column
- Exactly one fox of each color
- Foxes cannot touch each other, including diagonally

## ✨ Features

- 🦊 Fast backtracking solver
- 📱 Mobile-friendly responsive interface
- 📷 Screenshot upload
- ✂️ Interactive screenshot cropping with touch-friendly corner handles
- 🔍 Automatic board detection
- 🎨 Supports board sizes from **4×4 to 15×15**
- 🖌️ Manual board painting
- 🎯 Preloaded 10×10 example puzzle
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
9. Check the detected board.
10. Tap **🦊 Solve**.

Cropping is especially useful on mobile screenshots because it removes the status bar, puzzle title, hearts, instructions and other UI elements before detection.

## 🧠 Solver

The solver uses a backtracking search with constraints for:

- Row uniqueness
- Column uniqueness
- Color uniqueness
- 8-neighbor non-touching rule

The solver is optimized to find the solution directly rather than adding artificial delays to the solving process.

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
