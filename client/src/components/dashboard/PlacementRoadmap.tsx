import { PlacementRoadmap as PlacementRoadmapData } from "@/lib/roadmapContract";

export function PlacementRoadmap({ roadmap }: { roadmap: PlacementRoadmapData }) {
  return (
    <section className="space-y-8" aria-labelledby="placement-roadmap-heading">
      <div className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-400">Your Personalized Roadmap</p>
        <h2 id="placement-roadmap-heading" className="text-2xl font-black tracking-tight text-slate-100 sm:text-3xl">
          Your {roadmap.durationMonths}-Month Placement Journey
        </h2>
        <p className="text-sm leading-relaxed text-slate-400">
          A strategic progression toward {roadmap.targetRole}, balanced around your current preparation and available time.
        </p>
      </div>

      <div className="relative mx-auto max-w-5xl">
        <div className="absolute bottom-8 left-[1.15rem] top-8 w-px bg-gradient-to-b from-purple-500/70 via-indigo-500/40 to-blue-500/20 sm:left-[2.15rem]" aria-hidden="true" />
        <div className="space-y-7">
          {roadmap.roadmap.map((item) => (
            <article key={item.month} className="relative grid grid-cols-[2.4rem_1fr] gap-4 sm:grid-cols-[4.4rem_1fr] sm:gap-6">
              <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-purple-400/40 bg-[#120923] text-sm font-black text-purple-200 shadow-[0_0_22px_rgba(168,85,247,0.28)] sm:h-11 sm:w-11">
                {item.month}
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-purple-950/20 via-white/[0.025] to-blue-950/10 shadow-xl">
                <div className="border-b border-white/[0.06] px-5 py-5 sm:px-7">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">Month {item.month}</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-100">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300"><span className="font-semibold text-slate-100">Focus:</span> {item.focus}</p>
                </div>
                <div className="grid gap-6 px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-blue-300">Topics</h4>
                    <ul className="mt-3 space-y-2">
                      {item.topics.map((topic) => <li key={topic} className="flex gap-2.5 text-sm leading-relaxed text-slate-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />{topic}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-300">Goals</h4>
                    <ul className="mt-3 space-y-2">
                      {item.goals.map((goal) => <li key={goal} className="flex gap-2.5 text-sm leading-relaxed text-slate-300"><span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 text-[9px] text-emerald-300">✓</span>{goal}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
