// Moteur invisible de la carte (petite WebView cachée).
// La carte affichée est la vraie carte Apple Plans (react-native-maps) ; ce moteur s'occupe du reste :
//  - Passé : images radar observées (RainViewer, mosaïque incluant les radars Météo-France),
//    recolorées avec notre palette (neige à part) puis assemblées en une image pour la zone visible.
//  - Mode 3 h : radar passé, puis « radar prolongé » (dernier radar déplacé selon le mouvement
//    mesuré) jusqu'à +1 h après MAINTENANT, qui se fond dans la prévision AROME au quart d'heure
//    entre +40 et +70 min ; AROME seul ensuite (jusqu'à +1 h 30).
//  - Mode 12 h : prévision du modèle AROME de Météo-France (via Open-Meteo), calculée sur une grille
//    de 15 × 15 points couvrant la zone visible, à l'heure.
//  - Calques température / vent / qualité de l'air, températures des lieux.
// Il envoie à l'app (postMessage) les images à poser sur la carte, les pastilles à afficher
// et l'état de la frise ; l'app le pilote via window.rn (lecture, frise, calque, zone visible).
import { RV_RAIN, RV_SNOW } from './rainviewerColors';

export type MapView4 = { n: number; s: number; w: number; e: number; zoom: number };
export type EnginePlace = { lat: number; lon: number };

export function mapEngineHtml(lat: number, lon: number, others: EnginePlace[], view: MapView4) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><script>
var LAT=${lat}, LON=${lon}, OTHERS=${JSON.stringify(others)}, view=${JSON.stringify(view)};
function post(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o))}
function msg(t){post({type:'msg',text:t||''})}
function nearestIn(times,t){var best=0;for(var k=0;k<times.length;k++){if(Math.abs(times[k]-t)<Math.abs(times[best]-t))best=k}return best}

// ---- Palette de la pluie : mm/h → couleur ----
// Classes (mêmes seuils que la légende) : faible < 2,5 ; modérée 2,5–7,6 ; forte 7,6–15 ;
// très forte > 15 mm/h. Rien n'est dessiné sous 0,2 mm/h (fondu très court de 0,16 à 0,2).
var STOPS=[[0.16,[140,190,255,0]],[0.2,[140,190,255,.5]],[1,[100,155,250,.72]],[2.5,[78,124,245,.8]],[7.6,[122,92,240,.82]],[15,[199,125,255,.86]],[20,[255,242,122,.9]],[50,[255,255,220,.95]]];
// Neige (radar RainViewer seulement) : blanc rosé, bien distinct de la pluie.
var SNOW=[[0.16,[235,240,255,0]],[0.2,[235,240,255,.6]],[1,[246,228,255,.78]],[4,[250,185,240,.85]],[10,[255,130,215,.9]]];
var VMIN=0.2;
function color(stops,v){
  if(v<stops[0][0])return null;
  for(var k=1;k<stops.length;k++){if(v<=stops[k][0]){var a=stops[k-1],b=stops[k],f=(v-a[0])/(b[0]-a[0]);return a[1].map(function(x,i){return x+(b[1][i]-x)*f})}}
  return stops[stops.length-1][1];
}
// Intensité codée sur 0–255 (échelle logarithmique) et palettes précalculées.
var LMIN=0.08,LMAX=60;
function enc(v){return v<LMIN?0:Math.max(1,Math.min(255,Math.round(Math.log(v/LMIN)/Math.log(LMAX/LMIN)*254)+1))}
function dec(l){return LMIN*Math.pow(LMAX/LMIN,(l-1)/254)}
function palette(stops){var P=new Uint8ClampedArray(1024);
  for(var l=1;l<256;l++){var cc=color(stops,dec(l));if(cc){P[l*4]=cc[0];P[l*4+1]=cc[1];P[l*4+2]=cc[2];P[l*4+3]=Math.round(cc[3]*255)}}return P}
var PAL=palette(STOPS),PALS=palette(SNOW);

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
// Intensités codées (0–255) → couleurs de la palette ; S (facultatif) : part de neige 0–255
function paint(F,d,S){for(var j=0;j<F.length;j++){var L=Math.round(F[j]);if(L<1)continue;if(L>255)L=255;var P=S&&S[j]>=128?PALS:PAL;L*=4;var o=j*4;d[o]=P[L];d[o+1]=P[L+1];d[o+2]=P[L+2];d[o+3]=P[L+3]}}
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
  var g=fcGrid||grid;
  return{uri:finish(gridCanvas,0,2),bounds:[[g.n,g.e],[g.s,g.w]]};
}
var fcCache={};

// ---- Radar RainViewer : tuiles (zoom ≤ 7, palette 2 « Universal Blue », lissées, neige à part : 2/1_1) ----
// Même schéma que l'aperçu de l'écran principal (RadarPreview). Chaque couleur de tuile est une
// entrée exacte de la table officielle (rainviewer_api_colors_table.csv, colonne Universal Blue) :
// 128 couleurs « pluie » puis 128 « neige », une par dBZ. On retrouve la plus proche, d'où le dBZ,
// puis l'intensité : pluie Z = 200·R^1,6 (Marshall-Palmer), neige Z = 2000·S² (équivalent en eau).
// Tables de −10 à 66 dBZ (pluie) et de −10 à 74 dBZ (neige), au pas de 1 dBZ, en RRGGBBAA.
var RV_RAIN='${RV_RAIN}';
var RV_SNOW='${RV_SNOW}';
var RV=[];
(function(){
  function add(s,snow){for(var i=0;i<s.length;i+=8){var c=[0,2,4,6].map(function(k){return parseInt(s.substr(i+k,2),16)}),a=c[3]/255,z=Math.pow(10,(i/8-10)/10);
    if(c[3])RV.push({r:c[0]*a,g:c[1]*a,b:c[2]*a,a:c[3],snow:snow,v:snow?Math.sqrt(z/2000):Math.pow(z/200,1/1.6)})}}
  add(RV_RAIN,false);add(RV_SNOW,true);
})();
var lut={};
// couleur RainViewer → niveau codé (0–255), + 256 si c'est de la neige
function rvCode(r,g,b,a){
  var key=(r<<16|g<<8|b)+'/'+a;if(key in lut)return lut[key];
  var f=a/255,pr=r*f,pg=g*f,pb=b*f,best=null,bd=1e9; // comparaison en couleurs prémultipliées (bords transparents)
  for(var k=0;k<RV.length;k++){var e=RV[k],d=(e.r-pr)*(e.r-pr)+(e.g-pg)*(e.g-pg)+(e.b-pb)*(e.b-pb)+(e.a-a)*(e.a-a);if(d<bd){bd=d;best=e}}
  var L=best?enc(best.v):0;
  return lut[key]=L?L+(best.snow?256:0):0;
}
var levelCache={}; // url → Promise<{L: niveaux Uint8Array(65536), S: neige (0/255) ou null}, ou null>
function levels(url){
  if(!levelCache[url])levelCache[url]=new Promise(function(ok){
    var im=new Image();im.crossOrigin='anonymous';
    im.onload=function(){
      var c=document.createElement('canvas');c.width=c.height=256;var x=c.getContext('2d'),out=new Uint8Array(65536),S=null;x.drawImage(im,0,0);
      try{var p=x.getImageData(0,0,256,256).data;for(var i=0,j=0;i<p.length;i+=4,j++){if(p[i+3]){var code=rvCode(p[i],p[i+1],p[i+2],p[i+3]);out[j]=code&255;if(code>255){if(!S)S=new Uint8Array(65536);S[j]=255}}}}catch(e){}
      ok({L:out,S:S})};
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
// Niveaux bruts (0–255) d'une image radar, assemblés pour la zone visible (+ part de neige S, ou null)
function radarField(path){
  var T=tiles,key='f|'+path+'|'+T.key;if(radCache[key])return radCache[key];
  var jobs=[],m=Math.pow(2,T.z);
  for(var y=T.y0;y<=T.y1;y++)for(var x=T.x0;x<=T.x1;x++)jobs.push(levels(rvHost+path+'/256/'+T.z+'/'+(((x%m)+m)%m)+'/'+y+'/2/1_1.png'));
  return radCache[key]=Promise.all(jobs).then(function(arr){
    var nx=T.x1-T.x0+1,ny=T.y1-T.y0+1,W=nx*256,H=ny*256,F=new Uint8Array(W*H),S=null;
    arr.forEach(function(A,k){if(!A)return;var ox=(k%nx)*256,oy=Math.floor(k/nx)*256,L=A.L,Z=A.S;
      if(Z&&!S)S=new Uint8Array(W*H);
      for(var j=0;j<65536;j++){if(L[j]){var o=(oy+(j>>8))*W+ox+(j&255);F[o]=L[j];if(Z)S[o]=Z[j]}}});
    // Zone large : moitié de la résolution (4 fois moins de calcul et d'images plus légères,
    // indispensable pour les images intermédiaires de l'animation ; invisible après adoucissement)
    if(W>768){var w=W>>1,h=H>>1,G=new Uint8Array(w*h),S2=S?new Uint8Array(w*h):null;
      for(var y=0;y<h;y++)for(var x=0;x<w;x++){var o=2*y*W+2*x;G[y*w+x]=(F[o]+F[o+1]+F[o+W]+F[o+W+1]+2)>>2;
        if(S)S2[y*w+x]=(S[o]+S[o+1]+S[o+W]+S[o+W+1]+2)>>2}
      F=G;S=S2;W=w;H=h}
    return{F:F,W:W,H:H,T:T,S:S};
  });
}
// Niveaux → image (adoucie, colorée) posée sur la carte
function fieldImage(F,W,H,bounds,S){
  var c=document.createElement('canvas');c.width=W;c.height=H;var ctx=c.getContext('2d'),img=ctx.createImageData(W,H),G=new Float32Array(F),Z=null;
  soften(G,W,H,1);if(S){Z=new Float32Array(S);soften(Z,W,H,1)}
  paint(G,img.data,Z);ctx.putImageData(img,0,0);
  return{uri:finish(c,0,1),bounds:bounds};
}
function radarImage(path){
  var key='i|'+path+'|'+tiles.key;if(radCache[key])return radCache[key];
  return radCache[key]=radarField(path).then(function(r){return fieldImage(r.F,r.W,r.H,r.T.bounds,r.S)});
}
// ---- Prévision immédiate : on prolonge le mouvement de la pluie vu par le radar ----
// Comme l'app Météo d'Apple pour l'heure à venir : bien plus détaillé que la grille AROME.
// Déplacement mesuré entre l'image radar d'il y a 30 min et la dernière (recherche du meilleur
// décalage), pour toute la zone ET pour chacun de ses 4 quarts : la pluie ne va pas partout dans
// la même direction (front + averses). Un quart sans assez de pluie reprend le mouvement global ;
// entre les centres des quarts, le mouvement est interpolé. Même coût de calcul qu'un seul vecteur.
function motion(){
  var key='mv|'+tiles.key;if(radCache[key])return radCache[key];
  var n=pastFrames.length,zero={vx:0,vy:0};if(n<2)return Promise.resolve({q:[zero,zero,zero,zero]});
  var fa=pastFrames[Math.max(0,n-4)],fb=pastFrames[n-1];
  return radCache[key]=Promise.all([radarField(fa.path),radarField(fb.path)]).then(function(r){
    var W=r[0].W,H=r[0].H,S=4,w=Math.floor(W/S),h=Math.floor(H/S);
    function down(F){var o=new Float32Array(w*h);for(var y=0;y<h;y++)for(var x=0;x<w;x++){var s=0;for(var a=0;a<S;a++)for(var b=0;b<S;b++)s+=F[(y*S+a)*W+x*S+b];o[y*w+x]=s/(S*S)}return o}
    var A=down(r[0].F),B=down(r[1].F),R=10,D=2*R+1,sum=new Float64Array(D*D*4),cnt=new Float64Array(D*D*4);
    var qx=new Uint8Array(w),qy=new Uint8Array(h);for(var x=0;x<w;x++)qx[x]=x*2>=w?1:0;for(var y=0;y<h;y++)qy[y]=y*2>=h?2:0;
    for(var dy=-R;dy<=R;dy++)for(var dx=-R;dx<=R;dx++){var base=((dy+R)*D+dx+R)*4;
      for(var y=R;y<h-R;y+=2)for(var x=R;x<w-R;x+=2){var p=A[y*w+x],q=B[(y+dy)*w+x+dx];if(p||q){var k=base+qy[y]+qx[x];sum[k]+=Math.abs(p-q);cnt[k]++}}}
    // meilleur décalage (petite préférence pour les faibles déplacements, et pour un quart : pour le mouvement global)
    function best(sel,gx,gy,pull){var bs=1e18,bx=gx,by=gy,bc=0;
      for(var dy=-R;dy<=R;dy++)for(var dx=-R;dx<=R;dx++){var base=((dy+R)*D+dx+R)*4,s=0,c=0;
        for(var k=0;k<4;k++)if(sel<0||sel===k){s+=sum[base+k];c+=cnt[base+k]}
        if(!c)continue;s=s/c+0.15*(dx*dx+dy*dy)+pull*((dx-gx)*(dx-gx)+(dy-gy)*(dy-gy));
        if(s<bs){bs=s;bx=dx;by=dy;bc=c}}
      return{dx:bx,dy:by,c:bc}}
    var dt=Math.max(60,fb.t-fa.t),g=best(-1,0,0,0),out=[];
    for(var k=0;k<4;k++){var b=best(k,g.dx,g.dy,0.1);if(b.c<60)b=g;out.push({vx:b.dx*S/dt,vy:b.dy*S/dt})} // pixels par seconde
    return{q:out};
  });
}
// Prévision AROME du quart d'heure (interpolée à l'instant t) redessinée sur la grille du radar,
// pour la fondre avec le radar prolongé et combler le bord d'où arrive la pluie.
function aromeLevels(t,A){
  var key='ar|'+t+'|'+fcVer+'|'+A.T.key+'|'+A.W;if(radCache[key])return radCache[key];
  var Q=fcQuarter,g=fcGrid,k=0;while(k<Q.length-2&&Q[k+1].t<=t)k++;
  var a=Q[k],b=Q[Math.min(Q.length-1,k+1)],u=b.t>a.t?Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))):0;
  var G=a.vals.map(function(v,i){return enc(v)*(1-u)+enc(b.vals[i])*u}); // niveaux (échelle logarithmique)
  var W=A.W,H=A.H,T=A.T,nx=T.x1-T.x0+1,ny=T.y1-T.y0+1,out=new Uint8Array(W*H);
  var at=function(i,j){return G[Math.max(0,Math.min(N-1,i))*N+Math.max(0,Math.min(N-1,j))]};
  var cj=new Int16Array(W),cw=[];
  for(var x=0;x<W;x++){var gx=(x2lon(T.x0+(x+0.5)/W*nx,T.z)-g.w)/(g.e-g.w)*(N-1);
    if(gx<0||gx>N-1){cj[x]=-99;cw.push(null);continue}var j0=Math.min(N-2,Math.floor(gx));cj[x]=j0;cw.push(cubic(gx-j0))}
  for(var y=0;y<H;y++){var gy=(g.n-y2lat(T.y0+(y+0.5)/H*ny,T.z))/(g.n-g.s)*(N-1);if(gy<0||gy>N-1)continue;
    var i0=Math.min(N-2,Math.floor(gy)),wy=cubic(gy-i0);
    for(var x=0;x<W;x++){var j0=cj[x];if(j0<-1)continue;var wx=cw[x],v=0;
      for(var p=0;p<4;p++){var row=0;for(var q=0;q<4;q++)row+=wx[q]*at(i0-1+p,j0-1+q);v+=wy[p]*row}
      if(v>=1)out[y*W+x]=Math.min(255,Math.round(v))}}
  return radCache[key]=out;
}
// Pluie à l'instant f.t (f.m minutes après la dernière image radar) : dernière image radar déplacée,
// qui s'estompe doucement — plus vite pour les échos faibles (petites averses éphémères) que pour
// les fortes — et s'adoucit avec l'échéance (le détail fin n'est plus prévisible). f.w : part
// d'AROME (0 → 1 entre +40 et +70 min après maintenant) ; AROME remplit aussi le bord « au vent ».
function nowField(f){
  var key='ncf|'+fkey(f)+'|'+tiles.key;if(radCache[key])return radCache[key];
  var last=pastFrames[pastFrames.length-1];
  return radCache[key]=Promise.all([radarField(last.path),motion()]).then(function(r){
    var A=r[0],q=r[1].q,W=A.W,H=A.H,wt=f.w||0,dt=f.m*60,M=fcQuarter?aromeLevels(f.t,A):null;
    if(M&&wt>=1)return{F:M,W:W,H:H,T:A.T,S:null};
    var G=new Uint8Array(W*H),S=A.S?new Uint8Array(W*H):null,fk=14*f.m/60;
    for(var y=0;y<H;y++){var fy=Math.max(0,Math.min(1,(y+0.5)/H*2-0.5)),
        lx=q[0].vx+(q[2].vx-q[0].vx)*fy,ly=q[0].vy+(q[2].vy-q[0].vy)*fy,rx=q[1].vx+(q[3].vx-q[1].vx)*fy,ry=q[1].vy+(q[3].vy-q[1].vy)*fy;
      for(var x=0;x<W;x++){var fx=Math.max(0,Math.min(1,(x+0.5)/W*2-0.5)),
          sx=Math.round(x-(lx+(rx-lx)*fx)*dt),sy=Math.round(y-(ly+(ry-ly)*fx)*dt),j=y*W+x;
        if(sx>=0&&sx<W&&sy>=0&&sy<H){var s=sy*W+sx,L=A.F[s];if(L){G[j]=Math.max(0,Math.round(L-fk*(1.25-L/255)));if(S)S[j]=A.S[s]}}
        else if(M)G[j]=M[j]}}
    var rad=Math.min(3,Math.floor(f.m/25));
    if(rad){var Fl=new Float32Array(G);soften(Fl,W,H,rad);for(var j=0;j<G.length;j++)G[j]=Math.round(Fl[j])}
    if(M&&wt>0){for(var j=0;j<G.length;j++){G[j]=Math.round(G[j]*(1-wt)+M[j]*wt);if(S)S[j]=Math.round(S[j]*(1-wt))}}
    return{F:G,W:W,H:H,T:A.T,S:S};
  });
}
function nowImage(f){
  var key='nc|'+fkey(f)+'|'+tiles.key;if(radCache[key])return radCache[key];
  return radCache[key]=nowField(f).then(function(r){return fieldImage(r.F,r.W,r.H,r.T.bounds,r.S)});
}
function isRadar(f){return f.kind==='radar'||f.kind==='nc'} // image fabriquée sur la grille du radar
function fkey(f){return f.kind==='radar'?f.path:'nc'+f.m+'/'+f.w+'/'+fcVer}
function frameField(f){return f.kind==='radar'?radarField(f.path):nowField(f)}
function frameImage(f){return f.kind==='radar'?radarImage(f.path):nowImage(f)}
// ---- Animation fluide ----
// La carte Apple ne sait pas rendre une image à moitié transparente : pour que la pluie glisse
// d'une image à l'autre (au lieu de sauter), on fabrique des images intermédiaires (¼, ½, ¾)
// en mélangeant les intensités des deux images voisines.
var STEPS=4;
function blendImage(a,b,q){
  var key='bl|'+fkey(a)+'|'+fkey(b)+'|'+q+'|'+tiles.key;if(radCache[key])return radCache[key];
  return radCache[key]=Promise.all([frameField(a),frameField(b)]).then(function(r){
    var A=r[0].F,B=r[1].F,G=new Uint8Array(A.length),SA=r[0].S,SB=r[1].S,S=SA||SB?new Uint8Array(A.length):null;
    for(var j=0;j<A.length;j++){var x=A[j],y=B[j];if(x||y)G[j]=Math.round(x*(1-q)+y*q)}
    if(S)for(var j=0;j<A.length;j++)S[j]=Math.round((SA?SA[j]:0)*(1-q)+(SB?SB[j]:0)*q);
    return fieldImage(G,r[0].W,r[0].H,r[0].T.bounds,S);
  });
}
// Mode 3 h (avec radar) : images toutes les 10 min depuis la dernière image radar jusqu'à
// +1 h après maintenant (+1 h 30 si AROME est là) ; AROME prend le relais de +40 à +70 min.
var NC_STEP=600,NC_END=3600,FC_END=5400,BLEND0=2400,BLEND1=4200,PAST_FC=5400;
var fcQuarter=null,fcGrid=null,fcVer=0;

// ---- Frise : images (passé radar + prévision) et lecture ----
var frames={'3h':[],'12h':[]}, mode='3h', layer='rain', rvHost='', pastFrames=[];
var hourlyTemps=null, hourlyTimes=[], hourlyWind=null, hourlyDir=null, hourlyAir=null;
var pos=0, timer=null, lastKey='', shown=null, curT=0, curEmpty=false, curSrc='';
var lastPost=0,lastText='';
function postPos(force){
  var list=frames[mode],n=list.length,t0=n?list[0].t:0,t1=n?list[n-1].t:0,f=t1>t0?(curT-t0)/(t1-t0):0,txt=Math.round(curT/60)+'|'+curEmpty+'|'+curSrc+'|'+!!timer,ts=Date.now();
  if(!force&&txt===lastText&&ts-lastPost<33)return;lastPost=ts;lastText=txt;
  post({type:'pos',f:Math.max(0,Math.min(1,f)),t:curT,empty:curEmpty,src:curSrc,playing:!!timer});
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
  var key=layer+mode+i+'/'+q+'|'+(tiles?tiles.key:'')+'|'+fcVer;
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
  // source de l'image affichée, pour le titre de la frise : radar, radar prolongé ou AROME
  curSrc=layer!=='rain'?'':cur.kind==='radar'?'radar':cur.kind==='nc'&&cur.w<0.5?'nc':'arome';
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
    '&models=meteofrance_seamless&timeformat=unixtime&minutely_15=precipitation&forecast_minutely_15=12&hourly=precipitation,temperature_2m,wind_speed_10m,wind_direction_10m&past_hours=3&forecast_hours=14';
  var cached=cacheGet(url);
  var g=grid; // la grille peut changer pendant le chargement : on garde celle de la demande
  return (cached?Promise.resolve(cached):fetch(url).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(d){cachePut(url,d);return d})).then(function(arr){
    if(!Array.isArray(arr))arr=[arr];
    var q=arr[0].minutely_15.time, h=arr[0].hourly.time;
    hourlyTimes=h;hourlyTemps=arr.map(function(p){return p.hourly.temperature_2m});
    hourlyWind=arr.map(function(p){return p.hourly.wind_speed_10m||[]});hourlyDir=arr.map(function(p){return p.hourly.wind_direction_10m||[]});
    hourlyAir=null;
    // Open-Meteo : la pluie datée t est le CUMUL de la période qui SE TERMINE à t (15 min ou 1 h).
    // Pour qu'une image datée T montre la pluie qui tombe autour de T :
    //  - quart d'heure : chaque valeur est datée au MILIEU de sa période (t − 7 min 30) ;
    //  - heure : l'image de l'heure t (alignée sur température et vent, instantanés à t) prend le
    //    cumul de t à t + 1 h, c'est-à-dire la valeur datée t + 1 h (d'où une heure de plus demandée).
    var quarter=q.map(function(t,k){var v=arr.map(function(p){return (p.minutely_15.precipitation[k]||0)*4});return{kind:'fc',t:t-450,vals:v,empty:!v.some(function(x){return x>=VMIN})}});
    var hourly=h.slice(0,-1).map(function(t,k){var v=arr.map(function(p){return p.hourly.precipitation[k+1]||0});return{kind:'fc',t:t,vals:v,empty:!v.some(function(x){return x>=VMIN})}});
    return{quarter:quarter,hourly:hourly,grid:g};
  }).catch(function(){return null});
}
function applyForecast(fc){
  var now=Date.now()/1000,lastT=pastFrames.length?pastFrames[pastFrames.length-1].t:0;
  if(fc){fcGrid=fc.grid;fcQuarter=fc.quarter.length>1?fc.quarter:null}
  fcVer++;
  // Mode 3 h avec radar : radar passé, puis radar prolongé jusqu'à +1 h après MAINTENANT (la
  // dernière image radar a souvent 10–20 min : on la déplace donc de tout l'écart réel). Si AROME
  // couvre la suite, la frise continue jusqu'à +1 h 30 avec AROME redessiné sur la grille du radar.
  // Le passage ne « saute » plus (cf. commit 11bd99e) : même grille et même emprise que le radar,
  // fondu progressif sur 30 min (+40 → +70 min) et radar prolongé de plus en plus adouci.
  // Le passé est alors réduit à 1 h 30 pour garder environ 3 h. Sans radar : AROME au quart d'heure.
  var ar=lastT&&fcQuarter&&fcQuarter[fcQuarter.length-1].t>=now+FC_END-900;
  if(lastT){
    var end=now+(ar?FC_END:NC_END),fut=[];
    for(var t=lastT+NC_STEP;fut.length<16;t+=NC_STEP){
      var w=ar?Math.max(0,Math.min(1,(t-now-BLEND0)/(BLEND1-BLEND0))):0;
      fut.push({kind:'nc',t:t,m:Math.round((t-lastT)/60),w:Math.round(w*20)/20,empty:false});
      if(t>=end)break;
    }
    frames['3h']=(ar?pastFrames.filter(function(f){return f.t>=now-PAST_FC}):pastFrames).concat(fut);
  }else frames['3h']=fc?fc.quarter.filter(function(f){return f.t>now-900}):[];
  frames['12h']=fc?fc.hourly:frames['12h'];
  // les images prolongées dépendent de la prévision et de l'heure : on les refera
  for(var k in radCache)if(k.indexOf('f|')!==0&&k.indexOf('i|')!==0&&k.indexOf('mv|')!==0)delete radCache[k];
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
var preGen=0;
function preloadRadar(){
  if(!tiles||!rvHost||!pastFrames.length)return;
  var seq=frames['3h'].filter(isRadar),gen=++preGen,k=0,jobs=seq.map(function(f){return function(){return frameImage(f)}});
  // puis les images intermédiaires de l'animation
  for(var i=0;i+1<seq.length;i++)for(var s=1;s<STEPS;s++)(function(a,b,q){jobs.push(function(){return blendImage(a,b,q)})})(seq[i],seq[i+1],s/STEPS);
  (function next(){if(gen===preGen&&k<jobs.length)jobs[k++]().then(next,next)})(); // une seule préparation à la fois
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
    loadForecast().then(function(fc){reloading=false;if(!fc)return;msg('');applyForecast(fc);lastKey='';var keep=pos;setMode(mode);show(Math.min(keep,frames[mode].length-1));preloadRadar();
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
      msg('');applyForecast(fc);lastKey='';setMode(frames['3h'].length?mode:'12h');preloadRadar();
    });
  },RETRY[n]*1000);
}
</script></body></html>`;
}
