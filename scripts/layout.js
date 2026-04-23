// 布局管理系统

const LAYOUT_CONFIG = {
    minBottleSize: 72,
    maxBottleSize: 96,
    bottleAspectRatio: 3.2,
    containerPadding: 20,
    bottleGap: 22,
    maxColumns: 8
};

export function initLayout() {
    const style = document.createElement('style');
    style.textContent = `
        .bottle {
            width: var(--bottle-width);
            height: calc(var(--bottle-width) * ${LAYOUT_CONFIG.bottleAspectRatio});
            position: relative;
            cursor: pointer;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
            user-select: none;
            -webkit-user-select: none;
        }

        .bottle-body {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, var(--bottle-bg) 0%, rgba(255,255,255,0.05) 100%);
            border: 2px solid var(--bottle-border);
            border-radius: 10% 10% 22% 22%;
            overflow: hidden;
            position: relative;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.08);
        }

        .bottle-neck {
            height: 18px;
            background: rgba(255, 255, 255, 0.15);
            border-bottom: 1px solid var(--bottle-border);
            flex-shrink: 0;
        }

        .bottle-bottom {
            height: 16px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 0 0 22% 22%;
            flex-shrink: 0;
        }

        .segments {
            position: relative;
            display: flex;
            flex-direction: column-reverse;
            flex: 1;
            width: 100%;
            overflow: hidden;
        }

        .segment {
            flex: 1;
            width: 100%;
            transition: background-color 0.4s ease, opacity 0.4s ease;
            position: relative;
        }

        /* 液体高光效果 */
        .segment::after {
            content: '';
            position: absolute;
            top: 0;
            left: 15%;
            width: 25%;
            height: 100%;
            background: linear-gradient(90deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%);
            pointer-events: none;
        }

        .bottle.selected {
            transform: scale(1.08) translateY(-4px);
            filter: drop-shadow(0 0 8px var(--button-bg));
        }

        .bottle.shake {
            animation: shake 0.4s ease-in-out;
        }

        .bottle.hint-from {
            animation: pulse 1.2s infinite;
        }

        .bottle.hint-to {
            animation: glow 1.2s infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
        }

        @keyframes glow {
            0%, 100% { box-shadow: 0 0 4px var(--button-bg); }
            50% { box-shadow: 0 0 18px var(--button-bg), 0 0 6px var(--button-bg); }
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px) rotate(-2deg); }
            40% { transform: translateX(6px) rotate(2deg); }
            60% { transform: translateX(-4px) rotate(-1deg); }
            80% { transform: translateX(4px) rotate(1deg); }
        }
    `;
    document.head.appendChild(style);

    updateLayout();
    window.addEventListener('resize', () => updateLayout());
}

/**
 * 根据容器宽度和瓶子数量计算最佳网格布局
 * @param {number} [numBottles] 若不传则自动从DOM读取
 */
export function updateLayout(numBottles) {
    const container = document.getElementById('bottleContainer');
    if (!container) return;

    if (typeof numBottles !== 'number') {
        numBottles = container.querySelectorAll('.bottle').length;
    }
    if (numBottles === 0) return;

    const containerWidth = container.clientWidth - (LAYOUT_CONFIG.containerPadding * 2);
    const containerHeight = Math.max(300, window.innerHeight * 0.55);

    // 计算在不超过最大列数限制下的最佳列数
    const maxColsByWidth = Math.floor((containerWidth + LAYOUT_CONFIG.bottleGap) /
        (LAYOUT_CONFIG.minBottleSize + LAYOUT_CONFIG.bottleGap));
    const maxCols = Math.min(LAYOUT_CONFIG.maxColumns, maxColsByWidth, numBottles);

    let bestCols = 1;
    let bestScore = Infinity;

    for (let cols = 1; cols <= maxCols; cols++) {
        const rows = Math.ceil(numBottles / cols);
        const bottleWidth = Math.floor((containerWidth - (LAYOUT_CONFIG.bottleGap * (cols - 1))) / cols);
        const clampedWidth = Math.max(LAYOUT_CONFIG.minBottleSize,
            Math.min(bottleWidth, LAYOUT_CONFIG.maxBottleSize));
        const bottleHeight = clampedWidth * LAYOUT_CONFIG.bottleAspectRatio;
        const gridWidth = cols * (clampedWidth + LAYOUT_CONFIG.bottleGap) - LAYOUT_CONFIG.bottleGap;
        const gridHeight = rows * (bottleHeight + LAYOUT_CONFIG.bottleGap) - LAYOUT_CONFIG.bottleGap;

        // 评分：越接近 1:1 且不超过容器越好
        const ratio = Math.abs((gridWidth / Math.max(gridHeight, 1)) - 1);
        const fitsHeight = gridHeight <= containerHeight ? 0 : 1000;
        const score = ratio + fitsHeight;

        if (score < bestScore) {
            bestScore = score;
            bestCols = cols;
        }
    }

    const finalWidth = Math.floor((containerWidth - (LAYOUT_CONFIG.bottleGap * (bestCols - 1))) / bestCols);
    const clampedFinalWidth = Math.max(LAYOUT_CONFIG.minBottleSize,
        Math.min(finalWidth, LAYOUT_CONFIG.maxBottleSize));

    document.documentElement.style.setProperty('--bottle-width', `${clampedFinalWidth}px`);
    container.style.gridTemplateColumns = `repeat(${bestCols}, ${clampedFinalWidth}px)`;
    container.style.justifyContent = 'center';
    container.style.alignContent = 'center';

    // 计算瓶子区域总高度，动态调整 .game-main 避免溢出
    const bottleHeight = clampedFinalWidth * LAYOUT_CONFIG.bottleAspectRatio;
    const rows = Math.ceil(numBottles / bestCols);
    const totalBottleGridHeight = rows * (bottleHeight + LAYOUT_CONFIG.bottleGap) - LAYOUT_CONFIG.bottleGap;

    const gameMain = document.querySelector('.game-main');
    if (gameMain) {
        const extraHeight = 180; // controls + stats + padding
        const needed = totalBottleGridHeight + extraHeight;
        gameMain.style.minHeight = `${Math.max(520, Math.ceil(needed))}px`;
    }

    container.style.minHeight = `${Math.ceil(totalBottleGridHeight)}px`;
}
