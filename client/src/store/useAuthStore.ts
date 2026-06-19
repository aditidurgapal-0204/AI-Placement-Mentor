import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // 1. Import the persistence engine

type AuthView = 'IDLE' | 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD';

interface UserProfile {
  id: string;
  firstName: string;
  email: string;
  isOnboardingComplete: boolean; // 🚀 Add this line
}

interface AuthUIState {
  currentView: AuthView;
  user: UserProfile | null; 
  setView: (view: AuthView) => void;
  closeModal: () => void;
  setSession: (user: UserProfile | null) => void;
  logout: () => void;
}

// 2. Wrap the entire state manager with persist() configuration parameters
export const useAuthStore = create<AuthUIState>()(
  persist(
    (set) => ({
      currentView: 'IDLE',
      user: null, 
      setView: (view) => set({ currentView: view }),
      closeModal: () => set({ currentView: 'IDLE' }),
      setSession: (user) => set({ user }),
      logout: () => set({ user: null, currentView: 'IDLE' }),
    }),
    {
      name: 'placement-auth-session', // This will be the key inside browser localStorage
    }
  )
);