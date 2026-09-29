# SWOT · Sistema Web de Órdenes de Transporte

Proyecto de práctica personal (caso ficticio **Neo Tech Logística**, un operador logístico de carga seca y perecedera). El sistema tiene **dos servicios**:

- **Transporte:** los despachadores planifican órdenes de transporte (OT), los conductores registran cada entrega desde el celular con la foto de la guía firmada, y los supervisores ven los indicadores al día.
- **Almacenaje de contenedores:** el operador de patio registra cuándo llega cada contenedor, dónde queda, cuándo se mueve y cuándo sale, con alertas por exceso de días en el patio.

**Stack:** React 19 + Vite · Node.js + Express 5 · SQL Server (procedimientos almacenados) · JWT

## Qué hace

| Rol | Puede |
|---|---|
| **Despachador** | Crear OT (cliente, fecha comprometida, productos), programarlas asignando vehículo y conductor, filtrarlas y exportarlas a Excel o PDF |
| **Conductor** | Ver su hoja de ruta con un **mapa de sus próximas paradas** y un enlace "Cómo llegar", iniciar la ruta y registrar la entrega con el **RUT de quien recibe** y la **foto de la guía firmada** (o marcarla como fallida, con confirmación) |
| **Supervisor** | Ver órdenes, clientes, vehículos, conductores y productos (solo lectura), el **mapa de la flota en ruta**, el **indicador OTIF por mes o de todo el historial** y las alertas |
| **Administrador** | Lo del supervisor, más crear, editar y desactivar clientes, vehículos, conductores y productos, y gestionar los contenedores |
| **Operador de patio** | Anunciar contenedores, registrar su llegada, moverlos de posición y registrar su salida; ver el panel del patio y sus alertas |

Reglas de negocio que valida el sistema:

- Flujo de estados: `Creada → Programada → En ruta → Entregada` o `Fallida`. El conductor solo puede avanzar sus propias OT y solo en ese orden.
- No se programa un camión **sin capacidad** para el peso de la OT ni con la **revisión técnica vencida** (error 409).
- El **peso de la OT se calcula** con los productos (cantidad × peso por presentación); solo se escribe a mano cuando algún producto no tiene peso definido.
- Una entrega exige un **RUT válido** (con dígito verificador) y la foto de la guía firmada.
- Los registros se **desactivan**, no se borran, para conservar el historial. Un usuario desactivado pierde el acceso al instante.
- **OTIF** (On Time In Full): porcentaje de OT entregadas a tiempo y completas. Una OT fallida cuenta como no cumplida.
- **Alertas:** revisiones técnicas que vencen en 30 días (o ya vencidas) y OT atrasadas; contenedores con más de 5 días en el patio y contenedores con la salida prevista vencida. Cada rol ve solo las alertas de su servicio.

Mapas y seguimiento de la flota:

- Cada cliente puede tener un **punto de entrega** en el mapa (latitud y longitud), que el administrador marca haciendo clic en el mapa al crear o editar el cliente. Las OT de un cliente sin punto se listan igual, pero no aparecen en el mapa.
- **Conductor:** ve sus paradas numeradas en el orden de entrega (la que está en ruta se destaca), su propia posición y una línea que las une. Cada tarjeta trae "Cómo llegar", que abre Google Maps con la ruta.
- **Ubicación del camión:** mientras el conductor tiene una OT **en ruta**, su celular informa dónde está (con permiso del navegador) como máximo cada 30 segundos. Solo se guarda la **última posición**, y se borra apenas termina su última entrega en ruta. Nunca se guarda un historial de recorridos.
- **Supervisor y administrador:** la pantalla **Flota** muestra un mapa con cada camión en ruta, su destino y la señal más reciente; se actualiza sola cada 20 segundos. Un camión sin señal hace más de 10 minutos se ve en gris.
- Los mapas usan [OpenStreetMap](https://www.openstreetmap.org/copyright) (necesitan internet para cargar el fondo). Los navegadores de celular solo entregan la ubicación en páginas **HTTPS** (o en `localhost`), así que para probarlo en un teléfono real hay que servir el frontend por HTTPS.

Reglas del almacenaje de contenedores:

- Flujo: `Esperado → En patio → Retirado`. Cada llegada, movimiento y salida queda en el historial con fecha, hora y usuario.
- El número del contenedor sigue la norma **ISO 6346** (4 letras, 6 números y un dígito verificador que se valida), por ejemplo `MSCU 123456-6`.
- La carga **perecedera** exige un contenedor refrigerado (`20RF` o `40RF`) y su temperatura de operación; la seca puede ir en cualquier tipo.
- No se puede mover un contenedor que no llegó, ni registrar dos veces la misma llegada o salida. Un contenedor retirado ya no se edita.
- Los **días en patio** se cuentan desde la llegada; pasados los 5 días libres el contenedor se marca como excedido.
- Pensado para usarlo de pie en el patio con una **tablet o un teléfono**: cada contenedor es una tarjeta grande (con filtros rápidos por estado). Al tocarla se abre su pantalla, con botones grandes para registrar la llegada, moverlo, registrar la salida o editarlo, y con su historial. En el celular las ventanas se abren desde abajo.

## Estructura

```
backend/    API REST (Express). src/controllers, src/middlewares, src/utils, scripts/, tests/
frontend/   Aplicación React (Vite). src/pages, src/components, src/utils
database/   init.sql (esquema + datos de prueba), procedures.sql, demo_otif_data.sql, upgrade_to_english.sql, upgrade_add_containers.sql, upgrade_add_maps.sql
postman/    Colección de Postman con 110 pruebas
```

## Puesta en marcha

### 1. Requisitos

Node.js 24 LTS, Git y Docker Desktop (para SQL Server).

### 2. Base de datos

Levanta SQL Server (cambia la contraseña por una tuya, con mayúsculas, minúsculas, número y símbolo). El volumen `swot-sql-data` guarda los datos fuera del contenedor: sin él, borrar el contenedor borra la base.

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=TuClave-Segura1" -p 1433:1433 -v swot-sql-data:/var/opt/mssql --name swot-sql -d mcr.microsoft.com/mssql/server:2022-latest
```

Crea la base de datos:

```bash
docker exec swot-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "TuClave-Segura1" -C -Q "CREATE DATABASE swot_db"
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
| Operador de patio | `patio@swot.cl` |

Los datos de prueba incluyen un vehículo con la revisión técnica vencida (`CD5678`) y cuatro contenedores (uno pasado de días en el patio, uno refrigerado, uno esperado y uno ya retirado) para ver las reglas y las alertas en acción.

## Datos de demostración del OTIF

Con los datos de prueba básicos el panel OTIF casi no tiene qué mostrar. Para verlo con historia, carga 53 OT terminadas entre marzo y septiembre de 2026 (unas atrasadas, otras incompletas, algunas fallidas, con un servicio que mejora mes a mes). Desde `backend`:

```bash
node scripts/run_sql.js ../database/demo_otif_data.sql
```

Es seguro repetirlo: no hace nada si ya hay OT anteriores al 26 de septiembre. Para quitarlas después, las instrucciones están en los comentarios del propio archivo.

## Pruebas

**Pruebas automáticas del backend** (levantan su propio servidor en el puerto 3998 y borran lo que crean; necesitan la base encendida):

```bash
cd backend
npm test
```

Son 15 pruebas. Cubren login, permisos por rol, inyección SQL, RUT y patentes, conductores, productos, cálculo de peso, reglas de programación, prueba de entrega, OTIF, alertas, exportaciones todo el ciclo de un contenedor (anuncio, llegada, movimiento, salida e historial) y los mapas (puntos de entrega, posición del camión y flota).

**Colección de Postman:** importa `postman/SWOT.postman_collection.json` y ejecútala completa con el Collection Runner (con el backend en `http://localhost:3000/api`). Son 110 peticiones con 131 verificaciones, que recorren el flujo completo de una OT y de un contenedor con los 5 roles y comprueban los errores de permisos, validación y seguridad. Por línea de comandos: `npx newman run postman/SWOT.postman_collection.json`. Como incluye intentos de login fallidos a propósito, no la ejecutes dos veces seguidas en menos de 2 minutos (el límite de intentos respondería 429); tampoco borra lo que crea, así que limpia esos registros de prueba si la corres contra tu base real (los contenedores de la colección empiezan con `PMNU`).

**Pruebas manuales en la interfaz** (recorrido de la demo):

1. Como despachador: crear una OT con un producto con peso (el peso sale calculado), con fecha comprometida, y programarla con el camión `AB1234`. Probar el camión `CD5678` para ver el error de revisión técnica.
2. Como conductor (en modo celular de las DevTools): iniciar la ruta y entregar con RUT y foto.
3. Como supervisor: abrir el detalle de la OT (guía firmada e historial), el **OTIF** por mes y de todo el historial, y exportar a PDF.
4. Como administrador: crear un cliente (el RUT se formatea solo), un conductor y un producto con foto.
5. Como conductor, con un OT programada a un cliente con punto en el mapa: iniciar la ruta y aceptar el permiso de ubicación; como supervisor, abrir **Flota** y ver el camión en el mapa. (En el navegador, las DevTools permiten simular una ubicación en *Sensors*.)
6. Como operador de patio (o cambiando a **Almacenaje** como administrador): anunciar un contenedor refrigerado, registrar su llegada, moverlo y registrar su salida; abrir el detalle para ver el historial.

## Copias de seguridad

Desde `backend`, con la base encendida:

```bash
npm run backup
```

Crea un respaldo completo y lo copia a `backend/backups/` (esa carpeta no se sube a Git). Si tu contenedor no se llama `swot-sql`, define `DB_CONTAINER` en el `.env`. Para restaurar uno:

```bash
docker cp backups/ARCHIVO.bak swot-sql:/var/opt/mssql/data/ARCHIVO.bak
```

```bash
docker exec swot-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "TuClave-Segura1" -C -Q "RESTORE DATABASE swot_db FROM DISK = '/var/opt/mssql/data/ARCHIVO.bak' WITH REPLACE"
```

## Seguridad

- Contraseñas con **bcrypt**; consultas parametrizadas y procedimientos almacenados (sin SQL armado con texto del usuario).
- **Límite de intentos** de inicio de sesión: 5 fallidos cada 2 minutos por IP (no bloquea la cuenta).
- `helmet`, CORS limitado al frontend, tamaño máximo de las peticiones y validación de todos los datos de entrada.
- Permisos por rol en cada ruta, y el rol y el estado activo se leen de la base en cada petición.
- Los errores internos se registran en el servidor y no se muestran al usuario.

## API (resumen)

`POST /api/auth/login` · `/api/orders` (listar, crear, `/:id`, `/:id/schedule`, `/:id/status`, `/export/excel`, `/export/pdf`) · `/api/my-route` · `/api/customers` · `/api/vehicles` · `/api/drivers` · `/api/products` (listar, crear, editar y `/:id/active`) · `/api/otif` (`?groupBy=month|all`, `/export/pdf`) · `/api/alerts` · `/api/fleet` · `/api/my-route/position` · `/api/containers` (listar, crear, `/summary`, `/:id`, editar, `/:id/arrive`, `/:id/move`, `/:id/depart`)

Los códigos de estado y roles son en inglés en la base y la API (`Created`, `Scheduled`, `InTransit`, `Delivered`, `Failed`; `Expected`, `InYard`, `Departed`; `dispatcher`, `driver`, `admin`, `supervisor`, `yard`); las pantallas los muestran en español.

## Si ya tenías una base de datos

Para agregarle el servicio de almacenaje de contenedores (rol de patio, tablas y contenedores de prueba), ejecuta una vez desde `backend`:

```bash
node scripts/run_sql.js ../database/upgrade_add_containers.sql ../database/procedures.sql
```

Para agregar los mapas (punto de entrega de cada cliente y posición de los camiones):

```bash
node scripts/run_sql.js ../database/upgrade_add_maps.sql ../database/procedures.sql
```

### Si las tablas estaban en español

Ejecuta una sola vez (desde `backend`) la migración que renombra todo a inglés y agrega las columnas de prueba de entrega:

```bash
node scripts/run_sql.js ../database/upgrade_to_english.sql ../database/procedures.sql
```
