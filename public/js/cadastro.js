'use strict';

const form = document.getElementById('formCadastro');
const msg = document.getElementById('msg');

function showMsg(text, ok = false) {
  msg.textContent = text;
  msg.className = 'form-msg show ' + (ok ? 'ok' : 'error');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.className = 'form-msg';

  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const confirmarSenha = document.getElementById('confirmarSenha').value;

  if (!nome || !email || !senha || !confirmarSenha) {
    return showMsg('Preencha todos os campos.');
  }
  if (senha.length < 6) {
    return showMsg('A senha deve ter ao menos 6 caracteres.');
  }
  if (senha !== confirmarSenha) {
    return showMsg('As senhas não coincidem.');
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha, confirmarSenha }),
    });
    showMsg('Cadastro concluído! Redirecionando...', true);
    setTimeout(() => (window.location.href = '/home.html'), 800);
  } catch (err) {
    showMsg(err.message);
    btn.disabled = false;
  }
});
