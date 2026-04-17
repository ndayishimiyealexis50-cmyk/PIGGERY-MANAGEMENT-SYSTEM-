import { useState, useEffect } from "react";

export default function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 9999,
      background: type === "error" ? "#e53e3e" : "#38a169",
      color: "white", padding: "10px 20px", borderRadius: 8
    }}>
      {message}
    </div>
  );
}
