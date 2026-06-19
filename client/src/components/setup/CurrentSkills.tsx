import { SetupFormData } from "@/app/setup/page";

export interface CurrentSkillsProps {
  formData: SetupFormData;
  updateField: (field: keyof SetupFormData, value: string) => void;
  onBack?: () => void;
  onFinalSubmit?: () => void;
  setUiError: (error: string) => void;
}

interface SkillConfig {
  key: keyof SetupFormData;
  label: string;
  options: string[];
  ringColorClass: string;
  selectedClass: string;
}

export default function CurrentSkills({ formData, updateField, onBack, onFinalSubmit, setUiError }: CurrentSkillsProps) {
  
  const skillsConfig: SkillConfig[] = [
    {
      key: "dsa",
      label: "Data Structures & Algorithms",
      options: ["Beginner", "Intermediate", "Advanced"],
      ringColorClass: "focus-within:ring-purple-500/40",
      selectedClass: "bg-purple-600/15 border-purple-500 shadow-[0_0_22px_rgba(147,51,234,0.22)]"
    },
    {
      key: "dbms",
      label: "Database Management Systems",
      options: ["Beginner", "Intermediate", "Advanced"],
      ringColorClass: "focus-within:ring-purple-500/40", // 🚀 FIXED TO PURPLE
      selectedClass: "bg-purple-600/15 border-purple-500 shadow-[0_0_22px_rgba(147,51,234,0.22)]" // 🚀 FIXED TO PURPLE
    },
    {
      key: "os",
      label: "Operating Systems",
      options: ["Beginner", "Intermediate", "Advanced"],
      ringColorClass: "focus-within:ring-purple-500/40",
      selectedClass: "bg-purple-600/15 border-purple-500 shadow-[0_0_22px_rgba(147,51,234,0.22)]"
    },
    {
      key: "networks",
      label: "Computer Networks",
      options: ["Beginner", "Intermediate", "Advanced"],
      ringColorClass: "focus-within:ring-purple-500/40", // 🚀 FIXED TO PURPLE
      selectedClass: "bg-purple-600/15 border-purple-500 shadow-[0_0_22px_rgba(147,51,234,0.22)]" // 🚀 FIXED TO PURPLE
    },
    {
      key: "aptitude",
      label: "Quantitative & Logical Aptitude",
      options: ["Beginner", "Intermediate", "Advanced"],
      ringColorClass: "focus-within:ring-purple-500/40",
      selectedClass: "bg-purple-600/15 border-purple-500 shadow-[0_0_22px_rgba(147,51,234,0.22)]"
    },
    {
      key: "communication",
      label: "Communication Skills",
      options: ["Weak", "Average", "Strong"],
      ringColorClass: "focus-within:ring-purple-500/40", // 🚀 FIXED TO PURPLE
      selectedClass: "bg-purple-600/15 border-purple-500 shadow-[0_0_22px_rgba(147,51,234,0.22)]" // 🚀 FIXED TO PURPLE
    }
  ];
  
  const handleValidation = () => {
    const isStepComplete = skillsConfig.every(
      (skill) => formData[skill.key] && formData[skill.key].trim() !== ""
    );

    if (!isStepComplete) {
      setUiError("Please grade all your active professional skills proficiency levels before finishing setup.");
      return;
    }
    if (onFinalSubmit) onFinalSubmit();
  };

  return (
    <div className="space-y-10 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {skillsConfig.map((skill) => (
          <div key={skill.key} className="bg-[#150b30]/20 border border-purple-950/40 p-5 rounded-xl space-y-4">
            <label className="text-sm font-semibold text-purple-200/70 tracking-wide block">
              {skill.label} <span className="text-purple-500">*</span>
            </label>
            
            <div className="grid grid-cols-3 gap-3">
              {skill.options.map((option) => {
                const isSelected = formData[skill.key] === option;
                return (
                  <label
                    key={option}
                    className={`flex items-center justify-center p-2 rounded-xl border text-xs font-semibold text-center h-14 cursor-pointer select-none transition-all duration-300 transform outline-none ${skill.ringColorClass} ${
                      isSelected
                        ? `${skill.selectedClass} scale-[1.02] font-bold`
                        : "bg-[#150b30]/40 border-purple-950 text-purple-300/40 hover:border-purple-800/60 hover:bg-[#190d3a]/60 hover:text-purple-200/80 hover:scale-[1.01]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={skill.key}
                      value={option}
                      checked={isSelected}
                      onChange={() => updateField(skill.key, option)}
                      className="sr-only"
                      required
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

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