/**
 * RFOF-NETWORK — Role-Based Access Control (RBAC)
 * ─────────────────────────────────────────────────
 * Defines roles, permissions and admin-only / user-only capability sets.
 * Works with the AuthManager stored in auth.js; no hard dependencies on it.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** The only username granted the 'admin' role automatically on first register. */
export const ADMIN_USERNAME = 'RFOF-NETWORK';

export const ROLES = Object.freeze({
    ADMIN: 'admin',
    USER: 'user'
});

/**
 * Fine-grained permission catalogue.
 * Admin has ALL permissions; a normal user has only the USER_PERMISSIONS subset.
 */
export const ALL_PERMISSIONS = Object.freeze([
    // User-facing
    'wallet:view',
    'wallet:deposit',
    'wallet:withdraw',
    'wallet:send',
    'wallet:receive',
    'wallet:swap',
    'wallet:stake',
    'wallet:unstake',
    'mining:start',
    'mining:stop',
    'explorer:read',
    'rapp:use',
    'profile:read',
    'profile:updateUsername',
    'profile:updatePassword',
    'profile:updateContact',
    'profile:twofa',
    'profile:seedphrase',
    // Admin-only
    'admin:userManagement',
    'admin:banUser',
    'admin:changeRole',
    'admin:auditLogs',
    'admin:systemStats',
    'admin:dnaTracking',
    'admin:cissMetaLayer',
    'admin:32chapters',
    'admin:layer7Control',
    'admin:exportLogs'
]);

export const USER_PERMISSIONS = Object.freeze([
    'wallet:view',
    'wallet:deposit',
    'wallet:withdraw',
    'wallet:send',
    'wallet:receive',
    'wallet:swap',
    'wallet:stake',
    'wallet:unstake',
    'mining:start',
    'mining:stop',
    'explorer:read',
    'rapp:use',
    'profile:read',
    'profile:updateUsername',
    'profile:updatePassword',
    'profile:updateContact',
    'profile:twofa',
    'profile:seedphrase'
]);

// ─── Helper: derive role from user object ────────────────────────────────────

/**
 * Returns 'admin' if the stored role on the user record equals 'admin',
 * otherwise 'user'.  Does NOT rely on username matching to allow role changes.
 *
 * @param {{ role?: string }} user  – user record from AuthManager.getUser()
 * @returns {'admin'|'user'}
 */
export function getRole(user) {
    return user?.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER;
}

/**
 * Returns true when the supplied user record holds the admin role.
 *
 * @param {{ role?: string }} user  – user record from AuthManager.getUser()
 * @returns {boolean}
 */
export function isAdmin(user) {
    return getRole(user) === ROLES.ADMIN;
}

/**
 * Checks whether the supplied user is permitted to perform a given action.
 *
 * @param {{ role?: string }} user      – user record
 * @param {string}            action    – one of ALL_PERMISSIONS
 * @returns {boolean}
 */
export function hasPermission(user, action) {
    if (isAdmin(user)) {
        return ALL_PERMISSIONS.includes(action);
    }
    return USER_PERMISSIONS.includes(action);
}

/**
 * Returns the full permission list for the user.
 *
 * @param {{ role?: string }} user
 * @returns {readonly string[]}
 */
export function getPermissions(user) {
    return isAdmin(user) ? ALL_PERMISSIONS : USER_PERMISSIONS;
}

// ─── Admin-only capability wrappers ──────────────────────────────────────────

/**
 * Enforces admin role; throws if the user lacks it.
 * Wrap any admin-only operation with this guard.
 *
 * @param {{ role?: string }} user
 * @param {string}            [action='admin:userManagement']
 */
export function requireAdmin(user, action = 'admin:userManagement') {
    if (!isAdmin(user)) {
        throw new Error(
            `Zugriff verweigert: Aktion "${action}" ist nur für Administratoren.`
        );
    }
}

/**
 * Returns a stub for the System DNA-Tracking view (admin-only).
 * In production this would call the backend analytics layer.
 *
 * @param {{ role?: string }} user
 * @returns {{ description: string, restricted: boolean }}
 */
export function getSystemDNATracking(user) {
    requireAdmin(user, 'admin:dnaTracking');
    return {
        description: 'DNA-Tracking aller User — Echtzeit-Heatmap (Admin-Ansicht)',
        restricted: true,
        endpoint: '/api/admin/dna-tracking'
    };
}

/**
 * Returns a stub for the CISS Meta-Layer (admin-only invisible tracking layer).
 *
 * @param {{ role?: string }} user
 */
export function getCISSMetaLayer(user) {
    requireAdmin(user, 'admin:cissMetaLayer');
    return {
        description: 'CISS-Meta-Schicht — unsichtbares Admin-Tracking-Layer',
        restricted: true,
        endpoint: '/api/admin/ciss-meta'
    };
}

/**
 * Returns the 32-chapter system management descriptor (admin-only).
 *
 * @param {{ role?: string }} user
 */
export function manage32ChaptersSystem(user) {
    requireAdmin(user, 'admin:32chapters');
    return {
        description: '32-Kapitel-Justizsystem verwalten',
        restricted: true,
        endpoint: '/api/admin/32chapters'
    };
}

/**
 * Returns the Layer-7 / MTK-NEC control descriptor (admin-only).
 *
 * @param {{ role?: string }} user
 */
export function getLayerSevenControl(user) {
    requireAdmin(user, 'admin:layer7Control');
    return {
        description: 'MTK-NEC-Layer-7 Systemkontrolle',
        restricted: true,
        endpoint: '/api/admin/layer7'
    };
}

/**
 * Returns a full audit-log export descriptor (admin-only).
 *
 * @param {{ role?: string }} user
 */
export function exportFullAuditLogs(user) {
    requireAdmin(user, 'admin:exportLogs');
    return {
        description: 'Komplette System-Logs exportieren',
        restricted: true,
        endpoint: '/api/admin/audit-logs/export'
    };
}

export const rbacConfig = Object.freeze({
    adminUsername: ADMIN_USERNAME,
    roles: ROLES,
    allPermissions: ALL_PERMISSIONS,
    userPermissions: USER_PERMISSIONS
});
