// =====================================================================
// home.js: Página inicial: hero com o 1º lugar do ranking, destaques, carrosséis e últimas resenhas.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

async function iniciarHome() {
    if (!document.getElementById("home")) return;

    // Quem já está logado vê um convite para resenhar, não para se cadastrar.
    if (usuarioAtual()) {
        const cta = document.getElementById("hero-cta");
        cta.textContent = "Escrever uma resenha";
        cta.href = "/paginas/reviews.html";
        document.getElementById("convite").hidden = true;
    }

    await Promise.allSettled([
        carregarDestaquesHome(),
        carregarLivrosEm(document.getElementById("inicio-livros")),
        carregarFilmesEm(document.getElementById("inicio-filmes")),
        carregarResenhasEm(document.getElementById("inicio-feed"), { tamanho: 3 })
    ]);
}

// Hero (1º lugar do ranking), números da comunidade e os três "duelos" seguintes.
async function carregarDestaquesHome() {
    const heroDuelo = document.getElementById("hero-duelo");
    const duelos = document.getElementById("inicio-duelos");
    mostrarSkeleton(heroDuelo, 1, "duelo");
    mostrarSkeleton(duelos, 3, "duelo");
    try {
        const [ranking, adaptacoes, livros, feed] = await Promise.all([
            api("/Adaptacao/ranking"), api("/Adaptacao"), api("/Livro"), api("/Review/feed?pagina=1&tamanho=1")
        ]);
        preencherNumerosHero([[livros.length, "livros"], [adaptacoes.length, "adaptações"], [feed.total, "resenhas"]]);

        if (!ranking.length) {
            document.querySelector(".hero-destaque").hidden = true;
            mostrarEstadoVazio(duelos, { titulo: "Nenhum duelo avaliado ainda", texto: "Dá a primeira nota e começa a disputa.", botao: { texto: "Dar minha nota", href: "/paginas/reviews.html" } });
            return;
        }
        const [primeiro, ...outros] = ranking;
        heroDuelo.replaceChildren(criarDuelo(primeiro));
        // Fundo do hero: pôster do campeão bem desfocado (luz de sala de cinema).
        if (primeiro.posterUrl) document.getElementById("hero-fundo").style.backgroundImage = `url("${primeiro.posterUrl}")`;
        duelos.replaceChildren(...outros.slice(0, 3).map(item => criarDuelo(item)));
    } catch (e) {
        document.querySelector(".hero-destaque").hidden = true;
        mostrarEstadoVazio(duelos, { erro: true, titulo: "Não foi possível carregar os destaques", texto: e.message });
    }
}

function preencherNumerosHero(numeros) {
    const lista = document.getElementById("hero-numeros");
    lista.replaceChildren(...numeros.map(([valor, rotulo]) => {
        const item = el("div", "hero-numero");
        item.append(el("dt", "", rotulo), el("dd", "", String(valor)));
        return item;
    }));
}

document.addEventListener("DOMContentLoaded", iniciarHome);
