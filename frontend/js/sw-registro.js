if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sem HTTPS o navegador recusa; o app funciona igual */ });
}
