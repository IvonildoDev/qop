// Devolve {latitude, longitude, precisao_m, em} ou null se negado/indisponível.
export function obterPosicao({ timeout = 12000 } = {}) {
    return new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            p => resolve({
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
                precisao_m: p.coords.accuracy,
                em: new Date(p.timestamp).toISOString(),
            }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout, maximumAge: 15000 },
        );
    });
}
