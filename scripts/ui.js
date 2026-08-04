// UI和动画模块

import { isCompletedBottle } from './solver.js';

let bottleElements = [];
let confettiActive = false;
let longPressTimer = null;
let longPressTriggered = false;
// 上一帧已完成的瓶子集合（用于检测"首次完成"触发庆祝）
let prevCompleted = new Set();

export function initUI() {
    const container = document.getElementById('bottleContainer');
    if (!container) return;

    // 清空现有瓶子（保留template）
    const template = container.querySelector('#bottleTemplate');
    container.innerHTML = '';
    if (template) container.appendChild(template);
    bottleElements = [];

    container.addEventListener('click', handleBottleClick);

    // 长按偷看事件
    const startPress = (e) => {
        const bottle = e.target.closest('.bottle');
        if (!bottle) return;
        const index = bottleElements.indexOf(bottle);
        if (index === -1) return;

        longPressTriggered = false;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            const event = new CustomEvent('bottleLongPress', {
                detail: { bottleIndex: index }
            });
            document.dispatchEvent(event);
        }, 800);
    };

    const cancelPress = () => {
        clearTimeout(longPressTimer);
    };

    container.addEventListener('mousedown', startPress);
    container.addEventListener('touchstart', startPress);
    container.addEventListener('mouseup', cancelPress);
    container.addEventListener('touchend', cancelPress);
    container.addEventListener('touchmove', cancelPress);
}

export function updateUI(gameState) {
    const container = document.getElementById('bottleContainer');
    if (!container) return;

    const numBottles = gameState.bottles.length;

    // 确保瓶子元素数量匹配
    while (bottleElements.length < numBottles) {
        const bottle = createBottleElement();
        bottleElements.push(bottle);
        container.appendChild(bottle);
    }
    while (bottleElements.length > numBottles) {
        const el = bottleElements.pop();
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    // 更新每个瓶子的内容和状态
    gameState.bottles.forEach((bottle, index) => {
        const el = bottleElements[index];
        if (!el) return;

        const prevBottle = gameState.prevBottles ? gameState.prevBottles[index] : null;

        // 记忆模式配置
        let memoryConfig = null;
        if (gameState.memoryMode) {
            const now = Date.now();
            const isRevealPhase = gameState.memoryRevealEnd > 0 && now < gameState.memoryRevealEnd;
            const isPeekPhase = gameState.peekBottle === index && now < gameState.peekEnd;

            if (!isRevealPhase && !isPeekPhase && bottle.length > 0) {
                const topIndex = bottle.length - 1;
                if (!gameState.revealed[index]) {
                    gameState.revealed[index] = [false, false, false, false];
                }
                gameState.revealed[index][topIndex] = true;
                memoryConfig = {
                    hidden: true,
                    topIndex: topIndex,
                    revealed: gameState.revealed[index]
                };
            }
        }

        updateBottleContent(el, bottle, prevBottle, memoryConfig);

        // 选中状态
        el.classList.toggle('selected', index === gameState.selectedBottle);

        // 倒水动作
        el.classList.toggle('pouring', index === gameState.pourFrom);
        el.classList.toggle('receiving', index === gameState.pourTo);

        // 错误摇晃
        if (gameState.lastError && gameState.lastError.from === index) {
            triggerShake(el);
        }

        // 提示高亮
        el.classList.remove('hint-from', 'hint-to');
        if (gameState.hintMove) {
            if (index === gameState.hintMove.from) el.classList.add('hint-from');
            if (index === gameState.hintMove.to) el.classList.add('hint-to');
        }

        // 完成特效：已排序满瓶 → 常驻光效；首次完成 → 弹跳 + 水花
        const completed = isCompletedBottle(bottle);
        const wasCompleted = prevCompleted.has(index);
        if (completed) {
            el.classList.add('completed');
            if (!wasCompleted) {
                triggerCompleteEffect(el);
            }
        } else {
            el.classList.remove('completed');
        }
    });

    // 同步"上一帧完成集合"，用于下次检测首次完成
    prevCompleted = new Set(
        gameState.bottles
            .map((b, i) => (isCompletedBottle(b) ? i : -1))
            .filter(i => i !== -1)
    );

    // 更新统计
    const moveCounter = document.getElementById('moveCounter');
    if (moveCounter) moveCounter.textContent = `步数: ${gameState.moveCount}`;

    // 3秒后清除提示
    if (gameState.hintMove) {
        setTimeout(() => {
            bottleElements.forEach(el => el.classList.remove('hint-from', 'hint-to'));
        }, 3000);
    }

    // 清除一次性动画状态
    if (gameState.prevBottles) gameState.prevBottles = null;
    if (gameState.pourFrom !== -1) gameState.pourFrom = -1;
    if (gameState.pourTo !== -1) gameState.pourTo = -1;
}

export function createBottleElement() {
    const bottle = document.createElement('div');
    bottle.className = 'bottle nouveau';
    bottle.innerHTML = `
        <div class="bottle-body">
            <div class="bottle-neck"></div>
            <div class="segments"></div>
            <div class="bottle-bottom"></div>
        </div>
    `;
    return bottle;
}

export function updateBottleContent(element, segments, prevSegments, memoryConfig) {
    const container = element.querySelector('.segments');
    const maxSegments = 4;

    for (let i = 0; i < maxSegments; i++) {
        let seg = container.children[i];
        const newColor = i < segments.length ? segments[i] : null;
        const oldColor = prevSegments && i < prevSegments.length ? prevSegments[i] : null;

        if (!seg) {
            seg = document.createElement('div');
            seg.className = 'segment';
            container.appendChild(seg);
        }

        const isRevealed = memoryConfig && memoryConfig.revealed && memoryConfig.revealed[i];
        const isHiddenByMemory = memoryConfig && memoryConfig.hidden && i !== memoryConfig.topIndex && !isRevealed;

        // 先清理记忆隐藏类（动画需要正常颜色）
        seg.classList.remove('memory-hidden');

        if (!prevSegments) {
            // 初始渲染，无动画，清除可能残留的动画类
            seg.classList.remove('pour-in', 'pour-out');
            if (newColor) {
                seg.style.backgroundColor = newColor;
                seg.style.opacity = '0.88';
            } else {
                seg.style.backgroundColor = 'transparent';
                seg.style.opacity = '0';
            }
            if (isHiddenByMemory && newColor) {
                seg.classList.add('memory-hidden');
            }
            continue;
        }

        // 有 prevSegments，说明是状态变化，需要动画
        if (newColor && !oldColor) {
            // 新增段
            seg.classList.remove('pour-out');
            seg.style.backgroundColor = newColor;
            seg.style.opacity = '0';
            void seg.offsetWidth;
            seg.classList.add('pour-in');
            seg.style.opacity = '0.88';
        } else if (!newColor && oldColor) {
            // 移除段
            seg.classList.remove('pour-in');
            seg.classList.add('pour-out');
        } else if (newColor && oldColor && newColor !== oldColor) {
            // 颜色改变（异常情况）
            seg.style.backgroundColor = newColor;
            seg.style.opacity = '0.88';
            seg.classList.remove('pour-in', 'pour-out');
        } else {
            // 无变化
            seg.classList.remove('pour-in', 'pour-out');
        }

        // 记忆隐藏：只在非动画状态下应用
        if (isHiddenByMemory && newColor) {
            seg.classList.add('memory-hidden');
        }
    }
}

function triggerShake(element) {
    element.classList.remove('shake');
    // 强制重绘
    void element.offsetWidth;
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 400);
}

// ========== 完成瓶子庆祝特效 ==========

function triggerCompleteEffect(element) {
    // 一次性"开心弹跳"
    element.classList.remove('complete-bounce');
    void element.offsetWidth;
    element.classList.add('complete-bounce');
    setTimeout(() => element.classList.remove('complete-bounce'), 450);

    // 从瓶口喷出小水花（颜色取自瓶子里的液体，更有质感）
    createWaterSplash(element);
}

function createWaterSplash(element) {
    const rect = element.getBoundingClientRect();
    const colors = [];
    element.querySelectorAll('.segment').forEach(seg => {
        const bg = seg.style.backgroundColor;
        if (bg && bg !== 'transparent' && bg !== '' && colors.indexOf(bg) === -1) {
            colors.push(bg);
        }
    });
    if (colors.length === 0) colors.push('#7fd8d8');

    const splashColor = colors[Math.floor(Math.random() * colors.length)];
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.06;
    const count = 6;

    for (let i = 0; i < count; i++) {
        const drop = document.createElement('div');
        drop.className = 'water-drop';
        const dx = (Math.random() * 2 - 1) * 36;
        const dy = -(18 + Math.random() * 36);
        drop.style.cssText = `
            left: ${cx}px;
            top: ${cy}px;
            width: ${5 + Math.random() * 4}px;
            height: ${5 + Math.random() * 4}px;
            background: ${splashColor};
            --dx: ${dx}px;
            --dy: ${dy}px;
        `;
        document.body.appendChild(drop);
        setTimeout(() => drop.remove(), 700);
    }
}

function handleBottleClick(event) {
    if (longPressTriggered) {
        longPressTriggered = false;
        return;
    }

    const bottle = event.target.closest('.bottle');
    if (!bottle) return;
    const index = bottleElements.indexOf(bottle);
    if (index === -1) return;

    const clickEvent = new CustomEvent('bottleClick', {
        detail: { bottleIndex: index }
    });
    document.dispatchEvent(clickEvent);
}

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// ========== 胜利特效 ==========

export function playVictoryEffect() {
    if (confettiActive) return;
    confettiActive = true;

    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'];
    const container = document.body;
    const particleCount = 60;

    for (let i = 0; i < particleCount; i++) {
        createConfetti(container, colors);
    }

    setTimeout(() => {
        confettiActive = false;
        document.querySelectorAll('.confetti').forEach(el => el.remove());
    }, 3500);
}

function createConfetti(container, colors) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = `
        position: fixed;
        width: ${Math.random() * 8 + 4}px;
        height: ${Math.random() * 6 + 4}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw;
        top: -10px;
        opacity: 0.9;
        border-radius: 2px;
        pointer-events: none;
        z-index: 9999;
        animation: confetti-fall ${Math.random() * 2 + 2}s linear forwards,
                   confetti-spin ${Math.random() * 2 + 1}s linear infinite;
    `;
    container.appendChild(el);
}

// 动态注入confetti样式
(function injectConfettiStyle() {
    if (document.getElementById('confetti-style')) return;
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
        @keyframes confetti-fall {
            to { transform: translateY(105vh); opacity: 0; }
        }
        @keyframes confetti-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
})();

// 动态注入水花粒子样式
(function injectSplashStyle() {
    if (document.getElementById('water-splash-style')) return;
    const style = document.createElement('style');
    style.id = 'water-splash-style';
    style.textContent = `
        .water-drop {
            position: fixed;
            border-radius: 50%;
            pointer-events: none;
            z-index: 9998;
            box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.45);
            animation: water-drop-fly 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes water-drop-fly {
            0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 0.95;
            }
            100% {
                transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
})();
