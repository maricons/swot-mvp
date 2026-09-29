# SWOT · Sistema Web de Órdenes de Transporte

Proyecto de práctica personal (caso ficticio **Neo Tech Logística**): un sistema web para que los despachadores planifiquen órdenes de transporte (OT), los conductores registren cada entrega desde el celular con la foto de la guía firmada, y los supervisores vean los indicadores al día.

**Stack:** React 19 + Vite · Node.js + Express 5 · SQL Server (procedimientos almacenados) · JWT

## Qué hace

| Rol | Puede |
|---|---|
| **Despachador** | Crear OT (cliente, fecha comprometida, productos), programarlas asignando vehículo y conductor, filtrarlas y exportarlas a Excel o PDF |
| **Conductor** | Ver su hoja de ruta, iniciar la ruta y registrar la entrega con el **RUT de quien recibe** y la **foto de la guía firmada** (o marcarla como fallida) |
| **Supervisor** | Ver órdenes, clientes, vehículos, conductores y productos (solo lectura), el **indicador OTIF por mes y semana** y las alertas |
| **Administrador** | Lo del supervisor, más crear, editar y desactivar clientes, vehículos, conductores y productos |

Reglas de negocio que valida el sistema:

- Flujo de estados: `Creada → Programada → En ruta → Entregada` o `Fallida`. El conductor solo puede avanzar sus propias OT y solo en ese orden.
- No se programa un camión **sin capacidad** para el peso de la OT ni con la **revisión técnica vencida** (error 409).
- El **peso de la OT se calcula** con los productos (cantidad × peso por presentación); solo se escribe a mano cuando algún producto no tiene peso definido.
- Una entrega exige un **RUT válido** (con dígito verificador) y la foto de la guía firmada.
- Los registros se **desactivan**, no se borran, para conservar el historial. Un usuario desactivado pierde el acceso al instante.
- **OTIF** (On Time In Full): porcentaje de OT entregadas a tiempo y completas. Una OT fallida cuenta como no cumplida.
- **Alertas:** revisiones técnicas que vencen en 30 días (o ya vencidas) y OT atrasadas.

## Estructura

```
backend/    API REST (Express). src/controllers, src/middlewares, src/utils, scripts/, tests/
frontend/   Aplicación React (Vite). src/pages, src/components, src/utils
database/   init.sql (esquema + datos de prueba), procedures.sql, upgrade_to_english.sql
postman/    Colección de Postman con 70 pruebas
```

## Puesta en marcha

### 1. Requisitos

Node.js 24 LTS, Git y Docker Desktop (para SQL Server).

### 2. Base de datos

Levanta SQL Server (cambia la contraseña por una tuya, con mayúsculas, minúsculas, número y símbolo):

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=TuClave-Segura1" -p 1433:1433 --name sqlserver -d mcr.microsoft.com/mssql/server:2022-latest
```

Crea la base de datos:

```bash
docker exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "TuClave-Segura1" -C -Q "CREATE DATABASE swot_db"
```

### 3. Backend

```bash
cd backend
npm install
```

Copia `.env.example` a `.env` y completa la contraseña de la base y un `JWT_SECRET` largo. Luego carga el esquema y los procedimientos:

```bash
node scripts/run_sql.js ../database/init.sql ../database/procedures.sql
```

Inicia la API (queda en `http://localhost:3000`):

```bash
npm start
```

### 4. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Si la API no está en `localhost:3000`, copia `frontend/.env.example` a `.env` y ajusta `VITE_API_URL`.

### Cuentas de prueba

Todas usan la contraseña `hash_simulado_123`. En la pantalla de inicio hay botones para elegir una.

| Rol | Correo |
|---|---|
| Despachador | `despachador@swot.cl` |
| Conductor | `conductor@swot.cl` (y `driver2@swot.cl`) |
| Supervisor | `supervisor@swot.cl` |
| Administrador | `admin@swot.cl` |

Los datos de prueba incluyen un vehículo con la revisión técnica vencida (`CD5678`) para ver las reglas y las alertas en acción.

## Pruebas

**Pruebas automáticas del backend** (levantan su propio servidor en el puerto 3998 y borran lo que crean; necesitan la base encendida):

```bash
cd backend
npm test
```

Cubren login, permisos por rol, inyección SQL, RUT y patentes, conductores, productos, cálculo de peso, reglas de programación, prueba de entrega, OTIF, alertas y exportaciones.

**Colección de Postman:** importa `postman/SWOT.postman_collection.json` y ejecútala completa con el Collection Runner (con el backend en `http://localhost:3000/api`). Son 70 peticiones con 85 verificaciones, que recorren el flujo completo de una OT con los 4 roles y comprueban los errores de permisos, validación y seguridad. Por línea de comandos: `npx newman run postman/SWOT.postman_collection.json`.

**Pruebas manuales en la interfaz** (recorrido de la demo):

1. Como despachador: crear una OT con un producto con peso (el peso sale calculado), con fecha comprometida, y programarla con el camión `AB1234`. Probar el camión `CD5678` para ver el error de revisión técnica.
2. Como conductor (en modo celular de las DevTools): iniciar la ruta y entregar con RUT y foto.
3. Como supervisor: abrir el detalle de la OT (guía firmada e historial), el **OTIF** por mes y semana y exportar a PDF.
4. Como administrador: crear un cliente (el RUT se formatea solo), un conductor y un producto con foto.

## Seguridad

- Contraseñas con **bcrypt**; consultas parametrizadas y procedimientos almacenados (sin SQL armado con texto del usuario).
- **Límite de intentos** de inicio de sesión: 5 fallidos cada 2 minutos por IP (no bloquea la cuenta).
- `helmet`, CORS limitado al frontend, tamaño máximo de las peticiones y validación de todos los datos de entrada.
- Permisos por rol en cada ruta, y el rol y el estado activo se leen de la base en cada petición.
- Los errores internos se registran en el servidor y no se muestran al usuario.

## API (resumen)

`POST /api/auth/login` · `/api/orders` (listar, crear, `/:id`, `/:id/schedule`, `/:id/status`, `/export/excel`, `/export/pdf`) · `/api/my-route` · `/api/customers` · `/api/vehicles` · `/api/drivers` · `/api/products` (listar, crear, editar y `/:id/active`) · `/api/otif` (`?groupBy=month|week`, `/export/pdf`) · `/api/alerts`

Los códigos de estado y roles son en inglés en la base y la API (`Created`, `Scheduled`, `InTransit`, `Delivered`, `Failed`; `dispatcher`, `driver`, `admin`, `supervisor`); las pantallas los muestran en español.

## Si ya tenías una base con las tablas en español

Ejecuta una sola vez (desde `backend`) la migración que renombra todo a inglés y agrega las columnas de prueba de entrega:

```bash
node scripts/run_sql.js ../database/upgrade_to_english.sql ../database/procedures.sql
```
