"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface AnalysisStep {
  id: number;
  label: string;
  status: "idle" | "loading" | "complete";
}

function AnalysisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Extract state: check if the query string explicitly says 'true'
  const isSkipped = searchParams.get("skipped") === "true";

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);

  // 🚀 INITIALIZE DYNAMIC TEXT PARAMETERS
  useEffect(() => {
    setSteps([
      { id: 1, label: "Understanding skill levels", status: "loading" },
      { 
        id: 2, 
        // Dynamic label toggles automatically based on user onboarding choices
        label: isSkipped ? "Evaluating profile information" : "Evaluating resume details", 
        status: "idle" 
      },
      { id: 3, label: "Detecting weak areas", status: "idle" },
      { id: 4, label: "Calculating placement readiness", status: "idle" },
      { id: 5, label: "Building personalized roadmap", status: "idle" },
    ]);
  }, [isSkipped]);

  useEffect(() => {
    const triggerBackendAnalysis = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/ai/generate-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!response.ok) console.warn("Using visual fallback timing parameter setup.");
      } catch (err) {
        console.error("Network interface connection error:", err);
      } finally {
        setTimeout(() => {
          router.push("/dashboard");
        }, 4200); 
      }
    };

    triggerBackendAnalysis();
  }, [router]);

  useEffect(() => {
    if (steps.length === 0 || currentStepIndex >= steps.length) return;

    const timer = setTimeout(() => {
      setSteps((prevSteps) =>
        prevSteps.map((step, idx) => {
          if (idx === currentStepIndex) return { ...step, status: "complete" };
          if (idx === currentStepIndex + 1) return { ...step, status: "loading" };
          return step;
        })
      );
      setCurrentStepIndex((prev) => prev + 1);
    }, 750);

    return () => clearTimeout(timer);
  }, [currentStepIndex, steps.length]);

  return (
    <div className="min-h-screen bg-[#060212] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      
      {/* GLOWING AI EFFECTS */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-600/15 to-blue-600/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[4000ms]" />
      <div className="absolute -top-40 left-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg space-y-12 z-10">
        
        {/* MASTER ANIMATION MODULE */}
        <div className="flex flex-col items-center text-center space-y-5">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-md animate-ping duration-[2500ms]" />
            <div className="absolute inset-0 rounded-full border-4 border-purple-950/30" />
            <div className="absolute inset-0 rounded-full border-4 border-t-purple-400 border-r-blue-400 border-b-transparent border-l-transparent animate-spin duration-[1200ms]" />
            
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-purple-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-purple-100 to-slate-200">
              Analyzing Your Profile...
            </h1>
            <p className="text-[10px] text-blue-400/60 font-semibold uppercase tracking-widest bg-blue-500/5 border border-blue-500/10 px-3 py-1 rounded-full inline-block">
              Engine Status: Computing Roadmap Core
            </p>
          </div>
        </div>

        {/* INTERACTIVE CHECKLIST COMPONENT */}
        <div className="bg-[#0e0724]/40 border border-purple-950/50 backdrop-blur-xl rounded-2xl p-7 space-y-4.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-4 transition-all duration-500 ease-out ${
                step.status === "idle" ? "opacity-20 scale-[0.97] blur-[0.5px]" : "opacity-100 scale-100"
              }`}
            >
              <div className="flex-shrink-0">
                {step.status === "complete" ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)] scale-110 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : step.status === "loading" ? (
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-purple-400 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-purple-950/70 bg-purple-950/30" />
                )}
              </div>

              <p className={`text-sm font-medium transition-colors duration-300 ${
                step.status === "complete" 
                  ? "text-slate-300 line-through decoration-slate-500/30 font-normal" 
                  : step.status === "loading" 
                    ? "text-purple-300 font-semibold drop-shadow-[0_0_8px_rgba(192,132,252,0.2)] animate-pulse" 
                    : "text-slate-500"
              }`}>
                {step.label}
              </p>
            </div>
          ))}
        </div>

        {/* REAL-TIME DYNAMIC LOADING PROGRESS BAR */}
        <div className="space-y-2 px-1">
          <div className="w-full h-[3px] bg-purple-950/40 rounded-full overflow-hidden border border-purple-950/10">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(147,51,234,0.5)]"
              style={{ width: `${steps.length > 0 ? (currentStepIndex / steps.length) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-medium text-slate-500/70 tracking-wide px-0.5">
            <span>SYNTHESIZING CRITERIA</span>
            <span className="font-bold text-purple-400/80 animate-pulse">
              {steps.length > 0 ? Math.round((currentStepIndex / steps.length) * 100) : 0}%
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

// Wrap inside a Suspense boundary to cleanly handle query parameter compiling in Next.js build engines
export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060212] flex items-center justify-center text-slate-400 text-sm">
        Initializing Processing Nodes...
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  );
}