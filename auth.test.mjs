import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}

const {
    AuthManager,
    createMemoryStorage,
    doubleHashPassword,
    passwordStrength,
    sanitizeUsername,
    encryptSensitiveData,
    decryptSensitiveData
} = await import('./auth.js');

test('username sanitization blocks unsafe values', () => {
    assert.equal(sanitizeUsername('admin<script>'), '');
    assert.equal(sanitizeUsername(' valid.user '), 'valid.user');
});

test('password strength requires all configured checks', () => {
    const weak = passwordStrength('abc');
    const strong = passwordStrength('Sicher!2026');
    assert.equal(weak.valid, false);
    assert.equal(strong.valid, true);
    assert.equal(strong.checks.length, true);
    assert.equal(strong.checks.uppercase, true);
    assert.equal(strong.checks.number, true);
    assert.equal(strong.checks.special, true);
});

test('double hashing is deterministic for same password and salt', async () => {
    const first = await doubleHashPassword('Sicher!2026', 'known-salt');
    const second = await doubleHashPassword('Sicher!2026', 'known-salt');
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.sha512, second.sha512);
    assert.match(first.sha256, /^[a-f0-9]{64}$/);
    assert.match(first.sha512, /^[a-f0-9]{128}$/);
});

test('aes encryption roundtrip restores the original value', async () => {
    const payload = await encryptSensitiveData('geheime notiz', 'secret-material', 'known-salt');
    const plainText = await decryptSensitiveData(payload, 'secret-material', 'known-salt');
    assert.equal(plainText, 'geheime notiz');
});

test('auth flow persists users, sessions and logs', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });

    const registered = await auth.register('admin.user', 'Sicher!2026', 'Sicher!2026');
    assert.equal(registered.user.role, 'admin');
    assert.equal(auth.getSessionSummary().username, 'admin.user');

    auth.logout(registered.session.csrfToken, 'logout test');
    assert.equal(auth.getSessionSummary(), null);

    const loggedIn = await auth.login('admin.user', 'Sicher!2026');
    assert.equal(loggedIn.user.username, 'admin.user');
    assert.equal(auth.getVisibleLogs().length >= 3, true);
});

test('five failed logins lock the account temporarily', async () => {
    let now = 1_700_000_000_000;
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => now });

    await auth.register('locker', 'Sicher!2026', 'Sicher!2026');
    auth.clearSession();

    for (let attempt = 0; attempt < 5; attempt += 1) {
        await assert.rejects(() => auth.login('locker', 'Falsch!2026'));
    }

    await assert.rejects(
        () => auth.login('locker', 'Sicher!2026'),
        /Konto gesperrt/
    );

    now += 16 * 60 * 1000;
    const result = await auth.login('locker', 'Sicher!2026');
    assert.equal(result.user.username, 'locker');
});

test('session timeout clears the active session automatically', async () => {
    let now = 1_700_000_000_000;
    const storage = createMemoryStorage();
    const auth = new AuthManager({
        storage,
        now: () => now,
        sessionTimeoutMs: 10
    });

    const result = await auth.register('timeout', 'Sicher!2026', 'Sicher!2026');
    assert.equal(auth.getSessionSummary().username, 'timeout');
    now = result.session.expiresAt + 1;
    assert.equal(auth.getSessionSummary(), null);
});

test('oauth callback simulation logs in and links to active system account', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    await auth.register('linked.user', 'Sicher!2026', 'Sicher!2026');
    const stateToken = auth.createOAuthState('github');

    const oauth = await auth.completeOAuthCallback('github', {
        code: 'gh-123',
        state: stateToken
    });

    assert.equal(oauth.user.username, 'linked.user');
    assert.equal(auth.getSessionSummary().authRoute, 'oauth2');
    assert.equal(auth.getSessionSummary().authProvider, 'github');
    assert.equal(Boolean(auth.getUser('linked.user').oauthLinks.github), true);

    auth.logout(oauth.session.csrfToken, 'oauth logout');
    assert.equal(auth.getSessionSummary(), null);
    const systemSession = await auth.login('linked.user', 'Sicher!2026');
    assert.equal(auth.getSessionSummary().authRoute, 'system');
    auth.logout(systemSession.session.csrfToken, 'cleanup');
});

test('admin can export audit logs and user overview', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const registered = await auth.register('admin.demo', 'Sicher!2026', 'Sicher!2026');
    const logJson = auth.exportAuditLogs(registered.session.csrfToken);
    const userJson = auth.exportUserOverview(registered.session.csrfToken);
    assert.equal(Array.isArray(JSON.parse(logJson)), true);
    assert.equal(Array.isArray(JSON.parse(userJson)), true);
});
