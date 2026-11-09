// =====================================================================
// adaptacao.js: Página da adaptação (Livro vs. Filme): card em destaque e as resenhas mais curtidas.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

async function iniciarAdaptacao() {
    if (!document.getElementById("pagina-adaptacao")) return;
    const id = Number(new URLSearchParams(location.search).get("id"));
    const areaDuelo = document.getElementById("adaptacao-duelo");
    const lista = document.getElementById("adaptacao-resenhas");
    mostrarSkeleton(areaDuelo, 1, "duelo");
    try {
        const item = await api(`/Adaptacao/${id}`);
        document.title = `${item.tituloLivro} vs. ${item.tituloFilme} · Resenhário`;
        document.getElementById("adaptacao-titulo").textContent = item.tituloLivro;
        document.getElementById("adaptacao-subtitulo").textContent =
            `No cinema: ${item.tituloFilme}${item.anoLancamento ? ` (${item.anoLancamento})` : ""}${item.diretor ? `, de ${item.diretor}` : ""}.`;
        areaDuelo.replaceChildren(criarDuelo(item, true, true));
        mostrarSeloConferencia(id);
        const avaliar = `/paginas/reviews.html?livro=${item.idLivro}&adaptacao=${item.idAdaptacoes}`;
        document.getElementById("adaptacao-avaliar").href = avaliar;
        await carregarResenhasEm(lista, { idAdaptacao: id, ordem: "curtidas", tamanho: 10,
            vazio: { titulo: "Ninguém avaliou essa adaptação ainda", texto: "Viu o filme e leu o livro? A primeira opinião é sua.", botao: { texto: "Dar minha nota", href: avaliar } } });
    } catch {
        areaDuelo.replaceChildren();
        lista.replaceChildren();
        mostrarEstadoVazio(areaDuelo, { erro: true, titulo: "Não achamos essa adaptação", texto: "Ele pode ter sido removido. Que tal ver o Top do Resenhário?", botao: { texto: "Ver o Top", href: "/paginas/ranking.html" } });
    }
}

// Selo "confirmado pelo TMDB": a API confere se o filme é baseado neste livro.
// Se não der para conferir (TMDB fora do ar), o selo simplesmente não aparece.
async function mostrarSeloConferencia(id) {
    const selo = document.getElementById("adaptacao-selo");
    try {
        const conferencia = await api(`/Adaptacao/${id}/conferencia`);
        if (conferencia.situacao === "nao-conferida") return;
        selo.textContent = conferencia.situacao === "confirmada"
            ? `Adaptação confirmada · baseada na obra de ${conferencia.autoresOriginais.join(", ")}`
            : "Atenção: não encontramos sinal de que este filme veio deste livro";
        selo.className = `selo-conferencia ${conferencia.situacao}`;
        selo.hidden = false;
    } catch { /* sem selo */ }
}

document.addEventListener("DOMContentLoaded", iniciarAdaptacao);
