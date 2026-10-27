import { useEffect, useState } from 'react';

export default function SaveToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timeout;

    function showToast(event) {
      clearTimeout(timeout);
      setToast(event.detail);
      timeout = setTimeout(() => setToast(null), 3000);
    }

    window.addEventListener('app-saved', showToast);
    return () => {
      window.removeEventListener('app-saved', showToast);
      clearTimeout(timeout);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10000, background: toast.type === 'error' ? '#e53e3e' : '#38a169',
        color: '#fff', padding: '10px 20px', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,.2)', fontWeight: 600,
      }}
    >
      {toast.text}
    </div>
  );
}
