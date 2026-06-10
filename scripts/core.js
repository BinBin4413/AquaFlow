// 游戏核心逻辑

import { generateLevel, DIFFICULTY_BRACKETS } from './generator.js';
import { solve, findNextMove, pour, isSolved } from './solver.js';
import { initUI, updateUI, showScreen, playVictoryEffect } from './ui.js';
import { initLayout, updateLayout } from './layout.js';

const PLAYER_KEY = 'aquaflow_player_v210';
const LEGACY_KEY = 'aquaflow_player_v1';

// 游戏状态
let gameState = {
    bottles: [],
    selectedBottle: -1,
    moves: [],
    moveCount: 0,
    startTime: 0,
    timeElapsed: 0,
    timer: null,
    difficulty: null,
    hintMove: null,
    lastError: null,
    usedHint: false,
    skipped: false,
    optimalSteps: 0,
    initialBottles: [],
    autoPlaying: false
};

// 玩家数据（自适应难度用）
let player = loadPlayer();

function loadPlayer() {
    try {
        const raw = localStorage.getItem(PLAYER_KEY);
        if (raw) return JSON.parse(raw);

        // 兼容旧版本数据
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
            const v1 = JSON.parse(legacy);
            const migrated = {
                currentBracket: v1.currentBracket ?? 1,
                streak: v1.streak ?? 0,
                totalGames: v1.totalGames ?? 0,
                totalWins: v1.totalWins ?? 0,
                history: (v1.history || []).map(h => ({
                    win: h.win,
                    time: h.time ?? 0,
                    usedHint: h.usedHint ?? false,
                    skipped: h.skipped ?? false,
                    difficulty: h.difficulty,
                    stars: h.win ? 1 : 0,
                    optimalSteps: 0
                }))
            };
            localStorage.setItem(PLAYER_KEY, JSON.stringify(migrated));
            localStorage.removeItem(LEGACY_KEY);
            return migrated;
        }
    } catch (e) { /* ignore */ }
    return {
        currentBracket: 1,
        streak: 0,
        totalGames: 0,
        totalWins: 0,
        history: []
    };
}

function savePlayer() {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}分${s.toString().padStart(2, '0')}秒` : `${s}秒`;
}

function calculateStars(moveCount, optimalSteps) {
    if (optimalSteps <= 0) return 1;
    if (moveCount <= optimalSteps) return 3;
    if (moveCount <= optimalSteps + 5) return 2;
    return 1;
}

// ========== 莫奈背景画廊 ==========
const MONET_BACKGROUNDS = [
    'assets/monet-01-water-lilies.jpg',
    'assets/monet-03-impression-sunrise.jpg',
    'assets/monet-04-poppy.jpg',
    'assets/monet-05-woman-parasol.jpg'
];

let currentBgLayer = 'A';

function pickRandomBackground() {
    const pick = MONET_BACKGROUNDS[Math.floor(Math.random() * MONET_BACKGROUNDS.length)];
    const nextLayer = currentBgLayer === 'A' ? 'B' : 'A';

    const nextEl = document.getElementById(`bgLayer${nextLayer}`);
    const currEl = document.getElementById(`bgLayer${currentBgLayer}`);
    if (!nextEl || !currEl) return;

    // 预加载图片，加载完成后再淡入
    const img = new Image();
    img.onload = () => {
        nextEl.style.backgroundImage = `url('${pick}')`;
        nextEl.classList.add('active');
        currEl.classList.remove('active');
        currentBgLayer = nextLayer;
    };
    img.src = pick;
}

// ========== 初始化 ==========

function initGame() {
    pickRandomBackground();
    initUI();
    initLayout();

    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('undoButton').addEventListener('click', undoMove);
    document.getElementById('hintButton').addEventListener('click', showHint);
    document.getElementById('skipButton').addEventListener('click', skipLevel);
    document.getElementById('nextLevelButton').addEventListener('click', startGame);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    const appealBtn = document.getElementById('appealButton');
    if (appealBtn) appealBtn.addEventListener('click', appeal);

    const appealClose = document.getElementById('appealClose');
    if (appealClose) appealClose.addEventListener('click', hideAppealModal);

    document.addEventListener('bottleClick', handleBottleClick);

    loadThemePreference();
    updateStartScreen();
}

function updateStartScreen() {
    const streakEl = document.getElementById('streakDisplay');
    if (!streakEl) return;
    if (player.streak > 0) {
        streakEl.textContent = `已连胜 ${player.streak} 局 🔥`;
        streakEl.style.display = 'block';
    } else {
        streakEl.style.display = 'none';
    }

    const statsEl = document.getElementById('startStats');
    if (statsEl) {
        const winHistory = player.history.filter(h => h.win);
        let bestStars = 0;
        let avgStars = '0.00';

        if (winHistory.length > 0) {
            bestStars = Math.max(...winHistory.map(h => h.stars || 1));
            const totalStars = winHistory.reduce((sum, h) => sum + (h.stars || 1), 0);
            avgStars = (totalStars / winHistory.length).toFixed(2);
        }

        const bestStarText = '★'.repeat(bestStars) + '☆'.repeat(3 - bestStars);

        statsEl.innerHTML = `
            总场次: ${player.totalGames} &nbsp; 胜率: ${player.totalGames > 0 ? Math.round((player.totalWins / player.totalGames) * 100) : 0}%<br>
            最高星级: ${bestStarText} &nbsp; 平均星度: ${avgStars}⭐
        `;
    }
}

// ========== 游戏流程 ==========

function startGame() {
    clearInterval(gameState.timer);
    hideAppealModal();
    pickRandomBackground();

    const result = generateLevel(player.currentBracket);

    gameState = {
        bottles: result.bottles,
        selectedBottle: -1,
        moves: [],
        moveCount: 0,
        startTime: Date.now(),
        timeElapsed: 0,
        timer: setInterval(updateTimer, 1000),
        difficulty: result.difficulty,
        hintMove: null,
        lastError: null,
        usedHint: false,
        skipped: false,
        optimalSteps: result.difficulty?.steps || 0,
        initialBottles: result.bottles.map(b => [...b]),
        autoPlaying: false
    };

    showScreen('gameScreen');
    updateLayout(gameState.bottles.length);
    updateUI(gameState);
}

function updateTimer() {
    gameState.timeElapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const el = document.getElementById('timeCounter');
    if (el) el.textContent = `时间: ${formatTime(gameState.timeElapsed)}`;
}

// ========== 操作处理 ==========

function handleBottleClick(event) {
    if (gameState.autoPlaying) return;
    const index = event.detail.bottleIndex;
    gameState.hintMove = null;
    gameState.lastError = null;

    // 第一次点击：选中
    if (gameState.selectedBottle === -1) {
        if (gameState.bottles[index].length > 0) {
            gameState.selectedBottle = index;
        }
        updateUI(gameState);
        return;
    }

    // 点击已选中：取消
    if (gameState.selectedBottle === index) {
        gameState.selectedBottle = -1;
        updateUI(gameState);
        return;
    }

    // 尝试倒水
    const fromIdx = gameState.selectedBottle;
    const toIdx = index;
    const fromBottle = gameState.bottles[fromIdx];
    const toBottle = gameState.bottles[toIdx];

    const can = fromBottle.length > 0 && toBottle.length < 4 &&
        (toBottle.length === 0 || toBottle[toBottle.length - 1] === fromBottle[fromBottle.length - 1]);

    if (can) {
        // 保存撤销状态（深拷贝）
        gameState.moves.push({
            bottles: gameState.bottles.map(b => [...b]),
            selectedBottle: fromIdx
        });
        if (gameState.moves.length > 50) gameState.moves.shift(); // 限制撤销深度

        pour(fromBottle, toBottle);
        gameState.moveCount++;
        if (!checkVictory()) {
            checkAutoComplete();
        }
    } else {
        // 非法操作：记录错误源瓶，触发摇晃
        gameState.lastError = { from: fromIdx, to: toIdx };
    }

    gameState.selectedBottle = -1;
    updateUI(gameState);
}

function undoMove() {
    if (gameState.autoPlaying) return;
    if (gameState.moves.length === 0) return;
    const last = gameState.moves.pop();
    gameState.bottles = last.bottles;
    gameState.moveCount = Math.max(0, gameState.moveCount - 1);
    gameState.selectedBottle = -1;
    gameState.hintMove = null;
    gameState.lastError = null;
    updateUI(gameState);
}

function showHint() {
    if (gameState.autoPlaying) return;
    gameState.usedHint = true;
    const hint = findNextMove(gameState.bottles);
    if (hint) {
        gameState.hintMove = hint;
        gameState.selectedBottle = -1;
        updateUI(gameState);
    }
}

function skipLevel() {
    if (gameState.autoPlaying) return;
    gameState.skipped = true;
    recordResult(false);
    clearInterval(gameState.timer);
    startGame();
}

// ========== 胜负判断 ==========

function checkVictory() {
    if (!isSolved(gameState.bottles)) return false;

    clearInterval(gameState.timer);
    recordResult(true);

    const stars = calculateStars(gameState.moveCount, gameState.optimalSteps);
    const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const titleMap = { 3: '🎉 恭喜完美通关！', 2: '👏 优秀通关！', 1: '🎉 恭喜通关！' };

    const titleEl = document.getElementById('victoryTitle');
    if (titleEl) titleEl.textContent = titleMap[stars];

    const starsEl = document.getElementById('victoryStars');
    if (starsEl) starsEl.textContent = starText;

    const appealBtn = document.getElementById('appealButton');
    if (appealBtn) {
        appealBtn.style.display = stars < 3 ? 'inline-block' : 'none';
    }

    const statsLines = [
        `用时: ${formatTime(gameState.timeElapsed)}`,
        `步数: ${gameState.moveCount} / 最短 ${gameState.optimalSteps} 步`,
        ``,
        `这局的难度：${gameState.difficulty?.label || '未知'} 🧠`
    ];
    document.getElementById('victoryStats').innerHTML = statsLines.join('<br>');

    playVictoryEffect();
    showScreen('victoryScreen');
    updateStartScreen();
    return true;
}

// ========== 自动完成 ==========

function checkAutoComplete() {
    const result = solve(gameState.bottles, 20000);
    if (result.solvable && result.moves.length <= 5 && result.moves.length > 0) {
        runAutoPlay(result.moves);
    }
}

async function runAutoPlay(moves) {
    gameState.autoPlaying = true;

    for (const move of moves) {
        // 高亮要操作的瓶子
        gameState.hintMove = move;
        updateUI(gameState);

        // 等待 500ms 让玩家看到高亮
        await new Promise(r => setTimeout(r, 500));

        // 执行倒水
        const fromBottle = gameState.bottles[move.from];
        const toBottle = gameState.bottles[move.to];

        // 保存撤销状态
        gameState.moves.push({
            bottles: gameState.bottles.map(b => [...b]),
            selectedBottle: move.from
        });
        if (gameState.moves.length > 50) gameState.moves.shift();

        pour(fromBottle, toBottle);
        gameState.moveCount++;
        gameState.hintMove = null;
        gameState.selectedBottle = -1;

        updateUI(gameState);

        // 检查是否通关
        if (checkVictory()) break;

        // 步骤间隔
        await new Promise(r => setTimeout(r, 400));
    }

    gameState.autoPlaying = false;
}

// ========== 申诉 ==========

function appeal() {
    const textEl = document.getElementById('appealText');
    if (!textEl) return;

    if (gameState.optimalSteps > 0) {
        textEl.textContent = `本局最短解需要 ${gameState.optimalSteps} 步，你当前已走 ${gameState.moveCount} 步`;
        showAppealModal();
        return;
    }

    textEl.textContent = '正在计算最短解，请稍候...';
    showAppealModal();

    setTimeout(() => {
        const result = solve(gameState.initialBottles, 100000);
        if (result.solvable) {
            gameState.optimalSteps = result.depth;
            textEl.textContent = `本局最短解需要 ${result.depth} 步，你当前已走 ${gameState.moveCount} 步`;
        } else {
            textEl.textContent = `本局较为复杂，已探索 ${result.iterations} 个状态仍未确定最短解。请继续尝试！`;
        }
    }, 50);
}

function showAppealModal() {
    const modal = document.getElementById('appealModal');
    if (modal) modal.classList.add('active');
}

function hideAppealModal() {
    const modal = document.getElementById('appealModal');
    if (modal) modal.classList.remove('active');
}

// ========== 自适应难度 ==========

function recordResult(win) {
    player.totalGames++;
    const stars = win ? calculateStars(gameState.moveCount, gameState.optimalSteps) : 0;
    if (win) {
        player.totalWins++;
        player.streak++;
    } else {
        player.streak = 0;
    }

    player.history.push({
        win,
        time: gameState.timeElapsed,
        usedHint: gameState.usedHint,
        skipped: gameState.skipped,
        difficulty: gameState.difficulty?.label,
        stars,
        optimalSteps: gameState.optimalSteps
    });
    if (player.history.length > 30) player.history.shift();

    adjustDifficulty();
    savePlayer();
}

function adjustDifficulty() {
    const recent = player.history.slice(-5);
    const wins = recent.filter(r => r.win).length;
    const hints = recent.filter(r => r.usedHint).length;
    const skips = recent.filter(r => r.skipped).length;

    // 升级条件：连胜3局且均未使用提示
    if (player.streak >= 3 && hints === 0) {
        if (player.currentBracket < 4) {
            player.currentBracket++;
        }
        return;
    }

    // 降级条件：最近5局中使用跳过，或频繁使用提示，或胜率过低
    if (skips > 0 || hints >= 3) {
        if (player.currentBracket > 0) {
            player.currentBracket--;
        }
        return;
    }

    if (wins < 2 && recent.length >= 3) {
        if (player.currentBracket > 0) {
            player.currentBracket--;
        }
    }
}

// ========== 主题 ==========

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    document.getElementById('themeToggle').textContent = next === 'dark' ? '🌙' : '🌞';
    localStorage.setItem('theme', next);
}

function loadThemePreference() {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = saved === 'dark' ? '🌙' : '🌞';
}

// 导出
export { gameState, initGame, startGame, checkVictory };

document.addEventListener('DOMContentLoaded', initGame);
