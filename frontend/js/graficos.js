// Gráficos em HTML/CSS puro: uma série, uma cor, valores escritos nas barras.
import { h } from './dom.js';

// ---------- dica ao passar o mouse / focar ----------

const dica = h('div', { class: 'dica-grafico', role: 'tooltip', hidden: true });
document.body.append(dica);

function posicionar(x, y) {
    const { width, height } = dica.getBoundingClientRect();
    const esq = Math.min(Math.max(8, x - width / 2), window.innerWidth - width - 8);
    const topo = y - height - 12 < 8 ? y + 18 : y - height - 12;
    dica.style.left = `${esq + window.scrollX}px`;
    dica.style.top = `${Math.min(topo, window.innerHeight - height - 8) + window.scrollY}px`;
}

function comDica(el, linhas) {
    const mostrar = (x, y) => {
        dica.replaceChildren(...linhas.map((l, i) => h(i ? 'div' : 'strong', {}, l)));
        dica.hidden = false;
        posicionar(x, y);
    };
    el.addEventListener('pointerenter', e => mostrar(e.clientX, e.clientY));
    el.addEventListener('pointermove', e => posicionar(e.clientX, e.clientY));
    el.addEventListener('pointerleave', () => { dica.hidden = true; });
    el.addEventListener('focus', () => {
        const r = el.getBoundingClientRect();
        mostrar(r.left + r.width / 2, r.top);
    });
    el.addEventListener('blur', () => { dica.hidden = true; });
    el.tabIndex = 0;
}

// ---------- barras horizontais (ranking) ----------

// itens: [{rotulo, valor, extra?}] já ordenados. Cada linha é o alvo do hover.
export function barrasHorizontais(itens, { unidade = 'N/C' } = {}) {
    if (!itens.length) return h('p', { class: 'sub vazio' }, 'Sem dados no período.');
    const max = Math.max(...itens.map(i => i.valor), 1);
    return h('div', { class: 'ranking' }, itens.map(i => {
        const linha = h('div', { class: 'rank-linha' },
            h('span', { class: 'rank-rotulo', title: i.rotulo }, i.rotulo),
            h('span', { class: 'rank-trilho' },
                h('span', { class: 'rank-barra', style: `width:${(i.valor / max) * 100}%` })),
            h('span', { class: 'rank-valor' }, String(i.valor)));
        comDica(linha, [i.rotulo, `${i.valor} ${unidade}`, ...(i.extra ? [i.extra] : [])]);
        return linha;
    }));
}

// ---------- colunas por dia (ou por mês quando o período é longo) ----------

const DIA_MS = 86400000;
const umDia = iso => Date.parse(`${iso}T00:00:00Z`);
const fmtDia = ms => new Date(ms).toISOString().slice(0, 10);

function agrupar(porDia) {
    if (!porDia.length) return [];
    const ini = umDia(porDia[0].dia);
    const fim = umDia(porDia[porDia.length - 1].dia);
    const mensal = (fim - ini) / DIA_MS > 92;
    const mapa = new Map();
    for (const d of porDia) {
        const chave = mensal ? d.dia.slice(0, 7) : d.dia;
        const atual = mapa.get(chave) || { nc: 0, checklists: 0 };
        atual.nc += d.nc;
        atual.checklists += d.checklists;
        mapa.set(chave, atual);
    }
    const saida = [];
    if (mensal) {
        let [a, m] = porDia[0].dia.slice(0, 7).split('-').map(Number);
        const [af, mf] = porDia[porDia.length - 1].dia.slice(0, 7).split('-').map(Number);
        while (a < af || (a === af && m <= mf)) {
            const chave = `${a}-${String(m).padStart(2, '0')}`;
            saida.push({ chave, rotulo: `${String(m).padStart(2, '0')}/${a}`, ...(mapa.get(chave) || { nc: 0, checklists: 0 }) });
            if (++m > 12) { m = 1; a++; }
        }
    } else {
        for (let t = ini; t <= fim; t += DIA_MS) {
            const chave = fmtDia(t);
            const [, mm, dd] = chave.split('-');
            saida.push({ chave, rotulo: `${dd}/${mm}`, ...(mapa.get(chave) || { nc: 0, checklists: 0 }) });
        }
    }
    return saida;
}

export function colunasPorDia(porDia) {
    const dados = agrupar(porDia);
    if (!dados.length) return h('p', { class: 'sub vazio' }, 'Sem dados no período.');
    const max = Math.max(...dados.map(d => d.nc), 1);
    const passo = Math.ceil(dados.length / 8);
    const total = dados.reduce((s, d) => s + d.nc, 0);

    const colunas = dados.map(d => {
        const col = h('div', { class: 'coluna', 'aria-label': `${d.rotulo}: ${d.nc} N/C em ${d.checklists} checklists` },
            h('span', { class: 'coluna-barra', style: `height:${(d.nc / max) * 100}%` }));
        comDica(col, [d.rotulo, `${d.nc} N/C`, `${d.checklists} checklist(s)`]);
        return col;
    });
    const rotulos = dados.map((d, i) =>
        h('span', { class: 'coluna-rotulo' }, i % passo === 0 || i === dados.length - 1 ? d.rotulo : ''));

    return h('div', { class: 'colunas-grafico', role: 'group', 'aria-label': `N/C por período, total ${total}` },
        h('span', { class: 'eixo-max' }, String(max)),
        h('div', { class: 'colunas' }, colunas),
        h('div', { class: 'colunas-rotulos' }, rotulos));
}
