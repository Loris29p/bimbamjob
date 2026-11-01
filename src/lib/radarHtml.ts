// Page HTML (Leaflet) affichée dans une WebView : fond de carte + images radar RainViewer animées.
export function radarHtml(lat: number, lon: number, dark: boolean) {
  const base = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;height:100%;background:${dark ? '#0B1520' : '#EEF3F8'}}
  #bar{position:absolute;left:12px;right:12px;bottom:16px;z-index:1000;display:flex;align-items:center;gap:10px;
       background:${dark ? 'rgba(19,33,47,.92)' : 'rgba(255,255,255,.94)'};color:${dark ? '#EAF1F8' : '#13212F'};
       border-radius:14px;padding:10px 12px;font:15px -apple-system,Roboto,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.2)}
  #play{border:0;border-radius:50%;width:38px;height:38px;font-size:16px;background:#1F6FEB;color:#fff}
  #slider{flex:1}
  #label{min-width:92px;text-align:right;font-variant-numeric:tabular-nums}
  #msg{position:absolute;top:12px;left:12px;right:12px;z-index:1000;text-align:center;color:#fff;background:#E5484D;border-radius:10px;padding:8px;display:none}
</style></head><body>
<div id="map"></div><div id="msg"></div>
<div id="bar"><button id="play">▶</button><input id="slider" type="range" min="0" max="0" value="0"><span id="label">…</span></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${lat}, ${lon}], 8);
  L.tileLayer('${base}', { maxZoom: 12, subdomains: 'abcd',
    attribution: '© OpenStreetMap © CARTO · Radar © RainViewer' }).addTo(map);
  L.circleMarker([${lat}, ${lon}], { radius: 7, color: '#fff', weight: 2, fillColor: '#1F6FEB', fillOpacity: 1 }).addTo(map);

  var frames = [], layers = {}, index = 0, timer = null, host = '';
  var slider = document.getElementById('slider'), label = document.getElementById('label'), play = document.getElementById('play');

  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function fmt(f){
    var d = new Date(f.time * 1000);
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + (f.forecast ? ' (prév.)' : '');
  }
  function layerFor(i){
    var f = frames[i];
    if (!layers[f.path]) {
      layers[f.path] = L.tileLayer(host + f.path + '/256/{z}/{x}/{y}/2/1_1.png',
        { opacity: 0, maxNativeZoom: 7, maxZoom: 12, zIndex: 10 }).addTo(map);
    }
    return layers[f.path];
  }
  function show(i){
    if (!frames.length) return;
    var prev = layerFor(index); prev.setOpacity(0);
    index = i; layerFor(i).setOpacity(0.75);
    // précharge l'image suivante pour une animation fluide
    layerFor((i + 1) % frames.length);
    slider.value = i; label.textContent = fmt(frames[i]);
  }
  function toggle(){
    if (timer) { clearInterval(timer); timer = null; play.textContent = '▶'; return; }
    play.textContent = '❚❚';
    timer = setInterval(function(){ show((index + 1) % frames.length); }, 600);
  }
  play.onclick = toggle;
  slider.oninput = function(){ if (timer) toggle(); show(Number(slider.value)); };

  fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){ return r.json(); }).then(function(data){
    host = data.host;
    var past = (data.radar && data.radar.past) || [];
    var now = (data.radar && data.radar.nowcast) || [];
    frames = past.map(function(f){ return { time: f.time, path: f.path }; })
      .concat(now.map(function(f){ return { time: f.time, path: f.path, forecast: true }; }));
    if (!frames.length) throw new Error('vide');
    slider.max = frames.length - 1;
    index = past.length - 1;
    show(index);
  }).catch(function(){
    var m = document.getElementById('msg'); m.style.display = 'block'; m.textContent = 'Radar indisponible pour le moment';
  });
</script></body></html>`;
}
