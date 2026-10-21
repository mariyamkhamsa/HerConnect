// Light client-side checks for the account forms. The server repeats and enforces every rule.

// Same idea as <input type="email">: something@something.tld, no spaces.
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim())
}

// Returns an error message, or '' when the new password is acceptable.
export function checkNewPassword(newPassword, confirmPassword, currentPassword) {
  const pw = String(newPassword || '')
  if (pw.length < 8) return 'New password must be at least 8 characters.'
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'New password must contain at least one letter and one number.'
  if (pw !== String(confirmPassword || '')) return 'New password and confirmation do not match.'
  if (currentPassword !== undefined && pw === String(currentPassword)) return 'New password must be different from your current password.'
  return ''
}
