import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const storeOTP = async (phone, otp) => {
  const expires = Date.now() + 10 * 60 * 1000; // 10 min
  await setDoc(doc(db, "otps", phone), { otp, expires });
};

export const verifyOTP = async (phone, otp) => {
  const snap = await getDoc(doc(db, "otps", phone));
  if (!snap.exists()) return false;
  const { otp: stored, expires } = snap.data();
  return stored === otp && Date.now() < expires;
};

export const getWAConfig = () => ({
  apiUrl: "https://api.whatsapp.com",
  phone: "250700000000" // replace with your WhatsApp number
});
