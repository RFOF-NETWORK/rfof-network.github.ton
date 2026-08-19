/**
 * RFOF-NETWORK — 32-Chapter Justice System
 * ─────────────────────────────────────────
 * Backend data structure representing the MTK-NEC Layer-7
 * 32-chapter international justice framework.
 *
 * Chapter 1  : GPCB  (Goldenphoenixcentralbank)
 * Chapter 2  : USA   (CM/ECF)
 * Chapter 3  : DE    (XJustiz, 30 Fachmodule)
 * Chapters 4–29: 26 EU member states
 * Chapter 30 : EU-Zentrale & e-CODEX (supranational umbrella)
 * Chapter 31 : System-Zone Alliierte Extra (AE)
 * Chapter 32 : Master-Schließung Layer 7 (MS)
 */

export const CHAPTERS = Object.freeze([
    {
        number: 1,
        code: 'GPCB',
        name: 'Goldenphoenixcentralbank',
        description: 'Zentrale Finanz- und Rechtsinstanz des RFOF-NETWORK',
        pillars: ['Währungsstabilität', 'Rechtskonformität', 'Systemintegrität',
            'Auditpflicht', 'Transparenz'],
        layer7Formation: 'USE & E.A.'
    },
    {
        number: 2,
        code: 'USA-CM-ECF',
        name: 'United States — CM/ECF',
        description: 'Case Management / Electronic Court Filing System der US-Bundesgerichte',
        pillars: ['Federal Rules', 'PACER Integration', 'Electronic Filing',
            'Case Tracking', 'Docket Management'],
        layer7Formation: null
    },
    {
        number: 3,
        code: 'DE-XJUSTIZ',
        name: 'Deutschland — XJustiz',
        description: 'Elektronischer Rechtsverkehr Deutschland mit 30 Fachmodulen',
        modules: Array.from({ length: 30 }, (_, i) => `Fachmodul-${String(i + 1).padStart(2, '0')}`),
        pillars: ['EGVP', 'beA', 'eBO', 'E-Akte', 'XJustiz-Standard'],
        layer7Formation: null
    },
    { number: 4,  code: 'FR', name: 'Frankreich',   description: 'Cour de cassation & e-Justice France',   pillars: [], layer7Formation: null },
    { number: 5,  code: 'IT', name: 'Italien',       description: 'Processo Civile Telematico (PCT)',        pillars: [], layer7Formation: null },
    { number: 6,  code: 'NL', name: 'Niederlande',   description: 'Rechtbank Digital / KEI',                pillars: [], layer7Formation: null },
    { number: 7,  code: 'BE', name: 'Belgien',        description: 'Just-On-Web & E-Deposit',               pillars: [], layer7Formation: null },
    { number: 8,  code: 'LU', name: 'Luxemburg',      description: 'Elektronischer Rechtsverkehr LU',       pillars: [], layer7Formation: null },
    { number: 9,  code: 'AT', name: 'Österreich',     description: 'ERV Austria / e-Justice AT',            pillars: [], layer7Formation: null },
    { number: 10, code: 'ES', name: 'Spanien',        description: 'Lexnet & e-Justice Spain',              pillars: [], layer7Formation: null },
    { number: 11, code: 'PT', name: 'Portugal',       description: 'CITIUS Portugal',                       pillars: [], layer7Formation: null },
    { number: 12, code: 'IE', name: 'Irland',         description: 'eCourts Ireland',                       pillars: [], layer7Formation: null },
    { number: 13, code: 'DK', name: 'Dänemark',       description: 'Digital Fogedretten DK',                pillars: [], layer7Formation: null },
    { number: 14, code: 'SE', name: 'Schweden',       description: 'Domstolsverket Digital SE',             pillars: [], layer7Formation: null },
    { number: 15, code: 'FI', name: 'Finnland',       description: 'Oikeushallinto Verkkopalvelu FI',       pillars: [], layer7Formation: null },
    { number: 16, code: 'GR', name: 'Griechenland',   description: 'e-Δικαιοσύνη GR',                      pillars: [], layer7Formation: null },
    { number: 17, code: 'PL', name: 'Polen',          description: 'Portal Informacyjny Sądów PL',          pillars: [], layer7Formation: null },
    { number: 18, code: 'CZ', name: 'Tschechien',     description: 'InfoSoud CZ',                           pillars: [], layer7Formation: null },
    { number: 19, code: 'HU', name: 'Ungarn',         description: 'E-Ügyintézés HU',                      pillars: [], layer7Formation: null },
    { number: 20, code: 'SK', name: 'Slowakei',       description: 'E-Súdnictvo SK',                       pillars: [], layer7Formation: null },
    { number: 21, code: 'SI', name: 'Slowenien',      description: 'E-Sodstvo SI',                         pillars: [], layer7Formation: null },
    { number: 22, code: 'HR', name: 'Kroatien',       description: 'E-Pravosuđe HR',                       pillars: [], layer7Formation: null },
    { number: 23, code: 'BG', name: 'Bulgarien',      description: 'E-Justice BG',                         pillars: [], layer7Formation: null },
    { number: 24, code: 'RO', name: 'Rumänien',       description: 'Portal Instanțe RO',                   pillars: [], layer7Formation: null },
    { number: 25, code: 'EE', name: 'Estland',        description: 'E-toimik / X-Road Justice EE',         pillars: [], layer7Formation: null },
    { number: 26, code: 'LV', name: 'Lettland',       description: 'Tiesu Informācijas Sistēma LV',        pillars: [], layer7Formation: null },
    { number: 27, code: 'LT', name: 'Litauen',        description: 'E. Pristatymas LT',                    pillars: [], layer7Formation: null },
    { number: 28, code: 'MT', name: 'Malta',          description: 'eJustice Malta',                       pillars: [], layer7Formation: null },
    { number: 29, code: 'CY', name: 'Zypern',         description: 'Ηλεκτρονική Δικαιοσύνη CY',           pillars: [], layer7Formation: null },
    {
        number: 30,
        code: 'EU-ECODEX',
        name: 'EU-Zentrale & e-CODEX',
        description: 'Supranationale Dachorganisation — e-CODEX Interoperabilitäts-Gateway',
        pillars: ['e-CODEX Gateway', 'e-Justice Portal', 'ECLI', 'OpenLaw EU', 'JudiciaryConnect'],
        layer7Formation: 'Supranational Umbrella'
    },
    {
        number: 31,
        code: 'AE',
        name: 'System-Zone Alliierte Extra',
        description: 'Erweiterter Allianz-Rechtszugang außerhalb der EU-Kernzone',
        pillars: ['Allianz-Recht', 'Extra-Territoriale Jurisdiktion',
            'Rechtshilfe', 'Kooperationsabkommen', 'Multilaterale Verträge'],
        layer7Formation: 'E.A.'
    },
    {
        number: 32,
        code: 'MS',
        name: 'Master-Schließung Layer 7',
        description: 'Abschluss-Formation des MTK-NEC Layer-7 Systems — konsolidiert alle 31 Kapitel',
        pillars: ['System-Integrität', 'Finale Validierung', 'Konsens-Mechanismus',
            'Kryptographische Versiegelung', '32. Formation USE & E.A.'],
        layer7Formation: 'MS — Master Seal'
    }
]);

/**
 * Returns a chapter by its 1-based number.
 *
 * @param {number} number  1–32
 * @returns {object|undefined}
 */
export function getChapter(number) {
    return CHAPTERS.find((c) => c.number === number);
}

/**
 * Returns a chapter by its code (e.g. 'DE-XJUSTIZ', 'MS').
 *
 * @param {string} code
 * @returns {object|undefined}
 */
export function getChapterByCode(code) {
    return CHAPTERS.find((c) => c.code === code);
}

/**
 * Returns all EU member-state chapters (4–29).
 *
 * @returns {object[]}
 */
export function getEUMemberChapters() {
    return CHAPTERS.filter((c) => c.number >= 4 && c.number <= 29);
}

/**
 * The 5 pillars of the 32-chapter system implementation.
 */
export const FIVE_PILLARS = Object.freeze([
    'Rechtsstaatlichkeit (Rule of Law)',
    'Technologische Interoperabilität',
    'Kryptographische Integrität',
    'Transparenz & Audit-Trail',
    'Supranationale Harmonisierung'
]);

/**
 * Summary statistics for the 32-chapter system.
 */
export function getSystemSummary() {
    return {
        totalChapters: CHAPTERS.length,
        euMemberStates: getEUMemberChapters().length,
        supranationalBodies: CHAPTERS.filter((c) => [1, 30, 31, 32].includes(c.number)).length,
        fivePillars: FIVE_PILLARS,
        finalFormation: '32. Formation — USE & E.A.'
    };
}
