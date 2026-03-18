# Snake (Vanilla JS)

A small browser-based Snake game with a local (per-device) Top 10 ranking stored in `localStorage`.

## Files

- `index.html`: Page layout (Home, Game, Ranking views) and wiring points (button/canvas/input element IDs).
- `app.js`: All game logic (game loop, rendering on `canvas`, input handling, and Top 10 persistence/UI).
- `styles.css`: Styling + theme variables (colors, layout, overlay dialogs, ranking list).

## How to Run

This app is fully static. To play:

1. Open `index.html` in a modern browser.
2. Use the UI buttons (`Play`, `Ranking`) to navigate.

No build step or server is required.

## Gameplay Rules

- The board is a `17 x 17` grid (`gridSize = 17`).
- Your snake starts centered, length `3`, moving to the right.
- Each tick:
  - The snake advances one cell in the current direction.
  - You lose if the snake hits the wall or intersects with its own body.
- Apples:
  - When the snake reaches the apple, the score increases by `1`.
  - The snake grows by keeping its tail (no `pop()` on that tick).
  - The apple respawns on a random empty cell.
- Speed:
  - Start speed uses `tickMs = 110`.
  - After eating an apple: `tickMs = max(55, tickMs - 3)`.
  - The interval is restarted to apply the new speed immediately.

## Controls

- `Arrow Up/Down/Left/Right`: Change direction.
- Direction changes are buffered:
  - The key press updates `queuedDir`.
  - The game applies `queuedDir` on the next `gameTick`.
- Reverse prevention:
  - If the snake length is at least `2`, direction reversals into the immediate body are blocked.
- Focus handling:
  - The game attempts to focus `canvasFrame` so arrow keys work even if the cursor is not over the canvas.

## UI / Views

The app switches between three view sections by toggling the `.hidden` class via `showView(...)`.

- Home (`#homeView`)
  - `Play`: Starts a new game.
  - `Ranking`: Shows the Top 10 list.
- Game (`#gameView`)
  - Live score pill (`#liveScore`).
  - `Restart`: Resets the current run.
  - `Home`: Stops the timer and returns to the Home view.
- Ranking (`#rankingView`)
  - `#rankingList`: Ordered Top 10 entries.
  - `#noScoresMsg`: Shown when there are no scores yet.

## Ranking (Top 10) Implementation

### Storage

- Storage key: `snake_ranking_top10_v1`

Saved values are an array of objects:

```js
{ name: string, score: number, at: number }
```

### Loading / Validation

`loadRanking()`:

- Reads from `localStorage`.
- Safely handles missing/invalid data:
  - Returns `[]` if parsing fails or data is not an array.
- Filters entries to ensure:
  - `score` is a `number`
  - `name` is a `string`
- Sorting:
  - Primary: higher `score` first
  - Secondary: older `at` first (stable ordering for ties)
- Returns only the first `10` entries.

### When a Score Is Saved

When the game ends (`endGame()`):

- The app checks if your `score` qualifies for the Top 10:
  - If fewer than `10` scores exist, it always qualifies.
  - Otherwise, it compares against the current minimum Top 10 score.
- If it qualifies:
  - The overlay switches to "New Record!".
  - A name input is shown.

### Name Input Rules

The name is required to match:

- Exactly 3 uppercase letters: `/^[A-Z]{3}$/`
- Input is uppercased and trimmed before validation.
- On save, the entry is added, the list is re-sorted, sliced to top 10, then persisted.

If `localStorage` is blocked/unavailable, the game still works, but ranking persistence may fail.

## Architecture (High-Level)

### Component Flow (Mermaid)

```mermaid
flowchart TD
  A[Browser loads index.html] --> B[app.js starts]
  B --> C[DOM wiring + view setup]
  C --> D[Home view]
  D -->|Play| E[resetGame; start game loop]
  E --> F[gameTick() movement + collisions]
  F -->|Apple| G[score increases; speed up]
  F -->|Collision| H[endGame()]
  H --> I[loadRanking() + qualifies check]
  I -->|Qualifies| J[show name input overlay]
  J --> K[saveNameBtn -> saveRanking(top10)]
  D -->|Ranking| L[renderRanking; show rankingView]
```

## Extension Ideas

- Add a difficulty selector (initial `tickMs`, speed increment, or grid size).
- Support touch input (swipe gestures).
- Add an option to clear local ranking.
- Add animations/sounds with minimal changes to the `draw()` loop.

