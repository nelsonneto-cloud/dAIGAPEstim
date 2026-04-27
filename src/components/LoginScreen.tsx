import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

export const LoginScreen: React.FC = () => {
  const { instance } = useMsal();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1f2d] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center">

        {/* Logo */}
        <div className="inline-flex items-center justify-center bg-[#0d7a79] px-6 py-3 rounded-lg mb-8">
          <span className="text-white font-bold text-2xl tracking-widest">delaware</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-1">dAIGAPEstim</h1>
        <p className="text-gray-500 text-sm mb-8">
          Calculadora de Estimativas SAP S/4HANA
        </p>

        <div className="border-t border-gray-100 pt-8">
          <p className="text-xs text-gray-400 mb-6 uppercase tracking-wide font-semibold">
            Acesso corporativo
          </p>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              /* Microsoft logo mark */
              <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
            )}
            {isLoading ? 'Redirecionando...' : 'Entrar com conta Microsoft'}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Use sua conta <strong>@delawareconsulting.com</strong>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-300">
          Acesso restrito a colaboradores Delaware
        </div>
      </div>
    </div>
  );
};
