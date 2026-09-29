// src/components/PhotoInput.jsx
import { useState } from 'react';
import { resizeImage } from '../utils/format';

// Picks a picture, shrinks it in the browser and hands back a data URL (or null when removed).
// max is the longest side in pixels: small for product thumbnails, bigger for a photo of a document.
function PhotoInput({ value, onChange, max = 320, quality = 0.8, emptyText = 'Sin foto', pickText = 'Subir foto', capture }) {
    const [error, setError] = useState('');

    const pick = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setError('');
            onChange(await resizeImage(file, max, quality));
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="photo-input">
            {value
                ? <img className="photo-preview" src={value} alt="Vista previa" />
                : <div className="photo-preview photo-empty">{emptyText}</div>}
            <div className="photo-actions">
                <label className="btn btn-sm">
                    {value ? 'Cambiar foto' : pickText}
                    <input type="file" accept="image/*" capture={capture} hidden onChange={pick} />
                </label>
                {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Quitar</button>}
                {error && <span className="hint">{error}</span>}
            </div>
        </div>
    );
}

export default PhotoInput;
