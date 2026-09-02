"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/api";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (password !== confirmation) return setError("Passwords do not match.");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)) {
      return setError("Use at least 6 characters with uppercase, lowercase, and a number.");
    }
    setPending(true);
    try {
      const response = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, password })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Password reset failed.");
      setMessage(body.message); setPassword(""); setConfirmation("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password reset failed.");
    } finally { setPending(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#070311] px-4 text-white">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-purple-500/20 bg-white/[.04] p-8">
      <h1 className="text-3xl font-bold">Reset password</h1>
      <p className="mt-2 text-sm text-slate-400">Choose a new password for your account.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p className="mt-5 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
      <label className="mt-6 block text-sm text-slate-300">New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-purple-500/25 bg-black/20 px-4" required /></label>
      <label className="mt-4 block text-sm text-slate-300">Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-purple-500/25 bg-black/20 px-4" required /></label>
      <button disabled={pending || Boolean(message)} className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 font-semibold disabled:opacity-50">{pending ? "Resetting…" : "Reset password"}</button>
      <Link href="/" className="mt-5 block text-center text-sm text-purple-300">Return to login</Link>
    </form>
  </main>;
}
