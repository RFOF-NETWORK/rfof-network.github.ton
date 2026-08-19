import { BIP39_WORDLIST, BIP39_WORD_COUNT } from './bip39_wordlist.js';

const textEncoder = new TextEncoder();
const USERS_KEY = 'rfof_auth_users_v1';
const SESSION_KEY = 'rfof_auth_session_v1';
const LOGS_KEY = 'rfof_auth_logs_v1';
const OAUTH_STATE_KEY = 'rfof_auth_oauth_state_v1';
const CHAT_KEY = 'rfof_auth_chat_v1';
const CHAT_USAGE_KEY = 'rfof_auth_chat_usage_v1';
const CHAT_AUTONOMY_KEY = 'rfof_auth_chat_autonomy_v1';
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOG_LIMIT = 200;
const CHAT_HISTORY_ENTRY_LIMIT = 120;
const USER_CHAT_DAILY_MESSAGE_LIMIT = 40;
const USER_CHAT_DAILY_TOKEN_LIMIT = 12_000;
const USER_CHAT_INPUT_CHAR_LIMIT = 1_200;
const OAUTH_PROVIDERS = Object.freeze(['github', 'google', 'microsoft']);

function getCryptoApi() {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Web Crypto API ist in dieser Umgebung nicht verfügbar.');
    }
    return globalThis.crypto;
}

function toArrayBufferView(value) {
    return textEncoder.encode(String(value ?? ''));
}

function bytesToHex(bytes) {
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}

function bytesToBase64(bytes) {
    if (typeof btoa === 'function') {
        let binary = '';
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }
    return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value) {
    if (typeof atob === 'function') {
        const binary = atob(value);
        return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }
    return Uint8Array.from(Buffer.from(value, 'base64'));
}

function toBase64Url(bytes) {
    return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4 || 4)) % 4;
    return base64ToBytes(`${normalized}${'='.repeat(padding)}`);
}

function isoNow(nowProvider = () => Date.now()) {
    return new Date(nowProvider()).toISOString();
}

function dayStamp(nowProvider = () => Date.now()) {
    return new Date(nowProvider()).toISOString().slice(0, 10);
}

function estimateTokenCount(text) {
    const value = String(text ?? '').trim();
    if (!value) {
        return 0;
    }
    return Math.max(1, Math.ceil(value.length / 4));
}

function safeJsonParse(value, fallback) {
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeOAuthProvider(providerInput) {
    const provider = String(providerInput ?? '').toLowerCase().trim();
    if (!OAUTH_PROVIDERS.includes(provider)) {
        throw new Error('Unbekannter OAuth2-Provider.');
    }
    return provider;
}

function normalizeOauthStateStore(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    const normalized = {};
    Object.entries(value).forEach(([key, entry]) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }

        try {
            if (typeof entry.provider === 'string') {
                normalized[String(key)] = {
                    provider: normalizeOAuthProvider(entry.provider),
                    createdAt: Number(entry.createdAt) || 0,
                    expiresAt: Number(entry.expiresAt) || 0
                };
                return;
            }

            if (typeof entry.token === 'string') {
                normalized[entry.token] = {
                    provider: normalizeOAuthProvider(key),
                    createdAt: Number(entry.createdAt) || 0,
                    expiresAt: Number(entry.expiresAt) || 0
                };
            }
        } catch {
            // Ignoriere ungültige oder veraltete State-Einträge.
        }
    });

    return normalized;
}

function buildOauthUsername(profile, provider, subject) {
    const candidates = [
        profile?.username,
        profile?.preferredUsername,
        profile?.email ? String(profile.email).split('@')[0] : '',
        `${provider}_${subject}`.replace(/[^A-Za-z0-9._@-]/g, '')
    ];
    for (const candidate of candidates) {
        const sanitized = sanitizeUsername(candidate);
        if (sanitized) {
            return sanitized;
        }
    }
    return `${provider}_${String(subject).slice(0, 12)}`.replace(/[^A-Za-z0-9._@-]/g, '');
}

export function createMemoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        clear() {
            values.clear();
        }
    };
}

export function sanitizeUsername(rawValue) {
    const normalized = String(rawValue ?? '').normalize('NFKC').trim();
    if (!/^[A-Za-z0-9._@-]{3,32}$/.test(normalized)) {
        return '';
    }
    return normalized;
}

export function passwordStrength(password) {
    const value = String(password ?? '').normalize('NFKC');
    const checks = {
        length: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /\d/.test(value),
        special: /[^A-Za-z0-9]/.test(value)
    };
    const score = Object.values(checks).filter(Boolean).length;
    const valid = Object.values(checks).every(Boolean);
    const labels = ['Sehr schwach', 'Schwach', 'Okay', 'Gut', 'Stark'];
    return {
        valid,
        score,
        checks,
        label: labels[Math.max(0, Math.min(labels.length - 1, score - 1))] || 'Sehr schwach'
    };
}

async function digestHex(algorithm, value) {
    const cryptoApi = getCryptoApi();
    const digest = await cryptoApi.subtle.digest(algorithm, toArrayBufferView(value));
    return bytesToHex(new Uint8Array(digest));
}

export async function sha256Hex(value) {
    return digestHex('SHA-256', value);
}

export async function sha512Hex(value) {
    return digestHex('SHA-512', value);
}

export function createCsrfToken(byteLength = 32) {
    const cryptoApi = getCryptoApi();
    const bytes = new Uint8Array(byteLength);
    cryptoApi.getRandomValues(bytes);
    return toBase64Url(bytes);
}

export function createSalt(byteLength = 16) {
    const cryptoApi = getCryptoApi();
    const bytes = new Uint8Array(byteLength);
    cryptoApi.getRandomValues(bytes);
    return toBase64Url(bytes);
}

export async function doubleHashPassword(password, salt) {
    const normalizedPassword = String(password ?? '').normalize('NFKC');
    const sha256 = await sha256Hex(`${salt}:${normalizedPassword}`);
    const sha512 = await sha512Hex(`${sha256}:${salt}`);
    return {
        sha256,
        sha512,
        algorithm: 'SHA-256 -> SHA-512'
    };
}

async function deriveAesKey(secretMaterial, salt) {
    const keyHex = await sha256Hex(`${secretMaterial}:${salt}:aes-256-gcm`);
    return getCryptoApi().subtle.importKey(
        'raw',
        hexToBytes(keyHex),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptSensitiveData(plainText, secretMaterial, salt) {
    const cryptoApi = getCryptoApi();
    const iv = new Uint8Array(12);
    cryptoApi.getRandomValues(iv);
    const key = await deriveAesKey(secretMaterial, salt);
    const encrypted = await cryptoApi.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        toArrayBufferView(plainText)
    );
    return {
        algorithm: 'AES-256-GCM',
        iv: bytesToBase64(new Uint8Array(iv)),
        cipherText: bytesToBase64(new Uint8Array(encrypted))
    };
}

export async function decryptSensitiveData(payload, secretMaterial, salt) {
    const key = await deriveAesKey(secretMaterial, salt);
    const decrypted = await getCryptoApi().subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
        key,
        base64ToBytes(payload.cipherText)
    );
    return new TextDecoder().decode(decrypted);
}

export class AuthManager {
    constructor({
        storage = globalThis.localStorage,
        now = () => Date.now(),
        sessionTimeoutMs = SESSION_TIMEOUT_MS,
        lockoutMs = LOCKOUT_MS,
        maxFailedAttempts = MAX_FAILED_ATTEMPTS,
        chatUserDailyMessageLimit = USER_CHAT_DAILY_MESSAGE_LIMIT,
        chatUserDailyTokenLimit = USER_CHAT_DAILY_TOKEN_LIMIT,
        chatUserInputCharLimit = USER_CHAT_INPUT_CHAR_LIMIT
    } = {}) {
        if (!storage) {
            throw new Error('localStorage ist nicht verfügbar.');
        }
        this.storage = storage;
        this.now = now;
        this.sessionTimeoutMs = sessionTimeoutMs;
        this.lockoutMs = lockoutMs;
        this.maxFailedAttempts = maxFailedAttempts;
        this.chatUserDailyMessageLimit = chatUserDailyMessageLimit;
        this.chatUserDailyTokenLimit = chatUserDailyTokenLimit;
        this.chatUserInputCharLimit = chatUserInputCharLimit;
    }

    getUsers() {
        return safeJsonParse(this.storage.getItem(USERS_KEY), []);
    }

    saveUsers(users) {
        this.storage.setItem(USERS_KEY, JSON.stringify(users));
    }

    getLogs() {
        return safeJsonParse(this.storage.getItem(LOGS_KEY), []);
    }

    saveLogs(logs) {
        this.storage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, LOG_LIMIT)));
    }

    getOauthState() {
        return normalizeOauthStateStore(safeJsonParse(this.storage.getItem(OAUTH_STATE_KEY), {}));
    }

    saveOauthState(value) {
        this.storage.setItem(OAUTH_STATE_KEY, JSON.stringify(normalizeOauthStateStore(value)));
    }

    getChatStore() {
        return safeJsonParse(this.storage.getItem(CHAT_KEY), {});
    }

    saveChatStore(value) {
        this.storage.setItem(CHAT_KEY, JSON.stringify(value || {}));
    }

    getChatUsageStore() {
        return safeJsonParse(this.storage.getItem(CHAT_USAGE_KEY), {});
    }

    saveChatUsageStore(value) {
        this.storage.setItem(CHAT_USAGE_KEY, JSON.stringify(value || {}));
    }

    getChatAutonomyStore() {
        return safeJsonParse(this.storage.getItem(CHAT_AUTONOMY_KEY), {});
    }

    saveChatAutonomyStore(value) {
        this.storage.setItem(CHAT_AUTONOMY_KEY, JSON.stringify(value || {}));
    }

    getSession() {
        const session = safeJsonParse(this.storage.getItem(SESSION_KEY), null);
        if (!session) {
            return null;
        }
        if (session.expiresAt <= this.now()) {
            this._appendLog('AUTO_LOGOUT', 'success', session.username, 'Session Timeout');
            this.clearSession();
            return null;
        }
        return session;
    }

    clearSession() {
        this.storage.removeItem(SESSION_KEY);
    }

    _appendLog(action, status, username, details = '') {
        const logs = this.getLogs();
        logs.unshift({
            action,
            status,
            username: username || 'anonymous',
            details,
            timestamp: isoNow(this.now)
        });
        this.saveLogs(logs);
    }

    _validateStateToken(csrfToken) {
        const session = this.getSession();
        if (!session || session.csrfToken !== csrfToken) {
            throw new Error('Ungültiger CSRF-Token. Bitte erneut anmelden.');
        }
        return session;
    }

    _createSession(user, route = {}) {
        const timestamp = this.now();
        const session = {
            username: user.username,
            role: user.role,
            authRoute: route.authRoute || 'system',
            authProvider: route.authProvider || null,
            csrfToken: createCsrfToken(),
            createdAt: timestamp,
            lastActivityAt: timestamp,
            expiresAt: timestamp + this.sessionTimeoutMs
        };
        this.storage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    _findUser(username) {
        const users = this.getUsers();
        return {
            users,
            index: users.findIndex((user) => user.username === username)
        };
    }

    _getChatQuota(role) {
        if (role === 'admin') {
            return {
                unlimited: true,
                dailyMessageLimit: null,
                dailyTokenLimit: null,
                inputCharLimit: 8_000
            };
        }
        return {
            unlimited: false,
            dailyMessageLimit: this.chatUserDailyMessageLimit,
            dailyTokenLimit: this.chatUserDailyTokenLimit,
            inputCharLimit: this.chatUserInputCharLimit
        };
    }

    _getOrCreateUsageRecord(username, role) {
        const usageStore = this.getChatUsageStore();
        const today = dayStamp(this.now);
        const current = usageStore[username];
        if (!current || current.day !== today) {
            usageStore[username] = {
                day: today,
                messageCount: 0,
                tokenCount: 0
            };
            this.saveChatUsageStore(usageStore);
            return usageStore[username];
        }
        return current;
    }

    _saveUsageRecord(username, record) {
        const usageStore = this.getChatUsageStore();
        usageStore[username] = record;
        this.saveChatUsageStore(usageStore);
    }

    _generatePraiaiResponse(message, session) {
        const text = String(message ?? '').trim();
        const lower = text.toLowerCase();
        const base = `PRAIAI (${session.role}) verarbeitet deine Nachricht lokal im Demo-Modus.`;
        if (lower.includes('token') || lower.includes('tokenizer')) {
            return `${base} Tokenizer-Check aktiv: ca. ${estimateTokenCount(text)} Input-Tokens erkannt; bei Bedarf kann ich die Eingabe weiter strukturieren.`;
        }
        if (lower.includes('admin')) {
            return `${base} Admin-Flow erkannt: Audit-Logs, Export und Rollenprüfung sind bereit; Quota bleibt für Admin unbegrenzt.`;
        }
        if (lower.includes('help') || lower.includes('hilfe')) {
            return `${base} Ich kann dir bei Wallet, Explorer, Security-Flow, OAuth2 und Settings direkt im Frontend helfen.`;
        }
        return `${base} Antwort generiert: "${text.slice(0, 180)}"${text.length > 180 ? '…' : ''}`;
    }

    _runSilentAutonomy(session, userMessage, assistantMessage) {
        const text = `${String(userMessage ?? '')} ${String(assistantMessage ?? '')}`.toLowerCase();
        let topic = '';
        if (text.includes('wallet') || text.includes('send') || text.includes('swap')) {
            topic = 'wallet';
        } else if (text.includes('admin') || text.includes('audit') || text.includes('role')) {
            topic = 'admin';
        } else if (text.includes('security') || text.includes('passwort') || text.includes('2fa')) {
            topic = 'security';
        } else if (text.includes('tokenizer') || text.includes('token')) {
            topic = 'tokenizer';
        }
        if (!topic) {
            return;
        }
        const autonomyStore = this.getChatAutonomyStore();
        const current = Array.isArray(autonomyStore[session.username]) ? autonomyStore[session.username] : [];
        current.unshift({
            topic,
            createdAt: isoNow(this.now),
            summary: `Silent-Autonomy erkannte Fokus: ${topic}`
        });
        autonomyStore[session.username] = current.slice(0, 20);
        this.saveChatAutonomyStore(autonomyStore);
        this._appendLog('PRAIAI_AUTONOMY', 'info', session.username, `Thema: ${topic}`);
    }

    getOAuthProviders() {
        return [...OAUTH_PROVIDERS];
    }

    getChatUsage(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const quota = this._getChatQuota(session.role);
        const usage = this._getOrCreateUsageRecord(session.username, session.role);
        return {
            day: usage.day,
            role: session.role,
            unlimited: quota.unlimited,
            usedMessages: usage.messageCount,
            usedTokens: usage.tokenCount,
            remainingMessages: quota.unlimited ? null : Math.max(0, quota.dailyMessageLimit - usage.messageCount),
            remainingTokens: quota.unlimited ? null : Math.max(0, quota.dailyTokenLimit - usage.tokenCount),
            inputCharLimit: quota.inputCharLimit
        };
    }

    getChatMessages(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const chatStore = this.getChatStore();
        const messages = Array.isArray(chatStore[session.username]) ? chatStore[session.username] : [];
        return messages.map((entry) => ({ ...entry }));
    }

    sendChatMessage(messageInput, csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const message = String(messageInput ?? '').trim();
        const quota = this._getChatQuota(session.role);
        if (!message) {
            throw new Error('Nachricht darf nicht leer sein.');
        }
        if (message.length > quota.inputCharLimit) {
            throw new Error(`Nachricht zu lang (max. ${quota.inputCharLimit} Zeichen).`);
        }

        const usage = this._getOrCreateUsageRecord(session.username, session.role);
        if (!quota.unlimited && usage.messageCount >= quota.dailyMessageLimit) {
            this._appendLog('PRAIAI_CHAT', 'denied', session.username, 'Tageslimit Nachrichten erreicht');
            throw new Error('Tageslimit für Nachrichten erreicht.');
        }

        const inputTokens = estimateTokenCount(message);
        const assistantText = this._generatePraiaiResponse(message, session);
        const outputTokens = estimateTokenCount(assistantText);
        const totalTokens = inputTokens + outputTokens;
        if (!quota.unlimited && (usage.tokenCount + totalTokens) > quota.dailyTokenLimit) {
            this._appendLog('PRAIAI_CHAT', 'denied', session.username, 'Token-Limit erreicht');
            throw new Error('Tageslimit für Tokens erreicht.');
        }
        const chatStore = this.getChatStore();
        const current = Array.isArray(chatStore[session.username]) ? chatStore[session.username] : [];
        const nowIsoValue = isoNow(this.now);
        current.push(
            {
                role: 'user',
                content: message,
                timestamp: nowIsoValue,
                tokens: inputTokens
            },
            {
                role: 'assistant',
                content: assistantText,
                timestamp: nowIsoValue,
                tokens: outputTokens
            }
        );
        chatStore[session.username] = current.slice(-CHAT_HISTORY_ENTRY_LIMIT);
        this.saveChatStore(chatStore);

        usage.messageCount += 1;
        usage.tokenCount += totalTokens;
        this._saveUsageRecord(session.username, usage);
        this._appendLog('PRAIAI_CHAT', 'success', session.username, `Nachricht verarbeitet (+${totalTokens} Tokens)`);
        this._runSilentAutonomy(session, message, assistantText);

        return {
            assistantMessage: assistantText,
            usage: this.getChatUsage(csrfToken)
        };
    }

    getAutonomyEvents(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const autonomyStore = this.getChatAutonomyStore();
        if (session.role === 'admin') {
            return Object.entries(autonomyStore).flatMap(([username, events]) => (
                Array.isArray(events)
                    ? events.map((entry) => ({ username, ...entry }))
                    : []
            )).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        }
        return (Array.isArray(autonomyStore[session.username]) ? autonomyStore[session.username] : []).map((entry) => ({ ...entry }));
    }

    createOAuthState(providerInput) {
        const provider = normalizeOAuthProvider(providerInput);
        const token = createCsrfToken(24);
        const oauthState = this.getOauthState();
        const nowValue = this.now();
        oauthState[token] = {
            provider,
            createdAt: this.now(),
            expiresAt: nowValue + (10 * 60 * 1000)
        };
        this.saveOauthState(oauthState);
        return token;
    }

    consumeOAuthState(providerInput, stateToken) {
        const provider = normalizeOAuthProvider(providerInput);
        const oauthState = this.getOauthState();
        const nowValue = this.now();
        let updated = false;

        Object.entries(oauthState).forEach(([token, entry]) => {
            if (entry.expiresAt <= nowValue) {
                delete oauthState[token];
                updated = true;
            }
        });

        const token = String(stateToken ?? '').trim();
        const current = oauthState[token];
        if (!current || current.provider !== provider) {
            if (updated) {
                this.saveOauthState(oauthState);
            }
            throw new Error('OAuth2 Callback-State ungültig oder abgelaufen.');
        }
        delete oauthState[token];
        this.saveOauthState(oauthState);
        return true;
    }

    buildOAuthAuthorizationUrl(providerInput, options = {}) {
        const provider = normalizeOAuthProvider(providerInput);
        const {
            clientId = options.clientId || `demo-${provider}-client`,
            redirectUri = options.redirectUri || 'https://example.invalid/oauth/callback',
            state
        } = options;

        const REAL_ENDPOINTS = {
            github: 'https://github.com/login/oauth/authorize',
            google: 'https://accounts.google.com/o/oauth2/v2/auth',
            microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
        };
        const DEFAULT_SCOPES = {
            github: 'read:user user:email',
            google: 'openid profile email',
            microsoft: 'openid profile email'
        };

        const endpoint = REAL_ENDPOINTS[provider] || `https://oauth.${provider}.com/authorize`;
        const scope = options.scope || DEFAULT_SCOPES[provider] || 'openid profile email';
        const callbackState = state || this.createOAuthState(provider);

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope,
            state: callbackState
        });
        return `${endpoint}?${params.toString()}`;
    }

    async register(usernameInput, password, confirmPassword) {
        const username = sanitizeUsername(usernameInput);
        if (!username) {
            throw new Error('Benutzername: 3-32 Zeichen, nur Buchstaben, Zahlen, Punkt, Unterstrich, @ oder -.');
        }
        if (password !== confirmPassword) {
            throw new Error('Passwörter stimmen nicht überein.');
        }
        const strength = passwordStrength(password);
        if (!strength.valid) {
            throw new Error('Passwort erfüllt die Mindestanforderungen nicht.');
        }

        const { users } = this._findUser(username);
        if (users.some((user) => user.username === username)) {
            throw new Error('Benutzername existiert bereits.');
        }

        const salt = createSalt(16);
        const hashes = await doubleHashPassword(password, salt);
        const role = users.length === 0 ? 'admin' : 'user';
        const user = {
            username,
            salt,
            passwordHash: hashes.sha512,
            hashAlgorithm: hashes.algorithm,
            role,
            authRoutes: ['system'],
            oauthLinks: {},
            failedAttempts: 0,
            lockUntil: 0,
            createdAt: isoNow(this.now),
            updatedAt: isoNow(this.now),
            secureNote: null
        };

        users.push(user);
        this.saveUsers(users);
        const session = this._createSession(user, { authRoute: 'system' });
        this._appendLog('REGISTER', 'success', username, `Rolle: ${role}`);
        return {
            user,
            session,
            passwordMaterial: hashes.sha512
        };
    }

    async login(usernameInput, password) {
        const username = sanitizeUsername(usernameInput);
        if (!username) {
            this._appendLog('LOGIN', 'failed', String(usernameInput ?? 'anonymous'), 'Ungültiger Benutzername');
            throw new Error('Ungültiger Benutzername.');
        }

        const { users, index } = this._findUser(username);
        if (index === -1) {
            this._appendLog('LOGIN', 'failed', username, 'Benutzer nicht gefunden');
            throw new Error('Benutzer nicht gefunden.');
        }

        const user = users[index];
        if (!user.passwordHash || !user.salt) {
            this._appendLog('LOGIN', 'failed', username, 'OAuth2-only Konto');
            throw new Error('Für dieses Konto ist OAuth2-Login erforderlich.');
        }
        if (user.lockUntil && user.lockUntil > this.now()) {
            this._appendLog('LOGIN', 'failed', username, 'Konto vorübergehend gesperrt');
            throw new Error(`Konto gesperrt bis ${new Date(user.lockUntil).toLocaleTimeString('de-DE')}.`);
        }

        const hashes = await doubleHashPassword(password, user.salt);
        if (hashes.sha512 !== user.passwordHash) {
            user.failedAttempts = (user.failedAttempts || 0) + 1;
            if (user.failedAttempts >= this.maxFailedAttempts) {
                user.lockUntil = this.now() + this.lockoutMs;
                user.failedAttempts = 0;
            }
            user.updatedAt = isoNow(this.now);
            users[index] = user;
            this.saveUsers(users);
            this._appendLog('LOGIN', 'failed', username, 'Falsches Passwort');
            throw new Error('Falsches Passwort.');
        }

        user.failedAttempts = 0;
        user.lockUntil = 0;
        user.updatedAt = isoNow(this.now);
        users[index] = user;
        this.saveUsers(users);
        const session = this._createSession(user, { authRoute: 'system' });
        this._appendLog('LOGIN', 'success', username, 'Anmeldung erfolgreich');
        return {
            user,
            session,
            passwordMaterial: hashes.sha512
        };
    }

    async loginWithOAuth(providerInput, profile = {}) {
        const provider = normalizeOAuthProvider(providerInput);
        const oauthSubject = String(profile.subject || profile.code || profile.id || '').trim() || createCsrfToken(10);
        const users = this.getUsers();
        const activeSession = this.getSession();
        const nowIsoValue = isoNow(this.now);
        const targetUsername = activeSession?.username || sanitizeUsername(profile.username) || sanitizeUsername(profile.email ? String(profile.email).split('@')[0] : '');
        const linkedUsers = users
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.oauthLinks?.[provider]?.subject === oauthSubject);

        let user = null;
        let userIndex = -1;

        if (linkedUsers.length > 1) {
            this._appendLog('OAUTH_LOGIN', 'failed', activeSession?.username || targetUsername || 'anonymous', `${provider} Konto mehrfach verknüpft`);
            throw new Error('Dieses OAuth2-Konto ist mehrfach verknüpft. Bitte die Verknüpfungen bereinigen.');
        }

        if (activeSession?.username) {
            userIndex = users.findIndex((entry) => entry.username === targetUsername);
            if (userIndex >= 0) {
                user = users[userIndex];
            }
        }

        if (linkedUsers.length === 1) {
            const linkedUser = linkedUsers[0];
            if (activeSession?.username && linkedUser.entry.username !== activeSession.username) {
                this._appendLog('OAUTH_LOGIN', 'failed', activeSession.username, `${provider} Konto bereits mit ${linkedUser.entry.username} verknüpft`);
                throw new Error('Dieses OAuth2-Konto ist bereits mit einem anderen Benutzer verknüpft.');
            }
            if (!user) {
                user = linkedUser.entry;
                userIndex = linkedUser.index;
            }
        }

        if (!user && targetUsername) {
            userIndex = users.findIndex((entry) => entry.username === targetUsername);
            if (userIndex >= 0) {
                user = users[userIndex];
            }
        }

        if (!user) {
            const username = buildOauthUsername(profile, provider, oauthSubject);
            const role = users.length === 0 ? 'admin' : 'user';
            user = {
                username,
                salt: null,
                passwordHash: null,
                hashAlgorithm: 'OAuth2 only',
                role,
                authRoutes: ['oauth2'],
                oauthLinks: {},
                failedAttempts: 0,
                lockUntil: 0,
                createdAt: nowIsoValue,
                updatedAt: nowIsoValue,
                secureNote: null
            };
            users.push(user);
            userIndex = users.length - 1;
        }

        user.oauthLinks = user.oauthLinks || {};
        user.oauthLinks[provider] = {
            subject: oauthSubject,
            email: profile.email || null,
            displayName: profile.displayName || null,
            linkedAt: nowIsoValue
        };
        const routeSet = new Set(user.authRoutes || []);
        routeSet.add('oauth2');
        if (user.passwordHash) {
            routeSet.add('system');
        }
        user.authRoutes = [...routeSet];
        user.updatedAt = nowIsoValue;
        users[userIndex] = user;
        this.saveUsers(users);

        const session = this._createSession(user, { authRoute: 'oauth2', authProvider: provider });
        this._appendLog('OAUTH_LOGIN', 'success', user.username, `${provider} verbunden`);
        return {
            user,
            session,
            provider
        };
    }

    async completeOAuthCallback(providerInput, callbackPayload = {}) {
        const provider = normalizeOAuthProvider(providerInput);
        if (callbackPayload.error) {
            this._appendLog('OAUTH_LOGIN', 'failed', 'anonymous', `${provider}: ${callbackPayload.error}`);
            throw new Error(`OAuth2 Fehler: ${callbackPayload.error}`);
        }
        this.consumeOAuthState(provider, callbackPayload.state);
        return this.loginWithOAuth(provider, {
            code: callbackPayload.code,
            username: callbackPayload.username,
            email: callbackPayload.email,
            displayName: callbackPayload.displayName
        });
    }

    logout(csrfToken, reason = 'Benutzer Logout') {
        const session = this._validateStateToken(csrfToken);
        this._appendLog('LOGOUT', 'success', session.username, reason);
        this.clearSession();
    }

    touchSession() {
        const session = this.getSession();
        if (!session) {
            return null;
        }
        session.lastActivityAt = this.now();
        session.expiresAt = this.now() + this.sessionTimeoutMs;
        this.storage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    getVisibleLogs() {
        const session = this.getSession();
        if (!session) {
            return [];
        }
        const logs = this.getLogs();
        if (session.role === 'admin') {
            return logs;
        }
        return logs.filter((entry) => entry.username === session.username);
    }

    getAdminUserOverview() {
        const session = this.getSession();
        if (!session || session.role !== 'admin') {
            return [];
        }
        return this.getUsers().map((user) => ({
            username: user.username,
            role: user.role,
            authRoutes: user.authRoutes || [],
            oauthProviders: Object.keys(user.oauthLinks || {}),
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            locked: Boolean(user.lockUntil && user.lockUntil > this.now())
        }));
    }

    exportAuditLogs(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        if (session.role !== 'admin') {
            throw new Error('Nur Admin darf Audit-Logs exportieren.');
        }
        return JSON.stringify(this.getLogs(), null, 2);
    }

    exportUserOverview(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        if (session.role !== 'admin') {
            throw new Error('Nur Admin darf User-Reports exportieren.');
        }
        return JSON.stringify(this.getAdminUserOverview(), null, 2);
    }

    getUser(username) {
        return this.getUsers().find((user) => user.username === username) || null;
    }

    async changePassword(currentPassword, nextPassword, confirmPassword, csrfToken) {
        const session = this._validateStateToken(csrfToken);
        if (nextPassword !== confirmPassword) {
            throw new Error('Neue Passwörter stimmen nicht überein.');
        }
        const strength = passwordStrength(nextPassword);
        if (!strength.valid) {
            throw new Error('Neues Passwort erfüllt die Anforderungen nicht.');
        }

        const { users, index } = this._findUser(session.username);
        const user = users[index];
        const currentHashes = await doubleHashPassword(currentPassword, user.salt);
        if (currentHashes.sha512 !== user.passwordHash) {
            this._appendLog('PASSWORD_CHANGE', 'failed', user.username, 'Aktuelles Passwort falsch');
            throw new Error('Aktuelles Passwort ist falsch.');
        }

        let secureNote = user.secureNote;
        if (secureNote) {
            const plainNote = await decryptSensitiveData(secureNote, currentHashes.sha512, user.salt);
            const nextSalt = createSalt(16);
            const nextHashes = await doubleHashPassword(nextPassword, nextSalt);
            secureNote = await encryptSensitiveData(plainNote, nextHashes.sha512, nextSalt);
            user.salt = nextSalt;
            user.passwordHash = nextHashes.sha512;
            user.hashAlgorithm = nextHashes.algorithm;
            user.secureNote = secureNote;
        } else {
            const nextSalt = createSalt(16);
            const nextHashes = await doubleHashPassword(nextPassword, nextSalt);
            user.salt = nextSalt;
            user.passwordHash = nextHashes.sha512;
            user.hashAlgorithm = nextHashes.algorithm;
        }

        user.updatedAt = isoNow(this.now);
        user.authRoutes = [...new Set([...(user.authRoutes || []), 'system'])];
        users[index] = user;
        this.saveUsers(users);
        const refreshedSession = this._createSession(user, { authRoute: 'system' });
        this._appendLog('PASSWORD_CHANGE', 'success', user.username, 'Passwort aktualisiert');
        return {
            user,
            session: refreshedSession
        };
    }

    async saveSecureNote(password, note, csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const { users, index } = this._findUser(session.username);
        const user = users[index];
        const hashes = await doubleHashPassword(password, user.salt);
        if (hashes.sha512 !== user.passwordHash) {
            this._appendLog('SECURE_NOTE_SAVE', 'failed', user.username, 'Passwort falsch');
            throw new Error('Passwort zur Verschlüsselung ist falsch.');
        }
        user.secureNote = await encryptSensitiveData(note, hashes.sha512, user.salt);
        user.updatedAt = isoNow(this.now);
        users[index] = user;
        this.saveUsers(users);
        this._appendLog('SECURE_NOTE_SAVE', 'success', user.username, 'AES-256-GCM gespeichert');
        return user.secureNote;
    }

    async readSecureNote(password) {
        const session = this.getSession();
        if (!session) {
            throw new Error('Keine aktive Sitzung.');
        }
        const user = this.getUser(session.username);
        if (!user?.secureNote) {
            return '';
        }
        const hashes = await doubleHashPassword(password, user.salt);
        if (hashes.sha512 !== user.passwordHash) {
            this._appendLog('SECURE_NOTE_READ', 'failed', user.username, 'Passwort falsch');
            throw new Error('Passwort zur Entschlüsselung ist falsch.');
        }
        this._appendLog('SECURE_NOTE_READ', 'success', user.username, 'AES-256-GCM gelesen');
        return decryptSensitiveData(user.secureNote, hashes.sha512, user.salt);
    }

    getSessionSummary() {
        const session = this.getSession();
        if (!session) {
            return null;
        }
        const user = this.getUser(session.username);
        return {
            ...session,
            userCreatedAt: user?.createdAt || null,
            secureNoteConfigured: Boolean(user?.secureNote)
        };
    }

    // ─── 2FA ────────────────────────────────────────────────────────────────

    generateTwoFACode() {
        const digits = new Uint32Array(1);
        getCryptoApi().getRandomValues(digits);
        return String(digits[0] % 1_000_000).padStart(6, '0');
    }

    sendTwoFACode(contact, code) {
        const channel = contact.includes('@') ? 'EMAIL' : 'SMS';
        // Log only channel and masked contact; never log the code itself.
        const masked = contact.length > 4
            ? contact.slice(0, 2) + '****' + contact.slice(-2)
            : '****';
        this._appendLog('2FA_SEND', 'success', 'system',
            `${channel} → ${masked} (demo-mode)`);
        return { channel, contact };
    }

    verifyTwoFACode(userCode, storedCode) {
        if (!userCode || !storedCode) {
            throw new Error('2FA-Code fehlt.');
        }
        if (String(userCode).trim() !== String(storedCode).trim()) {
            throw new Error('2FA-Code ungültig oder abgelaufen.');
        }
        return true;
    }

    setupTwoFA(method, contact, csrfToken) {
        const session = this._validateStateToken(csrfToken);
        if (!['email', 'sms'].includes(method)) {
            throw new Error('2FA-Methode muss "email" oder "sms" sein.');
        }
        if (!contact || contact.trim() === '') {
            throw new Error('2FA-Kontaktdaten fehlen.');
        }
        const { users, index } = this._findUser(session.username);
        const user = users[index];
        user.twoFA = {
            enabled: true,
            method,
            contact: contact.trim(),
            updatedAt: isoNow(this.now)
        };
        user.updatedAt = isoNow(this.now);
        users[index] = user;
        this.saveUsers(users);
        this._appendLog('2FA_SETUP', 'success', user.username, `Methode: ${method}`);
        return user.twoFA;
    }

    disableTwoFA(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const { users, index } = this._findUser(session.username);
        const user = users[index];
        user.twoFA = { enabled: false, method: null, contact: null, updatedAt: isoNow(this.now) };
        user.updatedAt = isoNow(this.now);
        users[index] = user;
        this.saveUsers(users);
        this._appendLog('2FA_DISABLE', 'success', user.username, '2FA deaktiviert');
        return user.twoFA;
    }

    changeTwoFAMethod(newMethod, newContact, csrfToken) {
        return this.setupTwoFA(newMethod, newContact, csrfToken);
    }

    getTwoFASettings(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const user = this.getUser(session.username);
        return user?.twoFA || { enabled: false, method: null, contact: null };
    }

    // ─── Forgot-Password / Recovery ─────────────────────────────────────────

    initiateForgotPassword(emailOrPhone) {
        const users = this.getUsers();
        const user = users.find(
            (u) => u.contactEmail === emailOrPhone || u.contactPhone === emailOrPhone
        );
        if (!user) {
            // Deliberate vague response to prevent user enumeration
            this._appendLog('FORGOT_PASSWORD', 'info', 'anonymous',
                'Recovery requested for unrecognised contact');
            return { sent: true };
        }
        const code = this.generateTwoFACode();
        const { users: allUsers, index } = this._findUser(user.username);
        allUsers[index].recoveryCode = code;
        allUsers[index].recoveryCodeExpires = this.now() + 5 * 60 * 1000;
        this.saveUsers(allUsers);
        this.sendTwoFACode(emailOrPhone, code);
        this._appendLog('FORGOT_PASSWORD', 'success', user.username, 'Recovery-Code versandt');
        return { sent: true };
    }

    verifyRecoveryCode(emailOrPhone, code) {
        const users = this.getUsers();
        const user = users.find(
            (u) => u.contactEmail === emailOrPhone || u.contactPhone === emailOrPhone
        );
        if (!user || !user.recoveryCode) {
            throw new Error('Kein aktiver Recovery-Code gefunden.');
        }
        if (this.now() > (user.recoveryCodeExpires || 0)) {
            throw new Error('Recovery-Code abgelaufen.');
        }
        if (String(code).trim() !== String(user.recoveryCode).trim()) {
            this._appendLog('RECOVERY_VERIFY', 'failed', user.username, 'Falscher Recovery-Code');
            throw new Error('Recovery-Code ungültig.');
        }
        const verifyToken = createCsrfToken(16);
        const { users: allUsers, index } = this._findUser(user.username);
        allUsers[index].recoveryVerifyToken = verifyToken;
        allUsers[index].recoveryVerifyExpires = this.now() + 5 * 60 * 1000;
        this.saveUsers(allUsers);
        this._appendLog('RECOVERY_VERIFY', 'success', user.username, 'Code verifiziert');
        return { verifyToken, username: user.username };
    }

    async resetPasswordWithRecoveryCode(emailOrPhone, recoveryToken, newPassword, confirmPassword) {
        if (newPassword !== confirmPassword) {
            throw new Error('Passwörter stimmen nicht überein.');
        }
        const strength = passwordStrength(newPassword);
        if (!strength.valid) {
            throw new Error('Neues Passwort erfüllt die Anforderungen nicht.');
        }
        const users = this.getUsers();
        const user = users.find(
            (u) => u.contactEmail === emailOrPhone || u.contactPhone === emailOrPhone
        );
        if (!user || user.recoveryVerifyToken !== recoveryToken) {
            throw new Error('Ungültiger Wiederherstellungs-Token.');
        }
        if (this.now() > (user.recoveryVerifyExpires || 0)) {
            throw new Error('Wiederherstellungs-Token abgelaufen.');
        }
        const { users: allUsers, index } = this._findUser(user.username);
        const nextSalt = createSalt(16);
        const nextHashes = await doubleHashPassword(newPassword, nextSalt);
        allUsers[index].salt = nextSalt;
        allUsers[index].passwordHash = nextHashes.sha512;
        allUsers[index].hashAlgorithm = nextHashes.algorithm;
        allUsers[index].recoveryCode = null;
        allUsers[index].recoveryCodeExpires = null;
        allUsers[index].recoveryVerifyToken = null;
        allUsers[index].recoveryVerifyExpires = null;
        allUsers[index].updatedAt = isoNow(this.now);
        this.saveUsers(allUsers);
        this._appendLog('PASSWORD_RESET', 'success', user.username, 'Passwort zurückgesetzt');
        return { success: true, username: user.username };
    }

    // ─── Settings / Profile ──────────────────────────────────────────────────

    updateUsername(newUsernameRaw, csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const newUsername = sanitizeUsername(newUsernameRaw);
        if (!newUsername) {
            throw new Error('Neuer Benutzername ungültig.');
        }
        const { users, index } = this._findUser(session.username);
        if (users.some((u) => u.username === newUsername)) {
            throw new Error('Benutzername bereits vergeben.');
        }
        const user = users[index];
        const oldUsername = user.username;
        user.username = newUsername;
        user.updatedAt = isoNow(this.now);
        users[index] = user;
        this.saveUsers(users);
        // Update session
        const currentSession = this.getSession();
        if (currentSession) {
            this.storage.setItem(SESSION_KEY, JSON.stringify({
                ...currentSession,
                username: newUsername
            }));
        }
        this._appendLog('USERNAME_CHANGE', 'success', newUsername,
            `Vorheriger Name: ${oldUsername}`);
        return user;
    }

    updateContactInfo(email, phone, csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const { users, index } = this._findUser(session.username);
        const user = users[index];
        if (email !== undefined) {
            user.contactEmail = String(email).trim();
        }
        if (phone !== undefined) {
            user.contactPhone = String(phone).trim();
        }
        user.updatedAt = isoNow(this.now);
        users[index] = user;
        this.saveUsers(users);
        this._appendLog('CONTACT_UPDATE', 'success', user.username, 'Kontaktdaten aktualisiert');
        return { contactEmail: user.contactEmail, contactPhone: user.contactPhone };
    }

    exportSeedPhrase(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const user = this.getUser(session.username);
        if (!user.seedPhrase) {
            // Use the full 2048-word BIP-39 list for proper 132-bit entropy
            // (11 bits × 12 words).
            const randomBytes = new Uint8Array(12 * 2); // 2 bytes per word → up to 65536 → mod 2048
            getCryptoApi().getRandomValues(randomBytes);
            const words = Array.from({ length: 12 }, (_, i) => {
                const idx = ((randomBytes[i * 2] << 8) | randomBytes[i * 2 + 1]) % BIP39_WORD_COUNT;
                return BIP39_WORDLIST[idx];
            });
            const { users, index } = this._findUser(session.username);
            users[index].seedPhrase = words.join(' ');
            users[index].updatedAt = isoNow(this.now);
            this.saveUsers(users);
            this._appendLog('SEED_EXPORT', 'success', session.username, '12-Wort Seed generiert');
            return words.join(' ');
        }
        this._appendLog('SEED_EXPORT', 'success', session.username, 'Seed-Phrase abgerufen');
        return user.seedPhrase;
    }

    getConnectedProviders(csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const user = this.getUser(session.username);
        return Object.keys(user?.oauthLinks || {});
    }

    unlinkOAuth2Account(providerInput, csrfToken) {
        const session = this._validateStateToken(csrfToken);
        const provider = normalizeOAuthProvider(providerInput);
        const { users, index } = this._findUser(session.username);
        const user = users[index];
        if (!user.oauthLinks?.[provider]) {
            throw new Error(`Kein ${provider}-Account verknüpft.`);
        }
        delete user.oauthLinks[provider];
        user.updatedAt = isoNow(this.now);
        users[index] = user;
        this.saveUsers(users);
        this._appendLog('OAUTH_UNLINK', 'success', user.username, `${provider} getrennt`);
        return user.oauthLinks;
    }

    // ─── Navigation helpers (frontend routing) ───────────────────────────────

    navigateToHome() {
        const session = this.getSession();
        if (!session) {
            throw new Error('Nicht eingeloggt. Bitte zuerst anmelden.');
        }
        return { view: 'home', username: session.username };
    }

    navigateToProfile() {
        const session = this.getSession();
        if (!session) {
            throw new Error('Nicht eingeloggt. Bitte zuerst anmelden.');
        }
        return { view: 'profile', username: session.username };
    }

    navigateToExplorer() {
        const session = this.getSession();
        if (!session) {
            throw new Error('Nicht eingeloggt. Bitte zuerst anmelden.');
        }
        return { view: 'explorer', username: session.username };
    }

    navigateToAdminPanel() {
        const session = this.getSession();
        if (!session) {
            throw new Error('Nicht eingeloggt. Bitte zuerst anmelden.');
        }
        if (session.role !== 'admin') {
            this._appendLog('ADMIN_ACCESS', 'denied', session.username, 'Kein Admin');
            throw new Error('Zugriff verweigert. Nur für Administratoren.');
        }
        return { view: 'admin', username: session.username };
    }
}

export const authConfig = {
    usersKey: USERS_KEY,
    sessionKey: SESSION_KEY,
    logsKey: LOGS_KEY,
    oauthStateKey: OAUTH_STATE_KEY,
    oauthProviders: OAUTH_PROVIDERS,
    sessionTimeoutMs: SESSION_TIMEOUT_MS,
    lockoutMs: LOCKOUT_MS,
    maxFailedAttempts: MAX_FAILED_ATTEMPTS,
    chatHistoryEntryLimit: CHAT_HISTORY_ENTRY_LIMIT,
    userChatDailyMessageLimit: USER_CHAT_DAILY_MESSAGE_LIMIT,
    userChatDailyTokenLimit: USER_CHAT_DAILY_TOKEN_LIMIT,
    userChatInputCharLimit: USER_CHAT_INPUT_CHAR_LIMIT
};
