export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
export const storeOTP = (otp) => { localStorage.setItem('otp', otp); };
export const verifyOTP = (otp) => localStorage.getItem('otp') === otp;
