import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
// Helpers para __dirname (no está disponible en ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });
app.get('/', (req, res) => {
  res.send('API de conversión de imágenes. Usa POST /convert para convertir imágenes a JPG.');
});
app.post('/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const inputPath = req.file.path;
    const outputPath = `${inputPath}.jpg`;

    // Convertir a JPG
    await sharp(inputPath)
      .jpeg()
      .toFile(outputPath);

    // Leer archivo convertido como base64
    const fileBuffer = await fs.readFile(outputPath);
    const base64Image = fileBuffer.toString('base64');

    // Enviar JSON con info
    res.json({
      filename: `${req.file.originalname.split('.')[0]}.jpg`,
      mimetype: 'image/jpeg',
      base64: base64Image
    });

    // Dar tiempo al sistema antes de borrar
    setTimeout(async () => {
      try {
        await fs.unlink(inputPath);
        await fs.unlink(outputPath);
      } catch (err) {
        console.warn('No se pudo borrar algún archivo:', err);
      }
    }, 500);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error al convertir la imagen');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // cada 5 minutos
const FILE_TTL_MS = 2 * 60 * 1000; // tiempo de vida máximo: 5 minutos

const cleanOldFiles = async () => {
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = await fs.readdir(uploadsDir);
  if (files.length === 0) {
    return;
  }
  try {
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > FILE_TTL_MS) {
        await fs.unlink(filePath);
        console.log(`Archivo eliminado por antigüedad: ${file}`);
      }
    }
  } catch (err) {
    console.error('Error al limpiar archivos antiguos:', err);
  }
};

// Ejecutar limpieza periódicamente
setInterval(cleanOldFiles, CLEANUP_INTERVAL_MS);


