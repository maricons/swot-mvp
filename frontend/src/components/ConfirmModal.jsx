// src/components/ConfirmModal.jsx

// Asks for confirmation before an action that cannot be undone
function ConfirmModal({ title, message, confirmText = 'Confirmar', busy = false, onConfirm, onClose }) {
    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal modal-small" role="alertdialog" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title" id="confirm-title">{title}</h3>
                <p className="confirm-text">{message}</p>
                <div className="modal-foot">
                    <button className="btn" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-danger" disabled={busy} onClick={onConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;
