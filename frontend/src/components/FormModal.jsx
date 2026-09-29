// src/components/FormModal.jsx
import { useState } from 'react';
import PhotoInput from './PhotoInput';

// Generic create/edit modal. fields = [{ name, label, type, hint, format, options, ...inputProps }];
// type "select" takes options = [{ value, label }] (or a function of the form values), type "photo" stores a data URL.
// showIf(form) hides a field, normalize(form) fixes dependent values after every change.
// submit(values) performs the API call and rejects on failure.
function FormModal({ title, fields, initial, submit, message, submitText = 'Guardar', normalize, onClose, onSaved }) {
    const [form, setForm] = useState(initial);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    const send = async (e) => {
        e.preventDefault();
        setError('');
        setSending(true);
        try {
            await submit(form);
            onSaved(message);
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo guardar');
            setSending(false);
        }
    };

    const renderInput = ({ name, format, options, type, ...inputProps }) => {
        const set = (value) => setForm(normalize ? normalize({ ...form, [name]: value }) : { ...form, [name]: value });
        if (type === 'photo') return <PhotoInput value={form[name]} onChange={set} />;
        if (type === 'select') {
            return (
                <select className="input" value={form[name]} onChange={(e) => set(e.target.value)} {...inputProps}>
                    {(typeof options === 'function' ? options(form) : options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        }
        return (
            <input className="input" name={name} type={type} value={form[name]} required
                onChange={(e) => set(format ? format(e.target.value) : e.target.value)} {...inputProps} />
        );
    };

    return (
        <div className="overlay" onClick={onClose}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
                <div className="modal-head">
                    <h3 className="modal-title">{title}</h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {fields.filter((f) => !f.showIf || f.showIf(form)).map(({ label, hint, showIf: _showIf, ...input }) => (
                        <div className="field" key={input.name}>
                            <label>{label}</label>
                            {renderInput(input)}
                            {hint && <span className="hint">{hint}</span>}
                        </div>
                    ))}
                    {error && <div className="error-box">{error}</div>}
                </div>

                <div className="modal-foot">
                    <button type="button" className="btn" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={sending}>
                        {sending ? 'Guardando…' : submitText}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default FormModal;
