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
const pssBtns = document.querySelectorAll(".pssBtn");
const offset = cellSize; // reserve space for coordinates
const victoryModal = document.getElementById("victoryModal");
const vpBtns = document.querySelectorAll(".vpBtn");

// <-- Paste here -->
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
const victoryMusic = new Audio('wearethechampionschiptune.mp3');
victoryMusic.volume = 1;

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
document.body.addEventListener('click', startMusicOnce, { once: true });

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

// ----- Game State -----
let rabbit = { x: 0, y: 0 };
let wolf = { x: 7, y: 7 };

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
let diceQueue = [];

let pssHuman = 'rabbit';
let pssResolved = false;

let rabbitWins = 0;
let wolfWins = 0; // default, can be 5, 10, or 15
let carrot = null;        // {x, y, turnsRemaining}
let turnsSinceCarrot = 0; // counts PSS rounds
let carrotPoints = 0;     // rabbit points for collecting carrots

let victoryPoints = 5; // default


vpBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    victoryPoints = parseInt(btn.dataset.points);
    victoryModal.style.display = "none";
    updateMessage(`First to ${victoryPoints} points wins!`);
    drawBoard(); // start game visually
    startPSSRound(); // kick off the first round
  });
});

// ----- Safety zone helpers -----
const inSafetyZone = (x,y) => (y===8 && x>=6) || (x===8 && y>=6);

// Get the corner farthest from the wolf
function resetRabbitPosition() {
  // Filter corners to exclude wolf and water tiles
  const validCorners = rabbitCorners.filter(corner =>
    !(wolf.x === corner.x && wolf.y === corner.y) &&
    !waterTiles.some(t => t.x === corner.x && t.y === corner.y)
  );

  // Find the corner farthest from the wolf
  let maxDist = -1;
  let farthestCorner = validCorners[0];

  validCorners.forEach(corner => {
    const dx = corner.x - wolf.x;
    const dy = corner.y - wolf.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > maxDist) {
      maxDist = dist;
      farthestCorner = corner;
    }
  });

  // Move rabbit there
  rabbit.x = farthestCorner.x;
  rabbit.y = farthestCorner.y;

  drawBoard();
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
  let emptySquares = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const occupied =
        (wolf && wolf.x === x && wolf.y === y) || 
        (rabbit && rabbit.x === x && rabbit.y === y) ||
        waterTiles.some(t => t.x === x && t.y === y) ||
        (x === doorBottom.x && y === doorBottom.y) ||
        (x === doorRight.x && y === doorRight.y);
      if (!occupied) emptySquares.push({ x, y });
    }
  }

  if (emptySquares.length === 0) return null;

  const idx = Math.floor(Math.random() * emptySquares.length);
  carrot = { ...emptySquares[idx], turnsRemaining: 4 };

  // ✅ Play the sound immediately when a new carrot is spawned
  carrotSound.play();
}

function endTurnUpdate() {
  turnsSinceCarrot++;

  if (turnsSinceCarrot % 7 === 0) {
    generateCarrot(); // sound now plays inside generateCarrot()
  }

  if (carrot) {
    carrot.turnsRemaining--;
    if (carrot.turnsRemaining <= 0) carrot = null;
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

      if (player === rabbit) {
        const outsideSafety = !inSafetyZone(x, y);
        const enteringSafety = inSafetyZone(nx, ny);
        if (outsideSafety && enteringSafety) {
          const isDoor = (x === doorBottom.x && y === doorBottom.y) || (x === doorRight.x && y === doorRight.y);
          if (!isDoor) continue;
        }
        if (wolf.x === nx && wolf.y === ny) continue;
        if (waterTiles.some(t => t.x === nx && t.y === ny)) continue;
      } else {
        if (waterTiles.some(t => t.x === nx && t.y === ny)) continue;
        if (inSafetyZone(nx, ny)) continue; // 🚫 prevent wolf entering safety zone
        if (carrot && carrot.x === nx && carrot.y === ny) continue; // prevent wolf stepping on carrot
      }

      queue.push({ x: nx, y: ny, remaining: remaining - 1 });
    }
  }
  return reachable;
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

  // ----- Highlight reachable squares -----
  if (currentPlayer && stepsRemaining > 0) {
    const squares = getReachableSquares(currentPlayer, stepsRemaining);
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
  if (rabbitImg.complete)
    ctx.drawImage(
      rabbitImg,
      offset + rabbit.x * cellSize,
      offset + rabbit.y * cellSize,
      cellSize,
      cellSize
    );

  if (wolfImg.complete)
    ctx.drawImage(
      wolfImg,
      offset + wolf.x * cellSize,
      offset + wolf.y * cellSize,
      cellSize,
      cellSize
    );

  if (carrot && carrotImg.complete)
    ctx.drawImage(
      carrotImg,
      offset + carrot.x * cellSize,
      offset + carrot.y * cellSize,
      cellSize,
      cellSize
    );

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
function checkWin() {
  // Wolf catches rabbit
  if (wolf.x === rabbit.x && wolf.y === rabbit.y) {
    loseSound.play();
    wolfWins++;
    updateScores();
    drawBoard();
    answerDiv.textContent = "🐺 Wolf caught the rabbit!";

    checkMatchWin(); // update questionDiv if match is won

    // Only respawn rabbit if wolf hasn't won the match
    if (wolfWins < victoryPoints) {
      resetRabbitPosition();   // rabbit respawns in corner
      startPSSRound();         // continue next PSS round
    } else {
      // Wolf wins the match: rabbit stays under wolf, game is over
      endMatch();
    }

    return true;
  }

  // Rabbit reaches safety
  if (inSafetyZone(rabbit.x, rabbit.y)) {
    winSound.play();
    rabbitWins++;
    updateScores();
    drawBoard();
    answerDiv.textContent = "🐇 Rabbit reached safety!";

    checkMatchWin(); // update questionDiv if match is won

    // Rabbit wins match: stays in safety, game ends
    if (rabbitWins >= victoryPoints) {
      endMatch();
    } else {
      // Rabbit hasn't won match yet: normal reset
      setTimeout(reset, 2000);
    }

    return true;
  }

  return false;
}

function checkMatchWin() {
  if (rabbitWins >= victoryPoints) {
    updateMessage(`🐇 Rabbit wins the match with ${rabbitWins} points! 🎉`);
    answerDiv.textContent = ''; // clear previous messages
    triggerConfetti();

    // Stop background music
    bgMusic.pause();
    bgMusic.currentTime = 0;

    // Play victory music safely
    victoryMusic.pause();
    victoryMusic.currentTime = 0;
    victoryMusic.volume = 0.3;
    victoryMusic.play().catch(err => {
      console.log("Victory music playback was blocked:", err);
    });

    endMatch();
  } else if (wolfWins >= victoryPoints) {
    updateMessage(`🐺 Wolf wins the match with ${wolfWins} points! 🎉`);
    answerDiv.textContent = ''; // clear previous messages
    triggerConfetti();

    // Stop background music
    bgMusic.pause();
    bgMusic.currentTime = 0;

    // Play victory music safely
    victoryMusic.pause();
    victoryMusic.currentTime = 0;
    victoryMusic.volume = 0.3;
    victoryMusic.play().catch(err => {
      console.log("Victory music playback was blocked:", err);
    });

    endMatch();
  }
}

// ----- End match -----
function endMatch() {
  currentPlayer = null;
  stepsRemaining = 0;
  diceQueue = [];
  rollDiceBtn.disabled = true;
  // Optionally: disable PSS buttons
  pssBtns.forEach(btn => btn.disabled = true);
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

// ----- Roll Dice -----
rollDiceBtn.addEventListener("click", () => {
  if(!currentPlayer && diceQueue.length>0){
    startDiceMove(diceQueue.shift());
    rollDiceBtn.disabled = true;
  }
});

function startDiceMove(player) {
  currentPlayer = player;
  highlightCurrentPlayer(player); // highlight current player

  const roll = Math.floor(Math.random() * 6) + 1;
  const bonus = player === rabbit ? 1 : 0;
  stepsRemaining = roll + bonus;

  diceRollSound.play().catch(() => {});

  const playerName = player === rabbit ? '🐇 Rabbit' : '🐺 Wolf';

  // Clear previous messages/buttons
  answerDiv.textContent = '';
  controlsDiv.innerHTML = '';

  // Update questionDiv with dice result
  questionDiv.textContent = `${playerName} rolled ${roll}${bonus ? ` + 1 = ${stepsRemaining}` : ''}.`;

  drawBoard();
}

// ----- Click to move -----
canvas.addEventListener("click", (e) => {
  if (!currentPlayer || stepsRemaining <= 0) return;

  const rect = canvas.getBoundingClientRect();
  const offset = cellSize; // same offset used when drawing the grid

  const cellX = Math.floor((e.clientX - rect.left - offset) / cellSize);
  const cellY = Math.floor((e.clientY - rect.top - offset) / cellSize);

  // Check if click is inside the grid or in the safety zone
  const inGridArea = cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize;
  const inSafe = inSafetyZone(cellX, cellY);

  if (!inGridArea && !inSafe) return; // click outside playable area

  const targetX = inGridArea ? cellX : (cellX < 0 ? 0 : cellX); // clamp if needed
  const targetY = inGridArea ? cellY : (cellY < 0 ? 0 : cellY);

  const reachable = getReachableSquares(currentPlayer, stepsRemaining);

  if (reachable.some(sq => sq.x === targetX && sq.y === targetY)) {
    currentPlayer.x = targetX;
    currentPlayer.y = targetY;
    stepsRemaining = 0;

    // Carrot collection, drawing, win checks etc.
    if (currentPlayer === rabbit && carrot && rabbit.x === carrot.x && rabbit.y === carrot.y) {
      carrot = null;
      rabbitWins++;
      updateScores();
      carrotCollectSound.play();
      updateMessage(`🐇 Rabbit collected a carrot!`);
       checkMatchWin(); // now updates questionDiv instead of alert
    }

    drawBoard();

    if (checkWin()) {
      currentPlayer = null;
      diceQueue = [];
      rollDiceBtn.disabled = true;
      return;
    }

    // End turn logic
    if (diceQueue.length > 0) {
      currentPlayer = null;
      rollDiceBtn.disabled = false;
      highlightCurrentPlayer(diceQueue[0]);
      const nextPlayerName = diceQueue[0] === rabbit ? "🐇 Rabbit" : "🐺 Wolf";
      updateMessage(`${nextPlayerName}, roll the dice!`);
    } else {
      pssHuman = pssHuman === 'rabbit' ? 'wolf' : 'rabbit';
      currentPlayer = null;
      startPSSRound();
      endTurnUpdate();
    }
  }
});


// ----- PSS -----
function startPSSRound() {
  // Enable the PSS buttons for the active player
  pssBtns.forEach(btn => btn.disabled = false);

  rollDiceBtn.disabled = true;
  pssResolved = false;
  const humanName = pssHuman === 'rabbit' ? '🐇 Rabbit' : '🐺 Wolf';
  answerDiv.textContent = `${humanName}, play paper-scissors-stone!`;

  // Highlight the PSS player
  highlightCurrentPlayer(pssHuman);
}

pssBtns.forEach(btn => {
  btn.addEventListener("click", e => {
    if (pssResolved) return;
    pssClick.play();

    const humanMove = e.target.dataset.move;
    const computerMove = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
    const humanName = pssHuman === 'rabbit' ? '🐇 Rabbit' : '🐺 Wolf';
    const computerName = pssHuman === 'rabbit' ? '🐺 Wolf' : '🐇 Rabbit';

    const loser = determinePSSLoser(humanMove, computerMove);

    if (loser) {
      // A winner/loser exists
      const loserName = loser === 'rabbit' ? '🐇 Rabbit' : '🐺 Wolf';
      highlightCurrentPlayer(loser);

      questionDiv.textContent = `${humanName} chose ${humanMove}, ${computerName} chose ${computerMove}.`;
      answerDiv.textContent = `${loserName} must answer!`;

      controlsDiv.innerHTML = '';
      const showBtn = document.createElement('button');
      showBtn.textContent = 'Show Question';
      showBtn.classList.add('controlsBtn'); 
      controlsDiv.appendChild(showBtn);

      // Disable PSS buttons until next PSS round
      pssBtns.forEach(b => b.disabled = true);

      showBtn.addEventListener('click', () => {
        currentQuestion = questions[questionIndex];
        questionIndex = (questionIndex + 1) % questions.length;
        answerRevealed = false;

        questionDiv.textContent = currentQuestion.text;
        controlsDiv.innerHTML = '';

        // Multiple-choice
        if (currentQuestion.options && currentQuestion.options.length > 0) {
          const optionsContainer = document.createElement('div');
          optionsContainer.classList.add('controlsContainer');
          controlsDiv.appendChild(optionsContainer);

          currentQuestion.options.forEach(opt => {
            const optBtn = document.createElement('button');
            optBtn.textContent = opt;
            optBtn.classList.add('controlsBtn');
            optionsContainer.appendChild(optBtn);

            optBtn.addEventListener('click', () => {
              answerDiv.textContent = `Answer: ${currentQuestion.answer}`;
              controlsDiv.innerHTML = '';
              const nextMsg = document.createElement('div');
              nextMsg.textContent = '🐺 Wolf, roll the dice!';
              nextMsg.style.fontFamily = "'Bangers', cursive";
              nextMsg.style.fontSize = '24px';
              nextMsg.style.textAlign = 'center';
              controlsDiv.appendChild(nextMsg);

              diceQueue = [wolf, rabbit];
              currentPlayer = null;
              stepsRemaining = 0;
              rollDiceBtn.disabled = false;
            });
          });
        } else {
          // Single-answer fallback
          const answerBtn = document.createElement('button');
          answerBtn.textContent = 'Show Answer';
          answerBtn.classList.add('controlsBtn');
          controlsDiv.appendChild(answerBtn);

          answerBtn.addEventListener('click', () => {
            answerDiv.textContent = `Answer: ${currentQuestion.answer}`;
            controlsDiv.innerHTML = '';
            const nextMsg = document.createElement('div');
            nextMsg.textContent = '🐺 Wolf, roll the dice!';
            nextMsg.style.fontFamily = "'Bangers', cursive";
            nextMsg.style.fontSize = '24px';
            nextMsg.style.textAlign = 'center';
            controlsDiv.appendChild(nextMsg);

            diceQueue = [wolf, rabbit];
            currentPlayer = null;
            stepsRemaining = 0;
            rollDiceBtn.disabled = false;
          });
        }
      });

      pssResolved = true;
    } else {
      // It's a tie, show moves and re-enable PSS buttons
      questionDiv.textContent = `${humanName} chose ${humanMove}, ${computerName} chose ${computerMove}. It's a tie! Play PSS again.`;
      pssBtns.forEach(b => b.disabled = false);  // re-enable for tie
    }
  });
});


// ----- Highlight current player -----
function highlightCurrentPlayer(player) {
  const rabbitScore = document.getElementById("rabbitScore");
  const wolfScore = document.getElementById("wolfScore");

  let activePlayer = null;
  if (player === rabbit || player === 'rabbit') activePlayer = 'rabbit';
  else if (player === wolf || player === 'wolf') activePlayer = 'wolf';

  if (activePlayer === 'rabbit') {
    rabbitScore.classList.add("currentTurn");
    wolfScore.classList.remove("currentTurn");
  } else if (activePlayer === 'wolf') {
    wolfScore.classList.add("currentTurn");
    rabbitScore.classList.remove("currentTurn");
  } else {
    rabbitScore.classList.remove("currentTurn");
    wolfScore.classList.remove("currentTurn");
  }
}

function determinePSSLoser(humanMove, computerMove){
  if(humanMove === computerMove) return null;
  const beats = { rock:'scissors', scissors:'paper', paper:'rock' };
  if(beats[humanMove] === computerMove) return pssHuman === 'rabbit' ? 'wolf' : 'rabbit';
  return pssHuman; 
}

// ----- Click to reveal answer -----
answerDiv.addEventListener("click", () => {
  if(currentQuestion && !answerRevealed){
    const nextPlayer = diceQueue.length > 0 ? diceQueue[0] : null;
    answerDiv.innerHTML = `Answer: ${currentQuestion.answer}${nextPlayer ? "<br>" + (nextPlayer===rabbit ? "🐇 Rabbit" : "🐺 Wolf") + ", roll the dice!" : ""}`;
    answerRevealed = true;
    rollDiceBtn.disabled = false;

    // After revealing the answer, highlight the next dice roller
    if(nextPlayer) highlightCurrentPlayer(nextPlayer);
  }
});

// ----- Scoreboard -----
function updateScores() {
  document.getElementById("rabbitScore").textContent = `🐇 Rabbit: ${rabbitWins}`;
  document.getElementById("wolfScore").textContent = `🐺 Wolf: ${wolfWins}`;
}

// ----- Reset -----
function reset() {
  // Spawn rabbit in a random corner that's free
  resetRabbitPosition();

  // Reset turn state
  stepsRemaining = 0;
  currentPlayer = null;
  diceQueue = [];

  // Reset carrot counter
  turnsSinceCarrot = 0;
  carrot = null;

  // Stop victory music if it’s playing
  victoryMusic.pause();
  victoryMusic.currentTime = 0;

  // Restart background music if it’s not already playing
  if (!musicStarted) {
    bgMusic.loop = true;
    bgMusic.volume = 0.3;
    bgMusic.play().catch(() => console.log("Autoplay blocked"));
    musicStarted = true;
  }

  // Redraw board and clear controls/messages
  drawBoard();
  answerDiv.textContent = '';
  questionDiv.textContent = "Play paper-scissors-stone to start!";

  // Start the next PSS round
  startPSSRound();
}


// ----- Update message -----
function updateMessage(msg){
  questionDiv.textContent = msg;
}

// ----- Restart Button -----
const restartBtn = document.getElementById("restartBtn");

restartBtn.addEventListener("click", () => {
  // Stop victory music if it's playing
  if (!victoryMusic.paused) {
    victoryMusic.pause();
    victoryMusic.currentTime = 0;
  }

  // Reset scores
  rabbitWins = 0;
  wolfWins = 0;
  updateScores();

  // Generate fresh water tiles on restart
  generateWaterTiles();

  // Reset player positions
  rabbit = { x: 0, y: 0 };
  wolf = { x: 7, y: 7 };

  // Reset carrot counter
  turnsSinceCarrot = 0;
  carrot = null;

  // Reset game state
  reset();

  // Optionally, restart background music if it was paused
  if (bgMusic.paused) bgMusic.play().catch(() => {});
});

// Initial setup
window.addEventListener("load", () => {
  generateWaterTiles();
  drawBoard();
  startPSSRound();

  // Show victory points modal
  const modal = document.getElementById("victoryModal");
  modal.classList.add("show");

  // Add button click handlers
  const vpButtons = modal.querySelectorAll(".vpBtn");
  vpButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      victoryPointsThreshold = parseInt(btn.dataset.points); // set threshold
      modal.classList.remove("show"); // hide modal
      updateMessage(`Victory points set to ${victoryPointsThreshold}`);
    });
  });
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
