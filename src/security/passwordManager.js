/** Client-side password policy validation; Firebase Authentication owns credentials. */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8 || /^\s|\s$/.test(password)) return false;
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

export default { validatePassword };