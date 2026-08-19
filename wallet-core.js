/**
 * wallet-core.js – RFOF-NETWORK Wallet Extension
 * Ergänzt das bestehende Auth-System um:
 *  - SatoramyLedger Genesis-Blöcke
 *  - Multi-Währungs-Balances (RFOF/BTC/ETH/NEC/MTK)
 *  - Preis- & Liquiditätsmechanik (startet bei 0)
 *  - Gebührenmodell
 *  - Mining (Interval Loop)
 *  - Trading Charts (Lightweight-Charts)
 *  - BIP39 Seed-Phrase Generator
 *  - Swap / Send / Deposit / Withdraw / Stake Modals
 *  - 2FA via EmailJS
 *  - Admin Mint/Burn
 *  - Auto-System nach erstem Deposit/Buy/Swap
 *
 * Dieses Modul schreibt NICHTS der bestehenden Logik um.
 * Es bindet sich nur über DOM-Events und eigene Elemente ein.
 */

import { AuthManager } from './auth.js';
import { BIP39_WORDLIST } from './bip39_wordlist.js';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `wc-toast wc-toast-${type}`;
    t.textContent = type === 'success' ? `✓ ${msg}` : `✗ ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function fmtNum(n, dec = 6) {
    return Number(n).toFixed(dec).replace(/\.?0+$/, '') || '0';
}

function isAdmin(session) {
    return session && session.username === 'RFOF-NETWORK';
}

// ─── SatoramyLedger Genesis-Blöcke ──────────────────────────────────────────

const GENESIS_BLOCKS = [
    {
        index: 0,
        hash: 'b17be67b9bcfcad2fe843a67c825bed04c4d58f389db4c31a41e5543dbbbeec9',
        prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: 1700000000000,
        data: 'RFOF-NETWORK Genesis Block – SatoramyLedger initialized',
        nonce: 0,
        merkleRoot: 'rfof_genesis_merkle_0',
        version: 1,
        difficulty: 1,
        totalSupply: 0,
        chainId: 'satoramy-1',
        validator: 'RFOF-NETWORK',
        signature: 'genesis_sig_0',
        stateRoot: 'rfof_state_root_0',
        receiptRoot: 'rfof_receipt_root_0',
        extraData: 'PRAI-AI-GENESIS'
    },
    {
        index: 1,
        hash: 'ceac47fcb2de999c8c3a24d945b687739f79bcf79058f46ebadf6332e55991a9',
        prevHash: 'b17be67b9bcfcad2fe843a67c825bed04c4d58f389db4c31a41e5543dbbbeec9',
        timestamp: 1700000001000,
        data: 'MTK Layer-7 Bootstrap – 32-Kapitel-System activated',
        nonce: 1,
        merkleRoot: 'rfof_genesis_merkle_1',
        version: 1,
        difficulty: 1,
        totalSupply: 0,
        chainId: 'satoramy-1',
        validator: 'RFOF-NETWORK',
        signature: 'genesis_sig_1',
        stateRoot: 'rfof_state_root_1',
        receiptRoot: 'rfof_receipt_root_1',
        extraData: 'MTK-NEC-LAYER7'
    },
    {
        index: 2,
        hash: 'a88afe3436ecad2725f7417a7e474c66e99f523c3b9e8799ce3d692151d3835d',
        prevHash: 'ceac47fcb2de999c8c3a24d945b687739f79bcf79058f46ebadf6332e55991a9',
        timestamp: 1700000002000,
        data: 'RFOF Trading Layer – Liquidity Pool initialized at 0',
        nonce: 2,
        merkleRoot: 'rfof_genesis_merkle_2',
        version: 1,
        difficulty: 1,
        totalSupply: 0,
        chainId: 'satoramy-1',
        validator: 'RFOF-NETWORK',
        signature: 'genesis_sig_2',
        stateRoot: 'rfof_state_root_2',
        receiptRoot: 'rfof_receipt_root_2',
        extraData: 'RFOF-LIQUIDITY-0'
    }
];

// ─── Wallet-State (sessionStorage) ──────────────────────────────────────────

const WC_KEY = 'wc_state_v2';

function defaultState() {
    return {
        balances: { RFOF: 0, BTC: 0, ETH: 0, NEC: 0, MTK: 0 },
        interactions: 0,
        liquidityPool: 0,
        prices: { RFOF: 0, BTC: 0, ETH: 0, NEC: 0, MTK: 0 },
        txHistory: [],
        stakes: [],
        autoSystemStarted: false,
        miningActive: false,
        seedPhrase: null,
        addressBTC: null,
        addressETH: null,
        addressRFOF: null
    };
}

function loadState() {
    try {
        const raw = sessionStorage.getItem(WC_KEY);
        if (raw) { return Object.assign(defaultState(), JSON.parse(raw)); }
    } catch (_) {}
    return defaultState();
}

function saveState(s) {
    try { sessionStorage.setItem(WC_KEY, JSON.stringify(s)); } catch (_) {}
}

let wcState = loadState();

// ─── Preis & Liquidität ──────────────────────────────────────────────────────

const PRICE_FACTOR = 0.001;
const FEE_RATE     = 0.005; // 0.5 %
const FEE_MINING   = 0.0001;

function onInteraction(feePaid = 0) {
    wcState.interactions++;
    wcState.liquidityPool += feePaid;
    const priceBase = wcState.interactions * PRICE_FACTOR;
    ['RFOF','BTC','ETH','NEC','MTK'].forEach((c) => { wcState.prices[c] = priceBase; });
    saveState(wcState);
    refreshPriceDisplay();
}

function calcFee(amount) {
    return Math.abs(amount) * FEE_RATE;
}

// ─── Transaktions-History ────────────────────────────────────────────────────

function addTx(type, currency, amount, note = '') {
    const plus = amount >= 0;
    wcState.txHistory.unshift({
        id: Date.now() + Math.random(),
        type,
        currency,
        amount,
        note,
        ts: new Date().toLocaleString('de-DE')
    });
    if (wcState.txHistory.length > 200) { wcState.txHistory.length = 200; }
    saveState(wcState);
    renderTxHistoryWC();
}

function renderTxHistoryWC() {
    const list = document.getElementById('wcTxList');
    if (!list) { return; }
    list.replaceChildren();
    if (!wcState.txHistory.length) {
        const li = document.createElement('li');
        li.style.color = 'var(--muted)';
        li.textContent = 'Noch keine Transaktionen.';
        list.appendChild(li);
        return;
    }
    wcState.txHistory.slice(0, 20).forEach((tx) => {
        const li = document.createElement('li');
        li.className = 'tx-item';
        const plus = tx.amount >= 0;
        li.style.cssText = 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem;';
        const left = document.createElement('span');
        left.textContent = `${tx.type} · ${tx.currency} · ${tx.ts}`;
        const right = document.createElement('span');
        right.style.color = plus ? 'var(--success)' : 'var(--danger)';
        right.style.fontWeight = '600';
        right.textContent = `${plus ? '+' : ''}${fmtNum(tx.amount, 6)} ${tx.currency}`;
        li.append(left, right);
        if (tx.note) {
            const note = document.createElement('span');
            note.style.cssText = 'display:block;color:var(--muted);font-size:0.78rem;';
            note.textContent = tx.note;
            li.appendChild(note);
        }
        list.appendChild(li);
    });
}

// ─── Balance Display ─────────────────────────────────────────────────────────

function refreshBalanceDisplay() {
    const wcAuth = new AuthManager();
    const session = wcAuth.getSessionSummary();
    const admin = isAdmin(session);
    const currencies = admin
        ? ['RFOF', 'BTC', 'ETH', 'MTK', 'NEC']
        : ['RFOF', 'BTC', 'ETH', 'NEC'];

    const grid = document.getElementById('wcBalanceGrid');
    if (!grid) { return; }
    grid.replaceChildren();

    currencies.forEach((c) => {
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--surface-strong);border:1px solid var(--border);border-radius:12px;padding:14px 18px;min-width:130px;';
        const symbol = document.createElement('div');
        symbol.style.cssText = 'font-size:0.8rem;color:var(--muted);margin-bottom:4px;';
        symbol.textContent = CURRENCY_SYMBOLS[c] || c;
        const bal = document.createElement('div');
        bal.style.cssText = 'font-size:1.4rem;font-weight:700;color:var(--accent);';
        bal.textContent = fmtNum(wcState.balances[c], 6);
        const price = document.createElement('div');
        price.style.cssText = 'font-size:0.78rem;color:var(--muted);margin-top:2px;';
        price.textContent = `≈ $${fmtNum(wcState.prices[c], 4)} / unit`;
        card.append(symbol, bal, price);
        grid.appendChild(card);
    });

    // Admin Mint/Burn
    const adminRow = document.getElementById('wcAdminRow');
    if (adminRow) { adminRow.style.display = admin ? '' : 'none'; }
}

const CURRENCY_SYMBOLS = {
    RFOF: '🟣 RFOF', BTC: '🟠 BTC', ETH: '🔵 ETH', NEC: '🟡 NEC', MTK: '⚪ MTK'
};

function refreshPriceDisplay() {
    const el = document.getElementById('wcPriceInfo');
    if (el) {
        el.textContent = `Interaktionen: ${wcState.interactions} | Pool: ${fmtNum(wcState.liquidityPool, 6)} | Preis/Unit: $${fmtNum(wcState.prices.RFOF, 4)}`;
    }
    refreshBalanceDisplay();
}

// ─── Auto-System (Layer-7) ───────────────────────────────────────────────────

function maybeStartAutoSystem() {
    if (wcState.autoSystemStarted) { return; }
    wcState.autoSystemStarted = true;
    saveState(wcState);
    // Silent: Layer-7 Verteilung, 32-Kapitel-System
    setInterval(() => {
        // MTK-Verteilung: admin bekommt stil einen Bruchteil der Gebühren als MTK
        const mtkShare = wcState.liquidityPool * 0.0001;
        wcState.balances.MTK += mtkShare;
        wcState.liquidityPool -= mtkShare;
        saveState(wcState);
    }, 10000);
}

// ─── Mining ──────────────────────────────────────────────────────────────────

let miningInterval = null;

function startMining() {
    if (miningInterval) { return; }
    wcState.miningActive = true;
    saveState(wcState);
    updateMiningStatus(true);
    const fee = FEE_MINING;
    wcState.balances.RFOF -= fee;
    onInteraction(fee);

    miningInterval = setInterval(() => {
        const reward = 0.0001 * (1 + Math.random());
        wcState.balances.RFOF += reward;
        addTx('MINING_REWARD', 'RFOF', reward);
        onInteraction(0);
    }, 3000);
    toast('⛏️ Mining gestartet!');
}

function stopMining() {
    if (!miningInterval) { return; }
    clearInterval(miningInterval);
    miningInterval = null;
    wcState.miningActive = false;
    saveState(wcState);
    updateMiningStatus(false);
    const fee = FEE_MINING;
    wcState.balances.RFOF -= fee;
    onInteraction(fee);
    addTx('MINING_STOP', 'RFOF', -fee, 'Gas-Fee');
    toast('⏹ Mining gestoppt.', 'info');
}

function updateMiningStatus(active) {
    const el = document.getElementById('wcMiningStatus');
    if (!el) { return; }
    el.textContent = active ? '🟢 Mining aktiv' : '🔴 Mining gestoppt';
    el.style.color = active ? 'var(--success)' : 'var(--danger)';
}

// ─── Deposit / Withdraw ──────────────────────────────────────────────────────

function doDeposit(currency, amount) {
    if (!amount || amount <= 0) { toast('Ungültiger Betrag.', 'error'); return; }
    const fee = calcFee(amount);
    wcState.balances[currency] += (amount - fee);
    onInteraction(fee);
    addTx('DEPOSIT', currency, amount - fee);
    addTx('FEE', currency, -fee, 'Deposit-Gebühr');
    maybeStartAutoSystem();
    toast(`✓ Deposit ${fmtNum(amount - fee, 6)} ${currency} confirmed`);
}

function doWithdraw(currency, amount) {
    if (!amount || amount <= 0) { toast('Ungültiger Betrag.', 'error'); return; }
    const fee = calcFee(amount);
    const total = amount + fee;
    if (wcState.balances[currency] < total) { toast('Insufficient balance', 'error'); return; }
    wcState.balances[currency] -= total;
    onInteraction(fee);
    addTx('WITHDRAW', currency, -amount);
    addTx('FEE', currency, -fee, 'Withdraw-Gebühr');
    toast(`✓ Withdraw ${fmtNum(amount, 6)} ${currency} confirmed`);
}

// ─── Swap ─────────────────────────────────────────────────────────────────────

function doSwap(fromCur, toCur, amount) {
    if (!amount || amount <= 0) { toast('Ungültiger Betrag.', 'error'); return; }
    if (fromCur === toCur) { toast('Gleiche Währung.', 'error'); return; }
    const fee = calcFee(amount) * 2;
    const pFrom = wcState.prices[fromCur] || 0.001;
    const pTo   = wcState.prices[toCur]   || 0.001;
    const rate  = pFrom / pTo || 1;
    const toAmount = amount * rate * (1 - FEE_RATE * 2);
    if (wcState.balances[fromCur] < amount) { toast('Insufficient balance', 'error'); return; }
    wcState.balances[fromCur] -= amount;
    wcState.balances[toCur]   += toAmount;
    onInteraction(fee);
    addTx('SWAP_OUT', fromCur, -amount, `Swap → ${toCur}`);
    addTx('SWAP_IN',  toCur,  toAmount, `Swap ← ${fromCur}`);
    maybeStartAutoSystem();
    toast(`✓ Swap -${fmtNum(amount, 6)} ${fromCur} | +${fmtNum(toAmount, 6)} ${toCur} confirmed`);
}

// ─── Send ─────────────────────────────────────────────────────────────────────

function doSend(currency, amount, recipient) {
    if (!amount || amount <= 0) { toast('Ungültiger Betrag.', 'error'); return; }
    if (!recipient) { toast('Empfänger fehlt.', 'error'); return; }
    const fee = calcFee(amount);
    const total = amount + fee;
    if (wcState.balances[currency] < total) { toast('Insufficient balance', 'error'); return; }
    wcState.balances[currency] -= total;
    onInteraction(fee);
    addTx('SEND', currency, -(amount), `An: ${recipient}`);
    addTx('FEE',  currency, -fee,      'Send-Gebühr');
    toast(`✓ Send ${fmtNum(amount, 6)} ${currency} confirmed`);
}

// ─── Staking ──────────────────────────────────────────────────────────────────

const APY_TABLE = { 7: 0.03, 30: 0.06, 90: 0.10, 365: 0.12 };

function doStake(currency, amount, days) {
    if (!amount || amount <= 0) { toast('Ungültiger Betrag.', 'error'); return; }
    if (wcState.balances[currency] < amount) { toast('Insufficient balance', 'error'); return; }
    const apy = APY_TABLE[days] || 0.06;
    const reward = amount * apy * (days / 365);
    wcState.balances[currency] -= amount;
    const unlockAt = Date.now() + days * 86400000;
    wcState.stakes.push({ currency, amount, days, reward, unlockAt, staked: Date.now() });
    onInteraction(calcFee(amount));
    addTx('STAKE', currency, -amount, `Lockup ${days}d | APY ${(apy * 100).toFixed(0)}%`);
    saveState(wcState);
    toast(`✓ Stake ${fmtNum(amount, 6)} ${currency} für ${days} Tage confirmed`);
    renderStakeList();
}

function doUnstake(idx) {
    const st = wcState.stakes[idx];
    if (!st) { return; }
    if (Date.now() < st.unlockAt) {
        toast(`Noch ${Math.ceil((st.unlockAt - Date.now()) / 86400000)} Tage bis Unlock.`, 'error');
        return;
    }
    wcState.balances[st.currency] += st.amount + st.reward;
    wcState.stakes.splice(idx, 1);
    onInteraction(0);
    addTx('UNSTAKE', st.currency, st.amount + st.reward, `Reward: ${fmtNum(st.reward, 6)}`);
    saveState(wcState);
    toast(`✓ Unstake ${fmtNum(st.amount, 6)} + ${fmtNum(st.reward, 6)} Reward confirmed`);
    renderStakeList();
}

function renderStakeList() {
    const list = document.getElementById('wcStakeList');
    if (!list) { return; }
    list.replaceChildren();
    if (!wcState.stakes.length) {
        const li = document.createElement('li');
        li.style.color = 'var(--muted)';
        li.textContent = 'Keine aktiven Stakes.';
        list.appendChild(li);
        return;
    }
    wcState.stakes.forEach((st, i) => {
        const li = document.createElement('li');
        li.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;';
        const info = document.createElement('span');
        const remaining = Math.max(0, Math.ceil((st.unlockAt - Date.now()) / 86400000));
        info.textContent = `${fmtNum(st.amount, 4)} ${st.currency} | ${st.days}d | +${fmtNum(st.reward, 4)} | ${remaining > 0 ? remaining + 'd verbleibend' : 'Verfügbar!'}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = remaining > 0 ? 'secondary' : '';
        btn.style.cssText = 'padding:4px 10px;font-size:0.78rem;';
        btn.textContent = 'Unstake';
        btn.addEventListener('click', () => doUnstake(i));
        li.append(info, btn);
        list.appendChild(li);
    });
}

// ─── Admin Mint / Burn ────────────────────────────────────────────────────────

function doMint(currency, amount) {
    if (!amount || amount <= 0) { toast('Ungültiger Betrag.', 'error'); return; }
    wcState.balances[currency] += amount;
    onInteraction(0);
    addTx('MINT', currency, amount, 'Admin Mint');
    toast(`✓ Mint ${fmtNum(amount, 4)} ${currency} confirmed`);
}

function doBurn(currency, amount) {
    if (!amount || amount <= 0) { toast('Ungültiger Betrag.', 'error'); return; }
    if (wcState.balances[currency] < amount) { toast('Insufficient balance', 'error'); return; }
    wcState.balances[currency] -= amount;
    onInteraction(0);
    addTx('BURN', currency, -amount, 'Admin Burn');
    toast(`✓ Burn ${fmtNum(amount, 4)} ${currency} confirmed`);
}

// ─── BIP39 Seed Phrase ────────────────────────────────────────────────────────

function generateSeedPhrase() {
    const words = BIP39_WORDLIST;
    if (!words || words.length < 2048) {
        toast('BIP39-Wortliste nicht verfügbar.', 'error');
        return null;
    }
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    const phrase = Array.from(arr).map((n) => words[n % words.length]).join(' ');
    wcState.seedPhrase = phrase;
    sessionStorage.setItem('rfof_seed', phrase);
    deriveAddresses(phrase);
    saveState(wcState);
    return phrase;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

function deriveAddresses(phrase) {
    const h1 = simpleHash(phrase + 'btc');
    const h2 = simpleHash(phrase + 'eth');
    const h3 = simpleHash(phrase + 'rfof');
    wcState.addressBTC  = '1BTC' + h1.toUpperCase() + h1.toUpperCase();
    wcState.addressETH  = '0x' + h2 + h2 + h2 + h2 + h2.slice(0, 2);
    wcState.addressRFOF = 'rfof1' + h3 + h3;
    saveState(wcState);

    const btcEl  = document.getElementById('wcAddrBTC');
    const ethEl  = document.getElementById('wcAddrETH');
    const rfofEl = document.getElementById('wcAddrRFOF');
    if (btcEl)  { btcEl.textContent  = wcState.addressBTC; }
    if (ethEl)  { ethEl.textContent  = wcState.addressETH; }
    if (rfofEl) { rfofEl.textContent = wcState.addressRFOF; }

    // Update main wallet address display
    const walletAddr = document.getElementById('walletAddress');
    if (walletAddr) { walletAddr.textContent = wcState.addressRFOF; }
}

// ─── Charts ───────────────────────────────────────────────────────────────────

let chartInstances = {};
let chartDataMap  = {};
let chartIntervals = {};

function buildCandleData(n = 50) {
    const data = [];
    let price = Math.random() * 0.1;
    const now = Math.floor(Date.now() / 1000);
    for (let i = n; i >= 0; i--) {
        const o = price;
        const delta = (Math.random() - 0.48) * price * 0.15 + 0.0005;
        price = Math.max(0.0001, price + delta);
        const h = Math.max(o, price) * (1 + Math.random() * 0.05);
        const l = Math.min(o, price) * (1 - Math.random() * 0.05);
        data.push({ time: now - i * 60, open: o, high: h, low: l, close: price });
    }
    return data;
}

function initCharts(isAdminUser) {
    const LC = window.LightweightCharts;
    if (!LC) { return; }

    const currencies = isAdminUser
        ? ['RFOF', 'BTC', 'ETH', 'MTK', 'NEC']
        : ['RFOF', 'BTC', 'ETH', 'NEC'];

    const tabBar  = document.getElementById('wcChartTabs');
    const chartEl = document.getElementById('wcChartContainer');
    if (!tabBar || !chartEl) { return; }

    tabBar.replaceChildren();
    currencies.forEach((c, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = c;
        btn.className = idx === 0 ? 'active' : 'secondary';
        btn.style.cssText = 'margin-right:4px;padding:5px 14px;font-size:0.82rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;';
        btn.addEventListener('click', () => {
            tabBar.querySelectorAll('button').forEach((b) => { b.className = 'secondary'; b.style.background = 'var(--surface)'; });
            btn.className = 'active';
            switchChart(c, chartEl, LC);
        });
        tabBar.appendChild(btn);
        chartDataMap[c] = buildCandleData();
    });

    switchChart(currencies[0], chartEl, LC);
}

function switchChart(currency, container, LC) {
    // Destroy old
    if (chartInstances._current) {
        try { chartInstances._current.remove(); } catch (_) {}
    }
    Object.values(chartIntervals).forEach((id) => clearInterval(id));
    chartIntervals = {};

    container.innerHTML = '';
    const chart = LC.createChart(container, {
        width: container.clientWidth || 600,
        height: 260,
        layout: { background: { color: '#0b1220' }, textColor: '#9fb0ca' },
        grid: { vertLines: { color: 'rgba(148,163,184,0.12)' }, horzLines: { color: 'rgba(148,163,184,0.12)' } },
        crosshair: { mode: LC.CrosshairMode?.Normal },
        timeScale: { timeVisible: true, secondsVisible: false }
    });
    const series = chart.addCandlestickSeries({
        upColor: '#34d399', downColor: '#f87171',
        borderUpColor: '#34d399', borderDownColor: '#f87171',
        wickUpColor: '#34d399', wickDownColor: '#f87171'
    });
    series.setData(chartDataMap[currency]);
    chart.timeScale().fitContent();
    chartInstances._current = chart;

    // Live Random-Walk
    chartIntervals[currency] = setInterval(() => {
        const d = chartDataMap[currency];
        const last = d[d.length - 1];
        const delta = (Math.random() - 0.48) * last.close * 0.03 + 0.0001;
        const close = Math.max(0.0001, last.close + delta);
        const bar = {
            time: Math.floor(Date.now() / 1000),
            open: last.close,
            high: Math.max(last.close, close) * (1 + Math.random() * 0.01),
            low:  Math.min(last.close, close) * (1 - Math.random() * 0.01),
            close
        };
        d.push(bar);
        if (d.length > 300) { d.shift(); }
        series.update(bar);
        wcState.prices[currency] = close + wcState.interactions * PRICE_FACTOR;
        saveState(wcState);
        refreshBalanceDisplay();
    }, 2000);

    // Buy/Sell buttons
    const buyBtn  = document.getElementById('wcBuyBtn');
    const sellBtn = document.getElementById('wcSellBtn');
    const chartLabel = document.getElementById('wcChartCurrencyLabel');
    if (chartLabel) { chartLabel.textContent = currency; }
    if (buyBtn) {
        buyBtn.onclick = () => openChartTradeModal('buy', currency);
    }
    if (sellBtn) {
        sellBtn.onclick = () => openChartTradeModal('sell', currency);
    }
}

function openChartTradeModal(side, currency) {
    const modal = document.getElementById('wcTradeModal');
    const title = document.getElementById('wcTradeTitle');
    const info  = document.getElementById('wcTradeInfo');
    if (!modal) { return; }
    if (title) { title.textContent = `${side === 'buy' ? '📈 Kaufen' : '📉 Verkaufen'} ${currency}`; }
    if (info) {
        const price = wcState.prices[currency] || 0.001;
        info.textContent = `Aktueller Preis: $${fmtNum(price, 6)} | Dein ${currency}-Balance: ${fmtNum(wcState.balances[currency], 6)}`;
    }
    const amtInput = document.getElementById('wcTradeAmount');
    if (amtInput) { amtInput.value = ''; }
    const confirmBtn = document.getElementById('wcTradeConfirm');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const amount = parseFloat(amtInput?.value || '0');
            if (side === 'buy') {
                doDeposit(currency, amount);
            } else {
                doSend(currency, amount, 'MARKET_SELL');
            }
            modal.classList.remove('open');
            refreshBalanceDisplay();
        };
    }
    modal.classList.add('open');
}

// ─── 2FA EmailJS ─────────────────────────────────────────────────────────────

function send2FAEmail(toEmail, code) {
    const emailjs = window.emailjs;
    if (!emailjs) {
        // Fallback: zeige Code in Banner
        toast(`2FA-Code: ${code} (EmailJS nicht geladen)`, 'info');
        return;
    }
    const SERVICE_ID  = 'rfof_emailjs_service';
    const TEMPLATE_ID = 'rfof_2fa_template';
    const PUBLIC_KEY  = 'rfof_emailjs_key';

    emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        to_email: toEmail,
        code,
        to_name: 'RFOF User'
    }, PUBLIC_KEY)
        .then(() => toast(`2FA-Code an ${toEmail} gesendet!`))
        .catch(() => toast(`Demo-2FA-Code: ${code} (EmailJS-Konfiguration prüfen)`, 'info'));
}

// ─── Modal Helper ─────────────────────────────────────────────────────────────

function openModal(id) {
    document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
}

// ─── Nav-Status-Badge ─────────────────────────────────────────────────────────

function refreshLoginBadge() {
    const wcAuth = new AuthManager();
    const session = wcAuth.getSessionSummary();
    const badge = document.getElementById('wcLoginBadge');
    if (!badge) { return; }
    if (session) {
        badge.style.color = 'var(--success)';
        badge.textContent = `🟢 Logged in as ${session.username}`;
    } else {
        badge.style.color = 'var(--danger)';
        badge.textContent = '🔴 Not logged in';
    }
}

// ─── Main Mount ───────────────────────────────────────────────────────────────

function mount() {
    // ── Login Badge ──
    const topNav = document.getElementById('topNav');
    if (topNav && !document.getElementById('wcLoginBadge')) {
        const badge = document.createElement('span');
        badge.id = 'wcLoginBadge';
        badge.style.cssText = 'font-size:0.82rem;padding:4px 10px;border-radius:8px;background:var(--surface-strong);border:1px solid var(--border);';
        topNav.insertBefore(badge, topNav.querySelector('.nav-sep') || topNav.lastChild);
    }

    // ── Wallet Extension ──
    const walletSection = document.getElementById('walletSection');
    if (walletSection && !document.getElementById('wcBalanceGrid')) {
        const ext = document.createElement('div');
        ext.id = 'wcWalletExt';
        ext.innerHTML = `
<div id="wcPriceInfo" style="font-size:0.8rem;color:var(--muted);margin:8px 0;padding:6px 10px;background:var(--surface-strong);border-radius:8px;border:1px solid var(--border);">Interaktionen: 0 | Pool: 0 | Preis/Unit: $0.0000</div>
<div id="wcBalanceGrid" style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0;"></div>
<!-- Admin Mint/Burn -->
<div id="wcAdminRow" style="display:none;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:12px;background:var(--surface-strong);border:1px solid var(--border);border-radius:10px;">
  <strong style="display:block;margin-bottom:8px;">👑 Admin: Mint / Burn</strong>
  <select id="wcMintBurnCurrency" style="padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);">
    <option>RFOF</option><option>MTK</option><option>BTC</option><option>ETH</option><option>NEC</option>
  </select>
  <input id="wcMintBurnAmount" type="number" min="0" step="any" placeholder="Betrag" style="padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);width:120px;">
  <button type="button" id="wcMintBtn" style="padding:6px 14px;border-radius:6px;background:var(--success);color:#fff;border:none;cursor:pointer;">Mint</button>
  <button type="button" id="wcBurnBtn" style="padding:6px 14px;border-radius:6px;background:var(--danger);color:#fff;border:none;cursor:pointer;">Burn</button>
</div>
<!-- Mining Status -->
<div id="wcMiningStatus" style="font-size:0.85rem;color:var(--danger);margin:6px 0;">🔴 Mining gestoppt</div>
<!-- Charts -->
<h3 style="margin:18px 0 8px;">📊 Trading Charts</h3>
<div id="wcChartTabs" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px;"></div>
<div id="wcChartContainer" style="width:100%;height:260px;border-radius:10px;overflow:hidden;background:#0b1220;"></div>
<div style="display:flex;gap:8px;margin-top:8px;" id="wcChartCurrencyLabel_row">
  <span id="wcChartCurrencyLabel" style="font-size:0.85rem;color:var(--muted);padding:4px 8px;background:var(--surface-strong);border-radius:6px;">RFOF</span>
  <button type="button" id="wcBuyBtn" style="padding:5px 16px;border-radius:8px;background:var(--success);color:#fff;border:none;cursor:pointer;font-weight:600;">📈 Kaufen</button>
  <button type="button" id="wcSellBtn" style="padding:5px 16px;border-radius:8px;background:var(--danger);color:#fff;border:none;cursor:pointer;font-weight:600;">📉 Verkaufen</button>
</div>
<!-- Extended Tx History -->
<h3 style="margin:18px 0 8px;">📋 Wallet Transaktionen</h3>
<ul id="wcTxList" style="list-style:none;padding:0;margin:0;"></ul>
<!-- Stake List -->
<h3 style="margin:18px 0 8px;">🔒 Aktive Stakes</h3>
<ul id="wcStakeList" style="list-style:none;padding:0;margin:0;"></ul>
`;
        // Insert before rapp store
        const rappH = walletSection.querySelector('h3[style*="margin-top:22px"]');
        if (rappH) {
            walletSection.insertBefore(ext, rappH);
        } else {
            walletSection.appendChild(ext);
        }
    }

    // ── Extended Modals ──
    if (!document.getElementById('wcModals')) {
        const modals = document.createElement('div');
        modals.id = 'wcModals';
        modals.innerHTML = `
<!-- Deposit Modal -->
<div class="modal-backdrop" id="wcDepositModal" role="dialog" aria-modal="true">
  <div class="modal-box" style="max-width:380px;">
    <button class="modal-close" id="wcDepositClose" type="button">✕</button>
    <h3>⬇️ Deposit</h3>
    <div class="form-grid stack" style="margin-top:14px;">
      <label>Währung
        <select id="wcDepositCurrency" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);margin-top:4px;">
          <option>RFOF</option><option>BTC</option><option>ETH</option><option>NEC</option>
        </select>
      </label>
      <label>Betrag<input id="wcDepositAmount" type="number" min="0" step="any" style="width:100%;margin-top:4px;"></label>
      <div id="wcDepositFeeInfo" style="font-size:0.8rem;color:var(--muted);"></div>
      <button type="button" id="wcDepositConfirm">✓ Confirm Deposit</button>
    </div>
  </div>
</div>
<!-- Withdraw Modal -->
<div class="modal-backdrop" id="wcWithdrawModal" role="dialog" aria-modal="true">
  <div class="modal-box" style="max-width:380px;">
    <button class="modal-close" id="wcWithdrawClose" type="button">✕</button>
    <h3>⬆️ Withdraw</h3>
    <div class="form-grid stack" style="margin-top:14px;">
      <label>Währung
        <select id="wcWithdrawCurrency" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);margin-top:4px;">
          <option>RFOF</option><option>BTC</option><option>ETH</option><option>NEC</option>
        </select>
      </label>
      <label>Betrag<input id="wcWithdrawAmount" type="number" min="0" step="any" style="width:100%;margin-top:4px;"></label>
      <label>Ziel-Adresse<input id="wcWithdrawAddr" type="text" style="width:100%;margin-top:4px;"></label>
      <div id="wcWithdrawFeeInfo" style="font-size:0.8rem;color:var(--muted);"></div>
      <button type="button" id="wcWithdrawConfirm">✓ Confirm Withdraw</button>
    </div>
  </div>
</div>
<!-- Swap Modal -->
<div class="modal-backdrop" id="wcSwapModal" role="dialog" aria-modal="true">
  <div class="modal-box" style="max-width:400px;">
    <button class="modal-close" id="wcSwapClose" type="button">✕</button>
    <h3>🔄 Swap</h3>
    <div class="form-grid stack" style="margin-top:14px;">
      <label>Von
        <select id="wcSwapFrom" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);margin-top:4px;">
          <option>🟣 RFOF</option><option>🟠 BTC</option><option>🔵 ETH</option><option>🟡 NEC</option>
        </select>
      </label>
      <label>Zu
        <select id="wcSwapTo" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);margin-top:4px;">
          <option>🟠 BTC</option><option>🟣 RFOF</option><option>🔵 ETH</option><option>🟡 NEC</option>
        </select>
      </label>
      <label>Betrag<input id="wcSwapAmount" type="number" min="0" step="any" style="width:100%;margin-top:4px;"></label>
      <div id="wcSwapFeeInfo" style="font-size:0.8rem;color:var(--muted);"></div>
      <button type="button" id="wcSwapConfirm">✓ Confirm Swap</button>
    </div>
  </div>
</div>
<!-- Send Modal -->
<div class="modal-backdrop" id="wcSendModal" role="dialog" aria-modal="true">
  <div class="modal-box" style="max-width:400px;">
    <button class="modal-close" id="wcSendClose" type="button">✕</button>
    <h3>📤 Send</h3>
    <div class="form-grid stack" style="margin-top:14px;">
      <label>Währung
        <select id="wcSendCurrency" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);margin-top:4px;">
          <option>RFOF</option><option>BTC</option><option>ETH</option><option>NEC</option>
        </select>
      </label>
      <label>Empfänger-Adresse<input id="wcSendRecipient" type="text" style="width:100%;margin-top:4px;"></label>
      <label>Betrag<input id="wcSendAmount" type="number" min="0" step="any" style="width:100%;margin-top:4px;"></label>
      <div id="wcSendFeeInfo" style="font-size:0.8rem;color:var(--muted);"></div>
      <div id="wcSendHex" style="font-family:monospace;font-size:0.72rem;word-break:break-all;background:var(--surface-strong);padding:8px;border-radius:6px;display:none;margin-top:6px;"></div>
      <button type="button" id="wcSendConfirm">✓ Confirm Send</button>
    </div>
  </div>
</div>
<!-- Stake Modal -->
<div class="modal-backdrop" id="wcStakeModal" role="dialog" aria-modal="true">
  <div class="modal-box" style="max-width:380px;">
    <button class="modal-close" id="wcStakeClose" type="button">✕</button>
    <h3>🔒 Stake</h3>
    <div class="form-grid stack" style="margin-top:14px;">
      <label>Währung
        <select id="wcStakeCurrency" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);margin-top:4px;">
          <option>RFOF</option><option>BTC</option><option>ETH</option><option>NEC</option>
        </select>
      </label>
      <label>Betrag<input id="wcStakeAmount" type="number" min="0" step="any" style="width:100%;margin-top:4px;"></label>
      <label>Lockup-Zeit
        <select id="wcStakeDays" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);margin-top:4px;">
          <option value="7">7 Tage – APY 3%</option>
          <option value="30">30 Tage – APY 6%</option>
          <option value="90">90 Tage – APY 10%</option>
          <option value="365">365 Tage – APY 12%</option>
        </select>
      </label>
      <div id="wcStakeAPYInfo" style="font-size:0.82rem;color:var(--muted);"></div>
      <button type="button" id="wcStakeConfirm">✓ Stake</button>
    </div>
  </div>
</div>
<!-- Trade Modal (Charts Buy/Sell) -->
<div class="modal-backdrop" id="wcTradeModal" role="dialog" aria-modal="true">
  <div class="modal-box" style="max-width:360px;">
    <button class="modal-close" id="wcTradeClose" type="button">✕</button>
    <h3 id="wcTradeTitle">Trade</h3>
    <div id="wcTradeInfo" style="font-size:0.85rem;color:var(--muted);margin:10px 0;"></div>
    <label>Betrag<input id="wcTradeAmount" type="number" min="0" step="any" style="width:100%;margin-top:4px;"></label>
    <button type="button" id="wcTradeConfirm" style="margin-top:14px;width:100%;">✓ Bestätigen</button>
  </div>
</div>
<!-- Seed Phrase Modal -->
<div class="modal-backdrop" id="wcSeedModal" role="dialog" aria-modal="true">
  <div class="modal-box" style="max-width:480px;">
    <button class="modal-close" id="wcSeedClose" type="button">✕</button>
    <h3>🌱 Seed-Phrase Generator</h3>
    <p style="font-size:0.85rem;color:var(--muted);">Klicke auf "Generieren" um eine neue 12-Wort BIP39-Phrase zu erstellen.</p>
    <button type="button" id="wcSeedGenerate" style="margin-bottom:12px;">🔑 Phrase generieren</button>
    <div id="wcSeedDisplay" style="display:none;">
      <div id="wcSeedText" style="font-family:monospace;background:var(--surface-strong);padding:14px;border-radius:10px;word-break:break-all;font-size:0.9rem;line-height:1.7;"></div>
      <button type="button" id="wcSeedCopy" class="secondary" style="margin-top:8px;">📋 Kopieren</button>
      <div style="margin-top:14px;font-size:0.82rem;">
        <div style="margin-bottom:6px;"><strong>🟠 BTC-Adresse:</strong> <span id="wcAddrBTC" style="font-family:monospace;color:var(--accent);word-break:break-all;">-</span></div>
        <div style="margin-bottom:6px;"><strong>🔵 ETH-Adresse:</strong> <span id="wcAddrETH" style="font-family:monospace;color:var(--accent);word-break:break-all;">-</span></div>
        <div><strong>🟣 RFOF-Adresse:</strong> <span id="wcAddrRFOF" style="font-family:monospace;color:var(--accent);word-break:break-all;">-</span></div>
      </div>
    </div>
  </div>
</div>
`;
        document.body.appendChild(modals);
    }

    // ── Seed-Phrase Button in Settings ──
    const seedTab = document.getElementById('settingsSeed');
    if (seedTab && !document.getElementById('wcSeedOpenBtn')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'wcSeedOpenBtn';
        btn.className = 'secondary';
        btn.style.marginTop = '10px';
        btn.textContent = '🔑 Neue Seed-Phrase generieren';
        btn.addEventListener('click', () => openModal('wcSeedModal'));
        seedTab.querySelector('.form-grid')?.appendChild(btn);
    }

    // ── Existing wallet buttons: override mining & add currency dropdowns ──
    wireUpButtons();

    // ── Event Listeners ──
    wireModalEvents();

    // ── Periodic refresh ──
    setInterval(() => {
        refreshLoginBadge();
        refreshBalanceDisplay();
        renderTxHistoryWC();
        renderStakeList();
    }, 2000);

    refreshLoginBadge();
    refreshBalanceDisplay();
    renderTxHistoryWC();
    renderStakeList();

    // Restore mining if it was active
    if (wcState.miningActive) { startMining(); }

    // Init charts when wallet view is shown
    const navWallet = document.getElementById('navWallet');
    if (navWallet) {
        navWallet.addEventListener('click', () => {
            setTimeout(initChartsForCurrentUser, 200);
        });
    }
    // Also try to init if already on wallet view
    setTimeout(initChartsForCurrentUser, 500);
}

function initChartsForCurrentUser() {
    if (!document.getElementById('wcChartContainer')) { return; }
    const wcAuth = new AuthManager();
    const session = wcAuth.getSessionSummary();
    if (session) { initCharts(isAdmin(session)); }
}

function getCurrencyFromSelect(selId) {
    const raw = document.getElementById(selId)?.value || 'RFOF';
    return raw.replace(/^[^\w]+/, '').trim().split(' ')[0];
}

function wireUpButtons() {
    // Override existing mining buttons
    document.querySelectorAll('.wallet-btn[data-action="mining_start"]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); startMining(); });
    });
    document.querySelectorAll('.wallet-btn[data-action="mining_stop"]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); stopMining(); });
    });

    // Override deposit / withdraw / swap / send / stake / unstake
    document.querySelectorAll('.wallet-btn[data-action="deposit"]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); openModal('wcDepositModal'); });
    });
    document.querySelectorAll('.wallet-btn[data-action="withdraw"]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); openModal('wcWithdrawModal'); });
    });
    document.querySelectorAll('.wallet-btn[data-action="swap"]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); openModal('wcSwapModal'); });
    });
    document.querySelectorAll('.wallet-btn[data-action="send"]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); openModal('wcSendModal'); });
    });
    document.querySelectorAll('.wallet-btn[data-action="stake"]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); openModal('wcStakeModal'); });
    });

    // Admin currency options
    addAdminCurrencyOption('wcDepositCurrency');
    addAdminCurrencyOption('wcWithdrawCurrency');
    addAdminCurrencyOption('wcSendCurrency');
    addAdminCurrencyOption('wcStakeCurrency');
    addAdminSwapCurrencyOptions();
    addAdminMintBurnCurrencyOption();
}

function addAdminCurrencyOption(selId) {
    const wcAuth = new AuthManager();
    const session = wcAuth.getSessionSummary();
    if (!isAdmin(session)) { return; }
    const sel = document.getElementById(selId);
    if (!sel || sel.querySelector('option[value="MTK"]')) { return; }
    const opt = document.createElement('option');
    opt.value = 'MTK'; opt.textContent = '⚪ MTK';
    sel.appendChild(opt);
}

function addAdminSwapCurrencyOptions() {
    const wcAuth = new AuthManager();
    const session = wcAuth.getSessionSummary();
    if (!isAdmin(session)) { return; }
    ['wcSwapFrom','wcSwapTo'].forEach((id) => {
        const sel = document.getElementById(id);
        if (!sel || sel.querySelector('option[value="⚪ MTK"]')) { return; }
        const opt = document.createElement('option');
        opt.value = '⚪ MTK'; opt.textContent = '⚪ MTK';
        sel.appendChild(opt);
    });
}

function addAdminMintBurnCurrencyOption() {
    // already has MTK option
}

function wireModalEvents() {
    // Close buttons
    ['wcDepositClose','wcWithdrawClose','wcSwapClose','wcSendClose','wcStakeClose','wcTradeClose','wcSeedClose'].forEach((id) => {
        document.getElementById(id)?.addEventListener('click', () => {
            document.getElementById(id)?.closest('.modal-backdrop')?.classList.remove('open');
        });
    });

    // Backdrop click closes
    document.addEventListener('click', (e) => {
        if (e.target.id && e.target.id.startsWith('wc') && e.target.classList.contains('modal-backdrop')) {
            e.target.classList.remove('open');
        }
    });

    // Fee preview
    document.getElementById('wcDepositAmount')?.addEventListener('input', (e) => {
        const fee = calcFee(parseFloat(e.target.value) || 0);
        const el = document.getElementById('wcDepositFeeInfo');
        if (el) { el.textContent = `Gebühr: ${fmtNum(fee, 6)} (${(FEE_RATE * 100).toFixed(1)}%)`; }
    });
    document.getElementById('wcWithdrawAmount')?.addEventListener('input', (e) => {
        const fee = calcFee(parseFloat(e.target.value) || 0);
        const el = document.getElementById('wcWithdrawFeeInfo');
        if (el) { el.textContent = `Gebühr: ${fmtNum(fee, 6)} (${(FEE_RATE * 100).toFixed(1)}%)`; }
    });
    document.getElementById('wcSwapAmount')?.addEventListener('input', (e) => {
        const fee = calcFee(parseFloat(e.target.value) || 0) * 2;
        const el = document.getElementById('wcSwapFeeInfo');
        if (el) { el.textContent = `Gebühr: ${fmtNum(fee, 6)} (beide Seiten)`; }
    });
    document.getElementById('wcSendAmount')?.addEventListener('input', (e) => {
        const amount = parseFloat(e.target.value) || 0;
        const fee = calcFee(amount);
        const el = document.getElementById('wcSendFeeInfo');
        if (el) { el.textContent = `Gebühr: ${fmtNum(fee, 6)}`; }
        const hexEl = document.getElementById('wcSendHex');
        if (hexEl && amount > 0) {
            hexEl.style.display = '';
            const cur = getCurrencyFromSelect('wcSendCurrency');
            hexEl.textContent = `0x${simpleHash(cur + amount + Date.now())}${simpleHash(wcState.addressRFOF || 'rfof')}`.padEnd(64, '0');
        }
    });
    document.getElementById('wcStakeAmount')?.addEventListener('input', (e) => {
        const amount = parseFloat(e.target.value) || 0;
        const days = parseInt(document.getElementById('wcStakeDays')?.value || '30', 10);
        const apy = APY_TABLE[days] || 0.06;
        const reward = amount * apy * (days / 365);
        const el = document.getElementById('wcStakeAPYInfo');
        if (el) { el.textContent = `APY ${(apy * 100).toFixed(0)}% → Reward: ~${fmtNum(reward, 6)}`; }
    });
    document.getElementById('wcStakeDays')?.addEventListener('change', () => {
        document.getElementById('wcStakeAmount')?.dispatchEvent(new Event('input'));
    });

    // Confirm buttons
    document.getElementById('wcDepositConfirm')?.addEventListener('click', () => {
        const cur = getCurrencyFromSelect('wcDepositCurrency');
        const amt = parseFloat(document.getElementById('wcDepositAmount')?.value || '0');
        doDeposit(cur, amt);
        closeModal('wcDepositModal');
        refreshBalanceDisplay();
    });
    document.getElementById('wcWithdrawConfirm')?.addEventListener('click', () => {
        const cur = getCurrencyFromSelect('wcWithdrawCurrency');
        const amt = parseFloat(document.getElementById('wcWithdrawAmount')?.value || '0');
        doWithdraw(cur, amt);
        closeModal('wcWithdrawModal');
        refreshBalanceDisplay();
    });
    document.getElementById('wcSwapConfirm')?.addEventListener('click', () => {
        const from = getCurrencyFromSelect('wcSwapFrom');
        const to   = getCurrencyFromSelect('wcSwapTo');
        const amt  = parseFloat(document.getElementById('wcSwapAmount')?.value || '0');
        doSwap(from, to, amt);
        closeModal('wcSwapModal');
        refreshBalanceDisplay();
    });
    document.getElementById('wcSendConfirm')?.addEventListener('click', () => {
        const cur  = getCurrencyFromSelect('wcSendCurrency');
        const addr = document.getElementById('wcSendRecipient')?.value || '';
        const amt  = parseFloat(document.getElementById('wcSendAmount')?.value || '0');
        doSend(cur, amt, addr);
        closeModal('wcSendModal');
        refreshBalanceDisplay();
    });
    document.getElementById('wcStakeConfirm')?.addEventListener('click', () => {
        const cur  = getCurrencyFromSelect('wcStakeCurrency');
        const amt  = parseFloat(document.getElementById('wcStakeAmount')?.value || '0');
        const days = parseInt(document.getElementById('wcStakeDays')?.value || '30', 10);
        doStake(cur, amt, days);
        closeModal('wcStakeModal');
        refreshBalanceDisplay();
    });

    // Admin Mint/Burn
    document.getElementById('wcMintBtn')?.addEventListener('click', () => {
        const cur = document.getElementById('wcMintBurnCurrency')?.value || 'MTK';
        const amt = parseFloat(document.getElementById('wcMintBurnAmount')?.value || '0');
        doMint(cur, amt);
        refreshBalanceDisplay();
    });
    document.getElementById('wcBurnBtn')?.addEventListener('click', () => {
        const cur = document.getElementById('wcMintBurnCurrency')?.value || 'MTK';
        const amt = parseFloat(document.getElementById('wcMintBurnAmount')?.value || '0');
        doBurn(cur, amt);
        refreshBalanceDisplay();
    });

    // Seed Phrase
    document.getElementById('wcSeedGenerate')?.addEventListener('click', () => {
        const phrase = generateSeedPhrase();
        if (!phrase) { return; }
        const display = document.getElementById('wcSeedDisplay');
        const text    = document.getElementById('wcSeedText');
        if (display) { display.style.display = ''; }
        if (text)    { text.textContent = phrase; }
    });
    document.getElementById('wcSeedCopy')?.addEventListener('click', () => {
        const phrase = document.getElementById('wcSeedText')?.textContent || '';
        navigator.clipboard?.writeText(phrase)
            .then(() => toast('Seed-Phrase kopiert!'))
            .catch(() => toast('Kopieren fehlgeschlagen.', 'error'));
    });
}

// ─── Toast Styles (injected once) ─────────────────────────────────────────────

function injectStyles() {
    if (document.getElementById('wc-styles')) { return; }
    const style = document.createElement('style');
    style.id = 'wc-styles';
    style.textContent = `
.wc-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
  animation: wc-fadein 0.3s ease, wc-fadeout 0.4s ease 3.1s forwards;
}
.wc-toast-success { background: #059669; }
.wc-toast-error   { background: #dc2626; }
.wc-toast-info    { background: #2563eb; }
@keyframes wc-fadein  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes wc-fadeout { from { opacity:1; } to { opacity:0; } }
`;
    document.head.appendChild(style);
}

// ─── Genesis Block Panel (adds to Explorer if present) ────────────────────────

function mountGenesisPanel() {
    const explorer = document.getElementById('explorerSection');
    if (!explorer || document.getElementById('wcGenesisPanel')) { return; }
    const panel = document.createElement('div');
    panel.id = 'wcGenesisPanel';
    panel.style.cssText = 'margin-top:22px;padding:14px;background:var(--surface-strong);border:1px solid var(--border);border-radius:12px;';
    const heading = document.createElement('h3');
    heading.textContent = '🏛️ SatoramyLedger Genesis-Blöcke';
    heading.style.marginTop = '0';
    panel.appendChild(heading);
    GENESIS_BLOCKS.forEach((b) => {
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:0.8rem;';
        const title = document.createElement('strong');
        title.textContent = `Block ${b.index}`;
        const hash = document.createElement('div');
        hash.style.cssText = 'font-family:monospace;word-break:break-all;color:var(--accent);margin:4px 0;';
        hash.textContent = b.hash;
        const data = document.createElement('div');
        data.style.color = 'var(--muted)';
        data.textContent = b.data;
        card.append(title, hash, data);
        panel.appendChild(card);
    });
    explorer.appendChild(panel);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

injectStyles();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
} else {
    mount();
}

// Also re-mount when session changes (login/logout)
setInterval(() => {
    if (!document.getElementById('wcLoginBadge')) { mount(); }
    refreshLoginBadge();
    mountGenesisPanel();
}, 3000);
