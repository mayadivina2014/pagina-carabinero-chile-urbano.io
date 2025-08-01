function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Acceso no autorizado. Por favor, inicia sesión.' });
}

function ensureRole(requiredRoles) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'No autenticado. Inicia sesión para acceder.' });
        }

        const user = req.user;

        const hasRequiredRole = user.appRoles && requiredRoles.some(role => user.appRoles.includes(role));

        if (hasRequiredRole) {
            next();
        } else {
            res.status(403).json({ message: 'No tienes los permisos necesarios para acceder a esta función.' });
        }
    };
}

module.exports = {
  ensureAuthenticated,
  ensureRole
};