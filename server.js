import express from "express";
import cors from "cors";
import mysql from "mysql2";

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "sql10.freesqldatabase.com",
  user: "sql10803847",
  password: "M4VW7jWnRg",
  database: "sql10803847",
});

db.connect((err) => {
  if (err) {
    console.error("Error al conectar a MySQL:", err.message);
  } else {
    console.log("Conectado a la base de datos MySQL");
  }
});


app.get("/", (req, res) => {
  res.send("Servidor funcionando 😎");
});


app.get("/usuarios", (req, res) => {
  db.query("SELECT * FROM usuarios", (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});


app.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password)
    return res.status(400).json({ error: "Faltan datos" });

  const query = "SELECT * FROM usuarios WHERE usuario = ? AND password = ?";
  db.query(query, [usuario, password], (err, result) => {
    if (err) return res.status(500).json({ error: "Error en el servidor" });

    if (result.length > 0) {
      res.json({ mensaje: "Login exitoso", user: result[0] });
    } else {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
  });
});


app.post("/registro", (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password)
    return res.status(400).json({ error: "Faltan datos" });


  const checkQuery = "SELECT * FROM usuarios WHERE usuario = ?";
  db.query(checkQuery, [usuario], (err, result) => {
    if (err) return res.status(500).json({ error: "Error en el servidor" });

    if (result.length > 0) {
      return res.status(400).json({ error: "El usuario ya existe 🚫" });
    }

    
    const queryRegistro = "INSERT INTO registro_usuarios (usuario, password) VALUES (?, ?)";
    db.query(queryRegistro, [usuario, password], (err1) => {
      if (err1) return res.status(500).json({ error: "Error al registrar" });

      
      const queryUsuario = "INSERT INTO usuarios (usuario, password) VALUES (?, ?)";
      db.query(queryUsuario, [usuario, password], (err2, result2) => {
        if (err2) {
          console.error("Error al insertar en usuarios:", err2.message);
          return res.status(500).json({ error: "Error al registrar usuario" });
        }

        res.json({
          mensaje: "Usuario registrado con éxito",
          idUsuario: result2.insertId,
        });
      });
    });
  });
});

app.get("/tareas", (req, res) => {
  const query = `
    SELECT t.*, u.usuario 
    FROM tareas t
    LEFT JOIN usuarios u ON t.id_usuario = u.id
    ORDER BY t.fecha_creacion DESC
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error("Error al obtener tareas:", err.message);
      return res.status(500).json({ error: "Error al obtener las tareas" });
    }
    res.json(result);
  });
});



app.get("/tareas/:id_usuario", (req, res) => {
  const { id_usuario } = req.params;

  const query = `
    SELECT * FROM tareas 
    WHERE id_usuario = ? 
    ORDER BY fecha_creacion DESC
  `;

  db.query(query, [id_usuario], (err, result) => {
    if (err) {
      console.error("Error al obtener tareas del usuario:", err.message);
      return res.status(500).json({ error: "Error al obtener las tareas del usuario" });
    }

    res.json(result);
  });
});



app.post("/tareas", (req, res) => {
  const { titulo, descripcion, estado, prioridad, fecha_vencimiento, id_usuario } = req.body;

  if (!titulo || !id_usuario) {
    return res.status(400).json({ error: "El título y el id_usuario son obligatorios" });
  }

  const query = `
    INSERT INTO tareas (titulo, descripcion, estado, prioridad, fecha_vencimiento, id_usuario)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [titulo, descripcion, estado || 'pendiente', prioridad || 'media', fecha_vencimiento || null, id_usuario],
    (err, result) => {
      if (err) {
        console.error("Error al insertar tarea:", err.message);
        return res.status(500).json({ error: "Error al crear la tarea" });
      }

      res.json({
        mensaje: "Tarea creada con éxito",
        idTarea: result.insertId,
      });
    }
  );
});


app.put("/tareas/:id", (req, res) => {
  const { id } = req.params;
  const { descripcion, estado } = req.body;

  if (!descripcion && !estado) {
    return res.status(400).json({ error: "Se requiere al menos un campo para actualizar" });
  }

  const campos = [];
  const valores = [];

  if (descripcion) {
    campos.push("descripcion = ?");
    valores.push(descripcion);
  }

  if (estado) {
    campos.push("estado = ?");
    valores.push(estado);
  }

  valores.push(id);

  const query = `UPDATE tareas SET ${campos.join(", ")} WHERE id = ?`;

  db.query(query, valores, (err, result) => {
    if (err) {
      console.error("Error al actualizar tarea:", err.message);
      return res.status(500).json({ error: "Error al actualizar la tarea" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    res.json({ mensaje: "Tarea actualizada con éxito" });
  });
});


app.delete("/tareas/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM tareas WHERE id = ?";

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error al eliminar tarea:", err);
      return res.status(500).json({ error: "Error al eliminar tarea" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    res.json({ mensaje: "Tarea eliminada correctamente" });
  });
});
app.listen(3000, () => {
  console.log("🚀 Servidor corriendo en http://localhost:3000");
});
