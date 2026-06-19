import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { SetupFormData } from "@/app/setup/page";

interface ResumeProfileProps {
  formData: SetupFormData;
  onBack: () => void;
  onCompleteOnboarding: (file: File | null, isSkipped: boolean) => Promise<void>;
  setUiError: (error: string) => void;
  onFileChange: (hasFile: boolean) => void; // 🚀 Informs the parent to fill the bar to 100% instantly
  onSkip: () => void;                      // 🚀 Informs the parent to fill the bar to 100% instantly
}

export default function ResumeProfile({
  formData,
  onBack,
  onCompleteOnboarding,
  setUiError,
  onFileChange,
  onSkip,
}: ResumeProfileProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop State Handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setUiError("");

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUiError("");
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (file.type !== "application/pdf") {
      setUiError("Invalid file type. Please upload a document formatted purely as a PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUiError("File size exceeds buffer limit. Please upload a resume under 5MB.");
      return;
    }
    setSelectedFile(file);
    onFileChange(true); // 🚀 Snaps the parent progress bar to 100% the exact millisecond the file drops in!
  };

  const triggerFileSelection = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (isSkipped: boolean) => {
    if (!isSkipped && !selectedFile) {
      setUiError("Please choose a valid PDF resume file or click 'Skip For Now' to continue.");
      return;
    }
    
    if (isSkipped) {
      onSkip(); // 🚀 Snaps the parent progress bar to 100% the exact millisecond 'Skip For Now' is clicked!
    }

    setIsProcessing(true);
    setUiError("");
    try {
      await onCompleteOnboarding(isSkipped ? null : selectedFile, isSkipped);
    } catch (err: any) {
      setUiError(err.message || "Failed to process Step 5 operation parameters.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-10 w-full animate-fadeIn">
      
      {/* Title Subtext Block */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-purple-100 tracking-wide">
          Do you already have a resume?
        </h2>
        <p className="text-purple-300/40 text-xs leading-relaxed max-w-2xl">
          Upload your resume to receive more personalized recommendations and roadmap suggestions. Resume upload is completely optional.
        </p>
      </div>

      {/* Modern Drag & Drop Interactive Upload Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelection}
        className={`w-full max-w-3xl border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer select-none group min-h-[220px] ${
          isDragging 
            ? "border-purple-500 bg-purple-600/10 shadow-[0_0_25px_rgba(147,51,234,0.15)]"
            : selectedFile 
              ? "border-emerald-500/60 bg-emerald-950/10"
              : "border-purple-950 bg-[#150b30]/20 hover:border-purple-800/60 hover:bg-[#190d3a]/40"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          className="sr-only"
          disabled={isProcessing}
        />

        {selectedFile ? (
          // Uploaded Success State View Layout
          <div className="flex flex-col items-center gap-3 text-center animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-100 max-w-md truncate px-4">
                {selectedFile.name}
              </p>
              <p className="text-[11px] font-medium text-emerald-400 tracking-wide uppercase">
                Ready for Extraction
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                onFileChange(false); // 🚀 Drops the progress bar back to its organic placement level if they clear the file
              }}
              className="mt-2 text-xs text-purple-400/60 hover:text-purple-300 underline transition-all"
            >
              Remove file
            </button>
          </div>
        ) : (
          // Idle Upload State Request Layout
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-950/40 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-all border border-purple-900/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-purple-200">
                Drag and drop your resume here, or <span className="text-purple-400 group-hover:text-purple-300 transition-colors">browse files</span>
              </p>
              <p className="text-[11px] text-purple-300/30">
                Supports PDF format files only (Max 5MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Professional Skip Structuring View Section */}
      <div className="max-w-3xl border-t border-purple-950/30 pt-8 flex items-center justify-between bg-purple-950/5 p-5 rounded-xl border border-purple-950/20">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-purple-200/80">Don&apos;t have a resume compiled yet?</p>
          <p className="text-[11px] text-purple-300/30">You can skip this step safely and link your document setup configurations later inside your core profile dashboard.</p>
        </div>
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => handleSubmit(true)}
          className="px-5 py-2.5 bg-purple-950/40 border border-purple-900/60 hover:bg-purple-900/40 text-purple-300 hover:text-purple-100 font-medium rounded-xl text-xs transition-all duration-150 cursor-pointer select-none active:scale-[0.98] disabled:opacity-40"
        >
          Skip For Now
        </button>
      </div>

      {/* Action Controller Container */}
      <div className="flex justify-between items-center pt-6 w-full gap-4">
        <button
          type="button"
          disabled={isProcessing}
          onClick={onBack}
          className="px-8 py-3.5 bg-purple-950/30 border border-purple-900/50 hover:bg-purple-900/40 text-purple-300/80 hover:text-white font-medium rounded-xl transition-all duration-150 cursor-pointer text-sm disabled:opacity-40"
        >
          Previous
        </button>
        
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => handleSubmit(false)}
          className="px-10 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-purple-500/10 active:scale-[0.99] text-center cursor-pointer min-w-[200px] text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
              <span>Processing...</span>
            </>
          ) : (
            <span>Generate My AI Plan</span>
          )}
        </button>
      </div>

    </div>
  );
}