/**
 * ai-chat.js – RFOF-NETWORK SPARK AI Chat
 *
 * Floating chat widget with the SPARK tokenizer (JS port of char_tokenizer.py)
 * and a rule-based context-aware LLM – no external API, fully internal.
 *
 * Features:
 *  • SPARK character-level tokenizer (mirrors char_tokenizer.py)
 *  • Context-aware rule engine with RFOF knowledge base
 *  • Floating widget (bottom-right, 350 × 500px, responsive)
 *  • localStorage history (key: chat_history_<username>)
 *  • Typing indicator
 *  • Emoji, link and code-block rendering
 *  • clearChatHistory() – call on logout
 */

// ─── SPARK Tokenizer ─────────────────────────────────────────────────────────

export class SparkTokenizer {
    constructor() {
        const chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ' +
            'abcdefghijklmnopqrstuvwxyzäöüß' +
            '0123456789' +
            ' .,!?-_:;()[]{}\'"/\\@#$%&*+=<>\n\t€£¥';
        this.tokenToId = { '<UNK>': 0 };
        this.idToToken = { 0: '<UNK>' };
        [...new Set([...chars])].sort().forEach((ch, i) => {
            this.tokenToId[ch] = i + 1;
            this.idToToken[i + 1] = ch;
        });
        this.vocabSize = Object.keys(this.tokenToId).length;
    }

    encode(text) {
        return [...String(text)].map((ch) => this.tokenToId[ch] ?? 0);
    }

    decode(ids) {
        return ids.map((id) => this.idToToken[id] ?? '').join('');
    }

    tokenCount(text) {
        return this.encode(text).length;
    }

    /** Normalise text for pattern matching: lowercase, trim, collapse whitespace */
    normalise(text) {
        return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
    }
}

// ─── Context Accessor ─────────────────────────────────────────────────────────

function getWalletContext() {
    // Reads state exposed by wallet-core.js via window.rfofGetWalletContext()
    if (typeof window.rfofGetWalletContext === 'function') {
        return window.rfofGetWalletContext();
    }
    return null;
}

function getCurrentSession() {
    try {
        const raw = sessionStorage.getItem('rfof_auth_session_v1');
        if (!raw) { return null; }
        const session = JSON.parse(raw);
        return session ?? null;
    } catch (_) {
        return null;
    }
}

// ─── RFOF Knowledge Base ──────────────────────────────────────────────────────

function buildResponse(normInput, ctx) {
    const w = ctx?.wallet;
    const session = ctx?.session;
    const username = session?.username ?? 'Nutzer';
    const isAdmin = username === 'RFOF-NETWORK';
    const prices = w?.prices ?? {};
    const balances = w?.balances ?? {};
    const interactions = w?.interactions ?? 0;
    const poolSize = w?.liquidityPool ?? 0;
    const mining = w?.mining ?? false;
    const stakes = w?.stakes ?? [];

    const fmtNum = (n, dec = 4) =>
        Number(n || 0)
            .toFixed(dec)
            .replace(/\.?0+$/, '') || '0';

    // ── Helper: last 5 transactions ──
    const txHistory = w?.txHistory ?? [];
    const lastTx = txHistory
        .slice(-5)
        .reverse()
        .map((t) => `• ${t.type} ${t.currency}: ${t.amount > 0 ? '+' : ''}${fmtNum(t.amount)} (${t.ts})`)
        .join('\n');

    // ── Pattern rules ────────────────────────────────────────────────────────
    const contains = (...words) => words.some((w) => normInput.includes(w));

    // Greeting
    if (contains('hallo', 'hi ', 'hey ', 'guten tag', 'guten morgen', 'guten abend')) {
        return `Hallo ${username}! 👋 Ich bin RFOF AI, dein persönlicher Assistent für das RFOF-NETWORK.\nWie kann ich dir heute helfen?\n\nTipp: Frag mich nach deiner Balance, dem Mining-Status, Swap-Kursen oder dem BTC-Preis.`;
    }

    // Balance query
    if (contains('balance', 'guthaben', 'kontostand', 'wie viel habe ich', 'meine coins', 'mein wallet')) {
        const lines = [
            `💰 **Dein aktuelles Guthaben, ${username}:**`,
            `• RFOF: ${fmtNum(balances.RFOF, 6)} RFOF`,
            `• BTC:  ${fmtNum(balances.BTC, 8)} BTC`,
            `• ETH:  ${fmtNum(balances.ETH, 6)} ETH`,
            `• NEC:  ${fmtNum(balances.NEC, 6)} NEC`,
        ];
        if (isAdmin) {
            lines.push(`• MTK:  ${fmtNum(balances.MTK, 6)} MTK (Admin)`);
        }
        return lines.join('\n');
    }

    // BTC price
    if (contains('btc preis', 'bitcoin preis', 'bitcoin kurs', 'btc kurs', 'was kostet bitcoin', 'was ist btc')) {
        const p = prices.BTC > 0 ? `$${fmtNum(prices.BTC, 2)}` : 'wird geladen...';
        return `₿ **Bitcoin (BTC) Preis:**\nAktuell: ${p}\n\nDer BTC-Preis wird alle 30 Sekunden von CoinGecko live abgerufen und fließt direkt in deine Swap-Berechnungen ein.`;
    }

    // ETH price
    if (contains('eth preis', 'ethereum preis', 'eth kurs', 'ethereum kurs', 'was kostet eth', 'was ist eth')) {
        const p = prices.ETH > 0 ? `$${fmtNum(prices.ETH, 2)}` : 'wird geladen...';
        return `🔷 **Ethereum (ETH) Preis:**\nAktuell: ${p}\n\nDer ETH-Preis wird alle 30 Sekunden von CoinGecko live abgerufen.`;
    }

    // RFOF price
    if (contains('rfof preis', 'rfof kurs', 'was kostet rfof', 'rfof wert')) {
        const p = fmtNum(prices.RFOF, 6);
        return `📈 **RFOF Preis:**\n$${p} / RFOF\n\nDer RFOF-Preis startet bei $0 und wächst mit jeder Interaktion:\nPreis = Interaktionen × Faktor\nAktuell: ${interactions} Interaktionen | Liquiditäts-Pool: ${fmtNum(poolSize, 4)}`;
    }

    // Mining
    if (contains('mining', 'minen', 'schürfen', 'wie viel rfof', 'rfof verdienen', 'rfof mine')) {
        const status = mining ? '🟢 Mining läuft' : '🔴 Mining gestoppt';
        return `⛏️ **RFOF Mining:**\nStatus: ${status}\n\nFunktionsweise:\n• Du verdienst +0.0001 RFOF alle 3 Sekunden\n• Das entspricht ~2 RFOF/Stunde oder ~48 RFOF/Tag\n• Jede Mining-Reward erhöht dein RFOF-Guthaben\n\nUm Mining zu starten, klicke im Wallet-Bereich auf "⛏️ Mining starten".`;
    }

    // Swap
    if (contains('swap', 'tauschen', 'umtauschen', 'rfof swap', 'wie tausche', 'wechseln')) {
        return `🔄 **RFOF Swap erklärt:**\n\nDu kannst folgende Paare tauschen:\n• RFOF ↔ BTC (Live-Preis)\n• RFOF ↔ ETH (Live-Preis)\n• RFOF ↔ NEC (interner Preis)${isAdmin ? '\n• MTK ↔ beliebig (Admin-only)' : ''}\n\nGebühr: 0.5% pro Seite (fließt in den Liquiditäts-Pool)\n\nSo gehts: Wallet → Swap → Währung wählen → Betrag → Bestätigen.`;
    }

    // 2FA
    if (contains('2fa', 'zwei-faktor', 'zweifaktor', 'emailjs', 'code email', 'sicherheit code')) {
        return `🔐 **2FA (Zwei-Faktor-Authentifizierung):**\n\nRFOF verwendet EmailJS zur 2FA:\n1. 6-stelliger Code wird generiert\n2. Code wird an rfof236286@gmail.com gesendet\n3. Du gibst den Code ein\n4. Session wird bestätigt\n\nFür echten E-Mail-Versand konfiguriere EmailJS in den Einstellungen (Service-ID, Template-ID, Public-Key).`;
    }

    // Staking
    if (contains('staking', 'staken', 'stake', 'apy', 'reward', 'lockup')) {
        const activeStakes = stakes.length;
        return `🔒 **RFOF Staking:**\nAktive Stakes: ${activeStakes}\n\nLockup-Zeiten und APY:\n• 7 Tage  → 6% APY\n• 30 Tage → 12% APY\n• 90 Tage → 20% APY\n• 365 Tage → 35% APY\n\nNach dem Lockup kannst du "Unstake" klicken und erhältst dein Kapital + Rewards zurück.\n\nWallet → Staking → Betrag & Lockup → Bestätigen.`;
    }

    // Deposit
    if (contains('einzahlung', 'deposit', 'einzahlen', 'geld einzahlen')) {
        return `💳 **Deposit (Einzahlung):**\n\nSo zahlst du ein:\n1. Wallet → Deposit\n2. Betrag eingeben\n3. Währung wählen (RFOF/BTC/ETH/NEC)\n4. Gebühren werden angezeigt (0.5%)\n5. "Confirm Deposit" → Balance wird erhöht ✅\n\nJede Einzahlung wird grün in der Transaktions-History angezeigt.`;
    }

    // Withdraw
    if (contains('auszahlung', 'withdraw', 'abheben', 'auszahlen')) {
        return `💸 **Withdraw (Auszahlung):**\n\nSo hebst du ab:\n1. Wallet → Withdraw\n2. Betrag + Zieladresse eingeben\n3. Währung wählen\n4. Gebühr = 0.5%\n5. "Confirm Withdraw" → Balance wird reduziert ✅\n\nJede Auszahlung wird rot in der Transaktions-History angezeigt.`;
    }

    // Send
    if (contains('senden', 'send', 'überweisung', 'transfer', 'hex output')) {
        return `📤 **Send (Senden):**\n\nSo sendest du Coins:\n1. Wallet → Send\n2. Empfänger-Adresse eingeben\n3. Betrag & Währung wählen\n4. Gebühr wird berechnet\n5. Für BTC: Hex-Output (Transaktion simuliert)\n6. "Senden" → Balance -=\n\nAlle Send-Transaktionen erscheinen rot in der History.`;
    }

    // Seed phrase
    if (contains('seed phrase', 'seed-phrase', 'seedphrase', 'bip39', 'wallet-adresse', 'recovery phrase', 'wiederherstellung')) {
        return `🌱 **Seed-Phrase (BIP39):**\n\nDeine Seed-Phrase ermöglicht Wallet-Recovery:\n• 12 Wörter aus dem BIP39-Standard\n• Ableitung von 3 Adressen: BTC, ETH, RFOF\n• Copy-to-Clipboard verfügbar\n• Sicher in sessionStorage gespeichert\n\n⚠️ Zeige die Phrase NIEMALS anderen! Wer sie kennt, kann alle Coins stehlen.\n\nWallet → Seed-Phrase → Generieren.`;
    }

    // Blockchain / SatoramyLedger
    if (contains('blockchain', 'satoramy', 'ledger', 'genesis', 'block', 'hash')) {
        return `🏛️ **SatoramyLedger Blockchain:**\n\nDie RFOF-interne Blockchain:\n• Genesis Block 0: RFOF-NETWORK initialisiert\n• Block 1: MTK Layer-7 Bootstrap\n• Block 2: Liquiditäts-Pool initialisiert\n\nJede Transaktion wird als Block-Hash verkettet.\nAlle 15 technischen Parameter (chainId, validator, merkleRoot, etc.)\n\nExplorer → X-Hub für Details.`;
    }

    // Admin-specific: MTK
    if (isAdmin && contains('mtk', 'mint', 'burn', 'admin status')) {
        return `👑 **Admin MTK Status:**\n\nMTK Balance: ${fmtNum(balances.MTK, 6)} MTK\nInteraktionen: ${interactions}\nPool: ${fmtNum(poolSize, 4)}\n\nAdmin-Funktionen:\n• Mint: MTK generieren (erhöht Gesamtangebot)\n• Burn: MTK vernichten (reduziert Angebot)\n\nMTK ist nur für Admin sichtbar und mit NEC+RFOF verbunden.\nUser sehen NEC statt MTK.`;
    }

    // Admin: MTK vs RFOF
    if (isAdmin && contains('mtk vs rfof', 'unterschied mtk', 'mtk rfof', 'erkläre mtk')) {
        return `👑 **MTK vs RFOF (Admin-Wissen):**\n\n**RFOF** – Handelswährung für alle Nutzer:\n• Sichtbar für alle\n• Verdient durch Mining & Trading\n• Preis steigt mit Interaktionen\n\n**MTK** – Admin-only Asset:\n• Nur für RFOF-NETWORK sichtbar\n• Verbunden mit NEC (NEC = User-Sicht auf MTK)\n• Mint/Burn durch Admin\n• Steuerung des Gesamtangebots\n\nUser sehen NEC, das intern MTK repräsentiert.`;
    }

    // Price rise explanation
    if (contains('warum steigt', 'preis stieg', 'preis wächst', 'preis erhöht', 'preisberechnung', 'wie berechnet')) {
        return `📊 **Preis-Berechnung erklärt:**\n\nDer RFOF-Preis folgt dieser Formel:\n\`Preis = Interaktionen × Preis-Faktor\`\n\nJede Aktion zählt als Interaktion:\n• Deposit / Withdraw\n• Swap / Send\n• Mining-Reward\n• Buy / Sell im Chart\n\nAktuell: ${interactions} Interaktionen → Preis: $${fmtNum(prices.RFOF, 6)}\nLiquiditäts-Pool: ${fmtNum(poolSize, 4)} (alle Gebühren summiert)`;
    }

    // Transaction history
    if (contains('history', 'verlauf', 'transaktionen', 'letzte', 'buchungen')) {
        if (txHistory.length === 0) {
            return `📋 **Transaktions-History:**\nNoch keine Transaktionen vorhanden.\n\nStarte mit einem Deposit oder Mining!`;
        }
        return `📋 **Letzte 5 Transaktionen:**\n${lastTx || 'Keine Transaktionen.'}`;
    }

    // OAuth / Login
    if (contains('oauth', 'login', 'anmelden', 'github login', 'google login', 'microsoft login', 'einloggen')) {
        return `🔐 **OAuth2 Login:**\n\nRFOF unterstützt echte OAuth2-Integration:\n• GitHub OAuth2\n• Google OAuth2\n• Microsoft OAuth2\n\nSo konfigurierst du es:\n1. Erstelle eine OAuth-App beim Provider\n2. Trage die Client-ID in RFOF-Einstellungen → OAuth ein\n3. Registriere als Redirect-URI:\n   \`https://RFOF-NETWORK.github.io/rfof-network.github.ton/\`\n\nDann funktioniert echtes OAuth2-Login!`;
    }

    // Help
    if (contains('hilfe', 'help', 'was kannst du', 'was weißt du', 'was machst du', 'fragen')) {
        return `🤖 **RFOF AI – Was kann ich?**\n\nIch beantworte Fragen über:\n• 💰 Balance & Guthaben\n• ₿ BTC/ETH Live-Preise\n• ⛏️ Mining (RFOF verdienen)\n• 🔄 Swap & Trading\n• 🔒 Staking & APY\n• 💳 Deposit & Withdraw\n• 📤 Send & Transfer\n• 🌱 Seed-Phrase & BIP39\n• 🔐 2FA & Sicherheit\n• 🏛️ SatoramyLedger Blockchain\n• 📊 Preis-Berechnung\n${isAdmin ? '• 👑 MTK Admin-Funktionen\n' : ''}\nFrag einfach drauflos! 🚀`;
    }

    // Default fallback
    const tokens = new SparkTokenizer().encode(normInput);
    const tokenCount = tokens.length;
    return `🤖 Ich habe deine Frage tokenisiert (${tokenCount} SPARK-Tokens).\n\nLeider kenne ich auf diese spezifische Frage noch keine Antwort.\n\nProbiere eine dieser Fragen:\n• "Was ist meine Balance?"\n• "Wie funktioniert Mining?"\n• "Was ist der BTC-Preis?"\n• "Erkläre RFOF Swap"\n• "Hilfe" für alle Themen\n\n📎 SPARK-Tokenizer aktiv: ${tokenCount} Tokens verarbeitet.`;
}

// ─── Chat History ─────────────────────────────────────────────────────────────

const CHAT_HISTORY_PREFIX = 'rfof_chat_history_';

function getChatHistoryKey() {
    const session = getCurrentSession();
    const username = session?.username ?? 'anonymous';
    return `${CHAT_HISTORY_PREFIX}${username}`;
}

function loadChatHistory() {
    try {
        const raw = localStorage.getItem(getChatHistoryKey());
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

function saveChatHistory(messages) {
    try {
        localStorage.setItem(getChatHistoryKey(), JSON.stringify(messages.slice(-100)));
    } catch (_) {}
}

export function clearChatHistory() {
    try {
        const session = getCurrentSession();
        if (session?.username) {
            localStorage.removeItem(`${CHAT_HISTORY_PREFIX}${session.username}`);
        }
        // Also clear anonymous
        localStorage.removeItem(`${CHAT_HISTORY_PREFIX}anonymous`);
    } catch (_) {}
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'style' && typeof v === 'string') {
            node.style.cssText = v;
        } else if (k === 'class') {
            node.className = v;
        } else if (k.startsWith('on') && typeof v === 'function') {
            node.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
            node.setAttribute(k, v);
        }
    });
    children.flat().forEach((child) => {
        if (child == null) { return; }
        node.appendChild(
            typeof child === 'string' ? document.createTextNode(child) : child
        );
    });
    return node;
}

/** Render message text: linkify URLs, highlight code blocks */
function renderMessageContent(text) {
    const container = document.createElement('div');
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
    parts.forEach((part) => {
        if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).trim();
            const pre = document.createElement('pre');
            pre.style.cssText =
                'background:#0b1220;border:1px solid #334155;border-radius:6px;padding:8px 10px;font-size:0.78rem;overflow-x:auto;margin:6px 0;white-space:pre-wrap;word-break:break-all;';
            pre.appendChild(document.createTextNode(code));
            container.appendChild(pre);
        } else if (part.startsWith('`') && part.endsWith('`')) {
            const code = part.slice(1, -1);
            const c = document.createElement('code');
            c.style.cssText =
                'background:#1e293b;padding:2px 6px;border-radius:4px;font-size:0.85em;';
            c.appendChild(document.createTextNode(code));
            container.appendChild(c);
        } else {
            // Linkify URLs
            const urlRe = /(https?:\/\/[^\s]+)/g;
            let last = 0;
            let match;
            while ((match = urlRe.exec(part)) !== null) {
                container.appendChild(
                    document.createTextNode(part.slice(last, match.index))
                );
                const a = document.createElement('a');
                // Validate URL: only allow http/https to prevent javascript: URI injection
                let safeUrl = '#';
                try {
                    const parsed = new URL(match[1]);
                    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
                        safeUrl = parsed.href;
                    }
                } catch (_) { /* invalid URL */ }
                a.href = safeUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.style.color = '#60a5fa';
                a.appendChild(document.createTextNode(match[1]));
                container.appendChild(a);
                last = match.index + match[0].length;
            }
            container.appendChild(document.createTextNode(part.slice(last)));
        }
    });
    return container;
}

// ─── Chat Widget ──────────────────────────────────────────────────────────────

let chatWidget = null;
let chatMessages = [];
let isMinimised = false;
const tokenizer = new SparkTokenizer();

function createChatWidget() {
    if (document.getElementById('rfof-ai-chat')) { return; }

    // ── Styles ──
    const style = document.createElement('style');
    style.id = 'rfof-ai-chat-styles';
    style.textContent = `
#rfof-ai-chat {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 350px;
  height: 500px;
  display: flex;
  flex-direction: column;
  background: #0f172a;
  border: 1px solid #1e3a5f;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  z-index: 10000;
  font-family: system-ui, sans-serif;
  font-size: 0.88rem;
  color: #e5eefb;
  overflow: hidden;
  transition: height 0.2s ease;
}
#rfof-ai-chat.minimised {
  height: 52px;
}
@media (max-width: 420px) {
  #rfof-ai-chat { width: calc(100vw - 20px); right: 10px; bottom: 10px; }
}
#rfof-ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 52px;
  background: #0b1220;
  border-bottom: 1px solid #1e3a5f;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}
#rfof-ai-chat-header span { font-weight: 700; font-size: 0.92rem; }
.rfof-chat-hbtn {
  background: none;
  border: none;
  color: #9fb0ca;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 6px;
  border-radius: 6px;
  line-height: 1;
}
.rfof-chat-hbtn:hover { background: #1e293b; color: #e5eefb; }
#rfof-ai-chat-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scroll-behavior: smooth;
}
#rfof-ai-chat-msgs::-webkit-scrollbar { width: 4px; }
#rfof-ai-chat-msgs::-webkit-scrollbar-track { background: transparent; }
#rfof-ai-chat-msgs::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
.rfof-msg {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  line-height: 1.45;
  word-break: break-word;
  white-space: pre-wrap;
  font-size: 0.84rem;
}
.rfof-msg.bot {
  align-self: flex-start;
  background: #1e293b;
  border-bottom-left-radius: 4px;
  color: #e5eefb;
}
.rfof-msg.user {
  align-self: flex-end;
  background: #1d4ed8;
  border-bottom-right-radius: 4px;
  color: #fff;
}
.rfof-msg-meta {
  font-size: 0.7rem;
  color: #6b7fa3;
  margin-top: 2px;
  margin-bottom: 2px;
}
.rfof-msg.bot .rfof-msg-meta { text-align: left; }
.rfof-msg.user .rfof-msg-meta { text-align: right; }
.rfof-typing {
  align-self: flex-start;
  background: #1e293b;
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  padding: 10px 16px;
  color: #9fb0ca;
  font-size: 1.2rem;
  letter-spacing: 0.2em;
  animation: rfof-blink 1.2s step-start infinite;
}
@keyframes rfof-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
#rfof-ai-chat-footer {
  flex-shrink: 0;
  padding: 8px 10px;
  border-top: 1px solid #1e3a5f;
  background: #0b1220;
  display: flex;
  gap: 6px;
  align-items: flex-end;
}
#rfof-ai-chat-input {
  flex: 1;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  color: #e5eefb;
  font-size: 0.84rem;
  padding: 8px 10px;
  resize: none;
  outline: none;
  max-height: 100px;
  line-height: 1.4;
  font-family: inherit;
}
#rfof-ai-chat-input::placeholder { color: #6b7fa3; }
#rfof-ai-chat-input:focus { border-color: #2563eb; }
#rfof-ai-chat-send {
  background: #2563eb;
  border: none;
  color: #fff;
  border-radius: 10px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.1rem;
  transition: background 0.15s;
}
#rfof-ai-chat-send:hover { background: #1d4ed8; }
#rfof-ai-chat-send:disabled { background: #334155; cursor: default; }
`;
    document.head.appendChild(style);

    // ── Send-Button SVG icon ──
    const sendIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sendIcon.setAttribute('viewBox', '0 0 24 24');
    sendIcon.setAttribute('fill', 'none');
    sendIcon.setAttribute('stroke', 'currentColor');
    sendIcon.setAttribute('stroke-width', '2');
    sendIcon.setAttribute('width', '16');
    sendIcon.setAttribute('height', '16');
    const sendPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sendPath.setAttribute('d', 'M22 2L11 13M22 2L15 22 11 13 2 9l20-7z');
    sendIcon.appendChild(sendPath);

    // ── Header ──
    const header = el(
        'div',
        { id: 'rfof-ai-chat-header' },
        el('span', {}, '🤖 RFOF AI Chat'),
        el(
            'div',
            { style: 'display:flex;gap:4px;' },
            el('button', { class: 'rfof-chat-hbtn', title: 'Verlauf löschen', onclick: onClearHistory }, '🗑️'),
            el('button', { class: 'rfof-chat-hbtn', id: 'rfof-chat-minimise', title: 'Minimieren / Maximieren', onclick: onToggleMinimise }, '–'),
            el('button', { class: 'rfof-chat-hbtn', title: 'Schließen', onclick: onClose }, '✕')
        )
    );
    header.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') { return; }
        onToggleMinimise();
    });

    // ── Message container ──
    const msgs = el('div', { id: 'rfof-ai-chat-msgs', role: 'log', 'aria-live': 'polite' });

    // ── Input ──
    const input = el('textarea', {
        id: 'rfof-ai-chat-input',
        placeholder: 'Ask me anything...',
        rows: '1',
        maxlength: '2000',
        'aria-label': 'Nachricht an RFOF AI',
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    });
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
    });

    const sendBtn = el('button', { id: 'rfof-ai-chat-send', title: 'Senden', onclick: onSend });
    sendBtn.appendChild(sendIcon);

    const footer = el(
        'div',
        { id: 'rfof-ai-chat-footer' },
        input,
        sendBtn
    );

    // ── Widget ──
    const widget = el(
        'div',
        { id: 'rfof-ai-chat', role: 'complementary', 'aria-label': 'RFOF AI Chat' },
        header,
        msgs,
        footer
    );

    document.body.appendChild(widget);
    chatWidget = widget;

    // Restore history
    chatMessages = loadChatHistory();
    if (chatMessages.length === 0) {
        // Welcome message
        const session = getCurrentSession();
        const name = session?.username ?? 'Nutzer';
        appendMessage('bot', `👋 Hallo ${name}! Ich bin **RFOF AI** – powered by SPARK Tokenizer.\n\nWie kann ich dir helfen? Tippe "Hilfe" für eine Übersicht.`);
    } else {
        chatMessages.forEach((m) => renderMessage(m.role, m.content, m.ts, false));
        scrollToBottom();
    }
}

function appendMessage(role, content, ts = Date.now(), save = true) {
    const msg = { role, content, ts };
    if (save) {
        chatMessages.push(msg);
        saveChatHistory(chatMessages);
    }
    renderMessage(role, content, ts, true);
}

function renderMessage(role, content, ts, scroll) {
    const msgs = document.getElementById('rfof-ai-chat-msgs');
    if (!msgs) { return; }

    const bubble = document.createElement('div');
    bubble.className = `rfof-msg ${role}`;

    const contentNode = renderMessageContent(content);
    bubble.appendChild(contentNode);

    const meta = document.createElement('div');
    meta.className = 'rfof-msg-meta';
    meta.textContent = role === 'bot' ? `🤖 ${new Date(ts).toLocaleTimeString()}` : `👤 ${new Date(ts).toLocaleTimeString()}`;
    bubble.appendChild(meta);

    msgs.appendChild(bubble);
    if (scroll) { scrollToBottom(); }
}

function showTyping() {
    const msgs = document.getElementById('rfof-ai-chat-msgs');
    if (!msgs) { return null; }
    const indicator = document.createElement('div');
    indicator.className = 'rfof-typing';
    indicator.textContent = '· · ·';
    msgs.appendChild(indicator);
    scrollToBottom();
    return indicator;
}

function scrollToBottom() {
    const msgs = document.getElementById('rfof-ai-chat-msgs');
    if (msgs) { msgs.scrollTop = msgs.scrollHeight; }
}

function onSend() {
    const input = document.getElementById('rfof-ai-chat-input');
    const sendBtn = document.getElementById('rfof-ai-chat-send');
    if (!input) { return; }
    const text = input.value.trim();
    if (!text) { return; }

    input.value = '';
    input.style.height = 'auto';
    if (sendBtn) { sendBtn.disabled = true; }

    appendMessage('user', text);

    const typing = showTyping();

    // Simulate async thinking with the SPARK tokenizer
    const norm = tokenizer.normalise(text);
    const tokenCount = tokenizer.encode(norm).length;

    // Delay proportional to response complexity (like typing)
    const delay = Math.min(400 + tokenCount * 8, 1800);

    setTimeout(() => {
        if (typing) { typing.remove(); }
        if (sendBtn) { sendBtn.disabled = false; }
        const ctx = getWalletContext();
        const response = buildResponse(norm, ctx);
        appendMessage('bot', response);
    }, delay);
}

function onClearHistory() {
    chatMessages = [];
    clearChatHistory();
    const msgs = document.getElementById('rfof-ai-chat-msgs');
    if (msgs) { msgs.replaceChildren(); }
    const session = getCurrentSession();
    const name = session?.username ?? 'Nutzer';
    appendMessage('bot', `🗑️ Chat-Verlauf gelöscht.\n\nHallo ${name}! Wie kann ich dir helfen?`);
}

function onToggleMinimise() {
    const widget = document.getElementById('rfof-ai-chat');
    const btn = document.getElementById('rfof-chat-minimise');
    if (!widget) { return; }
    isMinimised = !isMinimised;
    widget.classList.toggle('minimised', isMinimised);
    if (btn) { btn.textContent = isMinimised ? '+' : '–'; }
}

function onClose() {
    const widget = document.getElementById('rfof-ai-chat');
    if (widget) { widget.remove(); }
    chatWidget = null;
    // Also remove open button if exists
    const openBtn = document.getElementById('rfof-ai-chat-open');
    if (openBtn) { openBtn.style.display = 'flex'; }
}

// ─── Open Button ──────────────────────────────────────────────────────────────

function createOpenButton() {
    if (document.getElementById('rfof-ai-chat-open')) { return; }
    const style = document.getElementById('rfof-ai-chat-styles');
    if (!style) {
        // Inject minimal style for the open button
        const s = document.createElement('style');
        s.textContent = `
#rfof-ai-chat-open {
  position:fixed;bottom:24px;right:24px;width:52px;height:52px;
  background:#2563eb;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:1.4rem;cursor:pointer;z-index:9999;
  border:none;color:#fff;box-shadow:0 4px 16px rgba(37,99,235,0.5);
  transition:background 0.15s;
}
#rfof-ai-chat-open:hover{background:#1d4ed8;}
`;
        document.head.appendChild(s);
    }
    const btn = document.createElement('button');
    btn.id = 'rfof-ai-chat-open';
    btn.title = 'RFOF AI Chat öffnen';
    btn.textContent = '🤖';
    btn.addEventListener('click', () => {
        btn.style.display = 'none';
        createChatWidget();
    });
    document.body.appendChild(btn);
}

// ─── Mount / Unmount ──────────────────────────────────────────────────────────

export function mountAIChat() {
    const session = getCurrentSession();
    if (!session) {
        // Not logged in: show nothing (or already logged out)
        unmountAIChat();
        return;
    }
    // Already mounted
    if (document.getElementById('rfof-ai-chat') || document.getElementById('rfof-ai-chat-open')) {
        return;
    }
    createOpenButton();
}

export function unmountAIChat() {
    ['rfof-ai-chat', 'rfof-ai-chat-open', 'rfof-ai-chat-styles'].forEach((id) => {
        document.getElementById(id)?.remove();
    });
    chatWidget = null;
    chatMessages = [];
    isMinimised = false;
}

// ─── Auto-mount on session change ─────────────────────────────────────────────

function syncChatVisibility() {
    const session = getCurrentSession();
    const chatExists =
        document.getElementById('rfof-ai-chat') ||
        document.getElementById('rfof-ai-chat-open');
    if (session && !chatExists) {
        mountAIChat();
    } else if (!session && chatExists) {
        clearChatHistory();
        unmountAIChat();
    }
}

setInterval(syncChatVisibility, 2000);

// Initial check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncChatVisibility);
} else {
    syncChatVisibility();
}
