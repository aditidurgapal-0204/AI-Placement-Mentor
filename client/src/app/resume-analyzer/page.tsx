"use client";
import { API_BASE_URL } from "@/lib/api";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Brain, Check, FileText, RotateCcw, ShieldCheck, Sparkles, Upload, X } from "lucide-react";

interface Breakdown { category: string; score: number; maxScore: number }
interface SectionFeedback { section: string; status: "Strong" | "Present" | "Needs Improvement" | "Missing"; feedback: string }
interface ResumeAnalysis {
  contractVersion: "1.0"; atsScore: number; scoreLabel: string; summary: string;
  scoreBreakdown: Breakdown[]; strengths: string[]; weaknesses: string[];
  sectionFeedback: SectionFeedback[]; recommendations: string[];
}

const PROCESSING_STEPS = ["Extracting resume content", "Checking ATS compatibility", "Evaluating resume structure", "Reviewing skills and experience", "Identifying improvement opportunities"];

const isResumeAnalysis = (value: unknown): value is ResumeAnalysis => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const strings = (candidate: unknown) => Array.isArray(candidate) && candidate.length > 0 && candidate.every((entry) => typeof entry === "string" && entry.trim());
  const breakdownValid = Array.isArray(item.scoreBreakdown) && item.scoreBreakdown.length === 5 && item.scoreBreakdown.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    return typeof row.category === "string" && Number.isInteger(row.score) && Number(row.score) >= 0 && Number(row.score) <= 20 && row.maxScore === 20;
  });
  const sectionsValid = Array.isArray(item.sectionFeedback) && item.sectionFeedback.length > 0 && item.sectionFeedback.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    return typeof row.section === "string" && typeof row.feedback === "string" && ["Strong", "Present", "Needs Improvement", "Missing"].includes(String(row.status));
  });
  return item.contractVersion === "1.0" && Number.isInteger(item.atsScore) && Number(item.atsScore) >= 0 && Number(item.atsScore) <= 100
    && typeof item.scoreLabel === "string" && typeof item.summary === "string"
    && breakdownValid && strings(item.strengths) && strings(item.weaknesses)
    && sectionsValid && strings(item.recommendations);
};

export default function ResumeAnalyzerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStep((current) => Math.min(PROCESSING_STEPS.length - 1, current + 1)), 650);
    return () => window.clearInterval(timer);
  }, [loading]);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setError(null);
    setAnalysis(null);
    if (!selected) return setFile(null);
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
      event.target.value = "";
      setFile(null);
      return setError("Only PDF resumes are supported.");
    }
    if (selected.size > 5 * 1024 * 1024) {
      event.target.value = "";
      setFile(null);
      return setError("The PDF must be 5 MB or smaller.");
    }
    setFile(selected);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return setError("Select a PDF resume before starting the analysis.");
    setLoading(true); setStep(0); setError(null); setAnalysis(null);
    try {
      const form = new FormData();
      form.append("resume", file);
      const response = await fetch(`${API_BASE_URL}/api/resume/analyze`, { method: "POST", body: form, headers: { "X-Request-ID": crypto.randomUUID() } });
      const payload: unknown = await response.json();
      const envelope = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof envelope.message === "string" ? envelope.message : "We couldn’t analyze this resume. Please try again.");
      if (!isResumeAnalysis(envelope.analysis)) throw new Error("The resume analysis response was incomplete. Please try again.");
      setAnalysis(envelope.analysis);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t analyze this resume. Please try again.");
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFile(null); setAnalysis(null); setError(null); setLoading(false); setStep(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <main className="min-h-screen bg-[#070311] text-slate-100 selection:bg-purple-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden"><div className="absolute left-1/2 top-[-15rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-purple-600/15 blur-[120px]" /><div className="absolute bottom-[-10rem] right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-[120px]" /></div>
      <header className="relative border-b border-white/[0.06] bg-black/10 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white"><ArrowLeft size={17} /> Back to Home</Link>
          <div className="flex items-center gap-2 font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"><Brain size={19} /></span><span className="hidden sm:block">AI Placement Mentor</span></div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {!analysis && !loading && <>
          <section className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.18)]"><FileText size={30} /></div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-purple-400">AI Resume Analyzer</p>
            <h1 className="bg-gradient-to-r from-white via-purple-100 to-blue-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">Optimize Your Resume for Better Opportunities</h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">Upload your resume for a deterministic ATS score, evidence-based section feedback, and specific improvements—no account required.</p>
          </section>
          <form onSubmit={submit} className="mx-auto mt-12 max-w-2xl rounded-3xl border border-purple-500/20 bg-white/[0.035] p-5 shadow-2xl backdrop-blur-xl sm:p-8">
            <input ref={inputRef} id="resume-file" type="file" accept="application/pdf,.pdf" onChange={selectFile} className="sr-only" />
            <label htmlFor="resume-file" className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-purple-400/30 bg-purple-950/10 px-6 text-center transition-all hover:border-purple-400/60 hover:bg-purple-950/20">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-950/50 transition-transform group-hover:-translate-y-1"><Upload size={25} /></span>
              <span className="text-lg font-bold text-white">{file ? file.name : "Upload Resume PDF"}</span>
              <span className="mt-2 text-sm text-slate-400">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "Choose a text-based PDF up to 5 MB"}</span>
            </label>
            {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200"><X className="mt-0.5 shrink-0" size={17} />{error}</div>}
            <button type="submit" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-4 font-bold transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" disabled={!file}><Sparkles size={18} /> Analyze My Resume</button>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} /> Processed in memory and not saved to an account or database.</p>
          </form>
        </>}

        {loading && <section className="mx-auto max-w-xl py-12 text-center" aria-live="polite">
          <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center"><div className="absolute inset-0 animate-spin rounded-full border-4 border-purple-950 border-r-blue-400 border-t-purple-400" /><Sparkles className="animate-pulse text-purple-300" size={28} /></div>
          <h1 className="text-3xl font-black">Analyzing Your Resume...</h1><p className="mt-3 text-slate-400">Building an evidence-based ATS diagnostic.</p>
          <div className="mt-10 space-y-3 rounded-2xl border border-purple-500/20 bg-white/[0.03] p-6 text-left">
            {PROCESSING_STEPS.map((label, index) => <div key={label} className={`flex items-center gap-3 text-sm transition-opacity ${index <= step ? "text-slate-200" : "text-slate-600"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${index < step ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : index === step ? "animate-pulse border-purple-400/50 text-purple-300" : "border-white/10"}`}>{index < step ? <Check size={13} /> : index + 1}</span>{label}</div>)}
          </div>
        </section>}

        {analysis && !loading && <div className="space-y-10">
          <section className="text-center"><p className="text-xs font-bold uppercase tracking-[0.25em] text-purple-400">AI Resume Analysis</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Your Resume Diagnostic</h1></section>
          <section className="grid gap-8 rounded-3xl border border-white/[0.07] bg-white/[0.035] p-6 shadow-2xl sm:p-9 lg:grid-cols-[17rem_1fr] lg:items-center">
            <div className="relative mx-auto h-52 w-52"><svg className="h-full w-full -rotate-90" viewBox="0 0 120 120"><circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8" /><circle cx="60" cy="60" r={radius} fill="none" stroke="url(#atsGradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - (analysis.atsScore / 100) * circumference} /><defs><linearGradient id="atsGradient"><stop stopColor="#a855f7" /><stop offset="1" stopColor="#3b82f6" /></linearGradient></defs></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-5xl font-black">{analysis.atsScore}</span><span className="text-sm text-slate-500">out of 100</span></div></div>
            <div><p className="text-xs font-bold uppercase tracking-widest text-purple-400">ATS Score</p><h2 className="mt-2 text-3xl font-black">{analysis.scoreLabel}</h2><p className="mt-4 max-w-2xl leading-relaxed text-slate-300">{analysis.summary}</p></div>
          </section>
          <section><h2 className="text-2xl font-black">Score Breakdown</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{analysis.scoreBreakdown.map((item) => <div key={item.category} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-300">{item.category}</p><span className="font-black text-purple-300">{item.score}/20</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${item.score * 5}%` }} /></div></div>)}</div></section>
          <div className="grid gap-7 lg:grid-cols-2"><FeedbackCard title="Resume Strengths" tone="emerald" items={analysis.strengths} /><FeedbackCard title="Areas to Improve" tone="rose" items={analysis.weaknesses} /></div>
          <section><h2 className="text-2xl font-black">Section-by-Section Analysis</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{analysis.sectionFeedback.map((item) => <article key={item.section} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{item.section}</h3><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${item.status === "Strong" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : item.status === "Missing" ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-blue-500/25 bg-blue-500/10 text-blue-300"}`}>{item.status}</span></div><p className="mt-3 text-sm leading-relaxed text-slate-400">{item.feedback}</p></article>)}</div></section>
          <section className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/25 to-blue-950/10 p-6 sm:p-8"><h2 className="text-2xl font-black">Recommended Next Improvements</h2><ol className="mt-6 space-y-4">{analysis.recommendations.map((item, index) => <li key={item} className="flex gap-4 text-sm leading-relaxed text-slate-300"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 font-bold text-purple-300">{index + 1}</span><span className="pt-1">{item}</span></li>)}</ol></section>
          <div className="flex justify-center"><button onClick={reset} className="flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-6 py-3 font-bold text-purple-200 transition-colors hover:bg-purple-500/20"><RotateCcw size={17} /> Analyze Another Resume</button></div>
        </div>}
      </div>
    </main>
  );
}

function FeedbackCard({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "rose" }) {
  const positive = tone === "emerald";
  return <section className={`rounded-3xl border p-6 sm:p-7 ${positive ? "border-emerald-500/15 bg-emerald-950/10" : "border-rose-500/15 bg-rose-950/10"}`}><h2 className="text-xl font-black">{title}</h2><ul className="mt-5 space-y-4">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-300"><span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${positive ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{positive ? <Check size={12} /> : "!"}</span>{item}</li>)}</ul></section>;
}
