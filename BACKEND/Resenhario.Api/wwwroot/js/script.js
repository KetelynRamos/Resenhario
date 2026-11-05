// =====================================================================
// script.js: lógica de cada página. Cada função "iniciar..." só roda
// se a página tiver o elemento correspondente (por isso um único arquivo
// serve para o site inteiro).
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

document.addEventListener("DOMContentLoaded", () => {
    iniciarHome();
    iniciarPaginaLivros();
    iniciarPaginaFilmes();
    iniciarPaginaSeries();
    iniciarLogin();
    iniciarEstante();
    iniciarResenhas();
    iniciarFeed();
    iniciarRanking();
});

// ---------------------------------------------------------------------
// Catálogo: livros e filmes salvos no banco
// ---------------------------------------------------------------------
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
            mostrarEstadoVazio(container, { icone: "📚", titulo: "O catálogo ainda está vazio", texto: "Pesquise no Google Books e adicione o primeiro livro." });
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
            mostrarEstadoVazio(container, { icone: "🎬", titulo: "Nenhum filme no catálogo", texto: "Pesquise no TMDB e adicione o primeiro filme." });
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
            body: JSON.stringify({ idLivros: ids.idLivros || null, idFilme: ids.idFilme || null, idSerie: ids.idSerie || null, status })
        });
        avisar(`Adicionado à sua estante como “${status}”.`);
    } catch (e) {
        avisar(e.message.includes("já está") ? "Esse item já está na sua estante." : e.message, "erro");
    }
}

// ---------------------------------------------------------------------
// Página inicial
// ---------------------------------------------------------------------
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
        carregarResenhasEm(document.getElementById("inicio-feed"), 1, 3)
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
            mostrarEstadoVazio(duelos, { icone: "🎬", titulo: "Ainda não há adaptações avaliadas", texto: "Escreva a primeira resenha com nota de fidelidade.", botao: { texto: "Escrever resenha", href: "/paginas/reviews.html" } });
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

// ---------------------------------------------------------------------
// Livros: busca no Google Books (via nossa API) + catálogo
// ---------------------------------------------------------------------
function iniciarPaginaLivros() {
    const form = document.getElementById("form-busca-livros");
    if (!form) return;
    const catalogo = document.getElementById("lista-livros");
    carregarLivrosEm(catalogo, true);

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const termo = document.getElementById("termo-livro").value.trim();
        const area = document.getElementById("resultados-busca"), msg = document.getElementById("mensagem-busca");
        if (!termo) return;
        msg.textContent = "Pesquisando no Google Books…";
        mostrarSkeleton(area, 6);
        try {
            const livros = await api(`/Livro/buscar?q=${encodeURIComponent(termo)}`);
            if (!livros.length) {
                msg.textContent = "";
                mostrarEstadoVazio(area, { icone: "🔎", titulo: "Nenhum livro encontrado", texto: "Tente outro título ou o nome do autor." });
                return;
            }
            msg.textContent = `${livros.length} resultado(s) no Google Books.`;
            area.replaceChildren(...livros.map(livro => criarCardObra({
                titulo: livro.titulo, subtitulo: livro.autor, imagem: livro.capaUrl, tipo: "Livro",
                detalhe: livro.anoPublicacao ? `Publicado em ${livro.anoPublicacao.slice(0, 4)}` : "",
                acoes: [{ texto: "Adicionar ao catálogo", acao: botao => salvarLivro(livro, botao, catalogo) }]
            })));
        } catch (err) {
            msg.textContent = "";
            mostrarEstadoVazio(area, { erro: true, titulo: "A busca no Google Books falhou", texto: `${err.message} Os livros já salvos no catálogo continuam disponíveis abaixo.` });
        }
    });
}

async function salvarLivro(livro, botao, catalogo) {
    if (!exigirLogin()) return;
    botao.disabled = true; botao.textContent = "Salvando…";
    try {
        await api("/Livro", { method: "POST", body: JSON.stringify({ googleBId: livro.id, titulo: livro.titulo, autor: livro.autor || "Autor não informado", sinopse: livro.sinopse || null, isbn: livro.isbn || null, capaUrl: livro.capaUrl || null }) });
        botao.textContent = "✓ No catálogo";
        avisar(`“${livro.titulo}” foi adicionado ao catálogo.`);
        await carregarLivrosEm(catalogo, true);
    } catch (e) {
        const jaExiste = /já está|isbn|catálogo/i.test(e.message);
        botao.disabled = jaExiste;
        botao.textContent = jaExiste ? "Já no catálogo" : "Tentar novamente";
        avisar(e.message, "erro");
    }
}

// ---------------------------------------------------------------------
// Filmes: busca no TMDB, vínculo com livros e catálogo
// ---------------------------------------------------------------------
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
        msg.textContent = "Pesquisando no TMDB…";
        mostrarSkeleton(area, 6);
        try {
            const filmes = await api(`/Filme/buscar?q=${encodeURIComponent(termo)}`);
            if (!filmes.length) {
                msg.textContent = "";
                mostrarEstadoVazio(area, { icone: "🔎", titulo: "Nenhum filme encontrado", texto: "Tente o título original ou outro termo." });
                return;
            }
            msg.textContent = `${filmes.length} filme(s) no TMDB.`;
            area.replaceChildren(...filmes.map(f => criarCardObra({
                titulo: f.titulo, imagem: f.posterUrl, tipo: "Filme",
                subtitulo: [f.anoLancamento, f.diretor].filter(Boolean).join(" · "),
                acoes: [{ texto: "Adicionar ao catálogo", acao: botao => salvarFilme(f, botao, catalogo) }]
            })));
        } catch (err) {
            msg.textContent = "";
            mostrarEstadoVazio(area, { erro: true, titulo: "A busca no TMDB falhou", texto: `${err.message} Os filmes já salvos continuam disponíveis abaixo.` });
        }
    });
}

async function salvarFilme(filme, botao, catalogo) {
    if (!exigirLogin()) return;
    botao.disabled = true; botao.textContent = "Salvando…";
    try {
        await api("/Filme", { method: "POST", body: JSON.stringify({ tmdbId: filme.tmdbId, titulo: filme.titulo, diretor: filme.diretor || null, anoLancamento: filme.anoLancamento, posterUrl: filme.posterUrl || null }) });
        botao.textContent = "✓ No catálogo";
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
        mostrarEstadoVazio(lista, { erro: true, titulo: "Não foi possível carregar as adaptações", texto: e.message });
    }

    if (somenteRecarregar || vinculoConfigurado) return;
    vinculoConfigurado = true;
    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (!exigirLogin()) return;
        try {
            await api("/Adaptacao", { method: "POST", body: JSON.stringify({ idLivro: Number(livroSelect.value), idFilme: Number(filmeSelect.value) }) });
            avisar("Adaptação vinculada! Agora ela pode receber notas de fidelidade.");
            await iniciarVinculoAdaptacoes(true);
        } catch (err) { avisar(err.message, "erro"); }
    });
}

// Adaptações já vinculadas, cada uma no card "Livro vs. Filme".
function renderizarAdaptacoes(lista, adaptacoes) {
    if (!adaptacoes.length) {
        mostrarEstadoVazio(lista, { icone: "🔗", titulo: "Nenhuma adaptação vinculada", texto: "Escolha um livro e um filme acima." });
        return;
    }
    lista.replaceChildren(...adaptacoes.map(a => criarDuelo(a)));
}

function preencherSelect(select, itens, idCampo, textoCampo, placeholder) {
    if (!select) return;
    const opcao = new Option(placeholder, "");
    opcao.disabled = true; opcao.selected = true;
    select.replaceChildren(opcao, ...itens.map(item => new Option(item[textoCampo], item[idCampo])));
}

// ---------------------------------------------------------------------
// Séries (fora do escopo: página escondida do menu, mantida no projeto)
// ---------------------------------------------------------------------
function iniciarPaginaSeries() {
    const form = document.getElementById("form-busca-series");
    if (!form) return;
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const termo = document.getElementById("termo-serie").value.trim();
        const area = document.getElementById("resultados-series");
        mostrarSkeleton(area, 6);
        try {
            const series = await api(`/Serie/buscar?q=${encodeURIComponent(termo)}`);
            area.replaceChildren(...series.map(s => criarCardObra({ titulo: s.titulo, imagem: s.imagemUrl, tipo: "Filme", subtitulo: s.dataEstreia || "" })));
        } catch (err) { mostrarEstadoVazio(area, { erro: true, titulo: "A busca falhou", texto: err.message }); }
    });
}

// ---------------------------------------------------------------------
// Login e cadastro
// ---------------------------------------------------------------------
function iniciarLogin() {
    const form = document.getElementById("form-login");
    if (!form) return;
    const abas = document.querySelectorAll(".aba-login");
    const camposCadastro = document.getElementById("campos-cadastro");
    const conectado = document.getElementById("conectado");
    let modoCadastro = location.hash === "#cadastro";

    const render = () => {
        const usuario = usuarioAtual();
        form.hidden = !!usuario;
        document.querySelector(".abas-login").hidden = !!usuario;
        conectado.hidden = !usuario;
        if (usuario) document.getElementById("conectado-nome").textContent = usuario.nome;
        camposCadastro.hidden = !modoCadastro;
        document.getElementById("nome").required = modoCadastro;
        form.querySelector('button[type="submit"]').textContent = modoCadastro ? "Criar minha conta" : "Entrar";
        abas.forEach(aba => aba.classList.toggle("ativa", (aba.dataset.modo === "cadastro") === modoCadastro));
    };
    abas.forEach(aba => aba.addEventListener("click", () => { modoCadastro = aba.dataset.modo === "cadastro"; render(); }));
    document.getElementById("sair-conta").addEventListener("click", () => { sair(); avisar("Você saiu da conta."); render(); });
    render();

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const botao = form.querySelector('button[type="submit"]');
        const email = document.getElementById("email").value.trim(), senha = document.getElementById("senha").value;
        const dados = modoCadastro ? { nome: document.getElementById("nome").value.trim(), email, senha } : { email, senha };
        botao.disabled = true;
        try {
            const usuario = await api(modoCadastro ? "/Auth/cadastro" : "/Auth/login", { method: "POST", body: JSON.stringify(dados) });
            localStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
            avisar(modoCadastro ? "Conta criada! Bem-vindo(a) ao Resenhário." : `Bem-vindo(a) de volta, ${usuario.nome.split(" ")[0]}!`);
            setTimeout(() => location.href = "/index.html", 700);
        } catch (err) {
            avisar(err.message || "Não foi possível entrar.", "erro");
            botao.disabled = false;
        }
    });
}

// ---------------------------------------------------------------------
// Minha estante: itens do usuário, status de leitura e estatísticas
// ---------------------------------------------------------------------
const STATUS_LIVRO = ["Quero ler", "Lendo", "Lido", "Abandonado"];
const STATUS_FILME = ["Quero ver", "Assistindo", "Assistido"];

async function iniciarEstante() {
    const area = document.getElementById("itens-estante");
    if (!area) return;
    if (!usuarioAtual()?.token) {
        document.getElementById("painel-estatisticas").hidden = true;
        mostrarEstadoVazio(area, { icone: "🔒", titulo: "Entre para ver sua estante", texto: "Sua estante guarda o que você quer ler, está lendo e já leu.", botao: { texto: "Entrar", href: "/paginas/login.html" } });
        return;
    }
    mostrarSkeleton(area, 8);
    try {
        const itens = await api("/Estante");
        renderizarEstatisticasLeitura(itens);
        configurarFiltrosEstante(area);
        if (!itens.length) {
            mostrarEstadoVazio(area, { icone: "📚", titulo: "Sua estante está vazia", texto: "Adicione livros e filmes do catálogo para acompanhar sua leitura.", botao: { texto: "Explorar livros", href: "/paginas/livros.html" } });
            return;
        }
        area.replaceChildren(...itens.map(item => cardEstante(item, itens, area)));
    } catch (e) {
        mostrarEstadoVazio(area, { erro: true, titulo: "Não foi possível carregar sua estante", texto: e.message });
    }
}

function cardEstante(item, itens, area) {
    const card = criarCardObra({ titulo: item.titulo, subtitulo: item.autor, imagem: item.imagem, tipo: item.tipo === "Livro" ? "Livro" : "Filme" });
    card.dataset.status = item.status;
    const acoes = card.querySelector(".card-obra-acoes");

    const select = el("select", "select-status");
    select.setAttribute("aria-label", `Status de ${item.titulo}`);
    (item.tipo === "Livro" ? STATUS_LIVRO : STATUS_FILME).forEach(status => select.appendChild(new Option(status, status, false, status === item.status)));
    select.addEventListener("change", async () => {
        const anterior = item.status;
        select.disabled = true;
        try {
            await api(`/Estante/${item.idEstante}`, { method: "PUT", body: JSON.stringify({ status: select.value }) });
            item.status = select.value;
            item.dataAtualizacao = new Date().toISOString();
            card.dataset.status = item.status;
            renderizarEstatisticasLeitura(itens);
            aplicarFiltroEstante(area);
            avisar(`“${item.titulo}” agora está em “${item.status}”.`);
        } catch (err) {
            select.value = anterior;
            avisar(err.message, "erro");
        } finally { select.disabled = false; }
    });

    const remover = el("button", "botao botao-fantasma botao-pequeno", "Remover");
    remover.type = "button";
    remover.addEventListener("click", async () => {
        if (!confirm(`Remover “${item.titulo}” da sua estante?`)) return;
        remover.disabled = true;
        try {
            await api(`/Estante/${item.idEstante}`, { method: "DELETE" });
            itens.splice(itens.indexOf(item), 1);
            card.remove();
            renderizarEstatisticasLeitura(itens);
            avisar("Item removido da estante.");
            if (!itens.length) mostrarEstadoVazio(area, { icone: "📚", titulo: "Sua estante está vazia", texto: "Adicione livros do catálogo.", botao: { texto: "Explorar livros", href: "/paginas/livros.html" } });
        } catch (err) { remover.disabled = false; avisar(err.message, "erro"); }
    });
    acoes.append(select, remover);
    return card;
}

function renderizarEstatisticasLeitura(itens) {
    const area = document.getElementById("estatisticas-leitura");
    if (!area) return;
    const livros = itens.filter(item => item.tipo === "Livro");
    const contar = status => livros.filter(item => item.status === status).length;
    const numeros = [["📚", "Na estante", itens.length], ["✅", "Lidos", contar("Lido")], ["📖", "Lendo", contar("Lendo")],
        ["🔖", "Quero ler", contar("Quero ler")], ["💤", "Abandonados", contar("Abandonado")]];
    area.replaceChildren(...numeros.map(([icone, rotulo, valor]) => {
        const card = el("article", "estatistica");
        card.append(el("span", "estatistica-icone", icone), el("strong", "", String(valor)), el("span", "estatistica-rotulo", rotulo));
        return card;
    }));
    renderizarGraficos(livros);
}

// Gráficos da estante com Chart.js. Guardamos os gráficos para recriá-los
// quando o status de um livro muda (destroy + new é o jeito mais simples).
const graficos = {};

async function renderizarGraficos(livros) {
    const canvasStatus = document.getElementById("grafico-status");
    if (!canvasStatus) return;
    if (!await carregarChartJs()) {
        document.getElementById("graficos").replaceChildren(el("p", "mensagem", "Os gráficos não puderam ser carregados agora; os números acima continuam valendo."));
        return;
    }

    // 1) Rosca: quantos livros em cada status.
    const cores = ["#ffd27a", "#f2b33d", "#6cc38a", "#a3202f"];
    graficos.status?.destroy();
    graficos.status = new Chart(canvasStatus, {
        type: "doughnut",
        data: {
            labels: STATUS_LIVRO,
            datasets: [{ data: STATUS_LIVRO.map(s => livros.filter(l => l.status === s).length), backgroundColor: cores, borderColor: "#18150f", borderWidth: 3 }]
        },
        options: { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } } } }
    });

    // 2) Barras: livros marcados como "Lido" em cada um dos últimos 6 meses.
    const meses = [];
    const hoje = new Date();
    for (let i = 5; i >= 0; i--) meses.push(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1));
    const lidosNoMes = mes => livros.filter(l => {
        if (l.status !== "Lido") return false;
        const data = new Date(/[zZ]$/.test(l.dataAtualizacao) ? l.dataAtualizacao : l.dataAtualizacao + "Z");
        return data.getFullYear() === mes.getFullYear() && data.getMonth() === mes.getMonth();
    }).length;
    graficos.meses?.destroy();
    graficos.meses = new Chart(document.getElementById("grafico-meses"), {
        type: "bar",
        data: {
            labels: meses.map(m => m.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")),
            datasets: [{ label: "Livros lidos", data: meses.map(lidosNoMes), backgroundColor: "#f2b33d", hoverBackgroundColor: "#ffd27a", borderRadius: 6, maxBarThickness: 42 }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
    });
}

// Filtros da prateleira: Todos, cada status de leitura ou só filmes.
let filtroEstante = "todos";
function configurarFiltrosEstante(area) {
    document.querySelectorAll(".filtro").forEach(botao => botao.addEventListener("click", () => {
        filtroEstante = botao.dataset.filtro;
        document.querySelectorAll(".filtro").forEach(b => b.classList.toggle("ativo", b === botao));
        aplicarFiltroEstante(area);
    }));
}

function aplicarFiltroEstante(area) {
    area.querySelectorAll(".card-obra").forEach(card => {
        const ehFilme = STATUS_FILME.includes(card.dataset.status);
        card.hidden = filtroEstante === "filmes" ? !ehFilme : filtroEstante !== "todos" && card.dataset.status !== filtroEstante;
    });
}

// ---------------------------------------------------------------------
// Publicar resenha (avaliação dupla: obra + fidelidade da adaptação)
// ---------------------------------------------------------------------
let adaptacoesCache = [];

async function iniciarResenhas() {
    const form = document.getElementById("form-review");
    if (!form) return;
    const livroSelect = document.getElementById("review-livro");
    const adaptacaoSelect = document.getElementById("review-adaptacao");
    const campoFidelidade = document.getElementById("campo-fidelidade");
    const comentario = document.getElementById("review-comentario");
    const contador = document.getElementById("contador-comentario");

    // Estrelas no lugar dos campos numéricos.
    const estrelasLivro = criarSeletorEstrelas("nota-livro", ["Não gostei", "Fraco", "Bom", "Muito bom", "Excelente"]);
    const estrelasFidelidade = criarSeletorEstrelas("nota-fidelidade", ["Quase outra história", "Muitas liberdades", "Fiel no essencial", "Bem fiel", "Fidelíssimo"]);
    document.getElementById("estrelas-livro").appendChild(estrelasLivro);
    document.getElementById("estrelas-fidelidade").appendChild(estrelasFidelidade);
    comentario.addEventListener("input", () => contador.textContent = `${comentario.value.length}/5000`);

    try {
        const [livros, adaptacoes] = await Promise.all([api("/Livro"), api("/Adaptacao")]);
        adaptacoesCache = adaptacoes;
        preencherSelect(livroSelect, livros, "idLivros", "titulo", "Selecione um livro");
    } catch (e) { avisar(`Não foi possível carregar o formulário: ${e.message}`, "erro"); }

    const atualizarAdaptacoes = () => {
        const idLivro = Number(livroSelect.value || 0);
        adaptacaoSelect.replaceChildren(new Option("Não vi nenhuma adaptação", ""),
            ...adaptacoesCache.filter(a => a.idLivro === idLivro).map(a => new Option(a.tituloFilme, a.idAdaptacoes)));
        campoFidelidade.hidden = true;
    };
    livroSelect.addEventListener("change", atualizarAdaptacoes);
    adaptacaoSelect.addEventListener("change", () => campoFidelidade.hidden = !adaptacaoSelect.value);

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (!exigirLogin()) return;
        const idLivro = Number(livroSelect.value), idAdaptacao = Number(adaptacaoSelect.value || 0);
        const notaLivro = valorEstrelas("nota-livro");
        const notaFidelidade = idAdaptacao ? valorEstrelas("nota-fidelidade") : null;
        const texto = comentario.value.trim();
        if (!idLivro) { avisar("Selecione um livro.", "erro"); return; }
        if (!notaLivro) { avisar("Dê de 1 a 5 estrelas para o livro.", "erro"); return; }
        if (idAdaptacao && !notaFidelidade) { avisar("Dê de 1 a 5 estrelas para a fidelidade do filme.", "erro"); return; }
        try {
            await api("/Review", { method: "POST", body: JSON.stringify({ idLivro, idAdaptacao: idAdaptacao || null, notaLivro, comentario: texto, notaFidelidade, assistiuFilme: !!idAdaptacao }) });
            form.reset(); atualizarAdaptacoes();
            estrelasLivro.limpar(); estrelasFidelidade.limpar(); contador.textContent = "0/5000";
            avisar("Resenha publicada! Ela já aparece no feed.");
            await carregarUltimasResenhas();
        } catch (err) { avisar(err.message, "erro"); }
    });
    await carregarUltimasResenhas();
}

async function carregarUltimasResenhas() {
    const lista = document.getElementById("ultimas-resenhas");
    if (!lista) return;
    await carregarResenhasEm(lista, 1, 4);
}

// ---------------------------------------------------------------------
// Feed da comunidade
// ---------------------------------------------------------------------
async function carregarResenhasEm(lista, pagina, tamanho, acrescentar = false) {
    if (!acrescentar) mostrarSkeleton(lista, Math.min(tamanho, 4), "resenha");
    try {
        const dados = await api(`/Review/feed?pagina=${pagina}&tamanho=${tamanho}`);
        if (!dados.itens.length && !acrescentar) {
            mostrarEstadoVazio(lista, { icone: "✍️", titulo: "Ainda não há resenhas", texto: "Seja a primeira pessoa a comparar um livro com o filme.", botao: { texto: "Escrever resenha", href: "/paginas/reviews.html" } });
            return dados;
        }
        const cards = dados.itens.map(cardResenha);
        if (acrescentar) lista.append(...cards); else lista.replaceChildren(...cards);
        return dados;
    } catch (e) {
        mostrarEstadoVazio(lista, { erro: true, titulo: "Não foi possível carregar o feed", texto: e.message });
        return null;
    }
}

// Card de resenha do feed social.
function cardResenha(review) {
    const card = el("article", "card-resenha");

    // Topo: avatar, nome, livro e "há 2 horas"
    const topo = el("header", "resenha-topo");
    const quem = el("div", "resenha-quem");
    const linha = el("span", "resenha-acao", "resenhou ");
    linha.append(el("b", "", review.titulo || "um livro"), ` · ${dataRelativa(review.dataCriacao)}`);
    quem.append(el("strong", "", review.nomeUsuario), linha);
    topo.append(criarAvatar(review.nomeUsuario), quem);

    // Capa do livro (e pôster do filme, se a resenha avaliou uma adaptação)
    const capas = el("div", "resenha-capas");
    const capaLivro = el("div", "resenha-capa");
    capaLivro.appendChild(criarCapa(review.capaUrl, review.titulo, "Livro"));
    capas.appendChild(capaLivro);
    if (review.tituloFilme) {
        const poster = el("div", "resenha-capa resenha-poster");
        poster.appendChild(criarCapa(review.posterUrl, review.tituloFilme, "Filme"));
        capas.appendChild(poster);
    }

    // Notas: estrelas para o livro e "chip" de fidelidade para o filme
    const notas = el("div", "resenha-notas");
    const chipLivro = el("span", "chip chip-livro", "📖 Livro ");
    chipLivro.appendChild(criarEstrelas(review.notaLivro));
    notas.appendChild(chipLivro);
    if (review.tituloFilme && review.notaFidelidade != null) {
        // Mostra o ano só se ele ainda não estiver no título (ex.: "Duna (1984)").
        const ano = review.anoFilme && !review.tituloFilme.includes(String(review.anoFilme)) ? ` (${review.anoFilme})` : "";
        const chipFilme = el("span", "chip chip-filme", `🎬 Fidelidade de ${review.tituloFilme}${ano}: `);
        chipFilme.appendChild(el("b", "", `${review.notaFidelidade}/5`));
        notas.appendChild(chipFilme);
    }

    // Texto: resenhas longas mostram só o começo, com botão "ler mais"
    const texto = el("p", "resenha-texto", review.comentario || "");
    const conteudo = el("div", "resenha-conteudo");
    conteudo.append(notas, texto);
    if ((review.comentario || "").length > 220) {
        texto.classList.add("recolhido");
        const lerMais = el("button", "ler-mais", "ler mais");
        lerMais.type = "button";
        lerMais.addEventListener("click", () => {
            const recolhido = texto.classList.toggle("recolhido");
            lerMais.textContent = recolhido ? "ler mais" : "ler menos";
        });
        conteudo.appendChild(lerMais);
    }
    conteudo.appendChild(criarComparativo(review));

    const corpo = el("div", "resenha-corpo");
    corpo.append(capas, conteudo);
    card.append(topo, corpo);
    return card;
}

// Comparativo entre leitores: a nota desta pessoa × a média da comunidade para o mesmo livro.
function criarComparativo(review) {
    const caixa = el("p", "resenha-comparativo");
    const primeiroNome = review.nomeUsuario.split(" ")[0];
    if (review.totalResenhasLivro <= 1 || review.mediaNotaLivro == null) {
        caixa.textContent = "✨ Primeira resenha deste livro na comunidade";
        return caixa;
    }
    const diferenca = review.notaLivro - review.mediaNotaLivro;
    let tendencia = "na média da comunidade", classe = "igual";
    if (diferenca >= 0.3) { tendencia = "gostou mais que a média"; classe = "acima"; }
    if (diferenca <= -0.3) { tendencia = "gostou menos que a média"; classe = "abaixo"; }
    caixa.classList.add(`comparativo-${classe}`);
    caixa.append(`${primeiroNome} deu `, el("b", "", String(review.notaLivro)),
        " · média da comunidade ", el("b", "", formatarMedia(review.mediaNotaLivro)),
        ` (${review.totalResenhasLivro} resenhas) → ${tendencia}`);
    return caixa;
}

async function iniciarFeed() {
    const lista = document.getElementById("feed-resenhas");
    if (!lista) return;
    const botaoMais = document.getElementById("feed-mais");
    let pagina = 1;
    const dados = await carregarResenhasEm(lista, pagina, 10);
    botaoMais.hidden = !dados || dados.totalPaginas <= 1;
    botaoMais.addEventListener("click", async () => {
        botaoMais.disabled = true;
        const proxima = await carregarResenhasEm(lista, ++pagina, 10, true);
        botaoMais.disabled = false;
        botaoMais.hidden = !proxima || pagina >= proxima.totalPaginas;
    });
}

// ---------------------------------------------------------------------
// Ranking de adaptações: pódio (top 3) + do 4º ao 10º lugar
// ---------------------------------------------------------------------
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
            mostrarEstadoVazio(podio, { icone: "🏆", titulo: "O ranking ainda está vazio", texto: "Uma adaptação entra no ranking quando recebe pelo menos 2 notas de fidelidade.", botao: { texto: "Avaliar uma adaptação", href: "/paginas/reviews.html" } });
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

    lugar.append(imagens,
        el("h3", "", item.tituloFilme),
        el("p", "podio-sub", `do livro de ${item.autorLivro}`),
        nota,
        el("div", "podio-degrau"));
    return lugar;
}
