// ----- Config -----
const gridSize = 8;     
const cellSize = 50;    

// Canvas & UI
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const questionDiv = document.getElementById("question");
const answerDiv = document.getElementById("answer");
const controlsDiv = document.getElementById("controls");
const rollDiceBtn = document.getElementById("rollDiceBtn");
const pssPanel = document.getElementById("pssPanel");
const pssBtns = document.querySelectorAll(".pssBtn");
const offset = cellSize; // reserve space for coordinates
const victoryModal = document.getElementById("victoryModal");
const vpBtns = document.querySelectorAll(".vpBtn");
const rabbitKeys = ['rabbit', 'redRabbit', 'blueRabbit', 'blackRabbit'];
const scoresList = document.getElementById('scores');
let bluerabbit = null;
let redrabbit = null;
let blackrabbit = null;

const playerNames2p = {
  rabbit: "🐇 Rabbit",
  wolf: "🐺 Wolf"
};

const playerNames3p = {
  redRabbit: "🔴 Rabbit",
  blueRabbit: "🔵 Rabbit",
  wolf: "🐺 Wolf"
};

const playerNames4p = {
  redRabbit: "🔴 Rabbit",
  blueRabbit: "🔵 Rabbit",
  blackRabbit: "⚫ Rabbit",
  wolf: "🐺 Wolf"
};

// Multiplayer Modal
const teamModal = document.getElementById('teamModal');
const teamBtns = document.querySelectorAll('.teamBtn');

// New modals and elements
const humanTeamsModal = document.getElementById('humanTeamsModal');
const humanTeamOptions = document.getElementById('humanTeamOptions');
const playerSelectModal = document.getElementById('playerSelectModal');
const playerSelectMsg = document.getElementById('playerSelectMsg');
const playerOptions = document.getElementById('playerOptions');
const playerConfirmBtn = document.getElementById('playerConfirmBtn');

// State for human vs AI
let numHumanTeams = 1; // default
let humanTeams = new Set(); // names: 'rabbit', 'redRabbit', 'blueRabbit', 'blackRabbit', 'wolf'

// Helper: return names map for current team count
function getNamesMap() {
  if (numTeams === 2) return playerNames2p;
  if (numTeams === 3) return playerNames3p;
  return playerNames4p;
}

// Tag players with human/AI flag based on selection
function applyHumanAIAssignments() {
  const set = new Set(humanTeams);
  players = players.map(p => ({ ...p, isHuman: set.has(p.name) }));
}

function hasAnyHuman() {
  return players.some(p => p.isHuman);
}

// Utility: get active player keys for current numTeams
function getActivePlayerKeys() {
  if (numTeams === 2) return ['rabbit', 'wolf'];
  if (numTeams === 3) return ['redRabbit', 'blueRabbit', 'wolf'];
  return ['redRabbit', 'blueRabbit', 'blackRabbit', 'wolf'];
}

// Build human team options based on numTeams
function showHumanTeamsModal() {
  humanTeamOptions.innerHTML = '';
  // 1..numTeams options
  for (let i = 1; i <= numTeams; i++) {
    const btn = document.createElement('button');
    btn.className = 'vpBtn';
    btn.dataset.count = String(i);
    btn.textContent = String(i);
    btn.addEventListener('click', () => {
      numHumanTeams = i;
      humanTeams.clear();
      humanTeamsModal.classList.remove('show');
      showPlayerSelectModal();
    });
    humanTeamOptions.appendChild(btn);
  }
  humanTeamsModal.classList.add('show');
}

// Build player selection checklist
function showPlayerSelectModal() {
  playerOptions.innerHTML = '';
  playerConfirmBtn.disabled = true;

  const keys = getActivePlayerKeys();
  const pretty = {
    rabbit: '🐇 Rabbit',
    redRabbit: '🔴 Rabbit',
    blueRabbit: '🔵 Rabbit',
    blackRabbit: '⚫ Rabbit',
    wolf: '🐺 Wolf',
  };
  playerSelectMsg.textContent = `Select ${numHumanTeams} team(s) to be human`;

  keys.forEach(k => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = k;
    cb.addEventListener('change', () => {
      if (cb.checked) humanTeams.add(k); else humanTeams.delete(k);
      playerConfirmBtn.disabled = humanTeams.size !== numHumanTeams;
    });
    const span = document.createElement('span');
    span.textContent = pretty[k] || k;
    row.appendChild(cb);
    row.appendChild(span);
    playerOptions.appendChild(row);
  });

  playerConfirmBtn.onclick = () => {
    if (humanTeams.size !== numHumanTeams) return;
    playerSelectModal.classList.remove('show');
    // proceed to victory points modal
    victoryModal.classList.add('show');
  };

  playerSelectModal.classList.add('show');
}
canvas.width = (gridSize + 1 + 1) * cellSize; // 8 + safety + coord = 10 cells wide
canvas.height = (gridSize + 1 + 1) * cellSize; // same for height

// ----- Helpers -----
const inGrid = (x, y) => x >= 0 && x < gridSize && y >= 0 && y < gridSize;

// ----- Audio -----
const bgMusic = new Audio('peter-and-the-wolf-chiptune.mp3');
const pssClick = new Audio('PSS.mp3');
const diceRollSound = new Audio('dice.wav');
const winSound = new Audio('cheer.wav');
const loseSound = new Audio('meh.mp3');
const carrotSound = new Audio('carrotappears.wav'); 
const carrotCollectSound = new Audio('carrotcollected.wav'); 

// Roll-again tile sounds
const rollAgainSpawnSound = new Audio('shootingstar.wav');
const rollAgainTriggerSound = new Audio('keeponrollingbaby.wav'); // uses available file name in repo

const victoryMusic = new Audio('wearethechampionschiptune.mp3');
victoryMusic.volume = 1;

// Smooth fade utility for audio elements
function fadeOutAudio(audio, durationMs = 700, endVolume = 0, then = () => {}) {
  if (!audio) return then();
  const startVol = audio.volume;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const v = startVol + (endVolume - startVol) * t;
    audio.volume = Math.max(0, Math.min(1, v));
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      try { audio.pause(); } catch {}
      audio.currentTime = 0;
      audio.volume = startVol; // restore for next playback
      then();
    }
  }
  requestAnimationFrame(step);
}

// Start background music on first user interaction
let musicStarted = false;

function startMusicOnce() {
  if (!musicStarted) {
    bgMusic.loop = true;      // ensure it loops
    bgMusic.volume = 0.3;     // set your desired volume
    bgMusic.play().catch(() => console.log("Autoplay blocked"));
    musicStarted = true;
  }
}

// Trigger music on first user interaction
function armMusicStartOnce() {
  document.body.addEventListener('click', startMusicOnce, { once: true });
}
armMusicStartOnce();

// Mute button
const muteBtn = document.getElementById("muteBtn");
let isMuted = false;

muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  bgMusic.muted = isMuted;
  diceRollSound.muted = isMuted;
  pssClick.muted = isMuted;
  winSound.muted = isMuted;
  loseSound.muted = isMuted;

  muteBtn.textContent = isMuted ? "Unmute" : "Mute";
});

// ----- Set initial volumes -----
bgMusic.volume = 0.3; 
pssClick.volume = 0.5;

// ----- Images -----
const rabbitImg = new Image();
rabbitImg.src = 'images/rabbit.png';
const wolfImg = new Image();
wolfImg.src = 'images/wolf.png';
const carrotImg = new Image();
carrotImg.src = 'images/carrot.png';
const bluerabbitImg = new Image();
bluerabbitImg.src = 'images/bluerabbit.png';
const redrabbitImg = new Image();
redrabbitImg.src = 'images/redrabbit.png';
const blackrabbitImg = new Image();
blackrabbitImg.src = 'images/blackrabbit.png';

// Roll-again tile image
const rollAgainImg = new Image();
rollAgainImg.src = 'images/dice.jpg';

carrotImg.onload = () => console.log("Carrot loaded");

// ----- Game State -----
let rabbit = { x: 0, y: 0 };
let wolf = { x: 7, y: 7 };
let redRabbit = { x: 0, y: 0 };
let blueRabbit = { x: 0, y: 7 };
let blackRabbit = { x: 7, y: 0 };



const doorBottom = { x: 6, y: 7 }; 
const doorRight = { x: 7, y: 6 };
const waterTiles = [];

const rabbitCorners = [
  { x: 0, y: 0 },
  { x: 0, y: 7 },
  { x: 7, y: 0 }
];

const questions = [
  // Single-choice
  { 
    text: "What is 7 × 6?", 
    answer: "42"
  },
  // Multiple-choice
  { 
    text: "Which of the following is not a prime number?", 
    answer: "1", 
    options: ["1", "2", "3", "5"] 
  },
  // Single-choice
  { 
    text: "What planet is known as the Red Planet?", 
    answer: "Mars"
  },
  // Multiple-choice
  { 
    text: "Which of these animals are mammals?", 
    answer: "Dolphin", 
    options: ["Penguin", "Dolphin", "Crocodile", "Eagle"] 
  },
  // Single-choice
  { 
    text: "Who wrote 'Romeo and Juliet'?", 
    answer: "William Shakespeare"
  },
  // Multiple-choice
  { 
    text: "Which is not a primary color?:", 
    answer: "Green", 
    options: ["Red", "Blue", "Yellow", "Green"] 
  },
  // Single-choice
  { 
    text: "What is the chemical symbol for water?", 
    answer: "H2O"
  },
  // Multiple-choice
  { 
    text: "Which countries are in Europe?", 
    answer: "France, Germany, Spain", 
    options: ["France", "Germany", "Spain", "Brazil"] 
  },
  // Single-choice
  { 
    text: "How many continents are there on Earth?", 
    answer: "7"
  },
  // Multiple-choice
  { 
    text: "Which of these numbers is not even?", 
    answer: "1", 
    options: ["1", "2", "4", "8"] 
  }
];

let questionIndex = 0;
let currentQuestion = null;
let answerRevealed = false;
let stepsRemaining = 0;
let currentPlayer = null;
let [diceQueue] = [];

let pssHuman 
let pssResolved = false;
// AI Q&A auto-advance timeout handles (to avoid affecting humans)
let pssAITimeouts = [];
function clearPssAITimeouts() {
  try {
    pssAITimeouts.forEach(id => clearTimeout(id));
  } catch {}
  pssAITimeouts = [];
}

let rabbitWins = 0;
let wolfWins = 0; // default, can be 5, 10, or 15
let redRabbitWins = 0;
let blueRabbitWins = 0;
let blackRabbitWins = 0;
let carrot = null;        // {x, y, turnsRemaining}
let carrotJustSpawned = false; // skip first lifespan decrement right after spawn
let turnsSinceCarrot = 0; // counts PSS rounds
let carrotPoints = 0;     // rabbit points for collecting carrots

// Roll-again tiles state: array of {x,y,turnsRemaining}
let rollAgainTiles = [];
let rollAgainJustSpawned = false; // used to avoid decrement on the same endTurnUpdate as spawn
let turnsSinceRollAgain = 0;      // rounds since last spawn
let nextRollAgainIn = getRandomInt(1, 3); // rounds until next spawn

let isDiceTurn = false;
let victoryPoints = 5; // default
let numTeams = 2; // default
let multiplayerQueue = []; // global variable
let currentLoserIndex = 0; // start with first loser
let nextCarrotIn = getRandomInt(3, 6); // rounds until next carrot appears
let pssIndex = 0;  // Tracks whose turn it is
let rabbitRoundCounter = 0; // increment each dice phase
// If set, force this player to roll next (used by respawn-on-roll-again)
let forcedNextPlayerName = null;

// Assuming your player objects have a `name` property
let pssOrder;

let players = [];      // Global array for all players
let activeKeys = [];   // Global array for active keys
  // Determine which playerNames object to use
  let namesMap;
  if (numTeams === 2) {
    namesMap = playerNames2p; // 2-player mode
  } else if (numTeams === 3) {
    namesMap = playerNames3p; // 3-player mode
  } else {
    namesMap = playerNames4p; // 4-player mode
  }

const rabbits = [rabbit, redRabbit, blueRabbit, blackRabbit];
// ----- Safety zone helpers -----
const inSafetyZone = (x,y) => (y===8 && x>=6) || (x===8 && y>=6);

// ----- Respawn all rabbits to the farthest unoccupied corners -----
function respawnRabbit(rabbitObj) {
  // Only active rabbits in the game
  const activeRabbits = players
    .filter(p => p.name !== 'wolf')  // all rabbit players
    .map(p => p.obj)
    .filter(r => r && r !== rabbitObj);

  const occupied = [wolf, ...activeRabbits];

  // Sort corners by farthest from the wolf first
  const sortedCorners = [...rabbitCorners].sort((a, b) => {
    const da = Math.abs(a.x - wolf.x) + Math.abs(a.y - wolf.y);
    const db = Math.abs(b.x - wolf.x) + Math.abs(b.y - wolf.y);
    return db - da; // descending (farthest first)
  });

  // Pick the first free corner in that order; if none, do nothing
  const bestCorner = sortedCorners.find(c => !occupied.some(o => o.x === c.x && o.y === c.y));
  if (!bestCorner) return;

  rabbitObj.x = bestCorner.x;
  rabbitObj.y = bestCorner.y;

  let showedSpecialMsg = false;
  // Auto-collect carrot if one exists here (with scoring + victory check)
  if (carrot && carrot.x === rabbitObj.x && carrot.y === rabbitObj.y) {
    const wrapperAtCorner = players.find(p => p.obj === rabbitObj);
    const playerName = wrapperAtCorner?.name;
    // Clear carrot and play sound
    carrot = null;
    try { carrotCollectSound.play(); } catch {}
    // Increment the correct rabbit's score
    switch (playerName) {
      case 'rabbit': rabbitWins++; break;
      case 'redRabbit': redRabbitWins++; break;
      case 'blueRabbit': blueRabbitWins++; break;
      case 'blackRabbit': blackRabbitWins++; break;
    }
    updateScores();
    // Victory supersedes any other UI
    checkMatchWin();
    if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
    const nm = getNamesMap();
    updateMessage(`🐇 ${nm[playerName] || playerName} collected a carrot on respawn!`);
    showedSpecialMsg = true;
  }

  // If landing on a roll-again tile at respawn, consume it and force an immediate extra roll on next resume
  const tileIdx = rollAgainTiles.findIndex(t => t.x === rabbitObj.x && t.y === rabbitObj.y);
  if (tileIdx >= 0) {
    rollAgainTiles.splice(tileIdx, 1);
    try { rollAgainTriggerSound.play(); } catch {}
    drawBoard();
    const wrapperForExtra = players.find(p => p.obj === rabbitObj);
    if (wrapperForExtra) {
      showRollAgainToast();
      // Signal resumeGamePhase to give this player an immediate roll
      forcedNextPlayerName = wrapperForExtra.name;
    }
    showedSpecialMsg = true;
  }

  // Announce respawn in the main message area (only if no special event was shown)
  const wrapper = players.find(p => p.obj === rabbitObj);
  if (!showedSpecialMsg && wrapper) {
    const nm = (numTeams === 2) ? playerNames2p : (numTeams === 3) ? playerNames3p : playerNames4p;
    updateMessage(`${nm[wrapper.name] || wrapper.name} respawned at a corner.`);
  }
}


// --- Helper: ensure we always work with player-wrapper {name, obj}
function ensureWrapper(item) {
  if (!item) return null;
  // already a wrapper
  if (item.name && item.obj) return item;
  // try to find the wrapper that has this obj
  return players.find(p => p.obj === item) || null;
}

// ----- Water generation -----
function pathExists(start, target){
  const queue = [start];
  const visited = new Set();
  while(queue.length){
    const {x,y} = queue.shift();
    const key = `${x},${y}`;
    if(visited.has(key)) continue;
    visited.add(key);
    if(x===target.x && y===target.y) return true;
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dx,dy] of dirs){
      const nx=x+dx, ny=y+dy;
      if(nx>=0 && nx<gridSize && ny>=0 && ny<gridSize &&
         !waterTiles.some(t=>t.x===nx&&t.y===ny) &&
         !visited.has(`${nx},${ny}`)){
        queue.push({x:nx,y:ny});
      }
    }
  }
  return false;
}

function generateWaterTiles(){
  let safe=false;
  while(!safe){
    waterTiles.length=0;
    while(waterTiles.length<8){
      const x=Math.floor(Math.random()*gridSize);
      const y=Math.floor(Math.random()*gridSize);
      const occupied =
        (x===0 && y===0) || 
        (x===0 && y===7) || 
        (x===7 && y===0) || 
        (x===7 && y===7) || 
        (x===doorBottom.x && y===doorBottom.y) || 
        (x===doorRight.x && y===doorRight.y) || 
        waterTiles.some(t => t.x===x && t.y===y);
      if(!occupied) waterTiles.push({x,y});
    }
safe =
  (pathExists({x:0,y:0}, doorBottom) || pathExists({x:0,y:0}, doorRight)) &&
  (pathExists({x:0,y:7}, doorBottom) || pathExists({x:0,y:7}, doorRight)) &&
  (pathExists({x:7,y:0}, doorBottom) || pathExists({x:7,y:0}, doorRight)) &&
  (pathExists({x:7,y:7}, doorBottom) || pathExists({x:7,y:7}, doorRight));
  }
}

function generateCarrot() {
  let x, y;
  const forbidden = new Set();
  // Add door tiles
  forbidden.add(`${doorBottom.x},${doorBottom.y}`);
  forbidden.add(`${doorRight.x},${doorRight.y}`);
  // Add safety zone coordinates (off-grid visual cells)
  for (let i = 6; i <= 8; i++) {
    forbidden.add(`${8},${i}`); // right column visuals
    forbidden.add(`${i},${8}`); // bottom row visuals
  }
  // Add current wolf and rabbits and water tiles
  if (wolf) forbidden.add(`${wolf.x},${wolf.y}`);
  rabbits.forEach(r => { if (r) forbidden.add(`${r.x},${r.y}`); });
  waterTiles.forEach(t => { forbidden.add(`${t.x},${t.y}`); });
  // Avoid roll-again tiles too (no overlap)
  rollAgainTiles.forEach(t => { forbidden.add(`${t.x},${t.y}`); });

  // Pick inside playable grid 0..7
  do {
    x = Math.floor(Math.random() * gridSize);
    y = Math.floor(Math.random() * gridSize);
  } while (forbidden.has(`${x},${y}`));

  carrot = { x, y, turnsRemaining: 1 }; // overwritten in endTurnUpdate
  try { carrotSound.play(); } catch(e) {}
  drawBoard();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function shuffleScoreboard() {
    const list = Array.from(document.querySelectorAll('.scoreboard-item'));
    if (list.length === 0) return []; // safety check
    const parent = list[0].parentNode;

    // Shuffle using Fisher–Yates
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    // Re-append shuffled elements
    list.forEach(item => parent.appendChild(item));
    return list;
}

function collectCarrot(rabbit) {
  if (carrot && rabbit.x === carrot.x && rabbit.y === carrot.y) {
    carrot = null; 
    carrotCollectSound.play(); // 🔊 play collection sound
    // optional: reset spawn counter if you want
  }
}

function resetCarrotCounter() {
  carrotTurnCounter = 0;   // or whatever variable you’re using
}

// Helper: get random integer between min and max inclusive
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ----- Roll-again helpers -----
function isForbiddenForSpecialTile(x, y) {
  // Must be inside grid
  if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return true;
  // Not safety zone and not doors' front squares
  if (inSafetyZone(x, y)) return true;
  if ((x === doorBottom.x && y === doorBottom.y) || (x === doorRight.x && y === doorRight.y)) return true;
  // Not in front of doors (tiles just outside safety zone entrances)
  // For bottom door, the tile "in front" is same x, y = 6 (inside grid), since door is at (6,7)
  if (x === doorBottom.x && y === doorBottom.y - 1) return true;
  // For right door, the tile "in front" is x = 6, same y, since door is at (7,6)
  if (y === doorRight.y && x === doorRight.x - 1) return true;

  // Not occupied by players
  if (wolf && wolf.x === x && wolf.y === y) return true;
  for (const p of players) {
    if (p && p.obj && p.name !== 'wolf') {
      if (p.obj.x === x && p.obj.y === y) return true;
    }
  }
  // Not water
  if (waterTiles.some(t => t.x === x && t.y === y)) return true;
  // Not overlapping carrot
  if (carrot && carrot.x === x && carrot.y === y) return true;
  // Not overlapping other roll-again tiles
  if (rollAgainTiles.some(t => t.x === x && t.y === y)) return true;
  return false;
}

function getRollAgainSpawnInterval() {
  // 1–3 rounds between spawns
  return getRandomInt(1, 3);
}

function scheduleNextRollAgain() {
  nextRollAgainIn = getRandomInt(1, 3);
}

function spawnRollAgainTiles() {
  // Cap total concurrent tiles at 2, and spawn only 1–2 per event
  const MAX_CONCURRENT = 2;
  const availableSlots = Math.max(0, MAX_CONCURRENT - rollAgainTiles.length);
  if (availableSlots <= 0) return; // Already at cap

  const desired = getRandomInt(1, 2);
  const count = Math.min(desired, availableSlots);

  let spawned = 0;
  let attempts = 0;
  while (spawned < count && attempts < 200) {
    attempts++;
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    if (!isForbiddenForSpecialTile(x, y)) {
      rollAgainTiles.push({ x, y, turnsRemaining: 1 }); // will be reset to lifespan below
      spawned++;
    }
  }
  if (spawned > 0) {
    // Ensure a lifespan of exactly 1 full round for all new tiles
    rollAgainTiles = rollAgainTiles.map(t => ({ ...t, turnsRemaining: Math.max(t.turnsRemaining, 1) }));
    rollAgainJustSpawned = true;
    try { rollAgainSpawnSound.play(); } catch {}
    drawBoard();
  }
}

// Carrot spawn scheduling adjusts by number of rabbits
function getRabbitCount() {
  // Wolf is always 1 team; rabbits are the remainder
  if (numTeams === 2) return 1;
  if (numTeams === 3) return 2;
  return 3; // numTeams === 4
}

function scheduleNextCarrot() {
  const rabbitCount = getRabbitCount();
  // More rabbits -> spawn more frequently
  // 1 rabbit: 3–6 rounds; 2 rabbits: 2–4 rounds; 3 rabbits: 1–3 rounds
  if (rabbitCount === 1) {
    nextCarrotIn = getRandomInt(3, 6);
  } else if (rabbitCount === 2) {
    nextCarrotIn = getRandomInt(2, 4);
  } else {
    nextCarrotIn = getRandomInt(1, 3);
  }
}

function endTurnUpdate() {
  turnsSinceCarrot++;
  turnsSinceRollAgain++;

  // --- Carrot lifespan countdown (before spawning new ones) ---
  if (carrot) {
    if (carrotJustSpawned) {
      // Skip the very first decrement to ensure visibility this round
      carrotJustSpawned = false;
    } else {
      carrot.turnsRemaining--;
      if (carrot.turnsRemaining <= 0) {
        carrot = null;
      }
    }
  }

  // --- Roll-again tiles lifespan countdown ---
  if (rollAgainTiles.length > 0) {
    if (rollAgainJustSpawned) {
      // Spawn happened this same endTurnUpdate call; do not decrement now
      rollAgainJustSpawned = false;
    } else {
      // Decrement by one round; tiles vanish when <= 0
      rollAgainTiles.forEach(t => t.turnsRemaining--);
      rollAgainTiles = rollAgainTiles.filter(t => t.turnsRemaining > 0);
    }
  }

  // --- Carrot spawning ---
  if (!carrot && turnsSinceCarrot >= nextCarrotIn) {
    // Spawn carrot
    generateCarrot();
    // Randomize how long it will stay (1–3 rounds)
    carrot.turnsRemaining = getRandomInt(1, 3);
    carrotJustSpawned = true; // mark so we don't immediately decrement
    turnsSinceCarrot = 0; // reset counter
    // Schedule next carrot spawn (scaled by rabbits)
    scheduleNextCarrot();
  }

  // --- Roll-again tiles spawning ---
  // Spawn every 1–3 rounds. When triggered, spawn 1–3 tiles.
  if (turnsSinceRollAgain >= nextRollAgainIn) {
    spawnRollAgainTiles();
    turnsSinceRollAgain = 0;
    scheduleNextRollAgain();
  }

  drawBoard();
}

// ----- Reachable squares -----
function getReachableSquares(player, steps) {
  const visited = new Set();
  const queue = [{ x: player.x, y: player.y, remaining: steps }];
  const reachable = [];

  while (queue.length) {
    const { x, y, remaining } = queue.shift();
    const key = `${x},${y},${remaining}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (remaining === 0) {
      reachable.push({ x, y });
      continue;
    }

    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      if (!inGrid(nx, ny) && !inSafetyZone(nx, ny)) continue;

      // Rabbits movement rules (only active rabbits block and move)
      const activeRabbits = players.filter(p => p && p.name !== 'wolf').map(p => p.obj);
      const self = player.obj || player;
      const isRabbit = activeRabbits.includes(self);

      if (isRabbit) {
        const outsideSafety = !inSafetyZone(x, y);
        const enteringSafety = inSafetyZone(nx, ny);
        if (outsideSafety && enteringSafety) {
          const isDoor = (x === doorBottom.x && y === doorBottom.y) || (x === doorRight.x && y === doorRight.y);
          if (!isDoor) continue; // door-only entry preserved
        }

        // Avoid wolf
        if (wolf.x === nx && wolf.y === ny) continue;

        // Avoid water
        if (waterTiles.some(t => t.x === nx && t.y === ny)) continue;

        // Avoid other active rabbits
        if (activeRabbits.some(r => r && r !== self && r.x === nx && r.y === ny)) continue;

        // Blocked by wolf in single-cell gaps (must go around)
        if (isSingleCellGapBlocked(x, y, nx, ny)) continue;

      } else {
        // Wolf movement rules
        if (waterTiles.some(t => t.x === nx && t.y === ny)) continue;
        if (inSafetyZone(nx, ny)) continue;
      }

      queue.push({ x: nx, y: ny, remaining: remaining - 1 });
    }
  }
  return reachable;
}

// Helper: check if wolf blocks a single-cell path
function isSingleCellGapBlocked(x, y, nx, ny) {
  // Horizontal gap
  if ((ny === y) && Math.abs(nx - x) === 1) {
    if ((nx < wolf.x && wolf.x < x) || (x < wolf.x && wolf.x < nx)) return true;
  }
  // Vertical gap
  if ((nx === x) && Math.abs(ny - y) === 1) {
    if ((ny < wolf.y && wolf.y < y) || (y < wolf.y && wolf.y < ny)) return true;
  }
  return false;
}

// Draw A–I and 1–9 coordinates on the canvas (non-invasive)


function drawCoordinates(ctx, cellSize, gridSize) {
  const letters = 'ABCDEFGHI'.split('');  // A to I
  const numbers = Array.from({ length: 9 }, (_, i) => i + 1);  // 1 to 9

  const offset = cellSize;  // match the offset used for the grid

  ctx.save();
  ctx.font = `${cellSize / 3}px Bangers, cursive`;  // adjust size
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'black';  // coordinates color

  // Draw letters above columns
  for (let col = 0; col < letters.length; col++) {
    const x = offset + col * cellSize + cellSize / 2;
    const y = cellSize / 2;  // centered in extra top cell
    ctx.fillText(letters[col], x, y);
  }

  // Draw numbers to the left of rows
  for (let row = 0; row < numbers.length; row++) {
    const x = cellSize / 2;  // centered in extra left cell
    const y = offset + row * cellSize + cellSize / 2;
    ctx.fillText(numbers[row], x, y);
  }

  ctx.restore();
}

// ----- Drawing -----
function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawCoordinates(ctx, cellSize, gridSize)

  const offset = cellSize; // leave space for coordinates

// Draw grid
for (let y = 0; y < gridSize; y++) {
  for (let x = 0; x < gridSize; x++) {
    ctx.fillStyle = "#fff"; // normal grid color
    ctx.fillRect(offset + x*cellSize, offset + y*cellSize, cellSize, cellSize);
    ctx.strokeStyle = "#333";
    ctx.strokeRect(offset + x*cellSize, offset + y*cellSize, cellSize, cellSize);
  }
}

// Draw safety zone (backwards L)
ctx.fillStyle = "#ffd54a";
// Right column
for (let y = 6; y <= 8; y++) {
  ctx.fillRect(offset + gridSize*cellSize, offset + y*cellSize, cellSize, cellSize);
}
// Bottom row
for (let x = 6; x <= 8; x++) {
  ctx.fillRect(offset + x*cellSize, offset + gridSize*cellSize, cellSize, cellSize);
}

  // ----- Draw water tiles -----
  ctx.fillStyle = "#3a7afe";
  waterTiles.forEach(tile => {
    ctx.fillRect(
      offset + tile.x * cellSize,
      offset + tile.y * cellSize,
      cellSize,
      cellSize
    );
  });

// Draw carrot (safe load)
if (carrot) {
  const drawCarrot = () => {
    ctx.drawImage(
      carrotImg,
      offset + carrot.x * cellSize,
      offset + carrot.y * cellSize,
      cellSize,
      cellSize
    );
  };
  if (carrotImg.complete && carrotImg.naturalWidth !== 0) {
    drawCarrot();
  } else {
    carrotImg.onload = () => { drawCarrot(); };
  }
}

// Draw roll-again tiles (safe load) with subtle glow
if (rollAgainTiles && rollAgainTiles.length) {
  const drawGlow = (t) => {
    const x = offset + t.x * cellSize + cellSize / 2;
    const y = offset + t.y * cellSize + cellSize / 2;
    const radius = cellSize * 0.6;
    ctx.save();
    ctx.globalAlpha = 0.28;
    const grad = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    grad.addColorStop(0, 'rgba(255,255,0,0.9)');
    grad.addColorStop(1, 'rgba(255,165,0,0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawTile = (t) => {
    try {
      drawGlow(t);
      // Slightly inset the dice image so it fits neatly within the cell
      const pad = Math.floor(cellSize * 0.08); // ~8% padding on each side (~4px at 50px)
      const size = cellSize - pad * 2;
      ctx.drawImage(
        rollAgainImg,
        offset + t.x * cellSize + pad,
        offset + t.y * cellSize + pad,
        size,
        size
      );
    } catch {}
  };
  if (rollAgainImg.complete && rollAgainImg.naturalWidth !== 0) {
    rollAgainTiles.forEach(drawTile);
  } else {
    rollAgainImg.onload = () => { rollAgainTiles.forEach(drawTile); };
  }
}

// ----- Highlight reachable squares -----
if (currentPlayer && stepsRemaining > 0 && isDiceTurn) {
  const playerObj = ensureWrapper(currentPlayer)?.obj || currentPlayer;
  const squares = getReachableSquares(playerObj, stepsRemaining);
  ctx.fillStyle = "rgba(0,255,0,0.3)";
  squares.forEach(sq => {
    ctx.fillRect(
      offset + sq.x * cellSize,
      offset + sq.y * cellSize,
      cellSize,
      cellSize
    );
  });
}

// ----- Draw characters -----
const imgMap = {
  rabbit: rabbitImg,
  wolf: wolfImg,
  redRabbit: redrabbitImg,
  blueRabbit: bluerabbitImg,
  blackRabbit: blackrabbitImg
};

for (const player of players) {
  if (!activeKeys.includes(player.name)) continue; // only draw active players
  const img = imgMap[player.name]; // use name, not type
  if (img) safeDrawRabbit(img, player.obj);
}

// Ensure images exist and only draw if everything is ready
function safeDrawRabbit(img, rabbit) {
  try {
    if (!img || !rabbit || !ctx) return; // safety check
    if (img.complete && img.naturalWidth !== 0) {
      ctx.drawImage(
        img,
        offset + rabbit.x * cellSize,
        offset + rabbit.y * cellSize,
        cellSize,
        cellSize
      );
    } else {
      img.onload = () => {
        if (!ctx || !rabbit) return;
        ctx.drawImage(
          img,
          offset + rabbit.x * cellSize,
          offset + rabbit.y * cellSize,
          cellSize,
          cellSize
        );
      };
    }
  } catch (e) {
    console.error("Rabbit drawing error:", e);
  }
}






// ----- Draw border with door gaps -----
ctx.fillStyle = "#000";
const borderThickness = 4;

// Top border
ctx.fillRect(offset, offset, gridSize * cellSize, borderThickness);

// Left border
ctx.fillRect(offset, offset, borderThickness, gridSize * cellSize);

// Bottom border (with door gap at doorBottom)
ctx.fillRect(offset, offset + gridSize * cellSize - borderThickness, gridSize * cellSize, borderThickness);
ctx.clearRect(offset + doorBottom.x * cellSize, offset + gridSize * cellSize - borderThickness, cellSize, borderThickness);

// Right border (with door gap at doorRight)
ctx.fillRect(offset + gridSize * cellSize - borderThickness, offset, borderThickness, gridSize * cellSize);
ctx.clearRect(offset + gridSize * cellSize - borderThickness, offset + doorRight.y * cellSize, borderThickness, cellSize);
}

// ----- Check Win -----
// ----- Check if any score triggers victory -----
function checkWin() {
  const localRabbitKeys = ['rabbit','redRabbit','blueRabbit','blackRabbit'];
  const namesMap = (numTeams === 2) ? playerNames2p : (numTeams === 3) ? playerNames3p : playerNames4p;

  function getWrapper(key) {
    const w = players.find(p => p.name === key);
    if (!w || !w.obj) return null;
    return w;
  }

  const winsMap = {
    rabbit: () => { rabbitWins++; },
    redRabbit: () => { redRabbitWins++; },
    blueRabbit: () => { blueRabbitWins++; },
    blackRabbit: () => { blackRabbitWins++; }
  };

  // --- 1) Wolf catches a rabbit ---
  for (const key of localRabbitKeys) {
    const wrapper = getWrapper(key);
    if (!wrapper) continue;
    const r = wrapper.obj;

    if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) continue;
    if (!Number.isFinite(wolf.x) || !Number.isFinite(wolf.y)) continue;

    if (wolf.x === r.x && wolf.y === r.y) {
      try { loseSound.play(); } catch(e) {}
      wolfWins++;
      updateScores();
      drawBoard();
      updateMessage(`🐺 Wolf caught ${namesMap[key] || key}!`);
      answerDiv.textContent = '';

      // Pause dice & movement immediately
      rollDiceBtn.disabled = true;
      currentPlayer = null;
      stepsRemaining = 0;

      // ✅ Check for victory
      checkMatchWin();

      // Only respawn rabbit if the game is NOT over (and no victory happened during timeout)
      if (wolfWins < victoryPoints) {
        setTimeout(() => {
          if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
          try { respawnRabbit(r); } catch(e) { console.warn('respawnRabbit failed (caught):', e); }
          drawBoard();
          resumeGamePhase();
        }, 1200);
      }

      return true;
    }
  }

  // --- 2) Rabbit reaches safety ---
  for (const key of localRabbitKeys) {
    const wrapper = getWrapper(key);
    if (!wrapper) continue;
    const r = wrapper.obj;

    if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) continue;

    if (inSafetyZone(r.x, r.y)) {
      try { winSound.play(); } catch(e) {}
      if (winsMap[key]) winsMap[key]();
      updateScores();
      drawBoard();
      updateMessage(`🛟 ${namesMap[key] || key} reached safety!`);
      answerDiv.textContent = '';

      // Pause dice & movement
      rollDiceBtn.disabled = true;
      currentPlayer = null;
      stepsRemaining = 0;

      // ✅ Check for victory
      checkMatchWin();

      // Only respawn rabbit if game NOT over
      const rabbitWinCount = {
        rabbit: rabbitWins,
        redRabbit: redRabbitWins,
        blueRabbit: blueRabbitWins,
        blackRabbit: blackRabbitWins
      }[key];

      if (rabbitWinCount < victoryPoints) {
        setTimeout(() => {
          // Guard: if a victory was declared in the meantime, do not respawn or resume
          if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
          try { respawnRabbit(r); } catch(e) { console.warn('respawnRabbit failed (safety):', e); }
          drawBoard();
          resumeGamePhase();
        }, 1200);
      } else {
        // Keep the winning rabbit in safety while victory is shown
        drawBoard();
      }

      return true;
    }
  }

  return false;
}

// ----- Controls helpers -----
function ensureDiceControls() {
  // If a stale victory lock exists, clear it for dice prompts
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') {
    delete questionDiv.dataset.victory;
  }
  // Stop any lingering PSS/Q&A timers that might race UI updates
  try { clearPssAITimeouts(); } catch {}

  // Render the Roll Dice button into controls
  controlsDiv.innerHTML = '';
  if (!rollDiceBtn.classList.contains('controlsBtn')) rollDiceBtn.classList.add('controlsBtn');
  controlsDiv.appendChild(rollDiceBtn);
  rollDiceBtn.style.display = 'inline-block';
  rollDiceBtn.style.visibility = 'visible';
  rollDiceBtn.disabled = false;
  pssPanel.style.display = 'none';

  // Re-assert once on next frame to beat any late clears
  requestAnimationFrame(() => {
    if (!controlsDiv.contains(rollDiceBtn)) {
      controlsDiv.innerHTML = '';
      controlsDiv.appendChild(rollDiceBtn);
      rollDiceBtn.style.display = 'inline-block';
      rollDiceBtn.style.visibility = 'visible';
      rollDiceBtn.disabled = false;
    }
  });
}

function showDiceControls() {
  ensureDiceControls();
}

function showPSSControls() {
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
  controlsDiv.innerHTML = "";
  controlsDiv.appendChild(pssPanel);
  pssPanel.style.display = "block";
  rollDiceBtn.style.display = "none";
  rollDiceBtn.disabled = true;
}

// ----- Resume dice queue or PSS -----
function resumeGamePhase() {
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;

  // If a respawn forced an immediate roll but the queue is empty, seed the queue
  if (forcedNextPlayerName && (!diceQueue || diceQueue.length === 0)) {
    const forcedWrapper = players.find(p => p && p.name === forcedNextPlayerName);
    if (forcedWrapper) {
      diceQueue = [forcedWrapper];
    }
  }

  if (diceQueue.length > 0) {
    let nextPlayer = ensureWrapper(diceQueue[0]);

    // If a respawn consumed a roll-again tile, force that player to the front
    if (forcedNextPlayerName) {
      const idx = diceQueue.findIndex(w => w && w.name === forcedNextPlayerName);
      if (idx > 0) {
        const [forced] = diceQueue.splice(idx, 1);
        diceQueue.unshift(forced);
      }
      nextPlayer = ensureWrapper(diceQueue[0]);
      // Clear the flag once we've honored it
      forcedNextPlayerName = null;
    }

    // Robust normalization/recovery of diceQueue head
    if (!nextPlayer || !nextPlayer.name) {
      const recovered = players.find(p => p && p.obj === diceQueue[0]);
      if (recovered) {
        diceQueue[0] = recovered;
        nextPlayer = recovered;
      } else {
        // Drop bad head and try again once; otherwise fall back to PSS
        diceQueue.shift();
        if (!diceQueue.length) {
          currentPlayer = null;
          showPSSControls();
          startPSSRound();
          maybeAutoPlayPSS();
          return;
        }
        nextPlayer = ensureWrapper(diceQueue[0]);
        if (!nextPlayer || !nextPlayer.name) {
          currentPlayer = null;
          showPSSControls();
          startPSSRound();
          maybeAutoPlayPSS();
          return;
        }
      }
    }

    currentPlayer = nextPlayer;
    showDiceControls();

    // Immediately highlight the next player when prompting to roll
    if (nextPlayer && nextPlayer.name) {
      highlightCurrentPlayer(nextPlayer.name);
    }

    const namesMap = getNamesMap();
    questionDiv.textContent = `${namesMap[nextPlayer.name] || nextPlayer.name}, roll the dice!`;
    maybeAutoRollIfAI(nextPlayer);
  } else {
    currentPlayer = null;
    showPSSControls();
    startPSSRound();
    maybeAutoPlayPSS();
  }
}

// ----- Check for match victory -----
function checkMatchWin() {
  const scores = {
    rabbit: rabbitWins,
    redRabbit: redRabbitWins,
    blueRabbit: blueRabbitWins,
    blackRabbit: blackRabbitWins,
    wolf: wolfWins
  };

  const namesMap = getNamesMap();

  for (const [key, score] of Object.entries(scores)) {
    if (score >= victoryPoints && activeKeys.includes(key)) {
      declareVictory(namesMap[key] || key, score);
      return;
    }
  }
}

// ----- Handle victory: confetti, music, and end match -----
function declareVictory(winnerName, points) {
  // Ensure ONLY the victory message is visible across the UI
  updateMessage(`${winnerName} wins the match with ${points} points! 🎉`);
  // Clear all PSS/Q&A UI immediately
  questionDiv.dataset.victory = 'true'; // marker to suppress further UI writes
  answerDiv.textContent = '';
  controlsDiv.innerHTML = '';
  try { clearPssAITimeouts(); } catch {}
  pssPanel.style.display = 'none';
  rollDiceBtn.disabled = true;
  rollDiceBtn.style.display = 'none';
  // Also clear dice queue so no further turns resume
  diceQueue = [];

  triggerConfetti();

  // Smoothly fade out background music, then start victory music
  fadeOutAudio(bgMusic, 800, 0, () => {
    victoryMusic.pause();
    victoryMusic.currentTime = 0;
    victoryMusic.volume = 0.3;
    victoryMusic.play().catch(err => {
      console.log("Victory music playback was blocked:", err);
    });
  });

  endMatch();
}

// ----- End match: disable movement & PSS -----
function endMatch() {
  currentPlayer = null;
  stepsRemaining = 0;
  rollDiceBtn.disabled = true;
  rollDiceBtn.style.display = "none";
  // Ensure no controls remain visible
  controlsDiv.innerHTML = "";
  // Hide/disable PSS controls
  pssBtns.forEach(btn => btn.disabled = true);
  pssPanel.style.display = "none";
  // Ensure only victory message remains visible
  answerDiv.textContent = "";
  // Stop any pending AI PSS timers
  try { clearPssAITimeouts(); } catch {}
  diceQueue = [];
  // Prevent any further UI updates after victory
  questionDiv.dataset.victory = 'true';
}

// ----- Confetti -----
function triggerConfetti() {
  // Simple confetti using canvas-confetti library
  // If you don’t want external libraries, you can make small falling rectangles on a canvas overlay
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
  });
}

function enableDiceButton() {
  rollDiceBtn.disabled = false;
}

function enablePSSButtons() {
  pssBtns.forEach(btn => btn.disabled = false);
}



// ----- Build Dice Queue for a Round -----

// ----- Build Dice Queue for a Round -----
function buildDiceQueue() {
    const wolfWrapper = players.find(p => p.name === "wolf");
    const rabbitOrder = getRabbitOrder(); // cyclic rotation
    const rabbitWrappers = rabbitOrder.map(name => players.find(p => p.name === name));

    // Wolf always first
    diceQueue = [wolfWrapper, ...rabbitWrappers];
    currentPlayer = diceQueue[0];
    stepsRemaining = 0;
    isDiceTurn = false;
    rollDiceBtn.disabled = false;

    // Update scores and reorder scoreboard based on turn order (this is the one time per turn)
    updateScores();
    reorderScoreboard();
    highlightCurrentPlayer(currentPlayer.name);

    const namesMap = (numTeams === 2) ? playerNames2p
                    : (numTeams === 3) ? playerNames3p
                    : playerNames4p;
    questionDiv.textContent = `${namesMap[currentPlayer.name] || currentPlayer.name}, roll the dice first!`;
}

// ----- Get Rabbit Order (Cyclic Rotation) -----
function getRabbitOrder() {
    const activeRabbits = players.filter(p => rabbitKeys.includes(p.name)).map(p => p.name);

    const rotationIndex = rabbitRoundCounter % activeRabbits.length;
    const rotated = activeRabbits.slice(rotationIndex).concat(activeRabbits.slice(0, rotationIndex));

    rabbitRoundCounter++; // increment after rotation
    return rotated;
}

// ----- Advance Dice Queue After a Turn -----
function advanceDiceQueue() {
    if (!diceQueue || diceQueue.length < 2) return;

    // Move first rabbit (index 1) to the end for cyclic rotation
    const firstRabbit = diceQueue.splice(1, 1)[0];
    diceQueue.push(firstRabbit);

    normalizeDiceQueue();

    currentPlayer = diceQueue[0]; // Wolf always first
    stepsRemaining = 0;
    isDiceTurn = false;
    rollDiceBtn.disabled = false;

    // Update scores (no reorder mid-turn)
    updateScores();
    highlightCurrentPlayer(currentPlayer.name);

    const namesMap = (numTeams === 2) ? playerNames2p
                   : (numTeams === 3) ? playerNames3p
                   : playerNames4p;
    questionDiv.textContent = `${namesMap[currentPlayer.name] || currentPlayer.name}, roll the dice!`;

    // Start next dice turn
    startNextDiceTurn();
}

// ----- Update Scoreboard -----
function updateScoreboard(queue = diceQueue) {
    const scoreboard = document.getElementById("scoreboard");
    if (!scoreboard) return;
    scoreboard.innerHTML = "";

    queue.forEach(p => {
        if (!p) return;

        let emoji = "";
        switch(p.name) {
            case 'wolf': emoji = '🐺'; break;
            case 'rabbit': emoji = '🐇'; break;
            case 'redRabbit': emoji = '🔴'; break;
            case 'blueRabbit': emoji = '🔵'; break;
            case 'blackRabbit': emoji = '⚫'; break;
        }

        const li = document.createElement("li");
        li.textContent = `${emoji} ${p.name} — Score: ${p.score ?? 0}`;
        li.classList.add("score-item");
        scoreboard.appendChild(li);
    });
}

// ----- Normalize Dice Queue -----
function normalizeDiceQueue() {
    diceQueue = diceQueue
        .map(p => {
            if (!p) return null;
            if (p.name) return p;
            if (p.obj) {
                const found = players.find(pl => pl.obj === p.obj);
                if (found && found.name) return found;
            }
            console.warn("Removed invalid diceQueue entry:", p);
            return null;
        })
        .filter(p => p && p.name);
}

// Helper: create a scoreboard <li> if missing
function createScoreItem(player) {
  const li = document.createElement('li');
  li.id = player.name + '-score';
  li.textContent = player.name; // optionally use namesMap[player.name]
  li.classList.add('score-item');
  scoresList.appendChild(li);
  return li;
}

function startNextDiceTurn() {
  const nextPlayer = getNextActivePlayer();

  if (!nextPlayer) {
    // All trapped or queue empty
    endTurnUpdate();
    currentPlayer = null;
    rollDiceBtn.disabled = true;
    startPSSRound();
    return;
  }

  startDiceMove(nextPlayer);
}

// ----- Start Dice Move -----
function startDiceMove(playerWrapper) {
  currentPlayer = playerWrapper;
  isDiceTurn = true;
  highlightCurrentPlayer(playerWrapper.name);

  const roll = Math.floor(Math.random() * 6) + 1;
  const bonus = rabbitKeys.includes(playerWrapper.name) ? 1 : 0;
  stepsRemaining = roll + bonus;

  try { diceRollSound.play(); } catch {}

  const namesMap = getNamesMap();

  questionDiv.textContent = `${namesMap[playerWrapper.name] || playerWrapper.name} rolled ${roll}${bonus ? ` + 1 = ${stepsRemaining}` : ""}.`;

  // Check if player has any valid moves with the rolled dice
  const reachableSquares = getReachableSquares(playerWrapper.obj, stepsRemaining);
  
  if (reachableSquares.length === 0 && rabbitKeys.includes(playerWrapper.name)) {
    // Rabbit is trapped with this dice roll
    updateMessage(`${namesMap[playerWrapper.name] || playerWrapper.name} is trapped! Turn skipped.`);
    
    // Skip turn and move to next player
    setTimeout(() => {
      endMovementPhase();
    }, 1500); // Show the message for 1.5 seconds before moving on
  }

  drawBoard();
}

// Add this function to end the movement phase and move to the next player
function endMovementPhase() {
  stepsRemaining = 0;
  isDiceTurn = false;
  // Refresh board to clear any move highlights immediately
  drawBoard();
  
  // Move to next player in diceQueue
  if (diceQueue && diceQueue.length > 0) {
    let nextPeek = diceQueue[0];
    const normalized = ensureWrapper(nextPeek);
    
    if (normalized) {
      nextPeek = normalized;
      diceQueue[0] = normalized; // update queue
    } else {
      const recovered = players.find(p => p.obj === nextPeek);
      if (recovered) {
        diceQueue[0] = recovered; // update queue
        nextPeek = recovered;
      }
    }
    
    if (nextPeek && nextPeek.name) {
      // Ensure the Roll Dice button is visible in controls
      ensureDiceControls();
      requestAnimationFrame(() => ensureDiceControls());

      highlightCurrentPlayer(nextPeek.name);
      const namesMap = getNamesMap();
      questionDiv.textContent = `${namesMap[nextPeek.name] || nextPeek.name}, roll the dice!`;
      maybeAutoRollIfAI(nextPeek);
      return;
    }
  }
  
  // All players have moved — end dice phase
  endTurnUpdate();
  rollDiceBtn.disabled = true;
  currentPlayer = null;
  stepsRemaining = 0;
  startPSSRound();
  maybeAutoPlayPSS();
}

// For automatic extra move after a roll-again trigger
function maybeAutoRollFollowupMove(wrapper) {
  try {
    if (!wrapper || wrapper.isHuman) return; // humans will click
    // For AI, after reroll, choose a square and move
    setTimeout(() => {
      const playerObj = wrapper.obj;
      const reachable = getReachableSquares(playerObj, stepsRemaining);
      if (!reachable || reachable.length === 0) { endMovementPhase(); return; }
      const target = (wrapper.name === 'wolf')
        ? chooseBestWolfSquare(reachable)
        : chooseBestRabbitSquare(reachable);
      playerObj.x = target.x;
      playerObj.y = target.y;
      stepsRemaining = 0;
      isDiceTurn = false;

      // Chain: if it lands again on another roll-again tile, trigger again
      const idx = rollAgainTiles.findIndex(t => t.x === playerObj.x && t.y === playerObj.y);
      if (idx >= 0) {
        rollAgainTiles.splice(idx, 1);
        try { rollAgainTriggerSound.play(); } catch {}
        drawBoard();
        setTimeout(() => {
          startDiceMove(wrapper);
          maybeAutoRollFollowupMove(wrapper);
        }, 350);
        return;
      }

      // Carrot collect check
      const playerName = wrapper.name;
      if (carrot && rabbitKeys.includes(playerName) && playerObj.x === carrot.x && playerObj.y === carrot.y) {
        carrot = null;
        try { carrotCollectSound.play(); } catch {}
        switch (playerName) {
          case 'rabbit': rabbitWins++; break;
          case 'redRabbit': redRabbitWins++; break;
          case 'blueRabbit': blueRabbitWins++; break;
          case 'blackRabbit': blackRabbitWins++; break;
        }
        updateScores();
        const namesMap = getNamesMap();
        // If victory triggers here, suppress all other UI text
        checkMatchWin();
        if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
        updateMessage(`🐇 ${namesMap[playerName] || playerName} collected a carrot!`);
        endMovementPhase();
        return;
      }

      drawBoard();
      if (checkWin()) { rollDiceBtn.disabled = true; currentPlayer = null; stepsRemaining = 0; return; }
      endMovementPhase();
    }, 600);
  } catch (e) { console.warn('maybeAutoRollFollowupMove error:', e); }
}


// Add this function to check if a player is trapped
function isPlayerTrapped(player) {
  // Check if player can move with any possible dice roll (1-6)
  for (let steps = 1; steps <= 6; steps++) {
    const reachableSquares = getReachableSquares(player, steps);
    if (reachableSquares.length > 0) {
      return false; // Player can move with this dice roll
    }
  }
  return true; // Player can't move with any dice roll
}

function getNextActivePlayer() {
  if (!diceQueue || diceQueue.length === 0) return null;

  let attempts = diceQueue.length;
  while (attempts--) {
    const nextWrapper = diceQueue[0] = ensureWrapper(diceQueue[0]) || diceQueue[0];

    // If invalid entry, drop it and continue
    if (!nextWrapper || !nextWrapper.obj || !nextWrapper.name) {
      diceQueue.shift();
      continue;
    }

    const isRabbit = rabbitKeys.includes(nextWrapper.name);

    // Wolf or movable rabbit proceeds; truly trapped rabbit is skipped
    if (!isRabbit || !isPlayerTrapped(nextWrapper.obj)) {
      return nextWrapper;
    }

    const namesMap = getNamesMap();
    updateMessage(`🐇 ${namesMap[nextWrapper.name] || nextWrapper.name} is trapped, turn skipped!`);
    diceQueue.push(diceQueue.shift());
  }

  return null; // everyone trapped or queue invalid
}

// ----- Click to move -----
// --- Robust canvas click handler (tolerant of wrapper/raw currentPlayer)
canvas.addEventListener("click", (e) => {
  if (!currentPlayer) return;

  const wrapper = ensureWrapper(currentPlayer);
  const playerObj = wrapper ? wrapper.obj : currentPlayer;
  if (!playerObj) return;

  // If AI turn, ignore manual clicks
  const isHumanTurn = players.find(p => p.obj === playerObj || p === wrapper)?.isHuman;
  if (!isHumanTurn) return;

  if (stepsRemaining <= 0) return;

  const rect = canvas.getBoundingClientRect();
  const cellX = Math.floor((e.clientX - rect.left - cellSize) / cellSize);
  const cellY = Math.floor((e.clientY - rect.top - cellSize) / cellSize);

  const reachable = getReachableSquares(playerObj, stepsRemaining);
  if (!reachable.some(sq => sq.x === cellX && sq.y === cellY)) return;

  // Move player
  playerObj.x = cellX;
  playerObj.y = cellY;
  stepsRemaining = 0;
  isDiceTurn = false;

  // If landed on roll-again tile, trigger extra roll automatically
  const landedTileIndex = rollAgainTiles.findIndex(t => t.x === playerObj.x && t.y === playerObj.y);
  if (landedTileIndex >= 0) {
    // Remove the tile immediately
    rollAgainTiles.splice(landedTileIndex, 1);
    try { rollAgainTriggerSound.play(); } catch {}
    drawBoard();

    // Auto roll again for the same player
    const wrapperForExtra = ensureWrapper(wrapper) || players.find(p => p.obj === playerObj);
    if (wrapperForExtra) {
      showRollAgainToast();
      setTimeout(() => {
        startDiceMove(wrapperForExtra); // re-roll
        // For AI, auto-choose a square again; for humans, highlights will show
        maybeAutoRollFollowupMove(wrapperForExtra);
      }, 350);
    }
    return; // stop further end-of-turn logic; extra roll will handle flow
  }

  // Carrot collection
  const playerName = wrapper ? wrapper.name : (players.find(p => p.obj === playerObj) || {}).name;
  if (carrot && rabbitKeys.includes(playerName) && playerObj.x === carrot.x && playerObj.y === carrot.y) {
    carrot = null;
    carrotCollectSound.play();
    switch (playerName) {
      case 'rabbit': rabbitWins++; break;
      case 'redRabbit': redRabbitWins++; break;
      case 'blueRabbit': blueRabbitWins++; break;
      case 'blackRabbit': blackRabbitWins++; break;
    }
    updateScores();
    // Check victory first to ensure only victory message remains
    checkMatchWin();
    if (questionDiv.dataset && questionDiv.dataset.victory === 'true') {
      endMovementPhase();
      return;
    }
    const namesMap = getNamesMap();
    updateMessage(`🐇 ${namesMap[playerName] || playerName} collected a carrot!`);
    endMovementPhase();
  }

  // Redraw board (will still show highlights if stepsRemaining > 0)
  drawBoard();

  // Since this move ended the turn for this player, make sure highlights are cleared
  stepsRemaining = 0;
  isDiceTurn = false;
  drawBoard();

  // Check if win handled something
  if (checkWin()) {
    rollDiceBtn.disabled = true;
    currentPlayer = null;
    stepsRemaining = 0;
    return;
  }

  // Move to next player in diceQueue
// Move to next player in diceQueue
if (diceQueue && diceQueue.length > 0) {
  let nextPeek = diceQueue[0];
  const normalized = ensureWrapper(nextPeek);

  if (normalized) {
    diceQueue[0] = normalized; // update queue
    nextPeek = normalized;
  } else {
    const recovered = players.find(p => p.obj === nextPeek);
    if (recovered) {
      diceQueue[0] = recovered; // update queue
      nextPeek = recovered;
    }
  }

  if (nextPeek && nextPeek.name) {
    highlightCurrentPlayer(nextPeek.name);
    rollDiceBtn.disabled = false;
    const namesMap = getNamesMap();
    questionDiv.textContent = `${namesMap[nextPeek.name] || nextPeek.name}, roll the dice!`;
    maybeAutoRollIfAI(nextPeek);
    return;
  }
}

  // All players have moved — end dice phase
  endTurnUpdate();

  rollDiceBtn.disabled = true;
  currentPlayer = null;
  stepsRemaining = 0;
  startPSSRound();
  maybeAutoPlayPSS();
});


// ----- Setup players -----
function setupPlayers(numTeams) {
  activeKeys = [];
  players = [];

  if (numTeams === 2) {
    activeKeys = ['rabbit', 'wolf'];
    players = [
      { name: 'rabbit', obj: rabbit },
      { name: 'wolf', obj: wolf }
    ];
  } else if (numTeams === 3) {
  activeKeys = ['redRabbit', 'blueRabbit', 'wolf']; // no 'rabbit'
  players = [
    { name: 'redRabbit', obj: redRabbit },
    { name: 'blueRabbit', obj: blueRabbit },
    { name: 'wolf', obj: wolf }
  ];
  } else if (numTeams === 4) {
    activeKeys = ['redRabbit', 'blueRabbit', 'blackRabbit', 'wolf'];
    players = [
      { name: 'redRabbit', obj: redRabbit },
      { name: 'blueRabbit', obj: blueRabbit },
      { name: 'blackRabbit', obj: blackRabbit },
      { name: 'wolf', obj: wolf }
    ];
  }

  resetRabbitPositions();
  currentLoserIndex = 0;
  drawBoard();
}

function initPSSOrder() {
  // Only include active player names
  if (numTeams === 2) {
    pssOrder = ['rabbit', 'wolf'];
  } else if (numTeams === 3) {
    pssOrder = ['redRabbit', 'blueRabbit', 'wolf']; // rabbit removed
  } else if (numTeams === 4) {
    pssOrder = ['redRabbit', 'blueRabbit', 'blackRabbit', 'wolf']; // rabbit removed
  }
  // Prefer the first human as initial pssHuman if exists
  const firstHuman = getActivePlayerKeys().find(k => humanTeams.has(k));
  pssIndex = 0;
  pssHuman = firstHuman || pssOrder[0];
}


function getNextPSSHuman(current) {
  const index = players.indexOf(current);
  return players[(index + 1) % players.length];
}

function startTurn() {
  // Guard: only proceed when players are initialized and wolf exists
  if (!Array.isArray(players) || players.length === 0) return;
  const wolfWrapper = players.find(p => p.name?.toLowerCase() === "wolf");
  if (!wolfWrapper) return;

  console.log("🐾 Full players array:", players);
  console.log(" Wolf wrapper:", wolfWrapper);

  // Build rabbit order safely (may be empty if 2p and wolf-only moment)
  let rabbitOrderNames = [];
  try {
    const activeRabbitCount = players.filter(p => rabbitKeys.includes(p.name)).length;
    rabbitOrderNames = activeRabbitCount > 0 ? getRabbitOrder() : [];
  } catch (e) {
    console.warn("getRabbitOrder failed, defaulting to empty rabbits:", e);
    rabbitOrderNames = [];
  }
  console.log("🐇 Rabbit order names:", rabbitOrderNames);

  const rabbitOrder = rabbitOrderNames
    .map(name => players.find(p => p.name === name))
    .filter(Boolean);

  diceQueue = [wolfWrapper, ...rabbitOrder].filter(Boolean);
  console.log("🎲 Dice queue:", diceQueue);

  normalizeDiceQueue();

  currentPlayer = diceQueue[0];
  if (!currentPlayer) {
    console.warn("⚠️ No valid currentPlayer in diceQueue — check logs above!");
    return;
  }

  // 🟢 Now that diceQueue is ready, update scores and reorder scoreboard
  updateScores();
  reorderScoreboard();
  
  // Highlight the current player
  if (currentPlayer && currentPlayer.name) {
    highlightCurrentPlayer(currentPlayer.name);
  }
}


// ----- Start PSS round -----
function startPSSRound() {
  // If victory was declared, do nothing and keep UI clean
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
  // Move PSS into controls area; hide dice
  controlsDiv.innerHTML = "";
  controlsDiv.appendChild(pssPanel);
  pssPanel.style.display = "block";
  rollDiceBtn.style.display = "none";
  rollDiceBtn.disabled = true;
  pssResolved = false;

  // Build PSS order from current active players (exclude classic 'rabbit' in 3p/4p)
  if (numTeams === 2) {
    pssOrder = players.map(p => p.name);
  } else {
    pssOrder = players.map(p => p.name).filter(name => name !== 'rabbit');
  }

  const namesMap = getNamesMap();
  const label = namesMap[pssHuman] || pssHuman;
  answerDiv.textContent = `${label}, play paper-scissors-stone!`;
  highlightCurrentPlayer(pssHuman);

  // Toggle PSS buttons: enabled if human's turn, disabled if AI's turn
  const currentIsHuman = players.find(p => p.name === pssHuman)?.isHuman;
  pssBtns.forEach(btn => btn.disabled = !currentIsHuman);

  // If AI, auto-pick
  if (!currentIsHuman) maybeAutoPlayPSS();
}
startTurn(); // shuffle scoreboard visually
// ----- PSS button click -----
pssBtns.forEach(btn => {
  btn.addEventListener("click", () => handlePSSMove(btn.dataset.move));
});

function handlePSSMove(moveForCurrent) {
  if (pssResolved) return;
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;

  try { pssClick.currentTime = 0; pssClick.play(); } catch {}

  const namesMap = getNamesMap();
  const moves = {};
  moves[pssHuman] = moveForCurrent; // current actor's move

  // Other players random
  players.forEach(p => {
    if (p.name !== pssHuman) moves[p.name] = randomPSSMove();
  });

  questionDiv.innerHTML = Object.entries(moves)
    .map(([name, mv]) => `${namesMap[name] || name} chose ${mv}`)
    .join(" | ");

  // Determine losers
  losers = getLosers(moves);

  if (losers.length > 0) {
    currentLoserIndex = 0;
    currentQuestion = questions[questionIndex];
    questionIndex = (questionIndex + 1) % questions.length;

    const loserNames = losers.map(p => namesMap[p] || p).join(", ");
    answerDiv.textContent = `${loserNames} must answer!`;

    // Show a single "Show Question" button in controls area
    controlsDiv.innerHTML = "";
    const showBtn = document.createElement("button");
    showBtn.textContent = "Show Question";
    showBtn.classList.add("controlsBtn");
    controlsDiv.appendChild(showBtn);
    showBtn.addEventListener("click", () => {
      controlsDiv.innerHTML = "";
      answerShown = false;
      askNextLoserQuestion();
    });

    // Hide PSS panel while in Q&A
    pssPanel.style.display = "none";

    pssResolved = true;

    // Auto-advance if the first loser is AI
    maybeAutoAdvanceQAForAI();
  } else {
    nextPSSHuman();
    startPSSRound();
    maybeAutoPlayPSS();
  }
}

// ----- Ask each losing player a question -----
function askNextLoserQuestion() {
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
  if (currentLoserIndex >= losers.length) {
    endPSSRound();
    maybeAutoPlayPSS();
    return;
  }

  const currentLoser = losers[currentLoserIndex];

  // Clear any pending AI timers as we’re switching context
  clearPssAITimeouts();

  // ✅ Highlight the current loser immediately
  highlightCurrentPlayer(currentLoser);

  currentQuestion = questions[questionIndex];
  questionIndex = (questionIndex + 1) % questions.length;

  // Show question text and current loser
  questionDiv.textContent = currentQuestion.text;
  answerDiv.textContent = `${namesMap[currentLoser] || currentLoser} must answer!`;
  controlsDiv.innerHTML = "";
  answerShown = false;

  // ✅ Create the buttons for the current question
  showNextStep();

  // If this loser is AI, schedule auto show-answer/next
  maybeAutoAdvanceQAForAI();
}

  // --- Define button creation ---
function showNextStep() {
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
  controlsDiv.innerHTML = ""; // clear previous buttons/messages
  answerShown = false;

  const hasOptions = currentQuestion.options && currentQuestion.options.length > 0;
  const isMoreLosers = currentLoserIndex < losers.length - 1; // strictly less than last index

  if (hasOptions) {
    currentQuestion.options.forEach(opt => {
      const optBtn = document.createElement("button");
      optBtn.textContent = opt;
      optBtn.classList.add("controlsBtn");
      controlsDiv.appendChild(optBtn);

      optBtn.addEventListener("click", () => {
        if (!answerShown) {
          answerDiv.textContent = `Answer: ${currentQuestion.answer}`;
          answerShown = true;

          controlsDiv.innerHTML = "";
          const nextBtn = document.createElement("button");
          nextBtn.textContent = isMoreLosers ? "Next Question" : "End PSS";
          nextBtn.classList.add("controlsBtn");
          controlsDiv.appendChild(nextBtn);

          nextBtn.addEventListener("click", showNextOrEnd);
        }
      });
    });
  } else {
    const showAnswerBtn = document.createElement("button");
    showAnswerBtn.textContent = "Show Answer";
    showAnswerBtn.classList.add("controlsBtn");
    controlsDiv.appendChild(showAnswerBtn);

    showAnswerBtn.addEventListener("click", () => {
      if (!answerShown) {
        answerDiv.textContent = `Answer: ${currentQuestion.answer}`;
        answerShown = true;

        controlsDiv.innerHTML = "";
        const nextBtn = document.createElement("button");
        nextBtn.textContent = isMoreLosers ? "Next Question" : "End PSS";
        nextBtn.classList.add("controlsBtn");
        controlsDiv.appendChild(nextBtn);

        nextBtn.addEventListener("click", showNextOrEnd);
      }
    });
  }
}



// --- Handles "Next Question" or end-of-round ---
function showNextOrEnd() {
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
  controlsDiv.innerHTML = "";

  if (currentLoserIndex < losers.length - 1) {
    // Next loser in this PSS round
    currentLoserIndex++;
    askNextLoserQuestion();
  } else {
    // All losers finished → resume dice phase
    losers = [];
    currentLoserIndex = 0;

    // 🔄 Advance PSS human for the NEXT round
    pssIndex = (pssIndex + 1) % pssOrder.length;
    pssHuman = pssOrder[pssIndex];

    // ✅ Update UI: move message to questionDiv & clear answerDiv
    questionDiv.textContent = `🐺 Wolf, roll the dice!`;
    answerDiv.textContent = "";

    // Ensure dice controls are shown when transitioning from PSS to dice
    showDiceControls();

// Build diceQueue as WRAPPERS (wolf first, then rotated rabbits)
if (numTeams === 2) {
  diceQueue = [
    players.find(p => p.name === "wolf"),
    players.find(p => p.name === "rabbit"),
  ];
} else {
  const rabbitNames = getRabbitOrder(); // rotated list
  const rabbitWrappers = rabbitNames.map(name => players.find(p => p.name === name));
  diceQueue = [
    players.find(p => p.name === "wolf"),
    ...rabbitWrappers,
  ];
}

// Reflect new order on the scoreboard (only once per turn at PSS→dice transition)
updateScores();
reorderScoreboard();
highlightCurrentPlayer("wolf"); // Ensure dice phase state is consistent
currentPlayer = diceQueue[0];
stepsRemaining = 0;
isDiceTurn = false;

    // If the first dice player is AI, auto-roll and move
    const first = ensureWrapper(diceQueue[0]);
    if (first) {
      const namesMap = getNamesMap();
      questionDiv.textContent = `${namesMap[first.name] || first.name}, roll the dice!`;
      // Ensure the Roll Dice button is visible in controls (robustly)
      ensureDiceControls();
      // Double-check on next frame in case any late clears ran after this call
      requestAnimationFrame(() => ensureDiceControls());
      maybeAutoRollIfAI(first);
    }

  }
}



function randomPSSMove() {
  const moves = ["rock", "paper", "scissors"];
  return moves[Math.floor(Math.random() * moves.length)];
}

// ----- End PSS round -----
function endPSSRound() {
  pssIndex = (pssIndex + 1) % pssOrder.length;
  pssHuman = pssOrder[pssIndex];

  const namesMap = getNamesMap();
  answerDiv.textContent = `${namesMap[pssHuman] || pssHuman}, play paper-scissors-stone!`;
  updateScoreboard(diceQueue);
  highlightCurrentPlayer(pssHuman);

  // Enable PSS only if next is human
  const currentIsHuman = players.find(p => p.name === pssHuman)?.isHuman;
  pssBtns.forEach(btn => btn.disabled = !currentIsHuman);
}



function getLosers(moves) {
  const beats = { rock: "scissors", scissors: "paper", paper: "rock" };
  const moveSet = new Set(Object.values(moves));

  // If everyone chose the same move → true tie
  if (moveSet.size === 1) return [];

  let losersArr = [];
  for (let [player, move] of Object.entries(moves)) {
    // Check if any other player's move beats this player's move
    const beatenBySomeone = Object.values(moves).some(
      otherMove => beats[otherMove] === move
    );
    if (beatenBySomeone) losersArr.push(player);
  }

  return losersArr;
}



// ----- Helper to highlight current PSS human -----
function highlightCurrentPlayer(playerName) {
  const ids = ["rabbitScore","redRabbitScore","blueRabbitScore","blackRabbitScore","wolfScore"];
  // Safely remove highlight from all known score items (they may be hidden or detached)
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("currentTurn");
  });

  const idMap = {
    rabbit: "rabbitScore",
    redRabbit: "redRabbitScore",
    blueRabbit: "blueRabbitScore",
    blackRabbit: "blackRabbitScore",
    wolf: "wolfScore"
  };
  const targetId = idMap[playerName];
  const targetEl = targetId ? document.getElementById(targetId) : null;
  if (targetEl) targetEl.classList.add("currentTurn");
}


// ----- Scoreboard -----
function updateScores() {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText("rabbitScore", `🐇 Rabbit: ${rabbitWins}`);
  setText("redRabbitScore", `🔴 Rabbit: ${redRabbitWins}`);
  setText("blueRabbitScore", `🔵 Rabbit: ${blueRabbitWins}`);
  setText("blackRabbitScore", `⚫ Rabbit: ${blackRabbitWins}`);
  setText("wolfScore", `🐺 Wolf: ${wolfWins}`);
  
  // Do not reorder here; reordering happens once per turn at dice phase start
}

// Function to reorder the scoreboard based on turn order
function reorderScoreboard() {
  try {
    const scoresList = document.getElementById('scores');
    if (!scoresList) return;
    
    // Get all visible scoreboard items for safety check later
    const allScoreItems = Array.from(document.querySelectorAll('.scoreboard-item'))
      .filter(item => item.style.display !== 'none');
    
    // Always keep wolf at the top
    const wolfScore = document.getElementById('wolfScore');
    if (!wolfScore) return;
    
    // Get the current rabbit order from dice queue or getRabbitOrder
    let rabbitQueue = [];
    
    if (diceQueue && diceQueue.length > 0) {
      // Extract rabbit names from dice queue (excluding wolf at index 0)
      rabbitQueue = diceQueue.slice(1)
        .map(player => {
          if (typeof player === 'object') {
            return player.name || (player.obj && player.obj.name);
          }
          return player;
        })
        .filter(name => rabbitKeys.includes(name));
    } else {
      // Fallback to getRabbitOrder if diceQueue is not available
      rabbitQueue = getRabbitOrder();
    }
    
    if (!rabbitQueue || rabbitQueue.length === 0) return;
    
    // Map rabbit names to their score element IDs
    const rabbitScoreIds = {
      'rabbit': 'rabbitScore',
      'redRabbit': 'redRabbitScore',
      'blueRabbit': 'blueRabbitScore',
      'blackRabbit': 'blackRabbitScore'
    };
    
    // Create a document fragment to hold the reordered elements
    const fragment = document.createDocumentFragment();
    
    // First add wolf (always first)
    fragment.appendChild(wolfScore);
    
    // Then add rabbits in their turn order
    const processedElements = new Set([wolfScore]);
    
    rabbitQueue.forEach(rabbitName => {
      const scoreId = rabbitScoreIds[rabbitName];
      const scoreElement = document.getElementById(scoreId);
      
      if (scoreElement && scoreElement.style.display !== 'none') {
        fragment.appendChild(scoreElement);
        processedElements.add(scoreElement);
      }
    });
    
    // Add any visible elements that weren't processed yet (safety check)
    allScoreItems.forEach(item => {
      if (!processedElements.has(item)) {
        fragment.appendChild(item);
      }
    });
    
    // Clear the scoreboard and add the reordered elements
    while (scoresList.firstChild) {
      scoresList.removeChild(scoresList.firstChild);
    }
    
    scoresList.appendChild(fragment);
    
  } catch (e) {
    console.error("Error in reorderScoreboard:", e);
    
    // Recovery: ensure all score elements are in the DOM
    try {
      const scoresList = document.getElementById('scores');
      if (scoresList) {
        // Add all score elements back in a default order
        const defaultOrder = ['wolfScore', 'rabbitScore', 'redRabbitScore', 'blueRabbitScore', 'blackRabbitScore'];
        defaultOrder.forEach(id => {
          const element = document.getElementById(id);
          if (element && !scoresList.contains(element)) {
            scoresList.appendChild(element);
          }
        });
      }
    } catch (recoveryError) {
      console.error("Failed to recover from reordering error:", recoveryError);
    }
  }
}

function updateScoreDisplay() {
  const rabbitScore = document.getElementById("rabbitScore");
  const wolfScore = document.getElementById("wolfScore");
  const blueRabbitScore = document.getElementById("blueRabbitScore");
  const redRabbitScore = document.getElementById("redRabbitScore");
  const blackRabbitScore = document.getElementById("blackRabbitScore");

  // Hide everything first
  rabbitScore.style.display = "none";
  wolfScore.style.display = "none";
  blueRabbitScore.style.display = "none";
  redRabbitScore.style.display = "none";
  blackRabbitScore.style.display = "none";

  // Wolf is always shown
  wolfScore.style.display = "list-item";
  wolfScore.textContent = `🐺 Wolf: ${wolfWins}`;

  // Show according to numTeams
  if (numTeams === 2) {
    // Keep 2-player exactly as before
    rabbitScore.style.display = "list-item";
    rabbitScore.textContent = `🐇 Rabbit: ${rabbitWins}`;
  } else if (numTeams === 3) {
    // 3-player: red rabbit + blue rabbit + wolf
    redRabbitScore.style.display = "list-item";
    blueRabbitScore.style.display = "list-item";

    // Use per-rabbit counters (start at 0). Use colored icons for consistency with PSS labels
    redRabbitScore.textContent = `🔴 Rabbit: ${redRabbitWins}`;
    blueRabbitScore.textContent = `🔵 Rabbit: ${blueRabbitWins}`;
  } else if (numTeams === 4) {
    // 4-player: red, blue, black, wolf
    redRabbitScore.style.display = "list-item";
    blueRabbitScore.style.display = "list-item";
    blackRabbitScore.style.display = "list-item";

    redRabbitScore.textContent = `🔴 Rabbit: ${redRabbitWins}`;
    blueRabbitScore.textContent = `🔵 Rabbit: ${blueRabbitWins}`;
    blackRabbitScore.textContent = `⚫ Rabbit: ${blackRabbitWins}`;
  }
}

function resetRabbitPositions() {
  const startingPositions = {
    rabbit: { x: 0, y: 0 },       // Default rabbit (2-player mode)
    blueRabbit: { x: 0, y: 0 },
    redRabbit: { x: 0, y: 7 },
    blackRabbit: { x: 7, y: 0 },
    wolf: { x: 7, y: 7 }          // add wolf position
  };

  activeKeys.forEach(key => {
    if (startingPositions[key]) {
      switch (key) {
        case "rabbit":
          rabbit.x = startingPositions[key].x;
          rabbit.y = startingPositions[key].y;
          break;
        case "wolf":
          wolf.x = startingPositions[key].x;
          wolf.y = startingPositions[key].y;
          break;
        case "redRabbit":
          redRabbit.x = startingPositions[key].x;
          redRabbit.y = startingPositions[key].y;
          break;
        case "blueRabbit":
          blueRabbit.x = startingPositions[key].x;
          blueRabbit.y = startingPositions[key].y;
          break;
        case "blackRabbit":
          blackRabbit.x = startingPositions[key].x;
          blackRabbit.y = startingPositions[key].y;
          break;
      }
    } else {
      console.warn(`No starting position for key: ${key}`);
    }
  });
}

function nextPSSHuman() {
  if (pssOrder.length === 0) return; // fallback

  pssIndex = (pssIndex + 1) % pssOrder.length; // cycle through rabbits
  pssHuman = pssOrder[pssIndex];
}

// ----- Reset -----
function reset() {
  // 🛑 Stop victory music if it's playing
  if (!victoryMusic.paused) {
    victoryMusic.pause();
    victoryMusic.currentTime = 0;
  }

  // Clear victory lock to allow UI updates again
  if (questionDiv.dataset) delete questionDiv.dataset.victory;

  // 🎵 Prepare background music to restart on the next user action
  // We pause and reset time, and re-arm the one-time click handler
  try { bgMusic.pause(); } catch {}
  bgMusic.currentTime = 0;
  musicStarted = false;
  armMusicStartOnce();

  // 🥕 Reset carrot state and schedule based on current teams
  carrot = null;
  turnsSinceCarrot = 0;
  scheduleNextCarrot();

  // 🎲 Reset roll-again tiles and schedule
  rollAgainTiles = [];
  rollAgainJustSpawned = false;
  turnsSinceRollAgain = 0;
  nextRollAgainIn = getRandomInt(1, 3);

  // Hide action panels initially
  pssPanel.style.display = "none";
  rollDiceBtn.style.display = "none";

  // 🐇 Reset all player positions
  resetRabbitPositions();

  // 🏆 Reset all scores
  rabbitWins = 0;
  redRabbitWins = 0;
  blueRabbitWins = 0;
  blackRabbitWins = 0;
  wolfWins = 0;
  updateScores(); // This will also call reorderScoreboard()

  // 💧 Regenerate water tiles
  waterTiles.length = 0;
  generateWaterTiles();

 const rabbitNames = getRabbitOrder();
const rabbitObjs = rabbitNames.map(name => players.find(p => p.name === name));
diceQueue = [
  players.find(p => p.name === "wolf"),
  ...rabbitObjs
];

  currentPlayer = null;
  stepsRemaining = 0;
  rollDiceBtn.disabled = false;

  // ✂️ Reset PSS order
  initPSSOrder();

  // 🖼️ Redraw board & clear messages
  drawBoard();
  answerDiv.textContent = '';
  questionDiv.textContent = "Play paper-scissors-stone to start!";

  // 🚀 Start next PSS round
  startPSSRound();
}


// ----- Update message -----
function updateMessage(msg){
  // If victory is declared, suppress further UI writes
  if (questionDiv.dataset && questionDiv.dataset.victory === 'true') return;
  questionDiv.textContent = msg;
}

// Temporary toast for roll-again cue
function showRollAgainToast() {
  try {
    answerDiv.textContent = '🎲 Roll again!';
    setTimeout(() => {
      if (answerDiv.textContent === '🎲 Roll again!') answerDiv.textContent = '';
    }, 1000);
  } catch {}
}

// ----- Restart Button -----
const restartBtn = document.getElementById("restartBtn");
restartBtn.addEventListener("click", reset);

// Initial setup
// ----- Initial Setup -----
window.addEventListener("load", () => {
  // Generate water tiles and draw initial board
  generateWaterTiles();
    // Setup players with default 2-player mode before first draw
  setupPlayers(numTeams); 
initPSSOrder();
  drawBoard();

  // Show the multiplayer modal
  teamModal.classList.add("show");

  // Handle team selection
  teamBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      numTeams = parseInt(btn.dataset.teams);
      teamModal.classList.remove("show");
      updateMessage(`${numTeams}-player mode selected`);

      updateScoreDisplay();

      // Adjust carrot schedule based on new team configuration
      scheduleNextCarrot();

      // Show human team count modal next
      showHumanTeamsModal();
    });
  });

  // Handle victory points selection
  vpBtns.forEach(vpBtn => {
    vpBtn.addEventListener("click", () => {
      victoryPoints = parseInt(vpBtn.dataset.points);
      victoryModal.classList.remove("show");
      updateMessage(`First to ${victoryPoints} points wins!`);

      // Initialize players and control types
      setupPlayers(numTeams);
      applyHumanAIAssignments();

      // Prepare PSS human rotation based on human teams
      initPSSOrder();

      // Start first PSS round and let AI auto-play if needed
      startPSSRound();
      answerDiv.textContent = `${getNamesMap()[pssHuman] || pssHuman}, play paper-scissors-stone!`;
      maybeAutoPlayPSS();
    });
  });
});

// ----- Roll Dice -----
// --- Robust roll dice button handler (accepts wrapper or raw obj in diceQueue)
// Modify the rollDiceBtn event listener to check for trapped rabbits
rollDiceBtn.addEventListener("click", () => {
  if (!diceQueue || diceQueue.length === 0) return;

  // pop next item and normalize to wrapper form
  let next = diceQueue.shift();
  next = ensureWrapper(next) || next; // if we couldn't find wrapper, keep next as-is to avoid throwing

// Skip invalid entries until a valid wrapper is found
while (next && (!next.name || !next.obj)) {
  const recovered = players.find(p => p.obj === next);
  next = recovered || ensureWrapper(diceQueue.shift());
}

// If none valid, try to rebuild queue once; otherwise give up safely
if (!next || !next.name || !next.obj) {
  const wolfW = players.find(p => p.name === "wolf");
  const rabbits = (numTeams === 2)
    ? [players.find(p => p.name === "rabbit")]
    : getRabbitOrder().map(name => players.find(p => p.name === name));
  diceQueue = [wolfW, ...rabbits].filter(Boolean);
  next = ensureWrapper(diceQueue.shift());
  if (!next || !next.name || !next.obj) {
    rollDiceBtn.disabled = true;
    return;
  }
}

  // Check if the player is trapped before rolling
  if (rabbitKeys.includes(next.name) && isPlayerTrapped(next.obj)) {
    // Player is trapped, show message and skip turn
    const namesMap = (numTeams === 2) ? playerNames2p 
                   : (numTeams === 3) ? playerNames3p 
                   : playerNames4p;
    
    updateMessage(`${namesMap[next.name] || next.name} is trapped! Turn skipped.`);
    
    // Move to next player
    if (diceQueue.length > 0) {
      // There are more players in the queue
      const nextPlayer = ensureWrapper(diceQueue[0]);
      currentPlayer = nextPlayer;
      const namesMap = getNamesMap();
      questionDiv.textContent = `${namesMap[nextPlayer.name] || nextPlayer.name}, roll the dice!`;
      // Ensure the Roll Dice button stays visible
      ensureDiceControls();
      requestAnimationFrame(() => ensureDiceControls());
      maybeAutoRollIfAI(nextPlayer);
    } else {
      // End of dice phase
      endTurnUpdate();
      currentPlayer = null;
      rollDiceBtn.disabled = true;
      startPSSRound();
      maybeAutoPlayPSS();
    }
    return;
  }

  // Start dice move with a proper wrapper
  startDiceMove(next);
  rollDiceBtn.disabled = true;
});

// ----- Rules Panel -----
const rulesBtn = document.getElementById("rulesBtn");
const rulesPanel = document.getElementById("rulesPanel");
const closeRulesBtn = document.getElementById("closeRulesBtn");

rulesBtn.addEventListener("click", () => {
  rulesPanel.classList.add("show");   // slide in
});

closeRulesBtn.addEventListener("click", () => {
  rulesPanel.classList.remove("show"); // slide out
});

// ----- AI Autoplay Hooks -----
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function chooseBestRabbitSquare(options) {
  // Prefer carrot if reachable
  if (carrot) {
    const hit = options.find(o => o.x === carrot.x && o.y === carrot.y);
    if (hit) return hit;
  }
  // Prefer entering safety immediately
  for (const o of options) {
    if (inSafetyZone(o.x, o.y)) return o;
  }
  // Prefer roll-again tiles next
  for (const o of options) {
    if (rollAgainTiles.some(t => t.x === o.x && t.y === o.y)) return o;
  }
  // Otherwise maximize distance from wolf and move toward door
  let best = null, bestScore = -Infinity;
  for (const o of options) {
    const distWolf = manhattan(o, wolf);
    const distDoor = Math.min(manhattan(o, doorBottom), manhattan(o, doorRight));
    const score = distWolf + (20 - distDoor) + Math.random() * 0.01; // tiny jitter to avoid ties
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best || options[0];
}

function chooseBestWolfSquare(options) {
  // Try to capture immediately
  const rabbitsPos = players.filter(p => p.name !== 'wolf').map(p => p.obj);
  for (const o of options) {
    if (rabbitsPos.some(r => r && r.x === o.x && r.y === o.y)) return o;
  }
  // Otherwise minimize distance to the nearest rabbit
  let best = null, bestScore = Infinity;
  for (const o of options) {
    const minDist = rabbitsPos.reduce((m, r) => Math.min(m, manhattan(o, r)), Infinity);
    if (minDist < bestScore) { bestScore = minDist; best = o; }
  }
  return best || options[0];
}

function maybeAutoPlayPSS() {
  try {
    // Only handle the PSS chooser auto-pick here. Q&A auto-advance is handled separately.
    clearPssAITimeouts();

    if (!pssResolved) {
      const currentIsHuman = players.find(p => p.name === pssHuman)?.isHuman;
      if (currentIsHuman) return;
      pssAITimeouts.push(setTimeout(() => handlePSSMove(randomPSSMove()), 600));
    }
  } catch (e) {
    console.warn('maybeAutoPlayPSS error:', e);
  }
}

// Dedicated AI auto-advance for loser Q&A flow
function maybeAutoAdvanceQAForAI() {
  try {
    clearPssAITimeouts();

    if (!Array.isArray(losers) || typeof currentLoserIndex !== 'number' || currentLoserIndex >= losers.length) return;

    const currentLoser = losers[currentLoserIndex];
    const isHumanLoser = (players.find(p => p.name === currentLoser)?.isHuman) || humanTeams.has(currentLoser);
    if (isHumanLoser) return;

    const showAnswerAndNext = () => {
      pssAITimeouts.push(setTimeout(() => {
        try {
          if (typeof answerShown === 'undefined' || !answerShown) {
            answerDiv.textContent = `Answer: ${currentQuestion.answer}`;
            answerShown = true;
          }
          pssAITimeouts.push(setTimeout(() => { showNextOrEnd(); }, 900));
        } catch (e) { console.warn('AI question auto-advance failed:', e); }
      }, 900));
    };

    const questionNotShown = !currentQuestion || questionDiv.textContent !== currentQuestion.text;
    if (questionNotShown) {
      pssAITimeouts.push(setTimeout(() => {
        try { askNextLoserQuestion(); } catch (e) { console.warn('askNextLoserQuestion failed:', e); }
        showAnswerAndNext();
      }, 600));
    } else {
      showAnswerAndNext();
    }
  } catch (e) {
    console.warn('maybeAutoAdvanceQAForAI error:', e);
  }
}

function maybeAutoRollIfAI(nextPlayer) {
  try {
    const wrapper = ensureWrapper(nextPlayer);
    if (!wrapper || wrapper.isHuman) return; // Only act for AI

    // Prevent manual rolls during AI action
    rollDiceBtn.disabled = true;

    // Small delay for UX, then roll
    setTimeout(() => {
      // Consume the queue head if it matches this AI, like a manual click would
      if (diceQueue.length) {
        const head = ensureWrapper(diceQueue[0]);
        if (head && head.name === wrapper.name) {
          diceQueue.shift();
        }
      }
      startDiceMove(wrapper); // rolls and sets stepsRemaining/isDiceTurn

      // After roll animation/sound, choose and perform a move
      setTimeout(() => {
        if (!wrapper || !wrapper.obj) { endMovementPhase(); return; }

        const playerObj = wrapper.obj;
        const reachable = getReachableSquares(playerObj, stepsRemaining);

        // If no moves (e.g., trapped by this roll), end phase
        if (!reachable || reachable.length === 0) {
          endMovementPhase();
          return;
        }

        const target = (wrapper.name === 'wolf')
          ? chooseBestWolfSquare(reachable)
          : chooseBestRabbitSquare(reachable);

        // Apply move
        playerObj.x = target.x;
        playerObj.y = target.y;
        stepsRemaining = 0;
        isDiceTurn = false;

        // Roll-again tile trigger for AI
        const idx = rollAgainTiles.findIndex(t => t.x === playerObj.x && t.y === playerObj.y);
        if (idx >= 0) {
          rollAgainTiles.splice(idx, 1);
          try { rollAgainTriggerSound.play(); } catch {}
          showRollAgainToast();
          drawBoard();
          // Auto extra roll for same AI
          setTimeout(() => {
            startDiceMove(wrapper);
            maybeAutoRollFollowupMove(wrapper);
          }, 350);
          return;
        }

        // Carrot collection handling (mirror manual click flow)
        const playerName = wrapper.name;
        if (carrot && rabbitKeys.includes(playerName) && playerObj.x === carrot.x && playerObj.y === carrot.y) {
          carrot = null;
          try { carrotCollectSound.play(); } catch {}
          switch (playerName) {
            case 'rabbit': rabbitWins++; break;
            case 'redRabbit': redRabbitWins++; break;
            case 'blueRabbit': blueRabbitWins++; break;
            case 'blackRabbit': blackRabbitWins++; break;
          }
          updateScores();
          const namesMap = getNamesMap();
          updateMessage(`🐇 ${namesMap[playerName] || playerName} collected a carrot!`);
          checkMatchWin();
          endMovementPhase();
          return;
        }

        // Draw and evaluate win/catch
        drawBoard();
        if (checkWin()) {
          rollDiceBtn.disabled = true;
          currentPlayer = null;
          stepsRemaining = 0;
          return;
        }

        endMovementPhase();
      }, 650);
    }, 600);
  } catch (e) {
    console.warn('maybeAutoRollIfAI error:', e);
  }
}
