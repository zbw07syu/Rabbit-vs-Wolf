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

// ----- Helpers -----
const inGrid = (x, y) => x >= 0 && x < gridSize && y >= 0 && y < gridSize;

// ----- Audio -----
const bgMusic = new Audio('peter-and-the-wolf-chiptune.mp3');
const pssClick = new Audio('PSS.mp3');
const diceRollSound = new Audio('dice.wav');
const winSound = new Audio('cheer.wav');
const loseSound = new Audio('meh.mp3');

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

// ----- Game State -----
let rabbit = { x: 0, y: 0 };
let wolf = { x: 7, y: 7 };

const doorBottom = { x: 6, y: 7 }; 
const doorRight = { x: 7, y: 6 };
const waterTiles = [];

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
    text: "Which country is not in Europe?", 
    answer: "Brazil", 
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
let wolfWins = 0;

// ----- Safety zone helpers -----
const inSafetyZone = (x,y) => (y===8 && x>=6) || (x===8 && y>=6);

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
      const occupied=(x===0 && y===0)||(x===7 && y===7)||(x===doorBottom.x && y===doorBottom.y)||(x===doorRight.x && y===doorRight.y)||waterTiles.some(t=>t.x===x && t.y===y);
      if(!occupied) waterTiles.push({x,y});
    }
    safe = pathExists({x:0,y:0},doorBottom)||pathExists({x:0,y:0},doorRight);
  }
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
      }

      queue.push({ x: nx, y: ny, remaining: remaining - 1 });
    }
  }
  return reachable;
}

// ----- Drawing -----
function drawBoard(){
  ctx.clearRect(0,0,canvas.width,canvas.height);



  ctx.fillStyle="#ffd54a";
  for(let x=6;x<=8;x++) ctx.fillRect(x*cellSize,8*cellSize,cellSize,cellSize);
  for(let y=6;y<=8;y++) ctx.fillRect(8*cellSize,y*cellSize,cellSize,cellSize);

  ctx.lineWidth = 1;
  ctx.strokeStyle="#333";
  for(let y=0;y<gridSize;y++)
    for(let x=0;x<gridSize;x++)
      ctx.strokeRect(x*cellSize,y*cellSize,cellSize,cellSize);

  ctx.fillStyle="#3a7afe";
  waterTiles.forEach(tile=>{
    ctx.fillRect(tile.x*cellSize,tile.y*cellSize,cellSize,cellSize);
  });

  if(currentPlayer && stepsRemaining > 0){
    const squares = getReachableSquares(currentPlayer, stepsRemaining);
    ctx.fillStyle = "rgba(0,255,0,0.3)";
    squares.forEach(sq => ctx.fillRect(sq.x*cellSize, sq.y*cellSize, cellSize, cellSize));
  }

// draw rabbit
if(rabbitImg.complete) ctx.drawImage(rabbitImg, rabbit.x * cellSize, rabbit.y * cellSize, cellSize, cellSize);
// draw wolf
if(wolfImg.complete) ctx.drawImage(wolfImg, wolf.x * cellSize, wolf.y * cellSize, cellSize, cellSize);


    const borderThickness = 4;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cellSize*gridSize, borderThickness);
  ctx.fillRect(0, 0, borderThickness, cellSize*gridSize);
  ctx.fillRect(0, cellSize*gridSize - borderThickness, cellSize*gridSize, borderThickness);
  ctx.clearRect(doorBottom.x*cellSize, cellSize*gridSize - borderThickness, cellSize, borderThickness);
  ctx.fillRect(cellSize*gridSize - borderThickness, 0, borderThickness, cellSize*gridSize);
  ctx.clearRect(cellSize*gridSize - borderThickness, doorRight.y*cellSize, borderThickness, cellSize);
}

// ----- Check Win -----
function checkWin() {
  if (wolf.x === rabbit.x && wolf.y === rabbit.y) {
    loseSound.play();
    wolfWins++;
    updateScores();
    drawBoard();
    answerDiv.textContent = "🐺 Wolf caught the rabbit!";
    // auto-reset after 2 seconds
    setTimeout(reset, 2000);
    return true;
  }

  if (inSafetyZone(rabbit.x, rabbit.y)) {
    winSound.play();
    rabbitWins++;
    updateScores();
    drawBoard();
    answerDiv.textContent = "🐇 Rabbit reached safety!";
    // auto-reset after 2 seconds
    setTimeout(reset, 2000);
    return true;
  }

  return false;
}

// ----- Reset -----
function reset(){
  rabbit = { x:0, y:0 };
  wolf = { x:7, y:7 };
  stepsRemaining = 0;
  currentPlayer = null;
  diceQueue = [];
  generateWaterTiles();
  drawBoard();
  startPSSRound();
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
  const cellX = Math.floor((e.clientX - rect.left) / cellSize);
  const cellY = Math.floor((e.clientY - rect.top) / cellSize);
  const reachable = getReachableSquares(currentPlayer, stepsRemaining);

  if (reachable.some(sq => sq.x === cellX && sq.y === cellY)) {
    currentPlayer.x = cellX;
    currentPlayer.y = cellY;
    stepsRemaining = 0;
    drawBoard();

    if (checkWin()) {
      currentPlayer = null;
      diceQueue = [];
      rollDiceBtn.disabled = true;
      return;
    }

    if (diceQueue.length > 0) {
      currentPlayer = null;
      rollDiceBtn.disabled = false;

      // Highlight the next player in queue
      highlightCurrentPlayer(diceQueue[0]);

      const nextPlayerName = diceQueue[0] === rabbit ? "🐇 Rabbit" : "🐺 Wolf";
      updateMessage(`${nextPlayerName}, roll the dice!`);
    } else {
      pssHuman = pssHuman === 'rabbit' ? 'wolf' : 'rabbit';
      currentPlayer = null;
      startPSSRound();
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
function reset(){
  // Reset positions
  rabbit = { x:0, y:0 };
  wolf = { x:7, y:7 };
  
  // Reset steps and current player
  stepsRemaining = 0;
  currentPlayer = null;
  diceQueue = [];

  // Generate water tiles
  generateWaterTiles();
  
  // Redraw board
  drawBoard();

  // Clear answer and controls divs
  answerDiv.textContent = '';
  controlsDiv.innerHTML = '';

  // Reset question div to initial message
  questionDiv.textContent = "Play paper-scissors-stone to start!";

  // Start PSS round if you want to automatically start it
  startPSSRound();
}

// ----- Update message -----
function updateMessage(msg){
  questionDiv.textContent = msg;
}

// ----- Restart Button -----
const restartBtn = document.getElementById("restartBtn");

restartBtn.addEventListener("click", () => {
  rabbitWins = 0;
  wolfWins = 0;
  updateScores();
  reset();
});

// Initial setup
window.addEventListener("load", () => {
  generateWaterTiles();
  drawBoard();
  startPSSRound();
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
