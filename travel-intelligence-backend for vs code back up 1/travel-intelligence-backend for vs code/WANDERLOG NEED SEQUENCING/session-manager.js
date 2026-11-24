/**
 * TripNest Session Manager
 * Handles user authentication, tokens, and session state
 */

class SessionManager {
    constructor(apiBase = 'http://127.0.0.1:8000') {
        this.apiBase = apiBase;
        this.token = localStorage.getItem('token');
        this.user = this.parseUser(localStorage.getItem('user'));
    }

    parseUser(userStr) {
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    }

    isLoggedIn() {
        return !!this.token && !!this.user;
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    async setToken(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    async verifyToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(`${this.apiBase}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.token })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.user = data.user;
                    return true;
                }
            }

            // Token invalid, clear session
            this.clearSession();
            return false;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }

    async logout() {
        if (!this.token) return;

        try {
            await fetch(`${this.apiBase}/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.token })
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearSession();
        }
    }

    clearSession() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    redirectToLogin() {
        window.location.href = 'login.html';
    }

    redirectToDashboard() {
        window.location.href = 'home.html';
    }
}

// Global session manager instance
const session = new SessionManager();

// Auto-redirect if not logged in
function requireLogin() {
    if (!session.isLoggedIn()) {
        session.redirectToLogin();
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionManager, session, requireLogin };
}
