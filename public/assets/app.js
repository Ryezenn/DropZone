/* ==========================================================================
   NEOBRUTALISM CLIENT LOGIC — CODEDROP CLIENT APP
   ========================================================================== */

// 1. TOAST NOTIFICATION SYSTEM
const Toast = {
  containerId: 'toast-container',
  
  init() {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  },

  show(message, type = 'info', duration = 3000) {
    this.init();
    const container = document.getElementById(this.containerId);
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto dismiss
    setTimeout(() => {
      toast.classList.add('dismissing');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, duration);
  },
  
  success(message, duration) { this.show(message, 'success', duration); },
  error(message, duration) { this.show(message, 'error', duration); },
  info(message, duration) { this.show(message, 'info', duration); }
};

// 2. HTTP UTILITIES WITH AUTO AUTHORIZATION HEADERS
const API = {
  getToken(role = 'user') {
    return localStorage.getItem(role === 'admin' ? 'adminToken' : 'token');
  },
  
  getHeaders(role = 'user', isMultipart = false) {
    const headers = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    const token = this.getToken(role);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async request(url, method = 'GET', body = null, role = 'user', isMultipart = false) {
    const options = {
      method,
      headers: this.getHeaders(role, isMultipart)
    };

    if (body) {
      options.body = isMultipart ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`API Error [${method} ${url}]:`, error.message);
      throw error;
    }
  }
};

// 3. FRONTEND SHARED INITIALIZATIONS
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  updateNavbarAuth();
  
  // Detect current page and call corresponding initialization function
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';
  
  if (page === 'index.html' || page === '') {
    initIndexPage();
  } else if (page === 'register.html') {
    initRegisterPage();
  } else if (page === 'login.html') {
    initLoginPage();
  } else if (page === 'dashboard.html') {
    initDashboardPage();
  } else if (page === 'admin-login.html') {
    initAdminLoginPage();
  } else if (page === 'admin.html') {
    initAdminPanelPage();
  }
});

// Update navbar elements depending on auth state
function updateNavbarAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  const navKanan = document.getElementById('nav-auth-section');
  if (!navKanan) return;
  
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      const initials = user.username.substring(0, 2);
      navKanan.innerHTML = `
        <div class="user-tag">
          <div class="avatar-circle">${initials}</div>
          <span>@${user.username}</span>
        </div>
        <a href="dashboard.html" class="nav-link">Dashboard</a>
        <button id="btn-logout" class="btn-outline btn-sm">Logout</button>
      `;
      
      document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        Toast.success('Logged out successfully!');
        setTimeout(() => window.location.href = 'index.html', 1000);
      });
    } catch (e) {
      console.error('Failed to parse user data', e);
      clearUserAuth();
    }
  } else {
    navKanan.innerHTML = `
      <a href="login.html" class="btn-outline">Login</a>
      <a href="register.html" class="btn-primary" style="background-color: var(--dark); color: var(--primary); box-shadow: 3px 3px 0 var(--primary);">Register →</a>
    `;
  }
}

function clearUserAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// 4. PUBLIC HOME PAGE LOGIC (index.html)
let indexFilters = {
  type: 'all',
  search: '',
  sort: 'latest',
  username: ''
};

async function initIndexPage() {
  // Load Stats
  try {
    const stats = await API.request('/api/projects/stats-placeholder', 'GET'); // We can fetch from public or custom
  } catch (e) {
    // We can fetch via admin route or a public route. Let's make an endpoint in public projects router or get from projects database.
  }
  
  // Actually, we can fetch stats directly from the admin stats endpoint, but admin auth is required.
  // Instead, let's create a public statistics lookup or aggregate statistics directly.
  // Let's implement a public statistics retrieve on backend.
  loadPublicStats();
  loadPublicProjects();
  setupIndexEvents();
}

async function loadPublicStats() {
  try {
    // We can query a simple statistics endpoint. In routes/projects.js let's add one if needed, or query count directly.
    // Let's fetch the actual count from an endpoint GET /api/projects/stats
    // Wait, the project schema includes a stats method. Let's load it from a public API.
    const response = await fetch('/api/projects'); // we can also sum them locally or call a special helper
    const projects = await response.json();
    
    const totalProjects = projects.length;
    const uniqueUsers = new Set(projects.map(p => p.ownerUsername)).size;
    const totalDownloads = projects.reduce((acc, p) => acc + (p.downloadCount || 0), 0);
    
    const projStatEl = document.getElementById('stat-total-projects');
    const userStatEl = document.getElementById('stat-total-users');
    const dlStatEl = document.getElementById('stat-total-downloads');
    
    if (projStatEl) projStatEl.textContent = totalProjects;
    if (userStatEl) userStatEl.textContent = uniqueUsers;
    if (dlStatEl) dlStatEl.textContent = totalDownloads;
  } catch (err) {
    console.error('Error loading stats', err);
  }
}

async function loadPublicProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  
  // Show loading skeleton
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-block" style="height: 40px; width: 40%;"></div>
      <div class="skeleton-block" style="height: 180px; width: 100%;"></div>
      <div class="skeleton-block" style="height: 24px; width: 80%;"></div>
      <div class="skeleton-block" style="height: 60px; width: 100%;"></div>
    </div>
  `).join('');

  try {
    const queryParams = new URLSearchParams(indexFilters).toString();
    const projects = await API.request(`/api/projects?${queryParams}`, 'GET');
    
    if (projects.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; padding: 40px; text-align: center; border: 2px solid var(--dark); background: var(--surface);">
          <h3 style="margin-bottom: 8px;">No projects found</h3>
          <p style="color: var(--muted);">Try matching different keywords, category tags, or clearing filters.</p>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
    
    // Attach event listeners to project cards
    document.querySelectorAll('.owner-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const username = chip.getAttribute('data-username');
        indexFilters.username = username;
        
        const userFilterInput = document.getElementById('filter-username-input');
        if (userFilterInput) {
          userFilterInput.value = username;
        }
        loadPublicProjects();
      });
    });
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger); text-align: center;">Failed to load projects. ${err.message}</div>`;
  }
}

function renderProjectCard(p) {
  const isWebsite = p.type === 'website';
  const typeBadgeClass = isWebsite ? 'website' : 'file';
  const typeText = isWebsite ? 'Website' : 'File';
  
  let footerAction = '';
  if (isWebsite) {
    footerAction = `<a href="${p.websiteUrl}" target="_blank" class="btn-dark btn-sm w-full">Visit Site →</a>`;
  } else {
    footerAction = `
      <div class="file-info">${p.fileType.toUpperCase()} • ${(p.fileSize / 1024 / 1024).toFixed(2)} MB</div>
      <a href="/api/projects/${p._id}/download" class="btn-primary btn-sm" style="box-shadow: 2px 2px 0 var(--dark);">Download →</a>
    `;
  }

  const featuredBadgeHtml = p.featured ? `<div class="featured-badge">FEATURED</div>` : '';
  const dateStr = new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const initials = p.ownerUsername.substring(0, 2);

  // Preview Area
  let previewHtml = '';
  if (isWebsite && p.previewImage) {
    previewHtml = `<img src="${p.previewImage}" alt="${p.title}" onerror="this.onerror=null; this.src='/assets/placeholder-web.png';">`;
  } else if (isWebsite) {
    previewHtml = `
      <div class="card-preview-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
        <span>Website Preview</span>
      </div>
    `;
  } else {
    previewHtml = `
      <div class="card-preview-placeholder" style="color: var(--secondary);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span>${p.fileName}</span>
      </div>
    `;
  }

  // Tags & Tech
  const tagsList = isWebsite ? p.techStack : p.tags;
  const tagsHtml = tagsList && tagsList.length > 0 
    ? `<div class="card-tech">${tagsList.map(t => `<span class="tech-tag">${t}</span>`).join('')}</div>`
    : '';

  const downloadCounterHtml = !isWebsite ? `<div style="font-size: 11px; font-weight: 700; color: var(--muted);">Downloads: ${p.downloadCount || 0}</div>` : '';

  return `
    <div class="card">
      ${featuredBadgeHtml}
      <div class="card-header">
        <span class="card-type-badge ${typeBadgeClass}">${typeText}</span>
        <span style="font-size: 12px; color: var(--muted); font-family: var(--font-mono);">${dateStr}</span>
      </div>
      <div class="card-preview">${previewHtml}</div>
      <div class="card-body">
        <h3 class="card-title">${p.title}</h3>
        <div class="owner-chip" data-username="${p.ownerUsername}">
          <div class="owner-avatar-mini">${initials}</div>
          <span>@${p.ownerUsername}</span>
        </div>
        <p class="card-desc">${p.description}</p>
        ${tagsHtml}
      </div>
      <div class="card-footer">
        <div>
          ${downloadCounterHtml}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${footerAction}
        </div>
      </div>
    </div>
  `;
}

function setupIndexEvents() {
  // Category Link in Navbar Header
  const navLinks = document.querySelectorAll('.nav-category-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      indexFilters.type = link.getAttribute('data-type');
      
      // sync with filter bar buttons
      const filterBarBtns = document.querySelectorAll('.filter-btn');
      filterBarBtns.forEach(btn => {
        if (btn.getAttribute('data-type') === indexFilters.type) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      loadPublicProjects();
    });
  });

  // Filter Bar Buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      indexFilters.type = btn.getAttribute('data-type');

      // sync with nav links
      navLinks.forEach(l => {
        if (l.getAttribute('data-type') === indexFilters.type) {
          l.classList.add('active');
        } else {
          l.classList.remove('active');
        }
      });
      loadPublicProjects();
    });
  });

  // Search input
  const searchInput = document.getElementById('search-project-input');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        indexFilters.search = searchInput.value;
        loadPublicProjects();
      }, 300);
    });
  }

  // Custom Sort Dropdown
  const sortDropdown = document.getElementById('custom-sort-dropdown');
  const sortTrigger = document.getElementById('sort-dropdown-trigger');
  const sortLabel = document.getElementById('sort-dropdown-selected-label');
  
  if (sortDropdown && sortTrigger) {
    sortTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      sortDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!sortDropdown.contains(e.target)) {
        sortDropdown.classList.remove('open');
      }
    });

    const sortItems = sortDropdown.querySelectorAll('.dropdown-item');
    sortItems.forEach(item => {
      item.addEventListener('click', () => {
        const value = item.getAttribute('data-value');
        const label = item.textContent;

        indexFilters.sort = value;
        sortLabel.textContent = label;

        sortItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        sortDropdown.classList.remove('open');
        loadPublicProjects();
      });
    });
  }

  // Filter by User input
  const userFilterInput = document.getElementById('filter-username-input');
  if (userFilterInput) {
    let timeout = null;
    userFilterInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        indexFilters.username = userFilterInput.value;
        loadPublicProjects();
      }, 300);
    });
  }
  
  // CTA Hero Buttons
  const heroCtaUpload = document.getElementById('hero-cta-upload');
  if (heroCtaUpload) {
    heroCtaUpload.addEventListener('click', (e) => {
      e.preventDefault();
      const token = localStorage.getItem('token');
      if (token) {
        window.location.href = 'dashboard.html#upload';
      } else {
        window.location.href = 'register.html';
      }
    });
  }
}

// 5. REGISTER PAGE LOGIC (register.html)
function initRegisterPage() {
  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = 'dashboard.html';
    return;
  }
  const form = document.getElementById('register-form');
  const usernameInput = document.getElementById('reg-username');
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');
  const confirmPasswordInput = document.getElementById('reg-confirm-password');
  
  if (!form) return;

  // Realtime username check
  let usernameTimeout = null;
  usernameInput.addEventListener('input', () => {
    clearTimeout(usernameTimeout);
    const feedback = document.getElementById('username-feedback');
    const u = usernameInput.value.trim();
    
    if (u.length === 0) {
      feedback.textContent = '';
      return;
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(u)) {
      feedback.textContent = '✗ Must be 3-20 alphanumeric characters or underscores';
      feedback.className = 'feedback-text error';
      return;
    }

    feedback.textContent = 'Checking availability...';
    feedback.className = 'feedback-text info';

    usernameTimeout = setTimeout(async () => {
      try {
        const res = await API.request(`/api/auth/check-username?u=${u}`, 'GET');
        if (res.available) {
          feedback.textContent = '✓ Available';
          feedback.className = 'feedback-text success';
        } else {
          feedback.textContent = res.reason ? `✗ ${res.reason}` : '✗ Username taken';
          feedback.className = 'feedback-text error';
        }
      } catch (err) {
        feedback.textContent = '✗ Error checking availability';
        feedback.className = 'feedback-text error';
      }
    }, 400);
  });

  // Password strength progress
  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    const bars = document.querySelectorAll('.strength-bar');
    bars.forEach(b => b.className = 'strength-bar'); // Reset classes
    
    if (val.length === 0) return;
    
    const hasMixed = /[a-z]/.test(val) && /[A-Z]/.test(val);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(val);
    const isLong = val.length >= 8;

    if (!isLong) {
      bars[0].classList.add('weak');
    } else if (isLong && (!hasMixed || !hasSpecial)) {
      bars[0].classList.add('medium');
      bars[1].classList.add('medium');
    } else {
      bars[0].classList.add('strong');
      bars[1].classList.add('strong');
      bars[2].classList.add('strong');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Form client-side validation
    if (!username || !email || !password || !confirmPassword) {
      Toast.error('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Toast.error('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      Toast.error('Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await API.request('/api/auth/register', 'POST', { username, email, password });
      Toast.success('Registration successful! Redirecting to login...');
      setTimeout(() => window.location.href = 'login.html', 1500);
    } catch (err) {
      Toast.error(err.message || 'Registration failed.');
    }
  });
}

// 6. LOGIN PAGE LOGIC (login.html)
function initLoginPage() {
  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = 'dashboard.html';
    return;
  }
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      Toast.error('Please enter both email and password.');
      return;
    }

    try {
      const res = await API.request('/api/auth/login', 'POST', { email, password });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      
      Toast.success('Login successful!');
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } catch (err) {
      Toast.error(err.message || 'Login failed.');
    }
  });
}

// 7. USER DASHBOARD LOGIC (dashboard.html)
let dashboardProjects = [];
let currentEditingProjectId = null;

function initDashboardPage() {
  const token = localStorage.getItem('token');
  if (!token) {
    Toast.error('Please login to access the dashboard.');
    window.location.href = 'login.html';
    return;
  }

  // Load User Info
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('dash-username-display').textContent = `@${user.username}`;
  
  // Set joined date formatted
  const joinedDate = new Date(user.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const joinedDateEl = document.getElementById('stat-joined-date');
  if (joinedDateEl) joinedDateEl.textContent = joinedDate;

  loadUserStats();
  loadUserProjects();
  setupDashboardEvents();
  
  // Check for auto action hash (e.g. #upload)
  if (window.location.hash === '#upload') {
    openUploadWebsiteModal();
  }
}

async function loadUserStats() {
  try {
    const projects = await API.request('/api/user/projects', 'GET', null, 'user');
    dashboardProjects = projects;
    
    const myProjectsCount = projects.length;
    const myDownloadsCount = projects.reduce((acc, p) => acc + (p.downloadCount || 0), 0);
    
    document.getElementById('stat-my-projects').textContent = myProjectsCount;
    document.getElementById('stat-my-downloads').textContent = myDownloadsCount;
  } catch (err) {
    console.error('Failed to load user stats', err);
  }
}

async function loadUserProjects() {
  const tableBody = document.getElementById('my-projects-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 32px;">
        <span style="font-weight: 700;">Loading projects...</span>
      </td>
    </tr>
  `;

  try {
    const projects = await API.request('/api/user/projects', 'GET', null, 'user');
    dashboardProjects = projects;

    if (projects.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--muted);">
            You have not uploaded any projects yet. Click one of the buttons to add a website or file project!
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = projects.map(p => {
      const dateStr = new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const dlCount = p.type === 'website' ? '-' : (p.downloadCount || 0);
      const typeLabel = p.type === 'website' ? '🌐 Website' : '📁 File';
      
      return `
        <tr>
          <td style="font-weight: 700; font-size: 15px;">${p.title}</td>
          <td><span class="badge" style="background-color: ${p.type === 'website' ? 'var(--primary)' : 'var(--secondary)'}; color: ${p.type === 'website' ? 'var(--dark)' : '#FFFFFF'};">${typeLabel}</span></td>
          <td style="font-family: var(--font-mono); font-weight: 600;">${dlCount}</td>
          <td>${dateStr}</td>
          <td>
            <div class="action-buttons-group">
              <button class="btn-dark btn-sm btn-edit-project" data-id="${p._id}">Edit</button>
              <button class="btn-danger btn-sm btn-delete-project" data-id="${p._id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    document.querySelectorAll('.btn-edit-project').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditProjectModal(id);
      });
    });

    document.querySelectorAll('.btn-delete-project').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openDeleteConfirmModal(id);
      });
    });
  } catch (err) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 32px; color: var(--danger); font-weight: 700;">
          Failed to load your projects. ${err.message}
        </td>
      </tr>
    `;
  }
}

function setupDashboardEvents() {
  // Sidebar Tabs
  const menuItems = document.querySelectorAll('.dashboard-menu-tab');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      menuItems.forEach(i => i.parentElement.classList.remove('active'));
      item.parentElement.classList.add('active');
      
      const targetSection = item.getAttribute('data-section');
      
      document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
      document.getElementById(`section-${targetSection}`).style.display = 'block';
      
      if (targetSection === 'projects') {
        loadUserProjects();
      } else if (targetSection === 'profile') {
        loadUserProfileTab();
      }
    });
  });

  // Modal Close buttons
  document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
    });
  });

  // Open modals
  const btnAddWeb = document.getElementById('btn-add-website');
  if (btnAddWeb) btnAddWeb.addEventListener('click', openUploadWebsiteModal);

  const btnAddFile = document.getElementById('btn-add-file');
  if (btnAddFile) btnAddFile.addEventListener('click', openUploadFileModal);

  // Upload Website Form Submit
  const formWeb = document.getElementById('form-upload-website');
  if (formWeb) {
    formWeb.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('web-title').value.trim();
      const description = document.getElementById('web-description').value.trim();
      const websiteUrl = document.getElementById('web-url').value.trim();
      const previewImage = document.getElementById('web-preview').value.trim();
      const techStack = document.getElementById('web-tech').value.trim();
      const tags = document.getElementById('web-tags').value.trim();

      if (!title || !description || !websiteUrl) {
        Toast.error('Title, Description, and Website URL are required.');
        return;
      }

      try {
        await API.request('/api/user/projects/website', 'POST', {
          title, description, websiteUrl, previewImage, techStack, tags
        }, 'user');
        
        Toast.success('Website project added successfully!');
        document.getElementById('modal-upload-website').classList.remove('show');
        formWeb.reset();
        loadUserStats();
        loadUserProjects();
        const projectsTab = document.querySelector('.dashboard-menu-tab[data-section="projects"]');
        if (projectsTab) projectsTab.click();
      } catch (err) {
        Toast.error(err.message || 'Failed to upload website project.');
      }
    });
  }

  // Upload File Drag & Drop Field setup
  setupDragAndDrop();

  // Upload File Form Submit
  const formFile = document.getElementById('form-upload-file');
  const fileInput = document.getElementById('file-upload-input');
  if (formFile) {
    formFile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('file-title').value.trim();
      const description = document.getElementById('file-description').value.trim();
      const tags = document.getElementById('file-tags').value.trim();
      const file = fileInput.files[0];

      if (!title || !description) {
        Toast.error('Title and Description are required.');
        return;
      }

      if (!file) {
        Toast.error('Please select a file to upload.');
        return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', tags);
      formData.append('file', file);

      try {
        Toast.info('Uploading file... Please wait.');
        const res = await API.request('/api/user/projects/file', 'POST', formData, 'user', true);
        Toast.success('File project uploaded successfully!');
        document.getElementById('modal-upload-file').classList.remove('show');
        formFile.reset();
        document.getElementById('drag-drop-selected-name').textContent = '';
        loadUserStats();
        loadUserProjects();
        const projectsTab = document.querySelector('.dashboard-menu-tab[data-section="projects"]');
        if (projectsTab) projectsTab.click();
      } catch (err) {
        Toast.error(err.message || 'File upload failed.');
      }
    });
  }

  // Edit Project Form Submit
  const formEdit = document.getElementById('form-edit-project');
  if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('edit-title').value.trim();
      const description = document.getElementById('edit-description').value.trim();
      const tags = document.getElementById('edit-tags').value.trim();
      
      // Determine website specific fields
      const webUrlEl = document.getElementById('edit-web-url');
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', tags);
      
      if (webUrlEl && webUrlEl.offsetParent !== null) {
        formData.append('websiteUrl', webUrlEl.value.trim());
        formData.append('previewImage', document.getElementById('edit-preview-image').value.trim());
        formData.append('techStack', document.getElementById('edit-tech-stack').value.trim());
      } else {
        // File type edit: check if new file is selected
        const newFile = document.getElementById('edit-file-input').files[0];
        if (newFile) {
          formData.append('file', newFile);
        }
      }

      try {
        Toast.info('Saving changes...');
        await API.request(`/api/user/projects/${currentEditingProjectId}`, 'PUT', formData, 'user', true);
        Toast.success('Project updated successfully!');
        document.getElementById('modal-edit-project').classList.remove('show');
        loadUserStats();
        loadUserProjects();
      } catch (err) {
        Toast.error(err.message || 'Failed to update project.');
      }
    });
  }

  // Delete Confirm Button
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      const id = btnConfirmDelete.getAttribute('data-id');
      try {
        await API.request(`/api/user/projects/${id}`, 'DELETE', null, 'user');
        Toast.success('Project deleted successfully.');
        document.getElementById('modal-delete-confirm').classList.remove('show');
        loadUserStats();
        loadUserProjects();
      } catch (err) {
        Toast.error(err.message || 'Failed to delete project.');
      }
    });
  }

  // Profile Form Save
  const formProfile = document.getElementById('form-profile');
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // For now, let's keep bio and avatar updates local or save to local Storage/custom user settings
      // We can also submit username/email edit if desired, or bio. Mongoose schema has user.bio and user.avatar.
      // Let's implement an endpoint for profile updates: PUT /api/user/profile if needed.
      // Or save in user model.
      // In User.js, we have bio and avatar. Let's make a mock save or create user endpoint later.
      // Let's save inside localStorage and show a feedback.
      const user = JSON.parse(localStorage.getItem('user'));
      user.bio = document.getElementById('profile-bio').value;
      user.avatar = document.getElementById('profile-avatar').value;
      
      try {
        // Option to put to a user update endpoint. Since we don't have user update in specs, we can update locally
        // or trigger save. Let's mock the profile update success.
        localStorage.setItem('user', JSON.stringify(user));
        Toast.success('Profile saved successfully (Mock)!');
        updateNavbarAuth();
      } catch (e) {
        Toast.error('Profile save failed.');
      }
    });
  }
}

function setupDragAndDrop() {
  const area = document.getElementById('file-drag-drop-area');
  const input = document.getElementById('file-upload-input');
  const label = document.getElementById('drag-drop-selected-name');
  
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });

  area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
  });

  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      input.files = e.dataTransfer.files;
      label.textContent = `Selected: ${input.files[0].name} (${(input.files[0].size / 1024 / 1024).toFixed(2)} MB)`;
    }
  });

  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      label.textContent = `Selected: ${input.files[0].name} (${(input.files[0].size / 1024 / 1024).toFixed(2)} MB)`;
    }
  });
}

function openUploadWebsiteModal() {
  const tab = document.querySelector('.dashboard-menu-tab[data-section="upload-website"]');
  if (tab) {
    tab.click();
  } else {
    const section = document.getElementById('section-upload-website');
    if (section) {
      document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
      section.style.display = 'block';
    }
  }
}

function openUploadFileModal() {
  const tab = document.querySelector('.dashboard-menu-tab[data-section="upload-file"]');
  if (tab) {
    tab.click();
  } else {
    const section = document.getElementById('section-upload-file');
    if (section) {
      document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
      section.style.display = 'block';
    }
  }
}

function openEditProjectModal(id) {
  currentEditingProjectId = id;
  const project = dashboardProjects.find(p => p._id === id);
  if (!project) return;

  const modal = document.getElementById('modal-edit-project');
  
  // Fill common fields
  document.getElementById('edit-title').value = project.title;
  document.getElementById('edit-description').value = project.description;
  document.getElementById('edit-tags').value = project.tags.join(', ');

  // Conditional Rendering Website vs File Form items
  const container = document.getElementById('edit-conditional-fields');
  
  if (project.type === 'website') {
    container.innerHTML = `
      <div class="form-group">
        <label for="edit-web-url">Website URL *</label>
        <input type="url" id="edit-web-url" value="${project.websiteUrl}" required>
      </div>
      <div class="form-group">
        <label for="edit-preview-image">Preview Image URL</label>
        <input type="url" id="edit-preview-image" value="${project.previewImage}">
      </div>
      <div class="form-group">
        <label for="edit-tech-stack">Tech Stack (comma separated)</label>
        <input type="text" id="edit-tech-stack" value="${project.techStack.join(', ')}">
      </div>
    `;
  } else {
    // File upload edit options
    container.innerHTML = `
      <div class="form-group">
        <label>Current File</label>
        <div style="font-family: var(--font-mono); font-size: 13px; background: var(--surface-2); padding: 8px; border: var(--border);">
          ${project.fileName} (${(project.fileSize / 1024 / 1024).toFixed(2)} MB)
        </div>
      </div>
      <div class="form-group">
        <label for="edit-file-input">Replace File (Optional)</label>
        <input type="file" id="edit-file-input" style="background: transparent; border: none; padding: 0;">
      </div>
    `;
  }

  modal.classList.add('show');
}

function openDeleteConfirmModal(id) {
  const btn = document.getElementById('btn-confirm-delete');
  btn.setAttribute('data-id', id);
  document.getElementById('modal-delete-confirm').classList.add('show');
}

function loadUserProfileTab() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('profile-username').value = user.username;
  document.getElementById('profile-email').value = user.email;
  document.getElementById('profile-bio').value = user.bio || '';
  document.getElementById('profile-avatar').value = user.avatar || '';
}

// 8. ADMIN LOGIN LOGIC (admin-login.html)
function initAdminLoginPage() {
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken) {
    window.location.href = 'admin.html';
    return;
  }
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!username || !password) {
      Toast.error('Please enter both username and password.');
      return;
    }

    try {
      const res = await API.request('/api/admin-auth/login', 'POST', { username, password });
      localStorage.setItem('adminToken', res.token);
      localStorage.setItem('adminUser', JSON.stringify(res.admin));
      
      Toast.success('Admin login successful!');
      setTimeout(() => window.location.href = 'admin.html', 1000);
    } catch (err) {
      Toast.error(err.message || 'Admin Login failed.');
    }
  });
}

// 9. ADMIN PANEL LOGIC (admin.html)
let adminProjectsList = [];
let adminUsersList = [];

function initAdminPanelPage() {
  const adminToken = localStorage.getItem('adminToken');
  if (!adminToken) {
    Toast.error('Access denied. Admin authorization required.');
    window.location.href = 'admin-login.html';
    return;
  }

  const admin = JSON.parse(localStorage.getItem('adminUser'));
  document.getElementById('admin-username-display').textContent = `Admin: @${admin.username}`;

  // Tab switching inside admin panel
  setupAdminTabs();

  // Load Initial Section data
  loadAdminProjects();

  // Admin Actions Setup
  setupAdminActionEvents();
}

function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-menu-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      tabs.forEach(t => t.parentElement.classList.remove('active'));
      tab.parentElement.classList.add('active');

      const targetSection = tab.getAttribute('data-section');
      document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
      document.getElementById(`admin-${targetSection}`).style.display = 'block';

      if (targetSection === 'projects') {
        loadAdminProjects();
      } else if (targetSection === 'users') {
        loadAdminUsers();
      } else if (targetSection === 'stats') {
        loadAdminStats();
      }
    });
  });

  // Admin Logout button
  document.getElementById('admin-btn-logout').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    Toast.success('Admin logged out.');
    setTimeout(() => window.location.href = 'admin-login.html', 1000);
  });
}

async function loadAdminProjects() {
  const tableBody = document.getElementById('admin-projects-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px;">Loading projects...</td></tr>`;

  try {
    const projects = await API.request('/api/admin/projects', 'GET', null, 'admin');
    adminProjectsList = projects;

    if (projects.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--muted);">No projects uploaded yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = projects.map(p => {
      const dateStr = new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const typeBadgeColor = p.type === 'website' ? 'var(--primary)' : 'var(--secondary)';
      const typeBadgeText = p.type === 'website' ? '🌐 Web' : '📁 File';
      const isFeaturedChecked = p.featured ? 'checked' : '';

      return `
        <tr>
          <td style="font-weight: 700;">${p.title}</td>
          <td>@${p.ownerUsername}</td>
          <td><span class="badge" style="background-color: ${typeBadgeColor}; color: ${p.type === 'website' ? 'var(--dark)' : '#FFFFFF'};">${typeBadgeText}</span></td>
          <td>${dateStr}</td>
          <td style="text-align: center;">
            <input type="checkbox" class="toggle-featured-checkbox admin-feature-checkbox" data-id="${p._id}" ${isFeaturedChecked}>
          </td>
          <td>
            <button class="btn-danger btn-sm admin-delete-project" data-id="${p._id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Action Events
    document.querySelectorAll('.admin-feature-checkbox').forEach(box => {
      box.addEventListener('change', async () => {
        const id = box.getAttribute('data-id');
        try {
          await API.request(`/api/admin/projects/${id}/featured`, 'PATCH', null, 'admin');
          Toast.success('Featured status updated.');
        } catch (err) {
          Toast.error(err.message || 'Failed to update featured status.');
          box.checked = !box.checked; // Revert checkbox
        }
      });
    });

    document.querySelectorAll('.admin-delete-project').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openAdminDeleteProjectConfirm(id);
      });
    });

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--danger);">Failed to load projects: ${err.message}</td></tr>`;
  }
}

async function loadAdminUsers() {
  const tableBody = document.getElementById('admin-users-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px;">Loading users...</td></tr>`;

  try {
    const users = await API.request('/api/admin/users', 'GET', null, 'admin');
    adminUsersList = users;

    if (users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--muted);">No registered users yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = users.map(u => {
      const joinedDate = new Date(u.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <tr>
          <td style="font-weight: 700;">@${u.username}</td>
          <td>${u.email}</td>
          <td style="font-family: var(--font-mono); font-weight: 600;">${u.projectCount || 0}</td>
          <td>${joinedDate}</td>
          <td>
            <div class="action-buttons-group">
              <button class="btn-dark btn-sm admin-view-user-projects" data-username="${u.username}">View Projects</button>
              <button class="btn-danger btn-sm admin-delete-user" data-id="${u._id}">Delete User</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach events
    document.querySelectorAll('.admin-view-user-projects').forEach(btn => {
      btn.addEventListener('click', () => {
        const username = btn.getAttribute('data-username');
        // Redirect to index page with user filter
        window.location.href = `index.html?username=${username}`;
      });
    });

    document.querySelectorAll('.admin-delete-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openAdminDeleteUserConfirm(id);
      });
    });

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--danger);">Failed to load users: ${err.message}</td></tr>`;
  }
}

async function loadAdminStats() {
  try {
    const stats = await API.request('/api/admin/stats', 'GET', null, 'admin');
    
    // Fill Cards
    document.getElementById('admin-stat-total-projects').textContent = stats.totalProjects;
    document.getElementById('admin-stat-total-users').textContent = stats.totalUsers;
    document.getElementById('admin-stat-total-downloads').textContent = stats.totalDownloads;
    document.getElementById('admin-stat-total-size').textContent = `${(stats.totalFilesSize / 1024 / 1024).toFixed(2)} MB`;

    // Render CSS bar chart
    renderStatsChart(stats.uploadHistory);
  } catch (err) {
    console.error('Failed to load stats', err);
    Toast.error('Failed to load admin statistics.');
  }
}

function renderStatsChart(history) {
  const chartContainer = document.getElementById('admin-stats-chart-wrapper');
  if (!chartContainer) return;

  const maxCount = Math.max(...history.map(h => h.count), 1); // Avoid division by 0

  chartContainer.innerHTML = history.map((day, index) => {
    // Calculate percentage height
    const heightPercent = Math.min((day.count / maxCount) * 100, 100);
    // highlight the latest day
    const isHighlight = index === history.length - 1 ? 'highlight' : '';

    return `
      <div class="chart-col">
        <div class="chart-bar-value">${day.count}</div>
        <div class="chart-bar ${isHighlight}" style="height: ${heightPercent}%;"></div>
        <div class="chart-label">${day.label}</div>
      </div>
    `;
  }).join('');
}

function setupAdminActionEvents() {
  // Common Modal closes
  document.querySelectorAll('.admin-modal-close, .btn-admin-modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
    });
  });

  // Admin Delete Project Confirm
  const confirmProjBtn = document.getElementById('btn-admin-confirm-delete-project');
  if (confirmProjBtn) {
    confirmProjBtn.addEventListener('click', async () => {
      const id = confirmProjBtn.getAttribute('data-id');
      try {
        await API.request(`/api/admin/projects/${id}`, 'DELETE', null, 'admin');
        Toast.success('Project deleted by Admin.');
        document.getElementById('modal-admin-delete-project').classList.remove('show');
        loadAdminProjects();
      } catch (err) {
        Toast.error(err.message || 'Failed to delete project.');
      }
    });
  }

  // Admin Delete User Confirm
  const confirmUserBtn = document.getElementById('btn-admin-confirm-delete-user');
  if (confirmUserBtn) {
    confirmUserBtn.addEventListener('click', async () => {
      const id = confirmUserBtn.getAttribute('data-id');
      try {
        await API.request(`/api/admin/users/${id}`, 'DELETE', null, 'admin');
        Toast.success('User and all associated uploads deleted successfully.');
        document.getElementById('modal-admin-delete-user').classList.remove('show');
        loadAdminUsers();
      } catch (err) {
        Toast.error(err.message || 'Failed to delete user.');
      }
    });
  }
}

function openAdminDeleteProjectConfirm(id) {
  const btn = document.getElementById('btn-admin-confirm-delete-project');
  btn.setAttribute('data-id', id);
  document.getElementById('modal-admin-delete-project').classList.add('show');
}

function openAdminDeleteUserConfirm(id) {
  const btn = document.getElementById('btn-admin-confirm-delete-user');
  btn.setAttribute('data-id', id);
  document.getElementById('modal-admin-delete-user').classList.add('show');
}
