// 自动解题算法 & 难度评估

export const MAX_CAPACITY = 4;

/**
 * 检查是否可以从源瓶倒入目标瓶
 */
export function canPour(source, target) {
    if (!source || source.length === 0) return false;
    if (target.length >= MAX_CAPACITY) return false;
    if (target.length === 0) return true;
    return source[source.length - 1] === target[target.length - 1];
}

/**
 * 执行倒水操作（原地修改数组）
 * @returns {{color: string, count: number}|null}
 */
export function pour(source, target) {
    if (!canPour(source, target)) return null;

    const color = source[source.length - 1];
    let count = 0;
    const available = MAX_CAPACITY - target.length;

    for (let i = source.length - 1; i >= 0; i--) {
        if (source[i] === color && count < available) {
            count++;
        } else {
            break;
        }
    }

    for (let i = 0; i < count; i++) {
        target.push(source.pop());
    }

    return { color, count };
}

/**
 * 检查是否达成胜利条件（严格）
 * 每个非空瓶子必须满且同色，且不能有重复颜色
 */
export function isSolved(bottles) {
    const usedColors = new Set();
    for (const bottle of bottles) {
        if (bottle.length === 0) continue;
        if (bottle.length !== MAX_CAPACITY) return false;
        const color = bottle[0];
        if (!bottle.every(c => c === color)) return false;
        if (usedColors.has(color)) return false;
        usedColors.add(color);
    }
    return true;
}

/**
 * 检查瓶子是否已完成排序（满且同色）
 */
export function isCompletedBottle(bottle) {
    return bottle.length === MAX_CAPACITY && bottle.every(c => c === bottle[0]);
}

function cloneBottles(bottles) {
    return bottles.map(b => [...b]);
}

/**
 * 状态序列化（瓶子顺序无关，减少状态空间）
 */
function serializeState(bottles) {
    const parts = bottles.map(b => b.join(','));
    parts.sort();
    return parts.join(';');
}

/**
 * BFS 求解器 — 寻找最短解
 * @param {Array} bottles 初始状态
 * @param {number} maxIterations 最大搜索状态数
 * @returns {{solvable: boolean, moves: Array|null, iterations: number, depth: number}}
 */
export function solve(bottles, maxIterations = 60000) {
    const queue = [];
    const visited = new Set();

    const initial = cloneBottles(bottles);
    visited.add(serializeState(initial));
    queue.push({ bottles: initial, moves: [] });

    let iterations = 0;
    let maxDepthExplored = 0;

    while (queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const { bottles: current, moves } = queue.shift();
        const currentDepth = moves.length;
        maxDepthExplored = Math.max(maxDepthExplored, currentDepth);

        if (isSolved(current)) {
            return {
                solvable: true,
                moves,
                iterations,
                depth: currentDepth
            };
        }

        const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;

        for (let i = 0; i < current.length; i++) {
            for (let j = 0; j < current.length; j++) {
                if (i === j) continue;

                // 剪枝1：禁止立即回退
                if (lastMove && lastMove.from === j && lastMove.to === i) continue;

                // 剪枝2：不倒出已完成的瓶子
                if (isCompletedBottle(current[i])) continue;

                if (!canPour(current[i], current[j])) continue;

                const next = cloneBottles(current);
                const pourResult = pour(next[i], next[j]);
                if (!pourResult) continue;

                const key = serializeState(next);
                if (visited.has(key)) continue;
                visited.add(key);

                queue.push({
                    bottles: next,
                    moves: [...moves, { from: i, to: j, color: pourResult.color, count: pourResult.count }]
                });
            }
        }
    }

    return {
        solvable: false,
        moves: null,
        iterations,
        depth: maxDepthExplored
    };
}

/**
 * 寻找下一步提示（基于BFS最短解的第一步）
 */
export function findNextMove(bottles) {
    const result = solve(bottles, 25000);
    if (result.solvable && result.moves.length > 0) {
        return result.moves[0];
    }
    return null;
}
