import { api, sessao } from './api.js';

function destino(usuario) {
    return usuario.papel === 'admin' ? '/admin.html' : '/operador.html';
}

const atual = sessao.usuario();
if (atual && sessao.token()) location.replace(destino(atual));

const form = document.getElementById('form-login');
const msg = document.getElementById('msg');
const botao = form.querySelector('button[type="submit"]');
const toggle = form.querySelector('.toggle-senha');

toggle.addEventListener('click', () => {
    const mostrar = form.senha.type === 'password';
    form.senha.type = mostrar ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(mostrar));
    toggle.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
});

form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    botao.disabled = true;
    botao.classList.add('carregando');
    try {
        const r = await api('/api/auth/login', {
            method: 'POST',
            json: { login: form.login.value.trim(), senha: form.senha.value },
        });
        sessao.salvar(r.token, r.usuario);
        location.href = destino(r.usuario);
    } catch (err) {
        msg.textContent = err.status
            ? err.mensagem
            : 'Sem conexão. O primeiro acesso precisa de internet.';
        botao.disabled = false;
        botao.classList.remove('carregando');
    }
});
