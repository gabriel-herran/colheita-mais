'use strict';

// Janela de cadastro / edição de produção, usada na tela principal e na
// tela "Produções". No cadastro a propriedade é escolhida numa lista
// obrigatória; na edição ela fica travada (a produção continua onde está).

const FormProducao = (() => {
  const modal = document.getElementById('modalProducao');
  const form = document.getElementById('formProducao');
  const msg = document.getElementById('prodMsg');
  const selProp = document.getElementById('pPropriedade');
  let aoSalvar = () => {};

  function erro(texto) {
    msg.textContent = texto;
    msg.className = 'form-msg show error';
  }

  async function carregarPropriedades(selecionada) {
    let lista = [];
    try { lista = await api('/api/propriedades'); } catch (err) { toast(err.message, true); }
    selProp.innerHTML = '<option value="">Selecione uma propriedade...</option>' +
      lista.map((p) => `<option value="${p.id_propriedade}">${escapeHtml(p.nome_propriedade)}</option>`).join('');
    if (selecionada) selProp.value = String(selecionada);
    return lista;
  }

  // id = produção a editar (ou null para cadastrar); propriedade = sugestão inicial
  async function abrir(id = null, { propriedade = null, dados = null } = {}) {
    msg.className = 'form-msg';
    form.dataset.editId = id || '';
    document.getElementById('tModalProducao').textContent = id ? 'Editar Produção' : 'Cadastrar Produção';
    document.getElementById('prodSubmit').textContent = id ? 'Salvar alterações' : 'Cadastrar produção';
    const lista = await carregarPropriedades(propriedade);

    if (id) {
      let p = dados;
      if (!p) {
        try { p = await api('/api/producoes/' + id); } catch (err) { return toast(err.message, true); }
      }
      [...form.elements].forEach((el) => {
        if (!el.name || el.name === 'propriedade') return;
        let v = p[el.name] == null ? '' : String(p[el.name]);
        if (el.type === 'date') v = v.slice(0, 10);
        if (el.name === 'area_plantada' && v) v = v.replace('.', ',');
        el.value = v;
      });
      selProp.value = String(p.id_propriedade || propriedade || '');
      selProp.disabled = true;
      persistirCampos(form, 'editar-producao-' + id);
    } else {
      selProp.disabled = false;
      [...form.elements].forEach((el) => { if (el.name && el.name !== 'propriedade') el.value = ''; });
      persistirCampos(form, 'nova-producao');
      // Sugestão (propriedade selecionada na tela) só se o rascunho não tiver outra
      if (!selProp.value && propriedade) selProp.value = String(propriedade);
      if (!form.data_inicio.value) form.data_inicio.value = isoLocal();
      if (!lista.length) erro('Cadastre uma propriedade antes de cadastrar uma produção.');
    }
    abrirModal(modal, { id: id || null });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    const dados = Object.fromEntries([...form.elements].filter((el) => el.name).map((el) => [el.name, el.value.trim()]));
    const editId = Number(form.dataset.editId) || null;
    if (!editId && !dados.propriedade) return erro('Selecione a propriedade da produção.');
    if (!dados.nome_producao) return erro('O nome da produção é obrigatório.');
    if (!dados.conteudo_producao) return erro('Informe o que é produzido.');
    const btn = document.getElementById('prodSubmit');
    btn.disabled = true;
    try {
      let salvo;
      if (editId) {
        salvo = await api('/api/producoes/' + editId, { method: 'PUT', body: JSON.stringify(dados) });
        limparCampos(form, 'editar-producao-' + editId);
        toast('Produção atualizada!');
      } else {
        salvo = await api(`/api/propriedades/${encodeURIComponent(dados.propriedade)}/producoes`, { method: 'POST', body: JSON.stringify(dados) });
        limparCampos(form, 'nova-producao');
        toast('Produção cadastrada!');
        // A produção nova passa a ser a selecionada nas telas de gestão
        SelecaoGestao.salvar({ propriedade: Number(dados.propriedade), producao: salvo.id_producao });
      }
      fecharModal(modal);
      aoSalvar(salvo, !editId);
    } catch (err) {
      erro(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  return {
    abrir,
    aoSalvar(fn) { aoSalvar = fn; },
    // Reabre a janela se ela estava aberta quando o produtor saiu da tela
    restaurar(propriedade) {
      const salvo = modalSalvo();
      if (salvo && salvo.id === 'modalProducao') abrir(salvo.ctx && salvo.ctx.id, { propriedade });
    },
  };
})();
