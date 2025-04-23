document.addEventListener('DOMContentLoaded', function () {
    // Verificar se o usuário já está logado
    fetch('/check-login')
        .then(response => {
            if (response.ok) {
                // Já está logado, redirecionar para página principal
                window.location.href = '/';
            }
            // Senão, continuar na página de login
        })
        .catch(error => console.error('Erro ao verificar login:', error));

    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showMessage('Preencha todos os campos', 'error');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            // Verificar status antes de tentar processar o JSON
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (response.ok) {
                showMessage('Login bem-sucedido! Redirecionando...', 'success');

                // Redirecionar com base no tipo de usuário
                if (data.is_admin) {
                    // Se for admin, vai para o dashboard administrativo
                    window.location.href = '/admin/dashboard';
                } else {
                    // Se for usuário comum, vai para a página principal
                    window.location.href = '/';
                }
            } else {
                showMessage(data.message || 'Credenciais inválidas', 'error');
            }
        } catch (error) {
            console.error('Erro completo:', error);
            showMessage('Erro ao fazer login. Verifique o console.', 'error');
        }
    });

    function showMessage(message, type) {
        loginMessage.textContent = message;
        loginMessage.className = type === 'error' ? 'message error-message' : 'message success-message';
        loginMessage.style.display = 'block';
    }
});