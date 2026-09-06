'use client';
import { API_BASE_URL } from "@/lib/api";

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { X } from 'lucide-react';

export default function ForgotPasswordForm() {
  const { closeModal } = useAuthStore();

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const handleForgotPassword = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: forgotEmail,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setForgotSuccess(data.message);
        setForgotError("");
      } else {
        setForgotError(data.message);
        setForgotSuccess("");
      }
    } catch (error) {
      console.log(error);
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

        <h2 className="font-semibold text-center text-white" style={{ fontSize: '26px', lineHeight: '32px', marginBottom: '8px' }}>Forgot Password</h2>
        <p className="text-center text-gray-400" style={{ fontSize: '14px', lineHeight: '20px', marginBottom: '32px' }}>Enter your email to receive a password reset link.</p>

        {forgotError && (
          <div className="border border-red-500/40 bg-red-500/10 text-red-300" style={{ padding: "14px 16px", borderRadius: "12px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>⚠️</span>{forgotError}
          </div>
        )}

        {forgotSuccess && (
          <div className="border border-green-500/40 bg-green-500/10 text-green-300" style={{ padding: "14px 16px", borderRadius: "12px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>✅</span>{forgotSuccess}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1', textAlign: 'left' }}>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            className="placeholder-gray-500 text-white focus:outline-none transition-all"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(147, 51, 234, 0.25)', backgroundColor: '#0c071b', padding: '0 16px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={handleForgotPassword}
          className="bg-gradient-to-r from-purple-500 to-blue-500 font-semibold text-white shadow-md shadow-purple-500/20 hover:opacity-95 active:scale-[0.99] transition-all"
          style={{ width: '100%', height: '48px', borderRadius: '12px', fontSize: '15px', border: 'none', cursor: 'pointer' }}
        >
          Send Reset Link
        </button>
      </div>
    </div>
  );
}