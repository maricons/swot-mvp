// src/components/MapView.jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Map centered on the Valparaíso region until there is something to show
const DEFAULT_VIEW = { center: [-33.05, -71.55], zoom: 9 };

// A popup is built with DOM nodes (textContent), so names and addresses typed by users can never inject HTML
const buildPopup = ({ title, lines = [] }) => {
    const box = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title;
    box.appendChild(heading);
    lines.filter(Boolean).forEach((line) => {
        const p = document.createElement('div');
        p.textContent = line;
        box.appendChild(p);
    });
    return box;
};

// Map with OpenStreetMap tiles. Everything is drawn from props:
// - markers = [{ id, latitude, longitude, label, tone, title, lines }]  (label is a number or an emoji shown inside the pin)
// - paths = [[[lat, lng], [lat, lng], ...]]  dashed lines
// - onPick(latitude, longitude): clicking the map places a point (used to choose a customer's location)
// The map zooms to fit what it draws unless fit is false.
function MapView({ markers = [], paths = [], height = 320, onPick, fit = true }) {
    const boxRef = useRef(null);
    const mapRef = useRef(null);
    const layerRef = useRef(null);
    const pickRef = useRef(onPick);

    useEffect(() => {
        pickRef.current = onPick;
    }, [onPick]);

    // Create the map once
    useEffect(() => {
        const map = L.map(boxRef.current, { scrollWheelZoom: false }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        map.on('click', (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
        mapRef.current = map;

        // The map needs to know when its box changes size (modals, orientation, sidebars)
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(boxRef.current);
        return () => {
            observer.disconnect();
            map.remove();
        };
    }, []);

    // Redraw markers and paths when they change
    useEffect(() => {
        const map = mapRef.current;
        const layer = layerRef.current;
        layer.clearLayers();

        const points = [];
        markers.forEach((m) => {
            const point = [m.latitude, m.longitude];
            points.push(point);
            const icon = L.divIcon({
                className: `map-pin map-pin-${m.tone || 'stop'}`,
                html: `<span>${m.label ?? ''}</span>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
                popupAnchor: [0, -18],
            });
            const marker = L.marker(point, { icon, keyboard: true, title: m.title }).addTo(layer);
            if (m.title) marker.bindPopup(buildPopup(m));
        });
        paths.forEach((path) => L.polyline(path, { color: '#114c5f', weight: 3, opacity: 0.55, dashArray: '6 8' }).addTo(layer));

        if (fit && points.length) {
            if (points.length === 1) map.setView(points[0], 14);
            else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
        }
    }, [markers, paths, fit]);

    return <div className={`map-box ${onPick ? 'map-pickable' : ''}`} ref={boxRef} style={{ height }} />;
}

export default MapView;
