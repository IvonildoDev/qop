// Cria elementos sem usar innerHTML (evita injeção de HTML vindo do servidor)
export function h(tag, attrs = {}, ...filhos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    el.append(...filhos.flat().filter(f => f != null && f !== false));
    return el;
}

// Ícones de traço (estilo Lucide). Só strings fixas daqui entram no innerHTML.
const ICONES = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alerta: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    voltar: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    olhoOff: '<path d="M9.9 4.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3M6.6 6.6A16 16 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    lista: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4"/>',
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    percentual: '<path d="m19 5-14 14"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>',
    nuvem: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
};

export function icone(nome, tam = 18) {
    const s = document.createElement('span');
    s.className = 'icone';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" `
        + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome] || ''}</svg>`;
    return s;
}

export function iniciais(nome = '') {
    const p = nome.trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function toast(msg, erro = false) {
    const t = h('div', { class: 'toast ' + (erro ? 'erro' : 'ok'), role: erro ? 'alert' : 'status' },
        icone(erro ? 'alerta' : 'check'), h('span', {}, msg));
    document.body.append(t);
    setTimeout(() => {
        t.classList.add('saindo');
        t.addEventListener('animationend', () => t.remove(), { once: true });
    }, erro ? 5000 : 3000);
}

// Janela sobreposta. Fecha ao clicar no fundo, no X ou com Esc. Devolve {fechar}.
export function modal(...conteudo) {
    const anterior = document.activeElement;
    const fundo = h('div', { class: 'modal', onclick: e => e.target === fundo && fechar() },
        h('div', { class: 'folha', role: 'dialog', 'aria-modal': 'true', tabindex: -1 },
            h('button', { class: 'folha-fechar', type: 'button', 'aria-label': 'Fechar', onclick: () => fechar() }, icone('x')),
            ...conteudo));
    const tecla = e => e.key === 'Escape' && fechar();
    function fechar() {
        document.removeEventListener('keydown', tecla);
        document.body.classList.remove('sem-rolagem');
        fundo.remove();
        anterior?.focus?.();
    }
    document.addEventListener('keydown', tecla);
    document.body.classList.add('sem-rolagem');
    document.body.append(fundo);
    (fundo.querySelector('input, select, textarea') || fundo.firstElementChild).focus();
    return { fechar };
}

export function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const x = [...b].map(n => n.toString(16).padStart(2, '0')).join('');
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export function formatarData(iso) {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
