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
        updateBottleContent(el, bottle);

        // 选中状态
        el.classList.toggle('selected', index === gameState.selectedBottle);

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

function updateBottleContent(element, segments) {
    const container = element.querySelector('.segments');
    container.innerHTML = '';

    const maxSegments = 4;

    for (let i = 0; i < maxSegments; i++) {
        const seg = document.createElement('div');
        seg.className = 'segment';

        if (i < segments.length) {
            seg.style.backgroundColor = segments[i];
            seg.style.opacity = '0.88';
        } else {
            seg.style.backgroundColor = 'transparent';
            seg.style.opacity = '0';
        }

        container.appendChild(seg);
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
