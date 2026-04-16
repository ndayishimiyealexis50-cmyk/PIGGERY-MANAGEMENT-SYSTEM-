// src/lib/firebase.js
// Replaces: §5 FIREBASE CONFIG + inline firebase.initializeApp() in index.html
//
// ⚠️  Move these values to .env in production:
//     VITE_FIREBASE_API_KEY=...  etc.
//     Then reference as import.meta.env.VITE_FIREBASE_API_KEY

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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

const app            = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
