import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { loginWithGoogle } = useAuth();

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#f0fdf4", gap: "20px"
    }}>
      <h1 style={{ color: "#16a34a", fontSize: "2rem" }}>🐷 FarmIQ</h1>
      <p style={{ color: "#555" }}>Pig Farm Management System</p>
      <button onClick={loginWithGoogle} style={{
        background: "#16a34a", color: "white",
        border: "none", padding: "12px 24px",
        borderRadius: "8px", fontSize: "1rem", cursor: "pointer"
      }}>
        Sign in with Google
      </button>
    </div>
  );
}
