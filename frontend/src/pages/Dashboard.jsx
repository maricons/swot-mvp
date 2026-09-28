// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Dashboard() {
    const [ots, setOts] = useState([]);
    const [clienteId, setClienteId] = useState('');
    const [pesoKg, setPesoKg] = useState('');
    const navigate = useNavigate();
    const rol = localStorage.getItem('rol');

    const cargarOTs = async () => {
        try {
            const response = await api.get('/ot');
            setOts(response.data);
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.clear();
                navigate('/');
            }
        }
    };

    useEffect(() => {
        cargarOTs();
    }, []);

    const crearOT = async (e) => {
        e.preventDefault();
        try {
            await api.post('/ot', { cliente_id: Number(clienteId), peso_kg: Number(pesoKg) });
            alert('OT Creada exitosamente');
            setClienteId('');
            setPesoKg('');
            cargarOTs(); // Recargar la tabla
        } catch (error) {
            alert('Error al crear OT');
        }
    };

    const cerrarSesion = () => {
        localStorage.clear();
        navigate('/');
    };

    return (
        <div style={{ padding: '2rem' }}>
            <h2>Panel de Control ({rol})</h2>
            <button onClick={cerrarSesion}>Cerrar Sesión</button>
            
            <hr />
            
            {/* Formulario Nueva OT */}
            {rol === 'despachador' && (
                <div>
                    <h3>Crear Nueva OT</h3>
                    <form onSubmit={crearOT}>
                        <input type="number" placeholder="ID Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required />
                        <input type="number" step="0.01" placeholder="Peso (Kg)" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} required />
                        <button type="submit">Guardar OT</button>
                    </form>
                </div>
            )}

            <hr />

            {/* Listado de OTs */}
            <h3>Listado de Órdenes</h3>
            <table border="1" cellPadding="10">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Peso (Kg)</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {ots.map(ot => (
                        <tr key={ot.id}>
                            <td>{ot.id}</td>
                            <td>{ot.cliente_id}</td>
                            <td>{ot.peso_kg}</td>
                            <td>{ot.estado}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Dashboard;