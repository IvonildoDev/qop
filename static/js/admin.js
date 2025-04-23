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
                        window.location.href = `/admin/quiz-details?username=${username}&type=${quizType}&timestamp=${timestamp}`;
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
            }
        });
    }

    if (modalCloseButtons.length > 0) {
        modalCloseButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (addUserModal) {
                    addUserModal.style.display = 'none';
                }
                if (addUserForm) {
                    addUserForm.reset();
                }
            });
        });
    }

    // Clicar fora do modal para fechar
    window.addEventListener('click', (event) => {
        if (event.target === addUserModal) {
            addUserModal.style.display = 'none';
            addUserForm.reset();
        }
    });

    // Adicionar usuário
    if (addUserForm) {
        addUserForm.addEventListener('submit', async function (e) {
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
            observationsElement.textContent = data.observations || 'Sem observações.';

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
                photosContainer.innerHTML = `
                    <h3>Fotos</h3>
                    <div class="photos-grid">
                        ${data.photos.map(photo => `
                            <div class="photo-item">
                                <img src="/${photo.path}" alt="Foto do checklist" class="quiz-photo">
                            </div>
                        `).join('')}
                    </div>
                `;
                photosContainer.style.display = 'block';
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
    // Calcular totais
    const totalQuizzes = data.recent_quizzes.length;
    const activeUsers = new Set(data.recent_quizzes.map(q => q.username)).size;
    const totalNc = data.recent_quizzes.reduce((acc, curr) => acc + curr.nc_count, 0);

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

    // Aqui você pode implementar um gráfico usando uma biblioteca como Chart.js
    // Este é um exemplo simples, você precisaria adicionar a biblioteca Chart.js ao seu HTML
    const chartCanvas = document.getElementById('quizzes-chart');
    if (chartCanvas && typeof Chart !== 'undefined') {
        // Limpar qualquer gráfico existente
        if (chartCanvas.chart) {
            chartCanvas.chart.destroy();
        }

        // Preparar dados para o gráfico
        const stats = data.statistics;
        const labels = [];
        const datasets = {};

        // Agrupar dados por data/mês
        if (period === 'daily' || period === 'monthly') {
            const timeField = period === 'daily' ? 'date' : 'month';

            // Extrair datas/meses únicas
            stats.forEach(stat => {
                if (!labels.includes(stat[timeField])) {
                    labels.push(stat[timeField]);
                }

                // Inicializar dataset para o tipo de quiz se não existir
                if (!datasets[stat.quiz_type]) {
                    datasets[stat.quiz_type] = {
                        label: getQuizTypeLabel(stat.quiz_type),
                        data: Array(labels.length).fill(0),
                        backgroundColor: getQuizTypeColor(stat.quiz_type)
                    };
                }
            });

            // Preencher dados
            stats.forEach(stat => {
                const index = labels.indexOf(stat[timeField]);
                if (!datasets[stat.quiz_type].data[index]) {
                    datasets[stat.quiz_type].data[index] = 0;
                }
                datasets[stat.quiz_type].data[index] += stat.count;
            });
        } else {
            // Gráfico geral por tipo
            stats.forEach(stat => {
                if (!labels.includes(stat.quiz_type)) {
                    labels.push(stat.quiz_type);
                }
            });

            // Criar um dataset por usuário
            const users = [...new Set(stats.map(s => s.username))];
            users.forEach(user => {
                datasets[user] = {
                    label: user,
                    data: Array(labels.length).fill(0),
                    backgroundColor: getRandomColor()
                };
            });

            // Preencher dados
            stats.forEach(stat => {
                const index = labels.indexOf(stat.quiz_type);
                datasets[stat.username].data[index] = stat.count;
            });
        }

        // Criar o gráfico
        const chartData = {
            labels: labels,
            datasets: Object.values(datasets)
        };

        chartCanvas.chart = new Chart(chartCanvas, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false
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

    // Agrupar por usuário
    const userCounts = {};
    data.statistics.forEach(stat => {
        if (!userCounts[stat.username]) {
            userCounts[stat.username] = 0;
        }
        userCounts[stat.username] += stat.count;
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
}

// Função para atualizar a tabela de checklists recentes
function updateRecentQuizzes(data) {
    const recentQuizzesBody = document.getElementById('recent-quizzes-body');
    if (!recentQuizzesBody) return;

    if (data.recent_quizzes && data.recent_quizzes.length > 0) {
        const rows = data.recent_quizzes.map(quiz => {
            // Formatar data
            const date = new Date(quiz.timestamp);
            const formattedDate = date.toLocaleString('pt-BR');

            // Determinar classe para o tipo de quiz
            const quizTypeClass = getQuizTypeClass(quiz.quiz_type);

            return `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${quiz.username}</td>
                    <td><span class="quiz-type-pill ${quizTypeClass}">${getQuizTypeLabel(quiz.quiz_type)}</span></td>
                    <td>${quiz.questions_count}</td>
                    <td class="nc-count">${quiz.nc_count}</td>
                    <td>
                        <button class="btn-action view-quiz-btn" 
                                data-username="${quiz.username}" 
                                data-type="${quiz.quiz_type}" 
                                data-timestamp="${quiz.timestamp}">
                            Ver Detalhes
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        recentQuizzesBody.innerHTML = rows;

        // Adicionar event listeners aos botões de detalhes
        const viewButtons = recentQuizzesBody.querySelectorAll('.view-quiz-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                const username = this.dataset.username;
                const type = this.dataset.type;
                const timestamp = this.dataset.timestamp;

                window.location.href = `/admin/quiz-details?username=${username}&type=${type}&timestamp=${timestamp}`;
            });
        });
    } else {
        recentQuizzesBody.innerHTML = '<tr><td colspan="6">Nenhum checklist encontrado</td></tr>';
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