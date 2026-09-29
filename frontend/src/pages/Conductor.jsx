// src/pages/Conductor.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Topbar from '../components/Topbar';
import EstadoBadge from '../components/EstadoBadge';
import Reveal from '../components/Reveal';
import { useToast } from '../components/Toast';

function Conductor() {
    const [ots, setOts] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [version, setVersion] = useState(0);
    const [actualizando, setActualizando] = useState(null); // id de la OT en proceso
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        const cargar = async () => {
            try {
                const response = await api.get('/hoja-ruta');
                setOts(response.data);
            } catch (error) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    localStorage.clear();
                    navigate('/');
                } else {
                    toast('No se pudo cargar tu hoja de ruta', 'error');
                }
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, [version, navigate, toast]);

    const cambiarEstado = async (ot, estado) => {
        setActualizando(ot.id);
        try {
            await api.patch(`/ot/${ot.id}/estado`, { estado });
            toast(`OT #${ot.id}: ${estado}`);
            setVersion((v) => v + 1);
        } catch {
            toast('No se pudo cambiar el estado', 'error');
        } finally {
            setActualizando(null);
        }
    };

    return (
        <>
            <Topbar />
            <main className="driver-wrap">
                <Reveal>
                    <h1 className="page-title">Mi hoja de ruta</h1>
                    <p className="page-sub">Tus entregas de hoy.</p>
                </Reveal>

                <div className="driver-list">
                    {cargando && [1, 2].map((n) => <span key={n} className="skeleton sk-card" />)}
                    {!cargando && ots.map((ot, i) => (
                        <article className="trip row-in" key={ot.id} style={{ animationDelay: `${Math.min(i, 8) * 90}ms` }}>
                            <div className="trip-head">
                                <span className="trip-id">OT #{ot.id}</span>
                                <EstadoBadge estado={ot.estado} />
                            </div>
                            <div className="trip-client">{ot.cliente_nombre}</div>
                            <div className="trip-addr">📍 {ot.cliente_direccion}</div>
                            <div className="trip-meta">
                                <span className="pill">{Number(ot.peso_kg).toLocaleString('es-CL')} kg</span>
                                {ot.patente && <span className="pill">🚚 {ot.patente}</span>}
                            </div>

                            <div className="trip-actions">
                                {ot.estado === 'Programada' && (
                                    <button className="btn btn-primary" disabled={actualizando === ot.id}
                                        onClick={() => cambiarEstado(ot, 'En ruta')}>
                                        Iniciar ruta
                                    </button>
                                )}
                                {ot.estado === 'En ruta' && (
                                    <>
                                        <button className="btn btn-success" disabled={actualizando === ot.id}
                                            onClick={() => cambiarEstado(ot, 'Entregada')}>
                                            Entregada
                                        </button>
                                        <button className="btn btn-danger" disabled={actualizando === ot.id}
                                            onClick={() => cambiarEstado(ot, 'Fallida')}>
                                            Fallida
                                        </button>
                                    </>
                                )}
                            </div>
                        </article>
                    ))}
                    {!cargando && ots.length === 0 && (
                        <div className="card empty">No tienes entregas pendientes. 🎉</div>
                    )}
                </div>
            </main>
        </>
    );
}

export default Conductor;
