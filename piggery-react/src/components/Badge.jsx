export default function Badge({ n }) {
  if (!n || n < 1) return null;
  return (
    <span style={{
      background: "#e53935", color: "#fff", fontSize: 10, fontWeight: 700,
      minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      marginLeft: 6
    }}>{n > 99 ? "99+" : n}</span>
  );
}
