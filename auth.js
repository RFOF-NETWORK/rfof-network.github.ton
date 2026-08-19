const textEncoder = new TextEncoder();
const USERS_KEY = 'rfof_auth_users_v1';
const SESSION_KEY = 'rfof_auth_session_v1';
const LOGS_KEY = 'rfof_auth_logs_v1';
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOG_LIMIT = 200;

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
        maxFailedAttempts = MAX_FAILED_ATTEMPTS
    } = {}) {
        if (!storage) {
            throw new Error('localStorage ist nicht verfügbar.');
        }
        this.storage = storage;
        this.now = now;
        this.sessionTimeoutMs = sessionTimeoutMs;
        this.lockoutMs = lockoutMs;
        this.maxFailedAttempts = maxFailedAttempts;
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

    _createSession(user) {
        const timestamp = this.now();
        const session = {
            username: user.username,
            role: user.role,
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
            failedAttempts: 0,
            lockUntil: 0,
            createdAt: isoNow(this.now),
            updatedAt: isoNow(this.now),
            secureNote: null
        };

        users.push(user);
        this.saveUsers(users);
        const session = this._createSession(user);
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
        const session = this._createSession(user);
        this._appendLog('LOGIN', 'success', username, 'Anmeldung erfolgreich');
        return {
            user,
            session,
            passwordMaterial: hashes.sha512
        };
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
        users[index] = user;
        this.saveUsers(users);
        const refreshedSession = this._createSession(user);
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
}

export const authConfig = {
    usersKey: USERS_KEY,
    sessionKey: SESSION_KEY,
    logsKey: LOGS_KEY,
    sessionTimeoutMs: SESSION_TIMEOUT_MS,
    lockoutMs: LOCKOUT_MS,
    maxFailedAttempts: MAX_FAILED_ATTEMPTS
};
