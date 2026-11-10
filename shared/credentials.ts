export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/
export function normalizeUsername(value: string) { return value.trim().toLowerCase() }
export function validUsername(value: string) { return usernamePattern.test(value) }
export function validNewPassword(value: string) { return value.length >= 8 && new TextEncoder().encode(value).length <= 72 }
