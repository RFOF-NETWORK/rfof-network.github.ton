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

test('invalid oauth callback does not clear other pending states', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const firstState = auth.createOAuthState('github');
    const secondState = auth.createOAuthState('github');

    await assert.rejects(
        () => auth.completeOAuthCallback('github', {
            code: 'invalid-gh',
            state: 'not-a-valid-state'
        }),
        /OAuth2 Callback-State ungültig oder abgelaufen/
    );

    const firstLogin = await auth.completeOAuthCallback('github', {
        code: 'gh-first',
        state: firstState
    });
    assert.equal(firstLogin.session.authProvider, 'github');

    auth.logout(firstLogin.session.csrfToken, 'switch oauth session');

    const secondLogin = await auth.completeOAuthCallback('github', {
        code: 'gh-second',
        state: secondState
    });
    assert.equal(secondLogin.session.authProvider, 'github');
});

test('oauth subject cannot be linked to multiple users', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });

    const alice = await auth.register('alice', 'Sicher!2026', 'Sicher!2026');
    const aliceState = auth.createOAuthState('github');
    await auth.completeOAuthCallback('github', {
        code: 'shared-subject',
        state: aliceState
    });
    auth.logout(auth.getSessionSummary().csrfToken, 'logout alice');

    await auth.register('bob', 'Sicher!2026', 'Sicher!2026');
    const bobState = auth.createOAuthState('github');
    await assert.rejects(
        () => auth.completeOAuthCallback('github', {
            code: 'shared-subject',
            state: bobState
        }),
        /bereits mit einem anderen Benutzer verknüpft/
    );

    auth.logout(auth.getSessionSummary().csrfToken, 'cleanup bob');
    const reloginState = auth.createOAuthState('github');
    const relogin = await auth.completeOAuthCallback('github', {
        code: 'shared-subject',
        state: reloginState
    });
    assert.equal(relogin.user.username, alice.user.username);
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

// ─── 2FA Tests ────────────────────────────────────────────────────────────────

test('2FA code generation produces a 6-digit string', () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const code = auth.generateTwoFACode();
    assert.match(code, /^\d{6}$/);
});

test('2FA setup, verify, and disable roundtrip', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const { session } = await auth.register('twofa.user', 'Sicher!2026', 'Sicher!2026');

    const cfg = auth.setupTwoFA('email', 'user@example.com', session.csrfToken);
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.method, 'email');

    const settings = auth.getTwoFASettings(session.csrfToken);
    assert.equal(settings.enabled, true);
    assert.equal(settings.contact, 'user@example.com');

    const code = auth.generateTwoFACode();
    assert.equal(auth.verifyTwoFACode(code, code), true);
    assert.throws(() => auth.verifyTwoFACode('000000', '111111'), /ungültig/i);

    const disabled = auth.disableTwoFA(session.csrfToken);
    assert.equal(disabled.enabled, false);
});

test('2FA method change from email to sms', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const { session } = await auth.register('twofa.changer', 'Sicher!2026', 'Sicher!2026');
    auth.setupTwoFA('email', 'old@example.com', session.csrfToken);
    const updated = auth.changeTwoFAMethod('sms', '+49123456789', session.csrfToken);
    assert.equal(updated.method, 'sms');
    assert.equal(updated.contact, '+49123456789');
});

// ─── Forgot-Password Tests ────────────────────────────────────────────────────

test('forgot-password flow: initiate → verify → reset', async () => {
    let now = 1_700_000_000_000;
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => now });

    await auth.register('recovery.user', 'Sicher!2026', 'Sicher!2026');
    // manually log out to simulate a fresh visit
    auth.clearSession();
    // register contact info directly (bypass session for test setup)
    const users = auth.getUsers();
    const idx = users.findIndex((u) => u.username === 'recovery.user');
    users[idx].contactEmail = 'recovery@example.com';
    auth.saveUsers(users);

    const { sent } = auth.initiateForgotPassword('recovery@example.com');
    assert.equal(sent, true);

    // retrieve the code from the stored user
    const code = auth.getUsers().find((u) => u.username === 'recovery.user').recoveryCode;
    assert.match(code, /^\d{6}$/);

    const { verifyToken } = auth.verifyRecoveryCode('recovery@example.com', code);
    assert.equal(typeof verifyToken, 'string');

    const result = await auth.resetPasswordWithRecoveryCode(
        'recovery@example.com', verifyToken, 'NeuesSicher!2026', 'NeuesSicher!2026'
    );
    assert.equal(result.success, true);

    // Login with new password must succeed
    const freshLogin = await auth.login('recovery.user', 'NeuesSicher!2026');
    assert.equal(freshLogin.user.username, 'recovery.user');
});

test('recovery code expires after 5 minutes', async () => {
    let now = 1_700_000_000_000;
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => now });

    await auth.register('expire.user', 'Sicher!2026', 'Sicher!2026');
    auth.clearSession();
    const users = auth.getUsers();
    const idx = users.findIndex((u) => u.username === 'expire.user');
    users[idx].contactEmail = 'expire@example.com';
    auth.saveUsers(users);

    auth.initiateForgotPassword('expire@example.com');
    const code = auth.getUsers().find((u) => u.username === 'expire.user').recoveryCode;

    now += 6 * 60 * 1000; // advance 6 minutes
    assert.throws(
        () => auth.verifyRecoveryCode('expire@example.com', code),
        /abgelaufen/i
    );
});

// ─── Settings Tests ───────────────────────────────────────────────────────────

test('updateUsername changes username and session', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const { session } = await auth.register('old.name', 'Sicher!2026', 'Sicher!2026');
    const updated = auth.updateUsername('new.name', session.csrfToken);
    assert.equal(updated.username, 'new.name');
    assert.equal(auth.getSessionSummary().username, 'new.name');
});

test('updateContactInfo persists email and phone', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const { session } = await auth.register('contact.user', 'Sicher!2026', 'Sicher!2026');
    const contact = auth.updateContactInfo('a@b.com', '+49111222', session.csrfToken);
    assert.equal(contact.contactEmail, 'a@b.com');
    assert.equal(contact.contactPhone, '+49111222');
});

test('exportSeedPhrase returns 12 words', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const { session } = await auth.register('seed.user', 'Sicher!2026', 'Sicher!2026');
    const phrase = auth.exportSeedPhrase(session.csrfToken);
    const words = phrase.trim().split(/\s+/);
    assert.equal(words.length, 12);
});

test('unlinkOAuth2Account removes provider link', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const { session } = await auth.register('unlink.user', 'Sicher!2026', 'Sicher!2026');
    const stateToken = auth.createOAuthState('github');
    await auth.completeOAuthCallback('github', { code: 'gh-unlink', state: stateToken });
    // session was refreshed by OAuth login — get new csrfToken
    const currentToken = auth.getSessionSummary().csrfToken;
    const remaining = auth.unlinkOAuth2Account('github', currentToken);
    assert.equal(Object.keys(remaining).includes('github'), false);
});

test('chat quota enforces daily message limit for normal users', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({
        storage,
        now: () => 1_700_000_000_000,
        chatUserDailyMessageLimit: 1,
        chatUserDailyTokenLimit: 500,
        chatUserInputCharLimit: 200
    });
    await auth.register('quota.admin', 'Sicher!2026', 'Sicher!2026');
    auth.clearSession();
    const { session } = await auth.register('quota.user', 'Sicher!2026', 'Sicher!2026');
    auth.sendChatMessage('Hallo PRAIAI', session.csrfToken);
    assert.throws(
        () => auth.sendChatMessage('Zweite Nachricht', session.csrfToken),
        /Tageslimit für Nachrichten erreicht/
    );
    const usage = auth.getChatUsage(session.csrfToken);
    assert.equal(usage.usedMessages, 1);
});

test('chat quota is unlimited for admin users', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({
        storage,
        now: () => 1_700_000_000_000,
        chatUserDailyMessageLimit: 1
    });
    const { session } = await auth.register('chat.admin', 'Sicher!2026', 'Sicher!2026');
    auth.sendChatMessage('Admin Nachricht 1', session.csrfToken);
    auth.sendChatMessage('Admin Nachricht 2', session.csrfToken);
    const usage = auth.getChatUsage(session.csrfToken);
    assert.equal(usage.unlimited, true);
    assert.equal(usage.usedMessages, 2);
});

test('silent autonomy stores topic hints after chat messages', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    const { session } = await auth.register('autonomy.user', 'Sicher!2026', 'Sicher!2026');
    auth.sendChatMessage('Bitte hilf mir beim wallet swap', session.csrfToken);
    const events = auth.getAutonomyEvents(session.csrfToken);
    assert.equal(events.length > 0, true);
    assert.equal(events[0].topic, 'wallet');
});

// ─── Navigation / RBAC Tests ──────────────────────────────────────────────────

test('navigateToHome requires active session', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    assert.throws(() => auth.navigateToHome(), /Nicht eingeloggt/);
    await auth.register('nav.user', 'Sicher!2026', 'Sicher!2026');
    const result = auth.navigateToHome();
    assert.equal(result.view, 'home');
});

test('navigateToAdminPanel denies non-admin users', async () => {
    const storage = createMemoryStorage();
    const auth = new AuthManager({ storage, now: () => 1_700_000_000_000 });
    // First user = admin
    await auth.register('first.admin', 'Sicher!2026', 'Sicher!2026');
    auth.clearSession();
    // Second user = non-admin
    await auth.register('second.user', 'Sicher!2026', 'Sicher!2026');
    assert.throws(() => auth.navigateToAdminPanel(), /Zugriff verweigert/);
});

// ─── RBAC Module Tests ────────────────────────────────────────────────────────

const { isAdmin, hasPermission, getRole, requireAdmin } = await import('./rbac.js');

test('rbac: admin user has all permissions', () => {
    const adminUser = { role: 'admin' };
    assert.equal(isAdmin(adminUser), true);
    assert.equal(hasPermission(adminUser, 'admin:dnaTracking'), true);
    assert.equal(hasPermission(adminUser, 'wallet:view'), true);
});

test('rbac: normal user lacks admin permissions', () => {
    const user = { role: 'user' };
    assert.equal(isAdmin(user), false);
    assert.equal(hasPermission(user, 'admin:dnaTracking'), false);
    assert.equal(hasPermission(user, 'wallet:view'), true);
});

test('rbac: requireAdmin throws for normal user', () => {
    const user = { role: 'user' };
    assert.throws(() => requireAdmin(user), /Zugriff verweigert/);
});

// ─── Layer-7 Math Tests ───────────────────────────────────────────────────────

const {
    calculateRFOFValue, calculateEnergyFromCPU, calculateMessageFee,
    layerA_xpFromRFOF, generate4DTimelines, getAllPaths, generateMasterTable
} = await import('./layer7-math.js');

test('layer7: 8 bytes = 1 RFOF', () => {
    assert.equal(calculateRFOFValue(8), 1);
    assert.equal(calculateRFOFValue(64), 8);
});

test('layer7: layerA xp from RFOF (1 RFOF = 8 XP)', () => {
    assert.equal(layerA_xpFromRFOF(1), 8);
    assert.equal(layerA_xpFromRFOF(10), 80);
});

test('layer7: calculateEnergyFromCPU is proportional to time', () => {
    const a = calculateEnergyFromCPU(1000);
    const b = calculateEnergyFromCPU(2000);
    assert.equal(b, a * 2);
});

test('layer7: message fee scales with byte length', () => {
    const fee = calculateMessageFee('hello'); // 5 bytes × 0.001 = 0.005
    assert.ok(fee > 0);
    assert.ok(calculateMessageFee('hi') < fee);
});

test('layer7: 4D timelines have correct structure', () => {
    const timelines = generate4DTimelines();
    assert.equal(timelines.length, 4);
    assert.equal(timelines[0].units.length, 12);
    assert.equal(timelines[0].axioms.length, 4);
});

test('layer7: getAllPaths covers 7 chapters', () => {
    const all = getAllPaths();
    assert.equal(all.length, 7);
    assert.ok(all.every((c) => c.paths.length > 0));
});

test('layer7: master table contains 2^3 = 8', () => {
    const table = generateMasterTable();
    assert.equal(table.get('2^3'), 8);
    assert.equal(table.get('10^2'), 100);
});

// ─── Justice-32 Chapter Tests ──────────────────────────────────────────────────

const { CHAPTERS, getChapter, getEUMemberChapters, getSystemSummary } =
    await import('./justice-32-chapters.js');

test('justice: exactly 32 chapters defined', () => {
    assert.equal(CHAPTERS.length, 32);
});

test('justice: chapter 1 is GPCB', () => {
    const ch = getChapter(1);
    assert.equal(ch.code, 'GPCB');
});

test('justice: chapter 32 is Master Seal', () => {
    const ch = getChapter(32);
    assert.equal(ch.code, 'MS');
});

test('justice: 26 EU member state chapters', () => {
    assert.equal(getEUMemberChapters().length, 26);
});

test('justice: system summary is consistent', () => {
    const summary = getSystemSummary();
    assert.equal(summary.totalChapters, 32);
    assert.equal(summary.fivePillars.length, 5);
});
