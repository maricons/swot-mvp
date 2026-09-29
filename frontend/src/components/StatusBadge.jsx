// src/components/StatusBadge.jsx
import { STATUS_LABELS } from '../utils/format';

const CLASSES = {
    Created: 'badge-created',
    Scheduled: 'badge-scheduled',
    InTransit: 'badge-in-transit',
    Delivered: 'badge-delivered',
    Failed: 'badge-failed',
};

// With the driving prop, an order that is on the road shows an animated truck (used in the detail view)
function StatusBadge({ status, driving = false }) {
    const showTruck = driving && status === 'InTransit';
    return (
        <span className={`badge ${CLASSES[status] || 'badge-created'} ${showTruck ? 'badge-driving' : ''}`}>
            {showTruck && <span className="truck" aria-hidden="true">🚚</span>}
            {STATUS_LABELS[status]}
        </span>
    );
}

export default StatusBadge;
