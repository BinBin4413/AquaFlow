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
            transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.4s ease;
            user-select: none;
            -webkit-user-select: none;
        }
    `;
    document.head.appendChild(style);

    updateLayout();
    window.addEventListener('resize', () => updateLayout());
}

export function updateLayout(numBottles) {
    const container = document.getElementById('bottleContainer');
    if (!container) return;

    if (typeof numBottles !== 'number') {
        numBottles = container.querySelectorAll('.bottle').length;
    }
    if (numBottles === 0) return;

    const containerWidth = container.clientWidth - (LAYOUT_CONFIG.containerPadding * 2);
    const containerHeight = Math.max(400, window.innerHeight * 0.6);

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

    const bottleHeight = clampedFinalWidth * LAYOUT_CONFIG.bottleAspectRatio;
    const rows = Math.ceil(numBottles / bestCols);
    const totalBottleGridHeight = rows * (bottleHeight + LAYOUT_CONFIG.bottleGap) - LAYOUT_CONFIG.bottleGap;

    const gameMain = document.querySelector('.game-main');
    if (gameMain) {
        const extraHeight = 180;
        const needed = totalBottleGridHeight + extraHeight;
        gameMain.style.minHeight = `${Math.max(520, Math.ceil(needed))}px`;
    }

    container.style.minHeight = `${Math.ceil(totalBottleGridHeight)}px`;
}
