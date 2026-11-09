// Moteur invisible de la carte (petite WebView cachée).
// La carte affichée est la vraie carte Apple Plans (react-native-maps) ; ce moteur s'occupe du reste :
//  - Passé : images radar observées (RainViewer, mosaïque incluant les radars Météo-France),
//    recolorées avec notre palette puis assemblées en une image pour la zone visible.
//  - Futur : prévision du modèle AROME de Météo-France (via Open-Meteo), calculée sur une grille
//    de points couvrant la zone visible : au quart d'heure sur 3 h, à l'heure sur 12 h.
//  - Calques température / vent / qualité de l'air, températures des lieux.
// Il envoie à l'app (postMessage) les images à poser sur la carte, les pastilles à afficher
// et l'état de la frise ; l'app le pilote via window.rn (lecture, frise, calque, zone visible).
export type MapView4 = { n: number; s: number; w: number; e: number; zoom: number };
export type EnginePlace = { lat: number; lon: number };

export function mapEngineHtml(lat: number, lon: number, others: EnginePlace[], view: MapView4) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><script>
var LAT=${lat}, LON=${lon}, OTHERS=${JSON.stringify(others)}, view=${JSON.stringify(view)};
function post(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o))}
function msg(t){post({type:'msg',text:t||''})}
function nearestIn(times,t){var best=0;for(var k=0;k<times.length;k++){if(Math.abs(times[k]-t)<Math.abs(times[best]-t))best=k}return best}

// ---- Palette de la pluie : mm/h → couleur ----
var STOPS=[[0.1,[156,200,255,0]],[0.3,[140,190,255,.58]],[1,[78,124,245,.8]],[4,[120,90,230,.78]],[8,[199,125,255,.82]],[15,[255,242,122,.9]],[40,[255,255,220,.95]]];
function color(v){
  if(v<STOPS[0][0])return null;
  for(var k=1;k<STOPS.length;k++){if(v<=STOPS[k][0]){var a=STOPS[k-1],b=STOPS[k],f=(v-a[0])/(b[0]-a[0]);return a[1].map(function(x,i){return x+(b[1][i]-x)*f})}}
  return STOPS[STOPS.length-1][1];
}
// Intensité codée sur 0–255 (échelle logarithmique) et palette précalculée.
var LMIN=0.08,LMAX=60;
function enc(v){return v<LMIN?0:Math.max(1,Math.min(255,Math.round(Math.log(v/LMIN)/Math.log(LMAX/LMIN)*254)+1))}
function dec(l){return LMIN*Math.pow(LMAX/LMIN,(l-1)/254)}
var PAL=new Uint8ClampedArray(1024);
for(var l=1;l<256;l++){var cc=color(dec(l));if(cc){PAL[l*4]=cc[0];PAL[l*4+1]=cc[1];PAL[l*4+2]=cc[2];PAL[l*4+3]=Math.round(cc[3]*255)}}

// Adoucit les intensités (deux flous en boîte ≈ flou gaussien, rayon r pixels) : bords fondus,
// plus de « pixels » carrés. Fait en JavaScript car le flou du canvas n'existe pas partout sur iPhone.
function soften(F,W,H,r){
  var T=new Float32Array(F.length),n=2*r+1;
  for(var pass=0;pass<2;pass++){
    for(var y=0;y<H;y++){var row=y*W,s=0;for(var x=-r;x<=r;x++)s+=F[row+Math.min(W-1,Math.max(0,x))];
      for(var x=0;x<W;x++){T[row+x]=s/n;s+=F[row+Math.min(W-1,x+r+1)]-F[row+Math.max(0,x-r)]}}
    for(var x=0;x<W;x++){var s=0;for(var y=-r;y<=r;y++)s+=T[Math.min(H-1,Math.max(0,y))*W+x];
      for(var y=0;y<H;y++){F[y*W+x]=s/n;s+=T[Math.min(H-1,y+r+1)*W+x]-T[Math.max(0,y-r)*W+x]}}
  }
}
// Intensités codées (0–255) → couleurs de la palette
function paint(F,d){for(var j=0;j<F.length;j++){var L=Math.round(F[j]);if(L<1)continue;L*=4;var o=j*4;d[o]=PAL[L];d[o+1]=PAL[L+1];d[o+2]=PAL[L+2];d[o+3]=PAL[L+3]}}
// Adoucit une image (flou) si le navigateur le permet, puis la convertit en image PNG (data URI).
function finish(src,blur,scale){
  var c=document.createElement('canvas');c.width=src.width*scale;c.height=src.height*scale;var x=c.getContext('2d');
  x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
  if(blur&&'filter' in x)x.filter='blur('+blur+'px)';
  x.drawImage(src,0,0,c.width,c.height);return c.toDataURL('image/png');
}

// ---- Grille de prévision AROME : couvre la zone visible (+ marge) ----
var N=15, lats=[], lons=[], grid=null; // grid : {n,s,w,e}
function makeGrid(v){
  var padLat=(v.n-v.s)*0.2, padLon=(v.e-v.w)*0.2;
  var n=Math.min(51.5,v.n+padLat), s=Math.max(41,v.s-padLat), w=Math.max(-6,v.w-padLon), e=Math.min(10.5,v.e+padLon);
  if(n-s<0.6){var c=(n+s)/2;n=c+0.3;s=c-0.3} if(e-w<0.8){var m=(e+w)/2;e=m+0.4;w=m-0.4}
  lats=[];lons=[];
  for(var i=0;i<N;i++){for(var j=0;j<N;j++){lats.push((n-(n-s)*i/(N-1)).toFixed(3));lons.push((w+(e-w)*j/(N-1)).toFixed(3));}}
  grid={n:n,s:s,w:w,e:e};fcCache={};
}
var gridCanvas=document.createElement('canvas'),FS=160;gridCanvas.width=gridCanvas.height=FS;
function lerpStops(stops,v){if(v<=stops[0][0])return stops[0][1];for(var k=1;k<stops.length;k++){if(v<=stops[k][0]){var a=stops[k-1],b=stops[k],f=(v-a[0])/(b[0]-a[0]);return a[1].map(function(x,i){return x+(b[1][i]-x)*f})}}return stops[stops.length-1][1]}
var PALETTES={
  temp:[[-10,[94,92,230,.55]],[0,[90,170,250,.55]],[8,[110,210,190,.5]],[15,[150,215,110,.5]],[22,[250,210,70,.55]],[30,[250,130,60,.6]],[38,[230,50,50,.65]]],
  wind:[[0,[120,180,250,.15]],[10,[110,200,220,.35]],[20,[120,210,150,.45]],[35,[230,210,80,.55]],[55,[245,140,60,.6]],[80,[225,60,60,.65]],[110,[170,50,160,.7]]],
  air:[[0,[80,240,230,.45]],[20,[80,204,170,.45]],[40,[240,230,65,.5]],[60,[255,80,80,.55]],[80,[150,0,50,.6]],[100,[125,33,129,.65]]]
};
// Valeurs de la grille interpolées sur l'image ; stops absent = pluie (palette PAL)
// Poids de l'interpolation bicubique (Catmull-Rom) : surface lisse qui passe par chaque point,
// sans les « losanges » de l'interpolation linéaire ni le flou qui effaçait les petites averses.
function cubic(t){var t2=t*t,t3=t2*t;return[(-t3+2*t2-t)/2,(3*t3-5*t2+2)/2,(-3*t3+4*t2+t)/2,(t3-t2)/2]}
function renderGrid(A,stops){
  var ctx=gridCanvas.getContext('2d'),img=ctx.createImageData(FS,FS),d=img.data,R=stops?null:new Float32Array(FS*FS);
  // pluie : on interpole les niveaux (échelle logarithmique), plus fidèle aux bords des zones de pluie
  var G=stops?A:A.map(function(v){return enc(v)});
  var at=function(i,j){return G[Math.max(0,Math.min(N-1,i))*N+Math.max(0,Math.min(N-1,j))]};
  for(var y=0;y<FS;y++){var gy=y/(FS-1)*(N-1),i0=Math.floor(gy),wy=cubic(gy-i0);
    for(var x=0;x<FS;x++){var gx=x/(FS-1)*(N-1),j0=Math.floor(gx),wx=cubic(gx-j0),v=0,o=(y*FS+x)*4;
      for(var a=0;a<4;a++){var row=0;for(var b=0;b<4;b++)row+=wx[b]*at(i0-1+a,j0-1+b);v+=wy[a]*row}
      if(!stops){R[y*FS+x]=Math.max(0,v)}
      else{if(!isFinite(v))continue;var c=lerpStops(stops,v);d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=Math.round(c[3]*255)}}}
  if(R){soften(R,FS,FS,1);paint(R,d)}
  ctx.putImageData(img,0,0);
  return{uri:finish(gridCanvas,0,2),bounds:[[grid.n,grid.e],[grid.s,grid.w]]};
}
var fcCache={};

// ---- Radar RainViewer : tuiles (zoom ≤ 7, palette « Universal Blue ») recolorées avec notre palette ----
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
var levelCache={}; // url → Promise<Uint8Array(65536) des niveaux, ou null>
function levels(url){
  if(!levelCache[url])levelCache[url]=new Promise(function(ok){
    var im=new Image();im.crossOrigin='anonymous';
    im.onload=function(){
      var c=document.createElement('canvas');c.width=c.height=256;var x=c.getContext('2d'),out=new Uint8Array(65536);x.drawImage(im,0,0);
      try{var p=x.getImageData(0,0,256,256).data;for(var i=0,j=0;i<p.length;i+=4,j++){if(p[i+3])out[j]=enc(rvIntensity(p[i],p[i+1],p[i+2],p[i+3]))}}catch(e){}
      ok(out)};
    im.onerror=function(){delete levelCache[url];ok(null)};im.src=url;
  });
  return levelCache[url];
}
function lon2x(lo,z){return(lo+180)/360*Math.pow(2,z)}
function lat2y(la,z){var r=la*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z)}
function x2lon(x,z){return x/Math.pow(2,z)*360-180}
function y2lat(y,z){var n=Math.PI-2*Math.PI*y/Math.pow(2,z);return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))}
var tiles=null; // tuiles radar couvrant la zone visible (+ marge)
function makeTiles(v){
  var padLat=(v.n-v.s)*0.25,padLon=(v.e-v.w)*0.25,z=Math.max(2,Math.min(7,Math.round(v.zoom))),t;
  for(;;){var m=Math.pow(2,z);
    t={z:z,x0:Math.floor(lon2x(v.w-padLon,z)),x1:Math.floor(lon2x(v.e+padLon,z)),y0:Math.max(0,Math.floor(lat2y(Math.min(85,v.n+padLat),z))),y1:Math.min(m-1,Math.floor(lat2y(Math.max(-85,v.s-padLat),z)))};
    if((t.x1-t.x0+1)*(t.y1-t.y0+1)<=20||z<=2)break;z--}
  t.key=[t.z,t.x0,t.x1,t.y0,t.y1].join('/');
  t.bounds=[[y2lat(t.y0,t.z),x2lon(t.x1+1,t.z)],[y2lat(t.y1+1,t.z),x2lon(t.x0,t.z)]];
  return t;
}
var radCache={};
// Niveaux bruts (0–255) d'une image radar, assemblés pour la zone visible
function radarField(path){
  var T=tiles,key='f|'+path+'|'+T.key;if(radCache[key])return radCache[key];
  var jobs=[],m=Math.pow(2,T.z);
  for(var y=T.y0;y<=T.y1;y++)for(var x=T.x0;x<=T.x1;x++)jobs.push(levels(rvHost+path+'/256/'+T.z+'/'+(((x%m)+m)%m)+'/'+y+'/2/1_0.png'));
  return radCache[key]=Promise.all(jobs).then(function(arr){
    var nx=T.x1-T.x0+1,ny=T.y1-T.y0+1,W=nx*256,H=ny*256,F=new Uint8Array(W*H);
    arr.forEach(function(A,k){if(!A)return;var ox=(k%nx)*256,oy=Math.floor(k/nx)*256;
      for(var j=0;j<65536;j++){if(A[j])F[(oy+(j>>8))*W+ox+(j&255)]=A[j]}});
    // Zone large : moitié de la résolution (4 fois moins de calcul et d'images plus légères,
    // indispensable pour les images intermédiaires de l'animation ; invisible après adoucissement)
    if(W>768){var w=W>>1,h=H>>1,G=new Uint8Array(w*h);
      for(var y=0;y<h;y++)for(var x=0;x<w;x++){var o=2*y*W+2*x;G[y*w+x]=(F[o]+F[o+1]+F[o+W]+F[o+W+1]+2)>>2}
      F=G;W=w;H=h}
    return{F:F,W:W,H:H,T:T};
  });
}
// Niveaux → image (adoucie, colorée) posée sur la carte
function fieldImage(F,W,H,bounds){
  var c=document.createElement('canvas');c.width=W;c.height=H;var ctx=c.getContext('2d'),img=ctx.createImageData(W,H),G=new Float32Array(F);
  soften(G,W,H,1);paint(G,img.data);ctx.putImageData(img,0,0);
  return{uri:finish(c,0,1),bounds:bounds};
}
function radarImage(path){
  var key='i|'+path+'|'+tiles.key;if(radCache[key])return radCache[key];
  return radCache[key]=radarField(path).then(function(r){return fieldImage(r.F,r.W,r.H,r.T.bounds)});
}
// ---- Prévision immédiate (1re heure) : on prolonge le mouvement de la pluie vu par le radar ----
// Comme l'app Météo d'Apple pour l'heure à venir : bien plus détaillé que la grille AROME.
// Déplacement mesuré entre l'image radar d'il y a 30 min et la dernière (recherche du meilleur décalage).
function motion(){
  var key='mv|'+tiles.key;if(radCache[key])return radCache[key];
  var n=pastFrames.length;if(n<2)return Promise.resolve({vx:0,vy:0});
  var fa=pastFrames[Math.max(0,n-4)],fb=pastFrames[n-1];
  return radCache[key]=Promise.all([radarField(fa.path),radarField(fb.path)]).then(function(r){
    var W=r[0].W,H=r[0].H,S=4,w=Math.floor(W/S),h=Math.floor(H/S);
    function down(F){var o=new Float32Array(w*h);for(var y=0;y<h;y++)for(var x=0;x<w;x++){var s=0;for(var a=0;a<S;a++)for(var b=0;b<S;b++)s+=F[(y*S+a)*W+x*S+b];o[y*w+x]=s/(S*S)}return o}
    var A=down(r[0].F),B=down(r[1].F),R=10,best=1e18,bx=0,by=0;
    for(var dy=-R;dy<=R;dy++)for(var dx=-R;dx<=R;dx++){var s=0,cnt=0;
      for(var y=R;y<h-R;y+=2)for(var x=R;x<w-R;x+=2){var p=A[y*w+x],q=B[(y+dy)*w+x+dx];if(p||q){s+=Math.abs(p-q);cnt++}}
      if(!cnt)continue;s=s/cnt+0.15*(dx*dx+dy*dy); // petite préférence pour les faibles déplacements
      if(s<best){best=s;bx=dx;by=dy}}
    var dt=Math.max(60,fb.t-fa.t);return{vx:bx*S/dt,vy:by*S/dt}; // pixels par seconde
  });
}
function nowField(m){ // pluie dans m minutes : dernière image radar déplacée, qui s'estompe un peu
  var key='ncf'+m+'|'+tiles.key;if(radCache[key])return radCache[key];
  var last=pastFrames[pastFrames.length-1];
  return radCache[key]=Promise.all([radarField(last.path),motion()]).then(function(r){
    var A=r[0],v=r[1],W=A.W,H=A.H,sx=Math.round(v.vx*m*60),sy=Math.round(v.vy*m*60),G=new Uint8Array(W*H),fade=m/60*20;
    for(var y=Math.max(0,sy);y<Math.min(H,H+sy);y++){var src=(y-sy)*W-sx;
      for(var x=Math.max(0,sx);x<Math.min(W,W+sx);x++){var L=A.F[src+x];if(L)G[y*W+x]=Math.max(0,L-fade)}}
    return{F:G,W:W,H:H,T:A.T};
  });
}
function nowImage(m){
  var key='nc'+m+'|'+tiles.key;if(radCache[key])return radCache[key];
  return radCache[key]=nowField(m).then(function(r){return fieldImage(r.F,r.W,r.H,r.T.bounds)});
}
function isRadar(f){return f.kind==='radar'||f.kind==='nc'}
function frameField(f){return f.kind==='radar'?radarField(f.path):nowField(f.m)}
function frameImage(f){return f.kind==='radar'?radarImage(f.path):nowImage(f.m)}
// ---- Animation fluide ----
// La carte Apple ne sait pas rendre une image à moitié transparente : pour que la pluie glisse
// d'une image à l'autre (au lieu de sauter), on fabrique des images intermédiaires (¼, ½, ¾)
// en mélangeant les intensités des deux images voisines.
var STEPS=4;
function blendImage(a,b,q){
  var key='bl|'+(a.path||a.m)+'|'+(b.path||b.m)+'|'+q+'|'+tiles.key;if(radCache[key])return radCache[key];
  return radCache[key]=Promise.all([frameField(a),frameField(b)]).then(function(r){
    var A=r[0].F,B=r[1].F,G=new Uint8Array(A.length);
    for(var j=0;j<A.length;j++){var x=A[j],y=B[j];if(x||y)G[j]=Math.round(x*(1-q)+y*q)}
    return fieldImage(G,r[0].W,r[0].H,r[0].T.bounds);
  });
}
var NOWCAST=[10,20,30,40,50,60]; // minutes après la dernière image radar

// ---- Frise : images (passé radar + prévision) et lecture ----
var frames={'3h':[],'12h':[]}, mode='3h', layer='rain', rvHost='', pastFrames=[];
var hourlyTemps=null, hourlyTimes=[], hourlyWind=null, hourlyDir=null, hourlyAir=null;
var pos=0, timer=null, lastKey='', shown=null, curT=0, curEmpty=false;
var lastPost=0,lastText='';
function postPos(force){
  var list=frames[mode],n=list.length,t0=n?list[0].t:0,t1=n?list[n-1].t:0,f=t1>t0?(curT-t0)/(t1-t0):0,txt=Math.round(curT/60)+'|'+curEmpty+'|'+!!timer,ts=Date.now();
  if(!force&&txt===lastText&&ts-lastPost<33)return;lastPost=ts;lastText=txt;
  post({type:'pos',f:Math.max(0,Math.min(1,f)),t:curT,empty:curEmpty,playing:!!timer});
}
function layerValues(i){ // valeurs de la grille pour l'image horaire i, selon le calque
  if(layer==='temp')return hourlyTemps.map(function(a){return a[i]==null?NaN:a[i]});
  if(layer==='wind')return hourlyWind.map(function(a){return a[i]==null?NaN:a[i]});
  if(layer==='air'&&hourlyAir){var j=nearestIn(hourlyAir.times,hourlyTimes[i]);return hourlyAir.map(function(a){return a&&a[j]!=null?a[j]:NaN})}
  return null;
}
// Pose l'image du mode courant entre les images i et i+1 (q = 0, ¼, ½, ¾) :
// une seule image à la fois (radar OU prévision OU autre calque).
function render(i,q){
  var list=frames[mode],a=list[i],b=list[i+1];if(!b)q=0;
  if(q&&layer==='rain'&&isRadar(a)!==isRadar(b)){if(q>=0.5)i++;q=0;a=list[i];b=list[i+1]} // radar ↔ grille : pas de mélange
  var key=layer+mode+i+'/'+q+'|'+(tiles?tiles.key:'')+'|'+(grid?grid.n+','+grid.w:'');
  if(!a||key===lastKey)return;lastKey=key;
  if(layer==='rain'&&isRadar(a)){
    if(!tiles)return;
    (q?blendImage(a,b,q):frameImage(a)).then(function(img){if(lastKey===key)send(img)});
  }else{
    var ck=layer+mode+i+'/'+q;
    if(!(ck in fcCache)){
      var A=layer==='rain'?a.vals:layerValues(i),B=q?(layer==='rain'?b.vals:layerValues(i+1)):null;
      if(A&&B)A=A.map(function(v,k){return v*(1-q)+B[k]*q});
      fcCache[ck]=A?renderGrid(A,layer==='rain'?null:PALETTES[layer]):null;
    }
    send(fcCache[ck]);
  }
}
function send(img){if(shown===img)return;shown=img;post({type:'img',img:img})}
function show(p){
  var list=frames[mode];if(!list.length)return;
  pos=Math.max(0,Math.min(list.length-1,p));var i=Math.floor(pos),k=pos-i;if(i>=list.length-1){i=list.length-1;k=0}
  var a=list[i],b=list[i+1]&&k>0?list[i+1]:null;
  var q=Math.round(k*STEPS)/STEPS;if(q>=1)render(i+1,0);else render(i,q);
  var t=b?a.t+(b.t-a.t)*k:a.t,cur=k<0.5||!b?a:b;
  showMarks(t);showPlaces(t);
  curT=t;curEmpty=layer==='rain'&&!!cur.empty;
  postPos(false);
}
function setMode(m){
  mode=m;stop();lastKey='';
  var list=frames[m],now=Date.now()/1000;
  var ticks=[],grads=[],nowF=0;
  if(list.length>1){var t0=list[0].t,t1=list[list.length-1].t,span=t1-t0,gstep=m==='12h'?3600:1800;
    nowF=Math.max(0,Math.min(1,(now-t0)/span));
    for(var h=Math.ceil(t0/3600)*3600;h<=t1;h+=3600){if(m!=='12h'||new Date(h*1000).getHours()%2===1)ticks.push({t:h,f:(h-t0)/span})}
    for(var g=Math.ceil(t0/gstep)*gstep;g<=t1;g+=gstep)grads.push((g-t0)/span)}
  post({type:'meta',mode:m,showModes:layer==='rain'&&frames['3h'].length>0&&frames['12h'].length>0,ticks:ticks,grads:grads,nowF:nowF});
  show(posAt(now));postPos(true);
}
function posAt(t){
  var list=frames[mode],n=list.length,i=0;if(n<2)return 0;
  while(i<n-2&&list[i+1].t<=t)i++;return i+Math.max(0,Math.min(1,(t-list[i].t)/(list[i+1].t-list[i].t||1)));
}
// Lecture par minuterie (une WebView cachée ne reçoit pas requestAnimationFrame)
function stop(){if(timer){clearInterval(timer);timer=null;postPos(true)}}
function togglePlay(){
  if(timer)return stop();var n=frames[mode].length;if(n<2)return;
  if(pos>=n-1)pos=0;var last=Date.now();
  timer=setInterval(function(){
    var n=frames[mode].length;if(n<2)return stop();
    var now=Date.now(),dt=Math.min(0.2,(now-last)/1000);last=now;
    var p=pos+dt*(mode==='12h'?1.2:2.5);if(p>n-1+0.6)p=0; // courte pause sur la dernière image, puis on recommence
    show(Math.min(p,n-1));pos=p;
  },50);
  postPos(true);
}

// ---- Pastilles : valeurs sur la grille (température, vent, air) ----
var markKey='';
function showMarks(t){
  if(layer==='rain'||!hourlyTemps){if(markKey!=='none'){markKey='none';post({type:'marks',items:[]})}return}
  var best=nearestIn(hourlyTimes,t),key=layer+best+(grid?grid.n+','+grid.w:'');if(key===markKey)return;markKey=key;
  var items=[],c=Math.floor(N/2);
  for(var i=1;i<N;i+=3){for(var j=1;j<N;j+=3){if(Math.abs(i-c)<1&&Math.abs(j-c)<1)continue;var k=i*N+j,it={lat:+lats[k],lon:+lons[k],text:''};
    if(layer==='wind'&&hourlyWind){var v=hourlyWind[k][best];it.text=v==null?'':String(Math.round(v));it.rot=(hourlyDir[k][best]||0)+180}
    else if(layer==='air'){var a=hourlyAir&&hourlyAir[k]?hourlyAir[k][nearestIn(hourlyAir.times,hourlyTimes[best])]:null;it.text=a==null?'':String(Math.round(a))}
    else{var x=hourlyTemps[k][best];it.text=x==null?'':String(Math.round(x))}
    if(it.text)items.push(it)}}
  post({type:'marks',items:items});
}

// ---- Température et temps aux lieux (bulle du lieu affiché, autres villes) ----
var placeData=null,placeKey='';
function loadPlaces(){
  var pts=[{lat:LAT,lon:LON}].concat(OTHERS);
  var u='https://api.open-meteo.com/v1/forecast?latitude='+pts.map(function(p){return p.lat.toFixed(3)}).join(',')+'&longitude='+pts.map(function(p){return p.lon.toFixed(3)}).join(',')+
    '&timeformat=unixtime&hourly=temperature_2m,weather_code,is_day&past_hours=4&forecast_hours=14';
  fetch(u).then(function(r){return r.json()}).then(function(arr){if(!Array.isArray(arr))arr=[arr];if(!arr[0]||!arr[0].hourly)return;placeData=arr;placeKey='';showPlaces(curT||Date.now()/1000)}).catch(function(){});
}
function showPlaces(t){
  if(!placeData)return;var h=placeData[0].hourly,k=nearestIn(h.time,t);if(placeKey===k)return;placeKey=k;
  var val=function(d,f){var a=d&&d.hourly&&d.hourly[f];return a&&a[k]!=null?a[k]:null};
  post({type:'places',me:{temp:val(placeData[0],'temperature_2m'),code:val(placeData[0],'weather_code'),day:val(placeData[0],'is_day')!==0},
    others:OTHERS.map(function(_,i){return val(placeData[i+1],'temperature_2m')})});
}

// ---- Prévision AROME (Open-Meteo) ----
// Open-Meteo (gratuit) compte chaque point de la grille comme une demande et bloque au-delà
// de 600 par minute : on garde donc la dernière réponse 10 min (même zone) et on réessaie en cas d'échec.
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
function applyForecast(fc){
  var now=Date.now()/1000,lastT=pastFrames.length?pastFrames[pastFrames.length-1].t:0;
  // Mode 3 h : radar seulement (2 h passées + 1re heure prolongée), comme l'app Météo d'Apple.
  // La grille AROME, bien plus grossière, n'est utilisée qu'en mode 12 h : les mélanger
  // faisait « sauter » l'image au passage de l'une à l'autre. Sans radar : AROME au quart d'heure.
  var nc=lastT?NOWCAST.map(function(m){return{kind:'nc',t:lastT+m*60,m:m,empty:false}}):[];
  frames['3h']=lastT?pastFrames.concat(nc):(fc?fc.quarter.filter(function(f){return f.t>now-900}):[]);
  frames['12h']=fc?fc.hourly:[];
  fcCache={};markKey='';
}
function loadAir(){
  var u='https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+lats.join(',')+'&longitude='+lons.join(',')+'&timeformat=unixtime&hourly=european_aqi&forecast_days=2';
  return fetch(u).then(function(r){return r.json()}).then(function(arr){if(!Array.isArray(arr))arr=[arr];
    hourlyAir=arr.map(function(p){return p.hourly&&p.hourly.european_aqi});hourlyAir.times=arr[0].hourly.time;
  }).catch(function(){msg('Qualité de l’air indisponible')});
}
function setLayer(l){
  layer=l;lastKey='';markKey='';fcCache={};
  if(l==='air'&&!hourlyAir){loadAir().then(function(){if(layer==='air'){lastKey='';markKey='';fcCache={};show(pos)}})}
  setMode(l==='rain'?mode:'12h');
}
// Prépare d'avance toutes les images radar de la zone, pour une lecture fluide
function preloadRadar(){
  if(!tiles||!rvHost||!pastFrames.length)return;var jobs=pastFrames.map(function(f){return function(){return radarImage(f.path)}})
    .concat(NOWCAST.map(function(m){return function(){return nowImage(m)}})),k=0;
  // puis les images intermédiaires de l'animation
  var seq=frames['3h'].filter(isRadar);
  for(var i=0;i+1<seq.length;i++)for(var s=1;s<STEPS;s++)(function(a,b,q){jobs.push(function(){return blendImage(a,b,q)})})(seq[i],seq[i+1],s/STEPS);
  (function next(){if(k<jobs.length)jobs[k++]().then(next,next)})();
}

// ---- Zone visible (envoyée par l'app quand on déplace / zoome la carte) ----
var reloadTimer=null, reloading=false;
function setView(v){
  view=v;var t=makeTiles(v);
  if(!tiles||t.key!==tiles.key){tiles=t;radCache={};lastKey='';show(pos);preloadRadar()}
  if(!grid||reloading)return;
  var spanNow=v.n-v.s,spanGrid=grid.n-grid.s;
  var inside=v.n<=grid.n&&v.s>=grid.s&&v.w>=grid.w&&v.e<=grid.e;
  if(inside&&spanNow>spanGrid*0.35)return; // la zone visible est déjà couverte, à une échelle adaptée
  clearTimeout(reloadTimer);
  reloadTimer=setTimeout(function(){
    reloading=true;makeGrid(view);
    loadForecast().then(function(fc){reloading=false;if(!fc)return;msg('');applyForecast(fc);lastKey='';var keep=pos;setMode(mode);show(Math.min(keep,frames[mode].length-1));
      if(layer==='air')loadAir().then(function(){lastKey='';markKey='';fcCache={};show(pos)})});
  },600);
}

// Commandes envoyées par l'app
window.rn={play:togglePlay,mode:function(m){if(frames[m]&&frames[m].length)setMode(m)},
  seek:function(f){stop();var list=frames[mode],n=list.length;if(!n)return;show(posAt(list[0].t+f*(list[n-1].t-list[0].t)));postPos(true)},
  layer:function(l){setLayer(l)},view:setView};

// ---- Démarrage ----
makeGrid(view);tiles=makeTiles(view);loadPlaces();
var forecast=loadForecast();
var radar=fetch('https://api.rainviewer.com/public/weather-maps.json').then(function(r){return r.json()}).then(function(d){
  rvHost=d.host;return((d.radar&&d.radar.past)||[]).map(function(f){return{kind:'radar',t:f.time,path:f.path}});
}).catch(function(){return[]});
Promise.all([forecast,radar]).then(function(res){
  var fc=res[0],past=res[1];pastFrames=past;
  applyForecast(fc);
  if(!frames['3h'].length&&!frames['12h'].length){msg('Carte indisponible pour le moment');post({type:'pos',f:0,t:0,empty:false,playing:false,unavailable:true});return}
  if(!fc){msg('Prévision en cours de chargement…');retryForecast(0)}else if(!past.length)msg('Radar indisponible : prévision seulement');
  setMode(frames['3h'].length?'3h':'12h');
  preloadRadar();
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
