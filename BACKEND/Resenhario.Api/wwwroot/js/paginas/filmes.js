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
let livrosDoCatalogo = [];   // para mostrar título e autor nas mensagens
let ultimaTentativa = null; // livro e filme do último vínculo tentado (para o "Vincular mesmo assim")

async function iniciarVinculoAdaptacoes(somenteRecarregar = false) {
    const form = document.getElementById("form-vincular-adaptacao");
    const lista = document.getElementById("lista-adaptacoes");
    if (!form || !lista) return;
    const livroSelect = document.getElementById("adaptacao-livro"), filmeSelect = document.getElementById("adaptacao-filme");
    // Ao recarregar as listas, mantém o livro que já estava escolhido.
    const livroEscolhido = livroSelect.value || new URLSearchParams(location.search).get("livro");

    try {
        const [livros, filmes, adaptacoes] = await Promise.all([api("/Livro"), api("/Filme"), api("/Adaptacao")]);
        livrosDoCatalogo = livros;
        preencherSelect(livroSelect, livros, "idLivros", "titulo", "Selecione um livro");
        preencherSelect(filmeSelect, filmes.map(f => ({ ...f, rotulo: f.anoLancamento ? `${f.titulo} (${f.anoLancamento})` : f.titulo })), "idFilme", "rotulo", "Selecione um filme");
        if (livroEscolhido && livros.some(l => String(l.idLivros) === String(livroEscolhido))) livroSelect.value = livroEscolhido;
        renderizarAdaptacoes(lista, adaptacoes);
    } catch (e) {
        mostrarEstadoVazio(lista, { erro: true, titulo: "Não deu para carregar os duelos", texto: e.message });
    }

    if (somenteRecarregar || vinculoConfigurado) return;
    vinculoConfigurado = true;

    // Vínculo à mão: usa o livro escolhido em cima e o filme escolhido aqui.
    form.addEventListener("submit", e => {
        e.preventDefault();
        if (!livroSelect.value) {
            avisar("Escolha o livro primeiro.", "erro");
            livroSelect.focus();
            return;
        }
        vincularLivroEFilme(Number(livroSelect.value), Number(filmeSelect.value));
    });
    // Aviso do TMDB: a pessoa decide se troca o filme ou vincula mesmo assim.
    document.getElementById("cancelar-vinculo").addEventListener("click", () => {
        document.getElementById("aviso-vinculo").hidden = true;
        filmeSelect.focus();
    });
    document.getElementById("vincular-mesmo-assim").addEventListener("click", () =>
        vincularLivroEFilme(ultimaTentativa.idLivro, ultimaTentativa.idFilme, true));
    document.getElementById("form-procurar-adaptacoes").addEventListener("submit", e => {
        e.preventDefault();
        procurarAdaptacoes(Number(livroSelect.value));
    });
    livroSelect.addEventListener("change", () => {
        document.getElementById("aviso-vinculo").hidden = true;
        document.getElementById("sugestoes-adaptacao").replaceChildren();
        document.getElementById("mensagem-sugestoes").textContent = "";
    });

    // Veio da página Livros ("Virou filme?"): já procura as adaptações do livro.
    if (livroSelect.value) procurarAdaptacoes(Number(livroSelect.value));
}

// Cria o vínculo. A API confere no TMDB: se o filme não veio deste livro, responde 409
// com precisaConfirmar = true e mostramos o aviso, em vez de vincular direto.
async function vincularLivroEFilme(idLivro, idFilme, vincularMesmoAssim = false) {
    if (!exigirLogin()) return false;
    const aviso = document.getElementById("aviso-vinculo");
    ultimaTentativa = { idLivro, idFilme };
    try {
        const resposta = await api("/Adaptacao", { method: "POST", body: JSON.stringify({ idLivro, idFilme, vincularMesmoAssim }) });
        aviso.hidden = true;
        avisar(resposta?.situacao === "confirmada"
            ? "Duelo aberto! E sim: o filme veio mesmo deste livro."
            : "Duelo aberto! Agora é com a galera.");
        await iniciarVinculoAdaptacoes(true);
        return true;
    } catch (err) {
        if (err.dados?.precisaConfirmar) {
            document.getElementById("aviso-vinculo-texto").textContent = `${err.message} Tem certeza de que esse filme é adaptação desse livro?`;
            aviso.hidden = false;
            aviso.closest("details").open = true; // o aviso fica dentro de "Já sabe qual é o filme?"
        } else {
            avisar(err.message, "erro");
        }
        return false;
    }
}

// Procura no TMDB (pela nossa API) os filmes baseados no livro escolhido.
async function procurarAdaptacoes(idLivro) {
    const area = document.getElementById("sugestoes-adaptacao"), msg = document.getElementById("mensagem-sugestoes");
    if (!idLivro) {
        avisar("Escolha o livro primeiro.", "erro");
        return;
    }
    const livro = livrosDoCatalogo.find(l => l.idLivros === idLivro);
    document.getElementById("vincular").scrollIntoView({ behavior: "smooth", block: "start" });
    msg.textContent = "Procurando filmes baseados neste livro…";
    mostrarSkeleton(area, 3);
    try {
        const sugestoes = await api(`/Livro/${idLivro}/adaptacoes-sugeridas`);
        if (!sugestoes.length) {
            msg.textContent = "";
            mostrarEstadoVazio(area, { titulo: "Nenhuma adaptação encontrada",
                texto: `Não encontramos filme baseado em “${livro?.titulo ?? "este livro"}”${livro?.autor ? `, de ${livro.autor}` : ""}. Se existir uma adaptação com outro nome, ela pode ser ligada em “Já sabe qual é o filme?”.` });
            return;
        }
        msg.textContent = sugestoes.length === 1 ? "Achamos 1 filme baseado neste livro:" : `Achamos ${sugestoes.length} filmes baseados neste livro:`;
        area.replaceChildren(...sugestoes.map(s => criarCardObra({
            titulo: s.titulo, imagem: s.posterUrl, tipo: "Filme",
            subtitulo: [s.anoLancamento, s.diretor].filter(Boolean).join(" · "),
            detalhe: `${s.jaVinculado ? "Duelo já aberto · " : ""}Baseado na obra de ${s.autoresOriginais.join(", ")}`,
            acoes: s.jaVinculado ? [] : [{ texto: "Abrir o duelo", acao: botao => abrirDueloSugerido(idLivro, s, botao) }]
        })));
    } catch {
        msg.textContent = "";
        mostrarEstadoVazio(area, { erro: true, titulo: "A busca deu uma pausa", texto: "Não conseguimos procurar adaptações agora. O vínculo em “Já sabe qual é o filme?” continua funcionando." });
    }
}

// Sugestão escolhida: salva o filme no catálogo (se ainda não estiver) e cria o vínculo.
async function abrirDueloSugerido(idLivro, sugestao, botao) {
    if (!exigirLogin()) return;
    botao.disabled = true; botao.textContent = "Abrindo…";
    try {
        let idFilme = sugestao.idFilme;
        if (!idFilme) {
            const filme = await api("/Filme", { method: "POST", body: JSON.stringify({ tmdbId: sugestao.tmdbId, titulo: sugestao.titulo, diretor: sugestao.diretor || null, anoLancamento: sugestao.anoLancamento, posterUrl: sugestao.posterUrl || null }) });
            idFilme = filme.idFilme;
            await carregarFilmesEm(document.getElementById("lista-filmes"), true);
        }
        if (await vincularLivroEFilme(idLivro, idFilme)) {
            botao.textContent = "Duelo aberto";
            return;
        }
    } catch (err) {
        avisar(err.message, "erro");
    }
    botao.disabled = false; botao.textContent = "Tentar novamente";
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
