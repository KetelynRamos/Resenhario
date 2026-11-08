// =====================================================================
// livros.js: Livros: busca (Google Books, via nossa API) e catálogo.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

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

document.addEventListener("DOMContentLoaded", iniciarPaginaLivros);
