const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Access denied. No authorization header provided.' });
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Access denied. Invalid token format (use Bearer <token>).' });
    }

    const token = tokenParts[1];
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'codedrop_admin_secret_2024');

    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admin role required.' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
};
