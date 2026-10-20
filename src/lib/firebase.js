// src/lib/firebase.js
// ─── Firebase initialisation — modular SDK (v9+) ──────────────────────────────
// Config is read from .env (never committed to git).
// Copy .env.example → .env and fill in your values.

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
} from 'firebase/auth';

// ── Config ─────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const db             = getFirestore(app);
export const auth           = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ── Admin email (UI hint only — security is enforced by Firestore Rules) ───────
// SECURITY: This is a client-side convenience check.
// The authoritative source of truth is the 'role' field in Firestore (users/{uid}).
export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().trim();

/** True if the given email belongs to the farm admin. UI hint only. */
export function isAdminEmail(email) {
  return !!(email && email.toLowerCase().trim() === ADMIN_EMAIL);
}

/** True if a logged-in user object is the admin.
 *  Prefers the Firestore role field (server-set) over email comparison. */
export function isAdminUser(user) {
  return !!(
    user &&
    (user.role?.toLowerCase().trim() === 'admin' || isAdminEmail(user.email))
  );
}

// ── Profile cache (prevents double Firestore read on login) ───────────────────
export const _profileCache = new Map();

/**
 * Ensure user profile exists in Firestore under users/{uid}.
 * Creates it on first login; returns existing on subsequent logins.
 * SECURITY: role and approved are always set server-side here — clients
 *           cannot self-promote to admin by passing role in extraFields.
 */
export async function ensureUserProfile(firebaseUser, extraFields = {}) {
  const ref = doc(db, 'users', firebaseUser.uid);

  // Return cached profile if available and no extra fields need writing
  if (_profileCache.has(firebaseUser.uid) && !Object.keys(extraFields).length) {
    const cached = {
      ..._profileCache.get(firebaseUser.uid),
      uid: firebaseUser.uid,
      id:  firebaseUser.uid,
    };
    if (isAdminEmail(firebaseUser.email))
      return { ...cached, role: 'admin', approved: true };
    return cached;
  }

  const snap    = await getDoc(ref);
  const isAdmin = isAdminEmail(firebaseUser.email);

  if (!snap.exists()) {
    const profile = {
      uid:       firebaseUser.uid,
      id:        firebaseUser.uid,
      email:     firebaseUser.email,
      name:
        extraFields.name ||
        firebaseUser.displayName ||
        firebaseUser.email.split('@')[0],
      // SECURITY: role and approved are always set here — never taken from extraFields
      // to prevent a caller from passing role:"admin" to escalate privileges.
      role:      isAdmin ? 'admin'  : 'worker',
      approved:  isAdmin ? true     : false,
      createdAt: new Date().toISOString(),
      // Whitelist allowed extra fields; strip sensitive keys from extraFields
      ...Object.fromEntries(
        Object.entries(extraFields).filter(
          ([k]) => !['role', 'approved', 'uid', 'id'].includes(k)
        )
      ),
    };
    await setDoc(ref, profile);
    _profileCache.set(firebaseUser.uid, profile);
    return profile;
  }

  const existing = { ...snap.data(), uid: firebaseUser.uid, id: firebaseUser.uid };

  // Always fix admin profile — force role to lowercase "admin" in Firestore permanently
  if (isAdmin) {
    const fixed = { ...existing, role: 'admin', approved: true };
    if (existing.role !== 'admin' || !existing.approved) {
      await updateDoc(ref, {
        role:     'admin',
        approved: true,
        email:    firebaseUser.email || existing.email || null,
      });
    }
    _profileCache.set(firebaseUser.uid, fixed);
    return fixed;
  }

  _profileCache.set(firebaseUser.uid, existing);
  return existing;
}

/** Read a single user profile by UID. Returns null if not found. */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

/** Update specific fields on a user profile. */
export async function updateUserProfile(uid, fields) {
  await updateDoc(doc(db, 'users', uid), fields);
}

/** Fetch all user profiles from Firestore. Returns [] on error. */
export async function getAllUserProfiles() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => d.data());
  } catch (e) {
    return [];
  }
}

// ─── OTP helpers (WhatsApp-based password reset) ──────────────────────────────
// SECURITY: crypto.getRandomValues instead of Math.random (not cryptographically secure).

/** Generate a cryptographically random 6-digit OTP code (string). */
export function generateOTP() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

/**
 * Hash the OTP with SHA-256 and store in Firestore under passwordOTPs/{uid}.
 * Returns the plaintext code so the caller can send it to the user.
 */
export async function storeOTP(uid, code) {
  const encoder = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(code));
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  await setDoc(doc(db, 'passwordOTPs', uid), {
    code:      hashHex,          // stored as hash — never plaintext
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    used:      false,
    attempts:  0,
    createdAt: new Date().toISOString(),
  });

  return code; // caller decides whether/how to deliver it
}

const OTP_MAX_ATTEMPTS = 5;

/**
 * Verify a user-submitted OTP code against the stored hash.
 * Returns { ok: true } on success or { ok: false, reason: string } on failure.
 */
export async function verifyOTP(uid, inputCode) {
  try {
    const ref  = doc(db, 'passwordOTPs', uid);
    const snap = await getDoc(ref);

    if (!snap.exists())
      return { ok: false, reason: 'No OTP found. Please request a new one.' };

    const { code, expiresAt, used, attempts = 0 } = snap.data();

    // SECURITY: Check attempt count before doing any further work
    if (attempts >= OTP_MAX_ATTEMPTS)
      return { ok: false, reason: 'Too many failed attempts. Please request a new OTP.' };
    if (used)
      return { ok: false, reason: 'This OTP has already been used. Request a new one.' };
    if (new Date() > new Date(expiresAt))
      return { ok: false, reason: 'OTP expired (10 min limit). Please request a new one.' };

    // Hash the user's input and compare to stored hash
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(inputCode.trim()));
    const inputHex = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (code !== inputHex) {
      await updateDoc(ref, { attempts: attempts + 1 });
      const left = OTP_MAX_ATTEMPTS - (attempts + 1);
      return {
        ok:     false,
        reason: `Incorrect OTP code. ${
          left > 0 ? `${left} attempt(s) remaining.` : 'No attempts remaining — request a new OTP.'
        }`,
      };
    }

    await updateDoc(ref, { used: true });
    return { ok: true };
  } catch (e) {
    // SECURITY: Don't expose internal error details to the client
    console.error('OTP verification error:', e);
    return { ok: false, reason: 'Verification failed. Please try again.' };
  }
}
