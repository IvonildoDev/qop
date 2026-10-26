// Reduz a foto no celular antes de guardar/enviar: ~4 MB vira ~300 KB.
export async function comprimir(arquivo, ladoMax = 1600, qualidade = 0.75) {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao processar a foto'))),
            'image/jpeg', qualidade));
}
