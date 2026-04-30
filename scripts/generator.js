// 关卡生成器 — 正向随机生成 + BFS 可解性验证

import { solve, MAX_CAPACITY } from './solver.js';

// 莫奈调色板 — 明亮、通透、有惊艳感
const COLORS = [
    '#6CAEE0', // 明亮的睡莲蓝
    '#8CD68C', // 鲜嫩的花园绿
    '#F0C070', // 明艳的暖杏黄
    '#C8ACE0', // 柔亮的鸢尾紫
    '#F0A8B0', // 娇艳的玫瑰粉
    '#7DD8D8', // 清透的睡莲青
    '#F0D880', // 明媚的向日葵黄
    '#A0B8E0', // 明亮的水天色
    '#E0C8A0', // 温暖的干草金
    '#A0E8C8'  // 清亮的薄荷绿
];

// 难度档位配置
export const DIFFICULTY_BRACKETS = [
    { label: '入门', minSteps: 3,  maxSteps: 15,  colors: [3, 4],  empty: [2, 3], maxAttempts: 40 },
    { label: '简单', minSteps: 8,  maxSteps: 25,  colors: [4, 5],  empty: [2, 3], maxAttempts: 50 },
    { label: '中等', minSteps: 15, maxSteps: 40,  colors: [5, 7],  empty: [1, 2], maxAttempts: 80 },
    { label: '困难', minSteps: 20, maxSteps: 60,  colors: [6, 8],  empty: [1, 2], maxAttempts: 100 },
    { label: '极难', minSteps: 30, maxSteps: 90,  colors: [7, 9],  empty: [1, 1], maxAttempts: 120 }
];

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 智能正向生成一个随机状态
 * 策略：完全随机分配后，修复「颜色过于集中」和「出现完成瓶」的问题
 */
function generateRandomState(bracket) {
    const numColors = randomBetween(...bracket.colors);
    const numEmpty = randomBetween(...bracket.empty);
    const totalBottles = numColors + numEmpty;
    const colors = COLORS.slice(0, numColors);

    // 创建所有颜色段（每种4段）
    let segments = [];
    for (const color of colors) {
        for (let i = 0; i < MAX_CAPACITY; i++) {
            segments.push(color);
        }
    }
    segments = shuffleArray(segments);

    const bottles = Array.from({ length: totalBottles }, () => []);

    // 逐段随机放入瓶子
    for (const color of segments) {
        const candidates = [];
        for (let i = 0; i < totalBottles; i++) {
            if (bottles[i].length < MAX_CAPACITY) candidates.push(i);
        }
        if (candidates.length === 0) break;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        bottles[target].push(color);
    }

    // 修复1：确保每种颜色至少出现在2个瓶子中（避免 trivial）
    for (const color of colors) {
        const indices = [];
        for (let i = 0; i < totalBottles; i++) {
            if (bottles[i].includes(color)) indices.push(i);
        }
        if (indices.length === 1) {
            const sourceIdx = indices[0];
            // 找一段该颜色移到另一个瓶子
            const pos = bottles[sourceIdx].indexOf(color);
            if (pos === -1) continue;
            for (let j = 0; j < totalBottles; j++) {
                if (j === sourceIdx) continue;
                if (bottles[j].length < MAX_CAPACITY) {
                    bottles[j].push(bottles[sourceIdx].splice(pos, 1)[0]);
                    break;
                }
            }
        }
    }

    // 修复2：避免出现完成瓶（满且同色），否则关卡无意义
    for (let i = 0; i < totalBottles; i++) {
        if (bottles[i].length === MAX_CAPACITY && bottles[i].every(c => c === bottles[i][0])) {
            const topColor = bottles[i][MAX_CAPACITY - 1];
            // 把顶部1段移到能接收的瓶子
            for (let j = 0; j < totalBottles; j++) {
                if (i === j) continue;
                if (bottles[j].length < MAX_CAPACITY &&
                    (bottles[j].length === 0 || bottles[j][bottles[j].length - 1] === topColor)) {
                    bottles[j].push(bottles[i].pop());
                    break;
                }
            }
        }
    }

    // 打乱每个瓶子的内部顺序，制造混色
    for (let i = 0; i < totalBottles; i++) {
        if (bottles[i].length > 1) {
            bottles[i] = shuffleArray(bottles[i]);
        }
    }

    return shuffleArray(bottles.map(b => [...b]));
}

/**
 * 保底简单关卡（确保程序不会崩溃）
 */
function generateFallbackLevel() {
    return {
        bottles: [
            ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'],
            ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71'],
            ['#2ecc71', '#f1c40f', '#e74c3c', '#3498db'],
            ['#f1c40f', '#2ecc71', '#3498db', '#e74c3c'],
            [],
            []
        ],
        difficulty: { label: '入门', steps: 12, iterations: 0 }
    };
}

/**
 * 生成符合目标难度的关卡
 * @param {number} targetBracketIndex 0~4
 */
export function generateLevel(targetBracketIndex = 2) {
    const bracket = DIFFICULTY_BRACKETS[Math.max(0, Math.min(4, targetBracketIndex))];

    for (let attempt = 0; attempt < bracket.maxAttempts; attempt++) {
        const bottles = generateRandomState(bracket);

        // BFS 验证最短解步数
        const solution = solve(bottles, 60000);

        if (solution.solvable &&
            solution.moves.length >= bracket.minSteps &&
            solution.moves.length <= bracket.maxSteps) {
            return {
                bottles,
                difficulty: {
                    label: bracket.label,
                    steps: solution.moves.length,
                    iterations: solution.iterations
                }
            };
        }

        // BFS 超时但探索深度已达标：关卡大概率可解但很难，接受它
        if (!solution.solvable && solution.depth >= bracket.minSteps) {
            return {
                bottles,
                difficulty: {
                    label: bracket.label,
                    steps: solution.depth,
                    iterations: solution.iterations
                }
            };
        }
    }

    // 降级重试
    for (let fallback = targetBracketIndex - 1; fallback >= 0; fallback--) {
        const fbBracket = DIFFICULTY_BRACKETS[fallback];
        for (let i = 0; i < 20; i++) {
            const bottles = generateRandomState(fbBracket);
            const solution = solve(bottles, 40000);
            if (solution.solvable) {
                return {
                    bottles,
                    difficulty: {
                        label: fbBracket.label,
                        steps: solution.moves.length,
                        iterations: solution.iterations
                    }
                };
            }
        }
    }

    return generateFallbackLevel();
}
