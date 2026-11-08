// =====================================================================
// login.js: Entrar e criar conta.
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

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

document.addEventListener("DOMContentLoaded", iniciarLogin);
