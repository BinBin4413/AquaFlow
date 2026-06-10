// UI和动画模块

let bottleElements = [];
let confettiActive = false;

export function initUI() {
    const container = document.getElementById('bottleContainer');
    if (!container) return;

    // 清空现有瓶子（保留template）
    const template = container.querySelector('#bottleTemplate');
    container.innerHTML = '';
    if (template) container.appendChild(template);
    bottleElements = [];

    container.addEventListener('click', handleBottleClick);
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
        updateBottleContent(el, bottle, prevBottle);

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
    });

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

function createBottleElement() {
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

function updateBottleContent(element, segments, prevSegments) {
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

        if (!prevSegments) {
            // 初始渲染，无动画
            if (newColor) {
                seg.style.backgroundColor = newColor;
                seg.style.opacity = '0.88';
            } else {
                seg.style.backgroundColor = 'transparent';
                seg.style.opacity = '0';
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
    }
}

function triggerShake(element) {
    element.classList.remove('shake');
    // 强制重绘
    void element.offsetWidth;
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 400);
}

function handleBottleClick(event) {
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
