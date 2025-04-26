document.addEventListener('DOMContentLoaded', function () {
    // Inicialização do painel administrativo
    initTabs();

    // Configuração do botão de logout
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            // Fazer a requisição de logout
            fetch('/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(response => {
                    // Independente da resposta, redirecionar para login
                    window.location.href = '/login.html';
                })
                .catch(error => {
                    console.error('Erro ao fazer logout:', error);
                    // Mesmo com erro, tentar redirecionar
                    window.location.href = '/login.html';
                });
        });
    }

    // Função para inicializar as tabs
    function initTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', function () {
                const tabId = this.getAttribute('data-tab');

                // Remover a classe active de todas as tabs
                tabs.forEach(t => t.classList.remove('active'));

                // Adicionar a classe active na tab clicada
                this.classList.add('active');

                // Esconder todos os conteúdos de tab
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });

                // Mostrar o conteúdo correspondente
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }

    // Variáveis para elementos DOM
    const tabButtons = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const usersTableBody = document.getElementById('users-table-body');
    const quizzesList = document.getElementById('quizzes-list');
    const addUserBtn = document.getElementById('add-user-btn');
    const addUserModal = document.getElementById('add-user-modal');
    const addUserForm = document.getElementById('add-user-form');
    const modalCloseButtons = document.querySelectorAll('.admin-modal-close, .admin-modal-cancel');

    // Trocar entre tabs
    if (tabButtons.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');

                // Atualizar botões ativos
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Mostrar conteúdo da tab selecionada
                tabContents.forEach(content => content.classList.remove('active'));

                const tabContent = document.getElementById(`${tabId}-tab`);
                if (tabContent) {
                    tabContent.classList.add('active');
                }

                // Carregar dados da tab
                if (tabId === 'users' && usersTableBody) {
                    loadUsers();
                } else if (tabId === 'quizzes' && quizzesList) {
                    loadQuizzes();
                } else if (tabId === 'statistics') {
                    initStatistics();
                }
            });
        });
    }

    // Funções para carregar dados
    async function loadUsers() {
        try {
            const response = await fetch('/admin/api/users');
            const data = await response.json();

            if (data.error) {
                usersTableBody.innerHTML = `<tr><td colspan="4">Erro: ${data.error}</td></tr>`;
                return;
            }

            if (data.users && data.users.length > 0) {
                renderUsers(data.users);

                // Adicionar event listeners para botões de excluir
                document.querySelectorAll('.delete-user-btn').forEach(button => {
                    button.addEventListener('click', function () {
                        const userId = this.getAttribute('data-userid');
                        const username = this.closest('tr').querySelector('td').textContent;
                        if (confirm(`Tem certeza que deseja excluir o usuário ${username}?`)) {
                            deleteUser(userId);
                        }
                    });
                });
            } else {
                usersTableBody.innerHTML = `<tr><td colspan="4">Nenhum usuário encontrado</td></tr>`;
            }
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            usersTableBody.innerHTML = `<tr><td colspan="4">Erro ao carregar usuários</td></tr>`;
        }
    }

    async function loadQuizzes() {
        try {
            const response = await fetch('/admin/api/quizzes');
            const data = await response.json();

            if (data.error) {
                quizzesList.innerHTML = `<p>Erro: ${data.error}</p>`;
                return;
            }

            if (data.quizzes && data.quizzes.length > 0) {
                quizzesList.innerHTML = data.quizzes.map(quiz => {
                    const quizTypes = {
                        'pre_operacional': 'Checklist Pré-Operacional',
                        'caminhao': 'Checklist Caminhão',
                        'carga': 'Checklist Carga'
                    };
                    const quizTypeName = quizTypes[quiz.quiz_type] || quiz.quiz_type;

                    return `
                    <div class="quiz-item">
                        <h3>Usuário: ${quiz.username}</h3>
                        <div class="quiz-meta">
                            <div><strong>Tipo:</strong> <span class="quiz-type">${quizTypeName}</span></div>
                            <div><strong>Data:</strong> ${formatDate(quiz.timestamp)}</div>
                        </div>
                        <button class="quiz-view-btn" data-username="${quiz.username}" 
                            data-quiz-type="${quiz.quiz_type}" data-timestamp="${quiz.timestamp}">
                            Ver Detalhes
                        </button>
                    </div>
                    `;
                }).join('');

                // Event listeners para botões de visualização de quiz
                document.querySelectorAll('.quiz-view-btn').forEach(button => {
                    button.addEventListener('click', function () {
                        const username = this.getAttribute('data-username');
                        const quizType = this.getAttribute('data-quiz-type');
                        const timestamp = this.getAttribute('data-timestamp');
                        showQuizDetails(username, quizType, timestamp);
                    });
                });
            } else {
                quizzesList.innerHTML = `<p>Nenhum checklist encontrado</p>`;
            }
        } catch (error) {
            console.error('Erro ao carregar checklists:', error);
            quizzesList.innerHTML = `<p>Erro ao carregar checklists</p>`;
        }
    }

    // Modal de adicionar usuário
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            if (addUserModal) {
                addUserModal.style.display = 'flex';
                addUserModal.classList.add('visible');
            }
        });
    }

    // Fechar modais
    if (modalCloseButtons.length > 0) {
        modalCloseButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modal = button.closest('.admin-modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('visible');
                }
            });
        });
    }

    // Fechar modal clicando fora
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('admin-modal')) {
            event.target.style.display = 'none';
            event.target.classList.remove('visible');
        }
    });

    // Impedir propagação do clique dentro do modal
    document.querySelectorAll('.admin-modal-content').forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Submissão do formulário
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('new-username').value;
            const password = document.getElementById('new-password').value;
            const isAdmin = document.getElementById('is-admin').checked;

            try {
                const response = await fetch('/admin/api/users/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        password,
                        is_admin: isAdmin
                    })
                });

                const data = await response.json();

                if (data.error) {
                    alert(`Erro: ${data.error}`);
                    return;
                }

                alert('Usuário criado com sucesso!');
                addUserModal.style.display = 'none';
                addUserForm.reset();
                loadUsers();

            } catch (error) {
                console.error('Erro ao criar usuário:', error);
                alert('Erro ao criar usuário. Verifique o console para mais detalhes.');
            }
        });
    }

    // Excluir usuário
    async function deleteUser(userId) {
        try {
            const response = await fetch(`/admin/api/users/${userId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.error) {
                alert(`Erro: ${data.error}`);
                return;
            }

            alert('Usuário excluído com sucesso!');
            loadUsers();

        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            alert('Erro ao excluir usuário. Verifique o console para mais detalhes.');
        }
    }

    // Função auxiliar para formatar datas
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
    }

    // Função que constrói as linhas da tabela
    function renderUsers(users) {
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');

            // Formatar a data
            const date = new Date(user.created_at);
            const formattedDate = date.toLocaleString('pt-BR');

            // Criar badge de permissão
            const roleBadge = user.is_admin ?
                '<span class="badge badge-admin">Administrador</span>' :
                '<span class="badge badge-user">Usuário</span>';

            row.innerHTML = `
                <td>${user.username}</td>
                <td>${formattedDate}</td>
                <td>${roleBadge}</td>
                <td>
                    <button class="btn-danger delete-user-btn" data-userid="${user.id}">Excluir</button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    // Inicializar dados
    if (usersTableBody) {
        loadUsers();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // Obter parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const quizType = urlParams.get('type');
    const timestamp = urlParams.get('timestamp');

    const quizInfoElement = document.getElementById('quiz-info');
    const questionsContainer = document.getElementById('questions-container');
    const observationsElement = document.getElementById('observations');
    const locationContainer = document.getElementById('location-container');
    const photosContainer = document.getElementById('photos-container');
    const backButton = document.getElementById('back-button');

    // Voltar ao dashboard
    backButton.addEventListener('click', () => {
        window.location.href = '/admin/dashboard';
    });

    // Função para carregar detalhes do quiz
    async function loadQuizDetails() {
        try {
            // Mostrar informação básica
            const quizTypes = {
                'pre_operacional': 'Checklist Pré-Operacional',
                'caminhao': 'Checklist Caminhão',
                'carga': 'Checklist Carga'
            };

            const formattedDate = new Date(timestamp).toLocaleString('pt-BR');
            const quizTypeName = quizTypes[quizType] || quizType;

            quizInfoElement.innerHTML = `
                <p><strong>Usuário:</strong> ${username}</p>
                <p><strong>Tipo:</strong> ${quizTypeName}</p>
                <p><strong>Data:</strong> ${formattedDate}</p>
            `;

            // Buscar detalhes do servidor
            const response = await fetch(`/admin/api/quiz-details?username=${username}&type=${quizType}&timestamp=${timestamp}`);
            const data = await response.json();

            if (data.error) {
                questionsContainer.innerHTML = `<p class="error-message">${data.error}</p>`;
                return;
            }

            // Exibir perguntas
            if (data.questions && data.questions.length > 0) {
                questionsContainer.innerHTML = data.questions.map((q) => {
                    const answerClass = q.answer === 'C' ? 'answer-ok' :
                        q.answer === 'NC' || q.answer === 'N/C' ? 'answer-problem' : 'answer-na';

                    return `
                    <div class="question-item ${answerClass}">
                        <div class="question-number">${q.number}</div>
                        <div class="question-text">${q.text}</div>
                        <div class="question-answer ${answerClass}">${q.answer}</div>
                    </div>
                    `;
                }).join('');
            } else {
                questionsContainer.innerHTML = `<p>Nenhuma pergunta encontrada.</p>`;
            }

            // Exibir observações
            if (data.observations) {
                console.log("Observações encontradas:", data.observations);

                html += `
                    <div class="observations-section">
                        <h4>Observações:</h4>
                        <div class="observation-text">
                            ${data.observations || "Nenhuma observação registrada"}
                        </div>
                    </div>
                `;
            } else {
                console.log("Nenhuma observação encontrada para este checklist");

                // Opcional: Mostrar mensagem de "sem observações"
                html += `
                    <div class="observations-section">
                        <h4>Observações:</h4>
                        <div class="observation-text">
                            <em>Nenhuma observação registrada</em>
                        </div>
                    </div>
                `;
            }

            // Exibir localização se disponível
            if (data.location) {
                locationContainer.innerHTML = `
                    <h3>Localização</h3>
                    <div class="location-info">
                        <p><strong>Latitude:</strong> ${data.location.latitude}</p>
                        <p><strong>Longitude:</strong> ${data.location.longitude}</p>
                        <p><strong>Precisão:</strong> ${data.location.accuracy} metros</p>
                        <a href="https://maps.google.com/?q=${data.location.latitude},${data.location.longitude}" target="_blank" class="map-link">Abrir no Google Maps</a>
                    </div>
                `;
                locationContainer.style.display = 'block';
            } else {
                locationContainer.style.display = 'none';
            }

            // Exibir fotos
            if (data.photos && data.photos.length > 0) {
                console.log("Fotos recebidas:", data.photos);

                html += `
                    <div class="photos-section">
                        <h4>Fotos:</h4>
                        <div class="photo-gallery">
                `;

                data.photos.forEach(photo => {
                    // Garantir que o caminho começa com /
                    const photoPath = photo.path.startsWith('/') ? photo.path : '/' + photo.path;

                    html += `
                        <div class="history-photo">
                            <a href="${photoPath}" target="_blank">
                                <img src="${photoPath}" alt="Foto do checklist" onerror="this.onerror=null; this.src='/static/images/image-error.png'; this.style.opacity='0.7';">
                            </a>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            } else {
                photosContainer.style.display = 'none';
            }

        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            questionsContainer.innerHTML = `<p class="error-message">Erro ao carregar detalhes. Tente novamente mais tarde.</p>`;
        }
    }

    // Carregar os detalhes ao iniciar a página
    if (username && quizType && timestamp) {
        loadQuizDetails();
    } else {
        quizInfoElement.innerHTML = `<p class="error-message">Parâmetros insuficientes para exibir detalhes.</p>`;
    }
});

// Função para inicializar a tab de estatísticas
function initStatistics() {
    const periodSelector = document.getElementById('statistics-period');
    const refreshButton = document.getElementById('refresh-statistics');

    // Carregar estatísticas iniciais
    loadStatistics('daily');

    // Event listeners
    if (periodSelector) {
        periodSelector.addEventListener('change', function () {
            loadStatistics(this.value);
        });
    }

    if (refreshButton) {
        refreshButton.addEventListener('click', function () {
            loadStatistics(periodSelector.value);
        });
    }
}

// Função para carregar as estatísticas do servidor
async function loadStatistics(period) {
    try {
        const response = await fetch(`/admin/api/statistics?period=${period}`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Atualizar as estatísticas na UI
        updateStatisticsSummary(data);
        updateStatisticsChart(data, period);
        updateUserStatistics(data);
        updateRecentQuizzes(data);

    } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
    }
}

// Função para atualizar os cards de resumo
function updateStatisticsSummary(data) {
    // Calcular totais de checklists únicos, não perguntas
    // Obtemos isso contando entradas únicas por timestamp e usuário
    const uniqueSubmissions = new Map();

    data.recent_quizzes.forEach(quiz => {
        const key = `${quiz.username}_${quiz.timestamp}`;
        uniqueSubmissions.set(key, true);
    });

    const totalQuizzes = uniqueSubmissions.size;
    const activeUsers = new Set(data.recent_quizzes.map(q => q.username)).size;
    const totalNc = data.recent_quizzes.reduce((acc, curr) => acc + (curr.nc_count || 0), 0);

    // Atualizar elementos na página
    document.getElementById('total-quizzes').textContent = totalQuizzes;
    document.getElementById('active-users').textContent = activeUsers;
    document.getElementById('total-nc').textContent = totalNc;
}

// Função para atualizar o gráfico de estatísticas
function updateStatisticsChart(data, period) {
    // Configurar rótulo do período
    const periodLabel = document.getElementById('period-label');
    if (periodLabel) {
        if (period === 'daily') periodLabel.textContent = 'Dia';
        else if (period === 'monthly') periodLabel.textContent = 'Mês';
        else periodLabel.textContent = 'Total';
    }

    // Implementação do gráfico de pizza com Chart.js
    const chartCanvas = document.getElementById('quizzes-chart');
    if (chartCanvas && typeof Chart !== 'undefined') {
        // Limpar qualquer gráfico existente
        if (chartCanvas.chart) {
            chartCanvas.chart.destroy();
        }

        // Preparar dados para o gráfico de pizza
        const stats = data.statistics;

        // Agrupar dados por tipo de checklist
        const quizCounts = {
            'pre_operacional': 0,
            'caminhao': 0,
            'carga': 0
        };

        // Somar totais por tipo
        stats.forEach(stat => {
            if (quizCounts[stat.quiz_type] !== undefined) {
                quizCounts[stat.quiz_type] += parseInt(stat.count);
            }
        });

        // Preparar dados para o gráfico
        const pieData = {
            labels: Object.keys(quizCounts).map(type => getQuizTypeLabel(type)),
            datasets: [{
                data: Object.values(quizCounts),
                backgroundColor: [
                    'rgba(21, 101, 192, 0.7)',  // Pré-Operacional (azul)
                    'rgba(230, 81, 0, 0.7)',    // Caminhão (laranja)
                    'rgba(85, 139, 47, 0.7)'    // Carga (verde)
                ],
                borderColor: [
                    'rgba(21, 101, 192, 1)',
                    'rgba(230, 81, 0, 1)',
                    'rgba(85, 139, 47, 1)'
                ],
                borderWidth: 1
            }]
        };

        // Criar o gráfico de pizza com opções aprimoradas
        chartCanvas.chart = new Chart(chartCanvas, {
            type: 'doughnut', // Pode usar 'pie' também
            data: pieData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5,
                plugins: {
                    legend: {
                        position: 'right',
                        align: 'center',
                        labels: {
                            font: {
                                size: 14
                            },
                            padding: 20,
                            boxWidth: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 0,
                        bottom: 0
                    }
                }
            }
        });
    } else {
        console.log("Canvas não encontrado ou Chart.js não carregado");
    }
}

// Função para atualizar estatísticas por usuário
function updateUserStatistics(data) {
    const userStatsContainer = document.getElementById('user-statistics');
    if (!userStatsContainer) return;

    // Usar os dados de recent_quizzes que já contêm a informação de username
    const userCounts = {};

    if (data.recent_quizzes && data.recent_quizzes.length > 0) {
        // Agrupar por usuário
        data.recent_quizzes.forEach(quiz => {
            const username = quiz.username;
            if (!username) return; // Pular se não tiver username

            if (!userCounts[username]) {
                userCounts[username] = 0;
            }

            // Contar 1 checklist completo (não cada pergunta)
            userCounts[username] += 1;
        });

        // Eliminar contagens duplicadas do mesmo checklist
        const uniqueSubmissions = new Map();
        data.recent_quizzes.forEach(quiz => {
            const key = `${quiz.username}_${quiz.timestamp}`;
            if (!uniqueSubmissions.has(key)) {
                uniqueSubmissions.set(key, true);

                // Se o username existe, incrementa sua contagem (evita undefined)
                if (quiz.username) {
                    if (!userCounts[quiz.username]) {
                        userCounts[quiz.username] = 0;
                    }
                    userCounts[quiz.username] = (userCounts[quiz.username] || 0) + 1;
                }
            }
        });

        // Converter para array e ordenar
        const sortedUsers = Object.entries(userCounts)
            .map(([username, count]) => ({ username, count }))
            .sort((a, b) => b.count - a.count);

        // Gerar HTML
        const html = sortedUsers.map(user => `
            <div class="user-stat-item">
                <span class="user-name">${user.username}</span>
                <span class="user-count">${user.count}</span>
            </div>
        `).join('');

        userStatsContainer.innerHTML = html || '<p>Nenhum dado disponível</p>';
    } else {
        userStatsContainer.innerHTML = '<p>Nenhum dado de usuário disponível</p>';
    }
}

// Função para atualizar a tabela de checklists recentes
function updateRecentQuizzes(data) {
    const recentQuizzesBody = document.getElementById('recent-quizzes-body');
    if (!recentQuizzesBody) return;

    if (data.recent_quizzes && data.recent_quizzes.length > 0) {
        const rows = data.recent_quizzes.map(quiz => {
            // Formatar data para exibição
            const date = new Date(quiz.timestamp);
            const formattedDate = date.toLocaleString('pt-BR');

            // Garantir que estamos enviando o timestamp original intacto
            const originalTimestamp = quiz.timestamp;

            return `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${quiz.username}</td>
                    <td><span class="quiz-type-pill ${getQuizTypeClass(quiz.quiz_type)}">${getQuizTypeLabel(quiz.quiz_type)}</span></td>
                    <td>${quiz.questions_count}</td>
                    <td class="nc-count">${quiz.nc_count || 0}</td>
                    <td>
                        <button class="btn-action view-quiz-btn" 
                                data-username="${quiz.username}" 
                                data-type="${quiz.quiz_type}" 
                                data-timestamp="${originalTimestamp}">
                            Ver Detalhes
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        recentQuizzesBody.innerHTML = rows;

        // Adicionar event listeners aos botões
        document.querySelectorAll('.view-quiz-btn').forEach(button => {
            button.addEventListener('click', function () {
                const username = this.getAttribute('data-username');
                const quizType = this.getAttribute('data-type');
                const timestamp = this.getAttribute('data-timestamp');
                showQuizDetails(username, quizType, timestamp);
            });
        });
    }
}

// Funções auxiliares
function getQuizTypeLabel(type) {
    const types = {
        'pre_operacional': 'Pré-Operacional',
        'caminhao': 'Caminhão',
        'carga': 'Carga'
    };
    return types[type] || type;
}

function getQuizTypeClass(type) {
    const classes = {
        'pre_operacional': 'quiz-type-pre',
        'caminhao': 'quiz-type-caminhao',
        'carga': 'quiz-type-carga'
    };
    return classes[type] || '';
}

function getQuizTypeColor(type) {
    const colors = {
        'pre_operacional': 'rgba(21, 101, 192, 0.7)',
        'caminhao': 'rgba(230, 81, 0, 0.7)',
        'carga': 'rgba(85, 139, 47, 0.7)'
    };
    return colors[type] || 'rgba(33, 33, 33, 0.7)';
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = 'rgba(';
    for (let i = 0; i < 3; i++) {
        color += Math.floor(Math.random() * 200) + ',';
    }
    return color + '0.7)';
}

// Adicione esta verificação defensiva
function setupEventListeners() {
    // Para cada elemento que você adiciona um event listener
    const element = document.getElementById('algum-elemento-que-nao-existe');
    if (element) {
        element.addEventListener('click', function () {
            // código existente...
        });
    } else {
        console.warn("Elemento 'algum-elemento-que-nao-existe' não encontrado no DOM");
    }

    // Repita para outros elementos...
}

// Chame a função após garantir que o DOM está carregado
document.addEventListener('DOMContentLoaded', setupEventListeners);

// Em admin.js - correção para o filtro de histórico
document.addEventListener('DOMContentLoaded', function () {
    // Verificar se todos os elementos existem antes de adicionar event listeners
    const filterButton = document.getElementById('filter-history-button');
    const dateFromInput = document.getElementById('history-date-from');
    const dateToInput = document.getElementById('history-date-to');

    if (filterButton) {
        filterButton.addEventListener('click', function () {
            const fromDate = dateFromInput ? dateFromInput.value : null;
            const toDate = dateToInput ? dateToInput.value : null;
            fetchHistory(fromDate, toDate, 7);
        });
    } else {
        console.warn("Botão de filtro não encontrado");
    }
});

// Modificação para corrigir a exibição do modal de detalhes
function showQuizDetails(username, quizType, timestamp) {
    console.log("Exibindo modal para:", username, quizType, timestamp);

    const detailsModal = document.getElementById('quiz-details-modal');
    const detailsContent = document.getElementById('quiz-details-content');

    if (!detailsModal || !detailsContent) {
        console.error('Modal de detalhes não encontrado!');
        return;
    }

    // Garantir que o modal esteja visível
    detailsModal.style.display = 'block';
    detailsModal.classList.add('visible');  // Adicionar classe para animação

    detailsContent.innerHTML = '<p class="loading">Carregando detalhes...</p>';

    // Fazer a chamada à API para buscar os detalhes
    fetch(`/admin/api/quiz-details?username=${encodeURIComponent(username)}&quiz_type=${encodeURIComponent(quizType)}&timestamp=${encodeURIComponent(timestamp)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Dados completos recebidos:", data);
            console.log("Observações:", data.observations);

            // Formatar data
            const date = new Date(timestamp);
            const formattedDate = date.toLocaleString('pt-BR');

            // Construir HTML do conteúdo
            let html = `
                <div class="details-header">
                    <h3>${getQuizTypeLabel(quizType)}</h3>
                    <p class="details-timestamp">Data: ${formattedDate}</p>
                    <p class="details-user">Usuário: ${username}</p>
                </div>
            `;

            // Adicionar tabela de perguntas
            html += `
                <div class="questions-section">
                    <h4>Perguntas e Respostas:</h4>
                    <table class="details-table">
                        <thead>
                            <tr>
                                <th>Pergunta</th>
                                <th>Resposta</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Adicionar cada pergunta
            data.questions.forEach(question => {
                const answerClass =
                    question.answer === "C" ? "answer-conformity" :
                        question.answer === "NC" || question.answer === "N/C" ? "answer-nonconformity" :
                            "answer-notapplicable";

                const answerText =
                    question.answer === "C" ? "Conforme" :
                        question.answer === "NC" || question.answer === "N/C" ? "Não Conforme" :
                            question.answer === "NA" || question.answer === "N/A" ? "Não se Aplica" :
                                question.answer;

                html += `
                    <tr>
                        <td>${question.text}</td>
                        <td class="${answerClass}">${answerText}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            // Seção de observações
            if (data.observations) {
                html += `
                    <div class="observations-section">
                        <h4>Observações:</h4>
                        <div class="observation-text">${data.observations}</div>
                    </div>
                `;
            }

            // Seção de localização
            if (data.location) {
                const location = typeof data.location === 'string'
                    ? JSON.parse(data.location)
                    : data.location;

                html += `
                    <div class="location-section">
                        <h4>Localização:</h4>
                        <div class="location-details">
                            <p><strong>Latitude:</strong> ${location.latitude}</p>
                            <p><strong>Longitude:</strong> ${location.longitude}</p>
                            <p><strong>Precisão:</strong> ${location.accuracy} metros</p>
                            <a href="https://maps.google.com/?q=${location.latitude},${location.longitude}" 
                               target="_blank" class="map-link">
                               <i class="fas fa-map-marker-alt"></i> Ver no Mapa
                            </a>
                        </div>
                    </div>
                `;
            }

            // Seção de fotos
            if (data.photos && data.photos.length > 0) {
                html += `
                    <div class="photos-section">
                        <h4>Fotos:</h4>
                        <div class="photo-gallery">
                `;

                data.photos.forEach(photo => {
                    // Garantir que o caminho está correto
                    const photoPath = photo.path.replace(/\\/g, '/');

                    html += `
                        <div class="history-photo">
                            <a href="/${photoPath}" target="_blank">
                                <img src="/${photoPath}" alt="Foto do checklist" onerror="this.onerror=null; this.src='/static/images/image-error.png'; this.style.opacity='0.7';">
                            </a>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            }

            // Atualizar o conteúdo do modal
            detailsContent.innerHTML = html;
        })
        .catch(error => {
            console.error('Erro ao buscar detalhes:', error);
            console.error('Parâmetros:', { username, quizType, timestamp });
            detailsContent.innerHTML = `
                <div class="error-message">
                    <p>Erro ao carregar detalhes do checklist.</p>
                    <p>Por favor, tente novamente.</p>
                    <p><small>${error.message}</small></p>
                </div>
            `;
        });
}

// Ajuste para garantir que os botões de detalhes funcionem 
document.addEventListener('DOMContentLoaded', function () {
    // Função para adicionar os event listeners aos botões de detalhes
    function setupDetailButtons() {
        const viewButtons = document.querySelectorAll('.view-quiz-btn');
        console.log('Botões encontrados:', viewButtons.length);

        viewButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                console.log('Botão clicado!');
                const username = this.getAttribute('data-username');
                const quizType = this.getAttribute('data-type');
                const timestamp = this.getAttribute('data-timestamp');

                console.log('Exibindo detalhes para:', username, quizType, timestamp);
                showQuizDetails(username, quizType, timestamp);
            });
        });
    }

    // Oberservador de mutação para detectar quando a tabela é atualizada
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'childList') {
                setupDetailButtons();
            }
        });
    });

    // Observar mudanças na tabela de checklists recentes
    const recentQuizzesBody = document.getElementById('recent-quizzes-body');
    if (recentQuizzesBody) {
        observer.observe(recentQuizzesBody, { childList: true });

        // Também configurar os botões existentes
        setupDetailButtons();
    }

    // Adicionar event listener global para botões de detalhes (delegação de eventos)
    document.body.addEventListener('click', function (e) {
        if (e.target.classList.contains('view-quiz-btn') ||
            e.target.closest('.view-quiz-btn')) {

            const btn = e.target.classList.contains('view-quiz-btn') ?
                e.target : e.target.closest('.view-quiz-btn');

            const username = btn.getAttribute('data-username');
            const quizType = btn.getAttribute('data-type');
            const timestamp = btn.getAttribute('data-timestamp');

            showQuizDetails(username, quizType, timestamp);
        }
    });
});

// Adicionar no fim do seu admin.js dentro do bloco DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    // Configurar fechamento do modal de detalhes
    const closeButtons = document.querySelectorAll('.admin-modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', function () {
            const modal = this.closest('.admin-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    // Função para configurar os event listeners da seção de estatísticas
    function setupStatisticsButtons() {
        // Botões "Ver Detalhes" nas estatísticas
        document.querySelectorAll('.stats-detail-btn').forEach(button => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                const username = this.getAttribute('data-username');
                const quizType = this.getAttribute('data-type');

                console.log(`Mostrando detalhes para usuário: ${username}, tipo: ${quizType}`);

                // Filtrar os checklists deste usuário/tipo na tabela ou abrir um modal específico
                filterChecklistsByUserAndType(username, quizType);
            });
        });

        // Botões "Checklists" na seção de usuários
        document.querySelectorAll('.user-checklists-btn').forEach(button => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                const username = this.getAttribute('data-username');

                console.log(`Mostrando checklists do usuário: ${username}`);

                // Filtrar apenas os checklists deste usuário
                filterChecklistsByUser(username);
            });
        });
    }

    // Função para filtrar checklists por usuário e tipo
    function filterChecklistsByUserAndType(username, quizType) {
        // Mostrar o tab de checklists se não estiver visível
        const checklistsTab = document.getElementById('checklists-tab');
        if (checklistsTab) {
            // Ativar a aba de checklists
            const tabButtons = document.querySelectorAll('.tab');
            tabButtons.forEach(tab => tab.classList.remove('active'));

            const checklistsTabButton = document.querySelector('[data-tab="checklists-tab"]');
            if (checklistsTabButton) {
                checklistsTabButton.classList.add('active');
            }

            // Mostrar o conteúdo da aba
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            checklistsTab.classList.add('active');

            // Aplicar filtros na tabela
            const rows = document.querySelectorAll('#recent-quizzes-body tr');
            rows.forEach(row => {
                const rowUsername = row.querySelector('td:nth-child(2)')?.textContent;
                const rowType = row.querySelector('.quiz-type-pill')?.getAttribute('data-type');

                if ((username === 'all' || rowUsername === username) &&
                    (quizType === 'all' || rowType === quizType)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });

            // Exibir mensagem de filtro ativo
            const filterMessage = document.getElementById('active-filter-message');
            if (filterMessage) {
                filterMessage.textContent = `Filtro: Usuário "${username}" ${quizType !== 'all' ? `, Tipo "${getQuizTypeLabel(quizType)}"` : ''}`;
                filterMessage.style.display = 'block';
            }
        }
    }

    // Função para filtrar checklists apenas por usuário
    function filterChecklistsByUser(username) {
        filterChecklistsByUserAndType(username, 'all');
    }

    // Adicionar um observador de mutações para reconfigurar os botões quando o DOM mudar
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'childList' &&
                (mutation.target.id === 'user-statistics' ||
                    mutation.target.classList.contains('chart-content'))) {
                setTimeout(setupStatisticsButtons, 100);
            }
        });
    });

    // Observar a tabela de estatísticas
    const userStats = document.getElementById('user-statistics');
    const chartContent = document.querySelector('.chart-content');

    if (userStats) {
        observer.observe(userStats, { childList: true, subtree: true });
    }

    if (chartContent) {
        observer.observe(chartContent, { childList: true, subtree: true });
    }

    // Configurar botões existentes
    setupStatisticsButtons();

    // Adicionar um ouvinte de eventos ao botão "Limpar Filtros" se existir
    const clearFilterButton = document.getElementById('clear-filter-btn');
    if (clearFilterButton) {
        clearFilterButton.addEventListener('click', function () {
            const rows = document.querySelectorAll('#recent-quizzes-body tr');
            rows.forEach(row => row.style.display = '');

            const filterMessage = document.getElementById('active-filter-message');
            if (filterMessage) {
                filterMessage.style.display = 'none';
            }
        });
    }
});