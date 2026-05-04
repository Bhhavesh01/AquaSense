// --- DOM Elements ---
const authOverlay = document.getElementById('authOverlay');
const appContainer = document.getElementById('appContainer');

// Auth Tabs & Forms
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');
const pageTitle = document.getElementById('pageTitle');
const headerDate = document.getElementById('headerDate');
const logoutBtn = document.getElementById('logoutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');
const costRateInput = document.getElementById('costRate');
const alertBadge = document.getElementById('alertBadge');

// Add Usage Form Elements
const usageForm = document.getElementById('usageForm');
const dateInput = document.getElementById('date');
const bathingInput = document.getElementById('bathing');
const washingInput = document.getElementById('washing');
const cookingInput = document.getElementById('cooking');
const drinkingInput = document.getElementById('drinking');
const totalPreview = document.getElementById('totalPreview');

// Dashboard & Stats Elements
const todayUsageEl = document.getElementById('todayUsage');
const todayCostEl = document.getElementById('todayCost');
const predictedUsageEl = document.getElementById('predictedUsage');
const ecoScoreEl = document.getElementById('ecoScore');
const ecoProgressEl = document.getElementById('ecoProgress');
const recentActivityList = document.getElementById('recentActivityList');
const alertsList = document.getElementById('alertsList');
const suggestionsGrid = document.getElementById('suggestionsGrid');

// Charts
let dashboardChartInstance = null;
let analyticsChartInstance = null;
let breakdownChartInstance = null;

// --- State Variables ---
let currentUser = null;
let db = { users: {} }; // Mock Database

// --- Initialization ---
function init() {
    loadDatabase();
    headerDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    dateInput.valueAsDate = new Date(); // default form date to today

    // Check if session exists
    const sessionUserId = localStorage.getItem('aquaSense_session');
    if (sessionUserId && db.users[sessionUserId]) {
        loginUser(sessionUserId);
    }

    setupEventListeners();
}

function loadDatabase() {
    const saved = localStorage.getItem('aquaSense_db');
    if (saved) {
        db = JSON.parse(saved);
    } else {
        db = { users: {} };
    }
}

function saveDatabase() {
    localStorage.setItem('aquaSense_db', JSON.stringify(db));
}

// --- Event Listeners ---
function setupEventListeners() {
    // Auth Tabs
    tabLogin.addEventListener('click', () => switchAuthTab('login'));
    tabSignup.addEventListener('click', () => switchAuthTab('signup'));

    // Auth Forms
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    logoutBtn.addEventListener('click', handleLogout);

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            switchView(target);
            
            // Update active class
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Update Title
            pageTitle.textContent = item.querySelector('span').textContent;
        });
    });

    // Add Usage Preview Calculation
    [bathingInput, washingInput, cookingInput, drinkingInput].forEach(input => {
        input.addEventListener('input', () => {
            const b = Number(bathingInput.value) || 0;
            const w = Number(washingInput.value) || 0;
            const c = Number(cookingInput.value) || 0;
            const d = Number(drinkingInput.value) || 0;
            totalPreview.textContent = b + w + c + d;
        });
    });

    // Add Usage Submit
    usageForm.addEventListener('submit', handleAddUsage);

    // Cost Rate Change
    costRateInput.addEventListener('input', updateDashboardStats);
}

// --- Authentication Logic ---
function switchAuthTab(tab) {
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    } else {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    }
    loginError.textContent = '';
    signupError.textContent = '';
}

function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    // Basic validation
    let userExists = Object.values(db.users).some(u => u.email === email);
    if (userExists) {
        signupError.textContent = "Email already registered!";
        return;
    }

    const userId = 'user_' + Date.now();
    db.users[userId] = {
        name,
        email,
        password, // In real app, never store plain text password
        water_usage: {} // key: date (YYYY-MM-DD), value: usage object
    };
    saveDatabase();
    
    // Auto login
    loginUser(userId);
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const user = Object.entries(db.users).find(([id, u]) => u.email === email && u.password === password);
    
    if (user) {
        loginUser(user[0]);
    } else {
        loginError.textContent = "Invalid email or password";
    }
}

function loginUser(userId) {
    currentUser = userId;
    localStorage.setItem('aquaSense_session', userId);
    
    const user = db.users[userId];
    userNameDisplay.textContent = user.name;
    
    // Hide auth, show app
    authOverlay.style.display = 'none';
    appContainer.style.display = 'flex';
    
    // Default to dashboard
    switchView('dashboard');
    updateAllViews();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('aquaSense_session');
    
    // Reset forms
    loginForm.reset();
    signupForm.reset();
    
    // Show auth, hide app
    authOverlay.style.display = 'flex';
    appContainer.style.display = 'none';
    
    // Destroy charts
    if(dashboardChartInstance) dashboardChartInstance.destroy();
    if(analyticsChartInstance) analyticsChartInstance.destroy();
    if(breakdownChartInstance) breakdownChartInstance.destroy();
}

// --- Navigation Logic ---
function switchView(viewId) {
    viewSections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    updateAllViews(); // Refresh data on view change
}

// --- Core Data Logic ---
function handleAddUsage(e) {
    e.preventDefault();
    const date = dateInput.value;
    const bathing = Number(bathingInput.value) || 0;
    const washing = Number(washingInput.value) || 0;
    const cooking = Number(cookingInput.value) || 0;
    const drinking = Number(drinkingInput.value) || 0;
    const total_usage = bathing + washing + cooking + drinking;

    if (!db.users[currentUser].water_usage) {
        db.users[currentUser].water_usage = {};
    }

    // Store in DB
    db.users[currentUser].water_usage[date] = {
        date, bathing, washing, cooking, drinking, total_usage
    };
    saveDatabase();
    
    showToast();
    usageForm.reset();
    dateInput.valueAsDate = new Date();
    totalPreview.textContent = '0';
    
    // Go to dashboard to see update
    switchView('dashboard');
    document.querySelector('.nav-item[data-target="dashboard"]').click();
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- View Updaters ---
function updateAllViews() {
    if (!currentUser) return;
    updateDashboardStats();
    updateCharts();
    updateAlerts();
    updateSuggestions();
}

function getUsageDataArray() {
    if (!db.users[currentUser] || !db.users[currentUser].water_usage) return [];
    // Convert object to array, sort by date ascending
    return Object.values(db.users[currentUser].water_usage).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getTodayDateString() {
    const today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
}

function getLast7DaysData() {
    const allData = getUsageDataArray();
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // We want data from today back to 6 days ago (7 days total)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    
    return allData.filter(d => {
        const [year, month, day] = d.date.split('-');
        const dDate = new Date(year, month - 1, day);
        return dDate >= sevenDaysAgo && dDate <= today;
    });
}

function updateDashboardStats() {
    const allData = getUsageDataArray();
    
    // Today's Usage
    const todayStr = getTodayDateString();
    const todayData = db.users[currentUser].water_usage[todayStr];
    const todayTotal = todayData ? todayData.total_usage : 0;
    
    todayUsageEl.textContent = todayTotal + ' L';
    
    // Cost
    const rate = Number(costRateInput.value) || 0.05;
    todayCostEl.textContent = '₹' + (todayTotal * rate).toFixed(2);
    
    // Prediction (Average of last 7 days)
    const last7 = getLast7DaysData();
    let prediction = 0;
    if (last7.length > 0) {
        const sum = last7.reduce((acc, curr) => acc + curr.total_usage, 0);
        prediction = Math.round(sum / last7.length);
    }
    predictedUsageEl.textContent = prediction > 0 ? prediction + ' L' : 'N/A';
    
    // Eco Score
    let ecoScore = 'Excellent';
    let ecoColor = 'var(--secondary)';
    let progress = 100;
    
    if (todayTotal > 300) {
        ecoScore = 'Poor';
        ecoColor = 'var(--danger)';
        progress = 30;
    } else if (todayTotal > 150) {
        ecoScore = 'Moderate';
        ecoColor = 'var(--warning)';
        progress = 65;
    }
    
    ecoScoreEl.textContent = ecoScore;
    ecoScoreEl.style.color = ecoColor;
    ecoProgressEl.style.width = progress + '%';
    ecoProgressEl.style.backgroundColor = ecoColor;

    // Recent Activity List
    recentActivityList.innerHTML = '';
    const recentData = [...allData].reverse().slice(0, 7); // Last 7 entries
    if (recentData.length === 0) {
        recentActivityList.innerHTML = '<div class="empty-state">No data yet. Go to Add Usage!</div>';
    } else {
        recentData.forEach(d => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `
                <span class="activity-date">${d.date}</span>
                <span class="activity-val">${d.total_usage} L</span>
            `;
            recentActivityList.appendChild(div);
        });
    }
}

function updateCharts() {
    const last7 = getLast7DaysData();
    const dates = last7.map(d => d.date);
    const totals = last7.map(d => d.total_usage);
    
    // --- Dashboard Mini Chart ---
    if (document.getElementById('dashboard').classList.contains('active')) {
        const ctxDash = document.getElementById('dashboardChart').getContext('2d');
        if(dashboardChartInstance) dashboardChartInstance.destroy();
        dashboardChartInstance = new Chart(ctxDash, {
            type: 'line',
            data: {
                labels: dates.length ? dates : ['No Data'],
                datasets: [{
                    label: 'Total Usage (L)',
                    data: totals.length ? totals : [0],
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // --- Analytics Charts ---
    if (document.getElementById('analytics').classList.contains('active')) {
        // Detailed Line Chart
        const ctxAna = document.getElementById('analyticsChart').getContext('2d');
        if(analyticsChartInstance) analyticsChartInstance.destroy();
        analyticsChartInstance = new Chart(ctxAna, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [
                    { label: 'Bathing', data: last7.map(d => d.bathing), backgroundColor: '#0ea5e9' },
                    { label: 'Washing', data: last7.map(d => d.washing), backgroundColor: '#10b981' },
                    { label: 'Cooking', data: last7.map(d => d.cooking), backgroundColor: '#f59e0b' },
                    { label: 'Drinking', data: last7.map(d => d.drinking), backgroundColor: '#3b82f6' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
        });

        // Breakdown Pie Chart (Overall Average)
        let tB=0, tW=0, tC=0, tD=0;
        last7.forEach(d => { tB+=d.bathing; tW+=d.washing; tC+=d.cooking; tD+=d.drinking; });
        
        const ctxPie = document.getElementById('breakdownChart').getContext('2d');
        if(breakdownChartInstance) breakdownChartInstance.destroy();
        breakdownChartInstance = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: ['Bathing', 'Washing', 'Cooking', 'Drinking'],
                datasets: [{
                    data: [tB, tW, tC, tD],
                    backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#3b82f6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function updateAlerts() {
    const last7 = getLast7DaysData();
    
    alertsList.innerHTML = '';
    let hasAlert = false;

    if (last7.length > 1) {
        const sum = last7.reduce((acc, curr) => acc + curr.total_usage, 0);

        for (let i = last7.length - 1; i >= 0; i--) {
            const d = last7[i];
            const otherSum = sum - d.total_usage;
            const otherAvg = otherSum / (last7.length - 1);
            
            if (d.total_usage > (otherAvg * 1.3)) {
                hasAlert = true;
                const alertHtml = `
                    <div class="alert-box">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <div>
                            <div class="alert-title">High Usage Detected</div>
                            <div>Warning: High water usage detected on ${d.date}. Usage (${d.total_usage}L) is significantly higher than your average (${Math.round(otherAvg)}L).</div>
                        </div>
                    </div>
                `;
                alertsList.innerHTML += alertHtml;
            }
        }
    }

    if (!hasAlert) {
        alertsList.innerHTML = '<div class="empty-state">System looks good. No alerts!</div>';
        alertBadge.style.display = 'none';
    } else {
        alertBadge.style.display = 'inline-block';
    }
}

function updateSuggestions() {
    const todayStr = getTodayDateString();
    const todayData = db.users[currentUser].water_usage[todayStr];
    
    suggestionsGrid.innerHTML = '';
    let suggestions = [];

    if (todayData) {
        if (todayData.bathing > 50) {
            suggestions.push({
                icon: 'fa-shower',
                title: 'High Bathing Usage',
                desc: 'Consider reducing shower time by a few minutes to save significant water.'
            });
        }
        if (todayData.washing > 40) {
            suggestions.push({
                icon: 'fa-shirt',
                title: 'High Washing Usage',
                desc: 'Try to use the washing machine only with a full load.'
            });
        }
        if (todayData.total_usage > 200) {
            suggestions.push({
                icon: 'fa-tint-slash',
                title: 'High Overall Consumption',
                desc: 'Your total usage is quite high. Look for ways to reduce overall consumption across all activities.'
            });
        }
    }

    if (suggestions.length === 0) {
        let msg = todayData ? 'Your usage is perfectly optimized! Great job!' : 'Add some usage data to get suggestions.';
        suggestionsGrid.innerHTML = `<div class="empty-state">${msg}</div>`;
    } else {
        suggestions.forEach(s => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <i class="fa-solid ${s.icon}"></i>
                <div>
                    <div class="suggestion-title">${s.title}</div>
                    <div class="suggestion-desc">${s.desc}</div>
                </div>
            `;
            suggestionsGrid.appendChild(div);
        });
    }
}

// Start application
init();
