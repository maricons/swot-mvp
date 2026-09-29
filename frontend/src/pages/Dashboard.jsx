// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Dashboard() {
    const [ots, setOts] = useState([]);
    const [clienteId, setClienteId] = useState('');
    const [pesoKg, setPesoKg] = useState('');
    const [filtros, setFiltros] = useState({ estado: '', desde: '', hasta: '' });
    const navigate = useNavigate();
    const rol = localStorage.getItem('rol');

    const cargarOTs = async () => {
        try {
            const params = Object.fromEntries(
                Object.entries(filtros).filter(([, valor]) => valor !== '')
            );
            const response = await api.get('/ot', { params });
            setOts(response.data);
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.clear();
                navigate('/');
            }
        }
    };

    // Recarga la tabla cada vez que cambia un filtro
    useEffect(() => {
        cargarOTs();
    }, [filtros]);

    const cambiarFiltro = (e) => {
        setFiltros({ ...filtros, [e.target.name]: e.target.value });
    };

    const limpiarFiltros = () => setFiltros({ estado: '', desde: '', hasta: '' });

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

            {/* Filtros por estado y fecha */}
            <div style={{ marginBottom: '1rem' }}>
                <select name="estado" value={filtros.estado} onChange={cambiarFiltro}>
                    <option value="">Todos los estados</option>
                    <option value="Creada">Creada</option>
                    <option value="Programada">Programada</option>
                    <option value="En ruta">En ruta</option>
                    <option value="Entregada">Entregada</option>
                    <option value="Fallida">Fallida</option>
                </select>
                {' '}
                <label>Desde: <input type="date" name="desde" value={filtros.desde} onChange={cambiarFiltro} /></label>
                {' '}
                <label>Hasta: <input type="date" name="hasta" value={filtros.hasta} onChange={cambiarFiltro} /></label>
                {' '}
                <button onClick={limpiarFiltros}>Limpiar</button>
            </div>

            {/* Listado de OTs */}
            <h3>Listado de Órdenes</h3>
            <table border="1" cellPadding="10">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Peso (Kg)</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    {ots.map(ot => (
                        <tr key={ot.id}>
                            <td>{ot.id}</td>
                            <td>{ot.cliente_nombre}</td>
                            <td>{ot.peso_kg}</td>
                            <td>{ot.estado}</td>
                            <td>{new Date(ot.fecha_creacion).toLocaleDateString('es-CL')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Dashboard;