'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import BasicDetails from '@/components/setup/BasicDetails';
import PlacementGoals from '@/components/setup/PlacementGoals'; 
import CurrentSkills from '@/components/setup/CurrentSkills'; 
import TimeInformation from "@/components/setup/TimeInformation";
import ResumeProfile from "@/components/setup/ResumeProfile"; // 🚀 Step 5 Import

export interface SetupFormData {
  branch: string;
  year: string;
  cgpa: string;
  companyType: string;
  targetRole: string;
  dsa: string;
  dbms: string;
  os: string;
  networks: string;
  aptitude: string;
  communication: string;
  preparationTimelineMonths: string;
  dailyStudyHours: string;
  resumeUrl: string;
  resumeText: string;
}

export default function SetupPage() {
  const router = useRouter();
  const { user, setSession } = useAuthStore();
  
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const [uiError, setUiError] = useState<string>("");
  const [dbUserName, setDbUserName] = useState<string>("");
  
  const [formData, setFormData] = useState<SetupFormData>({
    branch: '',
    year: '',
    cgpa: '',
    companyType: '',
    targetRole: '',
    dsa: '',
    dbms: '',
    os: '',
    networks: '',
    aptitude: '',
    communication: '',
    preparationTimelineMonths: '',
    dailyStudyHours: '',
    // 🚀 Step 5 fields Initialized
    resumeUrl: '',
    resumeText: ''
  });

  const [isStep5Complete, setIsStep5Complete] = useState<boolean>(false);

  const updateField = async (field: keyof SetupFormData, value: string) => {
    setUiError(""); 

    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await fetch("http://localhost:8000/api/auth/save-onboarding-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          step: currentStep, 
          stepData: updatedData 
        })
      });
    } catch (err) {
      console.error("Silent background auto-save sync network failure:", err);
    }
  };

  // 🚀 CUSTOM MULTIPART DISPATCH ACTION FOR FINAL ONBOARDING COMPLETION
  const handleCompleteOnboardingStep = async (file: File | null, isSkipped: boolean) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Authentication token reference is missing. Please log in again.");

    const uploadPayload = new FormData();
    uploadPayload.append("isSkipped", String(isSkipped));
    if (file) {
      uploadPayload.append("resume", file);
    }

    const res = await fetch("http://localhost:8000/api/auth/save-resume-step", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: uploadPayload
    });

    const data = await res.json();

    if (res.ok) {
      if (user) {
        setSession({ ...user, isOnboardingComplete: true });
      }
      // 🚀 THE ONLY CHANGE: Route to your custom analysis engine layout screen instead of jumping directly to dashboard
      router.push(`/setup/analysis?skipped=${isSkipped}`);
    } else {
      throw new Error(data.message || "Failed to successfully complete secure onboarding profile data push.");
    }
  };

  const calculateProgress = (): number => {
    const fields = Object.values(formData);
    const filledFields = fields.filter(value => value && String(value).trim() !== "").length;

    // 🚀 Turn to 100% instantly if Step 5 is flagged as complete by the child component
    if (currentStep === 5 && (isStep5Complete || user?.isOnboardingComplete)) {
      return 100;
    }

    return Math.round((filledFields / fields.length) * 100);
  };

  const handlePreviousStep = () => {
    setUiError("");
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleStepSubmit = async () => {
    if (currentStep === 1 && (!formData.branch || !formData.year || !formData.cgpa)) {
      setUiError("Please populate all academic credentials before advancing.");
      return;
    }
    if (currentStep === 2 && (!formData.companyType || !formData.targetRole)) {
      setUiError("Please designate your target ecosystems and roles before saving.");
      return;
    }
    if (currentStep === 3 && (!formData.dsa || !formData.dbms || !formData.os || !formData.networks || !formData.aptitude || !formData.communication)) {
      setUiError("Please grade all your active professional skills proficiency levels before finishing setup.");
      return;
    }
    if (currentStep === 4 && (!formData.preparationTimelineMonths || !formData.dailyStudyHours)) {
      setUiError("Please complete your timeline duration and daily targeted study hours configuration.");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("http://localhost:8000/api/auth/save-onboarding-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          step: currentStep,
          stepData: formData
        })
      });

      const data = await res.json();

      if (res.ok) {
        setCurrentStep((prev) => prev + 1);
      } else {
        setUiError(data.message || "Failed to save step details.");
      }
    } catch (err) {
      console.error("Step submission error:", err);
      setUiError("Network failure connecting to authentication server.");
    }
  };
  
  useEffect(() => {
    const restoreUserSessionState = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("🔒 Access Denied: No token found in localStorage.");
        router.push('/');
        return;
      }

      try {
        const profileRes = await fetch("http://localhost:8000/api/auth/profile", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!profileRes.ok) {
          console.error(`❌ Server profile request failed with status: ${profileRes.status}`);
          setIsLoading(false);
          return;
        }

        const profileData = await profileRes.json();

        if (profileData && profileData.user) {
          if (profileData.user.name) {
            setDbUserName(profileData.user.name.split(" ")[0]);
          }
          
          if (profileData.user.isOnboardingComplete) {
            router.push('/dashboard');
            return;
          }

          const savedStep = profileData.user.currentOnboardingStep || 1;
          setCurrentStep(savedStep);

          if (profileData.user.placementProfile) {
            const profile = profileData.user.placementProfile;
            setFormData({
              branch: profile.branch || '',
              year: profile.year || '',
              cgpa: profile.cgpa && profile.cgpa !== 0 ? profile.cgpa.toString() : '',
              companyType: profile.companyType || '',
              targetRole: profile.targetRole || '',
              dsa: profile.dsa || '',
              dbms: profile.dbms || '',
              os: profile.os || '',
              networks: profile.networks || '',
              aptitude: profile.aptitude || '',
              communication: profile.communication || '',
              preparationTimelineMonths: profile.preparationTimelineMonths ? String(profile.preparationTimelineMonths) : '',
              dailyStudyHours: profile.dailyStudyHours ? String(profile.dailyStudyHours) : '',
              // 🚀 Hydrate Step 5 context safely
              resumeUrl: profile.resumeUrl || '',
              resumeText: profile.resumeText || ''
            });
          }
        }
      } catch (err) {
        console.error("CRITICAL HANDSHAKE FAILURE INSIDE SETUP PAGE:", err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreUserSessionState();
  }, [router]);
  
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#090514] flex flex-col items-center justify-center gap-3 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500"></div>
        <p className="text-purple-400/60 text-xs tracking-wider">Synchronizing secure session plan...</p>
      </div>
    );
  }

  const progressPercentage = calculateProgress();

  return (
    <div className="min-h-screen bg-[#090514] text-white font-sans px-8 md:px-16 lg:px-24 py-12 flex justify-center">
      <div className="w-full max-w-5xl flex flex-col gap-10">
        
        {/* Header Layout */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-purple-950/20 pb-8">
          <div className="flex flex-col gap-2">
            <span className="text-purple-400 font-medium text-lg animate-fade-in">
              Welcome, {dbUserName || "User"}!!
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
              Let&apos;s Build Your Placement Plan
            </h1>
            <p className="text-purple-300/40 text-sm max-w-xl">
              Fill your details so AI can generate a personalized preparation roadmap.
            </p>

            <div className="mt-4 pt-1">
              {currentStep === 1 && <h3 className="text-xs font-bold tracking-widest text-purple-400 uppercase">Step 1 — Basic Details</h3>}
              {currentStep === 2 && <h3 className="text-xs font-bold tracking-widest text-purple-400 uppercase">Step 2 — Placement Goal</h3>}
              {currentStep === 3 && <h3 className="text-xs font-bold tracking-widest text-purple-400 uppercase">Step 3 — Current Skills</h3>}
              {currentStep === 4 && <h3 className="text-xs font-bold tracking-widest text-purple-400 uppercase">Step 4 — Time Information</h3>}
              {/* 🚀 Step 5 Title Descriptor Block */}
              {currentStep === 5 && <h3 className="text-xs font-bold tracking-widest text-purple-400 uppercase">Step 5 — Resume Profile</h3>}
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-64">
            <div className="flex justify-between items-center text-[10px] font-bold tracking-wider text-purple-300/60">
              <span>PROFILE VERIFICATION</span>
              <span>{progressPercentage}% DONE</span>
            </div>
            <div className="w-full bg-purple-950/40 h-1.5 rounded-full overflow-hidden border border-purple-900/10">
              <div 
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {uiError && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3.5 rounded-xl transition-all duration-200">
            ⚠️ {uiError}
          </div>
        )}

        <div className="w-full">
          {currentStep === 1 && (
            <BasicDetails formData={formData} updateField={updateField} onNext={handleStepSubmit} setUiError={setUiError} />
          )}

          {currentStep === 2 && (
            <PlacementGoals formData={formData} updateField={updateField} onBack={handlePreviousStep} onFinalSubmit={handleStepSubmit} setUiError={setUiError} />
          )}

          {currentStep === 3 && (
            <CurrentSkills formData={formData} updateField={updateField} onBack={handlePreviousStep} onFinalSubmit={handleStepSubmit} setUiError={setUiError} />
          )}

          {currentStep === 4 && (
            <TimeInformation formData={formData} updateField={updateField} onBack={handlePreviousStep} onContinue={handleStepSubmit} setUiError={setUiError} />
          )}

          {/* 🚀 Step 5 Integration Interface Block Container */}
          {currentStep === 5 && (
           // Look for your Step 5 render block and update the props:
    <ResumeProfile
  formData={formData}
  onBack={handlePreviousStep}
  onCompleteOnboarding={handleCompleteOnboardingStep}
  setUiError={setUiError}
  onFileChange={(hasFile) => setIsStep5Complete(hasFile)}
  onSkip={() => setIsStep5Complete(true)}
/>
          )}
        </div>

      </div>
    </div>
  );
}