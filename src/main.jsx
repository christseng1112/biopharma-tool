import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { installGlobalErrorHandler } from './lib/globalErrorHandler.js';
import './styles.css';

installGlobalErrorHandler();

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
);
