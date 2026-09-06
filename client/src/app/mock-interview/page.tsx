"use client";
import { API_BASE_URL } from "@/lib/api";

import Link from "next/link";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { ArrowLeft, Brain, BriefcaseBusiness, Check, ChevronRight, Code2, RotateCcw, Send, Sparkles, Upload, X } from "lucide-react";

type Mode = "hr" | "technical";
type Screen = "select" | "setup" | "interview" | "complete" | "report";
interface InterviewStart { interviewId: string; type: Mode; targetRole: string | null; questionLimit: number; questionNumber: number; question: string }
interface Feedback { questionNumber: number; question: string; answer: string; score: number; whatWentWell: string[]; improvements: string[]; betterApproach: string }
interface InterviewReport { contractVersion: "1.0"; interviewType: Mode; targetRole: string | null; overallScore: number; scoreLabel: string; dimensionScores: { dimension: string; score: number }[]; strengths: string[]; improvementAreas: string[]; questionFeedback: Feedback[]; verdict: { currentLevel: string; assessment: string }; topPriorities: string[] }

const ROLES = ["Software Development Engineer (SDE)", "ML Engineer", "Data Analyst", "Frontend Developer"];

const messageFrom = (payload: unknown, fallback: string) => payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string" ? String((payload as Record<string, unknown>).message) : fallback;

export default function MockInterviewPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [screen, setScreen] = useState<Screen>("select");
  const [mode, setMode] = useState<Mode | null>(null);
  const [questionLimit, setQuestionLimit] = useState<5 | 10>(5);
  const [targetRole, setTargetRole] = useState(ROLES[0]);
  const [resume, setResume] = useState<File | null>(null);
  const [interview, setInterview] = useState<InterviewStart | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseMode = (selected: Mode) => { setMode(selected); setScreen("setup"); setError(null); };
  const selectResume = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null; setError(null);
    if (!selected) return setResume(null);
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) { event.target.value = ""; setResume(null); return setError("Only PDF resumes are supported."); }
    if (selected.size > 5 * 1024 * 1024) { event.target.value = ""; setResume(null); return setError("The PDF must be 5 MB or smaller."); }
    setResume(selected);
  };

  const startInterview = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    if (mode === "technical" && !resume) return setError("Upload a PDF resume before starting the technical interview.");
    setPending(true); setError(null);
    try {
      const form = new FormData(); form.append("type", mode); form.append("questionLimit", String(questionLimit));
      if (mode === "technical") { form.append("targetRole", targetRole); form.append("resume", resume as File); }
      const response = await fetch(`${API_BASE_URL}/api/mock-interview/start`, { method: "POST", body: form, headers: { "X-Request-ID": crypto.randomUUID() } });
      const payload: unknown = await response.json(); const body = payload as { interview?: InterviewStart };
      if (!response.ok || !body.interview?.interviewId || !body.interview.question) throw new Error(messageFrom(payload, "The interview could not be started. Please try again."));
      setInterview(body.interview); setQuestionNumber(1); setQuestion(body.interview.question); setAnswer(""); setScreen("interview");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The interview could not be started. Please try again."); }
    finally { setPending(false); }
  };

  const submitAnswer = async (event: FormEvent) => {
    event.preventDefault();
    if (!interview || pending) return;
    if (!answer.trim()) return setError("Type an answer before submitting.");
    setPending(true); setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mock-interview/${encodeURIComponent(interview.interviewId)}/answer`, { method: "POST", headers: { "Content-Type": "application/json", "X-Request-ID": crypto.randomUUID() }, body: JSON.stringify({ answer: answer.trim() }) });
      const payload: unknown = await response.json(); const body = payload as { complete?: boolean; questionNumber?: number; question?: string; report?: InterviewReport };
      if (!response.ok) throw new Error(messageFrom(payload, "Your answer could not be processed. It is still available below so you can retry."));
      if (body.complete) {
        if (!body.report) throw new Error("The final report could not be loaded. Please retry the final answer.");
        setReport(body.report); setScreen("complete");
      } else {
        if (!body.question || !body.questionNumber) throw new Error("The next question could not be loaded. Please retry.");
        setQuestion(body.question); setQuestionNumber(body.questionNumber); setAnswer("");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your answer could not be processed. Please retry."); }
    finally { setPending(false); }
  };

  const reset = () => { setScreen("select"); setMode(null); setQuestionLimit(5); setTargetRole(ROLES[0]); setResume(null); setInterview(null); setQuestionNumber(1); setQuestion(""); setAnswer(""); setReport(null); setPending(false); setError(null); if (fileRef.current) fileRef.current.value = ""; };

  return <main className="min-h-screen bg-[#070311] text-slate-100 selection:bg-purple-500/30">
    <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-purple-600/15 blur-[130px]" /><div className="absolute bottom-[-12rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-blue-600/10 blur-[130px]" /></div>
    <header className="relative border-b border-white/[0.06] bg-black/10 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={17} /> Back to Home</Link><div className="flex items-center gap-2 font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"><Brain size={19} /></span><span className="hidden sm:block">AI Placement Mentor</span></div></div></header>
    <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      {screen === "select" && <ModeSelection onChoose={chooseMode} />}
      {screen === "setup" && mode && <Setup mode={mode} questionLimit={questionLimit} setQuestionLimit={setQuestionLimit} targetRole={targetRole} setTargetRole={setTargetRole} resume={resume} selectResume={selectResume} fileRef={fileRef} pending={pending} error={error} onSubmit={startInterview} onBack={() => { setScreen("select"); setError(null); }} />}
      {screen === "interview" && interview && <InterviewScreen mode={interview.type} targetRole={interview.targetRole} questionNumber={questionNumber} questionLimit={interview.questionLimit} question={question} answer={answer} setAnswer={setAnswer} pending={pending} error={error} onSubmit={submitAnswer} />}
      {screen === "complete" && report && <Completion mode={report.interviewType} onView={() => setScreen("report")} />}
      {screen === "report" && report && <Report report={report} onReset={reset} />}
    </div>
  </main>;
}

function ModeSelection({ onChoose }: { onChoose: (mode: Mode) => void }) {
  return <><section className="mx-auto max-w-3xl text-center"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-purple-300"><Sparkles size={29} /></div><p className="text-xs font-bold uppercase tracking-[.25em] text-purple-400">Public AI Mock Interviews</p><h1 className="mt-4 bg-gradient-to-r from-white via-purple-100 to-blue-200 bg-clip-text text-4xl font-black text-transparent sm:text-6xl">Practice Interviews with AI</h1><p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">Experience realistic text-based interviews that adapt to your answers and provide detailed feedback after completion.</p></section><section className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2"><ModeCard icon={<BriefcaseBusiness size={29} />} title="HR Interview" text="Practice behavioral, situational, communication, and personality-based interview questions." button="Start HR Interview" onClick={() => onChoose("hr")} /><ModeCard icon={<Code2 size={29} />} title="Technical Interview" text="Practice a resume-driven interview based on your projects, skills, target role, and technical fundamentals." button="Start Technical Interview" onClick={() => onChoose("technical")} /></section></>;
}

function ModeCard({ icon, title, text, button, onClick }: { icon: React.ReactNode; title: string; text: string; button: string; onClick: () => void }) { return <article className="flex flex-col rounded-3xl border border-purple-500/20 bg-white/[.035] p-7 shadow-xl backdrop-blur-xl sm:p-9"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500">{icon}</span><h2 className="mt-7 text-2xl font-black">{title}</h2><p className="mt-3 flex-1 leading-relaxed text-slate-400">{text}</p><button onClick={onClick} className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-5 py-3.5 font-bold hover:brightness-110">{button}<ChevronRight size={18} /></button></article>; }

interface SetupProps { mode: Mode; questionLimit: 5 | 10; setQuestionLimit: (value: 5 | 10) => void; targetRole: string; setTargetRole: (value: string) => void; resume: File | null; selectResume: (event: ChangeEvent<HTMLInputElement>) => void; fileRef: React.RefObject<HTMLInputElement | null>; pending: boolean; error: string | null; onSubmit: (event: FormEvent) => void; onBack: () => void }
function Setup({ mode, questionLimit, setQuestionLimit, targetRole, setTargetRole, resume, selectResume, fileRef, pending, error, onSubmit, onBack }: SetupProps) {
  const technical = mode === "technical";
  return <section className="mx-auto max-w-2xl"><button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Choose another mode</button><div className="rounded-3xl border border-purple-500/20 bg-white/[.035] p-6 shadow-2xl backdrop-blur-xl sm:p-9"><p className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">{technical ? "Technical Mock Interview" : "HR Mock Interview"}</p><h1 className="mt-3 text-3xl font-black">{technical ? "Practice a Resume-Based Technical Interview" : "Practice Real Interview Conversations"}</h1><p className="mt-3 leading-relaxed text-slate-400">{technical ? "Upload your resume for focused questions about your projects, listed skills, target role, and core fundamentals." : "Practice common HR and behavioral questions in a realistic, adaptive interview conversation."}</p><form onSubmit={onSubmit} className="mt-8 space-y-7">
    {technical && <><div><label className="text-sm font-bold text-slate-200">Resume</label><input ref={fileRef} id="technical-resume" type="file" accept="application/pdf,.pdf" onChange={selectResume} className="sr-only" /><label htmlFor="technical-resume" className="mt-3 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-purple-400/30 bg-purple-950/10 p-5 hover:border-purple-400/60"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300"><Upload size={20} /></span><span><span className="block font-bold">{resume ? resume.name : "Upload Resume PDF"}</span><span className="mt-1 block text-xs text-slate-500">{resume ? `${(resume.size / 1024 / 1024).toFixed(2)} MB selected` : "Required · PDF only · Maximum 5 MB"}</span></span></label></div><div><label htmlFor="target-role" className="text-sm font-bold text-slate-200">Target Role</label><select id="target-role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#10091d] px-4 py-3.5 text-slate-200 outline-none focus:border-purple-400/50">{ROLES.map((role) => <option key={role}>{role}</option>)}</select></div></>}
    <fieldset><legend className="text-sm font-bold text-slate-200">Interview Length</legend><div className="mt-3 grid grid-cols-2 gap-3">{([5, 10] as const).map((length) => <label key={length} className={`cursor-pointer rounded-xl border p-4 text-center font-bold transition-colors ${questionLimit === length ? "border-purple-400/50 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/[.02] text-slate-400"}`}><input type="radio" name="length" value={length} checked={questionLimit === length} onChange={() => setQuestionLimit(length)} className="sr-only" />{length} Questions</label>)}</div></fieldset>
    {error && <ErrorMessage message={error} />}
    <button type="submit" disabled={pending || (technical && !resume)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-4 font-bold disabled:cursor-not-allowed disabled:opacity-50">{pending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{technical ? "Processing Resume..." : "Preparing Interview..."}</> : <><Sparkles size={18} /> Start Interview</>}</button>
  </form></div></section>;
}

function InterviewScreen({ mode, targetRole, questionNumber, questionLimit, question, answer, setAnswer, pending, error, onSubmit }: { mode: Mode; targetRole: string | null; questionNumber: number; questionLimit: number; question: string; answer: string; setAnswer: (value: string) => void; pending: boolean; error: string | null; onSubmit: (event: FormEvent) => void }) {
  return <section className="mx-auto max-w-3xl"><header className="mb-7 flex flex-col gap-3 border-b border-white/[.07] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">{mode === "hr" ? "HR Mock Interview" : "Technical Mock Interview"}</p><h1 className="mt-2 text-2xl font-black">{mode === "technical" ? targetRole : "Behavioral Interview"}</h1></div><p className="text-sm font-bold text-slate-400">Question {questionNumber} of {questionLimit}</p></header><div className="rounded-3xl border border-purple-500/20 bg-white/[.035] p-6 shadow-2xl sm:p-9"><div className="flex items-center gap-3 text-sm font-bold text-purple-300"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/15"><Brain size={18} /></span>Interviewer</div><blockquote className="mt-6 text-xl font-semibold leading-relaxed text-slate-100 sm:text-2xl">“{question}”</blockquote><form onSubmit={onSubmit} className="mt-8"><label htmlFor="candidate-answer" className="text-sm font-bold text-slate-200">Your Answer</label><textarea id="candidate-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={pending} rows={8} maxLength={4000} placeholder="Type your answer here..." className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-4 leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-purple-400/50 disabled:opacity-70" /><div className="mt-2 text-right text-xs text-slate-600">{answer.length}/4000</div>{error && <div className="mt-4"><ErrorMessage message={error} /></div>}<button type="submit" disabled={pending || !answer.trim()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-4 font-bold disabled:cursor-not-allowed disabled:opacity-50">{pending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Generating Next Question...</> : <><Send size={17} />Submit Answer</>}</button></form></div><p className="mt-5 text-center text-xs text-slate-600">Feedback remains hidden until the interview is complete.</p></section>;
}

function Completion({ mode, onView }: { mode: Mode; onView: () => void }) { return <section className="mx-auto max-w-xl py-16 text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"><Check size={36} /></span><p className="mt-7 text-xs font-bold uppercase tracking-[.22em] text-purple-400">{mode === "hr" ? "HR Interview" : "Technical Interview"}</p><h1 className="mt-3 text-4xl font-black">Interview Complete</h1><p className="mt-4 text-slate-400">Your answers have been evaluated. Your detailed performance report is ready.</p><button onClick={onView} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-7 py-4 font-bold">View My Performance <ChevronRight size={18} /></button></section>; }

function Report({ report, onReset }: { report: InterviewReport; onReset: () => void }) {
  const technical = report.interviewType === "technical";
  return <div className="space-y-9"><section className="text-center"><p className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">{technical ? "Technical Interview Performance" : "HR Interview Performance"}</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Your Performance Report</h1></section><section className="grid gap-7 rounded-3xl border border-white/[.07] bg-white/[.035] p-6 sm:p-9 lg:grid-cols-[14rem_1fr] lg:items-center"><div className="text-center"><p className="text-6xl font-black">{report.overallScore}</p><p className="mt-1 text-sm text-slate-500">out of 100</p><span className="mt-4 inline-block rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5 text-sm font-bold text-purple-200">{report.scoreLabel}</span></div><div><p className="text-xs font-bold uppercase tracking-widest text-purple-400">Interview Verdict</p><h2 className="mt-2 text-2xl font-black">Current Level: {report.verdict.currentLevel}</h2><p className="mt-4 leading-relaxed text-slate-300">{report.verdict.assessment}</p></div></section>
    <section><h2 className="text-2xl font-black">Performance Dimensions</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{report.dimensionScores.map((item) => <div key={item.dimension} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-5"><div className="flex justify-between gap-3"><span className="text-sm font-semibold text-slate-300">{item.dimension}</span><span className="font-black text-purple-300">{item.score}%</span></div><div className="mt-4 h-1.5 rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${item.score}%` }} /></div></div>)}</div></section>
    <div className="grid gap-6 lg:grid-cols-2"><ListCard title={technical ? "Strong Areas" : "What You Did Well"} items={report.strengths} positive /><ListCard title="Areas to Improve" items={report.improvementAreas} /></div>
    <section className="rounded-3xl border border-purple-500/20 bg-purple-950/10 p-6 sm:p-8"><h2 className="text-2xl font-black">Top 3 Things to Improve</h2><ol className="mt-6 space-y-4">{report.topPriorities.map((item, index) => <li key={item} className="flex gap-4 text-sm leading-relaxed text-slate-300"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/15 font-bold text-purple-300">{index + 1}</span><span className="pt-1">{item}</span></li>)}</ol></section>
    <section><h2 className="text-2xl font-black">Question-by-Question Analysis</h2><div className="mt-5 space-y-5">{report.questionFeedback.map((item) => <article key={item.questionNumber} className="rounded-3xl border border-white/[.07] bg-white/[.025] p-6 sm:p-7"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-widest text-purple-400">Question {item.questionNumber}</p><span className="rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-sm font-black text-blue-300">{item.score}/10</span></div><h3 className="mt-3 text-lg font-bold">{item.question}</h3><div className="mt-5 rounded-xl border border-white/[.06] bg-black/15 p-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Your Answer</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{item.answer}</p></div><div className="mt-5 grid gap-5 md:grid-cols-2"><MiniList title={technical ? "What You Got Right" : "What Went Well"} items={item.whatWentWell} positive /><MiniList title={technical ? "What Was Missing" : "What Could Improve"} items={item.improvements} /></div><div className="mt-5 border-t border-white/[.06] pt-5"><p className="text-xs font-bold uppercase tracking-widest text-purple-400">Better Answer Approach</p><p className="mt-2 text-sm leading-relaxed text-slate-300">{item.betterApproach}</p></div></article>)}</div></section>
    <div className="flex justify-center"><button onClick={onReset} className="flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-6 py-3.5 font-bold text-purple-200 hover:bg-purple-500/20"><RotateCcw size={17} />Start Another Interview</button></div>
  </div>;
}

function ErrorMessage({ message }: { message: string }) { return <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200"><X className="mt-0.5 shrink-0" size={17} />{message}</div>; }
function ListCard({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) { return <section className={`rounded-3xl border p-6 ${positive ? "border-emerald-500/15 bg-emerald-950/10" : "border-rose-500/15 bg-rose-950/10"}`}><h2 className="text-xl font-black">{title}</h2><ul className="mt-5 space-y-3">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-300"><span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${positive ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{positive ? <Check size={12} /> : "!"}</span>{item}</li>)}</ul></section>; }
function MiniList({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) { return <div><p className={`text-xs font-bold uppercase tracking-widest ${positive ? "text-emerald-400" : "text-amber-400"}`}>{title}</p><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-400"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{item}</li>)}</ul></div>; }
