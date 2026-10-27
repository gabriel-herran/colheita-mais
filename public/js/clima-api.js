'use strict';

// Previsão do tempo via Open-Meteo (https://open-meteo.com) — gratuita e sem chave.
// Usado pela tela "Clima" e pelo resumo da tela principal.

const CIDADES = [
  // [UF, nome, latitude, longitude]
  ['SP', 'São José do Rio Preto', -20.8113, -49.3758], ['SP', 'Araçatuba', -21.2089, -50.4328],
  ['SP', 'Araraquara', -21.7845, -48.178], ['SP', 'Barretos', -20.5572, -48.5678],
  ['SP', 'Bauru', -22.3147, -49.0606], ['SP', 'Bebedouro', -20.9494, -48.4792],
  ['SP', 'Campinas', -22.9056, -47.0608], ['SP', 'Catanduva', -21.1378, -48.9728],
  ['SP', 'Fernandópolis', -20.2839, -50.2464], ['SP', 'Franca', -20.5386, -47.4008],
  ['SP', 'Jales', -20.2689, -50.5458], ['SP', 'Marília', -22.2139, -49.9458],
  ['SP', 'Mirassol', -20.8169, -49.5206], ['SP', 'Olímpia', -20.7372, -48.9147],
  ['SP', 'Piracicaba', -22.7253, -47.6492], ['SP', 'Presidente Prudente', -22.1256, -51.3889],
  ['SP', 'Registro', -24.4879, -47.8436], ['SP', 'Ribeirão Preto', -21.1775, -47.8103],
  ['SP', 'São Carlos', -22.0175, -47.8908], ['SP', 'São Paulo', -23.5505, -46.6333],
  ['SP', 'Sorocaba', -23.5015, -47.4526], ['SP', 'Votuporanga', -20.4228, -49.9781],
  ['MG', 'Belo Horizonte', -19.9167, -43.9345], ['MG', 'Patos de Minas', -18.5789, -46.5181],
  ['MG', 'Uberaba', -19.7483, -47.9319], ['MG', 'Uberlândia', -18.9186, -48.2772], ['MG', 'Unaí', -16.3575, -46.9061],
  ['GO', 'Goiânia', -16.6869, -49.2648], ['GO', 'Jataí', -17.8814, -51.7144], ['GO', 'Rio Verde', -17.7923, -50.9192],
  ['DF', 'Brasília', -15.7939, -47.8828],
  ['MT', 'Cuiabá', -15.6014, -56.0979], ['MT', 'Lucas do Rio Verde', -13.05, -55.9042],
  ['MT', 'Rondonópolis', -16.4673, -54.6372], ['MT', 'Sinop', -11.8642, -55.5094], ['MT', 'Sorriso', -12.5425, -55.7211],
  ['MS', 'Campo Grande', -20.4697, -54.6201], ['MS', 'Dourados', -22.2211, -54.8056], ['MS', 'Três Lagoas', -20.7849, -51.7007],
  ['PR', 'Cascavel', -24.9555, -53.4552], ['PR', 'Curitiba', -25.4284, -49.2733], ['PR', 'Londrina', -23.3045, -51.1696],
  ['PR', 'Maringá', -23.4205, -51.9333], ['PR', 'Ponta Grossa', -25.095, -50.1619],
  ['SC', 'Chapecó', -27.1004, -52.6152], ['SC', 'Florianópolis', -27.5954, -48.548],
  ['RS', 'Passo Fundo', -28.262, -52.4064], ['RS', 'Pelotas', -31.7654, -52.3376],
  ['RS', 'Porto Alegre', -30.0346, -51.2177], ['RS', 'Santa Maria', -29.6842, -53.8069],
  ['RJ', 'Campos dos Goytacazes', -21.7545, -41.3244], ['RJ', 'Rio de Janeiro', -22.9068, -43.1729],
  ['ES', 'Linhares', -19.3911, -40.0722], ['ES', 'Vitória', -20.3155, -40.3128],
  ['BA', 'Barreiras', -12.1528, -44.99], ['BA', 'Juazeiro', -9.4167, -40.5],
  ['BA', 'Luís Eduardo Magalhães', -12.0956, -45.7866], ['BA', 'Salvador', -12.9777, -38.5016],
  ['PE', 'Petrolina', -9.3891, -40.503], ['PE', 'Recife', -8.0476, -34.877],
  ['CE', 'Fortaleza', -3.7319, -38.5267], ['MA', 'Balsas', -7.5325, -46.0356],
  ['TO', 'Palmas', -10.184, -48.3336], ['PA', 'Belém', -1.4558, -48.4902],
  ['PA', 'Paragominas', -2.9967, -47.3528], ['AM', 'Manaus', -3.119, -60.0217],
].map(([uf, nome, lat, lon]) => ({ id: `${nome}-${uf}`, uf, nome, lat, lon }));

const CIDADE_PADRAO = 'São José do Rio Preto-SP';

function cidadeSelecionada() {
  let id = null;
  try { id = localStorage.getItem('colheita:cidade'); } catch (_) {}
  return CIDADES.find((c) => c.id === id) || CIDADES.find((c) => c.id === CIDADE_PADRAO);
}
function salvarCidade(id) {
  try { localStorage.setItem('colheita:cidade', id); } catch (_) {}
}

// Códigos WMO -> descrição e tipo de ícone
function descreverTempo(code) {
  const c = Number(code);
  if (c === 0) return { desc: 'Céu limpo', tipo: 'sol' };
  if (c === 1) return { desc: 'Predomínio de sol', tipo: 'sol' };
  if (c === 2) return { desc: 'Parcialmente nublado', tipo: 'solNuvem' };
  if (c === 3) return { desc: 'Nublado', tipo: 'nuvem' };
  if (c === 45 || c === 48) return { desc: 'Neblina', tipo: 'neblina' };
  if (c >= 51 && c <= 57) return { desc: 'Garoa', tipo: 'garoa' };
  if (c === 61) return { desc: 'Chuva fraca', tipo: 'chuva' };
  if (c === 63) return { desc: 'Chuva moderada', tipo: 'chuva' };
  if (c === 65) return { desc: 'Chuva forte', tipo: 'chuva' };
  if (c === 66 || c === 67) return { desc: 'Chuva congelante', tipo: 'chuva' };
  if (c >= 71 && c <= 77) return { desc: 'Neve', tipo: 'neve' };
  if (c >= 80 && c <= 82) return { desc: 'Pancadas de chuva', tipo: 'chuva' };
  if (c === 85 || c === 86) return { desc: 'Neve', tipo: 'neve' };
  if (c === 95) return { desc: 'Trovoadas', tipo: 'tempestade' };
  if (c === 96 || c === 99) return { desc: 'Trovoadas com granizo', tipo: 'tempestade' };
  return { desc: 'Indefinido', tipo: 'nuvem' };
}

// Ícones de clima coloridos (SVG)
function iconeClima(code, classe = '') {
  const { tipo, desc } = descreverTempo(code);
  const sol = (cx, cy, r) => `<g stroke="#f5a300" stroke-width="2.2" stroke-linecap="round">${
    [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const rad = (a * Math.PI) / 180;
      return `<line x1="${cx + Math.cos(rad) * (r + 3)}" y1="${cy + Math.sin(rad) * (r + 3)}" x2="${cx + Math.cos(rad) * (r + 6.5)}" y2="${cy + Math.sin(rad) * (r + 6.5)}"/>`;
    }).join('')}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffc21a" stroke="#f5a300" stroke-width="1.5"/>`;
  const nuvem = (cor = '#dfe5ec', borda = '#9aa6b2') =>
    `<path d="M17 44h26a9 9 0 0 0 1-17.9A12 12 0 0 0 21.3 25 9.5 9.5 0 0 0 17 44z" fill="${cor}" stroke="${borda}" stroke-width="1.8" stroke-linejoin="round"/>`;
  const gotas = (n) => [...Array(n)].map((_, i) =>
    `<line x1="${22 + i * 8}" y1="49" x2="${19 + i * 8}" y2="57" stroke="#2f80c8" stroke-width="2.6" stroke-linecap="round"/>`).join('');
  let corpo;
  switch (tipo) {
    case 'sol': corpo = sol(32, 32, 11); break;
    case 'solNuvem': corpo = `<g transform="translate(-6 -8)">${sol(30, 26, 9)}</g>${nuvem('#eef2f6')}`; break;
    case 'nuvem': corpo = `<g transform="translate(6 -6)">${nuvem('#c7cfd8', '#8d99a6')}</g>${nuvem()}`; break;
    case 'neblina': corpo = `${nuvem()}<g stroke="#9aa6b2" stroke-width="2.6" stroke-linecap="round"><line x1="14" y1="50" x2="48" y2="50"/><line x1="18" y1="56" x2="44" y2="56"/></g>`; break;
    case 'garoa': corpo = `${nuvem()}${gotas(3).replace(/y2="57"/g, 'y2="53"')}`; break;
    case 'chuva': corpo = `${nuvem('#c9d2dc', '#7f8b98')}${gotas(4)}`; break;
    case 'neve': corpo = `${nuvem()}<g fill="#7fb3e6"><circle cx="22" cy="52" r="2.4"/><circle cx="32" cy="55" r="2.4"/><circle cx="42" cy="52" r="2.4"/></g>`; break;
    case 'tempestade': corpo = `${nuvem('#aeb8c4', '#6b7785')}<path d="M33 44l-6 10h6l-3 8 10-12h-6l3-6z" fill="#ffc21a" stroke="#e09400" stroke-width="1.2" stroke-linejoin="round"/>`; break;
    default: corpo = nuvem();
  }
  return `<svg class="${classe}" viewBox="0 0 64 64" role="img" aria-label="${desc}"><title>${desc}</title>${corpo}</svg>`;
}

// Cor da caixa do dia: azul (frio) -> quase branco (ameno) -> vermelho claro (quente)
function corTemperatura(media) {
  const FRIO = [143, 189, 240], NEUTRO = [244, 246, 248], QUENTE = [238, 138, 130];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  let rgb;
  if (media <= 22) rgb = mix(NEUTRO, FRIO, Math.min(1, (22 - media) / 10));
  else rgb = mix(NEUTRO, QUENTE, Math.min(1, (media - 22) / 10));
  return `rgb(${rgb.join(',')})`;
}

// Domingo e sábado da semana atual (datas locais)
function semanaAtual(ref = new Date()) {
  const dom = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay());
  const sab = new Date(dom.getFullYear(), dom.getMonth(), dom.getDate() + 6);
  return { inicio: isoLocal(dom), fim: isoLocal(sab) };
}

// Busca clima atual + previsão da semana (domingo a sábado). Cache de 30 minutos.
async function buscarClima(cidade) {
  const { inicio, fim } = semanaAtual();
  const chave = `colheita:clima:${cidade.id}:${inicio}`;
  try {
    const cache = JSON.parse(sessionStorage.getItem(chave));
    if (cache && Date.now() - cache.t < 30 * 60 * 1000) return cache.dados;
  } catch (_) {}

  const params = new URLSearchParams({
    latitude: cidade.lat,
    longitude: cidade.lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
    timezone: 'America/Sao_Paulo',
    start_date: inicio,
    end_date: fim,
  });
  const res = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
  if (!res.ok) throw new Error('Não foi possível obter a previsão do tempo.');
  const dados = await res.json();
  try { sessionStorage.setItem(chave, JSON.stringify({ t: Date.now(), dados })); } catch (_) {}
  return dados;
}
