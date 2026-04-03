/**
 * @deprecated Use the dedicated sub-routes instead:
 *   POST /api/auth/login   — login
 *   GET  /api/auth/logout  — logout
 *   POST /api/auth/register — register
 *
 * This file is kept for backward-compatibility only.
 */
export { POST } from './login/route';
export { GET } from './logout/route';
