// src/components/CatalogPage.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from './Topbar';
import Reveal from './Reveal';
import { useToast } from './Toast';

// Generic list + create/edit/deactivate page shared by customers, vehicles, drivers and products.
// path is the API collection ("/customers"); every row needs { id, isActive }.
// columns = [{ header, cell(row), className }]; above(rows, loading) renders extra content (charts, alerts) over the table.
function CatalogPage({ title, subtitle, path, searchPlaceholder, newLabel, columns, Modal, label, above }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [active, setActive] = useState('');
    const [version, setVersion] = useState(0);
    const [modal, setModal] = useState(null); // null = closed, {} = new, { row } = edit
    const toast = useToast();
    const canEdit = localStorage.getItem('role') === 'admin';

    useEffect(() => {
        const params = {};
        if (search.trim()) params.search = search.trim();
        if (active !== '') params.active = active;
        api.get(path, { params })
            .then((res) => setRows(res.data))
            .catch(() => toast('No se pudo cargar el listado', 'error'))
            .finally(() => setLoading(false));
    }, [path, search, active, version, toast]);

    const reload = () => setVersion((v) => v + 1);

    const flipActive = async (row) => {
        try {
            await api.patch(`${path}/${row.id}/active`, { isActive: !row.isActive });
            toast(row.isActive ? `${label(row)} desactivado` : `${label(row)} activado`);
            reload();
        } catch (error) {
            toast(error.response?.data?.error || 'No se pudo cambiar el estado', 'error');
        }
    };

    const colCount = columns.length + 1 + (canEdit ? 1 : 0);

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <div className="page-head">
                        <div>
                            <h1 className="page-title">{title}</h1>
                            <p className="page-sub">{subtitle}{!canEdit && ' Vista de solo lectura.'}</p>
                        </div>
                        {canEdit && <button className="btn btn-primary" onClick={() => setModal({})}>+ {newLabel}</button>}
                    </div>
                </Reveal>

                {above?.(rows, loading)}

                <Reveal delay={120}>
                    <section className="card">
                        <div className="filters">
                            <div className="field" style={{ width: 260 }}>
                                <label>Buscar</label>
                                <input className="input" placeholder={searchPlaceholder} value={search}
                                    onChange={(e) => setSearch(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>Estado</label>
                                <select className="input" value={active} onChange={(e) => setActive(e.target.value)}>
                                    <option value="">Todos</option>
                                    <option value="1">Activos</option>
                                    <option value="0">Inactivos</option>
                                </select>
                            </div>
                        </div>

                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        {columns.map((c) => <th key={c.header}>{c.header}</th>)}
                                        <th>Estado</th>
                                        {canEdit && <th></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && [1, 2, 3, 4].map((n) => (
                                        <tr key={`sk-${n}`}>
                                            {Array.from({ length: colCount }, (_, i) => (
                                                <td key={i}><span className="skeleton sk-line" style={{ width: 60 + ((i * 37) % 80) }} /></td>
                                            ))}
                                        </tr>
                                    ))}
                                    {!loading && rows.map((row, i) => (
                                        <tr key={row.id} className="row-in" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                                            {columns.map((c) => <td key={c.header} className={c.className}>{c.cell(row)}</td>)}
                                            <td>
                                                <span className={`badge ${row.isActive ? 'badge-delivered' : 'badge-created'}`}>
                                                    {row.isActive ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            {canEdit && (
                                                <td className="actions">
                                                    <button className="btn btn-sm" onClick={() => setModal({ row })}>Editar</button>
                                                    <button className={`btn btn-sm ${row.isActive ? 'btn-danger' : ''}`} onClick={() => flipActive(row)}>
                                                        {row.isActive ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!loading && rows.length === 0 && <div className="empty">No hay resultados con estos filtros.</div>}
                        </div>
                    </section>
                </Reveal>
            </main>

            {modal && (
                <Modal
                    row={modal.row}
                    onClose={() => setModal(null)}
                    onSaved={(message) => {
                        toast(message);
                        setModal(null);
                        reload();
                    }}
                />
            )}
        </>
    );
}

export default CatalogPage;
