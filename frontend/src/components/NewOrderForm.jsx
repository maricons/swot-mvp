// src/components/NewOrderForm.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from './Toast';
import { productLabel } from '../utils/format';

const EMPTY = { customerId: '', weight: '', dueDate: '' };
const today = () => new Date().toLocaleDateString('en-CA');

// Dispatcher form: customer, promised date, optional product lines and the weight
function NewOrderForm({ onCreated }) {
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(EMPTY);
    const [items, setItems] = useState([]); // [{ productId, quantity }]
    const toast = useToast();

    useEffect(() => {
        Promise.all([api.get('/customers', { params: { active: 1 } }), api.get('/products', { params: { active: 1 } })])
            .then(([c, p]) => {
                setCustomers(c.data);
                setProducts(p.data);
            })
            .catch(() => toast('No se pudieron cargar los clientes y productos', 'error'));
    }, [toast]);

    // The total weight is calculated when every chosen product has a weight; otherwise it is typed by hand
    const byId = new Map(products.map((p) => [String(p.id), p]));
    const lines = items.filter((it) => it.productId);
    const allWeighted = lines.length > 0 && lines.every((it) => byId.get(it.productId)?.weightKg != null);
    const calculated = lines.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (byId.get(it.productId)?.weightKg ?? 0), 0);

    const setItem = (index, patch) => setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

    const submit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/orders', {
                customerId: Number(form.customerId),
                weightKg: allWeighted ? undefined : Number(form.weight), // the server calculates it when possible
                dueDate: form.dueDate || undefined,
                items: lines.map((it) => ({ productId: Number(it.productId), quantity: Number(it.quantity) })),
            });
            toast(`OT #${data.id} creada`);
            setForm(EMPTY);
            setItems([]);
            onCreated();
        } catch (error) {
            toast(error.response?.data?.error || 'Error al crear la OT', 'error');
        }
    };

    return (
        <section className="card">
            <h2 className="card-title">Nueva OT</h2>
            <form onSubmit={submit}>
                <div className="form-row">
                    <div className="field">
                        <label>Cliente</label>
                        <select className="input" value={form.customerId} required
                            onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                            <option value="">Selecciona un cliente</option>
                            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label>{allWeighted ? 'Peso total (kg) · calculado' : 'Peso total (kg)'}</label>
                        {allWeighted ? (
                            <input className="input" readOnly value={Math.max(0.01, calculated).toLocaleString('es-CL', { maximumFractionDigits: 2 })} />
                        ) : (
                            <input className="input" type="number" step="0.01" min="0.01" placeholder="Ej: 1200.5" required
                                value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                        )}
                        {lines.length > 0 && !allWeighted && <span className="hint">Algún producto no tiene peso definido: ingresa el peso total.</span>}
                    </div>
                    <div className="field">
                        <label>Fecha comprometida</label>
                        <input className="input" type="date" min={today()}
                            value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                    </div>
                </div>

                <div className="items">
                    {items.map((it, i) => (
                        <div className="item-row" key={i}>
                            <select className="input" value={it.productId} required
                                onChange={(e) => setItem(i, { productId: e.target.value })}>
                                <option value="">Producto</option>
                                {products.map((p) => <option key={p.id} value={p.id}>{productLabel(p)} ({p.unit})</option>)}
                            </select>
                            <input className="input" type="number" min="1" step="1" required
                                placeholder={byId.get(it.productId) ? `Cantidad (${byId.get(it.productId).unit})` : 'Cantidad'}
                                value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                            <button type="button" className="btn btn-ghost btn-sm" aria-label="Quitar producto"
                                onClick={() => setItems(items.filter((_, n) => n !== i))}>✕</button>
                        </div>
                    ))}
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn-sm"
                        onClick={() => setItems([...items, { productId: '', quantity: '' }])}>+ Agregar producto</button>
                    <button className="btn btn-primary" type="submit">Guardar OT</button>
                </div>
            </form>
        </section>
    );
}

export default NewOrderForm;
