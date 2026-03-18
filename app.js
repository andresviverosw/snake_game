(() => {
  const gridSize = 17;

  const homeView = document.getElementById("homeView");
  const gameView = document.getElementById("gameView");
  const rankingView = document.getElementById("rankingView");

  const playBtn = document.getElementById("playBtn");
  const rankingBtn = document.getElementById("rankingBtn");
  const backFromGameBtn = document.getElementById("backFromGameBtn");
  const backFromRankingBtn = document.getElementById("backFromRankingBtn");
  const restartBtn = document.getElementById("restartBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const toRankingBtn = document.getElementById("toRankingBtn");

  const liveScoreEl = document.getElementById("liveScore");

  const canvasFrame = document.getElementById("canvasFrame");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const overlay = document.getElementById("gameOverlay");
  const finalScoreValue = document.getElementById("finalScoreValue");
  const finalTitle = document.getElementById("finalTitle");
  const top10Section = document.getElementById("top10Section");
  const nameInput = document.getElementById("nameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");
  const nameError = document.getElementById("nameError");

  const rankingMeta = document.getElementById("rankingMeta");
  const rankingList = document.getElementById("rankingList");
  const noScoresMsg = document.getElementById("noScoresMsg");

  const STORAGE_KEY = "snake_ranking_top10_v1";

  /** @type {{name:string, score:number, at:number}[]} */
  function loadRanking() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x) => x && typeof x.score === "number" && typeof x.name === "string")
        .map((x) => ({ name: x.name, score: x.score, at: typeof x.at === "number" ? x.at : Date.now() }))
        .sort((a, b) => b.score - a.score || a.at - b.at)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  function saveRanking(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // If storage is blocked, the game still works, but ranking persistence may be unavailable.
    }
  }

  function isTop10Score(score, ranking) {
    if (ranking.length < 10) return true;
    const min = ranking.reduce((m, r) => Math.min(m, r.score), Infinity);
    return score >= min;
  }

  function renderRanking() {
    const ranking = loadRanking();
    rankingList.innerHTML = "";

    if (ranking.length === 0) {
      noScoresMsg.classList.remove("hidden");
      rankingMeta.textContent = "";
      return;
    }

    noScoresMsg.classList.add("hidden");
    rankingMeta.textContent = "(All time)";

    ranking.forEach((entry, idx) => {
      const li = document.createElement("li");

      const left = document.createElement("div");
      left.className = "rankingLeft";

      const pos = document.createElement("span");
      pos.className = "pos";
      pos.textContent = `${idx + 1}.`;

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = entry.name;

      left.appendChild(pos);
      left.appendChild(name);

      const score = document.createElement("span");
      score.className = "score";
      score.textContent = `${entry.score}`;

      li.appendChild(left);
      li.appendChild(score);
      rankingList.appendChild(li);
    });
  }

  function showView(view) {
    homeView.classList.add("hidden");
    gameView.classList.add("hidden");
    rankingView.classList.add("hidden");
    view.classList.remove("hidden");
  }

  function setCanvasSize() {
    const padding = 10;
    const availableW = Math.max(320, window.innerWidth - 2 * padding);
    const availableH = Math.max(420, window.innerHeight - 2 * padding - 120);

    const target = Math.floor(Math.min(availableW, availableH) - 30);
    const cell = Math.max(10, Math.floor(target / gridSize));

    const sizePx = cell * gridSize;

    canvas.width = sizePx;
    canvas.height = sizePx;
  }

  const snakeColors = {
    head: getComputedStyle(document.documentElement).getPropertyValue("--green").trim() || "#22c55e",
    body: getComputedStyle(document.documentElement).getPropertyValue("--green2").trim() || "#16a34a",
    apple: getComputedStyle(document.documentElement).getPropertyValue("--red").trim() || "#ef4444",
  };

  /** @type {{x:number, y:number}[]} */
  let snake = [];
  /** @type {{x:number, y:number}} */
  let apple = { x: 0, y: 0 };
  /** @type {{x:number, y:number}} */
  let dir = { x: 1, y: 0 };
  /** @type {{x:number, y:number}} */
  let queuedDir = { x: 1, y: 0 };
  let score = 0;
  let gameOver = false;

  let tickMs = 110;
  let timer = null;

  function samePos(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function randInt(min, maxInclusive) {
    return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  }

  function randomApple() {
    const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
    const total = gridSize * gridSize;
    for (let tries = 0; tries < total * 2; tries++) {
      const x = randInt(0, gridSize - 1);
      const y = randInt(0, gridSize - 1);
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
    // Fallback: in the extremely unlikely case, just find the first empty cell.
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (!occupied.has(`${x},${y}`)) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  function clampDir(next) {
    // Prevent reversing into itself (e.g. moving left while currently moving right).
    if (snake.length >= 2) {
      const head = snake[0];
      const second = snake[1];
      const current = { x: head.x - second.x, y: head.y - second.y };
      if (next.x === -current.x && next.y === -current.y) return dir;
    }
    return next;
  }

  function resetGame() {
    score = 0;
    gameOver = false;

    const mid = Math.floor(gridSize / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];

    dir = { x: 1, y: 0 };
    queuedDir = { x: 1, y: 0 };
    tickMs = 110;
    liveScoreEl.textContent = `${score}`;

    apple = randomApple();

    overlay.classList.add("hidden");
    top10Section.classList.add("hidden");
    nameError.classList.add("hidden");
    nameInput.value = "";

    draw(); // Render initial board with the new snake/apple.

    clearInterval(timer);
    timer = setInterval(gameTick, tickMs);

    // Focus so arrow keys work even if the cursor isn't over the canvas.
    canvasFrame.focus();
  }

  function gameTick() {
    if (gameOver) return;

    dir = queuedDir;
    const head = snake[0];
    const next = { x: head.x + dir.x, y: head.y + dir.y };

    // Wall collision
    if (next.x < 0 || next.y < 0 || next.x >= gridSize || next.y >= gridSize) {
      endGame();
      return;
    }

    // Self collision
    if (snake.some((p, i) => i !== snake.length - 1 && samePos(p, next))) {
      endGame();
      return;
    }

    snake.unshift(next);

    if (samePos(next, apple)) {
      score += 1;
      liveScoreEl.textContent = `${score}`;
      apple = randomApple();

      // Speed-up a little as you score, but keep it playable.
      tickMs = Math.max(55, tickMs - 3);
      clearInterval(timer);
      timer = setInterval(gameTick, tickMs);
    } else {
      snake.pop();
    }

    draw();
  }

  function endGame() {
    gameOver = true;
    clearInterval(timer);
    timer = null;

    finalScoreValue.textContent = `${score}`;
    finalTitle.textContent = "Game Over";

    const ranking = loadRanking();
    const qualifies = isTop10Score(score, ranking);

    overlay.classList.remove("hidden");
    top10Section.classList.add("hidden");
    nameError.classList.add("hidden");
    nameInput.value = "";

    if (qualifies) {
      finalTitle.textContent = "New Record!";
      top10Section.classList.remove("hidden");
      nameInput.focus();
    }
  }

  function roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawCell(x, y, fill, stroke, glow) {
    const size = canvas.width / gridSize;
    const pad = Math.max(1, Math.floor(size * 0.10));
    const r = Math.max(3, Math.floor(size * 0.28));

    const px = x * size + pad / 2;
    const py = y * size + pad / 2;
    const w = size - pad;
    const h = size - pad;

    if (glow) {
      ctx.shadowColor = glow.color;
      ctx.shadowBlur = glow.blur;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = fill;
    roundedRect(px, py, w, h, r);
    ctx.fill();

    if (stroke) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      roundedRect(px, py, w, h, r);
      ctx.stroke();
    }
  }

  function draw() {
    const size = canvas.width / gridSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid background & lines
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundedRect(0, 0, canvas.width, canvas.height, 14);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    for (let i = 1; i < gridSize; i++) {
      const p = i * size;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
      ctx.stroke();
    }

    // Apple (red)
    drawCell(apple.x, apple.y, "rgba(239,68,68,0.95)", "rgba(255,255,255,0.18)", {
      color: "rgba(239,68,68,0.55)",
      blur: 10,
    });

    // Snake (green)
    for (let i = snake.length - 1; i >= 0; i--) {
      const p = snake[i];
      const isHead = i === 0;
      const fill = isHead ? "rgba(34,197,94,0.98)" : "rgba(22,163,74,0.92)";
      const stroke = "rgba(255,255,255,0.14)";
      const glow = isHead ? { color: "rgba(34,197,94,0.48)", blur: 10 } : null;
      drawCell(p.x, p.y, fill, stroke, glow);
    }

    // Simple eyes on the head (direction-aware)
    const head = snake[0];
    const sizePx = canvas.width / gridSize;
    const pad = Math.max(1, Math.floor(sizePx * 0.10));
    const r = Math.max(3, Math.floor(sizePx * 0.28));
    const cellX = head.x * sizePx + pad / 2;
    const cellY = head.y * sizePx + pad / 2;
    const w = sizePx - pad;
    const h = sizePx - pad;

    const eyeOffset = Math.max(2, Math.floor(w * 0.18));
    const eyeR = Math.max(2, Math.floor(w * 0.09));
    let ex1 = 0,
      ey1 = 0,
      ex2 = 0,
      ey2 = 0;

    if (dir.x === 1) {
      ex1 = cellX + w - eyeOffset;
      ey1 = cellY + h * 0.38;
      ex2 = cellX + w - eyeOffset;
      ey2 = cellY + h * 0.62;
    } else if (dir.x === -1) {
      ex1 = cellX + eyeOffset;
      ey1 = cellY + h * 0.38;
      ex2 = cellX + eyeOffset;
      ey2 = cellY + h * 0.62;
    } else if (dir.y === 1) {
      ex1 = cellX + w * 0.38;
      ey1 = cellY + h - eyeOffset;
      ex2 = cellX + w * 0.62;
      ey2 = cellY + h - eyeOffset;
    } else {
      ex1 = cellX + w * 0.38;
      ey1 = cellY + eyeOffset;
      ex2 = cellX + w * 0.62;
      ey2 = cellY + eyeOffset;
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  function setArrowHandler() {
    window.addEventListener("keydown", (e) => {
      if (gameView.classList.contains("hidden")) return;

      const key = e.key;
      if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return;
      e.preventDefault();

      const next =
        key === "ArrowUp"
          ? { x: 0, y: -1 }
          : key === "ArrowDown"
            ? { x: 0, y: 1 }
            : key === "ArrowLeft"
              ? { x: -1, y: 0 }
              : { x: 1, y: 0 };

      queuedDir = clampDir(next);
    });
  }

  function focusForNameInput() {
    overlay.classList.remove("hidden");
    top10Section.classList.remove("hidden");
    nameError.classList.add("hidden");
    nameInput.focus();
    nameInput.select();
  }

  saveNameBtn.addEventListener("click", () => {
    const ranking = loadRanking();
    const qualifies = isTop10Score(score, ranking);
    if (!qualifies) return; // Should not happen, but keeps it safe.

    const name = (nameInput.value || "").trim().toUpperCase();
    const ok = /^[A-Z]{3}$/.test(name);
    if (!ok) {
      nameError.classList.remove("hidden");
      return;
    }

    const entry = { name, score, at: Date.now() };
    const next = [...ranking, entry].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10);
    saveRanking(next);

    // Update ranking view if user clicks it next.
    nameError.classList.add("hidden");
    top10Section.classList.add("hidden");
    finalTitle.textContent = "Saved!";
  });

  toRankingBtn.addEventListener("click", () => {
    renderRanking();
    showView(rankingView);
  });

  playAgainBtn.addEventListener("click", () => resetGame());
  restartBtn.addEventListener("click", () => resetGame());

  playBtn.addEventListener("click", () => {
    showView(gameView);
    setCanvasSize();
    resetGame();
  });

  rankingBtn.addEventListener("click", () => {
    renderRanking();
    showView(rankingView);
  });

  backFromGameBtn.addEventListener("click", () => {
    clearInterval(timer);
    timer = null;
    showView(homeView);
  });

  backFromRankingBtn.addEventListener("click", () => showView(homeView));

  window.addEventListener("resize", () => {
    if (!gameView.classList.contains("hidden")) {
      setCanvasSize();
      draw();
    }
  });

  // Initial UI
  setArrowHandler();
  renderRanking();
  showView(homeView);
})();

