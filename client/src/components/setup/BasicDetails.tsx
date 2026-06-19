import { SetupFormData } from "@/app/setup/page";

export interface BasicDetailsProps {
  formData: SetupFormData;
  updateField: (field: keyof SetupFormData, value: string) => void;
  onNext?: () => void; 
  setUiError: (error: string) => void;
}

export default function BasicDetails({ formData, updateField, onNext, setUiError }: BasicDetailsProps) {
  const branches = [
    "Computer Science & Engineering",
    "Information Technology",
    "Artificial Intelligence & Machine Learning",
    "Data Science / Data Analytics",
    "Software Engineering",
    "Electronics & Communication Engineering",
    "Electrical & Electronics Engineering",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Aerospace Engineering",
    "Biotechnology Engineering",
    "Industrial / Production Engineering",
    "Other Sciences / Applications"
  ];

  const years = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Integrated/Dual-Degree Final Year"];

  // Run validation on fields using the premium inline UI box
  const handleValidation = () => {
    if (!formData.branch || !formData.year || !formData.cgpa) {
      setUiError("Please fill out all required fields marked with * before continuing.");
      return;
    }
    if (onNext) onNext();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Academic Branch Selection */}
      <div className="flex flex-col gap-2">
        <label htmlFor="branch" className="text-sm font-semibold text-purple-200/70 tracking-wide">
          Academic Branch / Specialization <span className="text-purple-500">*</span>
        </label>
        <select
          id="branch"
          required
          value={formData.branch}
          onChange={(e) => updateField("branch", e.target.value)}
          className="w-full bg-[#150b30]/60 hover:bg-[#190d3a]/80 border border-purple-900/30 focus:border-purple-500 rounded-xl px-4 py-3.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 cursor-pointer shadow-inner"
        >
          <option value="" disabled className="text-purple-300/40">Select your exact branch</option>
          {branches.map((branch) => (
            <option key={branch} value={branch} className="bg-[#0d061f] text-slate-200">
              {branch}
            </option>
          ))}
        </select>
      </div>

      {/* Year of Study Selection */}
      <div className="flex flex-col gap-2">
        <label htmlFor="year" className="text-sm font-semibold text-purple-200/70 tracking-wide">
          Current Year of Study <span className="text-purple-500">*</span>
        </label>
        <select
          id="year"
          required
          value={formData.year}
          onChange={(e) => updateField("year", e.target.value)}
          className="w-full bg-[#150b30]/60 hover:bg-[#190d3a]/80 border border-purple-900/30 focus:border-purple-500 rounded-xl px-4 py-3.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 cursor-pointer shadow-inner"
        >
          <option value="" disabled className="text-purple-300/40">Select your current year</option>
          {years.map((year) => (
            <option key={year} value={year} className="bg-[#0d061f] text-slate-200">
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* CGPA Scalar Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="cgpa" className="text-sm font-semibold text-purple-200/70 tracking-wide">
          Current Cumulative CGPA <span className="text-purple-500">*</span>
        </label>
        <input
          id="cgpa"
          type="number"
          required
          min="0"
          max="10"
          step="0.01"
          placeholder="e.g. 8.75"
          value={formData.cgpa}
          onChange={(e) => updateField("cgpa", e.target.value)}
          className="w-full bg-[#150b30]/60 hover:bg-[#190d3a]/80 border border-purple-900/30 focus:border-purple-500 rounded-xl px-4 py-3.5 text-slate-100 placeholder-purple-400/20 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 shadow-inner"
        />
      </div>

      {/* RESTORED NEXT STEP BUTTON - RIGHT ALIGNED EXACTLY LIKE IMAGE SCREENSHOTS */}
      <div className="flex justify-end w-full pt-4">
        <button
          type="button"
          onClick={handleValidation}
          className="px-10 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-purple-500/10 active:scale-[0.99] text-center cursor-pointer min-w-[180px]"
        >
          Next Step
        </button>
      </div>

    </div>
  );
}