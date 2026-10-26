import { api, ErroApi, sair, sessao, urlFoto } from './api.js';
import { formatarData, h, icone, iniciais, modal, toast, uuid } from './dom.js';
import * as fila from './fila.js';
import { comprimir } from './foto.js';
import { obterPosicao } from './gps.js';

const usuario = sessao.usuario();
if (!usuario || !sessao.token()) location.replace('/');
else if (usuario.papel === 'admin') location.replace('/admin.html');

const app = document.getElementById('app');
const CACHE_TIPOS = 'qop_tipos';

// ---------- dados ----------

async function carregarTipos() {
    try {
        const tipos = await api('/api/tipos');
        localStorage.setItem(CACHE_TIPOS, JSON.stringify(tipos));
        return tipos;
    } catch (e) {
        if (e instanceof ErroApi && e.status === 401) return sairPorSessaoExpirada();
        const cache = localStorage.getItem(CACHE_TIPOS);
        if (cache) return JSON.parse(cache);
        throw e;
    }
}

function sairPorSessaoExpirada() {
    toast('Sessão expirada. Entre novamente (seus checklists pendentes continuam salvos).', true);
    setTimeout(sair, 2500);
    return [];
}

async function sincronizar(silencioso = false) {
    const r = await fila.sincronizar(usuario.id);
    if (r.semLogin) return sairPorSessaoExpirada();
    if (r.enviados) toast(`${r.enviados} checklist(s) enviado(s)`);
    else if (!silencioso && r.restantes && !r.ocupado) toast('Sem conexão com o servidor. Tente de novo mais tarde.', true);
    return r;
}

// ---------- tela inicial ----------

async function telaInicio() {
    app.replaceChildren(
        h('header', { class: 'topo fixo' },
            h('div', { class: 'topo-usuario' },
                h('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(usuario.nome)),
                h('div', { class: 'topo-info' },
                    h('strong', {}, usuario.nome),
                    h('span', { class: 'chip ' + (navigator.onLine ? 'chip-online' : 'chip-offline'), id: 'chip-rede' },
                        navigator.onLine ? 'Online' : 'Offline'))),
            h('button', { class: 'btn leve', onclick: sair }, icone('sair'), 'Sair')),
        h('main', { class: 'conteudo' },
            h('div', { id: 'pendentes' }),
            h('h2', {}, 'Novo checklist'),
            h('div', { id: 'tipos', class: 'grade' }, esqueleto(2)),
            h('h2', {}, 'Meus envios'),
            h('div', { id: 'historico' }, esqueleto(3))));

    carregarTipos().then(tipos => {
        const caixa = document.getElementById('tipos');
        caixa.replaceChildren(...tipos.map(t =>
            h('button', { class: 'btn primario grande tipo-checklist', onclick: () => telaChecklist(t) },
                icone('clipboard', 24),
                h('span', { class: 'tipo-texto' }, t.nome, h('small', {}, `${t.perguntas.length} itens`)),
                icone('chevron'))));
    }).catch(() => {
        document.getElementById('tipos').replaceChildren(
            h('p', { class: 'erro-texto' }, 'Não foi possível carregar os checklists. Conecte-se uma vez para baixá-los.'));
    });

    await atualizarPendentes();
    sincronizar(true).then(atualizarPendentes);
    carregarHistorico();
}

async function atualizarPendentes() {
    const caixa = document.getElementById('pendentes');
    if (!caixa) return;
    const itens = (await fila.listar()).filter(i => i.usuario_id === usuario.id);
    if (!itens.length) return caixa.replaceChildren();
    caixa.replaceChildren(h('div', { class: 'aviso' },
        h('strong', { class: 'aviso-titulo' }, icone('nuvem'), `${itens.length} checklist(s) aguardando envio`),
        ...itens.map(i => h('div', { class: 'pendente' },
            h('span', {}, `${formatarData(i.payload.criado_em)} · ${i.tipo_nome}`),
            i.erro
                ? h('span', { class: 'erro-texto' }, `Recusado: ${i.erro}`)
                : h('span', { class: 'sub' }, 'salvo no aparelho'),
            i.erro && h('button', {
                class: 'btn leve',
                onclick: async () => {
                    if (confirm('Descartar este checklist? Os dados serão perdidos.')) {
                        await fila.remover(i.client_uuid);
                        atualizarPendentes();
                    }
                },
            }, 'Descartar'))),
        h('button', {
            class: 'btn',
            onclick: async () => { await sincronizar(); atualizarPendentes(); carregarHistorico(); },
        }, 'Enviar agora')));
}

async function carregarHistorico() {
    const caixa = document.getElementById('historico');
    if (!caixa) return;
    try {
        const lista = await api('/api/checklists/meus?limite=7');
        caixa.replaceChildren(...(lista.length
            ? lista.map(c => h('button', { class: 'linha', onclick: () => abrirDetalhe(c) },
                h('span', { class: 'linha-texto' }, h('strong', {}, c.tipo), h('small', { class: 'sub' }, formatarData(c.criado_em))),
                h('span', { class: c.total_nc ? 'chip nc' : 'chip ok' },
                    c.total_nc ? `${c.total_nc} N/C` : 'Conforme')))
            : [vazio('inbox', 'Nenhum envio ainda.')]));
    } catch (e) {
        caixa.replaceChildren(vazio('nuvem', 'Histórico indisponível sem conexão.'));
    }
}

function abrirDetalhe(c) {
    const nc = c.respostas.filter(r => r.resposta === 'NC');
    modal(
            h('h3', {}, c.tipo), h('p', { class: 'sub' }, formatarData(c.criado_em)),
            c.latitude != null && h('p', { class: 'sub com-icone' }, icone('pin', 16), `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`),
            ...(nc.length ? nc.map(r => h('div', { class: 'item-nc' },
                h('strong', {}, `${r.numero}. ${r.texto}`),
                r.comentario && h('p', {}, r.comentario),
                h('div', { class: 'miniaturas' },
                    ...r.fotos.map(id => h('img', { src: urlFoto(id), loading: 'lazy', alt: 'Foto da anomalia' })))))
                : [h('p', {}, 'Nenhum item não conforme.')]),
            c.observacoes && h('p', {}, h('strong', {}, 'Observações: '), c.observacoes));
}

function esqueleto(n) {
    return Array.from({ length: n }, () => h('div', { class: 'skeleton skeleton-cartao', 'aria-hidden': 'true' }));
}

function vazio(nome, texto) {
    return h('div', { class: 'empty-state' }, icone(nome, 40), h('p', {}, texto));
}

// ---------- checklist ----------

function telaChecklist(tipo) {
    const estado = {
        uuid: uuid(),
        criadoEm: new Date().toISOString(),
        respostas: {},     // numero -> 'C' | 'NC' | 'NA'
        comentarios: {},   // numero -> texto
        fotos: {},         // numero -> [{blob, url, pos}]
        pos: null,
    };

    const chipGps = h('button', { class: 'chip gps', type: 'button', onclick: capturarGps }, icone('pin', 16), h('span', {}, 'Buscando local...'));
    const progresso = h('span', { class: 'progresso-texto' }, `0/${tipo.perguntas.length}`);
    const preenchimento = h('div', { class: 'progresso-barra-fill', style: 'width:0%' });
    const trilho = h('div', {
        class: 'progresso-barra-track', role: 'progressbar', 'aria-label': 'Itens respondidos',
        'aria-valuemin': 0, 'aria-valuemax': tipo.perguntas.length, 'aria-valuenow': 0,
    }, preenchimento);
    const botaoEnviar = h('button', { class: 'btn primario grande', type: 'button', onclick: enviar }, 'Enviar checklist');
    const obs = h('textarea', { rows: 3, placeholder: 'Observações gerais (opcional)', 'aria-label': 'Observações gerais' });
    const cartoes = {};

    async function capturarGps() {
        chipGps.lastChild.textContent = 'Buscando local...';
        estado.pos = await obterPosicao();
        chipGps.lastChild.textContent = estado.pos
            ? `Local ok (±${Math.round(estado.pos.precisao_m)} m)`
            : 'Sem localização · toque para tentar';
        chipGps.classList.toggle('aviso-chip', !estado.pos);
    }

    function atualizarProgresso() {
        const feitas = Object.keys(estado.respostas).length;
        progresso.textContent = `${feitas}/${tipo.perguntas.length}`;
        preenchimento.style.width = `${(feitas / tipo.perguntas.length) * 100}%`;
        trilho.setAttribute('aria-valuenow', feitas);
    }

    function criarCartao(p) {
        const miniaturas = h('div', { class: 'miniaturas' });
        const entrada = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
        const detalhe = h('div', { class: 'detalhe', hidden: true },
            h('p', { class: 'dica' }, 'Item não conforme: tire uma foto da anomalia.'),
            h('textarea', {
                rows: 2, placeholder: 'Descreva a anomalia (opcional)',
                oninput: e => { estado.comentarios[p.numero] = e.target.value; },
            }),
            h('button', { class: 'btn', type: 'button', onclick: () => entrada.click() }, icone('camera'), 'Tirar foto'),
            entrada, miniaturas);

        function desenharMiniaturas() {
            miniaturas.replaceChildren(...(estado.fotos[p.numero] || []).map((f, i) =>
                h('figure', {},
                    h('img', { src: f.url, alt: 'Foto' }),
                    h('button', {
                        type: 'button', 'aria-label': 'Remover foto',
                        onclick: () => {
                            URL.revokeObjectURL(f.url);
                            estado.fotos[p.numero].splice(i, 1);
                            desenharMiniaturas();
                        },
                    }, icone('x', 14)))));
        }

        entrada.addEventListener('change', async () => {
            const arquivo = entrada.files[0];
            entrada.value = '';
            if (!arquivo) return;
            try {
                const [blob, pos] = await Promise.all([comprimir(arquivo), obterPosicao({ timeout: 8000 })]);
                (estado.fotos[p.numero] ||= []).push({
                    blob, url: URL.createObjectURL(blob), pos: pos || estado.pos, tiradaEm: new Date().toISOString(),
                });
                if (pos) estado.pos = pos;
                desenharMiniaturas();
                cartao.classList.remove('falta');
            } catch {
                toast('Não foi possível processar a foto. Tente de novo.', true);
            }
        });

        const botoes = ['C', 'NC', 'NA'].map(v =>
            h('button', {
                type: 'button', class: `resp ${v}`,
                onclick: () => {
                    estado.respostas[p.numero] = v;
                    botoes.forEach(b => b.classList.toggle('sel', b.dataset.v === v));
                    detalhe.hidden = v !== 'NC';
                    cartao.classList.toggle('nc', v === 'NC');
                    cartao.classList.remove('falta');
                    atualizarProgresso();
                },
                'data-v': v,
            }, icone(v === 'C' ? 'check' : v === 'NC' ? 'x' : 'alerta', 20),
            v === 'NC' ? 'N/C' : v === 'NA' ? 'N/A' : 'Conforme'));

        const cartao = h('section', { class: 'pergunta' },
            h('p', {}, h('b', {}, `${p.numero}. `), p.texto),
            h('div', { class: 'respostas' }, botoes), detalhe);
        cartoes[p.numero] = cartao;
        return cartao;
    }

    async function enviar() {
        const semResposta = tipo.perguntas.filter(p => !estado.respostas[p.numero]);
        const semFoto = tipo.perguntas.filter(p =>
            estado.respostas[p.numero] === 'NC' && !(estado.fotos[p.numero] || []).length);
        for (const p of [...semResposta, ...semFoto]) cartoes[p.numero].classList.add('falta');
        const primeiro = semResposta[0] || semFoto[0];
        if (primeiro) {
            cartoes[primeiro.numero].scrollIntoView({ behavior: 'smooth', block: 'center' });
            return toast(semResposta.length
                ? `Faltam ${semResposta.length} resposta(s)`
                : `Item não conforme sem foto (${semFoto.length})`, true);
        }
        if (!estado.pos) {
            await capturarGps();
            if (!estado.pos && !confirm('Não foi possível obter a localização. Enviar mesmo assim?')) return;
        }

        botaoEnviar.disabled = true;
        const fotos = [];
        const fotosPayload = [];
        let n = 0;
        for (const p of tipo.perguntas) {
            if (estado.respostas[p.numero] !== 'NC') continue;
            for (const f of estado.fotos[p.numero]) {
                const ref = `${estado.uuid}-${++n}.jpg`;
                fotos.push({ ref, blob: f.blob });
                fotosPayload.push({
                    ref, numero: p.numero, tirada_em: f.tiradaEm,
                    latitude: f.pos?.latitude ?? null, longitude: f.pos?.longitude ?? null,
                    precisao_m: f.pos?.precisao_m ?? null,
                });
            }
        }
        const payload = {
            client_uuid: estado.uuid, tipo: tipo.codigo, criado_em: estado.criadoEm,
            latitude: estado.pos?.latitude ?? null, longitude: estado.pos?.longitude ?? null,
            precisao_m: estado.pos?.precisao_m ?? null, observacoes: obs.value.trim() || null,
            respostas: tipo.perguntas.map(p => ({
                numero: p.numero, resposta: estado.respostas[p.numero],
                comentario: estado.respostas[p.numero] === 'NC' ? (estado.comentarios[p.numero] || null) : null,
            })),
            fotos: fotosPayload,
        };

        try {
            // Primeiro grava no aparelho: se a internet cair, nada se perde.
            await fila.adicionar({ client_uuid: estado.uuid, usuario_id: usuario.id, tipo_nome: tipo.nome, payload, fotos });
        } catch {
            botaoEnviar.disabled = false;
            return toast('Não foi possível salvar no aparelho (espaço cheio?).', true);
        }
        Object.values(estado.fotos).flat().forEach(f => URL.revokeObjectURL(f.url));
        const r = await sincronizar(true);
        const pendente = r && r.restantes;
        toast(pendente ? 'Salvo no aparelho. Será enviado quando houver internet.' : 'Checklist enviado!');
        telaInicio();
    }

    app.replaceChildren(
        h('header', { class: 'topo fixo' },
            h('button', {
                class: 'btn leve',
                onclick: () => {
                    const preenchido = Object.keys(estado.respostas).length;
                    if (!preenchido || confirm('Sair e perder o que foi preenchido?')) telaInicio();
                },
            }, icone('voltar'), 'Voltar'),
            h('strong', { class: 'topo-titulo' }, tipo.nome), progresso),
        h('div', { class: 'barra-gps' }, chipGps, trilho),
        h('main', { class: 'conteudo' },
            ...tipo.perguntas.map(criarCartao),
            h('h2', {}, 'Observações'), obs, botaoEnviar));
    window.scrollTo(0, 0);
    capturarGps();
}

// ---------- início ----------

window.addEventListener('online', () => { sincronizar(true).then(() => { atualizarPendentes(); carregarHistorico(); }); });
function marcarRede(online) {
    const chip = document.getElementById('chip-rede');
    if (!chip) return;
    chip.className = 'chip ' + (online ? 'chip-online' : 'chip-offline');
    chip.textContent = online ? 'Online' : 'Offline';
}
window.addEventListener('online', () => marcarRede(true));
window.addEventListener('offline', () => marcarRede(false));

if (usuario && usuario.papel !== 'admin') telaInicio();
