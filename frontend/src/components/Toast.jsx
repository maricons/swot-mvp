// src/components/Toast.jsx
import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const mostrar = useCallback((mensaje, tipo = 'ok') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, mensaje, tipo }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
    }, []);

    return (
        <ToastContext.Provider value={mostrar}>
            {children}
            <div className="toasts">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast ${t.tipo === 'error' ? 'toast-error' : ''}`}>
                        {t.mensaje}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
