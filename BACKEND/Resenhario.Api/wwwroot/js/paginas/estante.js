// =====================================================================
// estante.js: Minha estante: itens, status de leitura, estatísticas, gráficos e desafio de leitura.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

const STATUS_LIVRO = ["Quero ler", "Lendo", "Lido", "Abandonado"];

const STATUS_FILME = ["Quero ver", "Assistindo", "Assistido"];

let estanteAtual = null; // { itens, perfil } da página Minha estante

// Gráficos da estante com Chart.js. Guardamos os gráficos para recriá-los
// quando o status de um livro muda (destroy + new é o jeito mais simples).
const graficos = {};

// Filtros da prateleira: Todos, cada status de leitura ou só filmes.
let filtroEstante = "todos";

const ESTANTE_VAZIA = { titulo: "Sua estante está vazia", texto: "Bora começar? Escolha seu próximo livro.", botao: { texto: "Explorar livros", href: "/paginas/livros.html" } };

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
            mostrarEstadoVazio(area, ESTANTE_VAZIA);
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
            if (!itens.length) mostrarEstadoVazio(area, ESTANTE_VAZIA);
        } catch (err) { remover.disabled = false; avisar(err.message, "erro"); }
    });
    acoes.append(select, remover);
    return card;
}

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

// O Chart.js vem do arquivo wwwroot/lib/chart.umd.min.js (carregado no estante.html).
function renderizarGraficos(livros) {
    const canvasStatus = document.getElementById("grafico-status");
    if (!canvasStatus || !window.Chart) return;
    // Visual dos gráficos combinando com o tema escuro do site.
    Chart.defaults.color = "#b3a998";
    Chart.defaults.borderColor = "rgba(255, 255, 255, .07)";
    Chart.defaults.font.family = "Barlow, system-ui, sans-serif";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) Chart.defaults.animation = false;

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
            datasets: [{ label: "Livros lidos", data: meses.map(lidosNoMes), backgroundColor: "#f2b33d", hoverBackgroundColor: "#ffd27a", borderRadius: 2, maxBarThickness: 42 }]
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

// ----- Desafio de leitura: quantos livros ler nos próximos 6 meses -----

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

document.addEventListener("DOMContentLoaded", iniciarEstante);
