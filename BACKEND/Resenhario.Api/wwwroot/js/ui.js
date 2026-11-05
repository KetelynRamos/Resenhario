// =====================================================================
// ui.js: componentes visuais reutilizáveis (cards, capas, avisos,
// carregamento, estados vazios, estrelas, datas). Não fala com a API:
// só recebe dados e devolve elementos HTML prontos.
// =====================================================================

// Cria um elemento com classe e texto em uma linha.
// Usamos textContent (e não innerHTML) para o texto do usuário nunca virar HTML.
function el(tag, classe = "", texto = "") {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== "" && texto != null) elemento.textContent = texto;
    return elemento;
}

// ----- Cabeçalho: menu do celular, link ativo e nome do usuário ------
function configurarCabecalho() {
    const botao = document.querySelector(".menu-botao");
    const menu = document.getElementById("menu");
    botao?.addEventListener("click", () => {
        const aberto = menu.classList.toggle("aberto");
        botao.setAttribute("aria-expanded", String(aberto));
    });

    // Destaca no menu a página atual.
    const atual = location.pathname === "/" ? "/index.html" : location.pathname;
    document.querySelectorAll("#menu a").forEach(link => {
        if (new URL(link.href).pathname === atual) link.classList.add("ativo");
    });

    // Troca "Entrar" pelo primeiro nome de quem está logado.
    const usuario = usuarioAtual();
    const linkConta = document.querySelector("#menu .link-conta");
    if (usuario && linkConta) linkConta.textContent = `Olá, ${usuario.nome.split(" ")[0]}`;
}

// ----- Avisos (toasts): substituem o alert() -----------------------
function avisar(mensagem, tipo = "sucesso") {
    let area = document.getElementById("avisos");
    if (!area) {
        area = el("div", "avisos");
        area.id = "avisos";
        area.setAttribute("aria-live", "polite");
        document.body.appendChild(area);
    }
    const aviso = el("div", `aviso aviso-${tipo}`, mensagem);
    area.appendChild(aviso);
    setTimeout(() => aviso.classList.add("saindo"), 3200);
    setTimeout(() => aviso.remove(), 3600);
}

// ----- Capas e pôsteres --------------------------------------------
// Gera uma cor (matiz) a partir do título, para cada placeholder ter um tom diferente.
function matizDoTexto(texto) {
    let soma = 0;
    for (const letra of texto || "") soma = (soma * 31 + letra.charCodeAt(0)) % 360;
    return soma;
}

// Placeholder bonito quando a obra não tem imagem (ou a imagem falha).
function criarPlaceholder(titulo, tipo) {
    const div = el("div", `capa-placeholder capa-${tipo === "Filme" ? "filme" : "livro"}`);
    div.style.setProperty("--matiz", matizDoTexto(titulo));
    div.append(el("span", "capa-placeholder-tipo", tipo === "Filme" ? "🎬 Filme" : "📖 Livro"),
        el("strong", "", titulo || "Sem título"));
    return div;
}

// Imagem de capa/pôster com troca automática para o placeholder se der erro.
function criarCapa(url, titulo, tipo = "Livro") {
    if (!url) return criarPlaceholder(titulo, tipo);
    const img = el("img", "capa-img");
    img.src = url;
    img.alt = `${tipo === "Filme" ? "Pôster" : "Capa"} de ${titulo}`;
    img.loading = "lazy";
    img.onerror = () => img.replaceWith(criarPlaceholder(titulo, tipo));
    return img;
}

// Card de obra (livro ou filme) usado nas grades e carrosséis.
// item: { titulo, subtitulo, detalhe, imagem, tipo, acoes: [{ texto, acao, secundario }] }
function criarCardObra(item) {
    const card = el("article", "card-obra");
    const moldura = el("div", "card-obra-capa");
    moldura.appendChild(criarCapa(item.imagem, item.titulo, item.tipo));
    const info = el("div", "card-obra-info");
    info.append(el("h3", "", item.titulo || "Sem título"));
    if (item.subtitulo) info.append(el("p", "card-obra-sub", item.subtitulo));
    if (item.detalhe) info.append(el("p", "card-obra-detalhe", item.detalhe));
    const acoes = el("div", "card-obra-acoes");
    (item.acoes || []).forEach(a => {
        const botao = el("button", a.secundario ? "botao botao-fantasma botao-pequeno" : "botao botao-pequeno", a.texto);
        botao.type = "button";
        botao.addEventListener("click", () => a.acao(botao));
        acoes.appendChild(botao);
    });
    info.appendChild(acoes);
    card.append(moldura, info);
    return card;
}

// ----- Carregamento (skeleton) e estados vazios ---------------------
// Mostra cards "fantasmas" piscando enquanto os dados chegam.
function mostrarSkeleton(container, quantidade = 6, formato = "obra") {
    container.replaceChildren();
    for (let i = 0; i < quantidade; i++) {
        const card = el("div", `skeleton skeleton-${formato}`);
        card.setAttribute("aria-hidden", "true");
        container.appendChild(card);
    }
}

// Mensagem amigável para listas vazias ou erros.
// opcoes: { icone, titulo, texto, botao: { texto, href } , erro }
function mostrarEstadoVazio(container, opcoes) {
    const caixa = el("div", `estado-vazio${opcoes.erro ? " estado-erro" : ""}`);
    caixa.append(el("span", "estado-vazio-icone", opcoes.icone || (opcoes.erro ? "⚠️" : "🎞️")),
        el("h3", "", opcoes.titulo), el("p", "", opcoes.texto || ""));
    if (opcoes.botao) {
        const link = el("a", "botao", opcoes.botao.texto);
        link.href = opcoes.botao.href;
        caixa.appendChild(link);
    }
    container.replaceChildren(caixa);
}

// ----- Notas, estrelas e datas --------------------------------------
// Formata uma média (ex.: 4.333 -> "4,3"); sem avaliações mostra "—".
function formatarMedia(valor) {
    return valor == null ? "—" : Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Estrelas só para exibir (ex.: 4 -> ★★★★☆), com texto para leitores de tela.
function criarEstrelas(nota, classe = "") {
    const n = Math.round(Number(nota) || 0);
    const span = el("span", `estrelas ${classe}`.trim(), "★".repeat(n) + "☆".repeat(5 - n));
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", `${n} de 5 estrelas`);
    return span;
}

// "há 2 horas", "há 3 dias"... usando o formatador nativo do navegador.
function dataRelativa(dataIso) {
    // A API devolve datas em UTC sem o "Z" no final; adicionamos para o navegador entender.
    const data = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(dataIso) ? dataIso : dataIso + "Z");
    const segundos = Math.round((data - new Date()) / 1000);
    const formatador = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
    const unidades = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unidade, tamanho] of unidades) {
        if (Math.abs(segundos) >= tamanho) return formatador.format(Math.round(segundos / tamanho), unidade);
    }
    return "agora mesmo";
}

// Avatar com as iniciais do nome e uma cor própria para cada pessoa.
function criarAvatar(nome) {
    const partes = (nome || "?").trim().split(/\s+/);
    const iniciais = (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
    const avatar = el("span", "avatar", iniciais);
    avatar.style.setProperty("--matiz", matizDoTexto(nome));
    avatar.setAttribute("aria-hidden", "true");
    return avatar;
}

// ----- Seletor de estrelas (formulário de resenha) -------------------
// São 5 radio buttons (um por nota) estilizados como estrelas. Ficam em ordem
// invertida (5 → 1) para o CSS conseguir "acender" as estrelas anteriores com o seletor ~.
function criarSeletorEstrelas(nome, legendas) {
    const grupo = el("div", "seletor-estrelas");
    grupo.setAttribute("role", "radiogroup");
    const legenda = el("span", "estrelas-legenda", "Escolha de 1 a 5 estrelas");
    for (let valor = 5; valor >= 1; valor--) {
        const radio = el("input", "sr-only");
        radio.type = "radio";
        radio.name = nome;
        radio.id = `${nome}-${valor}`;
        radio.value = valor;
        radio.addEventListener("change", () => legenda.textContent = `${valor}/5 · ${legendas[valor - 1]}`);
        const rotulo = el("label", "", "★");
        rotulo.htmlFor = radio.id;
        rotulo.title = `${valor} de 5: ${legendas[valor - 1]}`;
        grupo.append(radio, rotulo);
    }
    const caixa = el("div", "seletor-estrelas-caixa");
    caixa.append(grupo, legenda);
    caixa.limpar = () => legenda.textContent = "Escolha de 1 a 5 estrelas";
    return caixa;
}

// Valor escolhido num seletor de estrelas (ou null se nenhum).
function valorEstrelas(nome) {
    const marcado = document.querySelector(`input[name="${nome}"]:checked`);
    return marcado ? Number(marcado.value) : null;
}

// ----- Chart.js: CDN com plano B local --------------------------------
// Tenta o CDN (cdnjs); se a internet falhar, usa a cópia da mesma versão em /lib.
const CHART_JS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
const CHART_JS_LOCAL = "/lib/chart.umd.min.js";

function carregarScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function carregarChartJs() {
    if (window.Chart) return true;
    try { await carregarScript(CHART_JS_CDN); }
    catch { try { await carregarScript(CHART_JS_LOCAL); } catch { return false; } }
    if (!window.Chart) return false;
    // Visual padrão dos gráficos combinando com o tema escuro do site.
    Chart.defaults.color = "#b3a998";
    Chart.defaults.borderColor = "rgba(255, 255, 255, .07)";
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) Chart.defaults.animation = false;
    return true;
}

// ----- Setas dos carrosséis (no celular basta arrastar com o dedo) --
function configurarCarrosseis() {
    document.querySelectorAll(".carrossel").forEach(carrossel => {
        const moldura = el("div", "carrossel-moldura");
        carrossel.parentNode.insertBefore(moldura, carrossel);
        moldura.appendChild(carrossel);
        [["‹", -1, "anterior"], ["›", 1, "seta-proxima"]].forEach(([simbolo, direcao, classe]) => {
            const seta = el("button", `seta-carrossel ${classe}`, simbolo);
            seta.type = "button";
            seta.setAttribute("aria-label", direcao < 0 ? "Voltar" : "Avançar");
            // Rola 80% da largura visível do carrossel.
            seta.addEventListener("click", () => carrossel.scrollBy({ left: direcao * carrossel.clientWidth * .8, behavior: "smooth" }));
            moldura.appendChild(seta);
        });
    });
}

// ----- Card "Livro vs. Filme": o diferencial do Resenhário ----------
// Recebe uma adaptação (da rota /api/Adaptacao ou /api/Adaptacao/ranking) e mostra
// capa × pôster lado a lado com a nota média do livro e a fidelidade média do filme.

// Frase curta que resume a fidelidade para quem está assistindo à apresentação.
function vereditoFidelidade(media) {
    if (media == null) return "Ainda sem notas de fidelidade";
    if (media >= 4.5) return "Adaptação muito fiel";
    if (media >= 3.5) return "Fiel no essencial";
    if (media >= 2.5) return "Toma várias liberdades";
    return "Quase outra história";
}

// Bloco de uma nota: rótulo, número grande, barra proporcional (0 a 5) e contagem.
function criarBlocoNota(rotulo, media, total, singular, plural, classe) {
    const bloco = el("div", `nota-bloco ${classe}`);
    const barra = el("span", "nota-barra");
    barra.style.setProperty("--valor", `${((media || 0) / 5) * 100}%`);
    bloco.append(el("span", "nota-rotulo", rotulo), el("strong", "nota-valor", formatarMedia(media)), barra,
        el("small", "", `${total} ${total === 1 ? singular : plural}`));
    return bloco;
}

function criarDuelo(item, destaque = false) {
    const card = el("article", `duelo${destaque ? " duelo-destaque" : ""}`);

    const imagens = el("div", "duelo-imagens");
    const livro = el("figure", "duelo-capa duelo-livro");
    livro.append(criarCapa(item.capaUrl, item.tituloLivro, "Livro"), el("figcaption", "", "Livro"));
    const filme = el("figure", "duelo-capa duelo-filme");
    filme.append(criarCapa(item.posterUrl, item.tituloFilme, "Filme"), el("figcaption", "", "Filme"));
    imagens.append(livro, el("span", "duelo-vs", "vs"), filme);

    const info = el("div", "duelo-info");
    const filmeTexto = [item.tituloFilme, item.anoLancamento && `(${item.anoLancamento})`].filter(Boolean).join(" ");
    info.append(
        el("p", "duelo-veredito", vereditoFidelidade(item.mediaFidelidade)),
        el("h3", "", item.tituloLivro),
        el("p", "duelo-sub", `${item.autorLivro || ""} → ${filmeTexto}${item.diretor ? `, de ${item.diretor}` : ""}`));
    const notas = el("div", "duelo-notas");
    notas.append(
        criarBlocoNota("📖 Nota do livro", item.mediaNotaLivro, item.totalResenhasLivro, "resenha", "resenhas", "nota-livro"),
        criarBlocoNota("🎬 Fidelidade do filme", item.mediaFidelidade, item.totalAvaliacoes, "avaliação", "avaliações", "nota-filme"));
    info.appendChild(notas);

    card.append(imagens, info);
    return card;
}

document.addEventListener("DOMContentLoaded", () => { configurarCabecalho(); configurarCarrosseis(); });
