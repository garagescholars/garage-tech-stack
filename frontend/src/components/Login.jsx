import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export default function Login() {
  
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-teal-500/10 p-4 rounded-full">
            <ShieldCheck className="text-teal-500 w-12 h-12" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Garage Scholars Internal</h1>
        <p className="text-slate-400 mb-8">Restricted Access. Authorized Personnel Only.</p>

        <button 
          onClick={handleLogin}
          className="w-full bg-white hover:bg-slate-200 text-slate-900 font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}