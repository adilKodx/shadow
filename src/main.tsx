import { createRoot } from 'react-dom/client';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <ToastContainer position="top-right" autoClose={3000} hideProgressBar newestOnTop closeOnClick theme="light" />
  </>
);
