// =====================================================================
// api.js: comunicação do front com a API do Resenhário (fetch + JSON)
// Carregado antes de ui.js e script.js em todas as páginas.
// =====================================================================

// Caminho relativo: o front é servido pela própria API (wwwroot), então
// funciona em qualquer porta ou servidor sem precisar de CORS.
const API_URL = "/api";
const SESSION_KEY = "resenhario_usuario";

// Usuário logado (nome, e-mail e token JWT) guardado no localStorage.
function usuarioAtual() {
    try {
        const usuario = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        // Remove a sessão antiga, que guardava somente o ID e não possuía token assinado.
        if (usuario && !usuario.token) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return usuario;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

function sair() {
    localStorage.removeItem(SESSION_KEY);
}

// Função central de chamadas: envia o token, converte JSON e transforma
// respostas de erro (400, 401, 404, 409, 500...) em mensagens legíveis.
async function api(caminho, opcoes = {}) {
    const usuario = usuarioAtual();
    const headers = { "Content-Type": "application/json", ...(opcoes.headers || {}) };
    if (usuario?.token) headers.Authorization = `Bearer ${usuario.token}`;

    let resposta;
    try {
        resposta = await fetch(`${API_URL}${caminho}`, { ...opcoes, headers });
    } catch {
        throw new Error("Não foi possível falar com o servidor. Confira se a API está ligada.");
    }

    if (!resposta.ok) {
        const texto = await resposta.text();
        let mensagem = texto || `Erro HTTP ${resposta.status}`;
        try {
            const json = JSON.parse(texto);
            // Erros de validação (Data Annotations) chegam como { errors: { campo: [mensagens] } }.
            const errosValidacao = json.errors ? Object.values(json.errors).flat() : [];
            mensagem = json.mensagem || errosValidacao.join(" ") || json.detail || json.title || json.message || texto;
        } catch { /* A resposta pode ser texto simples. */ }
        if (resposta.status === 401) {
            // Token ausente ou expirado: limpa a sessão e explica o que fazer.
            if (usuario?.token) sair();
            mensagem = "Sua sessão expirou ou você não entrou na conta. Faça login para continuar.";
        }
        throw new Error(mensagem);
    }
    if (resposta.status === 204) return null;
    const texto = await resposta.text();
    return texto ? JSON.parse(texto) : null;
}

// Garante que há alguém logado antes de ações que exigem conta.
function exigirLogin() {
    const usuario = usuarioAtual();
    if (!usuario?.token) {
        avisar("Entre ou crie uma conta para continuar.", "erro");
        setTimeout(() => location.href = "/paginas/login.html", 1200);
        return null;
    }
    return usuario;
}
