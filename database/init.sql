
USE swot_db;
GO

-- 1. Tabla Usuario (Roles: despachador y conductor)
CREATE TABLE usuario (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) CHECK (rol IN ('despachador', 'conductor')) NOT NULL
);

-- 2. Tabla Cliente
CREATE TABLE cliente (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    rut VARCHAR(20) NOT NULL
);

-- 3. Tabla Vehículo
CREATE TABLE vehiculo (
    id INT IDENTITY(1,1) PRIMARY KEY,
    patente VARCHAR(10) UNIQUE NOT NULL,
    capacidad_kg DECIMAL(10,2) NOT NULL,
    vencimiento_rt DATE NOT NULL
);

-- 4. Tabla Orden de Transporte (Flujo: Creada -> Programada -> En ruta -> Entregada o Fallida)
CREATE TABLE orden_transporte (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id INT FOREIGN KEY REFERENCES cliente(id),
    vehiculo_id INT NULL FOREIGN KEY REFERENCES vehiculo(id),
    usuario_conductor_id INT NULL FOREIGN KEY REFERENCES usuario(id),
    estado VARCHAR(20) DEFAULT 'Creada' CHECK (estado IN ('Creada', 'Programada', 'En ruta', 'Entregada', 'Fallida')),
    peso_kg DECIMAL(10,2) NOT NULL,
    fecha_creacion DATETIME DEFAULT GETDATE()
);

-- 5. Tabla Historial de OT
CREATE TABLE ot_historial (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ot_id INT FOREIGN KEY REFERENCES orden_transporte(id),
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    fecha_cambio DATETIME DEFAULT GETDATE(),
    usuario_id INT FOREIGN KEY REFERENCES usuario(id)
);
GO

-- DATOS DE PRUEBA
INSERT INTO usuario (nombre, email, password_hash, rol) VALUES 
('Admin Despachos', 'despachador@swot.cl', 'hash_simulado_123', 'despachador'),
('Juan Conductor', 'conductor@swot.cl', 'hash_simulado_123', 'conductor');

INSERT INTO cliente (nombre, direccion, rut) VALUES 
('Empresa Alpha', 'Av. Siempre Viva 742', '76.123.456-7'),
('Comercial Beta', 'Calle Falsa 123', '77.987.654-3');

INSERT INTO vehiculo (patente, capacidad_kg, vencimiento_rt) VALUES 
('AB1234', 5000.00, '2027-12-31'),
('CD5678', 3000.00, '2023-01-01'); -- Vehículo con RT vencida para pruebas futuras

INSERT INTO orden_transporte (cliente_id, peso_kg) VALUES 
(1, 1500.50),
(2, 450.00);
GO