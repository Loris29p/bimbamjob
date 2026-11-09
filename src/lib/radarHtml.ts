// Carte des précipitations affichée dans une WebView (Leaflet).
//  - Passé : images radar observées (RainViewer, mosaïque incluant les radars Météo-France).
//  - Futur : prévision du modèle AROME de Météo-France (via Open-Meteo), calculée sur une grille
//    de points autour de toi puis dessinée en couleurs : au quart d'heure sur 3 h, à l'heure sur 12 h.
export function radarHtml(lat: number, lon: number, dark: boolean, insets: { top: number; bottom: number } = { top: 47, bottom: 34 }) {
  // Fonds de carte Esri (sans clé) : le fond, puis les noms de villes par-dessus la pluie.
  const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  const base = `${esri}${dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'}/MapServer/tile/{z}/{y}/{x}`;
  const labels = `${esri}${dark ? 'World_Dark_Gray_Reference' : 'World_Light_Gray_Reference'}/MapServer/tile/{z}/{y}/{x}`;
  const panel = dark ? 'rgba(20,28,40,.86)' : 'rgba(255,255,255,.9)';
  const text = dark ? '#EAF1F8' : '#13212F';
  const sub = dark ? 'rgba(234,241,248,.6)' : 'rgba(19,33,47,.6)';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body,#map{margin:0;height:100%;background:${dark ? '#0B1520' : '#EEF3F8'};font:15px -apple-system,Roboto,sans-serif;color:${text}}
  .glass{background:${panel};backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:18px;box-shadow:0 4px 18px rgba(0,0,0,.18)}
  #legend{position:absolute;left:12px;top:${insets.top + 62}px;z-index:1000;padding:10px 12px;font-size:13px}
  #legend b{display:block;margin-bottom:6px;font-size:14px}
  #legend .row{display:flex;gap:8px;align-items:stretch}
  #legend .bar{width:6px;border-radius:3px;background:linear-gradient(#FFF27A,#C77DFF,#4E7CF5,#9CC8FF)}
  #legend .labels{display:flex;flex-direction:column;justify-content:space-between;height:96px;color:${sub}}
  #side{position:absolute;right:12px;bottom:${insets.bottom + 150}px;z-index:1000;display:flex;flex-direction:column}
  #side button{width:46px;height:46px;border:0;background:none;font-size:20px;color:${text}}
  #panel{position:absolute;left:12px;right:12px;bottom:${insets.bottom + 10}px;z-index:1000;padding:12px 14px}
  #top{display:flex;align-items:center;gap:10px}
  #play{width:42px;height:42px;border-radius:21px;border:0;background:rgba(127,127,127,.22);color:${text};font-size:16px}
  #title{font-weight:700;font-size:16px}
  #time{color:${sub};font-size:13px}
  #modes{margin-left:auto;display:flex;background:rgba(127,127,127,.2);border-radius:16px;padding:2px}
  #modes button{border:0;background:none;color:${text};font-weight:600;padding:6px 12px;border-radius:14px;font-size:14px}
  #modes button.on{background:${dark ? 'rgba(255,255,255,.25)' : '#fff'}}
  #track{position:relative;height:28px;margin-top:10px}
  #slider{width:100%;margin:0}
  #ticks{display:flex;justify-content:space-between;color:${sub};font-size:12px;margin-top:2px}
  #now{position:absolute;top:-2px;width:2px;height:14px;background:${text};border-radius:1px}
  #msg{position:absolute;top:${insets.top + 8}px;left:64px;right:76px;z-index:1000;text-align:center;font-size:13px;padding:6px 10px;display:none}
  .temp{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:17px;background:rgba(70,80,95,.85);color:#fff;font-weight:700;font-size:14px;border:1.5px solid rgba(255,255,255,.7)}
  .me{display:flex;flex-direction:column;align-items:center}
  .me .bubble{width:58px;height:58px;border-radius:29px;background:rgba(150,160,175,.95);border:3px solid #fff;color:#fff;font-weight:700;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.25)}
  .me .dot{width:12px;height:12px;border-radius:6px;background:#2F7BF6;border:2px solid #fff;margin-top:4px}
  .rain{filter:blur(7px)}
  .radar{filter:blur(1.5px)}
  .leaflet-control-attribution{font-size:9px;background:transparent!important}
</style></head><body>
<div id="map"></div>
<div id="msg" class="glass"></div>
<div id="legend" class="glass"><b>Précipitations</b><div class="row"><div class="bar"></div><div class="labels"><span>Très fortes</span><span>Fortes</span><span>Modérées</span><span>Faibles</span></div></div></div>
<div id="side" class="glass"><button id="locate" aria-label="Ma position">➤</button></div>
<div id="panel" class="glass">
  <div id="top"><button id="play">▶</button><div><div id="title">Chargement…</div><div id="time"></div></div>
    <div id="modes"><button data-m="3h" class="on">3 h</button><button data-m="12h">12 h</button></div></div>
  <div id="track"><input id="slider" type="range" min="0" max="0" value="0"><div id="now"></div></div>
  <div id="ticks"></div>
</div>
<script>
var LAT=${lat}, LON=${lon};
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([LAT,LON],9);
L.tileLayer('${base}',{maxZoom:12,maxNativeZoom:16,attribution:'Fond © Esri · Radar RainViewer · Prévision AROME Météo-France'}).addTo(map);
map.createPane('labels');map.getPane('labels').style.zIndex=450;map.getPane('labels').style.pointerEvents='none';
L.tileLayer('${labels}',{pane:'labels',maxZoom:12,maxNativeZoom:16}).addTo(map);
var me=L.marker([LAT,LON],{icon:L.divIcon({className:'',html:'<div class="me"><div class="bubble" id="meT">–</div><div class="dot"></div></div>',iconSize:[60,80],iconAnchor:[30,78]}),interactive:false,zIndexOffset:1000}).addTo(map);
document.getElementById('locate').onclick=function(){map.setView([LAT,LON],9);};

// ---- Grille de prévision AROME ----
var N=13, DLAT=1.1, DLON=1.6;
var lats=[],lons=[];
for(var i=0;i<N;i++){for(var j=0;j<N;j++){lats.push((LAT+DLAT-2*DLAT*i/(N-1)).toFixed(3));lons.push((LON-DLON+2*DLON*j/(N-1)).toFixed(3));}}
var bounds=[[LAT-DLAT,LON-DLON],[LAT+DLAT,LON+DLON]];

function pad(n){return(n<10?'0':'')+n}
function hm(t){var d=new Date(t*1000);return pad(d.getHours())+':'+pad(d.getMinutes())}
function hh(t){return new Date(t*1000).getHours()+' h'}

// mm/h → couleur
var STOPS=[[0.1,[156,200,255,0]],[0.3,[156,200,255,.42]],[1,[78,124,245,.7]],[4,[120,90,230,.78]],[8,[199,125,255,.82]],[15,[255,242,122,.9]],[40,[255,255,220,.95]]];
function color(v){
  if(v<STOPS[0][0])return null;
  for(var k=1;k<STOPS.length;k++){if(v<=STOPS[k][0]){var a=STOPS[k-1],b=STOPS[k],f=(v-a[0])/(b[0]-a[0]);return a[1].map(function(x,i){return x+(b[1][i]-x)*f})}}
  return STOPS[STOPS.length-1][1];
}
function render(values){ // values : N*N en mm/h
  var S=240,c=document.createElement('canvas');c.width=S;c.height=S;var ctx=c.getContext('2d'),img=ctx.createImageData(S,S),any=false;
  for(var y=0;y<S;y++){for(var x=0;x<S;x++){
    var gy=y/(S-1)*(N-1),gx=x/(S-1)*(N-1),i0=Math.floor(gy),j0=Math.floor(gx),i1=Math.min(N-1,i0+1),j1=Math.min(N-1,j0+1),fy=gy-i0,fx=gx-j0;
    var v=values[i0*N+j0]*(1-fx)*(1-fy)+values[i0*N+j1]*fx*(1-fy)+values[i1*N+j0]*(1-fx)*fy+values[i1*N+j1]*fx*fy;
    var col=color(v);if(!col)continue;any=true;var p=(y*S+x)*4;img.data[p]=col[0];img.data[p+1]=col[1];img.data[p+2]=col[2];img.data[p+3]=Math.round(col[3]*255);
  }}
  ctx.putImageData(img,0,0);return any?c.toDataURL():null;
}

var frames={'3h':[],'12h':[]}, mode='3h', index=0, timer=null, overlay=null, tempMarkers=[], radarLayers={}, rvHost='';
var hourlyTemps=null, hourlyTimes=[];

function tempsAt(t){ // températures de la grille à l'heure la plus proche
  if(!hourlyTemps)return null;var best=0;for(var k=0;k<hourlyTimes.length;k++){if(Math.abs(hourlyTimes[k]-t)<Math.abs(hourlyTimes[best]-t))best=k}
  return hourlyTemps.map(function(a){return a[best]});
}
function showTemps(t){
  var temps=tempsAt(t);tempMarkers.forEach(function(m){map.removeLayer(m)});tempMarkers=[];if(!temps)return;
  var c=Math.floor(N/2);document.getElementById('meT').textContent=Math.round(temps[c*N+c])+'°';
  for(var i=1;i<N;i+=3){for(var j=1;j<N;j+=3){if(Math.abs(i-c)<2&&Math.abs(j-c)<2)continue;var v=temps[i*N+j];if(v==null)continue;
    tempMarkers.push(L.marker([+lats[i*N+j],+lons[i*N+j]],{icon:L.divIcon({className:'',html:'<div class="temp">'+Math.round(v)+'</div>',iconSize:[34,34]}),interactive:false}).addTo(map));}}
}
// Les images RainViewer (palette « Universal Blue ») sont recolorées avec notre palette,
// lissées (au-delà du zoom 7, le service ne fournit pas plus de détail) et le bruit très faible est retiré.
var lut={};
function rvIntensity(r,g,b,a){ // couleur RainViewer → intensité approximative en mm/h
  var key=r+','+g+','+b+','+a;if(key in lut)return lut[key];
  var mx=Math.max(r,g,b)/255,mn=Math.min(r,g,b)/255,l=(mx+mn)/2,h=0,d=mx-mn;
  if(d>0){var R=r/255,G=g/255,B=b/255;h=mx===R?((G-B)/d)%6:mx===G?(B-R)/d+2:(R-G)/d+4;h*=60;if(h<0)h+=360}
  var v;
  if(a<250)v=0.06+a/190*0.26;                                  // échos très faibles (bruine)
  else if(h>=170&&h<=230)v=0.5*Math.pow(24,Math.min(1,Math.max(0,(0.74-l)/0.54))); // bleus : faible → forte
  else if(h>=15&&h<=70)v=12+(70-h)/55*25;                      // jaunes / orangés : très fortes
  else v=45;                                                    // rouges, violets : intenses
  return lut[key]=v;
}
var srcCache={};
function recolored(url){
  if(srcCache[url])return srcCache[url];
  return srcCache[url]=new Promise(function(ok){
    var im=new Image();im.crossOrigin='anonymous';
    im.onload=function(){
      var c=document.createElement('canvas');c.width=c.height=256;var x=c.getContext('2d');x.drawImage(im,0,0);
      try{var d=x.getImageData(0,0,256,256),p=d.data;
        for(var i=0;i<p.length;i+=4){if(!p[i+3])continue;var col=color(rvIntensity(p[i],p[i+1],p[i+2],p[i+3]));
          if(!col){p[i+3]=0;continue}p[i]=col[0];p[i+1]=col[1];p[i+2]=col[2];p[i+3]=Math.round(col[3]*255)}
        x.putImageData(d,0,0);}catch(e){}
      ok(c)};
    im.onerror=function(){ok(null)};im.src=url;
  });
}
var RadarLayer=L.GridLayer.extend({
  createTile:function(c,done){
    var t=document.createElement('canvas');t.width=t.height=256;var path=this.options.path;
    var z=Math.min(c.z,7),f=Math.pow(2,c.z-z),px=Math.floor(c.x/f),py=Math.floor(c.y/f),sub=256/f;
    recolored(rvHost+path+'/256/'+z+'/'+px+'/'+py+'/2/1_0.png').then(function(src){
      if(src){var x=t.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
        x.drawImage(src,(c.x%f)*sub,(c.y%f)*sub,sub,sub,0,0,256,256);}
      done(null,t)});
    return t;
  }
});
function radarLayer(f){
  if(!radarLayers[f.path])radarLayers[f.path]=new RadarLayer({path:f.path,opacity:0,maxZoom:12,zIndex:10,className:'radar'}).addTo(map);
  return radarLayers[f.path];
}
function show(i){
  var list=frames[mode];if(!list.length)return;index=i;var f=list[i];
  Object.keys(radarLayers).forEach(function(k){radarLayers[k].setOpacity(0)});
  if(overlay){map.removeLayer(overlay);overlay=null}
  if(f.kind==='radar'){radarLayer(f).setOpacity(.95);if(list[i+1]&&list[i+1].kind==='radar')radarLayer(list[i+1]);}
  else if(f.img){overlay=L.imageOverlay(f.img,bounds,{opacity:.95,className:'rain',interactive:false}).addTo(map);}
  showTemps(f.t);
  document.getElementById('slider').value=i;
  document.getElementById('title').textContent=f.kind==='radar'?'Radar (observé)':'Prévision AROME';
  var d=new Date(f.t*1000),days=['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'];
  document.getElementById('time').textContent=days[d.getDay()]+' '+hm(f.t)+(f.empty?' · pas de pluie':'');
}
function setMode(m){
  mode=m;stop();document.querySelectorAll('#modes button').forEach(function(b){b.className=b.dataset.m===m?'on':''});
  var list=frames[m],s=document.getElementById('slider');s.max=Math.max(0,list.length-1);
  var now=Date.now()/1000,ni=0;list.forEach(function(f,k){if(f.t<=now+60)ni=k});
  // graduations
  var ticks=document.getElementById('ticks');ticks.innerHTML='';
  var n=5;for(var k=0;k<n;k++){var f=list[Math.round(k*(list.length-1)/(n-1))];if(!f)continue;var sp=document.createElement('span');sp.textContent=Math.abs(f.t-now)<450?'Maint.':(m==='12h'?hh(f.t):hm(f.t));ticks.appendChild(sp)}
  var mark=document.getElementById('now');mark.style.left=(list.length>1?ni/(list.length-1)*100:0)+'%';
  show(ni);
}
function stop(){if(timer){clearInterval(timer);timer=null}document.getElementById('play').textContent='▶'}
document.getElementById('play').onclick=function(){
  if(timer)return stop();document.getElementById('play').textContent='❚❚';
  timer=setInterval(function(){show((index+1)%frames[mode].length)},mode==='12h'?900:600);
};
document.getElementById('slider').oninput=function(e){stop();show(+e.target.value)};
document.querySelectorAll('#modes button').forEach(function(b){b.onclick=function(){setMode(b.dataset.m)}});
function msg(t){var m=document.getElementById('msg');m.style.display=t?'block':'none';m.textContent=t||''}

var url='https://api.open-meteo.com/v1/forecast?latitude='+lats.join(',')+'&longitude='+lons.join(',')+
  '&models=meteofrance_seamless&timeformat=unixtime&minutely_15=precipitation&forecast_minutely_15=12&hourly=precipitation,temperature_2m&forecast_hours=13';
var forecast=fetch(url).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(arr){
  if(!Array.isArray(arr))arr=[arr];
  var q=arr[0].minutely_15.time, h=arr[0].hourly.time;
  hourlyTimes=h;hourlyTemps=arr.map(function(p){return p.hourly.temperature_2m});
  var quarter=q.map(function(t,k){var v=arr.map(function(p){return (p.minutely_15.precipitation[k]||0)*4});var img=render(v);return{kind:'fc',t:t,img:img,empty:!img}});
  var hourly=h.map(function(t,k){var v=arr.map(function(p){return p.hourly.precipitation[k]||0});var img=render(v);return{kind:'fc',t:t,img:img,empty:!img}});
  return{quarter:quarter,hourly:hourly};
}).catch(function(){return null});

var radar=fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){return r.json()}).then(function(d){
  rvHost=d.host;return((d.radar&&d.radar.past)||[]).map(function(f){return{kind:'radar',t:f.time,path:f.path}});
}).catch(function(){return[]});

Promise.all([forecast,radar]).then(function(res){
  var fc=res[0],past=res[1],now=Date.now()/1000;
  var future=fc?fc.quarter.filter(function(f){return f.t>(past.length?past[past.length-1].t:now-900)}):[];
  frames['3h']=past.concat(future);
  frames['12h']=fc?fc.hourly:[];
  if(!frames['3h'].length&&!frames['12h'].length){msg('Carte indisponible pour le moment');document.getElementById('title').textContent='Indisponible';return}
  if(!fc)msg('Prévision indisponible : radar seulement');else if(!past.length)msg('Radar indisponible : prévision seulement');
  setMode(frames['3h'].length?'3h':'12h');
});
</script></body></html>`;
}
