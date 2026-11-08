// =====================================================================
// ranking.js: Top do Resenhário: pódio (top 3) e as posições seguintes.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

async function iniciarRanking() {
    const podio = document.getElementById("ranking-podio");
    const lista = document.getElementById("ranking-lista");
    if (!podio || !lista) return;
    mostrarSkeleton(podio, 3, "obra");
    mostrarSkeleton(lista, 3, "duelo");
    try {
        const ranking = (await api("/Adaptacao/ranking")).slice(0, 10);
        if (!ranking.length) {
            lista.replaceChildren();
            mostrarEstadoVazio(podio, { titulo: "O pódio ainda está vazio", texto: "Dá a sua nota e ajuda a montar o Top do Resenhário.", botao: { texto: "Dar minha nota", href: "/paginas/reviews.html" } });
            return;
        }
        // No pódio o 1º lugar fica no meio: ordem visual 2º, 1º, 3º.
        const ordemVisual = [1, 0, 2].filter(i => i < ranking.length);
        podio.replaceChildren(...ordemVisual.map(i => criarLugarPodio(ranking[i], i + 1)));

        const demais = ranking.slice(3);
        document.getElementById("titulo-demais").hidden = !demais.length;
        lista.replaceChildren(...demais.map((item, i) => {
            const linha = el("div", "ranking-linha");
            linha.append(el("span", "ranking-posicao", `${i + 4}º`), criarDuelo(item));
            return linha;
        }));
    } catch (e) {
        lista.replaceChildren();
        mostrarEstadoVazio(podio, { erro: true, titulo: "Não foi possível carregar o ranking", texto: e.message });
    }
}

// Um degrau do pódio: pôster grande do filme com a capa do livro encaixada.
function criarLugarPodio(item, posicao) {
    const lugar = el("article", `podio-lugar lugar-${posicao}`);
    const imagens = el("div", "podio-imagens");
    const capaMini = el("div", "podio-capa-mini");
    capaMini.appendChild(criarCapa(item.capaUrl, item.tituloLivro, "Livro"));
    imagens.append(criarCapa(item.posterUrl, item.tituloFilme, "Filme"), capaMini, el("span", "podio-medalha", `${posicao}º`));

    const nota = el("div", "podio-nota");
    nota.append(el("strong", "", formatarMedia(item.mediaFidelidade)), criarEstrelas(item.mediaFidelidade),
        el("small", "", `fidelidade · ${item.totalAvaliacoes} ${item.totalAvaliacoes === 1 ? "avaliação" : "avaliações"}`));

    const titulo = el("h3");
    const link = el("a", "duelo-link", item.tituloFilme);
    link.href = `/paginas/adaptacao.html?id=${item.idAdaptacoes}`;
    titulo.appendChild(link);
    lugar.classList.add("duelo-clicavel");
    lugar.append(imagens,
        titulo,
        el("p", "podio-sub", `do livro de ${item.autorLivro}`),
        nota,
        el("div", "podio-degrau"));
    return lugar;
}

document.addEventListener("DOMContentLoaded", iniciarRanking);
