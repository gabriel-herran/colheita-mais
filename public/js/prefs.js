'use strict';

// Preferências de aparência e acessibilidade (janela "Configurações").
// Este arquivo é carregado no <head> de todas as páginas, ANTES do CSS ser
// aplicado, para que o modo escuro não "pisque" branco ao trocar de página.

(function () {
  const CHAVE = 'colheita:prefs';
  const PADRAO = {
    tema: 'claro',        // 'claro' | 'escuro' | 'sistema'
    zoom: 90,             // zoom da tela em % (barra deslizante: 70 a 150)
    negrito: false,       // engrossar as escritas
    contraste: false,     // alto contraste
    espacamento: false,   // mais espaço entre letras e linhas
    foco: false,          // destacar foco do teclado e sublinhar links
    semAnimacao: false,   // reduzir animações
    leitura: false,       // botão para ler o texto selecionado em voz alta
  };

  function ler() {
    try {
      return { ...PADRAO, ...(JSON.parse(localStorage.getItem(CHAVE)) || {}) };
    } catch (_) {
      return { ...PADRAO };
    }
  }

  const escuroSistema = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function aplicar(p = ler()) {
    const html = document.documentElement;
    const escuro = p.tema === 'escuro' || (p.tema === 'sistema' && escuroSistema && escuroSistema.matches);
    html.classList.toggle('tema-escuro', !!escuro);
    html.style.colorScheme = escuro ? 'dark' : 'light';
    html.classList.toggle('a11y-negrito', !!p.negrito);
    html.classList.toggle('a11y-contraste', !!p.contraste);
    html.classList.toggle('a11y-espacamento', !!p.espacamento);
    html.classList.toggle('a11y-foco', !!p.foco);
    html.classList.toggle('a11y-sem-animacao', !!p.semAnimacao);
    const zoom = Math.min(150, Math.max(70, Number(p.zoom) || PADRAO.zoom));
    html.style.zoom = zoom !== 100 ? zoom / 100 : '';
    document.dispatchEvent(new CustomEvent('prefs-alteradas', { detail: p }));
  }

  function salvar(parcial) {
    const p = { ...ler(), ...parcial };
    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (_) {}
    aplicar(p);
    return p;
  }

  function restaurar() {
    try { localStorage.removeItem(CHAVE); } catch (_) {}
    aplicar(PADRAO);
    return { ...PADRAO };
  }

  if (escuroSistema && escuroSistema.addEventListener) {
    escuroSistema.addEventListener('change', () => aplicar());
  }

  window.ColheitaPrefs = { ler, salvar, restaurar, aplicar, PADRAO };
  aplicar();
})();
