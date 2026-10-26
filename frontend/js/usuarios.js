import { api, ErroApi } from './api.js';
import { h, icone, iniciais, modal, toast } from './dom.js';

const PAPEL = { admin: 'Administrador', operador: 'Operador' };

export async function telaUsuarios(raiz, euId) {
    async function recarregar() {
        let lista;
        try {
            lista = await api('/api/admin/usuarios');
        } catch (e) {
            return raiz.replaceChildren(h('p', { class: 'erro-texto' }, e.mensagem || 'Sem conexão com o servidor.'));
        }
        raiz.replaceChildren(
            h('div', { class: 'barra-acoes' },
                h('h2', {}, 'Usuários'),
                h('button', { class: 'btn primario', onclick: () => formulario() }, icone('mais', 16), 'Novo usuário')),
            h('div', { class: 'rolagem' },
                h('table', { class: 'tabela' },
                    h('thead', {}, h('tr', {}, ...['Nome', 'Login', 'Perfil', 'Situação', ''].map(t => h('th', {}, t)))),
                    h('tbody', {}, lista.map(u => h('tr', { class: u.ativo ? '' : 'inativo' },
                        h('td', {}, h('span', { class: 'celula-usuario' },
                            h('span', { class: 'avatar avatar-pequeno', 'aria-hidden': 'true' }, iniciais(u.nome)), u.nome)),
                        h('td', {}, u.login),
                        h('td', {}, h('span', { class: 'chip ' + (u.papel === 'admin' ? 'aviso-chip' : '') }, PAPEL[u.papel])),
                        h('td', {}, h('span', { class: 'chip ' + (u.ativo ? 'ok' : 'nc') }, u.ativo ? 'Ativo' : 'Desativado')),
                        h('td', { class: 'acoes' },
                            h('button', { class: 'btn leve', onclick: () => formulario(u) }, 'Editar'),
                            u.id !== euId && h('button', {
                                class: 'btn leve',
                                onclick: () => alterar(u.id, { ativo: !u.ativo }),
                            }, u.ativo ? 'Desativar' : 'Reativar'))))))));
    }

    async function alterar(id, dados) {
        try {
            await api(`/api/admin/usuarios/${id}`, { method: 'PATCH', json: dados });
            recarregar();
        } catch (e) {
            toast(e.mensagem || 'Falha ao salvar', true);
        }
    }

    // Sem usuário => cria; com usuário => edita (senha em branco mantém a atual)
    function formulario(u) {
        const campo = (rotulo, attrs) => h('label', {}, rotulo, h('input', attrs));
        const nome = campo('Nome', { name: 'nome', value: u?.nome || '', required: true });
        const login = campo('Login', { name: 'login', value: u?.login || '', required: true, disabled: !!u, autocapitalize: 'none' });
        const senha = campo(u ? 'Nova senha (deixe em branco para manter)' : 'Senha (mín. 6 caracteres)',
            { name: 'senha', type: 'password', minlength: 6, required: !u, autocomplete: 'new-password' });
        const papel = h('select', { name: 'papel', disabled: u?.id === euId },
            ['operador', 'admin'].map(p => h('option', { value: p, selected: (u?.papel || 'operador') === p }, PAPEL[p])));
        const msg = h('p', { class: 'erro-texto', role: 'alert' });

        const form = h('form', { class: 'form-modal', onsubmit: async e => {
            e.preventDefault();
            msg.textContent = '';
            const v = (el) => el.querySelector('input').value.trim();
            try {
                if (u) {
                    await api(`/api/admin/usuarios/${u.id}`, { method: 'PATCH', json: {
                        nome: v(nome), papel: papel.value, ...(senha.querySelector('input').value ? { senha: senha.querySelector('input').value } : {}),
                    } });
                } else {
                    await api('/api/admin/usuarios', { method: 'POST', json: {
                        login: v(login), nome: v(nome), senha: senha.querySelector('input').value, papel: papel.value,
                    } });
                }
                janela.fechar();
                recarregar();
            } catch (err) {
                msg.textContent = err instanceof ErroApi ? err.mensagem : 'Sem conexão com o servidor.';
            }
        } },
            h('h3', {}, u ? 'Editar usuário' : 'Novo usuário'),
            nome, login, senha, h('label', {}, 'Perfil', papel), msg,
            h('button', { class: 'btn primario', type: 'submit' }, 'Salvar'));
        const janela = modal(form);
    }

    recarregar();
}
