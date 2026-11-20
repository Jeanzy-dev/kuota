# Kuota — Aplicación Web de Asistencia Financiera, Presupuesto Dinámico y Proyección de Metas

Implementación Full-Stack lista para producción de la **Especificación de Arquitectura y Producto (SRS)**.

## 1. Arquitectura y Stack Tecnológico (Sección 4 del SRS)

- **Frontend (SPA)**: React 18 + Vite + TypeScript + Tailwind CSS + Recharts + Lucide Icons.
- **Backend / API**: Node.js + Express + TypeScript con validación de esquemas vía **Zod**.
- **Motor Matemático Financiero (`src/shared/financialEngine.ts`)**: Alta precisión decimal con `decimal.js` y columnas `DECIMAL(12,2)` en PostgreSQL para evitar errores de redondeo de punto flotante.
- **Base de Datos**: PostgreSQL (`prisma/schema.prisma` + migración SQL nativa en `prisma/migrations/20260101000000_init/migration.sql`). Incluye soporte automático para Render Managed PostgreSQL (`DATABASE_URL`) y motor PostgreSQL embebido persistente (`@electric-sql/pglite` en `./.pgdata`) para ejecución local autónoma sin requerir contenedores externos.
- **Autenticación**: Registro e inicio de sesión con `bcryptjs` + JWT enviado tanto en Cookie `HTTP-Only` como token `Bearer`.

## 2. Fórmulas Matemáticas Implementadas (Sección 3 del SRS)

1. **Ingreso Neto Disponible (`IND`)**: `Ingreso del Ciclo − Total Gastos Obligatorios del Ciclo` (normalizados desde frecuencia quincenal, mensual o única a base diaria y al ciclo).
2. **Días Totales de la Meta (`DTM`)**: `Semanas × 7` | `Meses × 30` | `Días × 1`.
3. **Ahorro Diario Requerido (`ADR`)**: `Precio de la Meta / DTM`.
4. **Ahorro Requerido por Ciclo**: `ADR × Días del Ciclo` (`15` para quincenal, `30` para mensual).
5. **Presupuesto de Gasto Libre por Ciclo (`PGL`)**: `IND − Ahorro Requerido por Ciclo`.
6. **Topes de Gasto Libre Sugeridos**:
   - **Tope Mensual**: `PGL_mensual`
   - **Tope Semanal**: `PGL_mensual / 4.33` (y referencia `PGL_diario × 7`)
   - **Tope por Fin de Semana**: Configurable (por defecto `55%`, rango `50%–60%` del presupuesto semanal libre).
7. **Alerta de Viabilidad**: Si `Ahorro Requerido por Ciclo > IND`, advierte inmediatamente y calcula el plazo mínimo realista en días, semanas y meses.
8. **Checklist y Desviación Temporal (`Δt`)**:
   - `Acumulado Real Ahorrado (ARA) = Ahorro Programado Transcurrido + Ahorros Extra − Excesos de Gasto`
   - `Saldo Restante para la Meta (SRM) = Precio de la Meta − ARA`
   - `Días Reales Restantes Estimados = SRM / ADR`
   - `Variación en Días (Δt) = Días Restantes Originales − Días Reales Restantes Estimados`

## 3. Comandos de Ejecución y Despliegue en Render (Sección 7 del SRS)

```bash
# Instalar dependencias
npm install

# Ejecutar pruebas matemáticas y validación E2E (Sección 7.4)
npm test

# Compilar Frontend y Backend para producción
npm run build

# Iniciar servidor en producción (sirve API y SPA en PORT)
npm start

# Desarrollo simultáneo (Backend + Vite HMR)
npm run dev
```

### Variables de Entorno para Render (`render.yaml` / `.env.example`)
- `PORT`: Puerto del servicio web (ej. `3000` o `10000` en Render).
- `DATABASE_URL`: Cadena de conexión a PostgreSQL (`postgresql://...`).
- `JWT_SECRET`: Clave secreta para firma de sesiones JWT.
- `FRONTEND_URL`: URL permitida en la configuración estricta de CORS.
- `NODE_ENV=production`
