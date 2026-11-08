// =====================================================================
// perfil.js: Meu perfil: dados, avatar (pronto ou foto). O "Sair da conta" fica no menu "Olá, Nome" (ui.js).
// Depende de api.js (chamadas à API) e ui.js (componentes visuais).
// =====================================================================

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
}

function renderizarTopoPerfil(perfil) {
    document.getElementById("perfil-avatar").replaceChildren(criarAvatar(perfil.nome, perfil.avatar));
    document.getElementById("perfil-nome").textContent = perfil.nome;
    document.getElementById("perfil-bio").textContent = perfil.bio || "Conte em uma frase quem você é na sessão.";
    document.getElementById("perfil-bio").classList.toggle("vazio", !perfil.bio);
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

document.addEventListener("DOMContentLoaded", iniciarPerfil);
