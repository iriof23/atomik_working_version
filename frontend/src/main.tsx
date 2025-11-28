import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
        },
    },
})

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-md w-full shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                    </div>
                    <h1 className="text-xl font-bold text-zinc-100">Missing Configuration</h1>
                </div>
                
                <p className="text-zinc-400 mb-6">
                    The application cannot start because the authentication configuration is missing.
                </p>

                <div className="bg-zinc-950 rounded border border-zinc-800 p-4 mb-6">
                    <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider font-semibold">Action Required</p>
                    <p className="text-sm text-zinc-300">
                        Add your Clerk Publishable Key to the <code className="text-emerald-400 bg-emerald-400/10 px-1 rounded">.env</code> file in the frontend directory:
                    </p>
                    <div className="mt-3 bg-black/50 p-3 rounded border border-zinc-800/50 overflow-x-auto">
                        <code className="text-xs font-mono text-zinc-400 whitespace-nowrap">
                            VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
                        </code>
                    </div>
                </div>
                
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-2 px-4 rounded transition-colors"
                >
                    Reload Application
                </button>
            </div>
        </div>
    )
} else {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <ClerkProvider 
                publishableKey={PUBLISHABLE_KEY}
                appearance={{
                    baseTheme: dark,
                    variables: { colorPrimary: '#10b981', colorBackground: '#09090b' }
                }}
            >
                <QueryClientProvider client={queryClient}>
                    <App />
                </QueryClientProvider>
            </ClerkProvider>
        </React.StrictMode>,
    )
}
