import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load the main chat interface for faster initial load
const ChatInterface = lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface })));

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-parchment">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-compass border-t-transparent rounded-full animate-spin"></div>
            <p className="text-ink font-semibold">Loading ComponentCompass...</p>
          </div>
        </div>
      }>
        <ChatInterface />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
