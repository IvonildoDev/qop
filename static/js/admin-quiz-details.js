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
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = '/admin/dashboard';
        });
    }

    // Função para carregar detalhes do quiz
    async function loadQuizDetails() {
        try {
            // Mostrar informação básica
            const quizTypes = {
                'pre_operacional': 'Checklist Pré-Operacional',
                'caminhao': 'Checklist Caminhão',
                'carga': 'Checklist Carga'
            };

            if (quizInfoElement && username && timestamp) {
                const formattedDate = new Date(timestamp).toLocaleString('pt-BR');
                const quizTypeName = quizTypes[quizType] || quizType;

                quizInfoElement.innerHTML = `
                    <p><strong>Usuário:</strong> ${username}</p>
                    <p><strong>Tipo:</strong> ${quizTypeName}</p>
                    <p><strong>Data:</strong> ${formattedDate}</p>
                `;
            }

            // Buscar detalhes do servidor
            const response = await fetch(`/admin/api/quiz-details?username=${username}&type=${quizType}&timestamp=${timestamp}`);
            const data = await response.json();

            if (data.error) {
                if (questionsContainer) {
                    questionsContainer.innerHTML = `<p class="error-message">${data.error}</p>`;
                }
                return;
            }

            // Exibir perguntas
            if (questionsContainer && data.questions && data.questions.length > 0) {
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
            } else if (questionsContainer) {
                questionsContainer.innerHTML = `<p>Nenhuma pergunta encontrada.</p>`;
            }

            // Exibir observações
            if (observationsElement) {
                observationsElement.textContent = data.observations || 'Sem observações.';
            }

            // Exibir localização se disponível
            if (locationContainer && data.location) {
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
            } else if (locationContainer) {
                locationContainer.style.display = 'none';
            }

            // Exibir fotos
            if (photosContainer && data.photos && data.photos.length > 0) {
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
            } else if (photosContainer) {
                photosContainer.style.display = 'none';
            }

        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            if (questionsContainer) {
                questionsContainer.innerHTML = `<p class="error-message">Erro ao carregar detalhes. Tente novamente mais tarde.</p>`;
            }
        }
    }

    // Carregar os detalhes ao iniciar a página
    if (username && quizType && timestamp) {
        loadQuizDetails();
    } else if (quizInfoElement) {
        quizInfoElement.innerHTML = `<p class="error-message">Parâmetros insuficientes para exibir detalhes.</p>`;
    }
});