import React from 'react';

interface ReadinessCardProps {
  score: number;
  summary: string;
}

const ReadinessCard: React.FC<ReadinessCardProps> = ({ score, summary }) => {
  // Ensure the score stays within bounds
  const normalizedScore = Math.min(Math.max(score, 0), 100);

  // SVG Geometry Constants
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  // Determine Tier configurations based on score thresholds
  const getTierDetails = (val: number) => {
    if (val <= 39) {
      return {
        label: 'High Risk',
        textColor: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20',
        gradientId: 'grad-red',
        gradientStops: { start: '#f87171', end: '#ef4444' },
      };
    } else if (val <= 59) {
      return {
        label: 'Needs Improvement',
        textColor: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        gradientId: 'grad-amber',
        gradientStops: { start: '#fbbf24', end: '#f59e0b' },
      };
    } else if (val <= 79) {
      return {
        label: 'Moderate Readiness',
        textColor: 'text-indigo-400',
        bgColor: 'bg-indigo-500/10',
        borderColor: 'border-indigo-500/20',
        gradientId: 'grad-indigo',
        gradientStops: { start: '#818cf8', end: '#6366f1' },
      };
    } else {
      return {
        label: 'Strong Readiness',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        gradientId: 'grad-emerald',
        gradientStops: { start: '#34d399', end: '#10b981' },
      };
    }
  };

  const tier = getTierDetails(normalizedScore);

  return (
    <div className="group relative w-full max-w-md rounded-2xl border border-gray-800 bg-[#111827] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-gray-700 hover:shadow-2xl hover:shadow-[#090514]/50">
      {/* Premium subtle background glow matching the tier gradient */}
      <div 
        className="absolute -inset-px -z-10 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 blur-xl"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${tier.gradientStops.start}15, transparent 60%)`
        }}
      />

      {/* Header section */}
      <div className="flex items-center justify-between border-b border-gray-800/60 pb-4">
        <h3 className="text-sm font-medium tracking-wide text-gray-400 uppercase">
          Placement Readiness
        </h3>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide border ${tier.textColor} ${tier.bgColor} ${tier.borderColor}`}>
          {tier.label}
        </span>
      </div>

      {/* Center Circle Gauge Section */}
      <div className="my-8 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center h-36 w-36">
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
            <defs>
              <linearGradient id={tier.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={tier.gradientStops.start} />
                <stop offset="100%" stopColor={tier.gradientStops.end} />
              </linearGradient>
            </defs>
            {/* Background Base Ring Track */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              className="stroke-gray-800/50"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Animated Active Progress Arc */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke={`url(#${tier.gradientId})`}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          
          {/* Internal Value Text */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-bold tracking-tight text-white">
              {normalizedScore}%
            </span>
            <span className="text-[10px] font-medium tracking-widest text-gray-500 uppercase">
              Score
            </span>
          </div>
        </div>
      </div>

      {/* Narrative Summary Section */}
      <div className="rounded-xl bg-[#090514]/40 p-4 border border-gray-800/40">
        <p className="text-sm leading-relaxed text-gray-300">
          {summary}
        </p>
      </div>
    </div>
  );
};

export default ReadinessCard;