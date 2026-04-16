import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCBH-3ql8onw17geHrJXKUwdhN-EVjtg14",
  authDomain: "my-farm-track.firebaseapp.com",
  projectId: "my-farm-track",
  storageBucket: "my-farm-track.firebasestorage.app",
  messagingSenderId: "529287963399",
  appId: "1:529287963399:web:733a9828916b61f4525ba2",
  measurementId: "G-064719MRR4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
