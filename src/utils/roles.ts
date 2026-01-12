export const normalizeRole = (role?: string | null) => {
  if (!role) return '';
  const value = role
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (value === 'administrador') return 'admin';
  if (value === 'admin') return 'admin';
  if (value === 'financeiro') return 'financeiro';
  if (value === 'usuario') return 'usuario';
  return value;
};

export const getRoleLabel = (role?: string | null) => {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return 'Administrador';
  if (normalized === 'financeiro') return 'Financeiro';
  if (normalized === 'usuario') return 'Usuario';
  return role ? role.toString() : '';
};
