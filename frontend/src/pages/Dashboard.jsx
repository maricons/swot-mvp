// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Topbar from '../components/Topbar';
import EstadoBadge from '../components/EstadoBadge';
import ProgramarModal from '../components/ProgramarModal';
import DetalleModal from '../components/DetalleModal';
import Reveal from '../components/Reveal';
import { useToast } from '../components/Toast';

const FILTROS_VACIOS = { estado: '', desde: '', hasta: '' };

function Dashboard() {
    const [ots, setOts] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [clienteId, setClienteId] = useState('');
    const [pesoKg, setPesoKg] = useState('');
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [version, setVersion] = useState(0); // sube para forzar una recarga
    const [otAProgramar, setOtAProgramar] = useState(null);
    const [otDetalleId, setOtDetalleId] = useState(null);
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        const cargar = async () => {
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
                } else {
                    toast('No se pudo cargar el listado', 'error');
                }
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, [filtros, version, navigate, toast]);

    const recargar = () => setVersion((v) => v + 1);

    const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });

    const crearOT = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/ot', {
                cliente_id: Number(clienteId),
                peso_kg: Number(pesoKg),
            });
            toast(`OT #${data.id_ot_nueva} creada`);
            setClienteId('');
            setPesoKg('');
            recargar();
        } catch {
            toast('Error al crear la OT. Revisa el cliente y el peso.', 'error');
        }
    };

    const contar = (estado) => ots.filter((o) => o.estado === estado).length;

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <h1 className="page-title">Órdenes de transporte</h1>
                    <p className="page-sub">Crea, programa y haz seguimiento de cada OT.</p>
                </Reveal>

                <div className="stats">
                    {[
                        ['Total en vista', ots.length],
                        ['Creadas', contar('Creada')],
                        ['Programadas', contar('Programada')],
                        ['En ruta', contar('En ruta')],
                        ['Entregadas', contar('Entregada')],
                    ].map(([etiqueta, valor], i) => (
                        <Reveal key={etiqueta} delay={150 + i * 90}>
                            <div className="stat">
                                {cargando
                                    ? <span className="skeleton sk-num" />
                                    : <div className="stat-num">{valor}</div>}
                                <div className="stat-label">{etiqueta}</div>
                            </div>
                        </Reveal>
                    ))}
                </div>

                <Reveal delay={200}><section className="card">
                    <h2 className="card-title">Nueva OT</h2>
                    <form className="form-row" onSubmit={crearOT}>
                        <div className="field">
                            <label>ID del cliente</label>
                            <input className="input" type="number" min="1" placeholder="Ej: 1"
                                value={clienteId} onChange={(e) => setClienteId(e.target.value)} required />
                        </div>
                        <div className="field">
                            <label>Peso (kg)</label>
                            <input className="input" type="number" step="0.01" min="0.01" placeholder="Ej: 1200.5"
                                value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} required />
                        </div>
                        <button className="btn btn-primary" type="submit">Guardar OT</button>
                    </form>
                </section></Reveal>

                <Reveal><section className="card">
                    <h2 className="card-title">Listado</h2>

                    <div className="filters">
                        <div className="field">
                            <label>Estado</label>
                            <select className="input" name="estado" value={filtros.estado} onChange={cambiarFiltro}>
                                <option value="">Todos</option>
                                <option value="Creada">Creada</option>
                                <option value="Programada">Programada</option>
                                <option value="En ruta">En ruta</option>
                                <option value="Entregada">Entregada</option>
                                <option value="Fallida">Fallida</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Desde</label>
                            <input className="input" type="date" name="desde" value={filtros.desde} onChange={cambiarFiltro} />
                        </div>
                        <div className="field">
                            <label>Hasta</label>
                            <input className="input" type="date" name="hasta" value={filtros.hasta} onChange={cambiarFiltro} />
                        </div>
                        <button className="btn btn-ghost" onClick={() => setFiltros(FILTROS_VACIOS)}>Limpiar</button>
                    </div>

                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>OT</th>
                                    <th>Cliente</th>
                                    <th>Peso</th>
                                    <th>Estado</th>
                                    <th>Fecha</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && [1, 2, 3, 4, 5].map((n) => (
                                    <tr key={`sk-${n}`}>
                                        <td><span className="skeleton sk-line" style={{ width: 36 }} /></td>
                                        <td><span className="skeleton sk-line" style={{ width: 130 }} /></td>
                                        <td><span className="skeleton sk-line" style={{ width: 70 }} /></td>
                                        <td><span className="skeleton sk-pill" /></td>
                                        <td><span className="skeleton sk-line" style={{ width: 80 }} /></td>
                                        <td><span className="skeleton sk-line" style={{ width: 110, marginLeft: 'auto' }} /></td>
                                    </tr>
                                ))}
                                {!cargando && ots.map((ot, i) => (
                                    <tr key={ot.id} className="row-in" style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}>
                                        <td className="id-cell">#{ot.id}</td>
                                        <td>{ot.cliente_nombre}</td>
                                        <td className="num">{Number(ot.peso_kg).toLocaleString('es-CL')} kg</td>
                                        <td><EstadoBadge estado={ot.estado} /></td>
                                        <td>{new Date(ot.fecha_creacion).toLocaleDateString('es-CL')}</td>
                                        <td className="actions">
                                            {ot.estado === 'Creada' && (
                                                <button className="btn btn-primary btn-sm" onClick={() => setOtAProgramar(ot)}>Programar</button>
                                            )}
                                            <button className="btn btn-sm" onClick={() => setOtDetalleId(ot.id)}>Detalle</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!cargando && ots.length === 0 && <div className="empty">No hay órdenes con estos filtros.</div>}
                    </div>
                </section></Reveal>
            </main>

            {otAProgramar && (
                <ProgramarModal
                    ot={otAProgramar}
                    onClose={() => setOtAProgramar(null)}
                    onProgramada={() => {
                        toast(`OT #${otAProgramar.id} programada`);
                        setOtAProgramar(null);
                        recargar();
                    }}
                />
            )}

            {otDetalleId && <DetalleModal otId={otDetalleId} onClose={() => setOtDetalleId(null)} />}
        </>
    );
}

export default Dashboard;
