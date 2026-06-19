'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { X } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const { setView, closeModal } = useAuthStore();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

 const handleLogin = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (data.token) {
        localStorage.setItem("token", data.token);
        setLoginError("");
        closeModal();

        // 🚀 THE CONDITIONAL REDIRECT MATRIX
        if (data.user.isOnboardingComplete === true) {
          // Possibility A: User has completely finalized profile tracking -> Go directly to dashboard
          router.push("/dashboard");
        } else {
          // Possibility B & C: User has partial or zero onboarding records -> Go to setup page
          // The page router will automatically inspect their step state and open the exact view!
          router.push("/setup");
        }
      } else {
        setLoginError(data.message || "Invalid credentials");
      }

      console.log(data);
    } catch (error) {
      console.log(error);
      setLoginError("Failed to connect to the authentication server.");
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md" style={{ zIndex: 9999 }}>
      <div 
        className="rounded-[24px] border border-purple-900/40 bg-[#090514] shadow-[0_0_60px_rgba(168,85,247,0.18)] relative"
        style={{ width: '420px', padding: '40px 32px', boxSizing: 'border-box' }}
      >
        <button
          onClick={closeModal}
          className="absolute text-gray-500 hover:text-white transition-colors"
          style={{ top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <h2 className="font-semibold text-center text-white" style={{ fontSize: '26px', lineHeight: '32px', marginBottom: '8px' }}>Login</h2>
        <p className="text-center text-gray-400" style={{ fontSize: '14px', lineHeight: '20px', marginBottom: '32px' }}>Welcome back! Please login to your account</p>

        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loginError && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-300" style={{ padding: "14px 16px", borderRadius: "12px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
              <span style={{ fontSize: "18px" }}>⚠️</span>{loginError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1', textAlign: 'left' }}>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              className="placeholder-gray-500 text-white focus:outline-none transition-all"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(147, 51, 234, 0.25)', backgroundColor: '#0c071b', padding: '0 16px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1', textAlign: 'left' }}>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              className="placeholder-gray-500 text-white focus:outline-none transition-all"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(147, 51, 234, 0.25)', backgroundColor: '#0c071b', padding: '0 16px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
            <button
              type="button"
              onClick={() => setView('FORGOT_PASSWORD')}
              className="text-purple-400 hover:text-purple-300 transition-colors"
              style={{ fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            className="bg-gradient-to-r from-purple-500 to-blue-500 font-semibold text-white shadow-md shadow-purple-500/20 hover:opacity-95 active:scale-[0.99] transition-all"
            style={{ width: '100%', height: '48px', borderRadius: '12px', fontSize: '15px', border: 'none', cursor: 'pointer', marginTop: '8px' }}
          >
            Login
          </button>
        </form>

        <div style={{ borderTop: '1px solid rgba(147, 51, 234, 0.15)', marginTop: '28px', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Don&apos;t have an account?{" "}
            <button
              onClick={() => setView('SIGNUP')}
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}