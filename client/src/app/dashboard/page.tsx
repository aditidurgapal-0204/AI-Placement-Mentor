"use client";

import React from 'react';
import { useAnalysisStore } from "@/store/useAnalysisStore";
import { selectDashboardAnalysis } from "@/lib/dashboardAnalysisCompatibility";

export default function DashboardPage() {
  const { analysis: legacyAnalysis, analysisV2 } = useAnalysisStore();
  const analysis = selectDashboardAnalysis(legacyAnalysis, analysisV2);

  if (!analysis) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center bg-[#090514]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const readinessScore = analysis.readiness.score;
  const diagnosis = analysis.diagnosis;
  const scoreBlockers = analysis.scoreBlockers;
  const careerRisks = analysis.careerRisks;
  const legacyLimitations = analysis.limitations;
  const displayedStrengths = analysis.strengths;
  const displayedScoreBlockers = scoreBlockers.length || analysis.context
    ? scoreBlockers
    : legacyLimitations.map((text, index) => ({ id: `legacy-limitation-${index + 1}`, text }));

  // Compute status parameters with premium color combinations and glow states
  const riskLabel = analysis.readiness.label;
  let riskBadgeColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]';
  let strokeColor = '#f59e0b';

  if (readinessScore < 45) {
    riskBadgeColor = 'text-rose-400 border-rose-500/30 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.15)]';
    strokeColor = '#f43f5e';
  } else if (readinessScore >= 75) {
    riskBadgeColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
    strokeColor = '#10b981';
  }

  // Circular gauge math configuration
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (readinessScore / 100) * circumference;

  return (
    <div className="min-h-screen w-full bg-[#090514] text-slate-100 antialiased selection:bg-purple-500/30 font-sans">
      <div className="w-full px-6 py-16 sm:px-12 lg:px-16">
        <div className="space-y-12">
          
          {/* HEADER SECTION */}
          <header className="space-y-3 border-b border-white/[0.06] pb-10 text-center">
            <h1 className="bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl md:text-6xl uppercase">
              Placement Insights
            </h1>
            <p className="mx-auto max-w-xl text-xs font-semibold uppercase tracking-widest text-purple-400/80 sm:text-sm">
              Real-time Performance Metrics &amp; Diagnostic Core
            </p>
          </header>

          {/* SECTION 1 — READINESS SCORE */}
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-white/[0.01] p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
                
                {/* Circular Gauge */}
                <div className="relative h-28 w-28 flex-shrink-0 drop-shadow-[0_0_12px_rgba(255,255,255,0.05)]">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      className="stroke-white/[0.05]"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      stroke={strokeColor}
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold tracking-tight text-white">{readinessScore}%</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${riskBadgeColor}`}>
                      {riskLabel}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-slate-300 sm:text-base">
                    {analysis.readiness.summary}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2 — AI DIAGNOSIS */}
          <section className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-950/20 via-purple-900/[0.03] to-transparent p-8 shadow-2xl shadow-purple-950/20 sm:p-10">
            <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full bg-purple-500/[0.08] blur-3xl" />
            <div className="absolute right-12 bottom-0 h-32 w-32 rounded-full bg-purple-500/[0.03] blur-3xl" />
            
            <div className="relative space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                AI Diagnosis
              </h2>
              <p className="text-base font-normal leading-relaxed tracking-wide text-slate-200/90 sm:text-lg">
                {diagnosis}
              </p>
            </div>
          </section>

          {analysis.firstPriority && (
            <section className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/15 via-white/[0.01] to-transparent p-6 shadow-xl backdrop-blur-xl sm:p-8">
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400">
                  First Priority
                </h2>
                <p className="text-sm font-medium leading-relaxed text-slate-200 sm:text-base">
                  {analysis.firstPriority.text}
                </p>
              </div>
            </section>
          )}

          {/* DUAL WORKSPACE LAYOUT: SCORE BLOCKERS & CAREER RISKS */}
          <div className="grid gap-8 lg:grid-cols-2">
            
            {/* SECTION 3 — WHAT'S HOLDING YOU BACK */}
            <section className="space-y-5">
              <div className="flex items-center gap-3 border-b border-rose-500/10 pb-3">
                <h2 className="text-lg font-bold tracking-tight text-slate-200 sm:text-xl">Score Blockers</h2>
                <span className="rounded bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400">{displayedScoreBlockers.length}</span>
              </div>
              <div className="space-y-3">
                {displayedScoreBlockers.map((weakness) => (
                  <div
                    key={weakness.id}
                    className="group relative overflow-hidden rounded-xl border border-rose-500/10 bg-gradient-to-r from-rose-950/10 via-white/[0.01] to-transparent p-4 transition-all hover:border-rose-500/20 hover:from-rose-950/20"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-rose-500/40 group-hover:bg-rose-500 transition-colors" />
                    <div className="flex items-start gap-3 pl-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                      <p className="text-sm font-medium leading-relaxed text-slate-300 group-hover:text-slate-200 transition-colors">
                        {weakness.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION 4 — YOUR STRENGTHS */}
            {careerRisks.length > 0 ? (
              <section className="space-y-5">
                <div className="flex items-center gap-3 border-b border-amber-500/10 pb-3">
                  <h2 className="text-lg font-bold tracking-tight text-slate-200 sm:text-xl">Career Risks</h2>
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">{careerRisks.length}</span>
                </div>
                <div className="space-y-3">
                  {careerRisks.map((risk) => (
                    <div
                      key={risk.id}
                      className="group relative overflow-hidden rounded-xl border border-amber-500/10 bg-gradient-to-r from-amber-950/10 via-white/[0.01] to-transparent p-4 transition-all hover:border-amber-500/20 hover:from-amber-950/20"
                    >
                      <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-amber-500/40 group-hover:bg-amber-500 transition-colors" />
                      <div className="flex items-start gap-3 pl-2">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                        <p className="text-sm font-medium leading-relaxed text-slate-300 group-hover:text-slate-200 transition-colors">
                          {risk.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : <div />}
          </div>

          {displayedStrengths.length > 0 ? (
            <section className="space-y-5">
              <div className="flex items-center gap-3 border-b border-emerald-500/10 pb-3">
                <h2 className="text-lg font-bold tracking-tight text-slate-200 sm:text-xl">Your Strengths</h2>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">{displayedStrengths.length}</span>
              </div>
              <div className="space-y-3">
                {displayedStrengths.map((strength) => (
                  <div
                    key={strength.id}
                    className="group relative overflow-hidden rounded-xl border border-emerald-500/10 bg-gradient-to-r from-emerald-950/10 via-white/[0.01] to-transparent p-4 transition-all hover:border-emerald-500/20 hover:from-emerald-950/20"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-emerald-500/40 group-hover:bg-emerald-500 transition-colors" />
                    <div className="flex items-start gap-3 pl-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      <p className="text-sm font-medium leading-relaxed text-slate-300 group-hover:text-slate-200 transition-colors">
                        {strength.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* SECTION 5 — PLACEMENT ACTION PLAN */}
          <section className="space-y-5">
            <h2 className="text-lg font-bold tracking-tight text-slate-200 sm:text-xl">Placement Action Plan</h2>
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-12 text-center shadow-inner">
              <p className="text-sm font-medium tracking-wide text-slate-500 sm:text-base">
                Your personalized placement roadmap will appear here.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
