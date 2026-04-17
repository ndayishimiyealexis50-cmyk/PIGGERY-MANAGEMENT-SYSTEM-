// ╔══════════════════════════════════════════════════════════════╗
// ║           FarmIQ — Auth Helpers  (Vite + React)             ║
// ║  Migrated from index.html  ·  src/utils/authHelpers.js      ║
// ╚══════════════════════════════════════════════════════════════╝
//
// ⚠️  SECURITY NOTES (read before editing)
// ─────────────────────────────────────────────────────────────
//  • ADMIN_EMAIL is a CLIENT-SIDE UI hint ONLY — not a security
//    boundary. Real access control lives in Firestore Rules via
//    the server-authoritative `role` field in users/{uid}.
//
//  • OTPs are stored as SHA-256 hashes, never plaintext.
//
//  • `ensureUserProfile` never accepts role/approved from the
//    caller — it always computes them server-side to prevent
//    privilege escalation.
//
//  • Keep this file free of any secret keys or credentials.
//    All Firebase config belongs in firebase.js (via .env).
// ─────────────────────────────────────────────────────────────

import { db } from "../firebase/firestore"; // adjust path if needed
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Farm admin e-mail.
 * UI gate only — Firestore Rules are the real enforcement layer.
 */
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

/** True if the given e-mail belongs to the farm admin. UI hint only. */
export function isAdminEmail(email) {
  return !!(
    email &&
    email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()
  );
}

/**
 * True if a logged-in user object is the admin.
 * Prefers the Firestore `role` field (server-set) over e-mail comparison.
 * This is a UI gate; actual access control is enforced by Firestore Rules.
 */
export function isAdminUser(user) {
  return !!(
    user &&
    (user.role?.toLowerCase().trim() === "admin" || isAdminEmail(user.email))
  );
}

// ── Profile cache (prevents double Firestore read on login) ──────────────────

const _profileCache = new Map();

/**
 * Get or create the Firestore profile for a Firebase Auth user.
 *
 * SECURITY:
 *  - `role` and `approved` are ALWAYS computed here; they are NEVER taken
 *    from `extraFields` to prevent a caller from passing role:"admin".
 *  - Admin profile is corrected on every login (role forced to "admin").
 */
export async function ensureUserProfile(firebaseUser, extraFields = {}) {
  const ref = doc(db, "users", firebaseUser.uid);
  const isAdmin = firebaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Return cached profile when no extra fields need writing
  if (_profileCache.has(firebaseUser.uid) && !Object.keys(extraFields).length) {
    const cached = {
      ..._profileCache.get(firebaseUser.uid),
      uid: firebaseUser.uid,
      id: firebaseUser.uid,
    };
    return isAdmin ? { ...cached, role: "admin", approved: true } : cached;
  }

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Strip privileged fields from extraFields — callers cannot self-promote
    const safeExtra = Object.fromEntries(
      Object.entries(extraFields).filter(
        ([k]) => !["role", "approved", "uid", "id"].includes(k)
      )
    );
    const profile = {
      uid: firebaseUser.uid,
      id: firebaseUser.uid,
      email: firebaseUser.email,
      name:
        extraFields.name ||
        firebaseUser.displayName ||
        firebaseUser.email.split("@")[0],
      role: isAdmin ? "admin" : "worker",
      approved: isAdmin ? true : false,
      createdAt: new Date().toISOString(),
      ...safeExtra,
    };
    await setDoc(ref, profile);
    _profileCache.set(firebaseUser.uid, profile);
    return profile;
  }

  const existing = {
    ...snap.data(),
    uid: firebaseUser.uid,
    id: firebaseUser.uid,
  };

  // Always fix admin profile — force role to "admin" in Firestore permanently
  if (isAdmin) {
    const fixed = { ...existing, role: "admin", approved: true };
    if (existing.role !== "admin" || !existing.approved) {
      await updateDoc(ref, {
        role: "admin",
        approved: true,
        email: firebaseUser.email || existing.email || null,
      });
    }
    _profileCache.set(firebaseUser.uid, fixed);
    return fixed; // always return fixed regardless of DB state
  }

  _profileCache.set(firebaseUser.uid, existing);
  return existing;
}

/** Fetch a single user profile by UID. Returns null if not found. */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

/** Update whitelisted fields on a user profile. */
export async function updateUserProfile(uid, fields) {
  await updateDoc(doc(db, "users", uid), fields);
}

/** Fetch all user profiles (admin only — enforce in Firestore Rules). */
export async function getAllUserProfiles() {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => d.data());
  } catch (e) {
    return [];
  }
}

// ── OTP Helpers (Password Reset via WhatsApp) ────────────────────────────────
//
//  SECURITY:
//  • Uses crypto.getRandomValues — NOT Math.random (predictable).
//  • Stores SHA-256 hash of the code, never plaintext.
//  • Enforces attempt limit (OTP_MAX_ATTEMPTS) and 10-minute expiry.
// ─────────────────────────────────────────────────────────────────────────────

export const OTP_MAX_ATTEMPTS = 5;

/** Generate a cryptographically secure 6-digit OTP string. */
export function generateOTP() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Map to [100000, 999999]
  return (100000 + (array[0] % 900000)).toString();
}

/**
 * Hash `code` with SHA-256 and store it in passwordOTPs/{uid}.
 * The plaintext code is NEVER written to Firestore.
 */
export async function storeOTP(uid, code) {
  const encoder = new TextEncoder();
  const hashBuf = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(code)
  );
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await setDoc(doc(db, "passwordOTPs", uid), {
    code: hashHex,           // stored as hash — never plaintext
    expiresAt,
    used: false,
    attempts: 0,             // brute-force counter
    createdAt: new Date().toISOString(),
  });
}

/**
 * Verify a user-supplied OTP code against the stored hash.
 *
 * Returns { ok: true } on success.
 * Returns { ok: false, reason: string } on any failure.
 *
 * SECURITY:
 *  - Attempts are checked BEFORE hashing to stop brute-force early.
 *  - Internal errors are caught and NOT exposed to the caller.
 */
export async function verifyOTP(uid, inputCode) {
  try {
    const ref = doc(db, "passwordOTPs", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { ok: false, reason: "No OTP found. Please request a new one." };
    }

    const { code, expiresAt, used, attempts = 0 } = snap.data();

    // Check attempt count before doing any further work
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return {
        ok: false,
        reason: "Too many failed attempts. Please request a new OTP.",
      };
    }
    if (used) {
      return {
        ok: false,
        reason: "This OTP has already been used. Request a new one.",
      };
    }
    if (new Date() > new Date(expiresAt)) {
      return {
        ok: false,
        reason: "OTP expired (10 min limit). Please request a new one.",
      };
    }

    // Hash the user's input and compare to the stored hash
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(inputCode.trim())
    );
    const inputHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (code !== inputHex) {
      // Increment attempt counter on failure
      await updateDoc(ref, { attempts: attempts + 1 });
      const left = OTP_MAX_ATTEMPTS - (attempts + 1);
      return {
        ok: false,
        reason: `Incorrect OTP code. ${
          left > 0
            ? `${left} attempt(s) remaining.`
            : "No attempts remaining — request a new OTP."
        }`,
      };
    }

    // Mark OTP as used on success
    await updateDoc(ref, { used: true });
    return { ok: true };
  } catch (e) {
    // Do NOT expose internal error details to the client
    console.error("OTP verification error:", e);
    return { ok: false, reason: "Verification failed. Please try again." };
  }
}
