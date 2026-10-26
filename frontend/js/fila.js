// Fila de envio offline em IndexedDB: o checklist só sai do aparelho depois que o servidor confirma.
import { api, ErroApi } from './api.js';

const BANCO = 'qop';
const LOJA = 'fila';

function abrir() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(BANCO, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'client_uuid' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function transacao(modo, fn) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(LOJA, modo);
        const r = fn(tx.objectStore(LOJA));
        tx.oncomplete = () => { db.close(); resolve(r && r.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

// item: { client_uuid, payload, fotos: [{ref, blob}], usuario_id, erro? }
export const adicionar = item => transacao('readwrite', s => s.put(item));
export const remover = id => transacao('readwrite', s => s.delete(id));
export const listar = () => transacao('readonly', s => s.getAll());

async function enviar(item) {
    const form = new FormData();
    form.append('payload', JSON.stringify(item.payload));
    for (const f of item.fotos) form.append('arquivos', f.blob, f.ref);
    return api('/api/checklists', { method: 'POST', form });
}

let rodando = false;

// Tenta enviar tudo que está pendente. Devolve {enviados, restantes, semLogin}.
export async function sincronizar(usuarioId) {
    if (rodando) return { enviados: 0, restantes: 0, semLogin: false, ocupado: true };
    rodando = true;
    let enviados = 0;
    let semLogin = false;
    try {
        for (const item of await listar()) {
            if (item.erro || item.usuario_id !== usuarioId) continue;
            try {
                await enviar(item);
                await remover(item.client_uuid);
                enviados++;
            } catch (e) {
                if (e instanceof ErroApi && e.status === 401) { semLogin = true; break; }
                if (e instanceof ErroApi && e.status >= 400 && e.status < 500) {
                    // O servidor recusou os dados: reenviar não adianta. Fica marcado para o operador ver.
                    await adicionar({ ...item, erro: e.mensagem });
                } else {
                    break; // sem rede ou servidor fora do ar: tenta de novo depois
                }
            }
        }
    } finally {
        rodando = false;
    }
    const restantes = (await listar()).filter(i => i.usuario_id === usuarioId).length;
    return { enviados, restantes, semLogin };
}
