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
    iniciarPerfil();
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

// ---------------------------------------------------------------------
// Livros: busca de livros (Google Books, via nossa API) + catálogo
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
        msg.textContent = "Procurando livros…";
        mostrarSkeleton(area, 6);
        try {
            const livros = await api(`/Livro/buscar?q=${encodeURIComponent(termo)}`);
            if (!livros.length) {
                msg.textContent = "";
                mostrarEstadoVazio(area, { titulo: "Não achamos esse livro", texto: "Tenta outro título ou o nome de quem escreveu." });
                return;
            }
            msg.textContent = `${livros.length} ${livros.length === 1 ? "livro encontrado" : "livros encontrados"}.`;
            area.replaceChildren(...livros.map(livro => criarCardObra({
                titulo: livro.titulo, subtitulo: livro.autor, imagem: livro.capaUrl, tipo: "Livro",
                detalhe: livro.anoPublicacao ? `Publicado em ${livro.anoPublicacao.slice(0, 4)}` : "",
                acoes: [{ texto: "Adicionar ao catálogo", acao: botao => salvarLivro(livro, botao, catalogo) }]
            })));
        } catch (err) {
            msg.textContent = "";
            mostrarEstadoVazio(area, { erro: true, titulo: "A busca deu uma pausa", texto: "Não conseguimos procurar livros agora. Tenta de novo em instantes; os livros que já estão aqui continuam logo abaixo." });
        }
    });
}

async function salvarLivro(livro, botao, catalogo) {
    if (!exigirLogin()) return;
    botao.disabled = true; botao.textContent = "Salvando…";
    try {
        await api("/Livro", { method: "POST", body: JSON.stringify({ googleBId: livro.id, titulo: livro.titulo, autor: livro.autor || "Autor não informado", sinopse: livro.sinopse || null, isbn: livro.isbn || null, capaUrl: livro.capaUrl || null }) });
        botao.textContent = "No catálogo";
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
// Filmes: busca de filmes (TMDB, via nossa API), vínculo com livros e catálogo
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
    let modoCadastro = location.hash === "#cadastro";

    // Quem já está logado não precisa desta tela: vai direto para o perfil.
    if (usuarioAtual()) { location.replace("/paginas/perfil.html"); return; }

    const render = () => {
        camposCadastro.hidden = !modoCadastro;
        document.getElementById("nome").required = modoCadastro;
        form.querySelector('button[type="submit"]').textContent = modoCadastro ? "Criar minha conta" : "Entrar";
        document.getElementById("titulo-login").textContent = modoCadastro ? "Bem-vindo(a) à sessão" : "Bora pra sessão";
        document.getElementById("subtitulo-login").textContent = modoCadastro
            ? "Leva menos de um minuto. Depois é só escolher o primeiro livro."
            : "Entre para avaliar, montar sua estante e conversar com a galera.";
        abas.forEach(aba => aba.classList.toggle("ativa", (aba.dataset.modo === "cadastro") === modoCadastro));
    };
    abas.forEach(aba => aba.addEventListener("click", () => { modoCadastro = aba.dataset.modo === "cadastro"; render(); }));
    montarColagemLogin();
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
            // Guarda também o avatar, para o menu já aparecer com a foto.
            try { atualizarSessao({ avatar: (await api("/Usuario/me")).avatar }); } catch { /* sem avatar, ficam as iniciais */ }
            avisar(modoCadastro ? "Conta criada! Bem-vindo(a) ao Resenhário." : `Bem-vindo(a) de volta, ${usuario.nome.split(" ")[0]}!`);
            setTimeout(() => location.href = "/index.html", 700);
        } catch (err) {
            avisar(err.message || "Não foi possível entrar.", "erro");
            botao.disabled = false;
        }
    });
}

// ---------------------------------------------------------------------
// Meu perfil: dados, avatar e o accordion "Conta" com o Sair
// ---------------------------------------------------------------------
const AVATARES_PRONTOS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `/img/avatares/avatar-${n}.svg`);

async function iniciarPerfil() {
    if (!document.getElementById("perfil")) return;
    if (!usuarioAtual()) { location.replace("/paginas/login.html"); return; }

    let perfil;
    try {
        perfil = await api("/Usuario/me");
    } catch (e) {
        avisar(e.message, "erro");
        return;
    }
    const form = document.getElementById("form-perfil");
    const campoNome = document.getElementById("perfil-campo-nome");
    const campoBio = document.getElementById("perfil-campo-bio");
    const campoFavorito = document.getElementById("perfil-campo-favorito");
    const contadorBio = document.getElementById("contador-bio");

    campoNome.value = perfil.nome;
    campoBio.value = perfil.bio || "";
    campoFavorito.value = perfil.livroFavorito || "";
    contadorBio.textContent = `${campoBio.value.length}/280`;
    campoBio.addEventListener("input", () => contadorBio.textContent = `${campoBio.value.length}/280`);
    document.getElementById("perfil-email").textContent = perfil.email;
    renderizarTopoPerfil(perfil);
    renderizarEscolhaAvatar(perfil);

    // Sugestões de livros do catálogo no campo "Livro favorito".
    api("/Livro").then(livros => document.getElementById("lista-livros-perfil")
        .replaceChildren(...livros.map(l => new Option(l.titulo)))).catch(() => {});

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const dados = { nome: campoNome.value.trim(), bio: campoBio.value.trim() || null, livroFavorito: campoFavorito.value.trim() || null };
        try {
            await api("/Usuario/me", { method: "PUT", body: JSON.stringify(dados) });
            Object.assign(perfil, dados);
            atualizarSessao({ nome: dados.nome });
            renderizarTopoPerfil(perfil);
            atualizarLinkConta();
            avisar("Perfil atualizado.");
        } catch (err) { avisar(err.message, "erro"); }
    });

    // Foto enviada: reduzida no navegador antes de ir para o servidor.
    document.getElementById("foto-avatar").addEventListener("change", async e => {
        const arquivo = e.target.files[0];
        e.target.value = "";
        if (!arquivo) return;
        try {
            await salvarAvatar(perfil, await reduzirFoto(arquivo));
            avisar("Foto atualizada.");
        } catch (err) { avisar(err.message || "Não deu para usar essa foto. Tenta outra.", "erro"); }
    });
    document.getElementById("remover-avatar").addEventListener("click", async () => {
        try { await salvarAvatar(perfil, null); avisar("Agora seu avatar são suas iniciais."); }
        catch (err) { avisar(err.message, "erro"); }
    });
    document.getElementById("sair-conta").addEventListener("click", () => {
        sair();
        location.href = "/index.html";
    });
}

function renderizarTopoPerfil(perfil) {
    document.getElementById("perfil-avatar").replaceChildren(criarAvatar(perfil.nome, perfil.avatar));
    document.getElementById("perfil-nome").textContent = perfil.nome;
    document.getElementById("perfil-bio").textContent = perfil.bio || "Conte em uma frase quem você é na sessão.";
    document.getElementById("perfil-bio").classList.toggle("vazio", !perfil.bio);
    const desde = new Date(perfil.dataCadastro + (perfil.dataCadastro.endsWith("Z") ? "" : "Z"));
    document.getElementById("perfil-desde").textContent = `Na sessão desde ${desde.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
    const numeros = [[perfil.totalResenhas, perfil.totalResenhas === 1 ? "resenha" : "resenhas"],
        [perfil.curtidasRecebidas, perfil.curtidasRecebidas === 1 ? "curtida recebida" : "curtidas recebidas"]];
    if (perfil.livroFavorito) numeros.push(["Favorito", perfil.livroFavorito]);
    document.getElementById("perfil-numeros").replaceChildren(...numeros.map(([valor, rotulo]) => {
        const item = el("li");
        item.append(el("strong", "", String(valor)), el("span", "", rotulo));
        return item;
    }));
}

function renderizarEscolhaAvatar(perfil) {
    const area = document.getElementById("avatares");
    area.replaceChildren(...AVATARES_PRONTOS.map((url, i) => {
        const botao = el("button", "avatar-opcao");
        botao.type = "button";
        botao.setAttribute("role", "radio");
        botao.setAttribute("aria-checked", String(perfil.avatar === url));
        botao.setAttribute("aria-label", `Avatar ${i + 1}`);
        const img = el("img");
        img.src = url;
        img.alt = "";
        botao.appendChild(img);
        botao.addEventListener("click", async () => {
            try { await salvarAvatar(perfil, url); avisar("Avatar atualizado."); }
            catch (err) { avisar(err.message, "erro"); }
        });
        return botao;
    }));
}

async function salvarAvatar(perfil, avatar) {
    await api("/Usuario/me/avatar", { method: "PUT", body: JSON.stringify({ avatar }) });
    // Foto enviada: o endereço público muda a cada foto (para o navegador não usar a antiga).
    perfil.avatar = avatar && avatar.startsWith("data:") ? `/api/Usuario/${perfil.idUsuario}/avatar?v=${avatar.length}` : avatar;
    atualizarSessao({ avatar: perfil.avatar });
    renderizarTopoPerfil(perfil);
    renderizarEscolhaAvatar(perfil);
    atualizarLinkConta();
}

// Recorta a foto no centro em formato quadrado e reduz para 256 px (JPEG),
// deixando o arquivo pequeno (algumas dezenas de KB) antes de enviar.
function reduzirFoto(arquivo) {
    return new Promise((resolve, reject) => {
        if (!arquivo.type.startsWith("image/")) return reject(new Error("Escolha um arquivo de imagem."));
        const img = new Image();
        img.onload = () => {
            const lado = Math.min(img.width, img.height);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 256;
            canvas.getContext("2d").drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
            URL.revokeObjectURL(img.src);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("Não deu para abrir essa imagem. Tenta outra."));
        img.src = URL.createObjectURL(arquivo);
    });
}

// Colagem de pôsteres ao lado do login: os filmes do pódio do Top do Resenhário.
async function montarColagemLogin() {
    const colagem = document.getElementById("login-colagem");
    if (!colagem) return;
    try {
        const ranking = (await api("/Adaptacao/ranking")).slice(0, 4);
        colagem.replaceChildren(...ranking.map(item => {
            const quadro = el("div", "login-poster");
            quadro.appendChild(criarCapa(item.posterUrl, item.tituloFilme, "Filme"));
            return quadro;
        }));
    } catch { colagem.hidden = true; } // sem pôsteres, o lado esquerdo continua com o texto
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
        mostrarEstadoVazio(area, { titulo: "Entre para ver sua estante", texto: "Guarde o que quer ler, acompanhe o que está lendo e bata sua meta.", botao: { texto: "Entrar", href: "/paginas/login.html" } });
        return;
    }
    mostrarSkeleton(area, 8);
    try {
        const [itens, perfil] = await Promise.all([api("/Estante"), api("/Usuario/me")]);
        estanteAtual = { itens, perfil };
        renderizarMeta();
        renderizarEstatisticasLeitura(itens);
        configurarFiltrosEstante(area);
        if (!itens.length) {
            mostrarEstadoVazio(area, { titulo: "Sua estante está vazia", texto: "Bora começar? Escolha seu próximo livro.", botao: { texto: "Explorar livros", href: "/paginas/livros.html" } });
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
            renderizarMeta();
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
            if (!itens.length) mostrarEstadoVazio(area, { titulo: "Sua estante está vazia", texto: "Bora começar? Escolha seu próximo livro.", botao: { texto: "Explorar livros", href: "/paginas/livros.html" } });
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
    const numeros = [["Na estante", itens.length], ["Lidos", contar("Lido")], ["Lendo", contar("Lendo")],
        ["Quero ler", contar("Quero ler")], ["Abandonados", contar("Abandonado")]];
    area.replaceChildren(...numeros.map(([rotulo, valor]) => {
        const card = el("article", "estatistica");
        card.append(el("strong", "", String(valor)), el("span", "estatistica-rotulo", rotulo));
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
        const data = dataDaApi(l.dataAtualizacao);
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
    // Com meta definida: linha tracejada com o ritmo mensal da meta (total ÷ 6 meses).
    const meta = estanteAtual?.perfil?.metaLivros;
    if (meta) {
        graficos.meses.data.datasets.push({ type: "line", label: "Ritmo da meta", data: meses.map(() => +(meta / 6).toFixed(1)),
            borderColor: "#ff7a86", borderDash: [6, 6], borderWidth: 2, pointRadius: 0 });
        graficos.meses.options.plugins.legend = { display: true, position: "bottom", labels: { usePointStyle: true } };
        graficos.meses.update();
    }
}

// ---------------------------------------------------------------------
// Meta de leitura: quantos livros ler nos próximos 6 meses
// ---------------------------------------------------------------------
let estanteAtual = null; // { itens, perfil } da página Minha estante

// A API devolve datas em UTC sem o "Z"; acrescentamos para o navegador entender o fuso.
function dataDaApi(iso) { return new Date(/[zZ]$/.test(iso) ? iso : iso + "Z"); }

// Livros marcados como "Lido" a partir de uma data (dataAtualizacao = quando virou "Lido").
function livrosLidosDesde(itens, inicio) {
    return itens.filter(i => i.tipo === "Livro" && i.status === "Lido" && dataDaApi(i.dataAtualizacao) >= inicio).length;
}

function renderizarMeta() {
    const area = document.getElementById("meta-leitura");
    if (!area || !estanteAtual) return;
    const { itens, perfil } = estanteAtual;
    area.hidden = false;
    const seisMesesAtras = new Date(); seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
    const lidosUltimos6 = livrosLidosDesde(itens, seisMesesAtras);
    const textoLidos = n => `${n} ${n === 1 ? "livro" : "livros"}`;

    // Sem meta: convite para começar o desafio.
    if (!perfil.metaLivros) {
        const sugestao = Math.max(3, lidosUltimos6 + 2);
        area.replaceChildren(el("p", "sobretitulo", "Desafio de leitura"),
            el("h2", "", "Quantos livros você quer ler nos próximos 6 meses?"),
            el("p", "texto-suave", lidosUltimos6
                ? `Nos últimos 6 meses você leu ${textoLidos(lidosUltimos6)}. Que tal superar essa marca?`
                : "Escolha um número possível e vá subindo. O importante é começar."),
            criarFormMeta(sugestao));
        return;
    }

    const inicio = dataDaApi(perfil.metaInicio);
    const fim = new Date(inicio); fim.setMonth(fim.getMonth() + 6);
    const lidosNaMeta = livrosLidosDesde(itens, inicio);
    const meta = perfil.metaLivros;
    const porcentagem = Math.min(100, Math.round(lidosNaMeta / meta * 100));
    const diasRestantes = Math.max(0, Math.ceil((fim - new Date()) / 86400000));
    const encerrada = diasRestantes === 0;
    const faltam = Math.max(0, meta - lidosNaMeta);

    let titulo = `${lidosNaMeta} de ${meta} livros`;
    let frase = `Faltam ${textoLidos(faltam)} e ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}. Bora!`;
    if (lidosNaMeta >= meta) { titulo = "Desafio batido!"; frase = `Você leu ${textoLidos(lidosNaMeta)} e passou da meta. Que tal subir a régua?`; }
    else if (encerrada) { titulo = "O desafio acabou"; frase = `Você leu ${textoLidos(lidosNaMeta)} de ${meta}. Bora para o próximo?`; }

    const barra = el("div", "meta-barra");
    barra.setAttribute("role", "progressbar");
    barra.setAttribute("aria-valuemin", "0");
    barra.setAttribute("aria-valuemax", String(meta));
    barra.setAttribute("aria-valuenow", String(lidosNaMeta));
    barra.style.setProperty("--progresso", `${porcentagem}%`);

    // Comparação com os 6 meses anteriores ao início do desafio.
    const antesInicio = new Date(inicio); antesInicio.setMonth(antesInicio.getMonth() - 6);
    const lidosAntes = itens.filter(i => i.tipo === "Livro" && i.status === "Lido"
        && dataDaApi(i.dataAtualizacao) >= antesInicio && dataDaApi(i.dataAtualizacao) < inicio).length;
    const ritmoNecessario = encerrada ? 0 : (faltam / Math.max(1, diasRestantes / 30)).toFixed(1).replace(".", ",");
    const comparacao = el("div", "meta-comparacao");
    [[String(lidosAntes), "lidos nos 6 meses antes do desafio"],
     [String(lidosNaMeta), "lidos desde que você topou"],
     [faltam && !encerrada ? ritmoNecessario : "0", "livros por mês para chegar lá"]].forEach(([valor, rotulo]) => {
        const item = el("div");
        item.append(el("strong", "", valor), el("span", "", rotulo));
        comparacao.appendChild(item);
    });

    const cabecalho = el("div", "meta-cabecalho");
    const textos = el("div");
    textos.append(el("p", "sobretitulo", `Desafio de leitura · até ${fim.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`),
        el("h2", "", titulo), el("p", "texto-suave", frase));
    const mudar = el("button", "botao botao-fantasma botao-pequeno", encerrada || lidosNaMeta >= meta ? "Novo desafio" : "Mudar meta");
    mudar.type = "button";
    const form = criarFormMeta(meta);
    form.hidden = true;
    mudar.addEventListener("click", () => { form.hidden = !form.hidden; });
    cabecalho.append(textos, mudar);
    area.replaceChildren(cabecalho, barra, comparacao, form);
}

function criarFormMeta(valorInicial) {
    const form = el("form", "meta-form");
    const campo = el("input");
    campo.type = "number"; campo.min = "1"; campo.max = "100"; campo.required = true; campo.value = valorInicial;
    campo.setAttribute("aria-label", "Quantidade de livros em 6 meses");
    const botao = el("button", "", "Topar o desafio");
    botao.type = "submit";
    form.append(campo, el("span", "texto-suave", "livros em 6 meses"), botao);
    form.addEventListener("submit", async e => {
        e.preventDefault();
        try {
            await api("/Usuario/me/meta", { method: "PUT", body: JSON.stringify({ metaLivros: Number(campo.value) }) });
            estanteAtual.perfil = await api("/Usuario/me");
            renderizarMeta();
            renderizarEstatisticasLeitura(estanteAtual.itens);
            avisar("Desafio aceito! A contagem começa hoje.");
        } catch (err) { avisar(err.message, "erro"); }
    });
    return form;
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
        adaptacaoSelect.replaceChildren(new Option("Ainda não vi o filme", ""),
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
        if (!idLivro) { avisar("Escolha um livro primeiro.", "erro"); return; }
        if (!notaLivro) { avisar("Faltou dar as estrelas do livro.", "erro"); return; }
        if (idAdaptacao && !notaFidelidade) { avisar("Faltou dizer se o filme foi fiel.", "erro"); return; }
        try {
            await api("/Review", { method: "POST", body: JSON.stringify({ idLivro, idAdaptacao: idAdaptacao || null, notaLivro, comentario: texto, notaFidelidade, assistiuFilme: !!idAdaptacao }) });
            form.reset(); atualizarAdaptacoes();
            estrelasLivro.limpar(); estrelasFidelidade.limpar(); contador.textContent = "0/5000";
            avisar("Resenha no ar! Já está no feed.");
            await carregarUltimasResenhas();
        } catch (err) { avisar(err.message, "erro"); }
    });
    await carregarUltimasResenhas();
}

async function carregarUltimasResenhas() {
    const lista = document.getElementById("ultimas-resenhas");
    if (!lista) return;
    await carregarResenhasEm(lista, { tamanho: 4 });
}

// ---------------------------------------------------------------------
// Feed da comunidade
// ---------------------------------------------------------------------
// Carrega resenhas do feed numa lista. opcoes: { pagina, tamanho, acrescentar, ordem, idAdaptacao, vazio }
async function carregarResenhasEm(lista, opcoes = {}) {
    const { pagina = 1, tamanho = 10, acrescentar = false, ordem = "recentes", idAdaptacao = null } = opcoes;
    if (!acrescentar) mostrarSkeleton(lista, Math.min(tamanho, 4), "resenha");
    try {
        const filtro = idAdaptacao ? `&idAdaptacao=${idAdaptacao}` : "";
        const dados = await api(`/Review/feed?pagina=${pagina}&tamanho=${tamanho}&ordem=${ordem}${filtro}`);
        if (!dados.itens.length && !acrescentar) {
            mostrarEstadoVazio(lista, opcoes.vazio || { titulo: "Ninguém resenhou ainda", texto: "Que tal ser a primeira pessoa a dar a opinião?", botao: { texto: "Escrever resenha", href: "/paginas/reviews.html" } });
            return dados;
        }
        const cards = dados.itens.map(cardResenha);
        if (acrescentar) lista.append(...cards); else lista.replaceChildren(...cards);
        return dados;
    } catch (e) {
        mostrarEstadoVazio(lista, { erro: true, titulo: "Não deu para carregar o feed", texto: e.message });
        return null;
    }
}

function cardResenha(review) {
    const card = el("article", "card-resenha");

    // Topo: avatar, nome, livro e "há 2 horas"
    const topo = el("header", "resenha-topo");
    const quem = el("div", "resenha-quem");
    const linha = el("span", "resenha-acao", "resenhou ");
    linha.append(el("b", "", review.titulo || "um livro"), ` · ${dataRelativa(review.dataCriacao)}`);
    quem.append(el("strong", "", review.nomeUsuario), linha);
    topo.append(criarAvatar(review.nomeUsuario, review.avatarUsuario), quem);

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
    const chipLivro = el("span", "chip chip-livro", "Livro ");
    chipLivro.appendChild(criarEstrelas(review.notaLivro));
    notas.appendChild(chipLivro);
    if (review.tituloFilme && review.notaFidelidade != null) {
        // Mostra o ano só se ele ainda não estiver no título (ex.: "Duna (1984)").
        const ano = review.anoFilme && !review.tituloFilme.includes(String(review.anoFilme)) ? ` (${review.anoFilme})` : "";
        const chipFilme = el("span", "chip chip-filme", `Fidelidade de ${review.tituloFilme}${ano}: `);
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
    card.append(topo, corpo, criarAcoesResenha(review));
    return card;
}

// ---------------------------------------------------------------------
// Interações do feed: curtir, comentar e compartilhar
// ---------------------------------------------------------------------
function criarAcoesResenha(review) {
    const barra = el("div", "resenha-acoes");
    const conversa = el("div", "resenha-conversa");
    conversa.hidden = true;

    // Curtir: muda na hora e desfaz se o servidor recusar.
    const curtir = el("button", "acao");
    curtir.type = "button";
    const contadorCurtidas = el("span", "", String(review.totalCurtidas));
    curtir.append(criarIcone("coracao"), contadorCurtidas);
    const pintarCurtida = () => {
        curtir.setAttribute("aria-pressed", String(review.curtidoPorMim));
        curtir.setAttribute("aria-label", review.curtidoPorMim ? "Descurtir" : "Curtir");
        contadorCurtidas.textContent = String(review.totalCurtidas);
    };
    pintarCurtida();
    curtir.addEventListener("click", async () => {
        if (!exigirLogin()) return;
        const curtindo = !review.curtidoPorMim;
        review.curtidoPorMim = curtindo;
        review.totalCurtidas += curtindo ? 1 : -1;
        pintarCurtida();
        if (curtindo) { curtir.classList.remove("pulsar"); void curtir.offsetWidth; curtir.classList.add("pulsar"); }
        try {
            await api(`/Review/${review.idReviews}/curtida`, { method: curtindo ? "POST" : "DELETE" });
        } catch (e) {
            review.curtidoPorMim = !curtindo;
            review.totalCurtidas += curtindo ? -1 : 1;
            pintarCurtida();
            avisar(e.message, "erro");
        }
    });

    // Comentar: abre e fecha a conversa da resenha.
    const comentar = el("button", "acao");
    comentar.type = "button";
    const contadorComentarios = el("span", "", String(review.totalComentarios));
    comentar.append(criarIcone("balao"), contadorComentarios);
    comentar.setAttribute("aria-expanded", "false");
    comentar.setAttribute("aria-label", "Comentários");
    comentar.addEventListener("click", async () => {
        conversa.hidden = !conversa.hidden;
        comentar.setAttribute("aria-expanded", String(!conversa.hidden));
        if (!conversa.hidden && !conversa.dataset.carregada) {
            conversa.dataset.carregada = "sim";
            await montarConversa(review, conversa, total => contadorComentarios.textContent = String(total));
        }
    });

    // Compartilhar: link do duelo (se a resenha avaliou um filme) ou do feed.
    const compartilhar = el("button", "acao acao-compartilhar");
    compartilhar.type = "button";
    compartilhar.append(criarIcone("compartilhar"), el("span", "", "Compartilhar"));
    compartilhar.addEventListener("click", async () => {
        const link = new URL(review.idAdaptacao ? `/paginas/adaptacao.html?id=${review.idAdaptacao}` : "/paginas/feed.html", location.origin).href;
        const texto = `${review.nomeUsuario.split(" ")[0]} resenhou ${review.titulo} no Resenhário`;
        try {
            if (navigator.share) await navigator.share({ title: "Resenhário", text: texto, url: link });
            else { await navigator.clipboard.writeText(link); avisar("Link copiado! É só colar onde quiser."); }
        } catch { /* a pessoa cancelou o compartilhamento */ }
    });

    barra.append(curtir, comentar, compartilhar);
    const bloco = el("div", "resenha-interacoes");
    bloco.append(barra, conversa);
    return bloco;
}

async function montarConversa(review, area, atualizarTotal) {
    const lista = el("div", "comentarios");
    area.replaceChildren(lista);
    const desenhar = comentarios => {
        if (!comentarios.length) { lista.replaceChildren(el("p", "comentarios-vazio", "Ninguém comentou ainda. Puxa o assunto!")); return; }
        lista.replaceChildren(...comentarios.map(c => criarComentario(c, review, comentarios, desenhar, atualizarTotal)));
    };
    let comentarios = [];
    try {
        comentarios = await api(`/Review/${review.idReviews}/comentarios`);
        desenhar(comentarios);
    } catch (e) { lista.replaceChildren(el("p", "comentarios-vazio", e.message)); }

    if (!usuarioAtual()) {
        const convite = el("a", "comentarios-entrar", "Entre para comentar");
        convite.href = "/paginas/login.html";
        area.appendChild(convite);
        return;
    }
    const form = el("form", "comentario-form");
    const campo = el("input");
    campo.type = "text"; campo.maxLength = 1000; campo.required = true;
    campo.placeholder = "Escreva um comentário…";
    campo.setAttribute("aria-label", "Seu comentário");
    const enviar = el("button", "botao-pequeno", "Enviar");
    enviar.type = "submit";
    form.append(criarAvatar(usuarioAtual().nome, usuarioAtual().avatar), campo, enviar);
    form.addEventListener("submit", async e => {
        e.preventDefault();
        enviar.disabled = true;
        try {
            const novo = await api(`/Review/${review.idReviews}/comentarios`, { method: "POST", body: JSON.stringify({ texto: campo.value }) });
            comentarios.push(novo);
            desenhar(comentarios);
            atualizarTotal(comentarios.length);
            campo.value = "";
        } catch (err) { avisar(err.message, "erro"); }
        finally { enviar.disabled = false; }
    });
    area.appendChild(form);
}

function criarComentario(c, review, comentarios, desenhar, atualizarTotal) {
    const item = el("div", "comentario");
    const balao = el("div", "comentario-balao");
    const cabecalho = el("p", "comentario-autor");
    cabecalho.append(el("strong", "", c.nomeUsuario), ` · ${dataRelativa(c.dataCriacao)}`);
    balao.append(cabecalho, el("p", "", c.texto));
    if (c.ehMeu) {
        const apagar = el("button", "comentario-apagar", "Apagar");
        apagar.type = "button";
        apagar.addEventListener("click", async () => {
            try {
                await api(`/Review/${review.idReviews}/comentarios/${c.idComentario}`, { method: "DELETE" });
                comentarios.splice(comentarios.indexOf(c), 1);
                desenhar(comentarios);
                atualizarTotal(comentarios.length);
            } catch (err) { avisar(err.message, "erro"); }
        });
        balao.appendChild(apagar);
    }
    item.append(criarAvatar(c.nomeUsuario, c.avatarUsuario), balao);
    return item;
}

// Comparativo entre leitores: a nota desta pessoa × a média da comunidade para o mesmo livro.
function criarComparativo(review) {
    const caixa = el("p", "resenha-comparativo");
    const primeiroNome = review.nomeUsuario.split(" ")[0];
    if (review.totalResenhasLivro <= 1 || review.mediaNotaLivro == null) {
        caixa.textContent = "Primeira resenha deste livro na comunidade";
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
    let pagina = 1, ordem = "recentes";

    const carregar = async (acrescentar = false) => {
        const dados = await carregarResenhasEm(lista, { pagina, tamanho: 10, acrescentar, ordem });
        botaoMais.hidden = !dados || pagina >= dados.totalPaginas;
    };
    // Abas "Mais recentes" / "Mais curtidas"
    document.querySelectorAll(".aba-feed").forEach(aba => aba.addEventListener("click", () => {
        document.querySelectorAll(".aba-feed").forEach(a => a.setAttribute("aria-selected", String(a === aba)));
        ordem = aba.dataset.ordem;
        pagina = 1;
        carregar();
    }));
    botaoMais.addEventListener("click", async () => {
        botaoMais.disabled = true;
        pagina++;
        await carregar(true);
        botaoMais.disabled = false;
    });
    await carregar();
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

    lugar.append(imagens,
        el("h3", "", item.tituloFilme),
        el("p", "podio-sub", `do livro de ${item.autorLivro}`),
        nota,
        el("div", "podio-degrau"));
    return lugar;
}
