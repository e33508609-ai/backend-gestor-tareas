import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ["http://localhost:5173", "https://gestor-tareas-chi-six.vercel.app/"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// ─────────────────────────────────────────────
// BASE DE DATOS
// ─────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  port:               Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit:    10,
});

const db = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

// ─────────────────────────────────────────────
// HELPER — evita repetir try/catch en cada ruta
// ─────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ servidor: "funcionando", status: "ok" });
});

// ═════════════════════════════════════════════
// USUARIOS
// ═════════════════════════════════════════════

// GET /usuarios
app.get("/usuarios", asyncHandler(async (req, res) => {
  const usuarios = await db("SELECT id, usuario, created_at FROM usuarios");
  res.json(usuarios);
}));

// POST /registro
// Body: { usuario, password }
app.post("/registro", asyncHandler(async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password)
    return res.status(400).json({ error: "Faltan datos" });

  const existe = await db("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);
  if (existe.length)
    return res.status(400).json({ error: "El usuario ya existe" });

  const result = await db(
    "INSERT INTO usuarios (usuario, password) VALUES (?, ?)",
    [usuario, password]
  );

  res.json({ mensaje: "Usuario registrado con éxito", idUsuario: result.insertId });
}));

// POST /login
// Body: { usuario, password }
app.post("/login", asyncHandler(async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password)
    return res.status(400).json({ error: "Faltan datos" });

  const [user] = await db(
    "SELECT id, usuario FROM usuarios WHERE usuario = ? AND password = ?",
    [usuario, password]
  );

  if (!user)
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  res.json({ mensaje: "Login exitoso", user });
}));

// ═════════════════════════════════════════════
// TAREAS
// ═════════════════════════════════════════════

// GET /tareas  — todas las tareas con nombre de usuario
app.get("/tareas", asyncHandler(async (req, res) => {
  const tareas = await db(`
    SELECT t.*, u.usuario
    FROM tareas t
    LEFT JOIN usuarios u ON t.id_usuario = u.id
    ORDER BY t.fecha_creacion DESC
  `);
  res.json(tareas);
}));

// GET /tareas/:id_usuario  — tareas de un usuario específico
app.get("/tareas/:id_usuario", asyncHandler(async (req, res) => {
  const tareas = await db(
    "SELECT * FROM tareas WHERE id_usuario = ? ORDER BY fecha_creacion DESC",
    [req.params.id_usuario]
  );
  res.json(tareas);
}));

// POST /tareas
// Body: { titulo, id_usuario, descripcion?, estado?, prioridad?, fecha_vencimiento? }
app.post("/tareas", asyncHandler(async (req, res) => {
  const { titulo, descripcion, estado, prioridad, fecha_vencimiento, id_usuario } = req.body;

  if (!titulo || !id_usuario)
    return res.status(400).json({ error: "El título y el id_usuario son obligatorios" });

  const result = await db(
    `INSERT INTO tareas (titulo, descripcion, estado, prioridad, fecha_vencimiento, id_usuario)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [titulo, descripcion || null, estado || "pendiente",
     prioridad || "media", fecha_vencimiento || null, id_usuario]
  );

  res.json({ mensaje: "Tarea creada con éxito", idTarea: result.insertId });
}));

// PUT /tareas/:id
// Body: { descripcion?, estado? }
app.put("/tareas/:id", asyncHandler(async (req, res) => {
  const { descripcion, estado } = req.body;

  if (!descripcion && !estado)
    return res.status(400).json({ error: "Se requiere al menos un campo para actualizar" });

  const campos = [];
  const valores = [];

  if (descripcion) { campos.push("descripcion = ?"); valores.push(descripcion); }
  if (estado)      { campos.push("estado = ?");      valores.push(estado); }

  valores.push(req.params.id);

  const result = await db(
    `UPDATE tareas SET ${campos.join(", ")} WHERE id = ?`,
    valores
  );

  if (result.affectedRows === 0)
    return res.status(404).json({ error: "Tarea no encontrada" });

  res.json({ mensaje: "Tarea actualizada con éxito" });
}));

// DELETE /tareas/:id
app.delete("/tareas/:id", asyncHandler(async (req, res) => {
  const result = await db("DELETE FROM tareas WHERE id = ?", [req.params.id]);

  if (result.affectedRows === 0)
    return res.status(404).json({ error: "Tarea no encontrada" });

  res.json({ mensaje: "Tarea eliminada correctamente" });
}));

// ─────────────────────────────────────────────
// 404 Y MANEJADOR GLOBAL DE ERRORES
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no existe` });
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}]`, err.message);
  res.status(500).json({ error: "Error interno del servidor" });
});

// ─────────────────────────────────────────────
// ARRANQUE CON VERIFICACIÓN DE DB
// ─────────────────────────────────────────────
const start = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✓ Conectado a MySQL");
    app.listen(PORT, () => {
      console.log(`✓ Servidor en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("✗ No se pudo conectar a MySQL:", err.message);
    process.exit(1);
  }
};

start();