// src/components/Reveal.jsx
import { useEffect, useRef, useState } from 'react';

// Aparece con un fundido suave hacia arriba cuando entra en pantalla.
// En paginas largas, cada bloque se anima al hacer scroll.
function Reveal({ children, delay = 0, className = '' }) {
    const ref = useRef(null);
    // Si el navegador no soporta IntersectionObserver, se muestra de inmediato
    const [visible, setVisible] = useState(() => !('IntersectionObserver' in window));

    useEffect(() => {
        const el = ref.current;
        if (!el || visible) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.08 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [visible]);

    return (
        <div
            ref={ref}
            className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

export default Reveal;

