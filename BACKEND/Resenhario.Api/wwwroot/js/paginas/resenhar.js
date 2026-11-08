// =====================================================================
// resenhar.js: Resenhar: formulário com avaliação dupla (nota do livro + fidelidade do filme).
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

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

    // Vindo da página de um duelo (reviews.html?livro=5&adaptacao=7): já deixa livro e filme escolhidos.
    const parametros = new URLSearchParams(location.search);
    if (parametros.get("livro")) {
        livroSelect.value = parametros.get("livro");
        atualizarAdaptacoes();
        if (parametros.get("adaptacao")) {
            adaptacaoSelect.value = parametros.get("adaptacao");
            campoFidelidade.hidden = !adaptacaoSelect.value;
        }
    }

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

document.addEventListener("DOMContentLoaded", iniciarResenhas);
