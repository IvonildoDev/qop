const CHAVE_TOKEN = 'qop_token';
const CHAVE_USUARIO = 'qop_usuario';

export class ErroApi extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
        this.mensagem = mensagem;
    }
}

export const sessao = {
    token: () => localStorage.getItem(CHAVE_TOKEN),
    usuario: () => JSON.parse(localStorage.getItem(CHAVE_USUARIO) || 'null'),
    salvar(token, usuario) {
        localStorage.setItem(CHAVE_TOKEN, token);
        localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
    },
    limpar() {
        localStorage.removeItem(CHAVE_TOKEN);
        localStorage.removeItem(CHAVE_USUARIO);
    },
};

function mensagemDoErro(corpo) {
    const d = corpo && corpo.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map(x => x.msg).join('; ');
    return 'Erro inesperado';
}

// Falha de rede lança TypeError (do fetch); erro HTTP lança ErroApi.
export async function api(caminho, { method = 'GET', json, form } = {}) {
    const headers = {};
    const token = sessao.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body;
    if (json !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    } else if (form) {
        body = form;
    }
    const resp = await fetch(caminho, { method, headers, body });
    if (resp.ok) return resp.json();
    let corpo = null;
    try { corpo = await resp.json(); } catch { /* corpo não é JSON */ }
    throw new ErroApi(resp.status, mensagemDoErro(corpo));
}

export function urlFoto(id) {
    return `/api/fotos/${id}?token=${encodeURIComponent(sessao.token())}`;
}

export function sair() {
    sessao.limpar();
    location.href = '/';
}
