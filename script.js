const STORAGE_KEY = 'ubercontrol_transactions';
const GOAL_KEY = 'ubercontrol_goal';
const ITEMS_PER_PAGE = 10;

let transactions = [];
let dailyGoalValue = 0;
let currentPage = 1;
let deleteTargetId = null;

const elements = {
    totalEarnings: document.getElementById('totalEarnings'),
    totalExpenses: document.getElementById('totalExpenses'),
    netProfit: document.getElementById('netProfit'),
    dailyAverage: document.getElementById('dailyAverage'),
    weeklyAverage: document.getElementById('weeklyAverage'),
    totalTransactions: document.getElementById('totalTransactions'),
    totalKm: document.getElementById('totalKm'),
    costPerKm: document.getElementById('costPerKm'),
    dailyGoal: document.getElementById('dailyGoal'),
    goalProgress: document.getElementById('goalProgress'),
    goalProgressText: document.getElementById('goalProgressText'),
    goalRemaining: document.getElementById('goalRemaining'),
    transactionsBody: document.getElementById('transactionsBody'),
    emptyState: document.getElementById('emptyState'),
    filterType: document.getElementById('filterType'),
    sortBy: document.getElementById('sortBy'),
    pagination: document.getElementById('pagination'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    btnAddEarning: document.getElementById('btnAddEarning'),
    btnAddExpense: document.getElementById('btnAddExpense'),
    btnConfigGoal: document.getElementById('btnConfigGoal'),
    earningModal: document.getElementById('earningModal'),
    expenseModal: document.getElementById('expenseModal'),
    goalModal: document.getElementById('goalModal'),
    deleteModal: document.getElementById('deleteModal'),
    closeEarningModal: document.getElementById('closeEarningModal'),
    closeExpenseModal: document.getElementById('closeExpenseModal'),
    closeGoalModal: document.getElementById('closeGoalModal'),
    closeDeleteModal: document.getElementById('closeDeleteModal'),
    earningForm: document.getElementById('earningForm'),
    expenseForm: document.getElementById('expenseForm'),
    goalForm: document.getElementById('goalForm'),
    cancelDelete: document.getElementById('cancelDelete'),
    confirmDelete: document.getElementById('confirmDelete'),
    earningDate: document.getElementById('earningDate'),
    expenseDate: document.getElementById('expenseDate')
};

function init() {
    loadTransactions();
    loadGoal();
    setupEventListeners();
    setDefaultDates();
    updateDashboard();
    renderTransactions();
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
    elements.earningDate.value = today;
    elements.expenseDate.value = today;
}

function setupEventListeners() {
    elements.btnAddEarning.addEventListener('click', () => openModal(elements.earningModal));
    elements.btnAddExpense.addEventListener('click', () => openModal(elements.expenseModal));
    elements.btnConfigGoal.addEventListener('click', () => {
        document.getElementById('goalValue').value = dailyGoalValue || '';
        openModal(elements.goalModal);
    });
    
    elements.closeEarningModal.addEventListener('click', () => closeModal(elements.earningModal));
    elements.closeExpenseModal.addEventListener('click', () => closeModal(elements.expenseModal));
    elements.closeGoalModal.addEventListener('click', () => closeModal(elements.goalModal));
    elements.closeDeleteModal.addEventListener('click', () => closeModal(elements.deleteModal));
    elements.cancelDelete.addEventListener('click', () => closeModal(elements.deleteModal));
    
    elements.earningModal.addEventListener('click', (e) => {
        if (e.target === elements.earningModal) closeModal(elements.earningModal);
    });
    elements.expenseModal.addEventListener('click', (e) => {
        if (e.target === elements.expenseModal) closeModal(elements.expenseModal);
    });
    elements.goalModal.addEventListener('click', (e) => {
        if (e.target === elements.goalModal) closeModal(elements.goalModal);
    });
    elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) closeModal(elements.deleteModal);
    });
    
    elements.earningForm.addEventListener('submit', handleEarningSubmit);
    elements.expenseForm.addEventListener('submit', handleExpenseSubmit);
    elements.goalForm.addEventListener('submit', handleGoalSubmit);
    elements.confirmDelete.addEventListener('click', handleConfirmDelete);
    
    elements.filterType.addEventListener('change', () => {
        currentPage = 1;
        renderTransactions();
    });
    elements.sortBy.addEventListener('change', () => {
        currentPage = 1;
        renderTransactions();
    });
    
    elements.prevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTransactions();
        }
    });
    elements.nextPage.addEventListener('click', () => {
        const filtered = getFilteredTransactions();
        const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            renderTransactions();
        }
    });
}

function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function handleEarningSubmit(e) {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('earningValue').value);
    const date = document.getElementById('earningDate').value;
    const category = document.getElementById('earningCategory').value;
    const km = parseFloat(document.getElementById('earningKm').value) || 0;
    const description = document.getElementById('earningDescription').value;
    
    if (!value || !date || !category) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }
    
    const transaction = {
        id: generateId(),
        type: 'earning',
        value: value,
        date: date,
        category: category,
        km: km,
        description: description,
        createdAt: new Date().toISOString()
    };
    
    transactions.push(transaction);
    saveTransactions();
    updateDashboard();
    renderTransactions();
    
    elements.earningForm.reset();
    setDefaultDates();
    closeModal(elements.earningModal);
}

function handleExpenseSubmit(e) {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('expenseValue').value);
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value;
    
    if (!value || !date || !category) {
        alert('Preencha todos os campos obrigatórios');
        return;
    }
    
    const transaction = {
        id: generateId(),
        type: 'expense',
        value: value,
        date: date,
        category: category,
        km: 0,
        description: description,
        createdAt: new Date().toISOString()
    };
    
    transactions.push(transaction);
    saveTransactions();
    updateDashboard();
    renderTransactions();
    
    elements.expenseForm.reset();
    setDefaultDates();
    closeModal(elements.expenseModal);
}

function handleGoalSubmit(e) {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('goalValue').value);
    
    if (!value || value < 0) {
        alert('Insira um valor válido para a meta');
        return;
    }
    
    dailyGoalValue = value;
    saveGoal();
    updateDashboard();
    closeModal(elements.goalModal);
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
        'lanche': 'Lanche/Alimentação',
        'taxa-app': 'Taxa do App',
        'seguro': 'Seguro',
        'multa': 'Multa'
    };
    return labels[category] || category;
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function updateDashboard() {
    const earnings = transactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + t.value, 0);
    
    const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);
    
    const netProfit = earnings - expenses;
    
    const uniqueDays = [...new Set(transactions.map(t => t.date))].length;
    const dailyAverage = uniqueDays > 0 ? netProfit / uniqueDays : 0;
    
    const weeks = uniqueDays > 0 ? Math.ceil(uniqueDays / 7) : 0;
    const weeklyAverage = weeks > 0 ? netProfit / weeks : 0;
    
    const totalKm = transactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + (t.km || 0), 0);
    
    const costPerKm = totalKm > 0 ? expenses / totalKm : 0;
    
    elements.totalEarnings.textContent = formatCurrency(earnings);
    elements.totalExpenses.textContent = formatCurrency(expenses);
    elements.netProfit.textContent = formatCurrency(netProfit);
    elements.dailyAverage.textContent = formatCurrency(dailyAverage);
    elements.weeklyAverage.textContent = formatCurrency(weeklyAverage);
    elements.totalTransactions.textContent = transactions.length;
    elements.totalKm.textContent = `${totalKm.toFixed(1)} km`;
    elements.costPerKm.textContent = formatCurrency(costPerKm);
    
    if (netProfit >= 0) {
        elements.netProfit.style.color = 'var(--success-color)';
    } else {
        elements.netProfit.style.color = 'var(--danger-color)';
    }
    
    updateGoalProgress();
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
    
    elements.dailyGoal.textContent = formatCurrency(dailyGoalValue);
    
    if (dailyGoalValue > 0) {
        const progressPercent = Math.min((todayNet / dailyGoalValue) * 100, 100);
        elements.goalProgress.style.width = `${Math.max(0, progressPercent)}%`;
        elements.goalProgressText.textContent = `${progressPercent.toFixed(1)}% da meta (Hoje: ${formatCurrency(todayNet)})`;
        
        const remaining = dailyGoalValue - todayNet;
        if (remaining <= 0) {
            elements.goalRemaining.textContent = 'Meta atingida!';
            elements.goalRemaining.classList.add('achieved');
        } else {
            elements.goalRemaining.textContent = formatCurrency(remaining);
            elements.goalRemaining.classList.remove('achieved');
        }
    } else {
        elements.goalProgress.style.width = '0%';
        elements.goalProgressText.textContent = 'Configure sua meta diária';
        elements.goalRemaining.textContent = 'R$ 0,00';
        elements.goalRemaining.classList.remove('achieved');
    }
}

function getFilteredTransactions() {
    let filtered = [...transactions];
    
    const filterType = elements.filterType.value;
    if (filterType !== 'all') {
        filtered = filtered.filter(t => t.type === filterType);
    }
    
    const sortBy = elements.sortBy.value;
    switch (sortBy) {
        case 'date-desc':
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date-asc':
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'value-desc':
            filtered.sort((a, b) => b.value - a.value);
            break;
        case 'value-asc':
            filtered.sort((a, b) => a.value - b.value);
            break;
    }
    
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
    
    if (filtered.length === 0) {
        elements.transactionsBody.innerHTML = '';
        elements.emptyState.classList.remove('hidden');
        elements.pagination.classList.add('hidden');
        return;
    }
    
    elements.emptyState.classList.add('hidden');
    elements.pagination.classList.remove('hidden');
    
    elements.transactionsBody.innerHTML = pageItems.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td class="${t.type === 'earning' ? 'type-earning' : 'type-expense'}">
                ${t.type === 'earning' ? 'Ganho' : 'Gasto'}
            </td>
            <td>${getCategoryLabel(t.category)}</td>
            <td class="${t.type === 'earning' ? 'type-earning' : 'type-expense'}">
                ${t.type === 'earning' ? '+' : '-'}${formatCurrency(t.value)}
            </td>
            <td>
                <button class="btn-delete-row" onclick="requestDelete('${t.id}')" title="Excluir">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
    
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;
    elements.pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
}

function requestDelete(id) {
    deleteTargetId = id;
    openModal(elements.deleteModal);
}

function handleConfirmDelete() {
    if (deleteTargetId) {
        transactions = transactions.filter(t => t.id !== deleteTargetId);
        saveTransactions();
        updateDashboard();
        renderTransactions();
        deleteTargetId = null;
    }
    closeModal(elements.deleteModal);
}

document.addEventListener('DOMContentLoaded', init);
