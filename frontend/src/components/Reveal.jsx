// src/components/Reveal.jsx
import { useEffect, useRef, useState } from 'react';

// Fades in and slides up when it enters the screen, so long pages load in gradually as you scroll.
function Reveal({ children, delay = 0, className = '' }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

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
