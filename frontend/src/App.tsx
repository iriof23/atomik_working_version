import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore, useThemeStore } from './lib/store'
import Login from './pages/Login'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import LicenseEntry from './pages/LicenseEntry'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Projects from './pages/Projects'
import Findings from './pages/Findings'
import ReportBuilder from './pages/ReportBuilder'
import ReportEditor from './pages/ReportEditor'
import Settings from './pages/Settings'
import Layout from './components/Layout'
import OrgSync from './components/OrgSync'
import { useAuth } from '@clerk/clerk-react'

function App() {
    const { isAuthenticated: isStoreAuthenticated, deploymentMode } = useAuthStore()
    const { isSignedIn, isLoaded } = useAuth()
    const initializeTheme = useThemeStore((state) => state.initializeTheme)

    // Initialize theme on mount
    useEffect(() => {
        initializeTheme()
    }, [initializeTheme])

    // Sync Clerk auth state with local store if needed, or just rely on Clerk
    const isAuthenticated = isLoaded ? isSignedIn : isStoreAuthenticated

    if (!isLoaded) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>
    }

    return (
        <BrowserRouter>
            {/* Sync Clerk organization to backend database */}
            {isAuthenticated && <OrgSync />}
            
            <Routes>
                {/* Authentication routes */}
                <Route
                    path="/sign-in/*"
                    element={<SignInPage />}
                />
                <Route
                    path="/sign-up/*"
                    element={<SignUpPage />}
                />
                <Route
                    path="/login"
                    element={<Navigate to="/sign-in" />}
                />
                <Route
                    path="/license"
                    element={
                        deploymentMode === 'desktop' ? (
                            isAuthenticated ? <Navigate to="/dashboard" /> : <LicenseEntry />
                        ) : (
                            <Navigate to="/sign-in" />
                        )
                    }
                />

                {/* Protected routes */}
                <Route
                    path="/"
                    element={
                        isAuthenticated ? (
                            <Layout />
                        ) : (
                            <Navigate to="/sign-in" />
                        )
                    }
                >
                    <Route index element={<Navigate to="/dashboard" />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="findings" element={<Findings />} />
                    <Route path="reports" element={<ReportBuilder />} />
                    <Route path="reports/:projectId" element={<ReportEditor />} />
                    <Route path="settings" element={<Settings />} />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
