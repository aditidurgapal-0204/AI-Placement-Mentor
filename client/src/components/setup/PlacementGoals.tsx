import { SetupFormData } from "@/app/setup/page";

export interface PlacementGoalProps {
  formData: SetupFormData;
  updateField: (field: keyof SetupFormData, value: string) => void;
  onBack?: () => void;
  onFinalSubmit?: () => void;
  setUiError: (error: string) => void;
}

export default function PlacementGoal({ formData, updateField, onBack, onFinalSubmit, setUiError }: PlacementGoalProps) {
  const companyTypes = ["MAANG", "Product Based", "Startup", "Service Based"];

  const targetRoles = [
    "Software Development Engineer (SDE)",
    "Frontend Developer",
    "Backend Developer",
    "Full-Stack Engineer",
    "Machine Learning Engineer",
    "Data Scientist",
    "Data Analyst",
    "Cloud / DevOps Engineer",
    "Cybersecurity Analyst",
    "Product Manager (Associate)",
    "Mobile App Developer (iOS/Android)",
    "Embedded Systems / IoT Engineer"
  ];

  const handleValidation = () => {
    if (!formData.companyType || !formData.targetRole) {
      setUiError("Please select a target company ecosystem and a target professional profile before finishing setup.");
      return;
    }
    if (onFinalSubmit) onFinalSubmit();
  };

  return (
    <div className="space-y-10 w-full">
      
      {/* Target Company Ecosystem Matrix */}
      <div>
        <label className="text-sm font-semibold text-purple-200/70 tracking-wide block mb-4">
          Target Company Ecosystems <span className="text-purple-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {companyTypes.map((type) => {
            const isSelected = formData.companyType === type;
            return (
              <label
                key={type}
                className={`flex items-center justify-center p-4 rounded-xl border text-sm font-semibold text-center h-16 cursor-pointer select-none transition-all duration-300 transform outline-none focus-within:ring-2 focus-within:ring-purple-500/40 ${
                  isSelected
                    ? "bg-purple-600/15 border-purple-500 text-purple-300 scale-[1.02] shadow-[0_0_22px_rgba(147,51,234,0.22)] font-bold"
                    : "bg-[#150b30]/40 border-purple-950 text-purple-300/40 hover:border-purple-800/60 hover:bg-[#190d3a]/60 hover:text-purple-200/80 hover:scale-[1.01]"
                }`}
              >
                <input
                  type="radio"
                  name="companyType"
                  value={type}
                  checked={isSelected}
                  onChange={() => updateField("companyType", type)}
                  className="sr-only"
                  required
                />
                {type}
              </label>
            );
          })}
        </div>
      </div>

     {/* Target Professional Profiles Matrix */}
<div>
  <label className="text-sm font-semibold text-purple-200/70 tracking-wide block mb-4">
    Target Professional Profiles <span className="text-purple-500">*</span>
  </label>
  
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full block clear-both">
    {targetRoles.map((role) => {
      const isSelected = formData.targetRole === role;
      return (
        <label
          key={role}
          className={`flex items-center justify-center p-4 rounded-xl border text-xs font-semibold text-center h-16 cursor-pointer select-none transition-all duration-300 transform outline-none focus-within:ring-2 focus-within:ring-purple-500/40 ${
            isSelected
              ? "bg-purple-600/15 border-purple-500 scale-[1.02] shadow-[0_0_22px_rgba(147,51,234,0.22)] font-bold opacity-100" // 🚀 SWAPPED TO PURPLE NEON
              : "bg-[#150b30]/40 border-purple-950 text-purple-300/40 hover:border-purple-800/60 hover:bg-[#190d3a]/60 hover:text-purple-200/80 hover:scale-[1.01]"
          }`}
        >
          <input
            type="radio"
            name="targetRole"
            value={role}
            checked={isSelected}
            onChange={() => updateField("targetRole", role)}
            className="sr-only"
            required
          />
          <span className={isSelected ? "text-slate-100 font-bold" : "text-purple-300/40"}>
            {role}
          </span>
        </label>
      );
    })}
  </div>
</div>

      {/* Action Controls Container */}
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