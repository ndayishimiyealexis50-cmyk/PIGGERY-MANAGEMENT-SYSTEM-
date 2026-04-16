import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const _profileCache = {};

export const isAdminEmail = (email) => {
  const admins = ["ndayishimiyealexis50@gmail.com"];
  return admins.includes(email);
};

export const ensureUserProfile = async (user) => {
  if (!user) return;
  if (_profileCache[user.uid]) return _profileCache[user.uid];
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile = {
      uid: user.uid,
      email: user.email,
      name: user.displayName || "",
      role: isAdminEmail(user.email) ? "admin" : "worker",
      createdAt: new Date().toISOString()
    };
    await setDoc(ref, profile);
    _profileCache[user.uid] = profile;
    return profile;
  }
  _profileCache[user.uid] = snap.data();
  return snap.data();
};
