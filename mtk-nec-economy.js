/**
 * RFOF-NETWORK — MTK-NEC Layer-7 Economy Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements the full MTK/NEC/MTK currency system as described in the
 * handwritten design notes:
 *
 *  • 6 Layers (A–F) with distinct growth / throttle rules
 *  • 4D Timelines (1D–4D) with 12 time-units each and 4 speeds
 *  • 4 Directions (A↔C, B↔D) with 1 % transfer fee
 *  • NEC-2D Discount engine:
 *      – Dice (Würfel): 1–6 → 50 % ± (roll × 5 %)
 *      – Rock-Paper-Scissors (Schnick-Schnack-Schnuck): points → discount
 *      – Point-category table
 *  • 5 Printable Sheets (Angebote, Gesuche, Werte-Logik, Vertrag, Extern)
 *  • Perpetual Escrow / Arbitrage system
 *  • 30K Axiom (29.9K pre-comma + 1.1K post-comma)
 *  • SI prefix table (Quecto … Quetta, 10^-30 … 10^+30)
 *  • Price-Vector axiom (value speed in a timeline unit)
 *  • Binary ↔ Decimal ↔ MTK/NEC conversion helpers
 *
 * All functions are pure and side-effect-free.
 */

// ─── SI Prefix Table (Exponents -30 … +30) ───────────────────────────────────

/**
 * SI prefix definitions covering 10^-30 to 10^+30.
 * Each entry: { exp, symbol, name, value }
 */
export const SI_PREFIXES = Object.freeze([
    { exp: -30, symbol: 'q',  name: 'Quecto',  value: 1e-30 },
    { exp: -27, symbol: 'r',  name: 'Ronto',   value: 1e-27 },
    { exp: -24, symbol: 'y',  name: 'Yocto',   value: 1e-24 },
    { exp: -21, symbol: 'z',  name: 'Zepto',   value: 1e-21 },
    { exp: -18, symbol: 'a',  name: 'Atto',    value: 1e-18 },
    { exp: -15, symbol: 'f',  name: 'Femto',   value: 1e-15 },
    { exp: -12, symbol: 'p',  name: 'Piko',    value: 1e-12 },
    { exp:  -9, symbol: 'n',  name: 'Nano',    value: 1e-9  },
    { exp:  -6, symbol: 'μ',  name: 'Mikro',   value: 1e-6  },
    { exp:  -3, symbol: 'm',  name: 'Milli',   value: 1e-3  },
    { exp:  -2, symbol: 'c',  name: 'Zenti',   value: 1e-2  },
    { exp:  -1, symbol: 'd',  name: 'Dezi',    value: 1e-1  },
    { exp:   0, symbol: '',   name: '(Basis)',  value: 1     },
    { exp:   3, symbol: 'k',  name: 'Kilo',    value: 1e3   },
    { exp:   6, symbol: 'M',  name: 'Mega',    value: 1e6   },
    { exp:   9, symbol: 'G',  name: 'Giga',    value: 1e9   },
    { exp:  12, symbol: 'T',  name: 'Tera',    value: 1e12  },
    { exp:  15, symbol: 'P',  name: 'Peta',    value: 1e15  },
    { exp:  18, symbol: 'E',  name: 'Exa',     value: 1e18  },
    { exp:  21, symbol: 'Z',  name: 'Zetta',   value: 1e21  },
    { exp:  24, symbol: 'Y',  name: 'Yotta',   value: 1e24  },
    { exp:  27, symbol: 'R',  name: 'Ronna',   value: 1e27  },
    { exp:  30, symbol: 'Q',  name: 'Quetta',  value: 1e30  },
]);

/**
 * Return the SI prefix entry closest to a given exponent.
 *
 * @param {number} exp  Integer exponent of 10
 * @returns {{ exp, symbol, name, value }}
 */
export function siPrefixForExp(exp) {
    return SI_PREFIXES.reduce((best, p) =>
        Math.abs(p.exp - exp) < Math.abs(best.exp - exp) ? p : best
    );
}

// ─── Timeline Speed Multipliers ───────────────────────────────────────────────

/**
 * Speed multipliers for each dimension:
 *   1D (Familie) = slow   (×0.5)
 *   2D (System)  = medium (×1.0)
 *   3D (Nutzer)  = fast   (×2.0)
 *   4D (Gesamt)  = all simultaneously (×[0.5, 1, 2] → sum)
 */
export const TIMELINE_SPEED = Object.freeze({
    '1D': 0.5,
    '2D': 1.0,
    '3D': 2.0,
    '4D': null,   // 4D is simultaneous across all three; use timeline4DValue()
});

/** 12 canonical time-unit labels (matches the handwritten table). */
export const TIME_UNITS = Object.freeze([
    'Sekunde', 'Minute', 'Stunde', 'Tag',
    'Woche', 'Monat', 'Jahr', 'Jahrzehnt',
    'Jahrhundert', 'Jahrtausend',
    'Mega-Jahr', 'Giga-Jahr',
]);

/**
 * Apply a timeline speed multiplier to a base value.
 *
 * @param {number} baseValue
 * @param {'1D'|'2D'|'3D'} dimension
 * @returns {number}
 */
export function timelineValue(baseValue, dimension) {
    const speed = TIMELINE_SPEED[dimension];
    if (speed === null) {
        throw new TypeError('Use timeline4DValue() for 4D (simultaneous).');
    }
    return baseValue * speed;
}

/**
 * 4D value: returns the simultaneous result as an array [1D, 2D, 3D].
 *
 * @param {number} baseValue
 * @returns {{ '1D': number, '2D': number, '3D': number }}
 */
export function timeline4DValue(baseValue) {
    return {
        '1D': timelineValue(baseValue, '1D'),
        '2D': timelineValue(baseValue, '2D'),
        '3D': timelineValue(baseValue, '3D'),
    };
}

// ─── 30K Axiom ────────────────────────────────────────────────────────────────

/**
 * Axiom 2 — 30K rule:
 *   30,000 units = 29,900 (before comma, integer) + 1,100 (after comma, fractional).
 *
 * @param {number} totalUnits  Any amount
 * @returns {{ integer: number, fractional: number, total: number }}
 */
export function apply30KAxiom(totalUnits) {
    const RATIO_INTEGER    = 29900 / 30000; // ≈ 0.9967
    const RATIO_FRACTIONAL =   100 / 30000; // ≈ 0.0033  (29900 + 100 = 30000)
    const integer    = totalUnits * RATIO_INTEGER;
    const fractional = totalUnits * RATIO_FRACTIONAL;
    return { integer, fractional, total: integer + fractional };
}

// ─── Price Vector (Axiom 1) ───────────────────────────────────────────────────

/**
 * Axiom 1 — Price is the speed of value increase in one time unit.
 *
 * price = valueAtEnd / valueAtStart  (rate per step)
 *
 * @param {number} valueStart
 * @param {number} valueEnd
 * @returns {number} price-vector (ratio)
 */
export function priceVector(valueStart, valueEnd) {
    if (valueStart === 0) return Infinity;
    return valueEnd / valueStart;
}

// ─── 6 Layers (A–F) ──────────────────────────────────────────────────────────

/**
 * Layer A (3D – Nutzer): Basis-MTK, exponentielles Wachstum ×2 per step.
 *
 * @param {number} mtk
 * @param {number} [steps=1]
 * @returns {number}
 */
export function layerA_mtkGrowth(mtk, steps = 1) {
    return mtk * Math.pow(2, steps);
}

/**
 * Layer B (1D – Familie): Spiegel-MTK, 50 % gedrosselt vs Layer A.
 *
 * @param {number} mtk
 * @param {number} [steps=1]
 * @returns {number}
 */
export function layerB_mirrorMTK(mtk, steps = 1) {
    return layerA_mtkGrowth(mtk, steps) * 0.5;
}

/**
 * Layer C (2D – System): NEC-2D-Rabatt — see necDiscountDice() / necDiscountRPS().
 * Returns the discounted price given a base price and discount percent.
 *
 * @param {number} basePrice
 * @param {number} discountPercent  0–70 %
 * @returns {number}
 */
export function layerC_necDiscount(basePrice, discountPercent) {
    const d = Math.max(0, Math.min(70, discountPercent)) / 100;
    return basePrice * (1 - d);
}

/**
 * Layer D (2D – System): NEC-Serial — Papier-ID + digitale NFT-Referenz.
 * Returns a serial object: { paperId, nftRef, combined }
 *
 * @param {number|bigint} numericId
 * @param {string}        nftRef     e.g. "ipfs://Qm..."
 * @returns {{ paperId: string, nftRef: string, combined: string }}
 */
export function layerD_necSerial(numericId, nftRef) {
    const paperId = `NEC-${String(numericId).padStart(10, '0')}`;
    const combined = `${paperId}::${nftRef}`;
    return { paperId, nftRef, combined };
}

/**
 * Layer E (2D – System): MTK-als-NEC-Maske — intern MTK, extern NEC.
 * Returns the external NEC display value for an internal MTK amount.
 *
 * @param {number} mtkInternal
 * @param {number} [maskRate=1]  External NEC units per MTK (default 1:1)
 * @returns {{ internal: number, externalNEC: number, mask: string }}
 */
export function layerE_mtkNECMask(mtkInternal, maskRate = 1) {
    const externalNEC = mtkInternal * maskRate;
    return {
        internal: mtkInternal,
        externalNEC,
        mask: `NEC ${externalNEC.toFixed(4)}`,
    };
}

/**
 * Layer F (1D – Familie): Normalos-Layer, ultra-gedrosselt — nochmal 50 % of Layer B.
 *
 * @param {number} mtk
 * @param {number} [steps=1]
 * @returns {number}
 */
export function layerF_normalosMTK(mtk, steps = 1) {
    return layerB_mirrorMTK(mtk, steps) * 0.5;
}

// ─── NEC-2D Discount Engine ───────────────────────────────────────────────────

/**
 * NEC discount via Würfel (dice).
 *
 * Rule: roll 1 d6 → discount = 50 % ± (roll × 5 %)
 *   roll 1 → 45 %
 *   roll 6 → 80 %  (capped at 70 % per Layer-C maximum)
 *
 * @param {number} roll  Integer 1–6 (or provide null to auto-roll via Math.random)
 * @returns {{ roll: number, rawPercent: number, clampedPercent: number }}
 */
export function necDiscountDice(roll = null) {
    const r = roll !== null
        ? Math.max(1, Math.min(6, Math.round(roll)))
        : Math.ceil(Math.random() * 6);
    // Formula: 50 % + (roll × 5 %), max capped at 70 % (Layer-C maximum)
    const rawPercent = 50 + r * 5;   // roll=1→55 %, roll=6→80 %
    const clamped = Math.min(70, rawPercent);
    return { roll: r, rawPercent, clampedPercent: clamped };
}

/**
 * NEC discount via Rock-Paper-Scissors (Schnick-Schnack-Schnuck).
 *
 * 3 rounds, each round:
 *   win  = 3 points, draw = 2 points, loss = 1 point
 * Total 3–9 points → category:
 *   3–4 → 10 %  (almost always lost)
 *   5   → 20 %
 *   6   → 30 %
 *   7   → 40 %
 *   8   → 50 %
 *   9   → 60 %
 *
 * @param {Array<'win'|'draw'|'loss'>} results  Array of 3 round outcomes
 * @returns {{ totalPoints: number, discountPercent: number }}
 */
export function necDiscountRPS(results) {
    if (!Array.isArray(results) || results.length !== 3) {
        throw new TypeError('results must be an array of exactly 3 outcomes.');
    }
    const pointMap = { win: 3, draw: 2, loss: 1 };
    const total = results.reduce((sum, r) => {
        const p = pointMap[r];
        if (p === undefined) throw new TypeError(`Invalid outcome: "${r}"`);
        return sum + p;
    }, 0);
    const discountTable = { 3: 10, 4: 10, 5: 20, 6: 30, 7: 40, 8: 50, 9: 60 };
    return { totalPoints: total, discountPercent: discountTable[total] ?? 10 };
}

/**
 * NEC discount via multi-round point accumulation (extended RPS).
 * For arbitrary rounds: sum all points, then bucket:
 *   1–5 → 10 %, 6–10 → 20 %, 11–15 → 30 %, 16–20 → 40 %, 21–25 → 50 %,
 *   26–30 → 60 %, 31+ → 70 %
 *
 * @param {number} totalPoints
 * @returns {number} discountPercent
 */
export function necDiscountPoints(totalPoints) {
    if (totalPoints <= 5)  return 10;
    if (totalPoints <= 10) return 20;
    if (totalPoints <= 15) return 30;
    if (totalPoints <= 20) return 40;
    if (totalPoints <= 25) return 50;
    if (totalPoints <= 30) return 60;
    return 70;
}

// ─── 4 Directions (Transfer Fees) ────────────────────────────────────────────

/** Transfer fee rate: 1 % of amount. */
export const TRANSFER_FEE_RATE = 0.01;

/**
 * Apply a 4-direction transfer fee.
 *
 * @param {number} amount
 * @returns {{ net: number, fee: number }}
 */
export function applyTransferFee(amount) {
    const fee = amount * TRANSFER_FEE_RATE;
    return { net: amount - fee, fee };
}

/**
 * Direction A→C (MTK → NEC, 3D → 2D): MTK is cheaper from outside.
 *
 * @param {number} mtkAmount
 * @param {number} discountPercent  0–50 %
 * @returns {{ necAmount: number, fee: number, discount: number }}
 */
export function directionAtoC(mtkAmount, discountPercent = 0) {
    const d = Math.max(0, Math.min(50, discountPercent)) / 100;
    const discounted = mtkAmount * (1 - d);
    const { net, fee } = applyTransferFee(discounted);
    return { necAmount: net, fee, discount: discounted - net };
}

/**
 * Direction C→A (NEC → MTK, 2D → 3D): NEC is more expensive / cheaper internally.
 *
 * @param {number} necAmount
 * @param {number} discountPercent  0–50 %
 * @returns {{ mtkAmount: number, fee: number }}
 */
export function directionCtoA(necAmount, discountPercent = 0) {
    const d = Math.max(0, Math.min(50, discountPercent)) / 100;
    const adjusted = necAmount * (1 + d);   // NEC costs more → higher MTK
    const { net, fee } = applyTransferFee(adjusted);
    return { mtkAmount: net, fee };
}

/**
 * Direction B→D (Spiegel-MTK → NEC, 1D → 2D).
 *
 * @param {number} mirrorMTK
 * @param {number} discountPercent  0–50 %
 * @returns {{ necAmount: number, fee: number }}
 */
export function directionBtoD(mirrorMTK, discountPercent = 0) {
    const d = Math.max(0, Math.min(50, discountPercent)) / 100;
    const discounted = mirrorMTK * (1 - d);
    const { net, fee } = applyTransferFee(discounted);
    return { necAmount: net, fee };
}

/**
 * Direction D→B (NEC → Spiegel-MTK, 2D → 1D).
 *
 * @param {number} necAmount
 * @param {number} discountPercent  0–50 %
 * @returns {{ mirrorMTK: number, fee: number }}
 */
export function directionDtoB(necAmount, discountPercent = 0) {
    const d = Math.max(0, Math.min(50, discountPercent)) / 100;
    const adjusted = necAmount * (1 - d);
    const { net, fee } = applyTransferFee(adjusted);
    return { mirrorMTK: net, fee };
}

// ─── Perpetual Escrow / Arbitrage System ─────────────────────────────────────

/**
 * Perpetual Escrow entry.
 * Locks an amount and records the direction, discount and timeline.
 *
 * @param {number}           amount
 * @param {'A→C'|'C→A'|'B→D'|'D→B'} direction
 * @param {number}           discountPercent
 * @param {'1D'|'2D'|'3D'}  timeline
 * @returns {{ lockedAmount: number, fee: number, releasedAmount: number,
 *             direction: string, discount: number, timeline: string }}
 */
export function perpetualEscrow(amount, direction, discountPercent, timeline) {
    let result;
    switch (direction) {
        case 'A→C': result = directionAtoC(amount, discountPercent); break;
        case 'C→A': result = directionCtoA(amount, discountPercent); break;
        case 'B→D': result = directionBtoD(amount, discountPercent); break;
        case 'D→B': result = directionDtoB(amount, discountPercent); break;
        default: throw new TypeError(`Unknown direction: "${direction}"`);
    }
    const released = result.necAmount ?? result.mtkAmount ?? result.mirrorMTK;
    const timelineMultiplier = TIMELINE_SPEED[timeline] ?? 1;
    return {
        lockedAmount: amount,
        fee: result.fee,
        releasedAmount: released * timelineMultiplier,
        direction,
        discount: discountPercent,
        timeline,
    };
}

// ─── Binary ↔ Decimal ↔ MTK/NEC Conversion ───────────────────────────────────

/**
 * Convert a decimal number to its binary string representation.
 *
 * @param {number} decimal
 * @returns {string}
 */
export function decimalToBinary(decimal) {
    return (decimal >>> 0).toString(2);
}

/**
 * Convert a binary string to a decimal number.
 *
 * @param {string} binary
 * @returns {number}
 */
export function binaryToDecimal(binary) {
    return parseInt(binary, 2);
}

/**
 * Express an MTK amount as MTK and NEC equivalents in both decimal and binary.
 *
 * @param {number} mtkAmount
 * @param {number} [necRate=1]  NEC per MTK
 * @returns {{ mtk: number, nec: number, mtkBinary: string, necBinary: string }}
 */
export function mtkNecRepresentation(mtkAmount, necRate = 1) {
    const nec = mtkAmount * necRate;
    return {
        mtk: mtkAmount,
        nec,
        mtkBinary: decimalToBinary(Math.floor(mtkAmount)),
        necBinary: decimalToBinary(Math.floor(nec)),
    };
}

// ─── 5 Printable Sheets ───────────────────────────────────────────────────────

/**
 * Sheet 1 — Angebote (Eigener Flohmarkt / own flea market).
 * Build a list of offer items with MTK price, mirror-MTK price, and NEC discount.
 *
 * @param {Array<{ name: string, mtkPrice: number }>} items
 * @param {number} [discountPercent=0]  Optional NEC discount for all items
 * @returns {Array<{ name, mtkPrice, mirrorMtkPrice, necDiscountPrice }>}
 */
export function sheet1Angebote(items, discountPercent = 0) {
    return items.map(({ name, mtkPrice }) => ({
        name,
        mtkPrice,
        mirrorMtkPrice: layerB_mirrorMTK(mtkPrice, 0),   // ×2^0 × 0.5 = 0.5×
        necDiscountPrice: layerC_necDiscount(mtkPrice, discountPercent),
    }));
}

// Note: layerB_mirrorMTK with steps=0 → ×2^0 × 0.5 = 0.5. That's the 50% throttle.

/**
 * Sheet 2 — Gesuche (Fremder Flohmarkt / others' flea market).
 * Same structure but from the counterparty perspective (swaps buyer/seller logic).
 *
 * @param {Array<{ name: string, mtkPrice: number }>} items
 * @param {number} [discountPercent=0]
 * @returns {Array<{ name, askedMtkPrice, counterMirrorPrice, necDiscountPrice }>}
 */
export function sheet2Gesuche(items, discountPercent = 0) {
    return items.map(({ name, mtkPrice }) => ({
        name,
        askedMtkPrice: mtkPrice,
        counterMirrorPrice: layerB_mirrorMTK(mtkPrice, 0),
        necDiscountPrice: layerC_necDiscount(mtkPrice, discountPercent),
    }));
}

/**
 * Sheet 3 — Werte-Logik (Central value logic).
 * Returns all formulas for all 6 layers applied to a given base MTK value.
 *
 * @param {number} baseMTK
 * @param {number} [steps=1]
 * @param {number} [discountPercent=0]
 * @param {string} [nftRef='']
 * @returns {object}
 */
export function sheet3WertLogik(baseMTK, steps = 1, discountPercent = 0, nftRef = '') {
    return {
        layerA_exponential:  layerA_mtkGrowth(baseMTK, steps),
        layerB_mirror:       layerB_mirrorMTK(baseMTK, steps),
        layerC_necDiscount:  layerC_necDiscount(baseMTK, discountPercent),
        layerD_serial:       layerD_necSerial(Math.floor(baseMTK * 1000), nftRef || `nft:${baseMTK}`),
        layerE_mask:         layerE_mtkNECMask(baseMTK),
        layerF_normalos:     layerF_normalosMTK(baseMTK, steps),
    };
}

/**
 * Sheet 4 — Vertrag (Universal contract).
 * Returns a printable contract object for a transaction.
 *
 * @param {object} params
 * @param {string}  params.seller
 * @param {string}  params.buyer
 * @param {string}  params.item
 * @param {number}  params.mtkAmount
 * @param {number}  [params.discountPercent=0]
 * @param {string}  [params.necSerialRef='']
 * @param {string}  [params.direction='A→C']
 * @param {string}  [params.timeline='3D']
 * @returns {object}  Contract record
 */
export function sheet4Vertrag({
    seller, buyer, item, mtkAmount,
    discountPercent = 0, necSerialRef = '', direction = 'A→C', timeline = '3D',
}) {
    const escrow = perpetualEscrow(mtkAmount, direction, discountPercent, timeline);
    const serial = layerD_necSerial(Math.floor(mtkAmount * 1000), necSerialRef || `ref:${item}`);
    return {
        contractType: 'MTK-NEC-UNIVERSAL',
        seller,
        buyer,
        item,
        mtkAmount,
        discountPercent,
        serial: serial.combined,
        direction,
        timeline,
        lockedAmount:   escrow.lockedAmount,
        fee:            escrow.fee,
        releasedAmount: escrow.releasedAmount,
        issuedAt:       new Date().toISOString(),
        status: 'PENDING_SIGNATURE',
    };
}

/**
 * Sheet 5 — Extern (NEC discount list + serial table + language mask + normalos list).
 *
 * @param {Array<{ name: string, mtkPrice: number, serialRef: string }>} items
 * @param {number} [discountPercent=0]
 * @returns {object}
 */
export function sheet5Extern(items, discountPercent = 0) {
    return {
        necDiscountList: items.map(({ name, mtkPrice }) => ({
            name,
            originalMTK: mtkPrice,
            discountedNEC: layerC_necDiscount(mtkPrice, discountPercent),
            discountPercent,
        })),
        serialTable: items.map(({ name, mtkPrice, serialRef = '' }) => ({
            name,
            serial: layerD_necSerial(Math.floor(mtkPrice * 1000), serialRef || `ext:${name}`),
        })),
        languageMask: items.map(({ name, mtkPrice }) => ({
            name,
            ...layerE_mtkNECMask(mtkPrice),
        })),
        normalosList: items.map(({ name, mtkPrice }) => ({
            name,
            normalosMTK: layerF_normalosMTK(mtkPrice, 0),
        })),
    };
}

// ─── Axiom 4 — Infinite 50 % Variation Paths ─────────────────────────────────

/**
 * Axiom 4: After all mathematical paths are exhausted, generate a new random
 * variation between 0 % and 50 %.
 *
 * @returns {number}  Random discount in [0, 50]
 */
export function axiom4RandomVariation() {
    return Math.random() * 50;
}

// ─── Parallel BIP (Axiom 3) ───────────────────────────────────────────────────

/**
 * Axiom 3 — Each timeline has its own GDP/BIP value.
 *
 * @param {number} globalBIP
 * @returns {{ '1D': number, '2D': number, '3D': number, '4D': object }}
 */
export function parallelBIP(globalBIP) {
    return {
        '1D': timelineValue(globalBIP, '1D'),
        '2D': timelineValue(globalBIP, '2D'),
        '3D': timelineValue(globalBIP, '3D'),
        '4D': timeline4DValue(globalBIP),
    };
}

// ─── Summary config export ────────────────────────────────────────────────────

export const mtkNecConfig = Object.freeze({
    transferFeeRate:    TRANSFER_FEE_RATE,
    maxDiceDiscount:    70,
    maxRPSDiscount:     60,
    maxDirectionDiscount: 50,
    layerCount:         6,
    directionCount:     4,
    sheetCount:         5,
    axiomCount:         4,
    timelineCount:      4,
    timeUnitCount:      TIME_UNITS.length,
    siPrefixCount:      SI_PREFIXES.length,
});
