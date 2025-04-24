document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const loggedInUser = document.getElementById('logged-in-user');
    const logoutButton = document.getElementById('logout-button');
    const quizList = document.getElementById('quiz-list');
    const quizMessage = document.getElementById('quiz-message');
    const historyList = document.getElementById('history-list');
    const historyMessage = document.getElementById('history-message');

    // Modal de checklist
    const quizModal = document.getElementById('quiz-modal');
    const modalQuizTitle = document.getElementById('modal-quiz-title');
    const modalQuestionsContainer = document.getElementById('modal-questions-container');
    const modalObservations = document.getElementById('modal-observations');
    const modalPhotoUpload = document.getElementById('modal-photo-upload');
    const photoPreviews = document.getElementById('photo-previews');
    const modalSubmitQuizButton = document.getElementById('modal-submit-quiz-button');
    const modalSubmitMessage = document.getElementById('modal-submit-message');

    // Filtros e detalhes do histórico
    const historyDateFrom = document.getElementById('history-date-from');
    const historyDateTo = document.getElementById('history-date-to');
    const filterHistoryButton = document.getElementById('filter-history-button');
    const resetFilterButton = document.getElementById('reset-filter-button');
    const historyDetailModal = document.getElementById('history-detail-modal');

    const API_BASE_URL = 'http://127.0.0.1:5000';

    // Array para armazenar os arquivos de imagem selecionados
    let selectedPhotos = [];

    // Adicionar variável global para armazenar a localização
    let userLocation = null;

    // --- Dados das Perguntas ---
    const questions = {
        pre_operacional: [
            { number: 1, text: "Esta Operação é Rotineira?" },
            { number: 2, text: "Superfícies de trabalho estão secas ou então são antiderrapantes." },
            { number: 3, text: "Existe padrão para executar a tarefa?" },
            { number: 4, text: "Não se percebem odores estranhos ou contaminantes aéreos visíveis (poeiras, fumaça, névoas, vapores) na área de trabalho." },
            { number: 5, text: "Todos os Executantes foram treinados no padrão?" },
            { number: 6, text: "Sinalizar a área com cones e fita zebrada." },
            { number: 7, text: "As válvulas do poço estão operacionais em bom estado." },
            { number: 8, text: "As conexões de poço estão sem desgaste, em conformidade." },
            { number: 9, text: "Existe conhecimento de pressão máxima que poderia ocorrer durante a operação?" },
            { number: 10, text: "Todos os dispositivos de medição, monitoramento e controle estão instalados e disponíveis?" },
            { number: 11, text: "Os empregados estão usando corretamente os EPI's e estes são apropriados a tarefa." },
            { number: 12, text: "Foi verificado todos os componentes (Valvulas, manômetros, conexões, etc.) das instalações existentes são compatíveis em pressões maximas?" },
            { number: 13, text: "As mangueiras do sistema hidraulico estão em conformidade sem vazamentos." },
            { number: 14, text: "Espaço adequado em torno do poço para permitir operação e movimentação segura de materiais e pessoas." },
            { number: 15, text: "Sistema Hidraulico da unidade não apresenta vazamentos de óleo." },
            { number: 16, text: "Foi verificado todos os componentes (Valvulas, manômetros, conexões, etc.) das instalações temporárias são compatíveis em pressões maximas?" },
            { number: 17, text: "Se a operação for de TESTE DE COLUNA, verificar posicionamento das valvulas" },
            { number: 18, text: "Se a operação for CIRCULAÇÃO, verificar posicionamento de válvulas." },
            { number: 19, text: "Todos os dispositivos de medição, monitoramento e controle (manômetros, sensores de pressão, registradores, PSV, etc) estão calibrados e compatíveis com as pressões que irão ocorrer?" },
            { number: 20, text: "O sistema de bombeio é recomendado para a operação a ser realizada?" },
            { number: 21, text: "Os instrumentos de medição estão calibrados e em bom estado." },
            { number: 22, text: "As inspeções dos componentes das INSTALAÇÕES TEMPORÁRIAS estão atualizadas?" },
            { number: 23, text: "Todas as tubulações, conexões, instrumentos, etc. Das INSTALAÇÕES TEMPORÁRIAS apresentam-se bom estado e sem danos ou desgastes visuais?" },
            { number: 24, text: "No caso de TESTE HIDROSTATICO, o sistema foi totalmente preenchido com água, ou seja: todo ar foi removido?" },
            { number: 25, text: "Foi definida uma valvula segura para operação?" },
            { number: 26, text: "As INSTALAÇÕES TEMPORÁRIAS estão devidamente montadas e apoiadas?" },
            { number: 27, text: "Foi medido o nível de H2S?" }
        ],
        caminhao: [
            { number: 1, text: "Freios" },
            { number: 2, text: "Nível de líquido de arrefecimento" },
            { number: 3, text: "Nível de Óleo da Direção Hidraulica" },
            { number: 4, text: "Nível de Óleo Lubrificante do Motor" },
            { number: 5, text: "Nível de Óleo do Sistema Hidraulico" },
            { number: 6, text: "Pneus / Step" },
            { number: 7, text: "Retrovisores" },
            { number: 8, text: "Sistema de direção" },
            { number: 9, text: "Tacografo" },
            { number: 10, text: "Vazamentos de Ar" },
            { number: 11, text: "Funcionamento do motor" },
            { number: 12, text: "Lubrificação Geral" },
            { number: 13, text: "Nível de Combustível" },
            { number: 14, text: "Vazamentos de òleo" },
            { number: 15, text: "Extintor de incêndio" },
            { number: 16, text: "Estribos" },
            { number: 17, text: "Parachoque" },
            { number: 18, text: "Velocimetro" },
            { number: 19, text: "Farois / Lanternas dianteiras e Traseiras" },
            { number: 20, text: "Buzina" },
            { number: 21, text: "Limpador de Parabrisas / Esguicho d'água" },
            { number: 22, text: "Painel de Instrumentos" },
            { number: 23, text: "Pisca alertas / Setas de Direção" },
            { number: 24, text: "Stop de freio" },
            { number: 25, text: "Luz alta, baixa e alarme de ré" },
            { number: 26, text: "Luz traseira e lâmpada de placa" },
            { number: 27, text: "Identificação de Capacidade de carga" },
            { number: 28, text: "Macaco / Chave de roda" },
            { number: 29, text: "Trincos das Portas" }
        ],
        carga: [
            { number: 1.1, text: "Foi realizado inspeção visual dos olhais de ancoragem da plataforma de trabalho?" },
            { number: 1.2, text: "Foi realizado inspeção visual na cinta de amarração tipo catraca?" },
            { number: 1.3, text: "A catraca da cinta de amarração está operacional?" },
            { number: 1.4, text: "Foi verificado a integridade do suporte ancoragem do lubrificador?" },
            { number: 2.1, text: "Os acessórios utilizados para amarração da carga são adequados?" },
            { number: 2.2, text: "Foi verificado a tensão da cinta após amarração da carga para garantir a qualidade da amarração?" },
            { number: 2.4, text: "Foi verificado o fechamento e o travamento do suporte do lubrificador após acondicionamento da carga?" },
            { number: 2.5, text: "A amarração tem 4 pontos de ancoragem?" },
            { number: 3.1, text: "Todos os executantes envolvidos na atividade foram treinados e estão cientes sobre os riscos envolvidos e os cuidados a serem adotados?" },
            { number: 4.1, text: "O equipamento que fará o transporte está íntegro?" }
        ]
    };

    // --- Funções Auxiliares ---
    function displayMessage(element, message, isError = false) {
        element.textContent = message;
        element.style.color = isError ? 'red' : 'green';
        element.style.display = 'block';
    }

    // Adicionar esta função no início do seu script
    function checkMobile() {
        return window.innerWidth <= 768;
    }

    // Função para capturar a localização do usuário
    function captureLocation() {
        const locationInfo = document.querySelector('.location-info');
        const locationButton = document.querySelector('.location-button');

        if (!navigator.geolocation) {
            locationInfo.innerHTML = '<p class="error">Geolocalização não é suportada pelo seu navegador.</p>';
            return;
        }

        locationButton.disabled = true;
        locationButton.textContent = 'Obtendo localização...';
        locationInfo.innerHTML = '<p>Aguarde, obtendo sua localização...</p>';

        navigator.geolocation.getCurrentPosition(
            // Sucesso
            (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                userLocation = {
                    latitude,
                    longitude,
                    accuracy
                };

                locationInfo.innerHTML = `
                    <p class="success">Localização capturada com sucesso!</p>
                    <p><strong>Latitude:</strong> ${latitude.toFixed(6)}</p>
                    <p><strong>Longitude:</strong> ${longitude.toFixed(6)}</p>
                    <p><strong>Precisão:</strong> ${accuracy.toFixed(1)} metros</p>
                `;

                locationButton.textContent = 'Atualizar Localização';
                locationButton.disabled = false;
            },
            // Erro
            (error) => {
                let errorMessage;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Você não permitiu o acesso à sua localização.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Informações de localização indisponíveis.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Tempo esgotado ao tentar obter localização.";
                        break;
                    default:
                        errorMessage = "Erro desconhecido ao obter localização.";
                        break;
                }

                locationInfo.innerHTML = `<p class="error">${errorMessage}</p>`;
                locationButton.textContent = 'Tentar Novamente';
                locationButton.disabled = false;
            },
            // Opções
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    // --- Verificação de Login e Inicialização ---
    async function checkLoginStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/check-login`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                // Se não estiver logado, redireciona para página de login
                window.location.href = 'login.html';
                return false;
            }

            const data = await response.json();
            if (data.username) {
                // Mostrar nome do usuário
                loggedInUser.textContent = data.username;
                return true;
            } else {
                window.location.href = 'login.html';
                return false;
            }
        } catch (error) {
            console.error('Erro ao verificar status de login:', error);
            window.location.href = 'login.html';
            return false;
        }
    }

    // Adicionar ao final da função checkUserLogin()
    async function checkUserLogin() {
        try {
            const response = await fetch('/check-login');

            if (response.ok) {
                const data = await response.json();

                // Display username
                document.getElementById('logged-in-user').textContent = data.username;

                // Se o usuário for admin, mostrar link para área administrativa
                if (data.is_admin) {
                    const userControls = document.querySelector('.user-controls');
                    if (userControls) {
                        const adminLink = document.createElement('a');
                        adminLink.href = '/admin/dashboard';
                        adminLink.className = 'admin-dashboard-link';
                        adminLink.textContent = 'Área Administrativa';
                        adminLink.style.marginRight = '15px';
                        userControls.insertBefore(adminLink, userControls.firstChild);
                    }
                }

            } else {
                // Not logged in, redirect to login
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            window.location.href = '/login.html';
        }
    }

    // --- Funções do Modal ---
    function openModal() {
        quizModal.style.display = 'block';
        if (checkMobile()) {
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal() {
        quizModal.style.display = 'none';
        modalQuestionsContainer.innerHTML = '';
        modalSubmitMessage.textContent = '';
        modalObservations.value = '';
        photoPreviews.innerHTML = '';
        selectedPhotos = [];
        userLocation = null; // Resetar localização

        // Garantir que o botão de envio volta a ser visível para próximos quizzes
        modalSubmitQuizButton.style.display = 'block';
        modalSubmitQuizButton.disabled = false;
        modalSubmitQuizButton.textContent = "Enviar Respostas";
    }

    // Fechar modal ao clicar no X
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.modal').style.display = 'none';
            // Restaurar rolagem da página em dispositivos móveis
            if (checkMobile()) {
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Fechar modal ao clicar fora dele
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Configurar o botão para fechar o modal de detalhes
    const closeButtons = document.querySelectorAll('.close-button');
    closeButtons.forEach(button => {
        button.addEventListener('click', function () {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Fechar modal clicando fora dele
    window.addEventListener('click', function (event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // --- Lógica de Logout ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async function () {
            try {
                // Chamada à API para fazer logout
                const response = await fetch('/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin'
                });

                if (response.ok) {
                    // Redirecionar para a página de login após logout bem-sucedido
                    window.location.href = '/login.html';
                } else {
                    console.error('Erro ao fazer logout:', response.statusText);
                    // Mesmo com erro, tentar redirecionar
                    window.location.href = '/login.html';
                }
            } catch (error) {
                console.error('Erro ao processar logout:', error);
                // Mesmo com erro, tentar redirecionar
                window.location.href = '/login.html';
            }
        });
    }

    // --- Lógica de Quizzes ---
    async function fetchQuizzes() {
        quizMessage.textContent = '';
        quizList.innerHTML = '<li>Carregando checklists...</li>';

        try {
            const response = await fetch(`${API_BASE_URL}/quizzes`, {
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                quizList.innerHTML = '';

                if (data.quizzes && data.quizzes.length > 0) {
                    data.quizzes.forEach(quiz => {
                        const li = document.createElement('li');
                        const button = document.createElement('button');
                        button.textContent = quiz.name;
                        button.addEventListener('click', () => startQuiz(quiz.id, quiz.name));
                        li.appendChild(button);
                        quizList.appendChild(li);
                    });
                } else {
                    quizList.innerHTML = '<li>Nenhum checklist disponível.</li>';
                }
            } else {
                displayMessage(quizMessage, data.message || 'Erro ao carregar checklists.', true);

                if (response.status === 401) {
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                }

                quizList.innerHTML = '';
            }
        } catch (error) {
            console.error('Erro ao buscar checklists:', error);
            displayMessage(quizMessage, 'Erro de conexão ao buscar checklists.', true);
            quizList.innerHTML = '';
        }
    }

    // Função para criar um modal de perguntas melhorado
    function startQuiz(quizId, quizName) {
        console.log(`Iniciando checklist: ${quizName} (ID: ${quizId})`);

        // Limpar conteúdo anterior
        modalQuestionsContainer.innerHTML = '';
        modalSubmitMessage.textContent = '';

        // Criar header para o modal
        modalQuizTitle.textContent = `Checklist: ${quizName}`;

        // Adicionar legenda na parte superior do modal com estilo aprimorado
        const legendDiv = document.createElement('div');
        legendDiv.className = 'answer-legend';
        legendDiv.innerHTML = `
            <strong>Legenda:</strong>
            <span class="legend-item C">C = Conforme</span>
            <span class="legend-item NC">N/C = Não Conforme</span>
            <span class="legend-item NA">N/A = Não se Aplica</span>
        `;
        modalQuestionsContainer.appendChild(legendDiv);

        const quizQuestions = questions[quizId];

        if (!quizQuestions) {
            console.error(`Erro: Perguntas não encontradas para ID '${quizId}'`);
            modalQuestionsContainer.innerHTML = '<div class="error-message">Erro: Perguntas não encontradas para este checklist.</div>';
            openModal();
            return;
        }

        // Armazenar o ID do quiz atual no botão de envio
        modalSubmitQuizButton.dataset.currentQuizId = quizId;
        modalSubmitQuizButton.dataset.currentQuizName = quizName;

        // ADICIONAR CAMPO DE LOCALIZAÇÃO APENAS PARA PRÉ-OPERACIONAL
        if (quizId === 'pre_operacional') {
            const locationDiv = document.createElement('div');
            locationDiv.className = 'location-section';

            const locationTitle = document.createElement('h3');
            locationTitle.textContent = 'Localização (Opcional)';
            locationDiv.appendChild(locationTitle);

            const locationInfo = document.createElement('div');
            locationInfo.className = 'location-info';
            locationInfo.innerHTML = '<p>Sua localização não foi capturada.</p>';
            locationDiv.appendChild(locationInfo);

            const locationButton = document.createElement('button');
            locationButton.type = 'button';
            locationButton.className = 'location-button';
            locationButton.textContent = 'Capturar Localização';
            locationButton.onclick = captureLocation;
            locationDiv.appendChild(locationButton);

            modalQuestionsContainer.appendChild(locationDiv);
        }

        // Criar perguntas com design aprimorado
        quizQuestions.forEach((q) => {
            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question-item');
            questionDiv.dataset.questionNumber = q.number;

            const questionText = document.createElement('p');
            questionText.textContent = `${q.number}. ${q.text}`;
            questionDiv.appendChild(questionText);

            const answersDiv = document.createElement('div');
            answersDiv.classList.add('question-answers');

            const options = [
                { value: 'C', label: 'C' },
                { value: 'N/C', label: 'N/C' },
                { value: 'N/A', label: 'N/A' }
            ];

            options.forEach(option => {
                const optionButton = document.createElement('button');
                optionButton.type = 'button';
                optionButton.className = `answer-button ${option.value}`;
                optionButton.textContent = option.label;
                optionButton.setAttribute('data-value', option.value);

                // Adicionar comportamento de seleção ao clicar
                optionButton.addEventListener('click', function () {
                    // Remover classe selecionada de todos os botões neste grupo
                    answersDiv.querySelectorAll('button').forEach(btn => {
                        btn.classList.remove('selected');
                    });

                    // Adicionar classe selecionada a este botão
                    this.classList.add('selected');

                    // Atualizar valor do campo oculto
                    const hiddenInput = answersDiv.querySelector('input[type="hidden"]');
                    hiddenInput.value = this.getAttribute('data-value');
                });

                answersDiv.appendChild(optionButton);
            });

            // Adicionar campo oculto para armazenar o valor selecionado
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = `modal_question_${q.number}`;
            hiddenInput.value = '';
            answersDiv.appendChild(hiddenInput);

            questionDiv.appendChild(answersDiv);
            modalQuestionsContainer.appendChild(questionDiv);
        });

        // Rolar para o topo do modal
        setTimeout(() => {
            if (modalQuestionsContainer.scrollTo) {
                modalQuestionsContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 100);

        openModal();
    }

    // Gerenciar upload de fotos
    modalPhotoUpload.addEventListener('change', (event) => {
        const files = event.target.files;

        if (files.length + selectedPhotos.length > 3) {
            alert('Você pode adicionar no máximo 3 fotos.');
            return;
        }

        for (let i = 0; i < files.length; i++) {
            if (selectedPhotos.length >= 3) {
                alert('Limite de 3 fotos atingido.');
                break;
            }

            const file = files[i];
            const reader = new FileReader();

            reader.onload = function (e) {
                const previewContainer = document.createElement('div');
                previewContainer.className = 'photo-preview';

                const img = document.createElement('img');
                img.src = e.target.result;
                previewContainer.appendChild(img);

                const removeBtn = document.createElement('span');
                removeBtn.className = 'remove-photo';
                removeBtn.innerHTML = '×';
                removeBtn.onclick = function () {
                    const index = selectedPhotos.indexOf(file);
                    if (index > -1) {
                        selectedPhotos.splice(index, 1);
                    }
                    previewContainer.remove();
                };
                previewContainer.appendChild(removeBtn);

                photoPreviews.appendChild(previewContainer);
                selectedPhotos.push(file);
            };

            reader.readAsDataURL(file);
        }
    });

    // Enviar respostas do checklist
    modalSubmitQuizButton.addEventListener('click', async () => {
        modalSubmitMessage.textContent = '';
        const quizType = modalSubmitQuizButton.dataset.currentQuizId;
        const quizName = modalSubmitQuizButton.dataset.currentQuizName;

        if (!quizType) {
            displayMessage(modalSubmitQuizMessage, 'Erro: Tipo de checklist não identificado.', true);
            return;
        }

        const currentQuestions = questions[quizType];
        const responses = [];
        let allAnswered = true;

        currentQuestions.forEach(q => {
            const hiddenInput = modalQuestionsContainer.querySelector(`input[name="modal_question_${q.number}"]`);
            if (hiddenInput && hiddenInput.value) {
                responses.push({
                    number: q.number,
                    text: q.text,
                    answer: hiddenInput.value
                });
            } else {
                allAnswered = false;
            }
        });

        if (!allAnswered) {
            displayMessage(modalSubmitQuizMessage, 'Por favor, responda todas as perguntas.', true);
            return;
        }

        // Obter observações
        const observations = modalObservations.value.trim();

        // Criar FormData para enviar dados e arquivos
        const formData = new FormData();
        formData.append('quizType', quizType);
        formData.append('responses', JSON.stringify(responses));
        formData.append('observations', observations);

        // Adicionar localização se estiver disponível e for o checklist pré-operacional
        if (quizType === 'pre_operacional' && userLocation) {
            formData.append('location', JSON.stringify(userLocation));
        }

        // Adicionar fotos ao FormData
        selectedPhotos.forEach((photo, index) => {
            formData.append(`photo${index + 1}`, photo);
        });

        // No JavaScript, antes de enviar os dados
        console.log("Enviando dados:", {
            quizType,
            responses: JSON.parse(JSON.stringify(responses)),  // Verificar se está válido
            observations,
            location: userLocation
        });

        // Garantir que userLocation tem o formato correto
        if (userLocation) {
            // Garantir que todos os campos são números
            userLocation.latitude = Number(userLocation.latitude);
            userLocation.longitude = Number(userLocation.longitude);
            userLocation.accuracy = Number(userLocation.accuracy || 0);
        }

        try {
            // Desabilitar o botão enquanto envia
            modalSubmitQuizButton.disabled = true;
            modalSubmitQuizButton.textContent = "Enviando...";

            const response = await fetch(`${API_BASE_URL}/submit`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                // Mostrar mensagem de sucesso
                displayMessage(modalSubmitQuizButton, data.message);

                // Substituir o conteúdo do modal com opções após envio
                modalQuestionsContainer.innerHTML = '';

                // Criar div para as opções pós-envio
                const postSubmitDiv = document.createElement('div');
                postSubmitDiv.className = 'post-submit-options';

                // Título de confirmação
                const confirmText = document.createElement('h3');
                confirmText.textContent = 'Checklist enviado com sucesso!';
                confirmText.style.color = 'green';
                confirmText.style.textAlign = 'center';
                postSubmitDiv.appendChild(confirmText);

                // Botões de opção
                const optionsDiv = document.createElement('div');
                optionsDiv.style.display = 'flex';
                optionsDiv.style.justifyContent = 'space-around';
                optionsDiv.style.marginTop = '20px';

                // Botão para novo checklist do mesmo tipo
                const newSameTypeBtn = document.createElement('button');
                newSameTypeBtn.textContent = `Novo ${quizName}`;
                newSameTypeBtn.onclick = () => {
                    closeModal();
                    startQuiz(quizType, quizName);
                };

                // Botão para voltar à seleção de checklist
                const backToSelectionBtn = document.createElement('button');
                backToSelectionBtn.textContent = 'Escolher Outro Checklist';
                backToSelectionBtn.onclick = () => closeModal();

                // Botão para visualizar histórico
                const viewHistoryBtn = document.createElement('button');
                viewHistoryBtn.textContent = 'Ver Histórico';
                viewHistoryBtn.onclick = () => {
                    closeModal();
                    fetchHistory();
                };

                // Adicionar botões ao container
                optionsDiv.appendChild(newSameTypeBtn);
                optionsDiv.appendChild(backToSelectionBtn);
                optionsDiv.appendChild(viewHistoryBtn);
                postSubmitDiv.appendChild(optionsDiv);

                // Substituir o conteúdo do modal
                modalQuestionsContainer.appendChild(postSubmitDiv);

                // Ocultar botão de envio
                modalSubmitQuizButton.style.display = 'none';

                // Atualizar histórico em segundo plano
                fetchHistory();
            } else {
                if (response.status === 401) {
                    displayMessage(modalSubmitQuizMessage, 'Sua sessão expirou. Por favor, faça login novamente.', true);
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    displayMessage(modalSubmitQuizMessage, data.message || 'Erro ao enviar respostas.', true);
                    modalSubmitQuizButton.disabled = false;
                    modalSubmitQuizButton.textContent = "Enviar Respostas";
                }
            }
        } catch (error) {
            console.error('Erro ao enviar respostas:', error);
            displayMessage(modalSubmitQuizButton, 'Erro de conexão ao enviar respostas.', true);
            modalSubmitQuizButton.disabled = false;
            modalSubmitQuizButton.textContent = "Enviar Respostas";
        }
    });

    // --- Lógica de Histórico ---
    async function fetchHistory(fromDate = null, toDate = null, limit = 7) {
        historyMessage.textContent = '';
        historyList.innerHTML = '<li>Carregando histórico...</li>';

        // Construir a URL com os parâmetros
        let url = `${API_BASE_URL}/user/history`;
        const params = new URLSearchParams();

        if (fromDate) params.append('from_date', fromDate);
        if (toDate) params.append('to_date', toDate);
        params.append('limit', limit);

        url += '?' + params.toString();

        try {
            const response = await fetch(url, {
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                historyList.innerHTML = '';

                if (data.history && data.history.length > 0) {
                    data.history.forEach(item => {
                        const li = document.createElement('li');

                        // Formatar a data em formato brasileiro
                        const formattedDate = new Date(item.last_attempt).toLocaleString('pt-BR');

                        li.innerHTML = `
                            <strong>${item.quiz_description || item.quiz_type}</strong> - 
                            <span class="history-count">${item.question_count} perguntas</span> - 
                            <span class="history-date">${formattedDate}</span>
                        `;

                        // Guardar dados para detalhes
                        li.dataset.historyId = item.id;
                        li.dataset.quizType = item.quiz_type;
                        li.dataset.timestamp = item.last_attempt;

                        // Ao clicar, mostrar detalhes
                        li.addEventListener('click', () => showHistoryDetails(item.id));

                        historyList.appendChild(li);
                    });
                } else {
                    historyList.innerHTML = '<li class="no-data">Nenhum histórico encontrado.</li>';
                }
            } else {
                displayMessage(historyMessage, data.message || 'Erro ao buscar histórico.', true);

                if (response.status === 401) {
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                }

                historyList.innerHTML = '';
            }
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            displayMessage(historyMessage, 'Erro de conexão ao buscar histórico.', true);
            historyList.innerHTML = '';
        }
    }

    // Modificar a função showHistoryDetails
    async function showHistoryDetails(quizId) {
        try {
            // Código existente...

            const response = await fetch(`/quiz/${quizId}/details`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log("Dados recebidos dos detalhes:", data);

            // Construir o HTML de detalhes
            let html = `
                <div class="history-detail-header">
                    <h3>${formatQuizType(data.details.type)}</h3>
                    <p class="timestamp">Data: ${new Date(data.details.date).toLocaleString('pt-BR')}</p>
                </div>
            `;

            // ADICIONE ESTA SEÇÃO: Criar tabela de perguntas e respostas
            html += `
                <div class="questions-list">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Pergunta</th>
                                <th>Resposta</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Iterar sobre as questões e mostrar as respostas
            data.details.questions.forEach(question => {
                html += `
                    <tr>
                        <td>${question.text}</td>
                        <td class="${getAnswerClass(question.answer)}">${formatAnswer(question.answer)}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            // Seção de observações (já existente)
            html += `
                <div class="observations-section">
                    <h4>Observações:</h4>
                    <div class="observation-text">
                        ${data.details.observations ? data.details.observations : 'Nenhuma observação registrada.'}
                    </div>
                </div>
            `;

            // Se houver fotos, adicionar seção de fotos
            if (data.details.photos && data.details.photos.length > 0) {
                html += `
                    <div class="photos-section">
                        <h4>Fotos:</h4>
                        <div class="photo-gallery">
                `;

                data.details.photos.forEach(photo => {
                    html += `
                        <div class="history-photo">
                            <a href="${photo.path}" target="_blank">
                                <img src="${photo.path}" alt="Foto do checklist">
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
            document.getElementById('history-detail-content').innerHTML = html;

            // Exibir o modal
            document.getElementById('history-detail-modal').style.display = 'block';

        } catch (error) {
            console.error("Erro ao buscar detalhes:", error);
        }
    }

    // Funções auxiliares
    function formatQuizType(type) {
        const types = {
            'pre_operacional': 'Checklist Pré-Operacional',
            'caminhao': 'Checklist Caminhão',
            'carga': 'Checklist Carga'
        };
        return types[type] || type;
    }

    function getAnswerClass(answer) {
        if (answer === 'C') return 'answer-conformity';
        if (answer === 'NC' || answer === 'N/C') return 'answer-nonconformity';
        if (answer === 'NA' || answer === 'N/A') return 'answer-notapplicable';
        return '';
    }

    function formatAnswer(answer) {
        if (answer === 'C') return 'Conforme';
        if (answer === 'NC' || answer === 'N/C') return 'Não Conforme';
        if (answer === 'NA' || answer === 'N/A') return 'Não se Aplica';
        return answer;
    }

    // Evento para filtro de histórico (manter o limite padrão de 7)
    filterHistoryButton.addEventListener('click', () => {
        const fromDate = historyDateFrom.value;
        const toDate = historyDateTo.value;
        fetchHistory(fromDate, toDate, 7);
    });

    // Adicionar opção para ver histórico completo
    resetFilterButton.addEventListener('click', () => {
        historyDateFrom.value = '';
        historyDateTo.value = '';

        // Opção para ver todos os checklists (0 = sem limite)
        const showAll = confirm('Deseja ver todos os checklists? Clique em OK para ver todos ou em Cancelar para ver apenas os 7 mais recentes.');
        fetchHistory(null, null, showAll ? 0 : 7);
    });

    // --- Inicialização ---
    async function initPage() {
        const isLoggedIn = await checkLoginStatus();
        if (isLoggedIn) {
            // Carregar checklists disponíveis
            fetchQuizzes();

            // Carregar histórico
            fetchHistory();
        }
    }

    // Iniciar página
    initPage();

    // Detectar quando a página terminar de carregar para dispositivos móveis
    window.addEventListener('load', () => {
        if (checkMobile()) {
            // Ajustar elementos após carregamento completo
            document.querySelectorAll('button').forEach(btn => {
                btn.classList.add('touch-target');
            });

            // Melhorar experiência de tap em elementos clicáveis
            document.querySelectorAll('.clickable-list li').forEach(item => {
                item.addEventListener('touchstart', function () {
                    this.classList.add('touch-active');
                });

                item.addEventListener('touchend', function () {
                    this.classList.remove('touch-active');
                });
            });
        }
    });
});