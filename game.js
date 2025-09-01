// ----- Config -----
const gridSize = 8;     
const cellSize = 50;    

// Canvas & UI
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const messageDiv = document.getElementById("message");
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

// Play background music on first user interaction
document.body.addEventListener('click', () => {
  if(bgMusic.paused){
    bgMusic.loop = true;
    bgMusic.play().catch(()=>{});
  }
}, { once: true });

// ----- Images -----
const rabbitImg = new Image();
rabbitImg.src = 'rabbit.png';
const wolfImg = new Image();
wolfImg.src = 'wolf.png';

// ----- Game State -----
let rabbit = { x: 0, y: 0 };
let wolf = { x: 7, y: 7 };

const doorBottom = { x: 6, y: 7 }; 
const doorRight = { x: 7, y: 6 };
const waterTiles = [];

const questions = [
  { text: "What is the capital of France?", answer: "Paris" },
  { text: "What is 5 + 7?", answer: "12" },
  { text: "Name a mammal that can fly.", answer: "Bat" },
  { text: "What color do you get by mixing red and yellow?", answer: "Orange" },
  { text: "What is the boiling point of water in °C?", answer: "100°C" },
  { text: "Who wrote 'Romeo and Juliet'?", answer: "William Shakespeare" },
  { text: "What planet is known as the Red Planet?", answer: "Mars" },
  { text: "What is the largest ocean on Earth?", answer: "Pacific Ocean" },
  { text: "What gas do plants absorb from the atmosphere?", answer: "Carbon dioxide" },
  { text: "How many continents are there?", answer: "7" },
  { text: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci" },
  { text: "What is H2O commonly known as?", answer: "Water" },
  { text: "What is the square root of 64?", answer: "8" },
  { text: "Which language is spoken in Brazil?", answer: "Portuguese" },
  { text: "How many legs does a spider have?", answer: "8" },
  { text: "What is the fastest land animal?", answer: "Cheetah" },
  { text: "What is 9 × 7?", answer: "63" },
  { text: "Which planet is closest to the Sun?", answer: "Mercury" },
  { text: "Who discovered penicillin?", answer: "Alexander Fleming" },
  { text: "What is the currency of Japan?", answer: "Yen" },
  { text: "How many states are in the USA?", answer: "50" },
  { text: "Who wrote 'Harry Potter'?", answer: "J.K. Rowling" },
  { text: "What is the chemical symbol for gold?", answer: "Au" },
  { text: "Which ocean is on the east coast of the USA?", answer: "Atlantic" },
  { text: "What is the freezing point of water in °C?", answer: "0°C" },
  { text: "Who was the first man on the Moon?", answer: "Neil Armstrong" },
  { text: "Which element has the symbol O?", answer: "Oxygen" },
  { text: "What is 15 - 9?", answer: "6" },
  { text: "Which animal is known as the King of the Jungle?", answer: "Lion" },
  { text: "What is the largest planet in our Solar System?", answer: "Jupiter" }
];

let questionIndex = 0;
let currentQuestion = null;
let answerRevealed = false;

let stepsRemaining = 0;
let currentPlayer = null;
let diceQueue = [];

let pssHuman = 'rabbit';
let pssResolved = false;

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

    // Only add to reachable when no remaining steps
    if (remaining === 0) {
      reachable.push({ x, y });
      continue;
    }

    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      // Skip if out of grid and not a safety zone
      if (!inGrid(nx, ny) && !inSafetyZone(nx, ny)) continue;

      if (player === rabbit) {
        // Rabbit cannot move onto wolf or water
        if (wolf.x === nx && wolf.y === ny) continue;
        if (waterTiles.some(t => t.x === nx && t.y === ny)) continue;
      } else {
        // Wolf cannot move onto water
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

  // ----- Thick border with door gaps -----
  const borderThickness = 4;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cellSize*gridSize, borderThickness); // top
  ctx.fillRect(0, 0, borderThickness, cellSize*gridSize); // left
  ctx.fillRect(0, cellSize*gridSize - borderThickness, cellSize*gridSize, borderThickness); // bottom
  ctx.fillRect(cellSize*gridSize - borderThickness, 0, borderThickness, cellSize*gridSize); // right
  // Gaps for doors (fill with safety zone color)
  ctx.fillStyle = "#ffd54a";
  ctx.fillRect(doorBottom.x*cellSize, cellSize*gridSize - borderThickness, cellSize, borderThickness);
  ctx.fillRect(cellSize*gridSize - borderThickness, doorRight.y*cellSize, borderThickness, cellSize);

  // Grid
  ctx.lineWidth = 1;
  ctx.strokeStyle="#333";
  for(let y=0;y<gridSize;y++)
    for(let x=0;x<gridSize;x++)
      ctx.strokeRect(x*cellSize,y*cellSize,cellSize,cellSize);

  // Water tiles
  ctx.fillStyle="#3a7afe";
  waterTiles.forEach(tile=>{
    ctx.fillRect(tile.x*cellSize,tile.y*cellSize,cellSize,cellSize);
  });

  // Safety zone
  ctx.fillStyle="#ffd54a";
  for(let x=6;x<=8;x++) ctx.fillRect(x*cellSize,8*cellSize,cellSize,cellSize);
  for(let y=6;y<=8;y++) ctx.fillRect(8*cellSize,y*cellSize,cellSize,cellSize);

  // Doors
  drawDoorArrow(doorBottom.x,doorBottom.y,"down");
  drawDoorArrow(doorRight.x,doorRight.y,"right");

  // Highlight reachable squares if the current player can move
if(currentPlayer && stepsRemaining > 0){
  const squares = getReachableSquares(currentPlayer, stepsRemaining);
  ctx.fillStyle = "rgba(0,255,0,0.3)";
  squares.forEach(sq => ctx.fillRect(sq.x*cellSize, sq.y*cellSize, cellSize, cellSize));
}

  // Players
  if(rabbitImg.complete) ctx.drawImage(rabbitImg,rabbit.x*cellSize,rabbit.y*cellSize,cellSize,cellSize);
  if(wolfImg.complete) ctx.drawImage(wolfImg,wolf.x*cellSize,wolf.y*cellSize,cellSize,cellSize);
}

function drawDoorArrow(x,y,dir){
  const cx=x*cellSize+cellSize/2;
  const cy=y*cellSize+cellSize/2;
  const s=12;
  ctx.fillStyle="#1b5e20";
  ctx.beginPath();
  if(dir==="down"){ctx.moveTo(cx,cy+s);ctx.lineTo(cx-s,cy-s);ctx.lineTo(cx+s,cy-s);}
  else{ctx.moveTo(cx+s,cy);ctx.lineTo(cx-s,cy-s);ctx.lineTo(cx-s,cy+s);}
  ctx.closePath();ctx.fill();
}

// ----- Click to move -----
canvas.addEventListener("click",(e)=>{
  if(!currentPlayer||stepsRemaining<=0) return;

  const rect=canvas.getBoundingClientRect();
  const cellX=Math.floor((e.clientX-rect.left)/cellSize);
  const cellY=Math.floor((e.clientY-rect.top)/cellSize);
  const reachable = getReachableSquares(currentPlayer, stepsRemaining);

  if(reachable.some(sq=>sq.x===cellX && sq.y===cellY)){
    currentPlayer.x=cellX;
    currentPlayer.y=cellY;
    stepsRemaining=0;
    drawBoard();       // draw after movement to show final position
    checkWin();

    // Queue next dice move if any
    if(diceQueue.length>0){
      currentPlayer = null;  // clear for next move
      rollDiceBtn.disabled = false;
      updateMessage("Click 'Roll Dice' to start the next move.");
    } else {
      pssHuman = pssHuman==='rabbit'?'wolf':'rabbit';
      currentPlayer = null;
      startPSSRound();
    }
  }
});

// ----- Roll Dice Button -----
rollDiceBtn.addEventListener("click", () => {
  if(!currentPlayer && diceQueue.length>0){
    startDiceMove(diceQueue.shift());
    rollDiceBtn.disabled = true;
  }
});

function startDiceMove(player){
  currentPlayer = player;
  const roll = Math.floor(Math.random()*6)+1;
  const bonus = player===rabbit?1:0;
  stepsRemaining = roll + bonus;
  diceRollSound.play().catch(()=>{});
  if(player === rabbit){
    updateMessage(`🐇 Rabbit rolled ${roll} + 1 = ${stepsRemaining}.`);
  } else {
    updateMessage(`🐺 Wolf rolled ${roll}.`);
  }
  drawBoard();
}

// ----- PSS -----
function startPSSRound(){
  rollDiceBtn.disabled = true;
  pssResolved = false;
  const humanName = pssHuman==='rabbit'?'🐇 Rabbit':'🐺 Wolf';
  messageDiv.textContent = `${humanName}, play paper-scissors-stone!`;
}

pssBtns.forEach(btn => {
  btn.addEventListener("click", e => {
    if(pssResolved) return;
    pssClick.play();
    const humanMove = e.target.dataset.move;
    const computerMove = ['rock','paper','scissors'][Math.floor(Math.random()*3)];
    const humanName = pssHuman==='rabbit'?'🐇 Rabbit':'🐺 Wolf';
    const computerName = pssHuman==='rabbit'?'🐺 Wolf':'🐇 Rabbit';
    const loser = determinePSSLoser(humanMove, computerMove);

    if(loser){
      currentQuestion = questions[questionIndex];
      questionIndex = (questionIndex+1)%questions.length;
      answerRevealed = false;
      messageDiv.textContent = `${humanName} chose ${humanMove}, ${computerName} chose ${computerMove}. ${loser==='rabbit'?'🐇 Rabbit':'🐺 Wolf'} must answer: ${currentQuestion.text} (click to reveal answer)`;
      pssResolved = true;
      diceQueue = [wolf, rabbit];
    } else {
      messageDiv.textContent = `${humanName} chose ${humanMove}, ${computerName} chose ${computerMove}. It's a tie! Play PSS again.`;
    }
  });
});

function determinePSSLoser(move1, move2){
  if(move1===move2) return null;
  const beats={rock:'scissors',scissors:'paper',paper:'rock'};
  return beats[move1]===move2?'wolf':'rabbit';
}

// ----- Click to reveal answer -----
messageDiv.addEventListener("click", ()=>{
  if(currentQuestion && !answerRevealed){
    messageDiv.textContent = `${currentQuestion.text} Answer: ${currentQuestion.answer}.`;
    answerRevealed = true;
    rollDiceBtn.disabled = false;
  }
});

// ----- Win / Reset -----
function checkWin(){
  if(wolf.x===rabbit.x && wolf.y===rabbit.y){
    loseSound.play();
    drawBoard(); // Show both on the same square before alert
    setTimeout(()=>{
      alert("🐺 Wolf caught the rabbit!");
      reset(); // <-- Move reset here
    }, 50);
    return;
  }
  if(inSafetyZone(rabbit.x,rabbit.y)){
    winSound.play();
    drawBoard(); // Show rabbit in safety zone before alert
    setTimeout(()=>{
      alert("🐇 Rabbit reached safety!");
      reset(); // <-- Move reset here
    }, 50);
  }
}

function reset(){
  rabbit={x:0,y:0};
  wolf={x:7,y:7};
  stepsRemaining=0;
  currentPlayer=null;
  diceQueue=[];
  generateWaterTiles();
  drawBoard();
  startPSSRound();
}

// ----- Update message -----
function updateMessage(msg){
  messageDiv.textContent = msg;
}

// ----- Start -----
[rabbitImg, wolfImg].forEach(img=>{
  img.onload = ()=>{
    if(rabbitImg.complete && wolfImg.complete){
      generateWaterTiles();
      drawBoard();
      startPSSRound();
    }
  };
});
