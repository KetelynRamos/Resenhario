// =====================================================================
// resenhas.js: Resenhas do feed: card da resenha e as interações (curtir, comentar, compartilhar).
// Usado no início, no feed, no Resenhar e na página do duelo.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

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
    // Resenha que avaliou um filme: o nome do livro leva ao duelo Livro vs. Filme.
    const nomeLivro = review.idAdaptacao ? el("a", "", review.titulo) : el("b", "", review.titulo || "um livro");
    if (review.idAdaptacao) nomeLivro.href = `/paginas/adaptacao.html?id=${review.idAdaptacao}`;
    linha.append(nomeLivro, ` · ${dataRelativa(review.dataCriacao)}`);
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

// ----- Interações: curtir, comentar e compartilhar -----

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
