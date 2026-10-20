import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/ToastContainer';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ToastProvider>
        <App />
        <ToastContainer />
    </ToastProvider>
);