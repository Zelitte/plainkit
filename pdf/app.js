/* plainkit. PDF dielňa — všetko v prehliadači.
   Model: zoznam "page" položiek, každá ukazuje na zdrojový dokument (srcIndex)
   + index strany v ňom (origPage) + rotácia navyše (rot). Poradie v poli = poradie vo výstupe. */

/* Knižnice beriem lenivo — keby sa niektorá nenačítala (napr. v náhľade
   bez vedľajších súborov), appka nepadne na vrchu a UI ostane živé. */
let PDFDocument, degrees, libsReady=false;
function ensureLibs(){
  if(libsReady) return true;
  const missing=[];
  if(typeof PDFLib==='undefined') missing.push('pdf-lib.min.js');
  if(typeof pdfjsLib==='undefined') missing.push('pdf.min.js');
  if(typeof JSZip==='undefined') missing.push('jszip.min.js');
  if(missing.length){
    toast('Chýbajú knižnice: <b>'+missing.join(', ')+'</b>. Otvor stránku cez plainkit.app, nie ako samostatný súbor.','err');
    return false;
  }
  ({ PDFDocument, degrees } = PDFLib);
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  libsReady=true;
  return true;
}

const $ = s => document.querySelector(s);
const grid = $('#grid');

// stav
const srcDocs = [];   // { name, bytes(Uint8Array), pdfjsDoc }
let pages = [];       // { id, srcIndex, origPage(0-based), rot(0/90/180/270), sel }
let idSeq = 1;

/* ---------- pomocné UI ---------- */
function toast(msg, kind){
  const t=document.createElement('div');
  t.className='toast'+(kind?' '+kind:'');
  t.innerHTML=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},2600);
}
function busy(on,lbl){ $('#busy').classList.toggle('on',on); if(lbl)$('#busyLbl').textContent=lbl; }

/* ---------- načítanie súborov ---------- */
async function addFiles(fileList){
  if(!ensureLibs()) return;
  const files=[...fileList].filter(f=>f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'));
  if(!files.length){ toast('Vyber prosím PDF súbory.','err'); return; }
  busy(true,'Načítavam súbory…');
  for(const f of files){
    try{
      const bytes=new Uint8Array(await f.arrayBuffer());
      // pdf.js si drží vlastnú kópiu — dáme mu klon, nech nám pdf-lib neskôr nepokazí buffer
      const pdfjsDoc=await pdfjsLib.getDocument({data:bytes.slice()}).promise;
      const srcIndex=srcDocs.length;
      srcDocs.push({name:f.name,bytes,pdfjsDoc});
      for(let p=0;p<pdfjsDoc.numPages;p++){
        pages.push({id:idSeq++,srcIndex,origPage:p,rot:0,sel:false});
      }
    }catch(e){
      console.error(e);
      toast('Súbor <b>'+f.name+'</b> sa nepodarilo otvoriť (možno je chránený heslom).','err');
    }
  }
  busy(false);
  enterWorkspace();
  render();
}

function enterWorkspace(){
  $('#drop').style.display='none';
  $('#workspace').hidden=false;
}

/* ---------- render mriežky ---------- */
function render(){
  grid.innerHTML='';
  if(!pages.length){
    grid.innerHTML='<div class="empty">Žiadne strany. Pridaj PDF súbor.</div>';
    syncToolbar();
    return;
  }
  pages.forEach((pg,idx)=>{
    const el=document.createElement('div');
    el.className='page'+(pg.sel?' sel':'');
    el.draggable=true;
    el.dataset.idx=idx;
    el.innerHTML=`
      <div class="canvas-wrap"><div class="ph">…</div></div>
      ${pg.rot?`<div class="rot-badge">${pg.rot}°</div>`:''}
      <div class="pick"></div>
      <div class="meta">
        <span class="pno mono">#${idx+1}</span>
        <span class="src" title="${srcDocs[pg.srcIndex].name}">${srcDocs[pg.srcIndex].name}</span>
      </div>`;
    grid.appendChild(el);

    // výber (klik mimo drag)
    el.querySelector('.pick').addEventListener('click',e=>{e.stopPropagation();pg.sel=!pg.sel;el.classList.toggle('sel',pg.sel);syncToolbar();});
    el.addEventListener('click',()=>{pg.sel=!pg.sel;el.classList.toggle('sel',pg.sel);syncToolbar();});

    // drag&drop
    el.addEventListener('dragstart',e=>{dragIdx=idx;el.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    el.addEventListener('dragend',()=>{el.classList.add('dragging');el.classList.remove('dragging');clearDropMarks();dragIdx=null;});
    el.addEventListener('dragover',e=>{e.preventDefault();markDrop(el,e);});
    el.addEventListener('dragleave',()=>{el.classList.remove('drop-before','drop-after');});
    el.addEventListener('drop',e=>{e.preventDefault();doDrop(idx,el,e);});

    renderThumb(pg,el.querySelector('.canvas-wrap'));
  });
  syncToolbar();
}

let dragIdx=null;
function markDrop(el,e){
  clearDropMarks();
  const r=el.getBoundingClientRect();
  const after=(e.clientX-r.left)>r.width/2;
  el.classList.add(after?'drop-after':'drop-before');
}
function clearDropMarks(){document.querySelectorAll('.page').forEach(p=>p.classList.remove('drop-before','drop-after'));}
function doDrop(targetIdx,el,e){
  if(dragIdx===null||dragIdx===targetIdx){clearDropMarks();return;}
  const r=el.getBoundingClientRect();
  const after=(e.clientX-r.left)>r.width/2;
  let insertAt=after?targetIdx+1:targetIdx;
  const moved=pages.splice(dragIdx,1)[0];
  if(dragIdx<insertAt)insertAt--;
  pages.splice(insertAt,0,moved);
  clearDropMarks();
  render();
}

/* ---------- náhľad strany cez pdf.js ---------- */
async function renderThumb(pg,wrap){
  try{
    const page=await srcDocs[pg.srcIndex].pdfjsDoc.getPage(pg.origPage+1);
    const baseRot=page.rotate||0;
    const vp=page.getViewport({scale:1,rotation:(baseRot+pg.rot)%360});
    const scale=Math.min(300/vp.width,1.2);
    const v=page.getViewport({scale,rotation:(baseRot+pg.rot)%360});
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;
    wrap.innerHTML='';wrap.appendChild(canvas);
  }catch(e){ wrap.innerHTML='<div class="ph">náhľad zlyhal</div>'; }
}

/* ---------- toolbar stav ---------- */
function selected(){return pages.filter(p=>p.sel);}
function syncToolbar(){
  const n=selected().length;
  $('#selInfo').textContent=n+' vybraných';
  const hasAny=pages.length>0;
  const target=n>0; // operácie potrebujú výber alebo padnú na "všetko"
  $('#rotL').disabled=!hasAny;
  $('#rotR').disabled=!hasAny;
  $('#del').disabled=!hasAny;
  $('#save').disabled=!hasAny;
  $('#splitBtn').disabled=!hasAny;
}

/* na ktorých stranách pracovať: vybrané, alebo všetky ak nič nevybrané */
function workingSet(){
  const sel=selected();
  return sel.length?sel:pages;
}

/* ---------- operácie ---------- */
function rotate(dir){
  const set=workingSet();
  set.forEach(p=>{p.rot=((p.rot+dir*90)%360+360)%360;});
  render();
}
function delPages(){
  const sel=selected();
  if(!sel.length){toast('Najprv označ strany, ktoré chceš zmazať.','err');return;}
  if(sel.length===pages.length){toast('Nemôžeš zmazať všetky strany.','err');return;}
  pages=pages.filter(p=>!p.sel);
  render();
  toast(sel.length+' '+plural(sel.length,'strana zmazaná','strany zmazané','strán zmazaných'),'ok');
}
function plural(n,one,few,many){
  if(n===1)return one;
  if(n>=2&&n<=4)return few;
  return many;
}

/* zostav výstupné PDF z aktuálneho poradia + rotácií */
async function buildPdf(pageItems){
  const out=await PDFDocument.create();
  // cache načítaných pdf-lib dokumentov podľa srcIndex
  const cache={};
  // zoskup podľa srcIndex pre dávkové copyPages (rýchlejšie), ale poradie musí sedieť → kopírujeme po jednom v poradí
  for(const pg of pageItems){
    if(!cache[pg.srcIndex]){
      cache[pg.srcIndex]=await PDFDocument.load(srcDocs[pg.srcIndex].bytes,{ignoreEncryption:true});
    }
    const [copied]=await out.copyPages(cache[pg.srcIndex],[pg.origPage]);
    if(pg.rot){
      const cur=copied.getRotation().angle||0;
      copied.setRotation(degrees((cur+pg.rot)%360));
    }
    out.addPage(copied);
  }
  // čistenie metadát — žiadne stopy
  out.setTitle('');out.setAuthor('');out.setSubject('');
  out.setKeywords([]);out.setProducer('');out.setCreator('');
  return out;
}

async function save(){
  if(!pages.length)return;
  busy(true,'Skladám PDF…');
  try{
    const out=await buildPdf(pages);
    const bytes=await out.save();
    download(bytes,'plainkit-dokument.pdf');
    toast('Hotovo — <b>'+pages.length+'</b> '+plural(pages.length,'strana','strany','strán')+', metadáta vyčistené.','ok');
  }catch(e){console.error(e);toast('Uloženie zlyhalo: '+e.message,'err');}
  busy(false);
}

function download(bytes,name){
  const blob=new Blob([bytes],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/* ---------- rozdelenie na ZIP ---------- */
function parseRanges(str,max){
  const out=[];
  for(const chunk of str.split(',')){
    const s=chunk.trim();if(!s)continue;
    const m=s.match(/^(\d+)\s*-\s*(\d+)$/);
    if(m){
      let a=+m[1],b=+m[2];if(a>b)[a,b]=[b,a];
      if(a<1||b>max)throw new Error('Rozsah '+s+' je mimo (1–'+max+').');
      const arr=[];for(let i=a;i<=b;i++)arr.push(i-1);out.push({label:s,idx:arr});
    }else if(/^\d+$/.test(s)){
      const n=+s;if(n<1||n>max)throw new Error('Strana '+n+' je mimo (1–'+max+').');
      out.push({label:s,idx:[n-1]});
    }else throw new Error('Nerozumiem rozsahu "'+s+'".');
  }
  if(!out.length)throw new Error('Zadaj aspoň jeden rozsah.');
  return out;
}

async function doSplit(){
  if(!ensureLibs()) return;
  const raw=$('#splitInput').value.trim();
  let ranges;
  try{ranges=parseRanges(raw,pages.length);}
  catch(e){toast(e.message,'err');return;}
  closeSplit();
  busy(true,'Rozdeľujem…');
  try{
    const zip=new JSZip();
    let i=1;
    for(const rng of ranges){
      const subset=rng.idx.map(k=>pages[k]);
      const out=await buildPdf(subset);
      const bytes=await out.save();
      zip.file(`cast-${i}_strany-${rng.label.replace(/\s/g,'')}.pdf`,bytes);
      i++;
    }
    const blob=await zip.generateAsync({type:'blob'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='plainkit-rozdelene.zip';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast('Rozdelené na <b>'+ranges.length+'</b> '+plural(ranges.length,'súbor','súbory','súborov')+' v ZIP.','ok');
  }catch(e){console.error(e);toast('Rozdelenie zlyhalo: '+e.message,'err');}
  busy(false);
}
function openSplit(){$('#splitInput').value='1-'+pages.length;$('#splitModal').classList.add('on');$('#splitInput').focus();$('#splitInput').select();}
function closeSplit(){$('#splitModal').classList.remove('on');}

/* ---------- naviazanie ---------- */
$('#drop').addEventListener('click',()=>$('#file').click());
$('#drop').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file').click();}});
$('#addMore').addEventListener('click',()=>$('#file').click());
$('#file').addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});

// dropzóna
const dz=$('#drop');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();dz.classList.add('hot');}));
['dragleave'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();dz.classList.remove('hot');}));
dz.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();dz.classList.remove('hot');if(e.dataTransfer.files&&e.dataTransfer.files.length)addFiles(e.dataTransfer.files);});

// celé okno: zabráni prehliadaču otvoriť PDF v karte pri minutí dropzóny;
// a ak je workspace otvorený, pustený súbor mimo strany pridá ďalšie PDF.
window.addEventListener('dragover',e=>{e.preventDefault();});
window.addEventListener('drop',e=>{
  if(e.target.closest('#drop'))return;      // už ošetrené dropzónou
  if(e.target.closest('.page'))return;      // poradie strán rieši grid
  e.preventDefault();
  if($('#workspace').hidden)return;
  if(e.dataTransfer.files&&e.dataTransfer.files.length)addFiles(e.dataTransfer.files);
});

$('#selAll').addEventListener('click',()=>{pages.forEach(p=>p.sel=true);render();});
$('#selNone').addEventListener('click',()=>{pages.forEach(p=>p.sel=false);render();});
$('#rotL').addEventListener('click',()=>rotate(-1));
$('#rotR').addEventListener('click',()=>rotate(1));
$('#del').addEventListener('click',delPages);
$('#save').addEventListener('click',save);
$('#splitBtn').addEventListener('click',openSplit);
$('#splitCancel').addEventListener('click',closeSplit);
$('#splitGo').addEventListener('click',doSplit);
$('#splitModal').addEventListener('click',e=>{if(e.target.id==='splitModal')closeSplit();});
$('#splitInput').addEventListener('keydown',e=>{if(e.key==='Enter')doSplit();if(e.key==='Escape')closeSplit();});
