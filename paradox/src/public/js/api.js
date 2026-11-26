// ==============================================================================
// PARADOX — Client-Side API Communication Vault
// ==============================================================================

const API = (function () {
  const TOKEN_KEY = 'paradox_token';
  const USER_KEY = 'paradox_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getCurrentUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && token) {
          clearSession();
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        const errorMsg = data?.error?.message || data?.message || `HTTP error ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  }

  return {
    // Session state
    getToken,
    setSession,
    clearSession,
    getCurrentUser,

    // Auth
    async login(email, password) {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      if (res.token && res.user) {
        setSession(res.token, res.user);
      }
      return res;
    },

    async register(userData) {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: userData
      });
      if (res.token && res.user) {
        setSession(res.token, res.user);
      }
      return res;
    },

    async getMe() {
      const res = await request('/api/auth/me');
      if (res.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      }
      return res;
    },

    async updateProfile(profileData) {
      const res = await request('/api/auth/profile', {
        method: 'PUT',
        body: profileData
      });
      if (res.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      }
      return res;
    },

    async recoverPassword(email) {
      return request('/api/auth/recover', {
        method: 'POST',
        body: { email }
      });
    },

    async demoSwitch(targetRole) {
      const res = await request('/api/auth/demo-switch', {
        method: 'POST',
        body: { targetRole }
      });
      if (res.token && res.user) {
        setSession(res.token, res.user);
      }
      return res;
    },

    logout() {
      clearSession();
    },

    // Startups
    async getStartups(params = {}) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          query.append(k, v);
        }
      });
      const qStr = query.toString();
      return request(`/api/startups${qStr ? '?' + qStr : ''}`);
    },

    async getStartupById(id) {
      return request(`/api/startups/${id}`);
    },

    async createStartup(proposalData) {
      return request('/api/startups', {
        method: 'POST',
        body: proposalData
      });
    },

    async updateStartup(id, data) {
      return request(`/api/startups/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    async deleteStartup(id) {
      return request(`/api/startups/${id}`, {
        method: 'DELETE'
      });
    },

    // Investment & Portfolio
    async getInterests() {
      return request('/api/investments/interests');
    },

    async createInterest(data) {
      return request('/api/investments/interests', {
        method: 'POST',
        body: data
      });
    },

    async updateInterestStatus(interestId, status, responseNote) {
      return request(`/api/investments/interests/${interestId}/status`, {
        method: 'PUT',
        body: { status, responseNote }
      });
    },

    async getSavedStartups() {
      return request('/api/investments/saved');
    },

    async toggleSaveStartup(startupId, notes) {
      return request('/api/investments/saved', {
        method: 'POST',
        body: { startupId, notes }
      });
    },

    // KYC
    async getKYCStatus() {
      return request('/api/kyc/status');
    },

    async submitKYC(kycData) {
      return request('/api/kyc/submit', {
        method: 'POST',
        body: kycData
      });
    },

    async reviewKYC(kycId, status, rejectionReason) {
      return request(`/api/kyc/review/${kycId}`, {
        method: 'PUT',
        body: { status, rejectionReason }
      });
    },

    // Messaging
    async getConversations() {
      return request('/api/messages/conversations');
    },

    async getThreadMessages(conversationId) {
      return request(`/api/messages/thread/${conversationId}`);
    },

    async sendMessage(data) {
      return request('/api/messages/send', {
        method: 'POST',
        body: data
      });
    },

    // Notifications
    async getNotifications() {
      return request('/api/notifications');
    },

    async markNotificationRead(notifId) {
      return request(`/api/notifications/${notifId}/read`, {
        method: 'PUT'
      });
    },

    // Admin
    async getAdminStats() {
      return request('/api/admin/stats');
    },

    async getAdminUsers(params = {}) {
      const query = new URLSearchParams(params).toString();
      return request(`/api/admin/users${query ? '?' + query : ''}`);
    },

    async getPendingKYC() {
      return request('/api/admin/kyc/pending');
    },

    async reviewStartupByAdmin(startupId, status, adminFeedback) {
      return request(`/api/admin/startups/${startupId}/review`, {
        method: 'PUT',
        body: { status, adminFeedback }
      });
    }
  };
})();
