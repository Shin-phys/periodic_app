// Game Data
const ELEMENTS = [
    { n: 1, s: 'H', name: '水素' },
    { n: 2, s: 'He', name: 'ヘリウム' },
    { n: 3, s: 'Li', name: 'リチウム' },
    { n: 4, s: 'Be', name: 'ベリリウム' },
    { n: 5, s: 'B', name: 'ホウ素' },
    { n: 6, s: 'C', name: '炭素' },
    { n: 7, s: 'N', name: '窒素' },
    { n: 8, s: 'O', name: '酸素' },
    { n: 9, s: 'F', name: 'フッ素' },
    { n: 10, s: 'Ne', name: 'ネオン' },
    { n: 11, s: 'Na', name: 'ナトリウム' },
    { n: 12, s: 'Mg', name: 'マグネシウム' },
    { n: 13, s: 'Al', name: 'アルミニウム' },
    { n: 14, s: 'Si', name: 'ケイ素' },
    { n: 15, s: 'P', name: 'リン' },
    { n: 16, s: 'S', name: '硫黄' },
    { n: 17, s: 'Cl', name: '塩素' },
    { n: 18, s: 'Ar', name: 'アルゴン' },
    { n: 19, s: 'K', name: 'カリウム' },
    { n: 20, s: 'Ca', name: 'カルシウム' }
];

// State
let gameState = {
    mode: 'name', // 'name', 'symbol', 'atom'
    input: 'select', // 'select', 'write'
    isPlaying: false,
    startTime: 0,
    questions: [],
    currentQuestionIndex: 0,
    missed: [],
    temptationActive: false, // For 'Temptation Mode'
    temptationTriggered: false
};

// Canvas State
let canvasState = {
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    timer: null
};

// DOM Elements
const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

const ui = {
    questionText: document.getElementById('question-text'),
    protonCount: document.getElementById('proton-count'),
    atomView: document.getElementById('atom-view'),
    timer: document.getElementById('timer'),
    progressBar: document.getElementById('progress-fill'),
    inputSelector: document.getElementById('input-area-selector'),
    inputWrite: document.getElementById('input-area-write'),
    feedback: document.getElementById('feedback-overlay'),
    bestTime: document.getElementById('best-time-display'),
    canvas: document.getElementById('write-canvas'),
    ocrPreview: document.getElementById('recognition-preview'),
    kbFallback: document.getElementById('keyboard-fallback')
};

const ctx = ui.canvas.getContext('2d');

// Audio Context
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'correct') {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'tempt') {
        // Confusion sound "Really?"
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// Logic
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startGame() {
    initAudio();

    const modeEls = document.getElementsByName('quizMode');
    modeEls.forEach(el => { if (el.checked) gameState.mode = el.value; });

    const inputEls = document.getElementsByName('inputMode');
    inputEls.forEach(el => { if (el.checked) gameState.input = el.value; });

    gameState.questions = shuffle([...Array(20).keys()]);
    gameState.currentQuestionIndex = 0;
    gameState.missed = new Set();
    gameState.startTime = performance.now();
    gameState.isPlaying = true;
    gameState.temptationTriggered = false;

    setupCanvas();
    showScreen('game');
    updateInputVisibility();
    nextQuestion();

    requestAnimationFrame(updateTimer);
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function updateInputVisibility() {
    ui.inputSelector.classList.remove('active');
    ui.inputWrite.classList.remove('active');

    if (gameState.input === 'select') {
        ui.inputSelector.classList.add('active');
    } else {
        ui.inputWrite.classList.add('active');
    }
}

function nextQuestion() {
    if (gameState.currentQuestionIndex >= 20) {
        finishGame();
        return;
    }

    const idx = gameState.questions[gameState.currentQuestionIndex];
    const elData = ELEMENTS[idx];

    if (gameState.mode === 'name') {
        ui.questionText.textContent = elData.name;
        ui.atomView.classList.add('hidden');
    } else if (gameState.mode === 'symbol') {
        ui.questionText.textContent = elData.s;
        ui.atomView.classList.add('hidden');
    } else if (gameState.mode === 'atom') {
        ui.questionText.textContent = `?`;
        ui.atomView.classList.remove('hidden');
        ui.protonCount.textContent = elData.n;
    }

    // Temptation logic: 50% chance to tempt if not already tempted for this question?
    // Actually spec says "Once is correct logic, but Tempt Mode makes it fail visually first"
    // Let's making it simpler: 20% chance to trigger temptation mode
    gameState.temptationActive = Math.random() < 0.2;
    gameState.temptationTriggered = false; // Has the user been tempted yet?

    const progress = (gameState.currentQuestionIndex / 20) * 100;
    ui.progressBar.style.width = `${progress}%`;

    // Clear canvas
    clearCanvas();
}

function checkAnswer(answerN, fromOCR = false) {
    if (!gameState.isPlaying) return;

    const currentQIdx = gameState.questions[gameState.currentQuestionIndex];
    const correctN = ELEMENTS[currentQIdx].n;

    if (parseInt(answerN) === correctN) {
        if (gameState.temptationActive && !gameState.temptationTriggered) {
            // Temptation!
            playSound('tempt');
            showFeedback('tempt'); // Need to implement visually
            gameState.temptationTriggered = true;
            // Do not count as miss
        } else {
            playSound('correct');
            showFeedback('correct');
            gameState.currentQuestionIndex++;
            setTimeout(nextQuestion, 500); // Small delay
        }
    } else {
        playSound('wrong');
        showFeedback('incorrect');
        gameState.missed.add(ELEMENTS[currentQIdx].s);
    }

    if (fromOCR) {
        clearCanvas();
    }
}

function showFeedback(type) {
    ui.feedback.className = `feedback-overlay ${type === 'tempt' ? 'incorrect' : type}`;

    if (type === 'tempt') {
        ui.feedback.textContent = '本当に？';
    } else {
        ui.feedback.textContent = '';
    }

    void ui.feedback.offsetWidth;
    ui.feedback.style.opacity = 0.5;
    setTimeout(() => {
        ui.feedback.style.opacity = 0;
        ui.feedback.textContent = ''; // Reset text
    }, 400);
}

function updateTimer() {
    if (!gameState.isPlaying) return;

    const now = performance.now();
    const diff = now - gameState.startTime;

    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const ms = Math.floor((diff % 1000) / 10);

    ui.timer.textContent =
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

    requestAnimationFrame(updateTimer);
}

function finishGame() {
    gameState.isPlaying = false;
    showScreen('result');

    const finalTime = ui.timer.textContent;
    document.getElementById('result-time').textContent = finalTime;

    const oldBest = localStorage.getItem('periodic-best');
    if (!oldBest || finalTime < oldBest) {
        localStorage.setItem('periodic-best', finalTime);
    }

    const list = document.getElementById('miss-list');
    list.innerHTML = '';
    gameState.missed.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s;
        list.appendChild(li);
    });
}

// Canvas & OCR
function setupCanvas() {
    // Resize canvas to physical pixels
    const rect = ui.canvas.parentElement.getBoundingClientRect();
    ui.canvas.width = rect.width;
    ui.canvas.height = rect.height;

    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ui.canvas.addEventListener('pointerdown', startDrawing);
    ui.canvas.addEventListener('pointermove', draw);
    ui.canvas.addEventListener('pointerup', stopDrawing);
    ui.canvas.addEventListener('pointerout', stopDrawing);
}

function startDrawing(e) {
    canvasState.isDrawing = true;
    const rect = ui.canvas.getBoundingClientRect();
    canvasState.lastX = e.clientX - rect.left;
    canvasState.lastY = e.clientY - rect.top;

    // Clear debounce timer
    if (canvasState.timer) clearTimeout(canvasState.timer);
}

function draw(e) {
    if (!canvasState.isDrawing) return;
    const rect = ui.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(canvasState.lastX, canvasState.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    canvasState.lastX = x;
    canvasState.lastY = y;
}

function stopDrawing() {
    if (canvasState.isDrawing) {
        canvasState.isDrawing = false;
        // Auto recognition after 1s of inactivity
        canvasState.timer = setTimeout(recognizeText, 800);
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    ui.ocrPreview.textContent = '...';
}

let tesseractWorker = null;

async function initTesseract() {
    if (tesseractWorker) return; // Already initialized
    try {
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_char_whitelist: 'HheLiBeBCNOFNeNaMgAlSiPSClArKCa',
        });
        tesseractWorker = worker;
        console.log("Tesseract initialized");
    } catch (e) {
        console.error("Failed to init Tesseract", e);
    }
}

async function recognizeText() {
    ui.ocrPreview.textContent = '...';

    if (!tesseractWorker) {
        await initTesseract();
    }

    if (!tesseractWorker) {
        ui.ocrPreview.textContent = 'Err';
        return;
    }

    try {
        const ret = await tesseractWorker.recognize(ui.canvas);
        let text = ret.data.text.trim();

        // Heuristics / Correction
        text = normalizeSymbol(text);
        ui.ocrPreview.textContent = text;

        // Check if valid element
        const found = ELEMENTS.find(e => e.s === text);
        if (found) {
            checkAnswer(found.n, true);
        } else {
            // Maybe feedback? '?'
        }
    } catch (e) {
        console.error("Recognition failed", e);
        ui.ocrPreview.textContent = '?';
    }
}

// Initialize Tesseract on load (idle)
setTimeout(initTesseract, 1000);

function normalizeSymbol(text) {
    if (!text) return "";
    // Remove non-alpha
    text = text.replace(/[^a-zA-Z]/g, '');

    if (text.length === 1) return text.toUpperCase();
    if (text.length >= 2) {
        return text[0].toUpperCase() + text[1].toLowerCase();
    }
    return text;
}

// Event Listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', () => showScreen('start'));
document.getElementById('clear-btn').addEventListener('click', clearCanvas);
document.getElementById('kb-toggle-btn').addEventListener('click', toggleKeyboard);

document.querySelectorAll('.element-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Find button element even if clicked on internal span (if any)
        const target = e.target.closest('.element-btn');
        if (target) checkAnswer(target.dataset.n);
    });
});

// Keyboard Fallback
function toggleKeyboard() {
    ui.kbFallback.classList.toggle('hidden');
    // Generate keys if empty
    if (ui.kbFallback.innerHTML.trim() === '') {
        const row1 = document.createElement('div');
        row1.className = 'kb-row';
        ELEMENTS.forEach(el => {
            const btn = document.createElement('button');
            btn.className = 'kb-btn';
            btn.textContent = el.s;
            btn.onclick = () => checkAnswer(el.n);
            ui.kbFallback.appendChild(btn); // Just simple flex wrap
        });
    }
}

const loadedBest = localStorage.getItem('periodic-best');
if (loadedBest) ui.bestTime.textContent = loadedBest;
