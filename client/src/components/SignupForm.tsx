'use client';
import { API_BASE_URL } from "@/lib/api";

import { useRef, useState } from 'react';
// 🚀 1. IMPORT THE ROUTER HOOK
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { X } from 'lucide-react';

export default function SignupForm() {
  // 🚀 2. INITIALIZE THE NAVIGATION ENGINE
  const router = useRouter();
  
  // Destructure setSession exactly matching your useAuthStore configurations
  const { setView, closeModal, setSession } = useAuthStore();

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInProgress = useRef(false);

  const clearMessages = () => {
    setSignupError("");
    setSignupSuccess("");
  };

  const handleClose = () => {
    clearMessages();
    closeModal();
  };

  const handleFieldChange = (setter: (value: string) => void, value: string) => {
    clearMessages();
    setter(value);
  };

  const handleSignup = async () => {
    if (submissionInProgress.current) return;
    clearMessages();

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setSignupError("Please fill in all the required fields before signing up.");
      return;
    }

    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(signupName.trim())) {
      setSignupError("Full Name can only contain letters and spaces. Numbers or special characters are not allowed.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail.trim())) {
      setSignupError("Please enter a valid email address containing an '@' and a domain (e.g., user@example.com).");
      return; 
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(signupPassword)) {
      setSignupError("Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number.");
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: signupName.trim(),
          email: signupEmail.trim(),
          password: signupPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok || response.status === 201) {
        setSignupSuccess(data.message || "User created successfully!");
        
        if (data.token) {
          localStorage.setItem("token", data.token);
        }

        // 🚀 THE TYPING FIX: Pass the raw data.user block directly from the API response
        // This will automatically match the correct TypeScript interfaces of your Zustand store!
        if (data.user) {
          setSession(data.user);
        }

        // Clear out input fields upon successful completion
        setSignupName("");
        setSignupEmail("");
        setSignupPassword("");
        setSignupError("");
        
        setTimeout(() => {
          handleClose();
          router.push("/setup");
        }, 1200);
      }

      else {
        const safeBackendMessage = typeof data.message === "string" ? data.message : "";
        if (response.status === 400 || response.status === 409 || response.status === 503) {
          setSignupError(safeBackendMessage || "Signup could not be completed. Please check your details and try again.");
        } else {
          setSignupError("Server error. Please try again later.");
        }
      }
    } catch {
      setSignupError("Unable to connect to the server. Please try again.");
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md" style={{ zIndex: 9999 }}>
      <div 
        className="rounded-[24px] border border-purple-900/40 bg-[#090514] shadow-[0_0_60px_rgba(168,85,247,0.18)] relative"
        style={{ width: '420px', padding: '40px 32px', boxSizing: 'border-box' }}
      >
        <button
          onClick={handleClose}
          className="absolute text-gray-500 hover:text-white transition-colors"
          style={{ top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <h2 className="font-semibold text-center text-white" style={{ fontSize: '26px', lineHeight: '32px', marginBottom: '8px' }}>Sign up</h2>
        <p className="text-center text-gray-400" style={{ fontSize: '14px', lineHeight: '20px', marginBottom: '32px' }}>Create your account to get started</p>

        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {signupError && (
            <div
              className="border border-red-500/40 bg-red-500/10 text-red-300"
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "14px",
              }}
            >
              <span style={{ fontSize: "18px" }}>⚠️</span>
              {signupError}
            </div>
          )}

          {signupSuccess && (
            <div
              className="border border-green-500/40 bg-green-500/10 text-green-300"
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "14px",
              }}
            >
              <span style={{ fontSize: "18px" }}>✅</span>
              {signupSuccess}
            </div>
          )}

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1', textAlign: 'left' }}>Full Name</label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={signupName}
              onChange={(e) => handleFieldChange(setSignupName, e.target.value)}
              className="placeholder-gray-500 text-white focus:outline-none transition-all"
              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(147, 51, 234, 0.25)', backgroundColor: '#0c071b', padding: '0 16px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1', textAlign: 'left' }}>Email</label>
            <input
              type="text" 
              placeholder="Enter your email"
              className="placeholder-gray-500 text-white focus:outline-none transition-all"
              value={signupEmail}
              onChange={(e) => handleFieldChange(setSignupEmail, e.target.value)}
              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(147, 51, 234, 0.25)', backgroundColor: '#0c071b', padding: '0 16px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1', textAlign: 'left' }}>Password</label>
            <input
              type="password"
              placeholder="Create a password"
              className="placeholder-gray-500 text-white focus:outline-none transition-all"
              value={signupPassword}
              onChange={(e) => handleFieldChange(setSignupPassword, e.target.value)}
              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(147, 51, 234, 0.25)', backgroundColor: '#0c071b', padding: '0 16px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={handleSignup}
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-purple-500 to-blue-500 font-semibold text-white shadow-md shadow-purple-500/20 hover:opacity-95 active:scale-[0.99] transition-all"
            style={{ width: '100%', height: '48px', borderRadius: '12px', fontSize: '15px', border: 'none', cursor: 'pointer', marginTop: '12px' }}
          >
            {isSubmitting ? "Signing up..." : "Sign up"}
          </button>
        </form>

        <div style={{ borderTop: '1px solid rgba(147, 51, 234, 0.15)', marginTop: '28px', paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Already have an account?{" "}
            <button
              onClick={() => { clearMessages(); setView('LOGIN'); }}
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
