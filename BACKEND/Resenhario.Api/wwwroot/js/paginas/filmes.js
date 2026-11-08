// =====================================================================
// filmes.js: Filmes: busca (TMDB, via nossa API), vínculo livro + filme e catálogo.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

function iniciarPaginaFilmes() {
    const form = document.getElementById("form-busca-filmes");
    if (!form) return;
    const catalogo = document.getElementById("lista-filmes");
    carregarFilmesEm(catalogo, true);
    iniciarVinculoAdaptacoes();

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const termo = document.getElementById("termo-filme").value.trim();
        const area = document.getElementById("resultados-filmes"), msg = document.getElementById("mensagem-busca-filmes");
        if (!termo) return;
        msg.textContent = "Procurando filmes…";
        mostrarSkeleton(area, 6);
        try {
            const filmes = await api(`/Filme/buscar?q=${encodeURIComponent(termo)}`);
            if (!filmes.length) {
                msg.textContent = "";
                mostrarEstadoVazio(area, { titulo: "Não achamos esse filme", texto: "Tenta o título original, em inglês, ou outro nome." });
                return;
            }
            msg.textContent = `${filmes.length} ${filmes.length === 1 ? "filme encontrado" : "filmes encontrados"}.`;
            area.replaceChildren(...filmes.map(f => criarCardObra({
                titulo: f.titulo, imagem: f.posterUrl, tipo: "Filme",
                subtitulo: [f.anoLancamento, f.diretor].filter(Boolean).join(" · "),
                acoes: [{ texto: "Adicionar ao catálogo", acao: botao => salvarFilme(f, botao, catalogo) }]
            })));
        } catch (err) {
            msg.textContent = "";
            mostrarEstadoVazio(area, { erro: true, titulo: "A busca deu uma pausa", texto: "Não conseguimos procurar filmes agora. Tenta de novo em instantes; os filmes que já estão aqui continuam logo abaixo." });
        }
    });
}

async function salvarFilme(filme, botao, catalogo) {
    if (!exigirLogin()) return;
    botao.disabled = true; botao.textContent = "Salvando…";
    try {
        await api("/Filme", { method: "POST", body: JSON.stringify({ tmdbId: filme.tmdbId, titulo: filme.titulo, diretor: filme.diretor || null, anoLancamento: filme.anoLancamento, posterUrl: filme.posterUrl || null }) });
        botao.textContent = "No catálogo";
        avisar(`“${filme.titulo}” foi salvo no catálogo.`);
        await carregarFilmesEm(catalogo, true);
        await iniciarVinculoAdaptacoes(true);
    } catch (e) {
        botao.disabled = false; botao.textContent = "Tentar novamente";
        avisar(e.message, "erro");
    }
}

let vinculoConfigurado = false;

async function iniciarVinculoAdaptacoes(somenteRecarregar = false) {
    const form = document.getElementById("form-vincular-adaptacao");
    const lista = document.getElementById("lista-adaptacoes");
    if (!form || !lista) return;
    const livroSelect = document.getElementById("adaptacao-livro"), filmeSelect = document.getElementById("adaptacao-filme");

    try {
        const [livros, filmes, adaptacoes] = await Promise.all([api("/Livro"), api("/Filme"), api("/Adaptacao")]);
        preencherSelect(livroSelect, livros, "idLivros", "titulo", "Selecione um livro");
        preencherSelect(filmeSelect, filmes.map(f => ({ ...f, rotulo: f.anoLancamento ? `${f.titulo} (${f.anoLancamento})` : f.titulo })), "idFilme", "rotulo", "Selecione um filme");
        renderizarAdaptacoes(lista, adaptacoes);
    } catch (e) {
        mostrarEstadoVazio(lista, { erro: true, titulo: "Não deu para carregar os duelos", texto: e.message });
    }

    if (somenteRecarregar || vinculoConfigurado) return;
    vinculoConfigurado = true;
    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (!exigirLogin()) return;
        try {
            await api("/Adaptacao", { method: "POST", body: JSON.stringify({ idLivro: Number(livroSelect.value), idFilme: Number(filmeSelect.value) }) });
            avisar("Duelo aberto! Agora é com a galera.");
            await iniciarVinculoAdaptacoes(true);
        } catch (err) { avisar(err.message, "erro"); }
    });
}

// Adaptações já vinculadas, cada uma no card "Livro vs. Filme".
function renderizarAdaptacoes(lista, adaptacoes) {
    if (!adaptacoes.length) {
        mostrarEstadoVazio(lista, { titulo: "Nenhum duelo aberto", texto: "Junta um livro e um filme aí em cima." });
        return;
    }
    lista.replaceChildren(...adaptacoes.map(a => criarDuelo(a)));
}

document.addEventListener("DOMContentLoaded", iniciarPaginaFilmes);
