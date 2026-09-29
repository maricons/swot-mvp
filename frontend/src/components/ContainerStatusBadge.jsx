// src/components/ContainerStatusBadge.jsx
import { CONTAINER_STATUS_LABELS } from '../utils/format';

// Expected = not here yet (gray), InYard = active in the yard (indigo), Departed = gone (teal)
const CLASSES = { Expected: 'badge-created', InYard: 'badge-in-transit', Departed: 'badge-scheduled' };

function ContainerStatusBadge({ status }) {
    return <span className={`badge ${CLASSES[status]}`}>{CONTAINER_STATUS_LABELS[status]}</span>;
}

export default ContainerStatusBadge;
