import { SetupFormData } from "@/app/setup/page";

export interface TimeInformationProps {
  formData: SetupFormData;
  updateField: (field: keyof SetupFormData, value: string) => void; 
  onBack?: () => void;
  onContinue?: () => void;
  setUiError: (error: string) => void;
}

export default function TimeInformation({
  formData,
  updateField,
  onBack,
  onContinue,
  setUiError,
}: TimeInformationProps) {
  
  // Timeline Dropdown Options (Up to 12 Months maximum)
  const timelineOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1} ${i + 1 === 1 ? "Month" : "Months"}`,
  }));

  // Selectable Study Hours Cards Configuration
  const studyHoursOptions = [
    { value: "1", label: "1 Hour" },
    { value: "2", label: "2 Hours" },
    { value: "3", label: "3 Hours" },
    { value: "4", label: "4 Hours" },
    { value: "5", label: "5 Hours" },
    { value: "6", label: "6+ Hours" },
  ];

  const handleValidation = () => {
    if (!formData.preparationTimelineMonths) {
      setUiError("Please select your preparation timeline duration.");
      return;
    }
    if (!formData.dailyStudyHours) {
      setUiError("Please select your daily targeted study hours commitment.");
      return;
    }
    if (onContinue) onContinue();
  };

  return (
    <div className="space-y-10 w-full animate-fadeIn">
      
      {/* FIELD 1: Preparation Timeline (Dropdown) */}
      <div className="space-y-4">
        <label className="text-sm font-semibold text-purple-200/70 tracking-wide block">
          How soon do you want to become placement-ready? <span className="text-purple-500">*</span>
        </label>
        <div className="relative max-w-md">
          <select
            value={formData.preparationTimelineMonths}
            onChange={(e) => updateField("preparationTimelineMonths", e.target.value)}
            className="w-full h-14 px-4 bg-[#150b30]/40 border border-purple-950 text-purple-100 rounded-xl outline-none transition-all duration-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 appearance-none cursor-pointer text-sm"
          >
            <option value="" disabled className="bg-[#090514]">
              Select timeline duration...
            </option>
            {timelineOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#090514] text-purple-100">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400/60">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* FIELD 2: Daily Study Hours (Unified Purple Neon Cards) */}
      <div className="space-y-4">
        <label className="text-sm font-semibold text-purple-200/70 tracking-wide block">
          Select the average time you can dedicate each day <span className="text-purple-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 w-full block clear-both">
          {studyHoursOptions.map((option) => {
            const isSelected = formData.dailyStudyHours === option.value;
            return (
              <label
                key={option.value}
                className={`flex items-center justify-center p-4 rounded-xl border text-xs font-semibold text-center h-16 cursor-pointer select-none transition-all duration-300 transform outline-none focus-within:ring-2 focus-within:ring-purple-500/40 ${
                  isSelected
                    ? "bg-purple-600/15 border-purple-500 scale-[1.02] shadow-[0_0_22px_rgba(147,51,234,0.22)] font-bold opacity-100"
                    : "bg-[#150b30]/40 border-purple-950 hover:border-purple-800/60 hover:bg-[#190d3a]/60 hover:scale-[1.01]"
                }`}
              >
                <input
                  type="radio"
                  name="dailyStudyHours"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => updateField("dailyStudyHours", option.value)}
                  className="sr-only"
                  required
                />
                <span className={isSelected ? "text-slate-100 font-bold" : "text-purple-300/40"}>
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Controller Actions Container */}
      <div className="flex justify-between items-center pt-6 w-full gap-4">
        <button
          type="button"
          onClick={onBack}
          className="px-8 py-3.5 bg-purple-950/30 border border-purple-900/50 hover:bg-purple-900/40 text-purple-300/80 hover:text-white font-medium rounded-xl transition-all duration-150 cursor-pointer text-sm"
        >
          Previous
        </button>
        
        <button
          type="button"
          onClick={handleValidation}
          className="px-10 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-purple-500/10 active:scale-[0.99] text-center cursor-pointer min-w-[180px] text-sm"
        >
          Continue
        </button>
      </div>

    </div>
  );
}