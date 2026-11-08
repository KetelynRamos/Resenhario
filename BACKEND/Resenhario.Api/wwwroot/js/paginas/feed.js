// =====================================================================
// feed.js: Feed da comunidade: abas Mais recentes / Mais curtidas e "carregar mais".
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

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

document.addEventListener("DOMContentLoaded", iniciarFeed);
