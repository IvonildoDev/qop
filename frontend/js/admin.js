import { api, ErroApi, sair, sessao, urlFoto } from './api.js';
import { formatarData, h, icone, iniciais, modal, toast } from './dom.js';
import { barrasHorizontais, colunasPorDia } from './graficos.js';
import { telaUsuarios } from './usuarios.js';

const eu = sessao.usuario();
if (!eu || eu.papel !== 'admin' || !sessao.token()) location.replace('/');

const POR_PAGINA = 25;
const filtros = { de: '', ate: '', operador_id: '', tipo: '' };
const estado = { aba: 'geral', pagina: 1, mapa: null, camada: null };

function qs(extra = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtros, ...extra })) if (v !== '' && v != null) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
}

async function chamar(caminho) {
    try {
        return await api(caminho);
    } catch (e) {
        if (e instanceof ErroApi && (e.status === 401 || e.status === 403)) sair();
        throw e;
    }
}

const textoErro = e => (e instanceof ErroApi ? e.mensagem : 'Sem conexão com o servidor.');

// ---------- estrutura ----------

const abas = [['geral', 'Visão geral'], ['anomalias', 'Anomalias'], ['usuarios', 'Usuários']];
const painel = {
    geral: h('section', { id: 'aba-geral' }),
    anomalias: h('section', { id: 'aba-anomalias', hidden: true }),
    usuarios: h('section', { id: 'aba-usuarios', hidden: true }),
};
const barraFiltros = h('form', { class: 'filtros', onsubmit: e => { e.preventDefault(); aplicarFiltros(); } });
const botoesAba = Object.fromEntries(abas.map(([id, nome]) =>
    [id, h('button', { class: 'aba', type: 'button', onclick: () => abrirAba(id) }, nome)]));

document.getElementById('app').replaceChildren(
    h('header', { class: 'topo-admin' },
        h('strong', { class: 'marca' }, 'QOP'),
        h('nav', { class: 'abas', 'aria-label': 'Seções' }, Object.values(botoesAba)),
        h('span', { class: 'avatar', 'aria-hidden': 'true', title: eu.nome }, iniciais(eu.nome)),
        h('span', { class: 'sub usuario-nome' }, eu.nome),
        h('button', { class: 'btn leve', onclick: sair, 'aria-label': 'Sair' }, icone('sair'), h('span', { class: 'so-desktop' }, 'Sair'))),
    h('main', { class: 'conteudo-admin' }, barraFiltros, painel.geral, painel.anomalias, painel.usuarios));

function abrirAba(id) {
    estado.aba = id;
    for (const [k, el] of Object.entries(painel)) el.hidden = k !== id;
    for (const [k, b] of Object.entries(botoesAba)) {
        b.classList.toggle('ativa', k === id);
        if (k === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
    barraFiltros.hidden = id === 'usuarios';
    history.replaceState(null, '', `#${id}`);
    if (id === 'geral') { carregarGeral(); }
    if (id === 'anomalias') { estado.pagina = 1; carregarAnomalias(); }
    if (id === 'usuarios') telaUsuarios(painel.usuarios, eu.id);
}

function aplicarFiltros() {
    const dados = new FormData(barraFiltros);
    for (const k of Object.keys(filtros)) filtros[k] = dados.get(k) || '';
    abrirAba(estado.aba);
}

async function montarFiltros() {
    let operadores = [];
    try {
        operadores = (await chamar('/api/admin/usuarios')).filter(u => u.papel === 'operador');
    } catch { /* os filtros de data e tipo continuam funcionando */ }
    const tipos = [['pre_operacional', 'Pré-operacional'], ['caminhao', 'Caminhão'], ['carga', 'Carga']];
    const sel = (nome, rotulo, opcoes) => h('label', {}, rotulo,
        h('select', { name: nome }, h('option', { value: '' }, 'Todos'),
            opcoes.map(([v, t]) => h('option', { value: v }, t))));
    barraFiltros.replaceChildren(
        h('label', {}, 'De', h('input', { type: 'date', name: 'de' })),
        h('label', {}, 'Até', h('input', { type: 'date', name: 'ate' })),
        sel('operador_id', 'Operador', operadores.map(u => [u.id, u.nome])),
        sel('tipo', 'Checklist', tipos),
        h('button', { class: 'btn primario', type: 'submit' }, 'Aplicar'),
        h('button', { class: 'btn', type: 'button', onclick: () => { barraFiltros.reset(); aplicarFiltros(); } }, 'Limpar'));
}

// ---------- visão geral ----------

function tile(classe, ico, rotulo, valor, nota) {
    return h('div', { class: `tile tile-${classe}` },
        h('div', { class: 'tile-cabeca' },
            h('span', { class: 'tile-rotulo' }, rotulo),
            h('span', { class: 'tile-icone' }, icone(ico, 20))),
        h('span', { class: 'tile-valor' }, valor),
        nota && h('span', { class: 'tile-nota' }, nota));
}

const cartaoGrafico = (titulo, corpo, classe = '') =>
    h('section', { class: `cartao-grafico ${classe}` }, h('h3', {}, titulo), corpo);

async function carregarGeral() {
    painel.geral.replaceChildren(
        h('div', { class: 'tiles' }, [1, 2, 3, 4].map(() => h('div', { class: 'skeleton skeleton-tile', 'aria-hidden': 'true' }))),
        h('div', { class: 'skeleton skeleton-bloco', 'aria-hidden': 'true' }));
    let d;
    try {
        d = await chamar('/api/admin/dashboard' + qs());
    } catch (e) {
        return painel.geral.replaceChildren(h('p', { class: 'erro-texto' }, textoErro(e)));
    }
    const k = d.kpis;
    const mapaCaixa = h('div', { id: 'mapa', class: 'mapa', role: 'img', 'aria-label': 'Mapa das anomalias' });
    const mapaInfo = h('p', { class: 'sub' });

    painel.geral.replaceChildren(
        h('div', { class: 'tiles' },
            tile('checklists', 'clipboard', 'Checklists enviados', String(k.checklists)),
            tile('nc', 'alerta', 'Itens não conformes', String(k.nao_conformes)),
            tile('conformidade', 'check', 'Conformidade', k.conformidade_pct == null ? '—' : `${String(k.conformidade_pct).replace('.', ',')}%`,
                'itens C sobre C + N/C'),
            tile('operadores', 'usuarios', 'Operadores com envio', String(k.operadores_ativos))),
        h('div', { class: 'graficos' },
            cartaoGrafico('Itens N/C por período', colunasPorDia(d.por_dia), 'largo'),
            cartaoGrafico('N/C por operador', barrasHorizontais(d.por_operador.map(o => ({
                rotulo: o.operador, valor: o.nc, extra: `${o.checklists} checklist(s)`,
            })))),
            cartaoGrafico('N/C por tipo de checklist', barrasHorizontais(d.por_tipo.map(t => ({
                rotulo: t.tipo, valor: t.nc, extra: `${t.checklists} checklist(s)`,
            })))),
            cartaoGrafico('Itens que mais falham', barrasHorizontais(d.top_perguntas_nc.map(p => ({
                rotulo: `${p.numero}. ${p.texto}`, valor: p.nc, extra: p.tipo,
            }))), 'largo'),
            cartaoGrafico('Local das anomalias', h('div', {}, mapaCaixa, mapaInfo), 'largo')));
    desenharMapa(mapaCaixa, mapaInfo);
}

async function desenharMapa(caixa, info) {
    if (typeof L === 'undefined') {
        caixa.hidden = true;
        return info.replaceChildren('O mapa precisa de internet para carregar.');
    }
    let r;
    try {
        r = await chamar('/api/admin/anomalias' + qs({ limite: 200, pagina: 1 }));
    } catch (e) {
        caixa.hidden = true;
        return info.replaceChildren(textoErro(e));
    }
    const pontos = r.itens.filter(a => a.latitude != null && a.longitude != null);
    info.textContent = `${pontos.length} de ${r.total} anomalia(s) com localização`
        + (r.total > r.itens.length ? ` (mostrando as ${r.itens.length} mais recentes)` : '');
    if (!pontos.length) return caixa.hidden = true;

    const mapa = L.map(caixa, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    const cor = getComputedStyle(document.documentElement).getPropertyValue('--serie-1').trim() || '#2a78d6';
    const superficie = getComputedStyle(document.documentElement).getPropertyValue('--cartao').trim() || '#fff';
    const grupo = L.featureGroup(pontos.map(a =>
        L.circleMarker([a.latitude, a.longitude], { radius: 8, color: superficie, weight: 2, fillColor: cor, fillOpacity: 1 })
            .bindPopup(popup(a))));
    grupo.addTo(mapa);
    mapa.fitBounds(grupo.getBounds().pad(0.2), { maxZoom: 16 });
}

function popup(a) {
    return h('div', { class: 'popup-mapa' },
        h('strong', {}, `${a.numero}. ${a.pergunta}`),
        h('div', { class: 'sub' }, `${a.operador} · ${formatarData(a.data)}`),
        a.comentario && h('div', {}, a.comentario),
        a.fotos.length > 0 && h('div', { class: 'miniaturas' },
            a.fotos.slice(0, 3).map(id => h('a', { href: urlFoto(id), target: '_blank', rel: 'noopener' },
                h('img', { src: urlFoto(id), alt: 'Foto da anomalia', loading: 'lazy' })))),
        h('button', { class: 'btn leve', onclick: () => abrirDetalhe(a.checklist_id, a.resposta_id) }, 'Ver checklist'));
}

// ---------- anomalias ----------

async function carregarAnomalias() {
    painel.anomalias.replaceChildren(h('div', { class: 'skeleton skeleton-bloco', 'aria-hidden': 'true' }));
    let r;
    try {
        r = await chamar('/api/admin/anomalias' + qs({ limite: POR_PAGINA, pagina: estado.pagina }));
    } catch (e) {
        return painel.anomalias.replaceChildren(h('p', { class: 'erro-texto' }, textoErro(e)));
    }
    const paginas = Math.max(1, Math.ceil(r.total / POR_PAGINA));
    const local = a => a.latitude == null ? '—' : h('a', {
        href: `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=18/${a.latitude}/${a.longitude}`,
        target: '_blank', rel: 'noopener',
    }, `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}`);

    painel.anomalias.replaceChildren(
        h('div', { class: 'barra-acoes' },
            h('h2', {}, `${r.total} item(ns) não conforme(s)`),
            h('button', { class: 'btn', onclick: exportarPdf }, icone('download', 16), 'Exportar PDF')),
        r.itens.length === 0 ? h('div', { class: 'empty-state' }, icone('inbox', 40), h('p', {}, 'Nenhuma anomalia no período.')) :
            h('div', { class: 'rolagem' },
                h('table', { class: 'tabela clicavel' },
                    h('thead', {}, h('tr', {}, ...['Data', 'Operador', 'Checklist', 'Item', 'Local', 'Fotos'].map(t => h('th', {}, t)))),
                    h('tbody', {}, r.itens.map(a => h('tr', { tabindex: 0, onclick: () => abrirDetalhe(a.checklist_id, a.resposta_id),
                        onkeydown: e => e.key === 'Enter' && abrirDetalhe(a.checklist_id, a.resposta_id) },
                        h('td', {}, formatarData(a.data)),
                        h('td', {}, a.operador),
                        h('td', {}, a.tipo),
                        h('td', { class: 'celula-item' }, h('strong', {}, `${a.numero}. `), a.pergunta,
                            a.comentario && h('div', { class: 'sub' }, a.comentario)),
                        h('td', { onclick: e => e.stopPropagation() }, local(a)),
                        h('td', {}, h('span', { class: 'chip' }, String(a.fotos.length)))))))),
        h('div', { class: 'paginacao' },
            h('button', { class: 'btn', disabled: estado.pagina <= 1, onclick: () => { estado.pagina--; carregarAnomalias(); } }, icone('voltar', 16), 'Anterior'),
            h('span', { class: 'sub' }, `Página ${estado.pagina} de ${paginas}`),
            h('button', { class: 'btn', disabled: estado.pagina >= paginas, onclick: () => { estado.pagina++; carregarAnomalias(); } }, 'Próxima', icone('chevron', 16))));
}

async function abrirDetalhe(checklistId, destacarRespostaId) {
    let c;
    try {
        c = await chamar(`/api/checklists/${checklistId}`);
    } catch (e) {
        return toast(textoErro(e), true);
    }
    const nc = c.respostas.filter(r => r.resposta === 'NC');
    modal(
        h('h3', {}, c.tipo),
        h('p', { class: 'sub' }, `${c.operador} · ${formatarData(c.criado_em)}`),
        c.latitude != null && h('p', { class: 'sub com-icone' }, icone('pin', 16), h('a', {
            href: `https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=18/${c.latitude}/${c.longitude}`,
            target: '_blank', rel: 'noopener',
        }, `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`), c.precisao_m != null && ` (±${Math.round(c.precisao_m)} m)`),
        h('p', {}, `${c.respostas.length} itens verificados, ${nc.length} não conforme(s).`),
        ...nc.map(r => h('div', { class: 'item-nc' + (r.id === destacarRespostaId ? ' destaque' : '') },
            h('strong', {}, `${r.numero}. ${r.texto}`),
            r.comentario && h('p', {}, r.comentario),
            h('div', { class: 'miniaturas' }, r.fotos.map(id =>
                h('a', { href: urlFoto(id), target: '_blank', rel: 'noopener' },
                    h('img', { src: urlFoto(id), alt: 'Foto da anomalia', loading: 'lazy' })))))),
        c.observacoes && h('p', {}, h('strong', {}, 'Observações: '), c.observacoes),
        // Fotos antigas, sem item associado
        c.fotos.some(f => f.resposta_id == null) && h('div', {},
            h('strong', {}, 'Fotos do checklist'),
            h('div', { class: 'miniaturas' }, c.fotos.filter(f => f.resposta_id == null).map(f =>
                h('a', { href: urlFoto(f.id), target: '_blank', rel: 'noopener' },
                    h('img', { src: urlFoto(f.id), alt: 'Foto do checklist', loading: 'lazy' }))))));
}

// ---------- exportação ----------

async function exportarPdf() {
    try {
        const resp = await fetch('/api/admin/anomalias/pdf' + qs(), { headers: { Authorization: `Bearer ${sessao.token()}` } });
        if (resp.status === 401 || resp.status === 403) return sair();
        if (!resp.ok) throw new ErroApi(resp.status, 'Não foi possível gerar o PDF.');
        const link = h('a', {
            href: URL.createObjectURL(await resp.blob()),
            download: `anomalias-${new Date().toISOString().slice(0, 10)}.pdf`,
        });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
        toast(textoErro(e), true);
    }
}

// ---------- início ----------

await montarFiltros();
const inicial = location.hash.slice(1);
abrirAba(abas.some(([id]) => id === inicial) ? inicial : 'geral');
