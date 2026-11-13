"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../context/UserContext";
import { signInOrCreateUser } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: userLoading, setUser } = useUser();
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && user) {
      router.replace("/chat");
    }
  }, [user, userLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email || loading) return;

    setLoading(true);
    setError(null);

    try {
      const signedIn = await signInOrCreateUser(email, nameInput);
      setUser(signedIn);
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  if (userLoading) {
    return null;
  }

  return (
    <main className="auth-wrap">
      <form className="auth-box" onSubmit={handleSubmit}>
        <div className="auth-title">Minimi</div>
        <p className="auth-sub">Enter your email to start chatting.</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            className="input"
            placeholder="you@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="field">
          <label htmlFor="name">Name (optional)</label>
          <input
            id="name"
            type="text"
            className="input"
            placeholder="Your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            disabled={loading}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Continuing..." : "Continue"}
        </button>
      </form>
    </main>
  );
}

