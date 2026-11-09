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
  #layers{position:absolute;right:68px;bottom:${insets.bottom + 150}px;z-index:1001;display:none;flex-direction:column;padding:6px;min-width:180px}
  #layers button{border:0;background:none;color:${text};text-align:left;font-size:15px;padding:10px 12px;border-radius:12px}
  #layers button.on{background:rgba(127,127,127,.25);font-weight:700}
  .temp small{font-size:9px;margin-left:1px;opacity:.8}
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
  #slider{width:100%;margin:0;touch-action:none}
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
<div id="side" class="glass"><button id="layersBtn" aria-label="Calques">◧</button><button id="locate" aria-label="Ma position">➤</button></div>
<div id="layers" class="glass"><button data-l="rain" class="on">Précipitations</button><button data-l="temp">Température</button><button data-l="wind">Vent</button><button data-l="air">Qualité de l’air</button></div>
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
  var temps=hourlyTemps.map(function(a){return a[best]}),c=Math.floor(N/2);
  document.getElementById('meT').textContent=Math.round(temps[c*N+c])+'°';
  if(!tempMarkers.length){
    for(var i=1;i<N;i+=3){for(var j=1;j<N;j+=3){if(Math.abs(i-c)<2&&Math.abs(j-c)<2)continue;
      var m=L.marker([+lats[i*N+j],+lons[i*N+j]],{icon:L.divIcon({className:'',html:'<div class="temp"></div>',iconSize:[34,34]}),interactive:false}).addTo(map);m.idx=i*N+j;tempMarkers.push(m);}}
  }
  tempMarkers.forEach(function(m){var el=m.getElement();if(!el||!el.firstChild)return;var d=el.firstChild,k=m.idx;
    if(layer==='wind'&&hourlyWind){var v=hourlyWind[k][best],dir=hourlyDir[k][best];
      d.innerHTML='<span style="display:inline-block;transform:rotate('+(dir+180)+'deg)">↑</span>'+(v==null?'':Math.round(v));}
    else if(layer==='air'&&hourlyAir){var a=hourlyAir[k]?hourlyAir[k][nearestIn(hourlyAir.times,hourlyTimes[best])]:null;d.textContent=a==null?'':Math.round(a);}
    else d.textContent=temps[k]==null?'':Math.round(temps[k]);
  });
}
function nearestIn(times,t){var best=0;for(var k=0;k<times.length;k++){if(Math.abs(times[k]-t)<Math.abs(times[best]-t))best=k}return best}

// Palettes des autres calques (r, g, b, a de 0 à 1)
function lerpStops(stops,v){if(v<=stops[0][0])return stops[0][1];for(var k=1;k<stops.length;k++){if(v<=stops[k][0]){var a=stops[k-1],b=stops[k],f=(v-a[0])/(b[0]-a[0]);return a[1].map(function(x,i){return x+(b[1][i]-x)*f})}}return stops[stops.length-1][1]}
var PALETTES={
  temp:[[-10,[94,92,230,.55]],[0,[90,170,250,.55]],[8,[110,210,190,.5]],[15,[150,215,110,.5]],[22,[250,210,70,.55]],[30,[250,130,60,.6]],[38,[230,50,50,.65]]],
  wind:[[0,[120,180,250,.15]],[10,[110,200,220,.35]],[20,[120,210,150,.45]],[35,[230,210,80,.55]],[55,[245,140,60,.6]],[80,[225,60,60,.65]],[110,[170,50,160,.7]]],
  air:[[0,[80,240,230,.45]],[20,[80,204,170,.45]],[40,[240,230,65,.5]],[60,[255,80,80,.55]],[80,[150,0,50,.6]],[100,[125,33,129,.65]]]
};
var LEGENDS={
  rain:['Précipitations',['Très fortes','Fortes','Modérées','Faibles'],'linear-gradient(#FFF27A,#C77DFF,#4E7CF5,#9CC8FF)'],
  temp:['Température',['35°','20°','5°','-10°'],'linear-gradient(rgb(230,50,50),rgb(250,210,70),rgb(110,210,190),rgb(94,92,230))'],
  wind:['Vent (km/h)',['80+','50','25','0'],'linear-gradient(rgb(225,60,60),rgb(230,210,80),rgb(120,210,150),rgb(120,180,250))'],
  air:['Qualité de l’air',['Mauvaise','Dégradée','Moyenne','Bonne'],'linear-gradient(rgb(150,0,50),rgb(255,80,80),rgb(240,230,65),rgb(80,240,230))']
};
function setLegend(l){var g=LEGENDS[l],el=document.getElementById('legend');el.querySelector('b').textContent=g[0];el.querySelector('.bar').style.background=g[2];
  el.querySelector('.labels').innerHTML=g[1].map(function(x){return'<span>'+x+'</span>'}).join('')}
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
  showTemps(t);
  document.getElementById('slider').value=Math.round(pos*STEPS);
  document.getElementById('title').textContent=layer==='temp'?'Température':layer==='wind'?'Vent':layer==='air'?'Qualité de l’air (CAMS)':cur.kind==='radar'?'Radar (observé)':'Prévision AROME';
  var d=new Date(t*1000),days=['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'];
  document.getElementById('time').textContent=days[d.getDay()]+' '+hm(Math.round(t/60)*60)+(layer==='rain'&&cur.empty?' · pas de pluie':'');
}
function setMode(m){
  mode=m;stop();lastKey='';document.querySelectorAll('#modes button').forEach(function(b){b.className=b.dataset.m===m?'on':''});
  var list=frames[m],s=document.getElementById('slider');s.max=Math.max(0,(list.length-1)*STEPS);
  var now=Date.now()/1000,ni=0;list.forEach(function(f,k){if(f.t<=now+60)ni=k});
  var ticks=document.getElementById('ticks');ticks.innerHTML='';
  var n=5;for(var k=0;k<n;k++){var f=list[Math.round(k*(list.length-1)/(n-1))];if(!f)continue;var sp=document.createElement('span');sp.textContent=Math.abs(f.t-now)<450?'Maint.':(m==='12h'?hh(f.t):hm(f.t));ticks.appendChild(sp)}
  document.getElementById('now').style.left=(list.length>1?ni/(list.length-1)*100:0)+'%';
  show(ni);
}
function stop(){if(raf){cancelAnimationFrame(raf);raf=null}document.getElementById('play').textContent='▶'}
function tick(ts){
  var n=frames[mode].length;if(n<2)return stop();
  var dt=lastTs?Math.min(0.1,(ts-lastTs)/1000):0;lastTs=ts;
  var speed=mode==='12h'?1.2:2.5; // images par seconde
  var p=pos+dt*speed;if(p>n-1+0.6)p=0; // courte pause sur la dernière image, puis on recommence
  show(Math.min(p,n-1));pos=p;raf=requestAnimationFrame(tick);
}
document.getElementById('play').onclick=function(){
  if(raf)return stop();document.getElementById('play').textContent='❚❚';
  if(pos>=frames[mode].length-1)pos=0;lastTs=0;raf=requestAnimationFrame(tick);
};
document.getElementById('slider').oninput=function(e){stop();show(+e.target.value/STEPS)};
document.querySelectorAll('#modes button').forEach(function(b){b.onclick=function(){setMode(b.dataset.m)}});
function setLayer(l){
  layer=l;lastKey='';tempKey='';document.getElementById('layers').style.display='none';
  document.querySelectorAll('#layers button').forEach(function(b){b.className=b.dataset.l===l?'on':''});
  setLegend(l);document.getElementById('modes').style.display=l==='rain'?'flex':'none';
  if(l==='air'&&!hourlyAir){loadAir().then(function(){if(layer==='air'){lastKey='';tempKey='';show(pos)}})}
  setMode(l==='rain'?mode:'12h');
}
function loadAir(){
  var u='https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+lats.join(',')+'&longitude='+lons.join(',')+'&timeformat=unixtime&hourly=european_aqi&forecast_days=2';
  return fetch(u).then(function(r){return r.json()}).then(function(arr){if(!Array.isArray(arr))arr=[arr];
    hourlyAir=arr.map(function(p){return p.hourly&&p.hourly.european_aqi});hourlyAir.times=arr[0].hourly.time;
  }).catch(function(){msg('Qualité de l’air indisponible')});
}
document.getElementById('layersBtn').onclick=function(){var m=document.getElementById('layers');m.style.display=m.style.display==='flex'?'none':'flex'};
document.querySelectorAll('#layers button').forEach(function(b){b.onclick=function(){setLayer(b.dataset.l)}});
function msg(t){var m=document.getElementById('msg');m.style.display=t?'block':'none';m.textContent=t||''}

var url='https://api.open-meteo.com/v1/forecast?latitude='+lats.join(',')+'&longitude='+lons.join(',')+
  '&models=meteofrance_seamless&timeformat=unixtime&minutely_15=precipitation&forecast_minutely_15=12&hourly=precipitation,temperature_2m,wind_speed_10m,wind_direction_10m&forecast_hours=13';
var forecast=fetch(url).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(arr){
  if(!Array.isArray(arr))arr=[arr];
  var q=arr[0].minutely_15.time, h=arr[0].hourly.time;
  hourlyTimes=h;hourlyTemps=arr.map(function(p){return p.hourly.temperature_2m});
  hourlyWind=arr.map(function(p){return p.hourly.wind_speed_10m||[]});hourlyDir=arr.map(function(p){return p.hourly.wind_direction_10m||[]});
  var quarter=q.map(function(t,k){var v=arr.map(function(p){return (p.minutely_15.precipitation[k]||0)*4});return{kind:'fc',t:t,vals:v,empty:!v.some(function(x){return x>=LMIN})}});
  var hourly=h.map(function(t,k){var v=arr.map(function(p){return p.hourly.precipitation[k]||0});return{kind:'fc',t:t,vals:v,empty:!v.some(function(x){return x>=LMIN})}});
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
  if(past.length){field=new RadarField({opacity:0,maxZoom:12,zIndex:10,className:'radar',updateWhenZooming:false}).addTo(map);map.on('moveend',preloadRadar);setTimeout(preloadRadar,50)}
  setMode(frames['3h'].length?'3h':'12h');
});
</script></body></html>`;
}
