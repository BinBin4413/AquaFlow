// 游戏核心逻辑

import { generateLevel, DIFFICULTY_BRACKETS } from './generator.js';
import { findNextMove, pour, isSolved } from './solver.js';
import { initUI, updateUI, showScreen, playVictoryEffect } from './ui.js';
import { initLayout, updateLayout } from './layout.js';

const PLAYER_KEY = 'aquaflow_player_v1';

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
    skipped: false
};

// 玩家数据（自适应难度用）
let player = loadPlayer();

function loadPlayer() {
    try {
        const raw = localStorage.getItem(PLAYER_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return {
        currentBracket: 1,   // 默认从"简单"开始，让玩家先适应
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

// ========== 初始化 ==========

function initGame() {
    initUI();
    initLayout();

    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('undoButton').addEventListener('click', undoMove);
    document.getElementById('hintButton').addEventListener('click', showHint);
    document.getElementById('skipButton').addEventListener('click', skipLevel);
    document.getElementById('nextLevelButton').addEventListener('click', startGame);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

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
        statsEl.textContent = `总场次: ${player.totalGames}  胜率: ${player.totalGames > 0 ? Math.round((player.totalWins / player.totalGames) * 100) : 0}%`;
    }
}

// ========== 游戏流程 ==========

function startGame() {
    clearInterval(gameState.timer);

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
        skipped: false
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
        checkVictory();
    } else {
        // 非法操作：记录错误源瓶，触发摇晃
        gameState.lastError = { from: fromIdx, to: toIdx };
    }

    gameState.selectedBottle = -1;
    updateUI(gameState);
}

function undoMove() {
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
    gameState.usedHint = true;
    const hint = findNextMove(gameState.bottles);
    if (hint) {
        gameState.hintMove = hint;
        gameState.selectedBottle = -1;
        updateUI(gameState);
    }
}

function skipLevel() {
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

    const statsLines = [
        `用时: ${formatTime(gameState.timeElapsed)}`,
        `步数: ${gameState.moveCount}`,
        ``,
        `这局的难度：${gameState.difficulty?.label || '未知'} 🧠`
    ];
    document.getElementById('victoryStats').innerHTML = statsLines.join('<br>');

    playVictoryEffect();
    showScreen('victoryScreen');
    updateStartScreen();
    return true;
}

// ========== 自适应难度 ==========

function recordResult(win) {
    player.totalGames++;
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
        difficulty: gameState.difficulty?.label
    });
    if (player.history.length > 15) player.history.shift();

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
