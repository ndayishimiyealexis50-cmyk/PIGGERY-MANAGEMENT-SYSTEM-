export const sendWhatsApp = (phone, message) => {
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
};
export const isWAEnabled = true;
