const STORAGE_KEY = 'ubercontrol_transactions';
const GOAL_KEY = 'ubercontrol_goal';
const ITEMS_PER_PAGE = 10;

let transactions = [];
let dailyGoalValue = 0;
let currentPage = 1;
let deleteTargetId = null;
let currentPeriod = 'week';
let charts = {};

const elements = {};

function initElements() {
    const ids = [
        'todayNet', 'todayEarnings', 'todayExpenses',
        'goalCurrent', 'goalTarget', 'goalProgressBar', 'goalPercent', 'goalStatus',
        'hoursWorked', 'hourlyRate', 'totalKmToday', 'kmPerReal',
        'periodEarnings', 'periodExpenses', 'periodNet', 'periodAverage', 'periodKm', 'periodTrips',
        'transactionsList', 'emptyState', 'pagination', 'prevPage', 'nextPage', 'pageInfo',
        'filterType', 'filterPeriod',
        'btnAddEarning', 'btnAddExpense', 'btnEditGoal', 'btnSettings',
        'earningModal', 'expenseModal', 'goalModal', 'settingsModal', 'deleteModal',
        'closeEarningModal', 'closeExpenseModal', 'closeGoalModal', 'closeSettingsModal', 'closeDeleteModal',
        'earningForm', 'expenseForm', 'goalForm',
        'cancelDelete', 'confirmDelete',
        'earningDate', 'expenseDate',
        'btnExport', 'btnImport', 'importFile', 'btnClearData',
        'toast'
    ];
    
    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

function init() {
    initElements();
    loadTransactions();
    loadGoal();
    setupEventListeners();
    setDefaultDates();
    updateAllStats();
    renderTransactions();
    initCharts();
}

function loadTransactions() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            transactions = JSON.parse(stored);
        } catch (e) {
            console.error('Erro ao carregar transações:', e);
            transactions = [];
        }
    }
}

function loadGoal() {
    const stored = localStorage.getItem(GOAL_KEY);
    if (stored) {
        try {
            dailyGoalValue = parseFloat(stored) || 0;
        } catch (e) {
            dailyGoalValue = 0;
        }
    }
}

function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function saveGoal() {
    localStorage.setItem(GOAL_KEY, dailyGoalValue.toString());
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    if (elements.earningDate) elements.earningDate.value = today;
    if (elements.expenseDate) elements.expenseDate.value = today;
}

function setupEventListeners() {
    elements.btnAddEarning?.addEventListener('click', () => openModal(elements.earningModal));
    elements.btnAddExpense?.addEventListener('click', () => openModal(elements.expenseModal));
    elements.btnEditGoal?.addEventListener('click', () => {
        const goalInput = document.getElementById('goalValue');
        if (goalInput) goalInput.value = dailyGoalValue || '';
        openModal(elements.goalModal);
    });
    elements.btnSettings?.addEventListener('click', () => openModal(elements.settingsModal));
    
    elements.closeEarningModal?.addEventListener('click', () => closeModal(elements.earningModal));
    elements.closeExpenseModal?.addEventListener('click', () => closeModal(elements.expenseModal));
    elements.closeGoalModal?.addEventListener('click', () => closeModal(elements.goalModal));
    elements.closeSettingsModal?.addEventListener('click', () => closeModal(elements.settingsModal));
    elements.closeDeleteModal?.addEventListener('click', () => closeModal(elements.deleteModal));
    elements.cancelDelete?.addEventListener('click', () => closeModal(elements.deleteModal));
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });
    
    elements.earningForm?.addEventListener('submit', handleEarningSubmit);
    elements.expenseForm?.addEventListener('submit', handleExpenseSubmit);
    elements.goalForm?.addEventListener('submit', handleGoalSubmit);
    elements.confirmDelete?.addEventListener('click', handleConfirmDelete);
    
    elements.filterType?.addEventListener('change', () => {
        currentPage = 1;
        renderTransactions();
    });
    elements.filterPeriod?.addEventListener('change', () => {
        currentPage = 1;
        renderTransactions();
    });
    
    elements.prevPage?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTransactions();
        }
    });
    elements.nextPage?.addEventListener('click', () => {
        const filtered = getFilteredTransactions();
        const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            renderTransactions();
        }
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            switchTab(tabId);
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            updatePeriodStats();
        });
    });
    
    elements.btnExport?.addEventListener('click', exportData);
    elements.btnImport?.addEventListener('click', () => elements.importFile?.click());
    elements.importFile?.addEventListener('change', importData);
    elements.btnClearData?.addEventListener('click', clearAllData);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
        
        if (tabId === 'tabReports') {
            setTimeout(() => updateCharts(), 100);
        }
    }
}

function openModal(modal) {
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function handleEarningSubmit(e) {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('earningValue').value);
    const date = document.getElementById('earningDate').value;
    const time = document.getElementById('earningTime')?.value || '';
    const categoryInput = document.querySelector('input[name="earningCategory"]:checked');
    const km = parseFloat(document.getElementById('earningKm')?.value) || 0;
    const hours = parseFloat(document.getElementById('earningHours')?.value) || 0;
    const description = document.getElementById('earningDescription')?.value || '';
    
    if (!value || !date || !categoryInput) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    const transaction = {
        id: generateId(),
        type: 'earning',
        value: value,
        date: date,
        time: time,
        category: categoryInput.value,
        km: km,
        hours: hours,
        description: description,
        createdAt: new Date().toISOString()
    };
    
    transactions.push(transaction);
    saveTransactions();
    updateAllStats();
    renderTransactions();
    updateCharts();
    
    elements.earningForm.reset();
    setDefaultDates();
    closeModal(elements.earningModal);
    showToast('Ganho registrado com sucesso!', 'success');
}

function handleExpenseSubmit(e) {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('expenseValue').value);
    const date = document.getElementById('expenseDate').value;
    const categoryInput = document.querySelector('input[name="expenseCategory"]:checked');
    const description = document.getElementById('expenseDescription')?.value || '';
    
    if (!value || !date || !categoryInput) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    const transaction = {
        id: generateId(),
        type: 'expense',
        value: value,
        date: date,
        category: categoryInput.value,
        km: 0,
        hours: 0,
        description: description,
        createdAt: new Date().toISOString()
    };
    
    transactions.push(transaction);
    saveTransactions();
    updateAllStats();
    renderTransactions();
    updateCharts();
    
    elements.expenseForm.reset();
    setDefaultDates();
    closeModal(elements.expenseModal);
    showToast('Gasto registrado com sucesso!', 'success');
}

function handleGoalSubmit(e) {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('goalValue').value);
    
    if (!value || value < 0) {
        showToast('Insira um valor válido para a meta', 'error');
        return;
    }
    
    dailyGoalValue = value;
    saveGoal();
    updateAllStats();
    closeModal(elements.goalModal);
    showToast('Meta atualizada!', 'success');
}

function handleConfirmDelete() {
    if (deleteTargetId) {
        transactions = transactions.filter(t => t.id !== deleteTargetId);
        saveTransactions();
        updateAllStats();
        renderTransactions();
        updateCharts();
        deleteTargetId = null;
        showToast('Transação excluída', 'success');
    }
    closeModal(elements.deleteModal);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatFullDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function getCategoryLabel(category) {
    const labels = {
        'uber': 'Uber',
        'uber-eats': 'Uber Eats',
        '99': '99',
        'indriver': 'InDriver',
        'particular': 'Particular',
        'outro': 'Outro',
        'gasolina': 'Gasolina',
        'etanol': 'Etanol',
        'manutencao': 'Manutenção',
        'lavagem': 'Lavagem',
        'estacionamento': 'Estacionamento',
        'pedagio': 'Pedágio',
        'lanche': 'Alimentação',
        'taxa-app': 'Taxa App',
        'seguro': 'Seguro',
        'multa': 'Multa'
    };
    return labels[category] || category;
}

function getCategoryIcon(category) {
    const icons = {
        'uber': '🚗',
        'uber-eats': '🍔',
        '99': '🚕',
        'indriver': '🚙',
        'particular': '👤',
        'outro': '📱',
        'gasolina': '⛽',
        'etanol': '🌿',
        'manutencao': '🔧',
        'lavagem': '🚿',
        'estacionamento': '🅿️',
        'pedagio': '🛣️',
        'lanche': '🍔',
        'taxa-app': '📱',
        'seguro': '🛡️',
        'multa': '🚨'
    };
    return icons[category] || '📋';
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

function getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

function updateAllStats() {
    updateTodayStats();
    updateGoalProgress();
    updateWorkSummary();
    updatePeriodStats();
}

function updateTodayStats() {
    const today = getTodayString();
    
    const todayEarnings = transactions
        .filter(t => t.type === 'earning' && t.date === today)
        .reduce((sum, t) => sum + t.value, 0);
    
    const todayExpenses = transactions
        .filter(t => t.type === 'expense' && t.date === today)
        .reduce((sum, t) => sum + t.value, 0);
    
    const todayNet = todayEarnings - todayExpenses;
    
    if (elements.todayEarnings) elements.todayEarnings.textContent = formatCurrency(todayEarnings);
    if (elements.todayExpenses) elements.todayExpenses.textContent = formatCurrency(todayExpenses);
    if (elements.todayNet) elements.todayNet.textContent = formatCurrency(todayNet);
}

function updateGoalProgress() {
    const today = getTodayString();
    
    const todayEarnings = transactions
        .filter(t => t.type === 'earning' && t.date === today)
        .reduce((sum, t) => sum + t.value, 0);
    
    const todayExpenses = transactions
        .filter(t => t.type === 'expense' && t.date === today)
        .reduce((sum, t) => sum + t.value, 0);
    
    const todayNet = todayEarnings - todayExpenses;
    
    if (elements.goalCurrent) elements.goalCurrent.textContent = formatCurrency(todayNet);
    if (elements.goalTarget) elements.goalTarget.textContent = formatCurrency(dailyGoalValue);
    
    if (dailyGoalValue > 0) {
        const progressPercent = Math.min((todayNet / dailyGoalValue) * 100, 100);
        if (elements.goalProgressBar) elements.goalProgressBar.style.width = `${Math.max(0, progressPercent)}%`;
        if (elements.goalPercent) elements.goalPercent.textContent = `${Math.round(progressPercent)}%`;
        
        const remaining = dailyGoalValue - todayNet;
        if (elements.goalStatus) {
            if (remaining <= 0) {
                elements.goalStatus.textContent = '🎉 Meta atingida! Parabéns!';
                elements.goalStatus.classList.add('achieved');
            } else {
                elements.goalStatus.textContent = `Faltam ${formatCurrency(remaining)} para atingir a meta`;
                elements.goalStatus.classList.remove('achieved');
            }
        }
    } else {
        if (elements.goalProgressBar) elements.goalProgressBar.style.width = '0%';
        if (elements.goalPercent) elements.goalPercent.textContent = '0%';
        if (elements.goalStatus) {
            elements.goalStatus.textContent = 'Configure sua meta diária';
            elements.goalStatus.classList.remove('achieved');
        }
    }
}

function updateWorkSummary() {
    const today = getTodayString();
    
    const todayTransactions = transactions.filter(t => t.date === today);
    
    const hoursToday = todayTransactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + (t.hours || 0), 0);
    
    const kmToday = todayTransactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + (t.km || 0), 0);
    
    const earningsToday = todayTransactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + t.value, 0);
    
    const expensesToday = todayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);
    
    const netToday = earningsToday - expensesToday;
    const hourlyRate = hoursToday > 0 ? netToday / hoursToday : 0;
    const kmPerReal = expensesToday > 0 ? kmToday / expensesToday : 0;
    
    if (elements.hoursWorked) elements.hoursWorked.textContent = `${hoursToday.toFixed(1)}h`;
    if (elements.hourlyRate) elements.hourlyRate.textContent = formatCurrency(hourlyRate);
    if (elements.totalKmToday) elements.totalKmToday.textContent = `${kmToday.toFixed(1)} km`;
    if (elements.kmPerReal) elements.kmPerReal.textContent = `${kmPerReal.toFixed(1)} km`;
}

function updatePeriodStats() {
    let startDate;
    
    if (currentPeriod === 'week') {
        startDate = getWeekStart();
    } else if (currentPeriod === 'month') {
        startDate = getMonthStart();
    } else {
        startDate = null;
    }
    
    const periodTransactions = startDate 
        ? transactions.filter(t => t.date >= startDate)
        : transactions;
    
    const earnings = periodTransactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + t.value, 0);
    
    const expenses = periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);
    
    const net = earnings - expenses;
    
    const uniqueDays = [...new Set(periodTransactions.map(t => t.date))].length;
    const dailyAverage = uniqueDays > 0 ? net / uniqueDays : 0;
    
    const totalKm = periodTransactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + (t.km || 0), 0);
    
    const tripCount = periodTransactions.filter(t => t.type === 'earning').length;
    
    if (elements.periodEarnings) elements.periodEarnings.textContent = formatCurrency(earnings);
    if (elements.periodExpenses) elements.periodExpenses.textContent = formatCurrency(expenses);
    if (elements.periodNet) elements.periodNet.textContent = formatCurrency(net);
    if (elements.periodAverage) elements.periodAverage.textContent = formatCurrency(dailyAverage);
    if (elements.periodKm) elements.periodKm.textContent = `${totalKm.toFixed(0)} km`;
    if (elements.periodTrips) elements.periodTrips.textContent = tripCount;
}

function getFilteredTransactions() {
    let filtered = [...transactions];
    
    const filterType = elements.filterType?.value || 'all';
    const filterPeriod = elements.filterPeriod?.value || 'all';
    
    if (filterType !== 'all') {
        filtered = filtered.filter(t => t.type === filterType);
    }
    
    const today = getTodayString();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();
    
    if (filterPeriod === 'today') {
        filtered = filtered.filter(t => t.date === today);
    } else if (filterPeriod === 'week') {
        filtered = filtered.filter(t => t.date >= weekStart);
    } else if (filterPeriod === 'month') {
        filtered = filtered.filter(t => t.date >= monthStart);
    }
    
    filtered.sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    return filtered;
}

function renderTransactions() {
    const filtered = getFilteredTransactions();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageItems = filtered.slice(startIndex, endIndex);
    
    if (!elements.transactionsList) return;
    
    if (filtered.length === 0) {
        elements.transactionsList.innerHTML = '';
        elements.emptyState?.classList.remove('hidden');
        elements.pagination?.classList.add('hidden');
        return;
    }
    
    elements.emptyState?.classList.add('hidden');
    elements.pagination?.classList.remove('hidden');
    
    elements.transactionsList.innerHTML = pageItems.map(t => `
        <div class="transaction-item">
            <div class="transaction-icon ${t.type}">
                ${getCategoryIcon(t.category)}
            </div>
            <div class="transaction-info">
                <div class="transaction-category">${getCategoryLabel(t.category)}</div>
                <div class="transaction-date">${formatFullDate(t.date)}${t.description ? ' • ' + t.description : ''}</div>
            </div>
            <div class="transaction-value ${t.type}">
                ${t.type === 'earning' ? '+' : '-'}${formatCurrency(t.value)}
            </div>
            <div class="transaction-actions">
                <button class="btn-delete-item" onclick="requestDelete('${t.id}')" title="Excluir">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
    
    if (elements.prevPage) elements.prevPage.disabled = currentPage === 1;
    if (elements.nextPage) elements.nextPage.disabled = currentPage === totalPages;
    if (elements.pageInfo) elements.pageInfo.textContent = `${currentPage} / ${totalPages}`;
}

function requestDelete(id) {
    deleteTargetId = id;
    openModal(elements.deleteModal);
}

function initCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#a0a0c0',
                    padding: 15,
                    font: { size: 11 }
                }
            }
        }
    };
    
    const appChartCtx = document.getElementById('appChart')?.getContext('2d');
    if (appChartCtx) {
        charts.appChart = new Chart(appChartCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#000000', '#06C167', '#FFCC00', '#2FC54B', '#74b9ff', '#a0a0c0'],
                    borderWidth: 0
                }]
            },
            options: {
                ...chartOptions,
                cutout: '60%'
            }
        });
    }
    
    const expenseChartCtx = document.getElementById('expenseChart')?.getContext('2d');
    if (expenseChartCtx) {
        charts.expenseChart = new Chart(expenseChartCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#ff7675', '#fdcb6e', '#74b9ff', '#a29bfe', '#00cec9', '#e056fd', '#fab1a0', '#81ecec'],
                    borderWidth: 0
                }]
            },
            options: {
                ...chartOptions,
                cutout: '60%'
            }
        });
    }
    
    const weeklyChartCtx = document.getElementById('weeklyChart')?.getContext('2d');
    if (weeklyChartCtx) {
        charts.weeklyChart = new Chart(weeklyChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Líquido',
                        data: [],
                        borderColor: '#6c5ce7',
                        backgroundColor: 'rgba(108, 92, 231, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    x: {
                        grid: { color: 'rgba(160, 160, 192, 0.1)' },
                        ticks: { color: '#a0a0c0' }
                    },
                    y: {
                        grid: { color: 'rgba(160, 160, 192, 0.1)' },
                        ticks: { color: '#a0a0c0' }
                    }
                }
            }
        });
    }
    
    const weekdayChartCtx = document.getElementById('weekdayChart')?.getContext('2d');
    if (weekdayChartCtx) {
        charts.weekdayChart = new Chart(weekdayChartCtx, {
            type: 'bar',
            data: {
                labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
                datasets: [{
                    label: 'Média de Ganho',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(0, 206, 201, 0.6)',
                    borderRadius: 8
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a0a0c0' }
                    },
                    y: {
                        grid: { color: 'rgba(160, 160, 192, 0.1)' },
                        ticks: { color: '#a0a0c0' }
                    }
                }
            }
        });
    }
    
    updateCharts();
}

function updateCharts() {
    updateAppChart();
    updateExpenseChart();
    updateWeeklyChart();
    updateWeekdayChart();
}

function updateAppChart() {
    if (!charts.appChart) return;
    
    const earnings = transactions.filter(t => t.type === 'earning');
    const byApp = {};
    
    earnings.forEach(t => {
        const label = getCategoryLabel(t.category);
        byApp[label] = (byApp[label] || 0) + t.value;
    });
    
    const labels = Object.keys(byApp);
    const data = Object.values(byApp);
    
    charts.appChart.data.labels = labels;
    charts.appChart.data.datasets[0].data = data;
    charts.appChart.update();
}

function updateExpenseChart() {
    if (!charts.expenseChart) return;
    
    const expenses = transactions.filter(t => t.type === 'expense');
    const byCategory = {};
    
    expenses.forEach(t => {
        const label = getCategoryLabel(t.category);
        byCategory[label] = (byCategory[label] || 0) + t.value;
    });
    
    const labels = Object.keys(byCategory);
    const data = Object.values(byCategory);
    
    charts.expenseChart.data.labels = labels;
    charts.expenseChart.data.datasets[0].data = data;
    charts.expenseChart.update();
}

function updateWeeklyChart() {
    if (!charts.weeklyChart) return;
    
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }
    
    const netByDay = last7Days.map(date => {
        const dayTransactions = transactions.filter(t => t.date === date);
        const earnings = dayTransactions
            .filter(t => t.type === 'earning')
            .reduce((sum, t) => sum + t.value, 0);
        const expenses = dayTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.value, 0);
        return earnings - expenses;
    });
    
    const labels = last7Days.map(date => {
        const d = new Date(date + 'T00:00:00');
        return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
    });
    
    charts.weeklyChart.data.labels = labels;
    charts.weeklyChart.data.datasets[0].data = netByDay;
    charts.weeklyChart.update();
}

function updateWeekdayChart() {
    if (!charts.weekdayChart) return;
    
    const earningsByWeekday = [[], [], [], [], [], [], []];
    
    transactions
        .filter(t => t.type === 'earning')
        .forEach(t => {
            const date = new Date(t.date + 'T00:00:00');
            const weekday = date.getDay();
            earningsByWeekday[weekday].push(t.value);
        });
    
    const averages = earningsByWeekday.map(arr => {
        if (arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    });
    
    charts.weekdayChart.data.datasets[0].data = averages;
    charts.weekdayChart.update();
}

function exportData() {
    const data = {
        transactions: transactions,
        goal: dailyGoalValue,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ubercontrol_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Dados exportados com sucesso!', 'success');
    closeModal(elements.settingsModal);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            if (data.transactions && Array.isArray(data.transactions)) {
                transactions = data.transactions;
                saveTransactions();
            }
            
            if (data.goal !== undefined) {
                dailyGoalValue = parseFloat(data.goal) || 0;
                saveGoal();
            }
            
            updateAllStats();
            renderTransactions();
            updateCharts();
            
            showToast('Dados importados com sucesso!', 'success');
            closeModal(elements.settingsModal);
        } catch (error) {
            showToast('Erro ao importar dados. Arquivo inválido.', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function clearAllData() {
    if (confirm('Tem certeza que deseja apagar TODOS os dados? Esta ação não pode ser desfeita.')) {
        transactions = [];
        dailyGoalValue = 0;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(GOAL_KEY);
        
        updateAllStats();
        renderTransactions();
        updateCharts();
        
        showToast('Todos os dados foram apagados', 'success');
        closeModal(elements.settingsModal);
    }
}

function showToast(message, type = 'success') {
    const toast = elements.toast;
    if (!toast) return;
    
    const icon = toast.querySelector('.toast-icon');
    const msg = toast.querySelector('.toast-message');
    
    if (icon) icon.textContent = type === 'success' ? '✓' : '✕';
    if (msg) msg.textContent = message;
    
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

window.requestDelete = requestDelete;

document.addEventListener('DOMContentLoaded', init);
