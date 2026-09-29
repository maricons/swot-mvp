// src/components/PantallaCarga.jsx
function PantallaCarga({ mensaje = 'Cargando…' }) {
    return (
        <div className="splash" role="status">
            <div className="spinner" />
            <p>{mensaje}</p>
        </div>
    );
}

export default PantallaCarga;
