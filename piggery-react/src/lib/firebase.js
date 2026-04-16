// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            "AIzaSyCBH-3ql8onw17geHrJXKUwdhN-EVjtg14",
  authDomain:        "my-farm-track.firebaseapp.com",
  projectId:         "my-farm-track",
  storageBucket:     "my-farm-track.firebasestorage.app",
  messagingSenderId: "529287963399",
  appId:             "1:529287963399:web:733a9828916b61f4525ba2",
  measurementId:     "G-064719MRR4",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const FS_FARM_DOC = "farmData";

export async function getOnlineFarmData(db, farmId) {
  try {
    const ref = doc(db, FS_FARM_DOC, farmId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("getOnlineFarmData error:", e);
    return null;
  }
}
