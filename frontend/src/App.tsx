import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const LandingPage = lazy(() => import('./pages/Landing'))
const AppPage = lazy(() => import('./pages/App'))
const DownloadPage = lazy(() => import('./pages/Download'))
const DocsPage = lazy(() => import('./pages/Docs'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
