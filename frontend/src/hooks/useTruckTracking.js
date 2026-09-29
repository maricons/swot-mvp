// src/hooks/useTruckTracking.js
import { useEffect, useState } from 'react';
import api from '../services/api';

const SEND_EVERY_MS = 30000;
const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

// While active (the driver has an order in transit) it watches the phone's position, keeps the last one
// for the driver's own map and reports it to the office at most every 30 seconds.
// Returns { status, position }: status is idle | sharing | denied | error | unsupported.
export function useTruckTracking(active) {
    const [tracking, setTracking] = useState({ status: 'idle', position: null });

    useEffect(() => {
        if (!active || !supported) return undefined;

        let lastSentAt = 0;
        const watchId = navigator.geolocation.watchPosition(
            ({ coords }) => {
                const position = { latitude: coords.latitude, longitude: coords.longitude };
                setTracking({ status: 'sharing', position });
                if (Date.now() - lastSentAt >= SEND_EVERY_MS) {
                    lastSentAt = Date.now();
                    // A failed report is not worth interrupting the driver; the next one will go through
                    api.post('/my-route/position', position).catch(() => {});
                }
            },
            (error) => setTracking({ status: error.code === error.PERMISSION_DENIED ? 'denied' : 'error', position: null }),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [active]);

    if (!supported) return { status: active ? 'unsupported' : 'idle', position: null };
    return active ? tracking : { status: 'idle', position: null };
}
