require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, pesan: 'Token tidak ditemukan. Silakan login.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, pesan: 'Token tidak valid atau sudah kadaluarsa.' });
  }
}

function guruOnly(req, res, next) {
  if (req.user.role !== 'guru') {
    return res.status(403).json({ success: false, pesan: 'Akses ditolak. Hanya guru yang bisa melakukan ini.' });
  }
  next();
}

function muridOnly(req, res, next) {
  if (req.user.role !== 'murid') {
    return res.status(403).json({ success: false, pesan: 'Akses ditolak. Hanya murid yang bisa melakukan ini.' });
  }
  next();
}

module.exports = { authMiddleware, guruOnly, muridOnly, JWT_SECRET };
