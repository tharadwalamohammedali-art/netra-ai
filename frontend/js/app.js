import { api } from './api.js';
import { renderDashboard } from './views/dashboard.js';
import { renderUrlScanner } from './views/urlScanner.js';
import { renderMessageScanner } from './views/messageScanner.js';
import { renderQrScanner } from './views/qrScanner.js';
import { renderContainment } from './views/containment.js';
import { renderHistory } from './views/history.js';
import { renderPrivacy } from './views/privacy.js';
import { renderAudit } from './views/audit.js';
import { renderDocs } from './views/docs.js';

class NetraRouter {
  constructor() {
    this.routes = {
      dashboard: renderDashboard,
      'url-scanner': renderUrlScanner,
      'message-scanner': renderMessageScanner,
      'qr-scanner': renderQrScanner,
      containment: renderContainment,
      history: renderHistory,
      privacy: renderPrivacy,
      audit: renderAudit,
      docs: renderDocs
    };
    this.currentRoute = 'dashboard';
  }

  navigate(route) {
    if (!this.routes[route]) {
      route = 'dashboard';
    }
    this.currentRoute = route;

    // Update nav item active states
    document.querySelectorAll('.nav-item').forEach((item) => {
      if (item.getAttribute('data-route') === route) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const container = document.getElementById('content-area');
    const headerTitle = document.getElementById('current-view-title');

    const TITLES = {
      dashboard: 'Security Dashboard',
      'url-scanner': 'Smart URL & Phishing Scanner',
      'message-scanner': 'Message & Email Scam Scanner',
      'qr-scanner': 'Payment QR Code Scanner',
      containment: 'Scam Containment Safety Gate',
      history: 'Scan History & Reports',
      privacy: 'Privacy & Permission Center',
      audit: 'Security Audit Logs',
      docs: 'Documentation & Architecture'
    };
    if (headerTitle) {
      headerTitle.textContent = TITLES[route] || 'NETRA AI';
    }

    // Render target view
    container.innerHTML = '';
    this.routes[route](container);

    // Close mobile sidebar if open
    document.getElementById('sidebar')?.classList.remove('open');
  }
}

export const router = new NetraRouter();
window.netraRouter = router;

// Authentication Modal Manager
class AuthManager {
  constructor() {
    this.currentUser = null;
  }

  async init() {
    // Check system health
    try {
      const health = await api.getHealth();
      const dot = document.getElementById('health-dot');
      const text = document.getElementById('health-text');
      if (dot && text) {
        text.textContent = health.local_gemma_runtime.includes('connected') ? 'Gemma 3:1B Live' : 'Gemma 3:1B Active';
      }
    } catch {
      // offline
    }

    // Check token
    if (api.getToken()) {
      try {
        const me = await api.getMe();
        this.setUser(me.user);
        router.navigate('dashboard');
        return;
      } catch {
        api.setToken(null);
      }
    }

    // If not logged in, auto-seed or show login modal
    this.showAuthModal();
  }

  setUser(user) {
    this.currentUser = user;
    const emailEl = document.getElementById('user-email-display');
    const roleEl = document.getElementById('user-role-display');
    if (emailEl) emailEl.textContent = user.email;
    if (roleEl) roleEl.textContent = `${user.role.toUpperCase()} SESSION`;
    document.getElementById('auth-modal').style.display = 'none';
  }

  showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
  }

  async logout() {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    api.setToken(null);
    window.location.reload();
  }
}

export const auth = new AuthManager();

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Mobile sidebar toggle
  const mobileBtn = document.getElementById('btn-mobile-menu');
  const sidebar = document.getElementById('sidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Navigation clicks
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const route = item.getAttribute('data-route');
      router.navigate(route);
    });
  });

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    auth.logout();
  });

  // Auth Modal Forms
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const toggleSignupBtn = document.getElementById('btn-show-signup');
  const toggleLoginBtn = document.getElementById('btn-show-login');
  const quickDemoBtn = document.getElementById('btn-quick-demo');

  if (toggleSignupBtn && toggleLoginBtn) {
    toggleSignupBtn.addEventListener('click', () => {
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
    });
    toggleLoginBtn.addEventListener('click', () => {
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
    });
  }

  // Quick Demo Account Creator
  if (quickDemoBtn) {
    quickDemoBtn.addEventListener('click', async () => {
      const demoEmail = `analyst_${Math.floor(1000 + Math.random() * 9000)}@netra.local`;
      const demoPass = 'NetraSec2026!';
      try {
        const res = await api.signup(demoEmail, demoPass);
        api.setToken(res.token);
        auth.setUser(res.user);
        router.navigate('dashboard');
      } catch (err) {
        alert(`Demo creation failed: ${err.message}`);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const pass = document.getElementById('login-password').value;
      try {
        const res = await api.login(email, pass);
        api.setToken(res.token);
        auth.setUser(res.user);
        router.navigate('dashboard');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value.trim();
      const pass = document.getElementById('signup-password').value;
      try {
        const res = await api.signup(email, pass);
        api.setToken(res.token);
        auth.setUser(res.user);
        router.navigate('dashboard');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  auth.init();
});
