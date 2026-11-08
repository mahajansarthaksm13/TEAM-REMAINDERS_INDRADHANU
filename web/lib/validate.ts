// Form validation shared by the client, matching what the API routes accept.
// Tests: tests/validate.test.mjs

// Same normalisation as POST /api/admin/invite: trim, lowercase.
export const normalizeEmail = (raw: string) => raw.trim().toLowerCase()

// Same shape check as the invite API.
export const isEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
