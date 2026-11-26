// ==============================================================================
// PARADOX — Web Application Controller & Reactive UI Engine
// Where Vision Meets Capital
// ==============================================================================

const App = (function () {
  // Application State
  const state = {
    theme: localStorage.getItem('paradox_theme') || 'dark',
    currentRoute: 'landing',
    currentUser: null,
    startups: [],
    savedStartups: [],
    interests: [],
    conversations: [],
    activeConversationId: null,
    messages: [],
    notifications: [],
    adminStats: null,
    adminUsers: [],
    adminPendingKYC: [],
    filters: {
      search: '',
      sector: 'All',
      stage: 'All'
    }
  };

  // Helper formatting functions
  function formatINR(val) {
    if (val === undefined || val === null) return '₹0';
    const num = Number(val);
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)} Lakh`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠';

    toast.innerHTML = `<span style="font-weight: bold;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ----------------------------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------------------------
  async function init() {
    // Apply saved theme (Black & Gold or White & Navy Blue)
    state.theme = localStorage.getItem('paradox_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);

    state.currentUser = API.getCurrentUser();

    // Verify session with server if token exists
    if (API.getToken()) {
      try {
        const me = await API.getMe();
        state.currentUser = me.user;
      } catch (err) {
        state.currentUser = null;
        API.clearSession();
      }
    }

    // Determine initial route from URL hash or default
    const hash = window.location.hash.replace('#', '') || 'landing';
    navigate(hash);

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.replace('#', '') || 'landing';
      navigate(newHash);
    });

    // Global session expired handler
    window.addEventListener('auth:expired', () => {
      state.currentUser = null;
      renderHeader();
      showToast('Your session has expired. Please log in again.', 'error');
      navigate('login');
    });

    renderDemoBar();
  }

  function navigate(route) {
    // Role protection
    if (route.startsWith('investor-') && (!state.currentUser || state.currentUser.role !== 'investor')) {
      showToast('Please sign in with an Investor account to access this portal', 'info');
      return navigate('login');
    }
    if (route.startsWith('entrepreneur-') && (!state.currentUser || state.currentUser.role !== 'entrepreneur')) {
      showToast('Please sign in with an Entrepreneur account to access this portal', 'info');
      return navigate('login');
    }
    if (route.startsWith('admin-') && (!state.currentUser || state.currentUser.role !== 'admin')) {
      showToast('Administrator privileges required', 'error');
      return navigate('login');
    }

    state.currentRoute = route;
    window.location.hash = route;
    renderHeader();
    renderRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ----------------------------------------------------------------------------
  // THEME ENGINE (Dark: Black & Gold | Light: White & Navy Blue)
  // ----------------------------------------------------------------------------
  function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    state.theme = nextTheme;
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('paradox_theme', nextTheme);
    renderDemoBar();
    renderHeader();
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark Theme (Black & Gold)' : 'Light Theme (White & Navy Blue)'}`, 'info');
  }

  // ----------------------------------------------------------------------------
  // HEADER & TOP BARS
  // ----------------------------------------------------------------------------
  function renderDemoBar() {
    const bar = document.getElementById('demo-bar');
    if (!bar) return;

    const isDark = state.theme === 'dark';

    bar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="demo-bar-badge">Live Enterprise Sandbox</span>
        <span style="font-size: 11.5px; color: var(--text-muted);">Quick Role Switcher:</span>
      </div>
      <div class="demo-bar-actions">
        <button class="demo-pill ${state.currentUser?.role === 'investor' ? 'active' : ''}" onclick="App.switchDemoRole('investor')">
          Investor Demo (Vikramaditya)
        </button>
        <button class="demo-pill ${state.currentUser?.role === 'entrepreneur' ? 'active' : ''}" onclick="App.switchDemoRole('entrepreneur')">
          Entrepreneur Demo (Dr. Patel)
        </button>
        <button class="demo-pill ${state.currentUser?.role === 'admin' ? 'active' : ''}" onclick="App.switchDemoRole('admin')">
          Admin Desk (Evelyn)
        </button>
        <button class="theme-toggle-btn" onclick="App.toggleTheme()" title="Switch between Black & Gold and White & Navy">
          ${isDark ? '☀️ Light (Navy)' : '🌙 Dark (Gold)'}
        </button>
      </div>
    `;
  }

  function renderHeader() {
    const user = state.currentUser;
    const headerEl = document.getElementById('site-header');
    if (!headerEl) return;

    const isDark = state.theme === 'dark';
    const themeBtnHtml = `
      <button class="theme-toggle-btn" onclick="App.toggleTheme()" title="Switch between Black & Gold and White & Navy">
        ${isDark ? '☀️ Light' : '🌙 Dark'}
      </button>
    `;

    let navHtml = '';

    if (!user) {
      navHtml = `
        <ul class="nav-links">
          <li><a class="nav-link ${state.currentRoute === 'landing' ? 'active' : ''}" onclick="App.navigate('landing')">Home</a></li>
          <li><a class="nav-link ${state.currentRoute === 'opportunities' ? 'active' : ''}" onclick="App.navigate('opportunities')">Discover Ventures</a></li>
          <li><a class="nav-link ${state.currentRoute === 'how-it-works' ? 'active' : ''}" onclick="App.navigate('how-it-works')">How It Works</a></li>
          <li><a class="nav-link ${state.currentRoute === 'about' ? 'active' : ''}" onclick="App.navigate('about')">About</a></li>
        </ul>
        <div class="header-actions">
          ${themeBtnHtml}
          <button class="btn btn-outline btn-sm" onclick="App.navigate('login')">Sign In</button>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('register-investor')">Join Ecosystem</button>
        </div>
      `;
    } else if (user.role === 'investor') {
      navHtml = `
        <ul class="nav-links">
          <li><a class="nav-link ${state.currentRoute === 'investor-overview' ? 'active' : ''}" onclick="App.navigate('investor-overview')">Dashboard</a></li>
          <li><a class="nav-link ${state.currentRoute === 'investor-discover' ? 'active' : ''}" onclick="App.navigate('investor-discover')">Explore Ventures</a></li>
          <li><a class="nav-link ${state.currentRoute === 'investor-saved' ? 'active' : ''}" onclick="App.navigate('investor-saved')">Watchlist</a></li>
          <li><a class="nav-link ${state.currentRoute === 'investor-investments' ? 'active' : ''}" onclick="App.navigate('investor-investments')">Deal Pipeline</a></li>
          <li><a class="nav-link ${state.currentRoute === 'investor-messages' ? 'active' : ''}" onclick="App.navigate('investor-messages')">Messages</a></li>
        </ul>
        <div class="header-actions">
          ${themeBtnHtml}
          <div class="user-chip" onclick="App.navigate('investor-profile')">
            <div class="user-chip-avatar">${user.full_name.charAt(0)}</div>
            <div class="user-chip-name">${user.full_name}</div>
            <div class="user-chip-role">Investor</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="App.logout()">Exit</button>
        </div>
      `;
    } else if (user.role === 'entrepreneur') {
      navHtml = `
        <ul class="nav-links">
          <li><a class="nav-link ${state.currentRoute === 'entrepreneur-overview' ? 'active' : ''}" onclick="App.navigate('entrepreneur-overview')">Overview</a></li>
          <li><a class="nav-link ${state.currentRoute === 'entrepreneur-projects' ? 'active' : ''}" onclick="App.navigate('entrepreneur-projects')">My Ventures</a></li>
          <li><a class="nav-link ${state.currentRoute === 'entrepreneur-create' ? 'active' : ''}" onclick="App.navigate('entrepreneur-create')">+ New Proposal</a></li>
          <li><a class="nav-link ${state.currentRoute === 'entrepreneur-interests' ? 'active' : ''}" onclick="App.navigate('entrepreneur-interests')">Investor Inquiries</a></li>
          <li><a class="nav-link ${state.currentRoute === 'entrepreneur-messages' ? 'active' : ''}" onclick="App.navigate('entrepreneur-messages')">Messages</a></li>
        </ul>
        <div class="header-actions">
          ${themeBtnHtml}
          <div class="user-chip" onclick="App.navigate('entrepreneur-profile')">
            <div class="user-chip-avatar">${user.full_name.charAt(0)}</div>
            <div class="user-chip-name">${user.full_name}</div>
            <div class="user-chip-role">Founder</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="App.logout()">Exit</button>
        </div>
      `;
    } else if (user.role === 'admin') {
      navHtml = `
        <ul class="nav-links">
          <li><a class="nav-link ${state.currentRoute === 'admin-overview' ? 'active' : ''}" onclick="App.navigate('admin-overview')">Platform Overview</a></li>
          <li><a class="nav-link ${state.currentRoute === 'admin-startups' ? 'active' : ''}" onclick="App.navigate('admin-startups')">Venture Approvals</a></li>
          <li><a class="nav-link ${state.currentRoute === 'admin-kyc' ? 'active' : ''}" onclick="App.navigate('admin-kyc')">KYC Desk</a></li>
          <li><a class="nav-link ${state.currentRoute === 'admin-users' ? 'active' : ''}" onclick="App.navigate('admin-users')">Directory</a></li>
        </ul>
        <div class="header-actions">
          ${themeBtnHtml}
          <div class="user-chip" onclick="App.navigate('admin-overview')">
            <div class="user-chip-avatar">★</div>
            <div class="user-chip-name">${user.full_name}</div>
            <div class="user-chip-role" style="color: #ef4444; background: rgba(239, 68, 68, 0.1);">Admin</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="App.logout()">Exit</button>
        </div>
      `;
    }

    headerEl.innerHTML = `
      <div class="brand-container" onclick="App.navigate('${user ? user.role + '-overview' : 'landing'}')">
        <div class="brand-symbol">P</div>
        <div>
          <span class="brand-name">PARADOX</span>
          <span class="brand-tagline">Where Vision Meets Capital</span>
        </div>
      </div>
      ${navHtml}
    `;

    renderDemoBar();
  }

  // ----------------------------------------------------------------------------
  // ROUTE DISPATCHER
  // ----------------------------------------------------------------------------
  async function renderRoute(route) {
    const container = document.getElementById('app-container');
    if (!container) return;

    container.innerHTML = '<div style="padding: 60px; text-align: center; color: var(--text-muted);">Synchronizing encrypted ledger state...</div>';

    switch (route) {
      case 'landing':
        renderLanding(container);
        break;
      case 'opportunities':
        await renderOpportunities(container);
        break;
      case 'how-it-works':
        renderHowItWorks(container);
        break;
      case 'about':
        renderAbout(container);
        break;
      case 'login':
        renderLogin(container);
        break;
      case 'register-investor':
        renderRegister(container, 'investor');
        break;
      case 'register-entrepreneur':
        renderRegister(container, 'entrepreneur');
        break;
      case 'legal-terms':
        renderTerms(container);
        break;
      case 'legal-privacy':
        renderPrivacy(container);
        break;

      // Investor Dashboard
      case 'investor-overview':
        await renderInvestorOverview(container);
        break;
      case 'investor-discover':
        await renderInvestorDiscover(container);
        break;
      case 'investor-saved':
        await renderInvestorSaved(container);
        break;
      case 'investor-investments':
        await renderInvestorInvestments(container);
        break;
      case 'investor-messages':
        await renderMessagingView(container);
        break;
      case 'investor-notifications':
        await renderNotificationsView(container);
        break;
      case 'investor-profile':
        renderProfileView(container);
        break;

      // Entrepreneur Dashboard
      case 'entrepreneur-overview':
        await renderEntrepreneurOverview(container);
        break;
      case 'entrepreneur-projects':
        await renderEntrepreneurProjects(container);
        break;
      case 'entrepreneur-create':
        renderEntrepreneurCreate(container);
        break;
      case 'entrepreneur-interests':
        await renderEntrepreneurInterests(container);
        break;
      case 'entrepreneur-messages':
        await renderMessagingView(container);
        break;
      case 'entrepreneur-notifications':
        await renderNotificationsView(container);
        break;
      case 'entrepreneur-profile':
        renderProfileView(container);
        break;

      // Admin Dashboard
      case 'admin-overview':
        await renderAdminOverview(container);
        break;
      case 'admin-startups':
        await renderAdminStartups(container);
        break;
      case 'admin-kyc':
        await renderAdminKYC(container);
        break;
      case 'admin-users':
        await renderAdminUsers(container);
        break;

      default:
        renderLanding(container);
    }
  }

  // ----------------------------------------------------------------------------
  // PUBLIC WEBSITE VIEWS
  // ----------------------------------------------------------------------------
  async function renderLanding(container) {
    let featuredStartups = [];
    try {
      const res = await API.getStartups();
      featuredStartups = res.startups.slice(0, 3);
    } catch (e) {}

    container.innerHTML = `
      <section class="landing-hero">
        <div class="hero-pill">⚡ Private Technology-Driven Investment Matching</div>
        <h1 class="hero-title">
          Where Vision <br /><span class="gold-gradient">Meets Capital.</span>
        </h1>
        <p class="hero-lead">
          PARADOX is an elite, closed-loop financial technology ecosystem uniting ambitious entrepreneurs with verified accredited investors. Built for transformative ventures, institutional trust, and sovereign precision.
        </p>
        <div class="hero-cta-group">
          <button class="btn btn-primary btn-lg" onclick="App.navigate('register-investor')">Invest Capital</button>
          <button class="btn btn-secondary btn-lg" onclick="App.navigate('register-entrepreneur')">Seek Funding</button>
          <button class="btn btn-outline btn-lg" onclick="App.navigate('opportunities')">Explore Catalog</button>
        </div>
      </section>

      <section class="landing-stats-bar">
        <div>
          <div class="landing-stat-val">₹250 Cr+</div>
          <div class="landing-stat-desc">Platform Capital Raised</div>
        </div>
        <div>
          <div class="landing-stat-val">2,000+</div>
          <div class="landing-stat-desc">Verified Global Investors</div>
        </div>
        <div>
          <div class="landing-stat-val">100%</div>
          <div class="landing-stat-desc">KYC Compliance Vetted</div>
        </div>
        <div>
          <div class="landing-stat-val">&lt; 48 Hrs</div>
          <div class="landing-stat-desc">Average Term Sheet Velocity</div>
        </div>
      </section>

      <div style="max-width: 1140px; margin: 0 auto; padding: 0 24px 80px 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
          <div>
            <h2 style="font-size: 24px; font-weight: 800;">Curated Investment Opportunities</h2>
            <p style="color: var(--text-muted); font-size: 13.5px;">Institutional-grade pre-screened technology ventures open for allocation.</p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="App.navigate('opportunities')">View All Opportunities →</button>
        </div>

        <div class="startup-grid">
          ${featuredStartups.map(s => renderStartupCardHtml(s)).join('')}
        </div>

        <div style="margin-top: 80px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
          <div class="stat-card" style="padding: 28px;">
            <div style="font-size: 24px; color: var(--accent-gold); margin-bottom: 12px;">🛡️</div>
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Uncompromising Trust</h3>
            <p style="color: var(--text-secondary); font-size: 13.5px;">Every investor and founder undergoes strict identification and accredited investor certification before accessing deal data.</p>
          </div>
          <div class="stat-card" style="padding: 28px;">
            <div style="font-size: 24px; color: var(--accent-gold); margin-bottom: 12px;">⚡</div>
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Direct Founder Access</h3>
            <p style="color: var(--text-secondary); font-size: 13.5px;">No middleman brokerage spreads or broker delays. Direct bilateral term sheet negotiation with auditable deal history.</p>
          </div>
          <div class="stat-card" style="padding: 28px;">
            <div style="font-size: 24px; color: var(--accent-gold); margin-bottom: 12px;">🌐</div>
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Institutional Architecture</h3>
            <p style="color: var(--text-secondary); font-size: 13.5px;">Engineered with Row Level Security, cryptographic signatures, and enterprise multi-currency balance ledgers.</p>
          </div>
        </div>
      </div>
    `;
  }

  async function renderOpportunities(container) {
    try {
      const res = await API.getStartups({
        q: state.filters.search,
        sector: state.filters.sector,
        stage: state.filters.stage
      });
      state.startups = res.startups;
    } catch (err) {
      state.startups = [];
    }

    container.innerHTML = `
      <div style="max-width: 1180px; margin: 40px auto; padding: 0 24px 80px 24px; width: 100%;">
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 28px; font-weight: 800;">Investment Opportunities</h1>
          <p style="color: var(--text-muted); font-size: 14px;">Browse and evaluate vetted technology ventures currently seeking strategic capital.</p>
        </div>

        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="deal-search-input" placeholder="Search by name, technology, thesis..." value="${state.filters.search}" oninput="App.onSearchChange(this.value)">
          </div>

          <select class="select-filter" onchange="App.onSectorChange(this.value)">
            <option value="All" ${state.filters.sector === 'All' ? 'selected' : ''}>All Sectors</option>
            <option value="Fintech" ${state.filters.sector === 'Fintech' ? 'selected' : ''}>Fintech</option>
            <option value="Clean Energy" ${state.filters.sector === 'Clean Energy' ? 'selected' : ''}>Clean Energy</option>
            <option value="Healthtech" ${state.filters.sector === 'Healthtech' ? 'selected' : ''}>Healthtech</option>
            <option value="Cybersecurity" ${state.filters.sector === 'Cybersecurity' ? 'selected' : ''}>Cybersecurity</option>
            <option value="Agritech" ${state.filters.sector === 'Agritech' ? 'selected' : ''}>Agritech</option>
            <option value="AI/ML" ${state.filters.sector === 'AI/ML' ? 'selected' : ''}>AI/ML</option>
          </select>

          <select class="select-filter" onchange="App.onStageChange(this.value)">
            <option value="All" ${state.filters.stage === 'All' ? 'selected' : ''}>All Stages</option>
            <option value="Pre-Seed" ${state.filters.stage === 'Pre-Seed' ? 'selected' : ''}>Pre-Seed</option>
            <option value="Seed" ${state.filters.stage === 'Seed' ? 'selected' : ''}>Seed</option>
            <option value="Series A" ${state.filters.stage === 'Series A' ? 'selected' : ''}>Series A</option>
            <option value="Series B+" ${state.filters.stage === 'Series B+' ? 'selected' : ''}>Series B+</option>
          </select>
        </div>

        ${state.startups.length === 0 ? `
          <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 60px; text-align: center;">
            <p style="color: var(--text-muted); font-size: 15px;">No ventures found matching the selected filters.</p>
            <button class="btn btn-outline btn-sm" style="margin-top: 14px;" onclick="App.resetFilters()">Clear Filters</button>
          </div>
        ` : `
          <div class="startup-grid">
            ${state.startups.map(s => renderStartupCardHtml(s)).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderHowItWorks(container) {
    container.innerHTML = `
      <div style="max-width: 900px; margin: 50px auto; padding: 0 24px 80px 24px;">
        <h1 style="font-size: 32px; font-weight: 800; text-align: center; margin-bottom: 12px;">How PARADOX Operates</h1>
        <p style="color: var(--text-muted); text-align: center; margin-bottom: 48px;">An institutional protocol designed for discretion, speed, and strategic alignment.</p>

        <div style="display: grid; gap: 32px;">
          <div class="stat-card" style="padding: 30px;">
            <div style="display: flex; gap: 20px;">
              <div style="font-size: 28px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-mono);">01</div>
              <div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Global Verification (KYC & Accreditation)</h3>
                <p style="color: var(--text-secondary); font-size: 14px;">Both founders and institutional investors submit identity credentials and company incorporation proof to our compliance desk. Unverified accounts cannot view sensitive data rooms.</p>
              </div>
            </div>
          </div>

          <div class="stat-card" style="padding: 30px;">
            <div style="display: flex; gap: 20px;">
              <div style="font-size: 28px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-mono);">02</div>
              <div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Listing Governance & Data Room Publishing</h3>
                <p style="color: var(--text-secondary); font-size: 14px;">Founders structure standardized financial models, target ticket sizes, and equity allocations. PARADOX analysts verify corporate existence and traction claims before listing approval.</p>
              </div>
            </div>
          </div>

          <div class="stat-card" style="padding: 30px;">
            <div style="display: flex; gap: 20px;">
              <div style="font-size: 28px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-mono);">03</div>
              <div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Direct Expressions of Interest (EOI)</h3>
                <p style="color: var(--text-secondary); font-size: 14px;">Investors submit formal Indications of Interest specifying check size, strategic value-add, and proposed governance rights directly to the founder dashboard.</p>
              </div>
            </div>
          </div>

          <div class="stat-card" style="padding: 30px;">
            <div style="display: flex; gap: 20px;">
              <div style="font-size: 28px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-mono);">04</div>
              <div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Bilateral Negotiation & Closing</h3>
                <p style="color: var(--text-secondary); font-size: 14px;">Founders accept, counter, or decline proposals in real-time, unlocking encrypted direct messaging channels to finalize legal term sheets.</p>
              </div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 50px;">
          <button class="btn btn-primary btn-lg" onclick="App.navigate('register-investor')">Begin Verification Process</button>
        </div>
      </div>
    `;
  }

  function renderAbout(container) {
    container.innerHTML = `
      <div style="max-width: 860px; margin: 50px auto; padding: 0 24px 80px 24px;">
        <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 16px;">The PARADOX Thesis</h1>
        <p style="color: var(--text-secondary); font-size: 16px; line-height: 1.8; margin-bottom: 24px;">
          Traditional venture financing is fraught with asymmetric information, opaque syndicate networks, and geographic gatekeeping. The finest founders often waste quarters navigating fragmented backchannels, while ambitious capital struggles to identify authentic deep technology.
        </p>
        <p style="color: var(--text-secondary); font-size: 15px; line-height: 1.8; margin-bottom: 36px;">
          PARADOX was engineered as an uncompromising financial bridge. We are not a public stock exchange, an open crowdfunding bulletin, or an automated robo-broker. We are an institutional ecosystem where capital directly converges with visionary enterprise.
        </p>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Headquarters</div>
            <div class="stat-value" style="font-size: 18px;">Bengaluru & Singapore</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Regulatory Scope</div>
            <div class="stat-value" style="font-size: 18px;">Private Placement</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Platform Volume</div>
            <div class="stat-value" style="font-size: 18px;">₹250 Cr+</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderLogin(container) {
    container.innerHTML = `
      <div style="max-width: 440px; margin: 60px auto; padding: 0 20px;">
        <div class="stat-card" style="padding: 36px; border-radius: var(--radius-lg);">
          <div style="text-align: center; margin-bottom: 28px;">
            <div class="brand-symbol" style="margin: 0 auto 14px auto; width: 42px; height: 42px; font-size: 22px;">P</div>
            <h2 style="font-size: 22px; font-weight: 800;">Sign In to PARADOX</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Access your institutional investment portal</p>
          </div>

          <form id="login-form" onsubmit="App.handleLoginForm(event)">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-input" id="login-email" required placeholder="investor@apexcapital.com">
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between;">
                <label class="form-label">Password</label>
                <a href="javascript:void(0)" onclick="App.promptPasswordRecovery()" style="color: var(--accent-gold); font-size: 11.5px; text-decoration: none;">Forgot?</a>
              </div>
              <input type="password" class="form-input" id="login-password" required placeholder="••••••••">
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px; padding: 11px;">
              Authenticate Session
            </button>
          </form>

          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center;">
            <p style="color: var(--text-muted); font-size: 12.5px;">New to the ecosystem?</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 8px;">
              <a href="javascript:void(0)" onclick="App.navigate('register-investor')" style="color: var(--accent-gold); font-size: 13px; font-weight: 600;">Investor Registration</a>
              <span style="color: var(--border-subtle);">•</span>
              <a href="javascript:void(0)" onclick="App.navigate('register-entrepreneur')" style="color: var(--accent-gold); font-size: 13px; font-weight: 600;">Founder Registration</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderRegister(container, role) {
    const isInvestor = role === 'investor';
    container.innerHTML = `
      <div style="max-width: 560px; margin: 40px auto; padding: 0 20px;">
        <div class="stat-card" style="padding: 36px; border-radius: var(--radius-lg);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge ${isInvestor ? 'badge-sector' : 'badge-stage'}">${isInvestor ? 'Accredited Investor Onboarding' : 'Startup Founder Application'}</span>
            <h2 style="font-size: 22px; font-weight: 800; margin-top: 10px;">Create ${isInvestor ? 'Investor' : 'Entrepreneur'} Account</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Join the private capital network</p>
          </div>

          <form id="register-form" onsubmit="App.handleRegisterForm(event, '${role}')">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Full Legal Name *</label>
                <input type="text" class="form-input" id="reg-name" required placeholder="${isInvestor ? 'Vikramaditya Singhania' : 'Dr. Aarav Patel'}">
              </div>
              <div class="form-group">
                <label class="form-label">Email Address *</label>
                <input type="email" class="form-input" id="reg-email" required placeholder="name@firm.com">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Password * (Min 8 characters)</label>
                <input type="password" class="form-input" id="reg-password" required minlength="8" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label class="form-label">Contact Phone</label>
                <input type="text" class="form-input" id="reg-phone" placeholder="+91 98200 00000">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${isInvestor ? 'Firm / Fund / Family Office' : 'Venture / Entity Name'}</label>
                <input type="text" class="form-input" id="reg-company" placeholder="${isInvestor ? 'Apex Capital Partners' : 'NeuralPay Inc.'}">
              </div>
              <div class="form-group">
                <label class="form-label">Designation / Role</label>
                <input type="text" class="form-input" id="reg-designation" placeholder="${isInvestor ? 'Managing Partner' : 'Founder & CEO'}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Country of Primary Tax Residence</label>
              <select class="form-select" id="reg-country">
                <option value="India">India</option>
                <option value="Singapore">Singapore</option>
                <option value="United States">United States</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style="background: var(--bg-sunken); box-shadow: var(--neu-sunken-sm); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 20px;">
              <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 12px; color: var(--text-secondary);">
                <input type="checkbox" id="reg-terms" required style="margin-top: 3px;">
                <span>I confirm that I understand PARADOX is a private technology placement platform. I agree to the <a href="javascript:void(0)" onclick="App.navigate('legal-terms')" style="color: var(--accent-gold);">Terms of Service</a> and <a href="javascript:void(0)" onclick="App.navigate('legal-privacy')" style="color: var(--accent-gold);">Privacy Policy</a>.</span>
              </label>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 11px;">
              Complete Registration & Access Portal
            </button>
          </form>
        </div>
      </div>
    `;
  }

  function renderTerms(container) {
    container.innerHTML = `
      <div style="max-width: 800px; margin: 40px auto; padding: 0 20px 80px 20px;">
        <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 20px;">Terms and Conditions of Ecosystem Placement</h1>
        <div style="color: var(--text-secondary); line-height: 1.8; font-size: 14px;">
          <p style="margin-bottom: 16px;"><strong>1. Nature of Platform:</strong> PARADOX is a private matchmaking software system for institutional, accredited, and angel investors to discover and communicate with startup founders. It does not act as a broker-dealer, stock exchange, underwriter, or investment adviser.</p>
          <p style="margin-bottom: 16px;"><strong>2. High Risk Warning:</strong> Private early-stage venture investments carry high financial risk, including the potential loss of all committed capital, illiquidity, and lack of dividend guarantees.</p>
          <p style="margin-bottom: 16px;"><strong>3. Confidentiality:</strong> All pitch decks, cap tables, and financial representations shared within PARADOX data rooms are strictly confidential and governed by non-circumvention rules.</p>
        </div>
      </div>
    `;
  }

  function renderPrivacy(container) {
    container.innerHTML = `
      <div style="max-width: 800px; margin: 40px auto; padding: 0 20px 80px 20px;">
        <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 20px;">Privacy Policy & Document Security</h1>
        <div style="color: var(--text-secondary); line-height: 1.8; font-size: 14px;">
          <p style="margin-bottom: 16px;"><strong>1. Data Custody:</strong> Personal information, passport documents, and tax filings uploaded for KYC are stored encrypted at rest with AES-256 and restricted to authorized compliance reviewers.</p>
          <p style="margin-bottom: 16px;"><strong>2. Information Sharing:</strong> Financial figures and contact details are only disclosed to counter-parties upon mutual approval of an Expression of Interest.</p>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // INVESTOR DASHBOARD VIEWS
  // ----------------------------------------------------------------------------
  async function renderInvestorOverview(container) {
    let startups = [];
    let interests = [];
    let saved = [];
    try {
      const [sRes, iRes, svRes] = await Promise.all([
        API.getStartups(),
        API.getInterests(),
        API.getSavedStartups()
      ]);
      startups = sRes.startups;
      interests = iRes.interests;
      saved = svRes.startups;
    } catch (e) {}

    const totalInvestedFigure = state.currentUser?.profile?.total_invested || 128000000;

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Investor Portal</div>
          <a class="sidebar-nav-item active" onclick="App.navigate('investor-overview')">
            <span class="sidebar-nav-item-left">📊 Overview</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-discover')">
            <span class="sidebar-nav-item-left">🔍 Discover Ventures</span>
            <span class="sidebar-badge">${startups.length}</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-saved')">
            <span class="sidebar-nav-item-left">⭐ Watchlist</span>
            <span class="sidebar-badge">${saved.length}</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-investments')">
            <span class="sidebar-nav-item-left">💼 Deal Pipeline</span>
            <span class="sidebar-badge">${interests.length}</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-messages')">
            <span class="sidebar-nav-item-left">💬 Communications</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-profile')">
            <span class="sidebar-nav-item-left">⚙️ Profile & KYC</span>
          </a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Investor Command Desk</h1>
              <p class="dashboard-subtitle">Welcome back, ${state.currentUser.full_name}. Here is your portfolio activity and venture pipeline.</p>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="btn btn-outline btn-sm" onclick="App.openKYCModal()">
                ${state.currentUser.kyc_status === 'verified' ? '✓ KYC Verified' : '⚡ Complete KYC'}
              </button>
              <button class="btn btn-primary btn-sm" onclick="App.navigate('investor-discover')">Explore New Deals</button>
            </div>
          </div>

          <!-- Section 7 Prompt Stats -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-label">Total Capital Invested <span class="trend-up">↗ Active</span></div>
              <div class="stat-value">${formatINR(totalInvestedFigure)}</div>
              <div class="stat-trend trend-neutral">Across 7 portfolio assets</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Projects Discovered</div>
              <div class="stat-value">156</div>
              <div class="stat-trend trend-up">↗ +14 this month</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Saved Opportunities</div>
              <div class="stat-value">24</div>
              <div class="stat-trend trend-neutral">In private watchlist</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Encrypted Messages</div>
              <div class="stat-value">18</div>
              <div class="stat-trend trend-up">↗ Active founder threads</div>
            </div>
          </div>

          <!-- Active Deal Pipeline Section -->
          <div style="margin-bottom: 36px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h2 style="font-size: 18px; font-weight: 700;">Active Indications of Interest (EOI)</h2>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('investor-investments')">View Pipeline</button>
            </div>

            ${interests.length === 0 ? `
              <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 30px; text-align: center;">
                <p style="color: var(--text-muted);">No active indications of interest submitted yet.</p>
              </div>
            ` : `
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Venture</th>
                      <th>Sector</th>
                      <th>Proposed Check</th>
                      <th>Status</th>
                      <th>Founder</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${interests.slice(0, 5).map(it => `
                      <tr>
                        <td style="font-weight: 700; color: #ffffff;">${it.startup_name}</td>
                        <td><span class="badge badge-sector">${it.startup_sector}</span></td>
                        <td style="font-family: var(--font-mono); font-weight: 700;">${formatINR(it.proposed_amount)}</td>
                        <td>
                          <span class="badge ${it.status === 'accepted' ? 'badge-approved' : it.status === 'declined' ? 'badge-rejected' : 'badge-pending'}">
                            ${it.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>${it.founder_name}</td>
                        <td>
                          <button class="btn btn-secondary btn-sm" onclick="App.openChatModal('${it.startup_id}', '${it.founder_email}')">Chat</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Recommended Deals Section -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h2 style="font-size: 18px; font-weight: 700;">Trending Vetted Opportunities</h2>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('investor-discover')">View All</button>
            </div>
            <div class="startup-grid">
              ${startups.slice(0, 3).map(s => renderStartupCardHtml(s)).join('')}
            </div>
          </div>
        </main>
      </div>
    `;
  }

  async function renderInvestorDiscover(container) {
    let startups = [];
    try {
      const res = await API.getStartups({
        q: state.filters.search,
        sector: state.filters.sector,
        stage: state.filters.stage
      });
      startups = res.startups;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Investor Portal</div>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-overview')">📊 Overview</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('investor-discover')">🔍 Discover Ventures</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-saved')">⭐ Watchlist</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-investments')">💼 Deal Pipeline</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Venture Discovery Engine</h1>
              <p class="dashboard-subtitle">Filter institutional technology startups by sector, capital target, and growth metrics.</p>
            </div>
          </div>

          <div class="filter-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" class="search-input" placeholder="Search startup name, keywords, problem space..." value="${state.filters.search}" oninput="App.onSearchChange(this.value)">
            </div>

            <select class="select-filter" onchange="App.onSectorChange(this.value)">
              <option value="All" ${state.filters.sector === 'All' ? 'selected' : ''}>All Sectors</option>
              <option value="Fintech" ${state.filters.sector === 'Fintech' ? 'selected' : ''}>Fintech</option>
              <option value="Clean Energy" ${state.filters.sector === 'Clean Energy' ? 'selected' : ''}>Clean Energy</option>
              <option value="Healthtech" ${state.filters.sector === 'Healthtech' ? 'selected' : ''}>Healthtech</option>
              <option value="Cybersecurity" ${state.filters.sector === 'Cybersecurity' ? 'selected' : ''}>Cybersecurity</option>
              <option value="Agritech" ${state.filters.sector === 'Agritech' ? 'selected' : ''}>Agritech</option>
              <option value="AI/ML" ${state.filters.sector === 'AI/ML' ? 'selected' : ''}>AI/ML</option>
            </select>

            <select class="select-filter" onchange="App.onStageChange(this.value)">
              <option value="All" ${state.filters.stage === 'All' ? 'selected' : ''}>All Stages</option>
              <option value="Pre-Seed" ${state.filters.stage === 'Pre-Seed' ? 'selected' : ''}>Pre-Seed</option>
              <option value="Seed" ${state.filters.stage === 'Seed' ? 'selected' : ''}>Seed</option>
              <option value="Series A" ${state.filters.stage === 'Series A' ? 'selected' : ''}>Series A</option>
              <option value="Series B+" ${state.filters.stage === 'Series B+' ? 'selected' : ''}>Series B+</option>
            </select>
          </div>

          <div class="startup-grid">
            ${startups.map(s => renderStartupCardHtml(s)).join('')}
          </div>
        </main>
      </div>
    `;
  }

  async function renderInvestorSaved(container) {
    let saved = [];
    try {
      const res = await API.getSavedStartups();
      saved = res.startups;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Investor Portal</div>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-overview')">📊 Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-discover')">🔍 Discover Ventures</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('investor-saved')">⭐ Watchlist</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-investments')">💼 Deal Pipeline</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Bookmarked Watchlist</h1>
              <p class="dashboard-subtitle">Monitor and review saved venture opportunities and private notes.</p>
            </div>
          </div>

          ${saved.length === 0 ? `
            <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 50px; text-align: center;">
              <p style="color: var(--text-muted);">You have not saved any ventures to your watchlist yet.</p>
              <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="App.navigate('investor-discover')">Explore Ventures</button>
            </div>
          ` : `
            <div class="startup-grid">
              ${saved.map(s => renderStartupCardHtml(s)).join('')}
            </div>
          `}
        </main>
      </div>
    `;
  }

  async function renderInvestorInvestments(container) {
    let interests = [];
    try {
      const res = await API.getInterests();
      interests = res.interests;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Investor Portal</div>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-overview')">📊 Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-discover')">🔍 Discover Ventures</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-saved')">⭐ Watchlist</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('investor-investments')">💼 Deal Pipeline</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('investor-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Deal Pipeline & Expressions of Interest</h1>
              <p class="dashboard-subtitle">Track your capital allocations, term sheets, and formal proposals.</p>
            </div>
          </div>

          ${interests.length === 0 ? `
            <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 50px; text-align: center;">
              <p style="color: var(--text-muted);">No indications of interest submitted yet.</p>
            </div>
          ` : `
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Startup</th>
                    <th>Sector & Stage</th>
                    <th>Proposed Check</th>
                    <th>Equity Stake</th>
                    <th>Status</th>
                    <th>Founder Contact</th>
                    <th>Date Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${interests.map(it => `
                    <tr>
                      <td style="font-weight: 700; color: #ffffff;">${it.startup_name}</td>
                      <td>
                        <span class="badge badge-sector">${it.startup_sector}</span>
                        <span class="badge badge-stage">${it.startup_stage}</span>
                      </td>
                      <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold);">${formatINR(it.proposed_amount)}</td>
                      <td style="font-family: var(--font-mono);">${it.proposed_equity ? it.proposed_equity + '%' : 'Flexible'}</td>
                      <td>
                        <span class="badge ${it.status === 'accepted' ? 'badge-approved' : it.status === 'declined' ? 'badge-rejected' : 'badge-pending'}">
                          ${it.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>${it.founder_name} <br/><span style="font-size: 11px; color: var(--text-muted);">${it.founder_email}</span></td>
                      <td style="font-size: 12px; color: var(--text-muted);">${it.created_at.split(' ')[0]}</td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="App.openStartupModal('${it.startup_id}')">View Deal</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </main>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // ENTREPRENEUR DASHBOARD VIEWS
  // ----------------------------------------------------------------------------
  async function renderEntrepreneurOverview(container) {
    let myStartups = [];
    let inboundInterests = [];
    try {
      const [sRes, iRes] = await Promise.all([
        API.getStartups({ my: true }),
        API.getInterests()
      ]);
      myStartups = sRes.startups;
      inboundInterests = iRes.interests;
    } catch (e) {}

    const fundingRaisedFigure = state.currentUser?.profile?.funding_raised || 38000000;

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Entrepreneur Portal</div>
          <a class="sidebar-nav-item active" onclick="App.navigate('entrepreneur-overview')">📊 Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-projects')">🚀 My Ventures</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-create')">+ New Proposal</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-interests')">
            <span>🤝 Investor Interests</span>
            <span class="sidebar-badge">${inboundInterests.length}</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Founder Capital Desk</h1>
              <p class="dashboard-subtitle">Manage your fundraising pipeline, proposals, and inbound investor indications.</p>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="btn btn-outline btn-sm" onclick="App.openKYCModal()">
                ${state.currentUser.kyc_status === 'verified' ? '✓ Verified Founder' : '⚡ Complete Business KYC'}
              </button>
              <button class="btn btn-primary btn-sm" onclick="App.navigate('entrepreneur-create')">+ Submit New Proposal</button>
            </div>
          </div>

          <!-- Section 7 Prompt Stats -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-label">Total Capital Raised <span class="trend-up">↗ Verified</span></div>
              <div class="stat-value">${formatINR(fundingRaisedFigure)}</div>
              <div class="stat-trend trend-neutral">Seed & Series A cumulative</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Interested Investors</div>
              <div class="stat-value">12</div>
              <div class="stat-trend trend-up">↗ 4 in term sheet phase</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Active Ventures</div>
              <div class="stat-value">8</div>
              <div class="stat-trend trend-neutral">Proposals & spin-outs</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Investor Inquiries</div>
              <div class="stat-value">46</div>
              <div class="stat-trend trend-up">↗ High engagement rate</div>
            </div>
          </div>

          <!-- Inbound Investor Inquiries Section -->
          <div style="margin-bottom: 36px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h2 style="font-size: 18px; font-weight: 700;">Inbound Indications of Interest</h2>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('entrepreneur-interests')">Manage Inquiries</button>
            </div>

            ${inboundInterests.length === 0 ? `
              <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 30px; text-align: center;">
                <p style="color: var(--text-muted);">No inbound investor interests yet. Make sure your proposals are published and approved.</p>
              </div>
            ` : `
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Target Venture</th>
                      <th>Investor Name & Firm</th>
                      <th>Proposed Check</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${inboundInterests.slice(0, 5).map(it => `
                      <tr>
                        <td style="font-weight: 700; color: #ffffff;">${it.startup_name}</td>
                        <td>${it.investor_name} <br/><span style="font-size: 11px; color: var(--accent-gold);">${it.investor_company || 'Private Angel'}</span></td>
                        <td style="font-family: var(--font-mono); font-weight: 700;">${formatINR(it.proposed_amount)}</td>
                        <td>
                          <span class="badge ${it.status === 'accepted' ? 'badge-approved' : it.status === 'declined' ? 'badge-rejected' : 'badge-pending'}">
                            ${it.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <button class="btn btn-secondary btn-sm" onclick="App.respondToInterest('${it.id}', '${it.startup_name}', '${it.investor_name}')">Review Offer</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- My Ventures Listing Section -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h2 style="font-size: 18px; font-weight: 700;">My Ventures & Funding Progress</h2>
              <button class="btn btn-primary btn-sm" onclick="App.navigate('entrepreneur-create')">+ New Venture</button>
            </div>
            <div class="startup-grid">
              ${myStartups.map(s => renderStartupCardHtml(s, true)).join('')}
            </div>
          </div>
        </main>
      </div>
    `;
  }

  async function renderEntrepreneurProjects(container) {
    let startups = [];
    try {
      const res = await API.getStartups({ my: true });
      startups = res.startups;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Entrepreneur Portal</div>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-overview')">📊 Overview</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('entrepreneur-projects')">🚀 My Ventures</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-create')">+ New Proposal</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-interests')">🤝 Investor Interests</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">My Venture Portfolio</h1>
              <p class="dashboard-subtitle">Active and pending investment proposals submitted to PARADOX.</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.navigate('entrepreneur-create')">+ Create Proposal</button>
          </div>

          <div class="startup-grid">
            ${startups.map(s => renderStartupCardHtml(s, true)).join('')}
          </div>
        </main>
      </div>
    `;
  }

  function renderEntrepreneurCreate(container) {
    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Entrepreneur Portal</div>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-overview')">📊 Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-projects')">🚀 My Ventures</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('entrepreneur-create')">+ New Proposal</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-interests')">🤝 Investor Interests</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Create Investment Proposal</h1>
              <p class="dashboard-subtitle">Submit your startup proposal to the PARADOX compliance desk for institutional listing.</p>
            </div>
          </div>

          <div class="stat-card" style="max-width: 800px; padding: 32px;">
            <form id="create-proposal-form" onsubmit="App.handleCreateProposalForm(event)">
              <h3 style="font-size: 16px; font-weight: 700; color: var(--accent-gold); margin-bottom: 16px;">1. Venture Identity & Classification</h3>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Startup / Company Name *</label>
                  <input type="text" class="form-input" id="prop-name" required placeholder="e.g. Hyperion Robotics">
                </div>
                <div class="form-group">
                  <label class="form-label">Sector *</label>
                  <select class="form-select" id="prop-sector">
                    <option value="Fintech">Fintech</option>
                    <option value="AI/ML">AI/ML</option>
                    <option value="Clean Energy">Clean Energy</option>
                    <option value="Healthtech">Healthtech</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Agritech">Agritech</option>
                    <option value="Enterprise SaaS">Enterprise SaaS</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Funding Stage *</label>
                  <select class="form-select" id="prop-stage">
                    <option value="Pre-Seed">Pre-Seed</option>
                    <option value="Seed">Seed</option>
                    <option value="Series A">Series A</option>
                    <option value="Series B+">Series B+</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Headquarters Location *</label>
                  <input type="text" class="form-input" id="prop-hq" required placeholder="e.g. Bengaluru, India">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Elevator Pitch / Tagline (1 sentence) *</label>
                <input type="text" class="form-input" id="prop-tagline" required placeholder="e.g. Autonomous lidar navigation for off-highway mining logistics">
              </div>

              <h3 style="font-size: 16px; font-weight: 700; color: var(--accent-gold); margin: 24px 0 16px 0;">2. Financial Requirements & Valuation</h3>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Target Funding Amount (INR) *</label>
                  <input type="number" class="form-input" id="prop-target" required min="100000" placeholder="e.g. 50000000">
                  <span class="form-helper">₹50,00,000 = ₹50 Lakhs | ₹5,00,00,000 = ₹5 Crore</span>
                </div>
                <div class="form-group">
                  <label class="form-label">Proposed Equity (%) *</label>
                  <input type="number" class="form-input" id="prop-equity" required min="0.5" max="99" step="0.1" placeholder="e.g. 10.0">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Current MRR (INR)</label>
                  <input type="number" class="form-input" id="prop-mrr" placeholder="e.g. 1500000">
                </div>
                <div class="form-group">
                  <label class="form-label">Cash Runway (Months)</label>
                  <input type="number" class="form-input" id="prop-runway" placeholder="18">
                </div>
              </div>

              <h3 style="font-size: 16px; font-weight: 700; color: var(--accent-gold); margin: 24px 0 16px 0;">3. Problem, Solution & Business Model</h3>
              <div class="form-group">
                <label class="form-label">The Problem Statement *</label>
                <textarea class="form-textarea" id="prop-problem" required placeholder="Define the acute market inefficiency your company solves..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">The Solution & Technical Moat *</label>
                <textarea class="form-textarea" id="prop-solution" required placeholder="Explain your proprietary technology and competitive advantage..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Comprehensive Venture Description *</label>
                <textarea class="form-textarea" id="prop-desc" required style="min-height: 120px;" placeholder="Full narrative overview of the startup, traction to date, and expansion strategy..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Pitch Deck Document Link (PDF / Cloud URL)</label>
                <input type="url" class="form-input" id="prop-deck" placeholder="https://storage.cloud.com/pitch-deck.pdf">
              </div>

              <div style="margin-top: 28px; display: flex; justify-content: flex-end; gap: 12px;">
                <button type="button" class="btn btn-secondary" onclick="App.navigate('entrepreneur-projects')">Cancel</button>
                <button type="submit" class="btn btn-primary">Submit Proposal for Review</button>
              </div>
            </form>
          </div>
        </main>
      </div>
    `;
  }

  async function renderEntrepreneurInterests(container) {
    let interests = [];
    try {
      const res = await API.getInterests();
      interests = res.interests;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Entrepreneur Portal</div>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-overview')">📊 Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-projects')">🚀 My Ventures</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-create')">+ New Proposal</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('entrepreneur-interests')">🤝 Investor Interests</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('entrepreneur-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Inbound Investor Indications</h1>
              <p class="dashboard-subtitle">Review term sheet inquiries and evaluate investor strategic fit.</p>
            </div>
          </div>

          ${interests.length === 0 ? `
            <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 50px; text-align: center;">
              <p style="color: var(--text-muted);">No inbound investment inquiries at this time.</p>
            </div>
          ` : `
            <div style="display: grid; gap: 20px;">
              ${interests.map(it => `
                <div class="stat-card" style="padding: 24px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                      <span class="badge ${it.status === 'accepted' ? 'badge-approved' : it.status === 'declined' ? 'badge-rejected' : 'badge-pending'}">
                        ${it.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 6px;">${it.investor_name}</h3>
                      <p style="color: var(--text-muted); font-size: 13px;">${it.investor_company || 'Private Accredited Investor'} • ${it.investor_email}</p>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 22px; font-weight: 800; color: var(--accent-gold); font-family: var(--font-mono);">${formatINR(it.proposed_amount)}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">${it.proposed_equity ? it.proposed_equity + '% Equity Requested' : 'Equity Negotiable'}</div>
                    </div>
                  </div>

                  <div style="background: var(--bg-sunken); box-shadow: var(--neu-sunken-sm); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 14px; margin: 14px 0;">
                    <div style="font-size: 11.5px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Strategic Value & Message:</div>
                    <p style="color: var(--text-secondary); font-size: 13.5px; line-height: 1.5;">${it.message}</p>
                    ${it.strategic_value ? `<p style="color: var(--accent-gold); font-size: 12.5px; margin-top: 6px;">💡 Strategic value-add: ${it.strategic_value}</p>` : ''}
                  </div>

                  <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
                    <button class="btn btn-outline btn-sm" onclick="App.openChatModal('${it.startup_id}', '${it.investor_email}')">Open Secure Thread</button>
                    ${it.status === 'pending' ? `
                      <button class="btn btn-danger btn-sm" onclick="App.updateOfferStatus('${it.id}', 'declined')">Decline</button>
                      <button class="btn btn-success btn-sm" onclick="App.updateOfferStatus('${it.id}', 'accepted')">Accept & Share Term Sheet</button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </main>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // ADMINISTRATOR VIEWS
  // ----------------------------------------------------------------------------
  async function renderAdminOverview(container) {
    let stats = null;
    let recentAudits = [];
    try {
      const res = await API.getAdminStats();
      stats = res.stats;
      recentAudits = res.recentAudits;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Admin Command Desk</div>
          <a class="sidebar-nav-item active" onclick="App.navigate('admin-overview')">📊 Platform Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-startups')">
            <span>🛡️ Venture Approvals</span>
            <span class="sidebar-badge">${stats?.pendingStartups || 0}</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-kyc')">
            <span>🪪 KYC Verification</span>
            <span class="sidebar-badge">${stats?.pendingKYC || 0}</span>
          </a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-users')">👥 User Directory</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Platform Governance & Compliance</h1>
              <p class="dashboard-subtitle">Monitor global transactions, user authentication, and venture moderation.</p>
            </div>
          </div>

          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-label">Total Registered Users</div>
              <div class="stat-value">${stats?.totalUsers || 0}</div>
              <div class="stat-trend trend-neutral">${stats?.investorCount || 0} Investors • ${stats?.entrepreneurCount || 0} Founders</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Active Ventures Listed</div>
              <div class="stat-value">${stats?.approvedStartups || 0}</div>
              <div class="stat-trend trend-up">${stats?.pendingStartups || 0} pending review</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Capital Sought</div>
              <div class="stat-value">${formatINR(stats?.totalSoughtFunding || 0)}</div>
              <div class="stat-trend trend-neutral">${formatINR(stats?.totalRaisedFunding || 0)} funded</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Indications of Interest</div>
              <div class="stat-value">${stats?.totalInterests || 0}</div>
              <div class="stat-trend trend-up">${formatINR(stats?.totalIndicatedCapital || 0)} volume</div>
            </div>
          </div>

          <!-- Pending Action Banners -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 36px;">
            <div class="stat-card" style="border-left: 4px solid var(--accent-gold); cursor: pointer;" onclick="App.navigate('admin-startups')">
              <h3 style="font-size: 16px; font-weight: 700;">Venture Proposals Awaiting Review</h3>
              <p style="color: var(--text-muted); font-size: 13px; margin: 6px 0 12px 0;">${stats?.pendingStartups || 0} startups awaiting compliance review before public listing.</p>
              <button class="btn btn-primary btn-sm">Review Listings →</button>
            </div>

            <div class="stat-card" style="border-left: 4px solid var(--status-pending); cursor: pointer;" onclick="App.navigate('admin-kyc')">
              <h3 style="font-size: 16px; font-weight: 700;">KYC Submissions Awaiting Approval</h3>
              <p style="color: var(--text-muted); font-size: 13px; margin: 6px 0 12px 0;">${stats?.pendingKYC || 0} identity submissions requiring verification.</p>
              <button class="btn btn-secondary btn-sm">Process KYC Queue →</button>
            </div>
          </div>

          <!-- Audit Log Trail -->
          <div>
            <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Platform Audit Trail & Security Log</h2>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Actor</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentAudits.map(a => `
                    <tr>
                      <td style="font-size: 12px; color: var(--text-muted);">${a.created_at}</td>
                      <td><span class="badge badge-stage">${a.action}</span></td>
                      <td>${a.resource_type} • <span style="font-size: 11px; font-family: var(--font-mono);">${a.resource_id}</span></td>
                      <td>${a.actor_name || 'System / Anonymous'}</td>
                      <td style="font-family: var(--font-mono); font-size: 12px;">${a.ip_address}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  async function renderAdminStartups(container) {
    let startups = [];
    try {
      const res = await API.getStartups({ status: '' });
      startups = res.startups;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Admin Command Desk</div>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-overview')">📊 Platform Overview</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('admin-startups')">🛡️ Venture Approvals</a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-kyc')">🪪 KYC Verification</a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-users')">👥 User Directory</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Venture Listing Moderation</h1>
              <p class="dashboard-subtitle">Review, approve, or reject startup fundraising proposals.</p>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Venture Name</th>
                  <th>Sector & Stage</th>
                  <th>Founder</th>
                  <th>Target Funding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${startups.map(s => `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: #ffffff;">${s.name}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">${s.headquarters}</div>
                    </td>
                    <td>
                      <span class="badge badge-sector">${s.sector}</span>
                      <span class="badge badge-stage">${s.stage}</span>
                    </td>
                    <td>${s.founder_name} <br/><span style="font-size: 11px; color: var(--text-muted);">${s.founder_email}</span></td>
                    <td style="font-family: var(--font-mono); font-weight: 700;">${formatINR(s.target_funding)}</td>
                    <td>
                      <span class="badge ${s.status === 'approved' ? 'badge-approved' : s.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}">
                        ${s.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary btn-sm" onclick="App.openStartupModal('${s.id}')">View</button>
                        ${s.status !== 'approved' ? `
                          <button class="btn btn-success btn-sm" onclick="App.adminReviewVenture('${s.id}', 'approved')">Approve</button>
                        ` : ''}
                        ${s.status !== 'rejected' ? `
                          <button class="btn btn-danger btn-sm" onclick="App.adminReviewVenture('${s.id}', 'rejected')">Reject</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    `;
  }

  async function renderAdminKYC(container) {
    let submissions = [];
    try {
      const res = await API.getPendingKYC();
      submissions = res.submissions;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Admin Command Desk</div>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-overview')">📊 Platform Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-startups')">🛡️ Venture Approvals</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('admin-kyc')">🪪 KYC Verification</a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-users')">👥 User Directory</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">KYC Identity Verification Queue</h1>
              <p class="dashboard-subtitle">Certify accredited investor declarations and company incorporation documents.</p>
            </div>
          </div>

          ${submissions.length === 0 ? `
            <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 50px; text-align: center;">
              <p style="color: var(--text-muted);">No pending KYC submissions in the compliance queue.</p>
            </div>
          ` : `
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Role & Firm</th>
                    <th>Document Type & Number</th>
                    <th>Country</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${submissions.map(k => `
                    <tr>
                      <td style="font-weight: 700; color: #ffffff;">${k.full_legal_name} <br/><span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">${k.email}</span></td>
                      <td>
                        <span class="badge ${k.user_role === 'investor' ? 'badge-sector' : 'badge-stage'}">${k.user_role.toUpperCase()}</span>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">${k.company_name || 'Individual'}</div>
                      </td>
                      <td>
                        <div style="font-weight: 600;">${k.document_type.toUpperCase()}</div>
                        <div style="font-size: 12px; font-family: var(--font-mono); color: var(--accent-gold);">${k.document_number}</div>
                      </td>
                      <td>${k.country_of_issuance}</td>
                      <td>
                        <span class="badge ${k.status === 'approved' ? 'badge-approved' : k.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}">
                          ${k.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style="display: flex; gap: 6px;">
                          <a href="${k.document_file_url}" target="_blank" class="btn btn-secondary btn-sm">Inspect Doc</a>
                          ${k.status === 'pending' ? `
                            <button class="btn btn-success btn-sm" onclick="App.adminReviewKYC('${k.id}', 'approved')">Verify</button>
                            <button class="btn btn-danger btn-sm" onclick="App.adminReviewKYC('${k.id}', 'rejected')">Reject</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </main>
      </div>
    `;
  }

  async function renderAdminUsers(container) {
    let users = [];
    try {
      const res = await API.getAdminUsers();
      users = res.users;
    } catch (e) {}

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">Admin Command Desk</div>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-overview')">📊 Platform Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-startups')">🛡️ Venture Approvals</a>
          <a class="sidebar-nav-item" onclick="App.navigate('admin-kyc')">🪪 KYC Verification</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('admin-users')">👥 User Directory</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Platform User Directory</h1>
              <p class="dashboard-subtitle">Manage registered investors, startup entrepreneurs, and administrative accounts.</p>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>KYC Status</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td style="font-weight: 700; color: #ffffff;">
                      ${u.full_name} <br/>
                      <span style="font-size: 11.5px; color: var(--text-muted); font-weight: normal;">${u.email}</span>
                    </td>
                    <td>
                      <span class="badge ${u.role === 'admin' ? 'badge-rejected' : u.role === 'investor' ? 'badge-sector' : 'badge-stage'}">
                        ${u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>${u.company_name || '—'} <br/><span style="font-size: 11px; color: var(--text-muted);">${u.designation || ''}</span></td>
                    <td>
                      <span class="badge ${u.kyc_status === 'verified' ? 'badge-approved' : u.kyc_status === 'rejected' ? 'badge-rejected' : 'badge-pending'}">
                        ${u.kyc_status.toUpperCase()}
                      </span>
                    </td>
                    <td style="font-size: 12px; color: var(--text-muted);">${u.created_at.split(' ')[0]}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // MESSAGING & PROFILE VIEWS
  // ----------------------------------------------------------------------------
  async function renderMessagingView(container) {
    const role = state.currentUser.role;
    let convs = [];
    try {
      const res = await API.getConversations();
      convs = res.conversations;
    } catch (e) {}

    state.conversations = convs;
    const activeConv = convs.find(c => c.id === state.activeConversationId) || convs[0];
    if (activeConv) state.activeConversationId = activeConv.id;

    let messages = [];
    if (state.activeConversationId) {
      try {
        const mRes = await API.getThreadMessages(state.activeConversationId);
        messages = mRes.messages;
      } catch (e) {}
    }

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">${role === 'investor' ? 'Investor' : 'Entrepreneur'} Portal</div>
          <a class="sidebar-nav-item" onclick="App.navigate('${role}-overview')">📊 Overview</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('${role}-messages')">💬 Communications</a>
          <a class="sidebar-nav-item" onclick="App.navigate('${role}-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content" style="padding: 24px;">
          <div class="dashboard-header" style="margin-bottom: 20px;">
            <div>
              <h1 class="dashboard-title">Secure Bilateral Messaging</h1>
              <p class="dashboard-subtitle">Encrypted discussions with counter-parties regarding deal terms and diligence.</p>
            </div>
          </div>

          ${convs.length === 0 ? `
            <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 50px; text-align: center;">
              <p style="color: var(--text-muted);">No active conversation threads. Start a conversation by expressing interest in a venture or responding to an inquiry.</p>
            </div>
          ` : `
            <div class="messaging-grid">
              <div class="conv-list">
                ${convs.map(c => `
                  <div class="conv-item ${c.id === state.activeConversationId ? 'active' : ''}" onclick="App.selectConversation('${c.id}')">
                    <div class="conv-header">
                      <span class="conv-name">${c.other_participant_name}</span>
                      <span class="conv-time">${c.last_message_at ? c.last_message_at.split(' ')[1] : ''}</span>
                    </div>
                    <div style="font-size: 11.5px; color: var(--accent-gold); margin-bottom: 2px;">${c.startup_name || 'General Inquiry'}</div>
                    <div class="conv-snippet">${c.last_message_content || 'No messages yet'}</div>
                  </div>
                `).join('')}
              </div>

              <div class="chat-pane">
                <div class="chat-header">
                  <div>
                    <h3 style="font-size: 15px; font-weight: 700; color: #ffffff;">${activeConv?.other_participant_name || 'Select a thread'}</h3>
                    <p style="font-size: 12px; color: var(--text-muted);">${activeConv?.startup_name || 'Private Investment Discussion'}</p>
                  </div>
                </div>

                <div class="chat-history" id="chat-messages-container">
                  ${messages.map(m => `
                    <div class="chat-bubble ${m.sender_id === state.currentUser.id ? 'sent' : 'received'}">
                      <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px;">${m.sender_name}</div>
                      <div>${m.content}</div>
                      <div style="font-size: 10px; opacity: 0.5; margin-top: 4px; text-align: right;">${m.created_at.split(' ')[1]}</div>
                    </div>
                  `).join('')}
                </div>

                <form class="chat-input-bar" onsubmit="App.handleSendMessageForm(event)">
                  <input type="text" class="form-input" id="chat-text-input" required placeholder="Type your message..." autocomplete="off">
                  <button type="submit" class="btn btn-primary btn-sm">Send</button>
                </form>
              </div>
            </div>
          `}
        </main>
      </div>
    `;

    // Scroll chat to bottom
    const hist = document.getElementById('chat-messages-container');
    if (hist) hist.scrollTop = hist.scrollHeight;
  }

  function renderProfileView(container) {
    const user = state.currentUser;
    const prof = user.profile || {};
    const role = user.role;

    container.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar">
          <div class="sidebar-heading">${role.toUpperCase()} PORTAL</div>
          <a class="sidebar-nav-item" onclick="App.navigate('${role}-overview')">📊 Overview</a>
          <a class="sidebar-nav-item" onclick="App.navigate('${role}-messages')">💬 Communications</a>
          <a class="sidebar-nav-item active" onclick="App.navigate('${role}-profile')">⚙️ Profile & KYC</a>
        </aside>

        <main class="dashboard-content">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Account & Compliance Profile</h1>
              <p class="dashboard-subtitle">Manage legal identity, accredited status, and contact credentials.</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.openKYCModal()">
              ${user.kyc_status === 'verified' ? '✓ Verified Identity' : '🪪 Upload KYC Documents'}
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; max-width: 1000px;">
            <div class="stat-card" style="padding: 28px;">
              <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 18px;">Personal & Professional Information</h3>
              <form id="profile-edit-form" onsubmit="App.handleProfileSave(event)">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Full Name</label>
                    <input type="text" class="form-input" id="prof-name" value="${user.full_name || ''}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Email Address (Read-only)</label>
                    <input type="text" class="form-input" value="${user.email}" disabled style="opacity: 0.6;">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Company / Fund Name</label>
                    <input type="text" class="form-input" id="prof-company" value="${prof.company_name || ''}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Designation / Role</label>
                    <input type="text" class="form-input" id="prof-designation" value="${prof.designation || ''}">
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Bio / Investment Focus</label>
                  <textarea class="form-textarea" id="prof-bio">${prof.bio || ''}</textarea>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Phone</label>
                    <input type="text" class="form-input" id="prof-phone" value="${user.phone || ''}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Country</label>
                    <input type="text" class="form-input" id="prof-country" value="${prof.country || 'India'}">
                  </div>
                </div>

                <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Save Changes</button>
              </form>
            </div>

            <div style="display: flex; flex-direction: column; gap: 20px;">
              <div class="stat-card" style="padding: 24px;">
                <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">KYC Status</h3>
                <div style="margin-bottom: 14px;">
                  <span class="badge ${user.kyc_status === 'verified' ? 'badge-approved' : user.kyc_status === 'rejected' ? 'badge-rejected' : 'badge-pending'}">
                    ${user.kyc_status.toUpperCase()}
                  </span>
                </div>
                <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  ${user.kyc_status === 'verified' 
                    ? 'Your identity and accredited status are verified. You have full access to submit offers and communicate.' 
                    : 'Submit passport or incorporation records to unlock all platform capabilities.'}
                </p>
                <button class="btn btn-outline btn-sm" style="width: 100%;" onclick="App.openKYCModal()">
                  ${user.kyc_status === 'verified' ? 'Review Submission' : 'Submit Verification'}
                </button>
              </div>

              <div class="stat-card" style="padding: 24px;">
                <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">Security & Sessions</h3>
                <p style="font-size: 12.5px; color: var(--text-muted); line-height: 1.5;">Encrypted session active. PBKDF2 with 100,000 rounds and secure tokens.</p>
                <button class="btn btn-danger btn-sm" style="width: 100%; margin-top: 14px;" onclick="App.logout()">End Current Session</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // MODALS & CARDS HELPERS
  // ----------------------------------------------------------------------------
  function renderStartupCardHtml(s, isOwner = false) {
    const isSaved = Boolean(s.isSaved);
    return `
      <div class="startup-card" onclick="App.openStartupModal('${s.id}')" style="cursor: pointer;">
        <div>
          <div class="card-top">
            <div class="startup-badges">
              <span class="badge badge-sector">${s.sector}</span>
              <span class="badge badge-stage">${s.stage}</span>
              ${s.status !== 'approved' ? `<span class="badge ${s.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}">${s.status.toUpperCase()}</span>` : ''}
            </div>
            ${!isOwner ? `
              <button class="btn-save ${isSaved ? 'saved' : ''}" title="${isSaved ? 'Saved to Watchlist' : 'Save to Watchlist'}" onclick="event.stopPropagation(); App.toggleSaveDeal('${s.id}')">
                ${isSaved ? '★' : '☆'}
              </button>
            ` : ''}
          </div>

          <h3 class="startup-name">${s.name}</h3>
          <p class="startup-tagline">${s.tagline}</p>
        </div>

        <div>
          <div class="financial-metrics-row">
            <div class="metric-item">
              <span class="metric-item-label">Target Funding</span>
              <span class="metric-item-val">${formatINR(s.target_funding)}</span>
            </div>
            <div class="metric-item">
              <span class="metric-item-label">Equity Offered</span>
              <span class="metric-item-val" style="color: var(--accent-gold);">${s.proposed_equity}%</span>
            </div>
          </div>

          <div class="progress-container">
            <div class="progress-labels">
              <span>Raised ${formatINR(s.raised_funding)}</span>
              <span>${s.progressPercentage}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${s.progressPercentage}%;"></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
            <span style="font-size: 11.5px; color: var(--text-muted);">📍 ${s.headquarters}</span>
            <span style="font-size: 12.5px; color: var(--accent-gold); font-weight: 600;">Inspect Venture →</span>
          </div>
        </div>
      </div>
    `;
  }

  async function openStartupModal(startupId) {
    let startup = null;
    try {
      const res = await API.getStartupById(startupId);
      startup = res.startup;
    } catch (err) {
      return showToast('Unable to load venture details: ' + err.message, 'error');
    }

    const modal = document.getElementById('global-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');

    title.innerHTML = `${startup.name} <span class="badge badge-sector" style="margin-left: 8px;">${startup.sector}</span>`;

    const isInvestor = state.currentUser?.role === 'investor';
    const isFounder = state.currentUser?.id === startup.founder_id;
    const isAdmin = state.currentUser?.role === 'admin';

    body.innerHTML = `
      <div style="margin-bottom: 20px;">
        <p style="font-size: 16px; font-weight: 600; color: #ffffff; line-height: 1.4;">${startup.tagline}</p>
        <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12.5px; color: var(--text-muted);">
          <span>📍 ${startup.headquarters}</span>
          <span>•</span>
          <span>⚡ Stage: ${startup.stage}</span>
          <span>•</span>
          <span>👁 ${startup.view_count} views</span>
        </div>
      </div>

      <div class="financial-metrics-row" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 24px;">
        <div class="metric-item">
          <span class="metric-item-label">Target Funding</span>
          <span class="metric-item-val">${formatINR(startup.target_funding)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-item-label">Equity Offered</span>
          <span class="metric-item-val" style="color: var(--accent-gold);">${startup.proposed_equity}%</span>
        </div>
        <div class="metric-item">
          <span class="metric-item-label">Pre-Money Valuation</span>
          <span class="metric-item-val">${formatINR(startup.pre_money_valuation)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-item-label">Current MRR</span>
          <span class="metric-item-val">${formatINR(startup.mrr)}</span>
        </div>
      </div>

      <div style="display: grid; gap: 16px; margin-bottom: 24px;">
        <div>
          <h4 style="font-size: 13.5px; font-weight: 700; text-transform: uppercase; color: var(--accent-gold); margin-bottom: 6px;">The Problem</h4>
          <p style="color: var(--text-secondary); font-size: 13.5px; line-height: 1.6;">${startup.problem_statement}</p>
        </div>

        <div>
          <h4 style="font-size: 13.5px; font-weight: 700; text-transform: uppercase; color: var(--accent-gold); margin-bottom: 6px;">The Solution & Moat</h4>
          <p style="color: var(--text-secondary); font-size: 13.5px; line-height: 1.6;">${startup.solution_statement}</p>
        </div>

        <div>
          <h4 style="font-size: 13.5px; font-weight: 700; text-transform: uppercase; color: var(--accent-gold); margin-bottom: 6px;">Business Model & Unit Economics</h4>
          <p style="color: var(--text-secondary); font-size: 13.5px; line-height: 1.6;">${startup.business_model}</p>
        </div>

        <div>
          <h4 style="font-size: 13.5px; font-weight: 700; text-transform: uppercase; color: var(--accent-gold); margin-bottom: 6px;">Founder & Leadership</h4>
          <p style="color: var(--text-secondary); font-size: 13.5px;">${startup.founder_name} (${startup.founder_company || startup.name}) • ${startup.founder_email}</p>
        </div>
      </div>

      ${startup.pitch_deck_url ? `
        <div style="background: var(--bg-sunken); box-shadow: var(--neu-sunken-sm); border: 1px solid var(--border-glass); padding: 14px 18px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px;">📄 Confidential Pitch Deck & Diligence Materials</span>
          <a href="${startup.pitch_deck_url}" target="_blank" class="btn btn-outline btn-sm">Download PDF</a>
        </div>
      ` : ''}
    `;

    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      ${isInvestor ? `
        <button class="btn btn-primary" onclick="App.openInterestModal('${startup.id}', '${startup.name}')">Express Investment Interest</button>
      ` : ''}
    `;

    modal.classList.add('open');
  }

  function openInterestModal(startupId, startupName) {
    const modal = document.getElementById('global-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');

    title.innerText = `Express Interest: ${startupName}`;

    body.innerHTML = `
      <form id="interest-form" onsubmit="App.handleInterestSubmit(event, '${startupId}')">
        <div class="form-group">
          <label class="form-label">Proposed Check Size (INR) *</label>
          <input type="number" class="form-input" id="int-amount" required min="100000" placeholder="e.g. 15000000">
          <span class="form-helper">₹15,00,000 = ₹15L | ₹1,50,00,000 = ₹1.5 Cr</span>
        </div>

        <div class="form-group">
          <label class="form-label">Proposed Equity Stake (%)</label>
          <input type="number" class="form-input" id="int-equity" min="0.1" max="100" step="0.1" placeholder="e.g. 5.0 (Optional/Flexible)">
        </div>

        <div class="form-group">
          <label class="form-label">Strategic Value-Add</label>
          <input type="text" class="form-input" id="int-strat" placeholder="e.g. Enterprise pilot access with leading banks in SEA">
        </div>

        <div class="form-group">
          <label class="form-label">Message / Thesis to Founder *</label>
          <textarea class="form-textarea" id="int-msg" required placeholder="Outline why you are interested in backing this company and your proposed timeline..."></textarea>
        </div>

        <div style="background: var(--bg-sunken); box-shadow: var(--neu-sunken-sm); border: 1px solid var(--border-glass); padding: 12px 16px; border-radius: var(--radius-sm); font-size: 11.5px; color: var(--text-muted);">
          Indication of interest represents a non-binding preliminary indication governed by the PARADOX non-solicitation code.
        </div>
      </form>
    `;

    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="document.getElementById('interest-form').requestSubmit()">Submit Expression of Interest</button>
    `;

    modal.classList.add('open');
  }

  function openKYCModal() {
    const modal = document.getElementById('global-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');

    title.innerText = 'Global KYC & Accreditation Verification';

    body.innerHTML = `
      <form id="kyc-form" onsubmit="App.handleKYCSubmit(event)">
        <p style="color: var(--text-secondary); font-size: 13.5px; margin-bottom: 16px;">
          To comply with Anti-Money Laundering (AML) standards and ensure ecosystem security, all active participants must verify their identity.
        </p>

        <div class="form-group">
          <label class="form-label">Full Legal Name (as on Government ID) *</label>
          <input type="text" class="form-input" id="kyc-name" required value="${state.currentUser?.full_name || ''}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Document Type *</label>
            <select class="form-select" id="kyc-type">
              <option value="passport">Passport</option>
              <option value="national_id">National ID / Aadhaar / PAN</option>
              <option value="incorporation_cert">Certificate of Incorporation</option>
              <option value="driving_license">Driving License</option>
              <option value="tax_id">Tax Identification Document</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Document Identification Number *</label>
            <input type="text" class="form-input" id="kyc-number" required placeholder="e.g. Z5982143">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Country of Issuance *</label>
          <input type="text" class="form-input" id="kyc-country" required value="${state.currentUser?.profile?.country || 'India'}">
        </div>

        <div class="form-group">
          <label class="form-label">Upload Identity Document (Simulation / PDF / Image)</label>
          <input type="file" class="form-input" id="kyc-file" accept=".pdf,.png,.jpg,.jpeg">
          <span class="form-helper">In this live environment, files are processed into encrypted secure vault paths.</span>
        </div>

        <div style="background: var(--bg-sunken); box-shadow: var(--neu-sunken-sm); border: 1px solid var(--border-glass); padding: 14px 18px; border-radius: var(--radius-sm); margin: 18px 0;">
          <label style="display: flex; gap: 8px; font-size: 12px; color: var(--text-secondary); cursor: pointer;">
            <input type="checkbox" id="kyc-acc" checked required>
            <span>I declare that I am an accredited/qualified market participant and meet all local statutory net worth thresholds.</span>
          </label>
        </div>
      </form>
    `;

    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="document.getElementById('kyc-form').requestSubmit()">Submit Documents</button>
    `;

    modal.classList.add('open');
  }

  function closeModal() {
    const modal = document.getElementById('global-modal');
    if (modal) modal.classList.remove('open');
  }

  // ----------------------------------------------------------------------------
  // FORM HANDLERS & ACTIONS
  // ----------------------------------------------------------------------------
  async function handleLoginForm(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await API.login(email, password);
      state.currentUser = res.user;
      showToast(`Welcome back, ${res.user.full_name}`, 'success');
      navigate(`${res.user.role}-overview`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRegisterForm(e, role) {
    e.preventDefault();
    const fullName = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const companyName = document.getElementById('reg-company').value;
    const designation = document.getElementById('reg-designation').value;
    const country = document.getElementById('reg-country').value;

    try {
      const res = await API.register({
        fullName,
        email,
        password,
        role,
        phone,
        companyName,
        designation,
        country
      });
      state.currentUser = res.user;
      showToast(`Account created successfully as ${role}`, 'success');
      navigate(`${role}-overview`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleCreateProposalForm(e) {
    e.preventDefault();
    const name = document.getElementById('prop-name').value;
    const sector = document.getElementById('prop-sector').value;
    const stage = document.getElementById('prop-stage').value;
    const headquarters = document.getElementById('prop-hq').value;
    const tagline = document.getElementById('prop-tagline').value;
    const targetFunding = document.getElementById('prop-target').value;
    const proposedEquity = document.getElementById('prop-equity').value;
    const mrr = document.getElementById('prop-mrr').value;
    const runwayMonths = document.getElementById('prop-runway').value;
    const problemStatement = document.getElementById('prop-problem').value;
    const solutionStatement = document.getElementById('prop-solution').value;
    const description = document.getElementById('prop-desc').value;
    const pitchDeckUrl = document.getElementById('prop-deck').value;

    try {
      await API.createStartup({
        name,
        sector,
        stage,
        headquarters,
        tagline,
        targetFunding,
        proposedEquity,
        mrr,
        runwayMonths,
        problemStatement,
        solutionStatement,
        description,
        pitchDeckUrl
      });
      showToast('Proposal submitted successfully! Review in progress.', 'success');
      navigate('entrepreneur-projects');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleInterestSubmit(e, startupId) {
    e.preventDefault();
    const proposedAmount = document.getElementById('int-amount').value;
    const proposedEquity = document.getElementById('int-equity').value;
    const strategicValue = document.getElementById('int-strat').value;
    const message = document.getElementById('int-msg').value;

    try {
      await API.createInterest({
        startupId,
        proposedAmount,
        proposedEquity: proposedEquity || null,
        strategicValue,
        message
      });
      closeModal();
      showToast('Expression of Interest submitted to the founder!', 'success');
      navigate('investor-investments');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleKYCSubmit(e) {
    e.preventDefault();
    const fullLegalName = document.getElementById('kyc-name').value;
    const documentType = document.getElementById('kyc-type').value;
    const documentNumber = document.getElementById('kyc-number').value;
    const countryOfIssuance = document.getElementById('kyc-country').value;
    const accreditedDeclaration = document.getElementById('kyc-acc').checked;

    try {
      await API.submitKYC({
        fullLegalName,
        documentType,
        documentNumber,
        countryOfIssuance,
        accreditedDeclaration
      });
      closeModal();
      showToast('KYC documents submitted. Pending administrative certification.', 'success');
      const me = await API.getMe();
      state.currentUser = me.user;
      renderRoute(state.currentRoute);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleSaveDeal(startupId) {
    try {
      const res = await API.toggleSaveStartup(startupId);
      showToast(res.message, 'info');
      // Refresh state
      const sRes = await API.getStartups();
      state.startups = sRes.startups;
      renderRoute(state.currentRoute);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function updateOfferStatus(interestId, status) {
    try {
      await API.updateInterestStatus(interestId, status);
      showToast(`Proposal status updated to ${status}`, 'success');
      renderRoute(state.currentRoute);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function adminReviewVenture(startupId, status) {
    try {
      await API.reviewStartupByAdmin(startupId, status);
      showToast(`Venture ${status} successfully`, 'success');
      renderRoute(state.currentRoute);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function adminReviewKYC(kycId, status) {
    try {
      await API.reviewKYC(kycId, status);
      showToast(`KYC submission ${status}`, 'success');
      renderRoute(state.currentRoute);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleSendMessageForm(e) {
    e.preventDefault();
    const input = document.getElementById('chat-text-input');
    const text = input.value;
    if (!text || !text.trim()) return;

    try {
      await API.sendMessage({
        conversationId: state.activeConversationId,
        content: text
      });
      input.value = '';
      const mRes = await API.getThreadMessages(state.activeConversationId);
      const hist = document.getElementById('chat-messages-container');
      if (hist) {
        hist.innerHTML = mRes.messages.map(m => `
          <div class="chat-bubble ${m.sender_id === state.currentUser.id ? 'sent' : 'received'}">
            <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px;">${m.sender_name}</div>
            <div>${m.content}</div>
            <div style="font-size: 10px; opacity: 0.5; margin-top: 4px; text-align: right;">${m.created_at.split(' ')[1]}</div>
          </div>
        `).join('');
        hist.scrollTop = hist.scrollHeight;
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function selectConversation(id) {
    state.activeConversationId = id;
    renderMessagingView(document.getElementById('app-container'));
  }

  async function switchDemoRole(targetRole) {
    try {
      const res = await API.demoSwitch(targetRole);
      state.currentUser = res.user;
      showToast(`Switched to demo ${targetRole}: ${res.user.full_name}`, 'success');
      navigate(`${targetRole}-overview`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function logout() {
    API.logout();
    state.currentUser = null;
    showToast('Signed out of session', 'info');
    navigate('landing');
  }

  function onSearchChange(val) {
    state.filters.search = val;
    // Debounced query could be added, direct for smooth responsiveness
    renderRoute(state.currentRoute);
  }

  function onSectorChange(val) {
    state.filters.sector = val;
    renderRoute(state.currentRoute);
  }

  function onStageChange(val) {
    state.filters.stage = val;
    renderRoute(state.currentRoute);
  }

  function resetFilters() {
    state.filters = { search: '', sector: 'All', stage: 'All' };
    renderRoute(state.currentRoute);
  }

  function promptPasswordRecovery() {
    const email = prompt('Enter your registered email for security reset code dispatch:');
    if (email) {
      API.recoverPassword(email).then(() => {
        showToast('If email exists, verification code dispatched.', 'success');
      });
    }
  }

  return {
    init,
    toggleTheme,
    navigate,
    switchDemoRole,
    logout,
    openStartupModal,
    openInterestModal,
    openKYCModal,
    closeModal,
    handleLoginForm,
    handleRegisterForm,
    handleCreateProposalForm,
    handleInterestSubmit,
    handleKYCSubmit,
    handleSendMessageForm,
    toggleSaveDeal,
    updateOfferStatus,
    adminReviewVenture,
    adminReviewKYC,
    selectConversation,
    onSearchChange,
    onSectorChange,
    onStageChange,
    resetFilters,
    promptPasswordRecovery
  };
})();

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
