// Carte des précipitations affichée dans une WebView (Leaflet).
//  - Passé : images radar observées (RainViewer, mosaïque incluant les radars Météo-France).
//  - Futur : prévision du modèle AROME de Météo-France (via Open-Meteo), calculée sur une grille
//    de points autour de toi puis dessinée en couleurs : au quart d'heure sur 3 h, à l'heure sur 12 h.
// Les commandes (frise, légende, calques, boutons) sont dessinées en natif par l'app, en Liquid Glass :
// la page lui envoie son état (postMessage) et l'app la pilote via window.rn.
export type MapPlace = { name: string; lat: number; lon: number };
export function radarHtml(lat: number, lon: number, dark: boolean, here: string, others: MapPlace[] = []) {
  // Fonds de carte Esri (sans clé) : le fond, puis les noms de villes par-dessus la pluie.
  const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  const base = `${esri}${dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'}/MapServer/tile/{z}/{y}/{x}`;
  const labels = `${esri}${dark ? 'World_Dark_Gray_Reference' : 'World_Light_Gray_Reference'}/MapServer/tile/{z}/{y}/{x}`;
  // Le fond Esri est gris (mer plus foncée que la terre) : un filtre SVG le recolore façon app Météo
  // d'Apple (mer bleutée, terre claire). Niveaux de gris mesurés sur les tuiles : mer / terre.
  const tint = dark
    ? { seaL: 35, landL: 63, sea: [14, 24, 38], land: [50, 54, 60] }
    : { seaL: 208, landL: 239, sea: [200, 222, 242], land: [246, 245, 241] };
  const table = (c: 0 | 1 | 2) => {
    const out: string[] = [];
    for (let i = 0; i < 256; i += 5) {
      const s = tint.sea[c], l = tint.land[c];
      let v: number;
      if (i <= tint.seaL) v = (s * i) / tint.seaL; // traits plus foncés que la mer
      else if (i <= tint.landL) v = s + ((l - s) * (i - tint.seaL)) / (tint.landL - tint.seaL);
      else v = l + ((255 - l) * (i - tint.landL)) / (255 - tint.landL);
      out.push((v / 255).toFixed(3));
    }
    return out.join(' '); // 52 valeurs : entrées 0, 5, …, 255 (pas régulier, comme le veut feFuncX)
  };
  const text = dark ? '#EAF1F8' : '#13212F';
  const halo = dark ? '0 0 3px #0B1520,0 0 3px #0B1520' : '0 0 3px #fff,0 0 3px #fff,0 0 2px #fff';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body,#map{margin:0;height:100%;background:${dark ? '#0B1520' : '#EEF3F8'};font:15px -apple-system,Roboto,sans-serif;color:${text}}
  .temp{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:17px;background:rgba(70,80,95,.85);color:#fff;font-weight:700;font-size:14px;border:1.5px solid rgba(255,255,255,.7)}
  .me,.pl{display:flex;flex-direction:column;align-items:center;pointer-events:none}
  .me .bubble{width:66px;height:66px;border-radius:33px;background:#97A3B1;border:3px solid #fff;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,.22)}
  .me .bubble b{font-size:23px;font-weight:700;line-height:24px;margin-left:5px;letter-spacing:-.5px}
  .me .bubble svg{width:28px;height:28px;margin-top:-1px}
  .me .tail{width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #fff;margin-top:-2px}
  .name{margin-top:6px;font-size:13px;font-weight:600;color:${text};text-shadow:${halo};white-space:nowrap}
  .pl .c{width:34px;height:34px;border-radius:17px;background:#545C68;border:2px solid #fff;color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  .pl .name{margin-top:4px}
  .rain{filter:blur(7px)}
  .radar{filter:blur(1.5px)}
  .leaflet-control-attribution{font-size:9px;background:transparent!important}
  .base{filter:url(#tint);-webkit-filter:url(#tint)}
</style></head><body>
<svg width="0" height="0" style="position:absolute"><filter id="tint" color-interpolation-filters="sRGB"><feComponentTransfer>
  <feFuncR type="table" tableValues="${table(0)}"/><feFuncG type="table" tableValues="${table(1)}"/><feFuncB type="table" tableValues="${table(2)}"/>
</feComponentTransfer></filter></svg>
<div id="map"></div>
<script>
var LAT=${lat}, LON=${lon};
// Comme l'app Météo d'Apple : on ouvre sur une vue large (≈ 11° de longitude, toute la France sur iPhone).
var HOMEZ=Math.max(4,Math.min(9,Math.log(360*window.innerWidth/(256*11))/Math.LN2));
var map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:0.25}).setView([LAT,LON],HOMEZ);
L.tileLayer('${base}',{className:'base',maxZoom:12,maxNativeZoom:16,attribution:'Fond © Esri · Radar RainViewer · Prévision AROME Météo-France'}).addTo(map);
map.createPane('labels');map.getPane('labels').style.zIndex=450;map.getPane('labels').style.pointerEvents='none';
L.tileLayer('${labels}',{pane:'labels',maxZoom:12,maxNativeZoom:16}).addTo(map);
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return'&#'+c.charCodeAt(0)+';'})}
// Lieu affiché : bulle avec température et temps ; autres villes enregistrées : pastille + nom.
var me=L.marker([LAT,LON],{icon:L.divIcon({className:'',html:'<div class="me"><div class="bubble"><b id="meT">–</b><span id="meI"></span></div><div class="tail"></div><div class="name">'+esc(${JSON.stringify(here)})+'</div></div>',iconSize:[160,108],iconAnchor:[80,77]}),interactive:false,zIndexOffset:1000}).addTo(map);
var OTHERS=${JSON.stringify(others)}, otherMarkers=OTHERS.map(function(o){
  return L.marker([o.lat,o.lon],{icon:L.divIcon({className:'',html:'<div class="pl"><div class="c">–</div><div class="name">'+esc(o.name)+'</div></div>',iconSize:[160,58],iconAnchor:[80,17]}),interactive:false,zIndexOffset:500}).addTo(map);
});

// ---- Grille de prévision AROME : couvre la zone affichée (+ marge), recalculée quand on bouge ----
var N=15, lats=[], lons=[], bounds=null;
function makeGrid(b){ // b : L.LatLngBounds de la vue
  var padLat=(b.getNorth()-b.getSouth())*0.2, padLon=(b.getEast()-b.getWest())*0.2;
  var n=Math.min(51.5,b.getNorth()+padLat), s=Math.max(41,b.getSouth()-padLat), w=Math.max(-6,b.getWest()-padLon), e=Math.min(10.5,b.getEast()+padLon);
  if(n-s<0.6){var c=(n+s)/2;n=c+0.3;s=c-0.3} if(e-w<0.8){var m=(e+w)/2;e=m+0.4;w=m-0.4}
  lats=[];lons=[];
  for(var i=0;i<N;i++){for(var j=0;j<N;j++){lats.push((n-(n-s)*i/(N-1)).toFixed(3));lons.push((w+(e-w)*j/(N-1)).toFixed(3));}}
  bounds=[[s,w],[n,e]];
}
makeGrid(map.getBounds());

// La frise de lecture est dessinée par l'app (Liquid Glass natif) : on lui envoie l'état.
function post(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o))}
var lastPost=0,lastText='',curT=0,curEmpty=false;
function postPos(force){
  var list=frames[mode],n=list.length,t0=n?list[0].t:0,t1=n?list[n-1].t:0,f=t1>t0?(curT-t0)/(t1-t0):0,txt=Math.round(curT/60)+'|'+curEmpty+'|'+!!raf,ts=Date.now();
  if(!force&&txt===lastText&&ts-lastPost<33)return;lastPost=ts;lastText=txt;
  post({type:'pos',f:Math.max(0,Math.min(1,f)),t:curT,empty:curEmpty,playing:!!raf});
}
var CLOUD='<path d="M7.5 19h9.5a4.5 4.5 0 0 0 .6-8.96A6.5 6.5 0 0 0 5.2 11.6 3.8 3.8 0 0 0 7.5 19z" fill="#fff"/>';
var CLOUD_UP='<path d="M7.5 15h9.5a4.2 4.2 0 0 0 .6-8.36A6 6 0 0 0 5.4 8.1 3.5 3.5 0 0 0 7.5 15z" fill="#fff"/>';
function wxIcon(code,day){
  var svg=function(b){return'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">'+b+'</svg>'};
  var sun='<circle cx="12" cy="12" r="4.2" fill="#fff" stroke="none"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
  var moon='<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" fill="#fff" stroke="none"/>';
  if(code==null)return'';
  if(code<=1)return svg(day?sun:moon);
  if(code===2)return svg((day?'<circle cx="9" cy="8" r="3.4" fill="#fff" stroke="none"/><path d="M9 1.8v1.4M2.8 8h1.4M4.6 3.6l1 1M13.4 3.6l-1 1"/>':'<path d="M13 9A5 5 0 0 1 7 3a5 5 0 1 0 6 6z" fill="#fff" stroke="none"/>')+'<g transform="translate(2 2) scale(.92)">'+CLOUD+'</g>');
  if(code===3)return svg(CLOUD);
  if(code===45||code===48)return svg('<path d="M4 8h16M3 12h18M5 16h14M7 20h10"/>');
  if(code>=95)return svg(CLOUD_UP+'<path d="M12.5 15.5l-2.5 4h3.5l-2 3.5" stroke-width="1.8"/>');
  if((code>=71&&code<=77)||code===85||code===86)return svg(CLOUD_UP+'<circle cx="8" cy="18.5" r="1.2" fill="#fff" stroke="none"/><circle cx="12" cy="21" r="1.2" fill="#fff" stroke="none"/><circle cx="16" cy="18.5" r="1.2" fill="#fff" stroke="none"/>');
  return svg(CLOUD_UP+'<path d="M8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3"/>');
}
function pad(n){return(n<10?'0':'')+n}
function hm(t){var d=new Date(t*1000);return pad(d.getHours())+':'+pad(d.getMinutes())}
function hh(t){return new Date(t*1000).getHours()+' h'}

// mm/h → couleur
var STOPS=[[0.1,[156,200,255,0]],[0.3,[140,190,255,.58]],[1,[78,124,245,.8]],[4,[120,90,230,.78]],[8,[199,125,255,.82]],[15,[255,242,122,.9]],[40,[255,255,220,.95]]];
function color(v){
  if(v<STOPS[0][0])return null;
  for(var k=1;k<STOPS.length;k++){if(v<=STOPS[k][0]){var a=STOPS[k-1],b=STOPS[k],f=(v-a[0])/(b[0]-a[0]);return a[1].map(function(x,i){return x+(b[1][i]-x)*f})}}
  return STOPS[STOPS.length-1][1];
}
// Intensité codée sur 0–255 (échelle logarithmique) et palette précalculée :
// on mélange les VALEURS de pluie de deux images, puis on colorie une seule fois
// (superposer deux images colorées faisait « clignoter » les couleurs).
var LMIN=0.08,LMAX=60;
function enc(v){return v<LMIN?0:Math.max(1,Math.min(255,Math.round(Math.log(v/LMIN)/Math.log(LMAX/LMIN)*254)+1))}
function dec(l){return LMIN*Math.pow(LMAX/LMIN,(l-1)/254)}
var PAL=new Uint8ClampedArray(1024);
for(var l=1;l<256;l++){var cc=color(dec(l));if(cc){PAL[l*4]=cc[0];PAL[l*4+1]=cc[1];PAL[l*4+2]=cc[2];PAL[l*4+3]=Math.round(cc[3]*255)}}
var FS=160,fcCanvas=document.createElement('canvas');fcCanvas.width=fcCanvas.height=FS;
function renderForecast(A,B,k){ // A, B : N*N valeurs en mm/h
  var ctx=fcCanvas.getContext('2d'),img=ctx.createImageData(FS,FS),d=img.data;
  for(var y=0;y<FS;y++){var gy=y/(FS-1)*(N-1),i0=Math.floor(gy),i1=Math.min(N-1,i0+1),fy=gy-i0;
    for(var x=0;x<FS;x++){var gx=x/(FS-1)*(N-1),j0=Math.floor(gx),j1=Math.min(N-1,j0+1),fx=gx-j0;
      var w00=(1-fx)*(1-fy),w01=fx*(1-fy),w10=(1-fx)*fy,w11=fx*fy;
      var v=A[i0*N+j0]*w00+A[i0*N+j1]*w01+A[i1*N+j0]*w10+A[i1*N+j1]*w11;
      if(B&&k>0){var vb=B[i0*N+j0]*w00+B[i0*N+j1]*w01+B[i1*N+j0]*w10+B[i1*N+j1]*w11;v=v*(1-k)+vb*k}
      var L=enc(v)*4;if(!L)continue;var o=(y*FS+x)*4;d[o]=PAL[L];d[o+1]=PAL[L+1];d[o+2]=PAL[L+2];d[o+3]=PAL[L+3];}}
  ctx.putImageData(img,0,0);return fcCanvas.toDataURL();
}

var frames={'3h':[],'12h':[]}, mode='3h', tempMarkers=[], rvHost='';
var hourlyTemps=null, hourlyTimes=[], hourlyWind=null, hourlyDir=null, hourlyAir=null, layer='rain';

function tempsAt(t){ // températures de la grille à l'heure la plus proche
  if(!hourlyTemps)return null;var best=0;for(var k=0;k<hourlyTimes.length;k++){if(Math.abs(hourlyTimes[k]-t)<Math.abs(hourlyTimes[best]-t))best=k}
  return hourlyTemps.map(function(a){return a[best]});
}
var tempKey='';
function nearestHour(t){var best=0;for(var k=0;k<hourlyTimes.length;k++){if(Math.abs(hourlyTimes[k]-t)<Math.abs(hourlyTimes[best]-t))best=k}return best}
function showTemps(t){
  if(!hourlyTemps)return;var best=nearestHour(t),key=layer+best;if(key===tempKey)return;tempKey=key;
  var temps=hourlyTemps.map(function(a){return a[best]}),c=Math.floor(N/2),mi=0,md=1e9;
  for(var q=0;q<lats.length;q++){var dd=Math.pow(lats[q]-LAT,2)+Math.pow(lons[q]-LON,2);if(dd<md){md=dd;mi=q}}
  if(!placeData&&temps[mi]!=null)document.getElementById('meT').textContent=Math.round(temps[mi])+'°';
  if(layer==='rain'){tempMarkers.forEach(function(m){map.removeLayer(m)});tempMarkers=[];return}
  if(!tempMarkers.length){
    for(var i=1;i<N;i+=3){for(var j=1;j<N;j+=3){if(Math.abs(i-c)<1&&Math.abs(j-c)<1)continue;
      var m=L.marker([+lats[i*N+j],+lons[i*N+j]],{icon:L.divIcon({className:'',html:'<div class="temp"></div>',iconSize:[34,34]}),interactive:false}).addTo(map);m.idx=i*N+j;tempMarkers.push(m);}}
  }
  tempMarkers.forEach(function(m){var el=m.getElement();if(!el||!el.firstChild)return;var d=el.firstChild,k=m.idx;
    if(layer==='wind'&&hourlyWind){var v=hourlyWind[k][best],dir=hourlyDir[k][best];
      d.innerHTML='<span style="display:inline-block;transform:rotate('+(dir+180)+'deg)">↑</span>'+(v==null?'':Math.round(v));}
    else if(layer==='air'&&hourlyAir){var a=hourlyAir[k]?hourlyAir[k][nearestIn(hourlyAir.times,hourlyTimes[best])]:null;d.textContent=a==null?'':Math.round(a);}
    else d.textContent=temps[k]==null?'':Math.round(temps[k]);
  });
}
// Température et temps aux lieux (bulle « Ma position » et villes enregistrées)
var placeData=null,placeKey='';
function loadPlaces(){
  var pts=[{lat:LAT,lon:LON}].concat(OTHERS);
  var u='https://api.open-meteo.com/v1/forecast?latitude='+pts.map(function(p){return p.lat.toFixed(3)}).join(',')+'&longitude='+pts.map(function(p){return p.lon.toFixed(3)}).join(',')+
    '&timeformat=unixtime&hourly=temperature_2m,weather_code,is_day&past_hours=4&forecast_hours=14';
  fetch(u).then(function(r){return r.json()}).then(function(arr){if(!Array.isArray(arr))arr=[arr];if(!arr[0]||!arr[0].hourly)return;placeData=arr;placeKey='';showPlaces(curT||Date.now()/1000)}).catch(function(){});
}
function showPlaces(t){
  if(!placeData)return;var h=placeData[0].hourly,k=nearestIn(h.time,t);if(placeKey===k)return;placeKey=k;
  var p=placeData[0].hourly,v=(p.temperature_2m||[])[k];
  document.getElementById('meT').textContent=v==null?'–':Math.round(v)+'°';
  document.getElementById('meI').innerHTML=wxIcon((p.weather_code||[])[k],(p.is_day||[])[k]!==0);
  otherMarkers.forEach(function(m,i){var d=placeData[i+1],el=m.getElement();if(!d||!d.hourly||!el)return;var x=(d.hourly.temperature_2m||[])[k];el.querySelector('.c').textContent=x==null?'–':Math.round(x)});
}
loadPlaces();
function nearestIn(times,t){var best=0;for(var k=0;k<times.length;k++){if(Math.abs(times[k]-t)<Math.abs(times[best]-t))best=k}return best}

// Palettes des autres calques (r, g, b, a de 0 à 1)
function lerpStops(stops,v){if(v<=stops[0][0])return stops[0][1];for(var k=1;k<stops.length;k++){if(v<=stops[k][0]){var a=stops[k-1],b=stops[k],f=(v-a[0])/(b[0]-a[0]);return a[1].map(function(x,i){return x+(b[1][i]-x)*f})}}return stops[stops.length-1][1]}
var PALETTES={
  temp:[[-10,[94,92,230,.55]],[0,[90,170,250,.55]],[8,[110,210,190,.5]],[15,[150,215,110,.5]],[22,[250,210,70,.55]],[30,[250,130,60,.6]],[38,[230,50,50,.65]]],
  wind:[[0,[120,180,250,.15]],[10,[110,200,220,.35]],[20,[120,210,150,.45]],[35,[230,210,80,.55]],[55,[245,140,60,.6]],[80,[225,60,60,.65]],[110,[170,50,160,.7]]],
  air:[[0,[80,240,230,.45]],[20,[80,204,170,.45]],[40,[240,230,65,.5]],[60,[255,80,80,.55]],[80,[150,0,50,.6]],[100,[125,33,129,.65]]]
};
var fieldCanvas=document.createElement('canvas');fieldCanvas.width=fieldCanvas.height=FS;
function renderField(A,B,k,stops){
  var ctx=fieldCanvas.getContext('2d'),img=ctx.createImageData(FS,FS),d=img.data;
  for(var y=0;y<FS;y++){var gy=y/(FS-1)*(N-1),i0=Math.floor(gy),i1=Math.min(N-1,i0+1),fy=gy-i0;
    for(var x=0;x<FS;x++){var gx=x/(FS-1)*(N-1),j0=Math.floor(gx),j1=Math.min(N-1,j0+1),fx=gx-j0;
      var w00=(1-fx)*(1-fy),w01=fx*(1-fy),w10=(1-fx)*fy,w11=fx*fy;
      var v=A[i0*N+j0]*w00+A[i0*N+j1]*w01+A[i1*N+j0]*w10+A[i1*N+j1]*w11;
      if(B&&k>0){v=v*(1-k)+(B[i0*N+j0]*w00+B[i0*N+j1]*w01+B[i1*N+j0]*w10+B[i1*N+j1]*w11)*k}
      if(!isFinite(v))continue;var c=lerpStops(stops,v),o=(y*FS+x)*4;d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=Math.round(c[3]*255);}}
  ctx.putImageData(img,0,0);return fieldCanvas.toDataURL();
}
function layerValues(i){ // valeurs de la grille pour l'image horaire i, selon le calque
  if(layer==='temp')return hourlyTemps.map(function(a){return a[i]==null?NaN:a[i]});
  if(layer==='wind')return hourlyWind.map(function(a){return a[i]==null?NaN:a[i]});
  if(layer==='air'&&hourlyAir){var j=nearestIn(hourlyAir.times,hourlyTimes[i]);return hourlyAir.map(function(a){return a&&a[j]!=null?a[j]:NaN})}
  return null;
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
var levelCache={}; // url → Uint8Array(65536) des niveaux, ou null
function levels(url){
  if(url in levelCache)return levelCache[url] instanceof Promise?null:levelCache[url];
  levelCache[url]=new Promise(function(ok){
    var im=new Image();im.crossOrigin='anonymous';
    im.onload=function(){
      var c=document.createElement('canvas');c.width=c.height=256;var x=c.getContext('2d'),out=new Uint8Array(65536);x.drawImage(im,0,0);
      try{var p=x.getImageData(0,0,256,256).data;for(var i=0,j=0;i<p.length;i+=4,j++){if(p[i+3])out[j]=enc(rvIntensity(p[i],p[i+1],p[i+2],p[i+3]))}}catch(e){}
      levelCache[url]=out;ok();field&&field.redrawAll();};
    im.onerror=function(){levelCache[url]=null;ok()};im.src=url;
  });
  return null;
}
function srcUrl(path,c){var z=Math.min(c.z,7),f=Math.pow(2,c.z-z);return rvHost+path+'/256/'+z+'/'+Math.floor(c.x/f)+'/'+Math.floor(c.y/f)+'/2/1_0.png'}
var rs={a:null,b:null,k:0},blendCache={},scratch=document.createElement('canvas');scratch.width=scratch.height=256;
function blended(c){ // tuile source (zoom ≤ 7) mélangée entre les images a et b, coloriée
  var ua=srcUrl(rs.a,c),A=levels(ua);if(!A)return null;
  var B=rs.b&&rs.k>0?levels(srcUrl(rs.b,c)):null,k=B?rs.k:0,key=ua+'|'+(B?rs.b:'')+'|'+Math.round(k*40);
  if(blendCache[key])return blendCache[key];
  var out=document.createElement('canvas');out.width=out.height=256;var ctx=out.getContext('2d'),img=ctx.createImageData(256,256),d=img.data;
  for(var j=0;j<65536;j++){var L=B?Math.round(A[j]*(1-k)+B[j]*k):A[j];if(!L)continue;L*=4;var o=j*4;d[o]=PAL[L];d[o+1]=PAL[L+1];d[o+2]=PAL[L+2];d[o+3]=PAL[L+3]}
  ctx.putImageData(img,0,0);return blendCache[key]=out;
}
var RadarField=L.GridLayer.extend({
  createTile:function(c){var t=document.createElement('canvas');t.width=t.height=256;t._c=c;this.drawTile(t);return t},
  drawTile:function(t){
    var c=t._c,x=t.getContext('2d');x.clearRect(0,0,256,256);if(!rs.a)return;var src=blended(c);if(!src)return;
    var z=Math.min(c.z,7),f=Math.pow(2,c.z-z),sub=256/f;x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
    x.drawImage(src,(c.x%f)*sub,(c.y%f)*sub,sub,sub,0,0,256,256);
  },
  redrawAll:function(){blendCache={};for(var k in this._tiles)this.drawTile(this._tiles[k].el)}
});
var field=null;
function preloadRadar(){ // charge toutes les images radar des tuiles visibles
  if(!field)return;var list=frames['3h'].filter(function(f){return f.kind==='radar'});
  for(var k in field._tiles){var c=field._tiles[k].coords;list.forEach(function(f){levels(srcUrl(f.path,c))})}
}
var STEPS=40, pos=0, raf=null, lastTs=0, fcLayer=null, lastKey='';
function show(p){
  var list=frames[mode];if(!list.length)return;
  pos=Math.max(0,Math.min(list.length-1,p));var i=Math.floor(pos),k=pos-i;if(i>=list.length-1){i=list.length-1;k=0}
  var a=list[i],b=list[i+1]&&k>0?list[i+1]:null;
  var key=layer+mode+i+'|'+Math.round(k*40);
  if(key!==lastKey&&layer!=='rain'){lastKey=key;
    if(field)field.setOpacity(0);
    var A=layerValues(i),B=b?layerValues(i+1):null;
    if(A){var u=renderField(A,B,k,PALETTES[layer]);if(!fcLayer)fcLayer=L.imageOverlay(u,bounds,{className:'rain',interactive:false}).addTo(map);else fcLayer.setUrl(u);fcLayer.setOpacity(1)}
    else if(fcLayer)fcLayer.setOpacity(0);
  }
  if(key!==lastKey){lastKey=key;
    var radarOp=0,fcOp=0,fa=null,fb=null,fk=0;
    if(a.kind==='radar'){
      if(b&&b.kind==='radar'){rs={a:a.path,b:b.path,k:k};radarOp=.95}
      else{rs={a:a.path,b:null,k:0};radarOp=.95*(1-(b?k:0));if(b){fa=b.vals;fcOp=.95*k}}
    }else{rs={a:null,b:null,k:0};fa=a.vals;fb=b?b.vals:null;fk=k;fcOp=.95}
    if(field){field.setOpacity(radarOp);if(radarOp>0)field.redrawAll()}
    if(fa&&fcOp>0){var url=renderForecast(fa,fb,fk);if(!fcLayer)fcLayer=L.imageOverlay(url,bounds,{className:'rain',interactive:false}).addTo(map);else fcLayer.setUrl(url);fcLayer.setOpacity(fcOp)}
    else if(fcLayer)fcLayer.setOpacity(0);
  }
  var t=b?a.t+(b.t-a.t)*k:a.t,cur=k<0.5||!b?a:b;
  showTemps(t);showPlaces(t);
  curT=t;curEmpty=layer==='rain'&&!!cur.empty;
  postPos(false);
}
function setMode(m){
  mode=m;stop();lastKey='';
  var list=frames[m];
  var now=Date.now()/1000;
  // repères horaires (libellés posés par l'app) et graduations de la piste
  var ticks=[],grads=[],nowF=0;
  if(list.length>1){var t0=list[0].t,t1=list[list.length-1].t,span=t1-t0,step=m==='12h'?7200:3600,gstep=m==='12h'?3600:1800;
    nowF=Math.max(0,Math.min(1,(now-t0)/span));
    for(var h=Math.ceil(t0/3600)*3600;h<=t1;h+=3600){if(m!=='12h'||new Date(h*1000).getHours()%2===1)ticks.push({t:h,f:(h-t0)/span})}
    for(var g=Math.ceil(t0/gstep)*gstep;g<=t1;g+=gstep)grads.push((g-t0)/span)}
  post({type:'meta',mode:m,showModes:layer==='rain'&&frames['3h'].length>0&&frames['12h'].length>0,ticks:ticks,grads:grads,nowF:nowF});
  show(posAt(now));postPos(true);
}
function posAt(t){ // position (index fractionnaire) correspondant à l'instant t
  var list=frames[mode],n=list.length,i=0;if(n<2)return 0;
  while(i<n-2&&list[i+1].t<=t)i++;return i+Math.max(0,Math.min(1,(t-list[i].t)/(list[i+1].t-list[i].t||1)));
}
function stop(){if(raf){cancelAnimationFrame(raf);raf=null;postPos(true)}}
function tick(ts){
  var n=frames[mode].length;if(n<2)return stop();
  var dt=lastTs?Math.min(0.1,(ts-lastTs)/1000):0;lastTs=ts;
  var speed=mode==='12h'?1.2:2.5; // images par seconde
  var p=pos+dt*speed;if(p>n-1+0.6)p=0; // courte pause sur la dernière image, puis on recommence
  show(Math.min(p,n-1));pos=p;raf=requestAnimationFrame(tick);
}
function togglePlay(){
  if(raf)return stop();if(frames[mode].length<2)return;
  if(pos>=frames[mode].length-1)pos=0;lastTs=0;raf=requestAnimationFrame(tick);postPos(true);
}
// commandes envoyées par l'app (frise native)
window.rn={play:togglePlay,mode:function(m){if(frames[m]&&frames[m].length)setMode(m)},
  seek:function(f){stop();var list=frames[mode],n=list.length;if(!n)return;show(posAt(list[0].t+f*(list[n-1].t-list[0].t)));postPos(true)},
  layer:function(l){setLayer(l)},locate:function(){map.flyTo([LAT,LON],HOMEZ,{duration:.6})},
  go:function(la,lo){map.flyTo([la,lo],9,{duration:.6})}};
function setLayer(l){
  layer=l;lastKey='';tempKey='';
  if(l==='air'&&!hourlyAir){loadAir().then(function(){if(layer==='air'){lastKey='';tempKey='';show(pos)}})}
  setMode(l==='rain'?mode:'12h');
}
function loadAir(){
  var u='https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+lats.join(',')+'&longitude='+lons.join(',')+'&timeformat=unixtime&hourly=european_aqi&forecast_days=2';
  return fetch(u).then(function(r){return r.json()}).then(function(arr){if(!Array.isArray(arr))arr=[arr];
    hourlyAir=arr.map(function(p){return p.hourly&&p.hourly.european_aqi});hourlyAir.times=arr[0].hourly.time;
  }).catch(function(){msg('Qualité de l’air indisponible')});
}
function msg(t){post({type:'msg',text:t||''})}

// Open-Meteo (gratuit) compte chaque point de la grille comme une demande et bloque au-delà
// de 600 par minute : on garde donc la dernière réponse 10 min (même zone) pour ne pas tout
// redemander à chaque ouverture de la carte, et on réessaie plus tard en cas d'échec.
var FC_TTL=600;
function cacheGet(key){try{var c=JSON.parse(localStorage.getItem('fc')||'null');if(c&&c.key===key&&Date.now()/1000-c.at<FC_TTL)return c.data}catch(e){}return null}
function cachePut(key,data){try{localStorage.setItem('fc',JSON.stringify({key:key,at:Date.now()/1000,data:data}))}catch(e){}}
function loadForecast(){
  var url='https://api.open-meteo.com/v1/forecast?latitude='+lats.join(',')+'&longitude='+lons.join(',')+
    '&models=meteofrance_seamless&timeformat=unixtime&minutely_15=precipitation&forecast_minutely_15=12&hourly=precipitation,temperature_2m,wind_speed_10m,wind_direction_10m&past_hours=3&forecast_hours=13';
  var cached=cacheGet(url);
  return (cached?Promise.resolve(cached):fetch(url).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(d){cachePut(url,d);return d})).then(function(arr){
    if(!Array.isArray(arr))arr=[arr];
    var q=arr[0].minutely_15.time, h=arr[0].hourly.time;
    hourlyTimes=h;hourlyTemps=arr.map(function(p){return p.hourly.temperature_2m});
    hourlyWind=arr.map(function(p){return p.hourly.wind_speed_10m||[]});hourlyDir=arr.map(function(p){return p.hourly.wind_direction_10m||[]});
    hourlyAir=null;
    var quarter=q.map(function(t,k){var v=arr.map(function(p){return (p.minutely_15.precipitation[k]||0)*4});return{kind:'fc',t:t,vals:v,empty:!v.some(function(x){return x>=LMIN})}});
    var hourly=h.map(function(t,k){var v=arr.map(function(p){return p.hourly.precipitation[k]||0});return{kind:'fc',t:t,vals:v,empty:!v.some(function(x){return x>=LMIN})}});
    return{quarter:quarter,hourly:hourly};
  }).catch(function(){return null});
}
var forecast=loadForecast(), pastFrames=[];
function applyForecast(fc){
  var now=Date.now()/1000;
  var future=fc?fc.quarter.filter(function(f){return f.t>(pastFrames.length?pastFrames[pastFrames.length-1].t:now-900)}):[];
  frames['3h']=pastFrames.concat(future);
  frames['12h']=fc?fc.hourly:[];
}
// Quand on déplace / zoome nettement, on recalcule la prévision pour la nouvelle zone.
var reloadTimer=null, reloading=false;
map.on('moveend',function(){
  if(!bounds||reloading)return;var v=map.getBounds(),B=L.latLngBounds(bounds);
  var spanNow=v.getNorth()-v.getSouth(),spanGrid=B.getNorth()-B.getSouth();
  if(B.contains(v)&&spanNow>spanGrid*0.35)return; // la zone visible est déjà couverte, à une échelle adaptée
  clearTimeout(reloadTimer);
  reloadTimer=setTimeout(function(){
    reloading=true;makeGrid(map.getBounds());
    tempMarkers.forEach(function(m){map.removeLayer(m)});tempMarkers=[];tempKey='';
    loadForecast().then(function(fc){reloading=false;if(!fc)return;msg('');applyForecast(fc);if(fcLayer)fcLayer.setBounds(L.latLngBounds(bounds));lastKey='';var keep=pos;setMode(mode);show(Math.min(keep,frames[mode].length-1));
      if(layer==='air')loadAir().then(function(){lastKey='';tempKey='';show(pos)})});
  },600);
});

var radar=fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){return r.json()}).then(function(d){
  rvHost=d.host;return((d.radar&&d.radar.past)||[]).map(function(f){return{kind:'radar',t:f.time,path:f.path}});
}).catch(function(){return[]});

Promise.all([forecast,radar]).then(function(res){
  var fc=res[0],past=res[1];pastFrames=past;
  applyForecast(fc);
  if(!frames['3h'].length&&!frames['12h'].length){msg('Carte indisponible pour le moment');post({type:'pos',f:0,t:0,empty:false,playing:false,unavailable:true});return}
  if(!fc){msg('Prévision en cours de chargement…');retryForecast(0)}else if(!past.length)msg('Radar indisponible : prévision seulement');
  if(past.length){field=new RadarField({opacity:0,maxZoom:12,zIndex:10,className:'radar',updateWhenZooming:false}).addTo(map);map.on('moveend',preloadRadar);setTimeout(preloadRadar,50)}
  setMode(frames['3h'].length?'3h':'12h');
});
// Si la prévision a échoué (souvent : trop de demandes en une minute), on réessaie après
// 20 s, 40 s, 70 s puis 2 min ; dès qu'elle arrive, la frise s'allonge vers le futur.
var RETRY=[20,40,70,120];
function retryForecast(n){
  if(n>=RETRY.length){msg('Prévision indisponible : radar seulement');return}
  setTimeout(function(){
    if(frames['12h'].length){msg('');return} // déjà arrivée entre-temps (carte déplacée)
    if(reloading)return retryForecast(n+1);
    reloading=true;
    loadForecast().then(function(fc){reloading=false;
      if(!fc)return retryForecast(n+1);
      msg('');applyForecast(fc);lastKey='';setMode(frames['3h'].length?mode:'12h');
    });
  },RETRY[n]*1000);
}
</script></body></html>`;
}
