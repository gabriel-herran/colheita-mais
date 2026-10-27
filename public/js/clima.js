'use strict';

// Tela de clima: condição atual e previsão de domingo a sábado para a
// cidade escolhida na lista.

const selCidade = document.getElementById('selCidade');
const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Lista de cidades agrupadas por estado
const porUF = {};
CIDADES.forEach((c) => (porUF[c.uf] = porUF[c.uf] || []).push(c));
selCidade.innerHTML = Object.keys(porUF).map((uf) => `
  <optgroup label="${uf}">
    ${porUF[uf].map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)} - ${uf}</option>`).join('')}
  </optgroup>`).join('');
selCidade.value = cidadeSelecionada().id;

selCidade.addEventListener('change', () => {
  salvarCidade(selCidade.value);
  carregar();
});

async function carregar() {
  const cidade = cidadeSelecionada();
  document.getElementById('nomeCidade').textContent = `${cidade.nome} - ${cidade.uf}`;
  const agora = document.getElementById('climaAgora');
  const grid = document.getElementById('semanaGrid');
  agora.innerHTML = '<p class="reg-empty">Carregando...</p>';
  grid.innerHTML = '';

  let dados;
  try {
    dados = await buscarClima(cidade);
  } catch (err) {
    agora.innerHTML = `<p class="reg-empty">${escapeHtml(err.message)} Verifique a conexão com a internet.</p>`;
    return;
  }

  const c = dados.current;
  const { desc } = descreverTempo(c.weather_code);
  agora.innerHTML = `
    ${iconeClima(c.weather_code, 'ca-ico')}
    <div>
      <div class="ca-temp">${Math.round(c.temperature_2m)}°C</div>
      <div class="ca-desc">${escapeHtml(desc)}</div>
      <div class="ca-extra">
        <span>Sensação: ${Math.round(c.apparent_temperature)}°C</span>
        <span>${icone('gota')} Umidade: ${Math.round(c.relative_humidity_2m)}%</span>
        <span>${icone('vento')} Vento: ${Math.round(c.wind_speed_10m)} km/h</span>
      </div>
    </div>`;

  const d = dados.daily;
  const { inicio, fim } = semanaAtual();
  document.getElementById('periodoSemana').textContent = `(${fmtData(inicio)} a ${fmtData(fim)})`;
  const hojeIso = isoLocal();
  grid.innerHTML = d.time.map((dia, i) => {
    const max = d.temperature_2m_max[i];
    const min = d.temperature_2m_min[i];
    const media = (max + min) / 2;
    const info = descreverTempo(d.weather_code[i]);
    const chuva = d.precipitation_probability_max[i];
    const data = new Date(dia + 'T12:00:00');
    return `
      <div class="dia-clima ${dia === hojeIso ? 'hoje' : ''}" style="background:${corTemperatura(media)}"
           aria-label="${NOMES_DIAS[data.getDay()]}: ${info.desc}, máxima ${Math.round(max)} e mínima ${Math.round(min)} graus">
        <span class="dc-dia">${NOMES_DIAS[data.getDay()]}${dia === hojeIso ? ' (hoje)' : ''}</span>
        <span class="dc-data">${fmtData(dia).slice(0, 5)}</span>
        ${iconeClima(d.weather_code[i], 'dc-ico')}
        <span class="dc-desc">${escapeHtml(info.desc)}</span>
        <span class="dc-max">${Math.round(max)}°</span>
        <span class="dc-min">mín. ${Math.round(min)}°</span>
        ${chuva != null ? `<span class="dc-chuva">${icone('gota')} ${chuva}%</span>` : ''}
      </div>`;
  }).join('');
}

carregar();
