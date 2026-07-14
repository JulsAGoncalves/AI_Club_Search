export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        gap: "1.5rem",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        AI Club Search
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "1.1rem", maxWidth: "480px" }}>
        Your app is running. Start building in{" "}
        <code
          style={{
            fontFamily: "monospace",
            background: "var(--card)",
            border: "1px solid var(--border)",
            padding: "0.15rem 0.4rem",
            borderRadius: "4px",
          }}
        >
          frontend/app/page.tsx
        </code>
      </p>
    </main>
  );
}
