// =====================================================================
// catalogo.js: Catálogo: cards e listas de livros e filmes, usados em várias páginas.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

function cardLivro(livro, comEstante) {
    return criarCardObra({
        titulo: livro.titulo, subtitulo: livro.autor, imagem: livro.capaUrl, tipo: "Livro",
        acoes: comEstante ? [{ texto: "＋ Minha estante", acao: () => adicionarAEstante({ idLivros: livro.idLivros }) }] : []
    });
}

function cardFilme(filme, comEstante) {
    const detalhe = [filme.anoLancamento, filme.diretor].filter(Boolean).join(" · ");
    return criarCardObra({
        titulo: filme.titulo, subtitulo: detalhe, imagem: filme.posterUrl, tipo: "Filme",
        acoes: comEstante ? [{ texto: "＋ Minha estante", acao: () => adicionarAEstante({ idFilme: filme.idFilme }) }] : []
    });
}

async function carregarLivrosEm(container, comEstante = false) {
    if (!container) return;
    mostrarSkeleton(container, 6);
    try {
        const livros = await api("/Livro");
        if (!livros.length) {
            mostrarEstadoVazio(container, { titulo: "Nenhum livro por aqui ainda", texto: "Busque um livro aí em cima e seja a primeira pessoa a trazer." });
            return;
        }
        container.replaceChildren(...livros.map(l => cardLivro(l, comEstante)));
    } catch (e) {
        mostrarEstadoVazio(container, { erro: true, titulo: "Não foi possível carregar os livros", texto: e.message });
    }
}

async function carregarFilmesEm(container, comEstante = false) {
    if (!container) return;
    mostrarSkeleton(container, 6);
    try {
        const filmes = await api("/Filme");
        if (!filmes.length) {
            mostrarEstadoVazio(container, { titulo: "Nenhum filme por aqui ainda", texto: "Busque um filme aí em cima e abra a sessão." });
            return;
        }
        container.replaceChildren(...filmes.map(f => cardFilme(f, comEstante)));
    } catch (e) {
        mostrarEstadoVazio(container, { erro: true, titulo: "Não foi possível carregar os filmes", texto: e.message });
    }
}

async function adicionarAEstante(ids) {
    if (!exigirLogin()) return;
    const status = ids.idLivros ? "Quero ler" : "Quero ver";
    try {
        await api("/Estante", {
            method: "POST",
            body: JSON.stringify({ idLivros: ids.idLivros || null, idFilme: ids.idFilme || null, status })
        });
        avisar(`Adicionado à sua estante como “${status}”.`);
    } catch (e) {
        avisar(e.message.includes("já está") ? "Esse item já está na sua estante." : e.message, "erro");
    }
}

function preencherSelect(select, itens, idCampo, textoCampo, placeholder) {
    if (!select) return;
    const opcao = new Option(placeholder, "");
    opcao.disabled = true; opcao.selected = true;
    select.replaceChildren(opcao, ...itens.map(item => new Option(item[textoCampo], item[idCampo])));
}
