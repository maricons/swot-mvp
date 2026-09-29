// src/components/ContainerStatusBadge.jsx
import { CONTAINER_STATUS_LABELS } from '../utils/format';

// Expected = on its way (blue), InYard = stored (green), Departed = gone (gray)
const CLASSES = { Expected: 'badge-scheduled', InYard: 'badge-delivered', Departed: 'badge-created' };

function ContainerStatusBadge({ status }) {
    return <span className={`badge ${CLASSES[status]}`}>{CONTAINER_STATUS_LABELS[status]}</span>;
}

export default ContainerStatusBadge;
