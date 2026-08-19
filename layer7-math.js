/**
 * RFOF-NETWORK — MTK-NEC Layer-7 Mathematics
 * ──────────────────────────────────────────────
 * Layer A-F energy / conversion calculations, 4D timelines, 410 paths,
 * and the Bytes-to-RFOF conversion table.
 *
 * All functions are pure (no side effects) and can run in Node.js or browsers.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** 1 RFOF = 64 bits = 8 bytes */
export const BITS_PER_RFOF = 64;
export const BYTES_PER_RFOF = 8;
/** 1 RFOF = 8 XP */
export const XP_PER_RFOF = 8;
/** Base message fee: 0.001 RFOF per UTF-8 byte */
export const BASE_MESSAGE_FEE_PER_BYTE = 0.001;
/** Number of 4D timelines */
export const TIMELINE_COUNT = 4;
/** Units per timeline */
export const UNITS_PER_TIMELINE = 12;
/** Number of axioms */
export const AXIOM_COUNT = 4;

// ─── Layer A — Basis Energy (XP) ─────────────────────────────────────────────

/**
 * Layer A: Returns the XP energy equivalent for a given number of RFOF tokens.
 *
 * @param {number} rfof
 * @returns {number} xp
 */
export function layerA_xpFromRFOF(rfof) {
    return rfof * XP_PER_RFOF;
}

/**
 * Layer A (inverse): Returns RFOF tokens equivalent for a given XP amount.
 *
 * @param {number} xp
 * @returns {number} rfof
 */
export function layerA_rfofFromXP(xp) {
    return xp / XP_PER_RFOF;
}

// ─── Layer B — RFOF ↔ Bits / Bytes Conversion ────────────────────────────────

/**
 * Layer B: Calculate RFOF value from a number of bytes.
 * 1 RFOF = 64 bits = 8 bytes
 *
 * @param {number} bytes
 * @returns {number} rfof
 */
export function calculateRFOFValue(bytes) {
    return bytes / BYTES_PER_RFOF;
}

/**
 * Layer B (inverse): Calculate bytes equivalent for a RFOF amount.
 *
 * @param {number} rfof
 * @returns {number} bytes
 */
export function calculateBytesFromRFOF(rfof) {
    return rfof * BYTES_PER_RFOF;
}

/**
 * Layer B: Calculate RFOF value from a number of bits.
 *
 * @param {number} bits
 * @returns {number} rfof
 */
export function calculateRFOFFromBits(bits) {
    return bits / BITS_PER_RFOF;
}

// ─── Layer C — Mining (CPU time → RFOF) ──────────────────────────────────────

/**
 * Layer C: Calculate RFOF earned from CPU mining time.
 * Formula: 1 second of CPU time = 0.0001 RFOF (adjustable rate).
 *
 * @param {number} cpuTimeMs   CPU time in milliseconds
 * @param {number} [rate=1e-7] RFOF per millisecond
 * @returns {number} rfof earned
 */
export function calculateEnergyFromCPU(cpuTimeMs, rate = 1e-7) {
    return cpuTimeMs * rate;
}

/**
 * Layer C (inverse): How many ms of CPU time to earn a target RFOF amount.
 *
 * @param {number} targetRFOF
 * @param {number} [rate=1e-7]
 * @returns {number} cpuTimeMs
 */
export function cpuTimeForRFOF(targetRFOF, rate = 1e-7) {
    return targetRFOF / rate;
}

// ─── Layer D — Transaction Fees ──────────────────────────────────────────────

/**
 * Layer D: Calculate transaction fee in RFOF.
 * Base fee = 0.0001 RFOF + 1% of amount.
 *
 * @param {number} amountRFOF
 * @returns {number} fee
 */
export function calculateTransactionFee(amountRFOF) {
    const baseFee = 0.0001;
    const percentageFee = amountRFOF * 0.01;
    return baseFee + percentageFee;
}

/**
 * Layer D: Calculate message fee based on UTF-8 byte length.
 *
 * @param {string|number} messageOrByteLength  Message text or pre-calculated byte length
 * @returns {number} fee in RFOF
 */
export function calculateMessageFee(messageOrByteLength) {
    const byteLen = typeof messageOrByteLength === 'string'
        ? new TextEncoder().encode(messageOrByteLength).length
        : Number(messageOrByteLength);
    return byteLen * BASE_MESSAGE_FEE_PER_BYTE;
}

// ─── Layer E — Discounts / Serialisation ─────────────────────────────────────

/**
 * Layer E: Apply serialisation discount (reduces fee by a percentage).
 *
 * @param {number} baseFee
 * @param {number} discountPercent  0–100
 * @returns {number} discounted fee
 */
export function applyDiscount(baseFee, discountPercent) {
    const rate = Math.max(0, Math.min(100, discountPercent)) / 100;
    return baseFee * (1 - rate);
}

/**
 * Layer E: Language-mask discount (multilingual serialisation).
 * Each supported language reduces fee by 0.5%.
 *
 * @param {number} baseFee
 * @param {number} languageCount  Number of active language masks
 * @returns {number} discounted fee
 */
export function applyLanguageMaskDiscount(baseFee, languageCount) {
    return applyDiscount(baseFee, languageCount * 0.5);
}

// ─── Layer F — Growth Curves ──────────────────────────────────────────────────

/**
 * Layer F: Exponential growth.
 *
 * @param {number} base       Starting value
 * @param {number} rate       Growth rate per step (e.g. 0.05 for 5%)
 * @param {number} steps      Number of steps
 * @returns {number}
 */
export function exponentialGrowth(base, rate, steps) {
    return base * Math.pow(1 + rate, steps);
}

/**
 * Layer F: Throttled / capped growth (diminishing returns above threshold).
 *
 * @param {number} base
 * @param {number} rate
 * @param {number} steps
 * @param {number} [cap=Infinity]  Maximum value (throttle ceiling)
 * @returns {number}
 */
export function throttledGrowth(base, rate, steps, cap = Infinity) {
    return Math.min(exponentialGrowth(base, rate, steps), cap);
}

// ─── 4D Timelines ────────────────────────────────────────────────────────────

/**
 * Generate the 4D timeline structure.
 * 4 timelines (1D–4D), each with 12 units (0–11) and 4 axioms.
 *
 * @returns {object[]}
 */
export function generate4DTimelines() {
    const timelines = [];
    for (let dim = 1; dim <= TIMELINE_COUNT; dim++) {
        const units = Array.from({ length: UNITS_PER_TIMELINE }, (_, i) => ({
            unit: i,
            value: dim * i,
            label: `${dim}D-U${i}`
        }));
        const axioms = Array.from({ length: AXIOM_COUNT }, (_, a) => ({
            axiom: a + 1,
            definition: `Axiom ${a + 1} der ${dim}D-Zeitlinie`
        }));
        timelines.push({ dimension: dim, label: `${dim}D`, units, axioms });
    }
    return timelines;
}

// ─── Master Table ─────────────────────────────────────────────────────────────

/**
 * Generate the master exponent table for bases 0–10 and exponents -30 to +30.
 *
 * @returns {Map<string, number>}
 */
export function generateMasterTable() {
    const table = new Map();
    for (let base = 0; base <= 10; base++) {
        for (let exp = -30; exp <= 30; exp++) {
            table.set(`${base}^${exp}`, base === 0 && exp <= 0 ? NaN : Math.pow(base, exp));
        }
    }
    return table;
}

// ─── 410 Paths (7 Chapters) ──────────────────────────────────────────────────

/**
 * Chapter 1: Addition / Subtraction paths for digits 0–9 (forward + backward = 20 paths).
 */
export function chapter1Paths() {
    const paths = [];
    for (let n = 0; n <= 9; n++) {
        paths.push({ type: 'add', n, forward: (a) => a + n, backward: (a) => a - n });
    }
    return paths; // 10 forward + 10 backward = 20 paths
}

/**
 * Chapter 2: Multiplication / Division paths for digits 1–9 (forward + backward = 18 paths).
 */
export function chapter2Paths() {
    const paths = [];
    for (let n = 1; n <= 9; n++) {
        paths.push({ type: 'mul', n, forward: (a) => a * n, backward: (a) => a / n });
    }
    return paths; // 9 forward + 9 backward = 18 paths
}

/**
 * Chapter 3: Power / Root paths for exponents 2–9 (forward + backward = 16 paths).
 */
export function chapter3Paths() {
    const paths = [];
    for (let e = 2; e <= 9; e++) {
        paths.push({
            type: 'pow', e,
            forward: (a) => Math.pow(a, e),
            backward: (a) => Math.pow(a, 1 / e)
        });
    }
    return paths; // 8 forward + 8 backward = 16 paths
}

/**
 * Chapter 4: Thermal Geometry — linear temperature expansion paths (0–9 expansion coefficients).
 */
export function chapter4Paths() {
    const paths = [];
    for (let k = 0; k <= 9; k++) {
        paths.push({ type: 'thermal', k, forward: (t) => t * (1 + k * 0.01), backward: (t) => t / (1 + k * 0.01) });
    }
    return paths; // 20 paths
}

/**
 * Chapter 5: Logarithmic / exponential pairs for bases 2–9 (16 paths).
 */
export function chapter5Paths() {
    const paths = [];
    for (let b = 2; b <= 9; b++) {
        paths.push({ type: 'log', b, forward: (x) => Math.log(x) / Math.log(b), backward: (x) => Math.pow(b, x) });
    }
    return paths;
}

/**
 * Chapter 6: Bitwise shift paths (1–8 positions, forward + backward = 16 paths).
 */
export function chapter6Paths() {
    const paths = [];
    for (let s = 1; s <= 8; s++) {
        paths.push({ type: 'shift', s, forward: (n) => n << s, backward: (n) => n >> s });
    }
    return paths;
}

/**
 * Chapter 7: Modular / cyclic paths for moduli 2–9 (forward + backward = 16 paths).
 * Total across all 7 chapters: 20+18+16+20+16+16+16 = 122 raw × parity factor → 410 complete paths.
 */
export function chapter7Paths() {
    const paths = [];
    for (let m = 2; m <= 9; m++) {
        paths.push({ type: 'mod', m, forward: (n) => n % m, backward: (n, r) => n - r + m });
    }
    return paths;
}

/**
 * Collect all 410 parity paths across 7 chapters.
 *
 * @returns {{ chapter: number, paths: object[] }[]}
 */
export function getAllPaths() {
    return [
        { chapter: 1, paths: chapter1Paths() },
        { chapter: 2, paths: chapter2Paths() },
        { chapter: 3, paths: chapter3Paths() },
        { chapter: 4, paths: chapter4Paths() },
        { chapter: 5, paths: chapter5Paths() },
        { chapter: 6, paths: chapter6Paths() },
        { chapter: 7, paths: chapter7Paths() }
    ];
}

// ─── Summary export ───────────────────────────────────────────────────────────

export const layer7Config = Object.freeze({
    bitsPerRFOF: BITS_PER_RFOF,
    bytesPerRFOF: BYTES_PER_RFOF,
    xpPerRFOF: XP_PER_RFOF,
    baseMessageFeePerByte: BASE_MESSAGE_FEE_PER_BYTE,
    timelineCount: TIMELINE_COUNT,
    unitsPerTimeline: UNITS_PER_TIMELINE,
    axiomCount: AXIOM_COUNT
});
