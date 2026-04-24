const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const exitButton = document.getElementById("exit-button");
const pauseButton = document.getElementById("pause-button");
const soundButton = document.getElementById("sound-button");
const menuButton = document.getElementById("menu-button");
const sensorNote = document.getElementById("sensor-note");
const finalScore = document.getElementById("final-score");
const startTitle = document.getElementById("start-title");
const startCopy = document.getElementById("start-copy");
const controlTips = document.getElementById("control-tips");
const difficultyButtons = Array.from(document.querySelectorAll("[data-difficulty]"));

const GRID_SIZE = 24;
const DIFFICULTIES = {
  easy: { label: "Easy", initialStepMs: 160, minStepMs: 84, scoreReduction: 2.8 },
  normal: { label: "Normal", initialStepMs: 140, minStepMs: 72, scoreReduction: 3.5 },
  hard: { label: "Hard", initialStepMs: 120, minStepMs: 60, scoreReduction: 4.3 },
};
const IS_COARSE_POINTER = window.matchMedia("(pointer: coarse)").matches;
const INPUT_PROFILE = IS_COARSE_POINTER
  ? {
      turnThreshold: 0.25,
      deadZone: 0.14,
      smoothing: 0.2,
      turnCooldownMs: 110,
      orientationScaleX: 24,
      orientationScaleY: 20,
      motionScaleX: 8,
      motionScaleY: 8,
    }
  : {
      turnThreshold: 0.2,
      deadZone: 0.1,
      smoothing: 0.14,
      turnCooldownMs: 80,
      orientationScaleX: 22,
      orientationScaleY: 18,
      motionScaleX: 7,
      motionScaleY: 7,
    };

const state = {
  running: false,
  gameOver: false,
  score: 0,
  best: Number(localStorage.getItem("tilt-slither-best") || 0),
  soundEnabled: true,
  difficulty: "easy",
  width: 0,
  height: 0,
  cols: 0,
  rows: 0,
  cell: 0,
  snake: [],
  direction: { x: 1, y: 0 },
  queuedDirection: { x: 1, y: 0 },
  food: { x: 0, y: 0 },
  lastFrame: 0,
  accumulator: 0,
  stepMs: DIFFICULTIES.easy.initialStepMs,
  motion: { x: 0, y: 0 },
  tiltLock: null,
  audio: null,
  neutral: null,
  sensorSource: null,
  permissionStatus: "idle",
  paused: false,
  lastTurnAt: 0,
};

function hasSensorSupport() {
  return typeof DeviceOrientationEvent !== "undefined" || typeof DeviceMotionEvent !== "undefined";
}

function updateStartHints(controlMode = "tilt") {
  if (controlMode === "keyboard") {
    startTitle.textContent = "Use keyboard controls. Survive as long as you can.";
    startCopy.textContent =
      "Use arrow keys or WASD to steer. You can still play on desktop or devices without motion sensors.";
    controlTips.innerHTML = `
      <li>Use arrow keys or WASD to turn.</li>
      <li>Press Space or P to pause/resume.</li>
      <li>Eat fruit to grow and speed up.</li>
    `;
    return;
  }

  startTitle.textContent = "Tilt to turn. Survive as long as you can.";
  startCopy.textContent =
    "Hold your phone flat, tap start, then physically tilt left, right, up, or down to steer. The game listens to gyro or accelerometer data in real time.";
  controlTips.innerHTML = `
    <li>Tilt past the dead zone to trigger a turn.</li>
    <li>Press Space or P to pause/resume.</li>
    <li>Eat the neon fruit to grow and speed up.</li>
  `;
}

function syncPauseUi() {
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-label", state.paused ? "Resume game" : "Pause game");
}

function syncSoundUi() {
  soundButton.textContent = state.soundEnabled ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-label", state.soundEnabled ? "Turn sound off" : "Turn sound on");
}

function syncDifficultyUi() {
  difficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === state.difficulty;
    button.classList.toggle("choice-button--active", isActive);
  });
}

function getSavedBest() {
  try {
    return Number(localStorage.getItem("tilt-slither-best") || 0);
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    localStorage.setItem("tilt-slither-best", String(score));
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

state.best = getSavedBest();
bestEl.textContent = String(state.best);

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  state.width = width;
  state.height = height;
  state.cell = Math.max(16, Math.floor(Math.min(width, height) / GRID_SIZE));
  state.cols = Math.floor(width / state.cell);
  state.rows = Math.floor(height / state.cell);
}

function createSnake() {
  const centerX = Math.floor(state.cols / 2);
  const centerY = Math.floor(state.rows / 2);
  return [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ];
}

function placeFood() {
  let next;
  do {
    next = {
      x: Math.floor(Math.random() * state.cols),
      y: Math.floor(Math.random() * state.rows),
    };
  } while (state.snake.some((segment) => segment.x === next.x && segment.y === next.y));

  state.food = next;
}

function resetGame() {
  resizeCanvas();
  state.score = 0;
  state.snake = createSnake();
  state.direction = { x: 1, y: 0 };
  state.queuedDirection = { x: 1, y: 0 };
  state.stepMs = DIFFICULTIES[state.difficulty].initialStepMs;
  state.accumulator = 0;
  state.gameOver = false;
  state.running = true;
  state.paused = false;
  state.tiltLock = null;
  state.motion = { x: 0, y: 0 };
  state.neutral = null;
  state.sensorSource = null;
  state.lastTurnAt = 0;
  placeFood();
  scoreEl.textContent = "0";
  gameOverScreen.classList.remove("overlay--active");
  startScreen.classList.remove("overlay--active");
  syncPauseUi();
}

function setBest(score) {
  if (score > state.best) {
    state.best = score;
    saveBest(score);
    bestEl.textContent = String(score);
  }
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  state.paused = false;
  syncPauseUi();
  setBest(state.score);
  finalScore.textContent = `Final score: ${state.score}`;
  gameOverScreen.classList.add("overlay--active");
  playTone(180, 0.16, "sawtooth");
  playTone(110, 0.22, "square", 0.12);
}

function showMenu() {
  state.running = false;
  state.gameOver = false;
  state.paused = false;
  state.accumulator = 0;
  state.neutral = null;
  state.sensorSource = null;
  state.tiltLock = null;
  syncPauseUi();
  gameOverScreen.classList.remove("overlay--active");
  startScreen.classList.add("overlay--active");
}

function togglePause() {
  if (state.gameOver || startScreen.classList.contains("overlay--active")) {
    return;
  }

  state.paused = !state.paused;
  state.running = !state.paused;
  if (!state.paused) {
    state.lastFrame = performance.now();
  }
  syncPauseUi();
}

function inBounds(point) {
  return point.x >= 0 && point.y >= 0 && point.x < state.cols && point.y < state.rows;
}

function isOpposite(nextDirection, currentDirection) {
  return nextDirection.x === -currentDirection.x && nextDirection.y === -currentDirection.y;
}

function queueDirection(nextDirection) {
  if (isOpposite(nextDirection, state.direction)) {
    return;
  }

  if (nextDirection.x === state.direction.x && nextDirection.y === state.direction.y) {
    return;
  }

  state.queuedDirection = nextDirection;
}

function interpretMotion(xValue, yValue) {
  const now = performance.now();

  if (Math.abs(xValue) < INPUT_PROFILE.deadZone && Math.abs(yValue) < INPUT_PROFILE.deadZone) {
    state.tiltLock = null;
    return;
  }

  const dominantAxis = Math.abs(xValue) >= Math.abs(yValue) ? "x" : "y";
  const dominantValue = dominantAxis === "x" ? xValue : yValue;

  if (Math.abs(dominantValue) < INPUT_PROFILE.turnThreshold) {
    return;
  }

  if (now - state.lastTurnAt < INPUT_PROFILE.turnCooldownMs) {
    return;
  }

  const key = `${dominantAxis}:${dominantValue > 0 ? 1 : -1}`;

  if (state.tiltLock === key) {
    return;
  }

  state.tiltLock = key;
  state.lastTurnAt = now;

  if (dominantAxis === "x") {
    queueDirection({ x: xValue > 0 ? 1 : -1, y: 0 });
    return;
  }

  queueDirection({ x: 0, y: yValue > 0 ? 1 : -1 });
}

function onDeviceOrientation(event) {
  if (state.paused || !state.running) {
    return;
  }

  if (typeof event.gamma !== "number" || typeof event.beta !== "number") {
    return;
  }

  if (state.sensorSource && state.sensorSource !== "orientation") {
    return;
  }

  if (!state.sensorSource) {
    state.sensorSource = "orientation";
  }

  if (!state.neutral) {
    state.neutral = { gamma: event.gamma, beta: event.beta };
    return;
  }

  const gamma = event.gamma - state.neutral.gamma;
  const beta = event.beta - state.neutral.beta;
  const xValue = Math.max(-1, Math.min(1, gamma / INPUT_PROFILE.orientationScaleX));
  const yValue = Math.max(-1, Math.min(1, beta / INPUT_PROFILE.orientationScaleY));
  state.motion.x += (xValue - state.motion.x) * INPUT_PROFILE.smoothing;
  state.motion.y += (yValue - state.motion.y) * INPUT_PROFILE.smoothing;
  interpretMotion(state.motion.x, state.motion.y);
}

function onDeviceMotion(event) {
  if (state.paused || !state.running) {
    return;
  }

  if (state.sensorSource && state.sensorSource !== "motion") {
    return;
  }

  const acceleration = event.accelerationIncludingGravity || event.acceleration;
  if (!acceleration) {
    return;
  }

  if (!state.sensorSource) {
    state.sensorSource = "motion";
  }

  if (!state.neutral) {
    state.neutral = { gamma: acceleration.y || 0, beta: acceleration.x || 0 };
    return;
  }

  const deltaY = (acceleration.y || 0) - state.neutral.gamma;
  const deltaX = (acceleration.x || 0) - state.neutral.beta;
  const xValue = Math.max(-1, Math.min(1, deltaY / INPUT_PROFILE.motionScaleX));
  const yValue = Math.max(-1, Math.min(1, deltaX / -INPUT_PROFILE.motionScaleY));
  state.motion.x += (xValue - state.motion.x) * INPUT_PROFILE.smoothing;
  state.motion.y += (yValue - state.motion.y) * INPUT_PROFILE.smoothing;
  interpretMotion(state.motion.x, state.motion.y);
}

async function enableSensors() {
  const hasOrientationApi = typeof DeviceOrientationEvent !== "undefined";
  const hasMotionApi = typeof DeviceMotionEvent !== "undefined";

  if (!hasOrientationApi && !hasMotionApi) {
    state.permissionStatus = "unsupported";
    sensorNote.textContent = "Sensors unavailable on this device. Use arrow keys or WASD to steer.";
    updateStartHints("keyboard");
    return true;
  }

  state.permissionStatus = "granted";

  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    const orientationPermission = await DeviceOrientationEvent.requestPermission();
    if (orientationPermission !== "granted") {
      state.permissionStatus = "blocked";
      return false;
    }
  }

  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    const motionPermission = await DeviceMotionEvent.requestPermission();
    if (motionPermission !== "granted") {
      state.permissionStatus = "blocked";
      return false;
    }
  }

  window.removeEventListener("deviceorientation", onDeviceOrientation);
  window.removeEventListener("devicemotion", onDeviceMotion);
  window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });
  window.addEventListener("devicemotion", onDeviceMotion, { passive: true });
  sensorNote.textContent = "Tilt the phone to steer. Keep the motion smooth and deliberate.";
  updateStartHints("tilt");
  return true;
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();

  if (key === " " || key === "p") {
    event.preventDefault();
    togglePause();
    return;
  }

  const controls = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };

  const nextDirection = controls[key];
  if (!nextDirection) {
    return;
  }

  if (state.paused || !state.running) {
    return;
  }

  event.preventDefault();
  queueDirection(nextDirection);
}

function playTone(frequency, duration, type = "sine", delay = 0) {
  if (!state.soundEnabled) {
    return;
  }

  if (!state.audio) {
    state.audio = new (window.AudioContext || window.webkitAudioContext)();
  }

  const contextAudio = state.audio;
  if (!contextAudio) {
    return;
  }

  const startAt = contextAudio.currentTime + delay;
  const oscillator = contextAudio.createOscillator();
  const gain = contextAudio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain).connect(contextAudio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function updateSpeed() {
  const difficulty = DIFFICULTIES[state.difficulty];
  const reduction = Math.min(70, state.score * difficulty.scoreReduction);
  state.stepMs = Math.max(difficulty.minStepMs, difficulty.initialStepMs - reduction);
}

function advanceSnake() {
  state.direction = state.queuedDirection;

  const head = state.snake[0];
  const nextHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };

  if (!inBounds(nextHead)) {
    endGame();
    return;
  }

  const ateFood = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const body = ateFood ? state.snake.slice() : state.snake.slice(0, -1);

  if (body.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)) {
    endGame();
    return;
  }

  state.snake = [nextHead, ...body];

  if (ateFood) {
    state.score += 1;
    scoreEl.textContent = String(state.score);
    updateSpeed();
    placeFood();
    playTone(620, 0.08, "triangle");
    playTone(980, 0.05, "sine", 0.06);
  }
}

function drawBackground() {
  context.clearRect(0, 0, state.width, state.height);

  const gradient = context.createLinearGradient(0, 0, state.width, state.height);
  gradient.addColorStop(0, "#07111f");
  gradient.addColorStop(1, "#0d1b2d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, state.width, state.height);

  context.globalAlpha = 0.18;
  context.strokeStyle = "#6af1d7";
  context.lineWidth = 1;
  for (let x = 0; x <= state.cols; x += 1) {
    const pos = x * state.cell;
    context.beginPath();
    context.moveTo(pos, 0);
    context.lineTo(pos, state.rows * state.cell);
    context.stroke();
  }
  for (let y = 0; y <= state.rows; y += 1) {
    const pos = y * state.cell;
    context.beginPath();
    context.moveTo(0, pos);
    context.lineTo(state.cols * state.cell, pos);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawFood() {
  const x = state.food.x * state.cell;
  const y = state.food.y * state.cell;
  const radius = state.cell * 0.34;
  const centerX = x + state.cell / 2;
  const centerY = y + state.cell / 2;

  const glow = context.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius * 1.8);
  glow.addColorStop(0, "rgba(255, 220, 125, 0.95)");
  glow.addColorStop(1, "rgba(255, 124, 136, 0.02)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(centerX, centerY, radius * 1.8, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffd56c";
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
}

function drawSnake() {
  state.snake.forEach((segment, index) => {
    const x = segment.x * state.cell;
    const y = segment.y * state.cell;
    const padding = index === 0 ? state.cell * 0.08 : state.cell * 0.12;
    const size = state.cell - padding * 2;

    context.shadowColor = index === 0 ? "rgba(86, 240, 211, 0.7)" : "rgba(130, 167, 255, 0.25)";
    context.shadowBlur = index === 0 ? 24 : 14;
    context.fillStyle = index === 0 ? "#7affea" : index % 2 === 0 ? "#7d9eff" : "#4ad0c0";
    roundRect(x + padding, y + padding, size, size, 8);
    context.fill();
  });
  context.shadowBlur = 0;
}

function roundRect(x, y, width, height, radius) {
  const effectiveRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + effectiveRadius, y);
  context.arcTo(x + width, y, x + width, y + height, effectiveRadius);
  context.arcTo(x + width, y + height, x, y + height, effectiveRadius);
  context.arcTo(x, y + height, x, y, effectiveRadius);
  context.arcTo(x, y, x + width, y, effectiveRadius);
  context.closePath();
}

function draw() {
  drawBackground();
  drawFood();
  drawSnake();
}

function tick(timestamp) {
  if (!state.lastFrame) {
    state.lastFrame = timestamp;
  }

  const delta = timestamp - state.lastFrame;
  state.lastFrame = timestamp;

  if (state.running) {
    state.accumulator += delta;
    while (state.accumulator >= state.stepMs && state.running) {
      state.accumulator -= state.stepMs;
      advanceSnake();
    }
  }

  draw();
  requestAnimationFrame(tick);
}

async function startGame() {
  resizeCanvas();

  if (!state.audio) {
    state.audio = new (window.AudioContext || window.webkitAudioContext)();
  }

  const granted = await enableSensors();
  if (!granted) {
    sensorNote.textContent = "Sensor permission was blocked. Enable motion access in browser settings and retry.";
    return;
  }

  resetGame();
  if (state.audio && state.audio.state === "suspended") {
    await state.audio.resume();
  }

  playTone(420, 0.07, "triangle");
  playTone(640, 0.08, "sine", 0.05);
}

function setDifficulty(nextDifficulty) {
  state.difficulty = nextDifficulty;
  syncDifficultyUi();
}

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
exitButton.addEventListener("click", showMenu);
pauseButton.addEventListener("click", togglePause);
soundButton.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  syncSoundUi();
});
menuButton.addEventListener("click", showMenu);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", resizeCanvas, { passive: true });
window.addEventListener("orientationchange", resizeCanvas, { passive: true });

updateStartHints(hasSensorSupport() ? "tilt" : "keyboard");
syncPauseUi();
syncSoundUi();
syncDifficultyUi();
resizeCanvas();
setBest(state.best);
draw();
requestAnimationFrame(tick);