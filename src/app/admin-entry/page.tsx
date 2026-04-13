"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Invalid admin key.");
      return;
    }

    router.replace(redirect);
  };

  return (
    <main className="page-shell min-h-screen flex items-center justify-center">
      <div className="w-full max-w-xl card relative bg-[radial-gradient(circle,rgba(180,255,57,0.05),transparent_60%),var(--bg-container)]">
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-(--accent)" />
        <p className="label flex items-center gap-2 text-(--accent)">
          ADMIN ENTRY
          <span className="inline-block w-1.5 h-1.5 bg-(--accent) animate-pulse" />
        </p>
        <h1 className="font-headline text-4xl md:text-5xl font-black uppercase leading-tight tracking-tight">
          ENTER ADMINISTRATIVE ACCESS KEY
        </h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="ACCESS KEY"
            required
          />
          {error && <p className="text-sm text-(--error)" role="alert">{error}</p>}
          <button className="button-danger w-full" type="submit" disabled={loading}>
            {loading ? "AUTHORIZING..." : "AUTHORIZE ->"}
          </button>
        </form>
      </div>
    </main>
  );
}
