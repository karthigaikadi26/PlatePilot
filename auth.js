/**
 * PlatePilot Client Authentication Module
 * Manages JWT tokens, session lifecycle, and dynamic navbar authentication state.
 */
(function() {
  const TOKEN_KEY = 'platepilot_token';
  const USER_KEY = 'platepilot_user';

  const PlatePilotAuth = {
    getToken() {
      try {
        return localStorage.getItem(TOKEN_KEY) || null;
      } catch {
        return null;
      }
    },

    getUser() {
      try {
        const u = localStorage.getItem(USER_KEY);
        return u ? JSON.parse(u) : null;
      } catch {
        return null;
      }
    },

    isLoggedIn() {
      return Boolean(this.getToken() && this.getUser());
    },

    setSession(token, user) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch (e) {
        console.warn('Failed to save session to localStorage', e);
      }
      this.renderNavAuth();
    },

    async register(name, email, password) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }
      this.setSession(data.token, data.user);
      return data;
    },

    async login(email, password) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Login failed');
      }
      this.setSession(data.token, data.user);
      return data;
    },

    async logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {
        // Ignore network errors on logout
      }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      this.renderNavAuth();
      if (window.PlatePilot && typeof window.PlatePilot.showToast === 'function') {
        window.PlatePilot.showToast('You have been logged out.', 'info');
      }
      // Redirect to home if on a protected page
      const path = window.location.pathname;
      if (path.includes('dashboard') || path.includes('planner')) {
        setTimeout(() => window.location.href = 'index.html', 400);
      }
    },

    // Dynamically update the header navbar on every page
    renderNavAuth() {
      const navLinks = document.querySelector('.nav-links');
      const header = document.querySelector('.site-header');
      if (!header) return;

      let authContainer = header.querySelector('.nav-auth-container');
      if (!authContainer) {
        authContainer = document.createElement('div');
        authContainer.className = 'nav-auth-container';
        authContainer.style.display = 'flex';
        authContainer.style.alignItems = 'center';
        authContainer.style.gap = '10px';
        authContainer.style.marginLeft = 'auto';

        // Insert before or after action button
        const actionBtn = header.querySelector('.site-header > .button');
        if (actionBtn) {
          header.insertBefore(authContainer, actionBtn);
        } else {
          header.appendChild(authContainer);
        }
      }

      const user = this.getUser();

      if (user && this.isLoggedIn()) {
        const firstName = user.name ? user.name.split(' ')[0] : 'Student';
        authContainer.innerHTML = `
          <div class="user-badge" style="display:inline-flex;align-items:center;gap:6px;background:var(--mint);padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;color:var(--green)">
            <span>👤</span>
            <span class="user-badge-name">${escapeHTML(firstName)}</span>
          </div>
          <button class="button button-small button-outline nav-logout-btn" style="padding:6px 12px;font-size:11px">Logout</button>
        `;

        const logoutBtn = authContainer.querySelector('.nav-logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
          });
        }
      } else {
        authContainer.innerHTML = `
          <a href="login.html" class="text-link" style="font-size:12px;padding:6px 8px">Log in</a>
          <a href="register.html" class="button button-small button-outline" style="padding:6px 12px;font-size:11px">Sign up</a>
        `;
      }
    }
  };

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  document.addEventListener('DOMContentLoaded', () => {
    PlatePilotAuth.renderNavAuth();
  });

  window.PlatePilotAuth = PlatePilotAuth;
})();
