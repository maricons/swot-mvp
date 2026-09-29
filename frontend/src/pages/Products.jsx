// src/pages/Products.jsx
import CatalogPage from '../components/CatalogPage';
import ProductModal from '../components/ProductModal';
import { formatContent } from '../utils/format';

const columns = [
    {
        header: 'Producto',
        cell: (p) => (
            <span className="product-cell">
                {p.photo ? <img className="thumb" src={p.photo} alt="" /> : <span className="thumb thumb-empty">📦</span>}
                <strong>{p.name}</strong>
            </span>
        ),
    },
    { header: 'Contenido', cell: (p) => formatContent(p) || '—', className: 'num' },
    { header: 'Peso por presentación', cell: (p) => (p.weightKg == null ? 'Sin peso' : `${Number(p.weightKg).toLocaleString('es-CL')} kg`), className: 'num' },
    { header: 'Presentación', cell: (p) => p.unit },
    { header: 'OT', cell: (p) => p.totalOrders, className: 'num' },
];

function Products() {
    return (
        <CatalogPage
            title="Productos"
            subtitle="Catálogo de carga que se puede agregar a cada orden de transporte."
            path="/products"
            searchPlaceholder="Nombre"
            newLabel="Nuevo producto"
            columns={columns}
            Modal={ProductModal}
            label={(p) => p.name}
        />
    );
}

export default Products;
