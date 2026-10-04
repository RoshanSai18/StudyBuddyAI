// The designs ship a demo account and the backend has no auth (out of MVP scope), so sign-in is a client-side gate.
const KEY = 'quillo-auth'

export const DEMO_EMAIL = 'cognitivecrew@gmail.com'
export const DEMO_PASSWORD = 'password@123'

export function isAuthed() {
  try {
    return localStorage.getItem(KEY) === '1' || sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function signIn(keep) {
  try {
    ;(keep ? localStorage : sessionStorage).setItem(KEY, '1')
  } catch {
    /* storage unavailable: the user just has to sign in again */
  }
}

export function signOut() {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
