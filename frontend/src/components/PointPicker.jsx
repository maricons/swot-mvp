// src/components/PointPicker.jsx
import { useMemo } from 'react';
import MapView from './MapView';

// Choose a point by clicking the map. value = { latitude, longitude } or null.
function PointPicker({ value, onChange }) {
    const markers = useMemo(
        () => (value ? [{ id: 'picked', latitude: value.latitude, longitude: value.longitude, label: '📍', tone: 'pick' }] : []),
        [value]
    );

    return (
        <div className="point-picker">
            <MapView markers={markers} height={220} fit={false}
                onPick={(latitude, longitude) => onChange({ latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) })} />
            <div className="point-picker-foot">
                <span className="hint">
                    {value ? `${value.latitude}, ${value.longitude}` : 'Haz clic en el mapa para marcar dónde se entrega.'}
                </span>
                {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Quitar</button>}
            </div>
        </div>
    );
}

export default PointPicker;
