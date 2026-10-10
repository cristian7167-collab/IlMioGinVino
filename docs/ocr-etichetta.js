/* Il Mio Gin e Il Mio Vino: OCR gratuito eseguito nel browser.
   Le foto rimangono sul dispositivo: scarichiamo solo il motore OCR e i dizionari.
   Versione 2026-10-10 migliorata - patch OCR 6 / Nessuna API e nessun riconoscimento cloud. */
(function (root) {
  'use strict';
  var type = document.body.dataset.collection === 'vino' ? 'vino' : 'gin';
  var el = function (id) { return document.getElementById(id); };
  var lastPhoto = null;
  var revision = 0;
  var busy = false;
  var workerPromise = null;
  var loadPromise = null;
  var touchedCountry = false;
  var internalWrite = false;
  var editingExisting = false;
  var currentLabel = '';
  var cropRegion = null;
  var autoFilled = {};
  var cropURL = null;

  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function has(hay, needle) {
    return (' ' + fold(hay) + ' ').includes(' ' + fold(needle) + ' ');
  }
  var countries = [
    ['Italia', ['italia','italy','italian','made in italy','prodotto in italia']],
    ['Spagna', ['espana','espa\u00f1a','spain','spanish','spagna']],
    ['Francia', ['france','francia','french']],
    ['Regno Unito', ['united kingdom','great britain','england','uk']],
    ['Scozia', ['scotland','scozia','scottish']],
    ['Irlanda', ['ireland','eire','irlanda']],
    ['Germania', ['germany','deutschland','germania']],
    ['Portogallo', ['portugal','portogallo']],
    ['Austria', ['austria']],
    ['Grecia', ['greece','grecia','hellas']],
    ['Stati Uniti', ['united states','usa','united states of america']],
    ['Giappone', ['japan','giappone']],
    ['Sudafrica', ['south africa','sudafrica']],
    ['Argentina', ['argentina']],
    ['Cile', ['chile','cile']],
    ['Australia', ['australia']],
    ['Nuova Zelanda', ['new zealand','nuova zelanda']]
  ];
  var regions = [
    ['Piemonte','Italia',['piemonte','piedmont','barolo','barbaresco','nebbiolo d alba','langhe','gavi','roero','asti','monferrato']],
    ['Toscana','Italia',['toscana','tuscany','chianti','montalcino','bolgheri','brunello','montepulciano','morellino di scansano']],
    ['Veneto','Italia',['veneto','valpolicella','amarone','soave','bardolino','valdobbiadene']],
    ['Lombardia','Italia',['lombardia','lombardy','franciacorta','oltrepo pavese','valtellina']],
    ['Trentino-Alto Adige','Italia',['trentino','alto adige','sudtirol','s\u00fcdtirol','trentino alto adige']],
    ['Friuli-Venezia Giulia','Italia',['friuli','collio','colli orientali del friuli']],
    ['Sicilia','Italia',['sicilia','sicily','etna doc','marsala','vittoria docg']],
    ['Sardegna','Italia',['sardegna','sardinia','gallura','vermentino di sardegna']],
    ['Campania','Italia',['campania','taurasi','fiano di avellino','greco di tufo']],
    ['Puglia','Italia',['puglia','apulia','salento','primitivo di manduria']],
    ['Emilia-Romagna','Italia',['emilia romagna','romagna','lambrusco di sorbara']],
    ['Liguria','Italia',['liguria','cinque terre']],
    ['Umbria','Italia',['umbria','sagrantino di montefalco']],
    ['Marche','Italia',['marche','verdicchio dei castelli di jesi']],
    ['Abruzzo','Italia',['abruzzo','montepulciano d abruzzo']],
    ['Lazio','Italia',['lazio','frascati']],
    ['Molise','Italia',['molise']],
    ['Basilicata','Italia',['basilicata','aglianico del vulture']],
    ['Calabria','Italia',['calabria','ciro doc']],
    ['Valle d\u0027Aosta','Italia',['valle d aosta','vallee d aoste']],
    ['Catalogna','Spagna',['catalogna','catalunya','cataluna','catalu\u00f1a','catalonia','priorat','penedes','pened\u00e8s']],
    ['La Rioja','Spagna',['rioja']],
    ['Castiglia e Leon','Spagna',['castilla y leon','ribera del duero','rueda']],
    ['Galizia','Spagna',['galicia','r\u00edas baixas','rias baixas']],
    ['Andalusia','Spagna',['andalucia','andalusia','jerez','sherry']],
    ['Bordeaux','Francia',['bordeaux','medoc','m\u00e9doc','saint emilion','pomerol']],
    ['Borgogna','Francia',['bourgogne','burgundy','borgogna','chablis','cote de nuits','c\u00f4te de nuits']],
    ['Champagne','Francia',['champagne','reims','epernay']],
    ['Nuova Aquitania','Francia',['nouvelle aquitaine','nuova aquitania','charente','charente maritime']],
    ['Loira','Francia',['loire','sancerre','pouilly fume','pouilly fum\u00e9']],
    ['Rodano','Francia',['rhone','rh\u00f4ne','chateauneuf du pape','ch\u00e2teauneuf du pape']],
    ['Provenza','Francia',['provence','provenza']],
    ['Alsazia','Francia',['alsace','alsazia']],
    ['Scozia','Regno Unito',['scotland','scozia','highlands','islay']],
    ['Londra','Regno Unito',['london','londra']],
    ['Porto','Portogallo',['douro','porto']],
    ['Alentejo','Portogallo',['alentejo']],
    ['Napa Valley','Stati Uniti',['napa valley','napa']],
    ['Mendoza','Argentina',['mendoza']]
  ];
  var ignorable = /^(gin|gin (de|from|in) (france|italia|italy|spain|espana|england)|dry gin|london dry gin|distilled gin|vino|wine|red wine|white wine|rose|ros\u00e9|alc|vol|alcohol|prodotto|produced|imbottigliato|bottled|distilled|750\s?ml|70\s?cl|100\s?cl|doc|docg|igt|organic|bio|superiore|riserva|original|premium)$/i;
  var textBlacklist = /\b(alc\.?|%\s?vol|\d+\s?ml|\d+\s?cl|\d+\s?litri|ingredients|ingredienti|lotto|contiene|contains|barcode|consumo|servire|alc[o\u00f2]l|www\.|\.com|codice|imported by|distributed by|best before)\b/i;
  function tidy(s) {
    return String(s || '').replace(/^[\s:;,\-]+|[\s:;,\-]+$/g, '')
      .replace(/\s+/g, ' ').replace(/[|\u2022]/g, ' ').trim();
  }
  function possibleName(s) {
    var t = tidy(s);
    if (t.length < 4 || t.length > 64 || !/[a-zA-Z\u00c0-\u024f]{3}/.test(t) || !/[a-z]/i.test(t)) return false;
    if (textBlacklist.test(t) || ignorable.test(t)) return false;
    if (countries.some(function(c){return c[1].some(function(x){return fold(t)===fold(x);});})) return false;
    if (regions.some(function(r){return fold(t)===fold(r[0]);})) return false;
    if (/^\d{4}$/.test(t) || /^\d{1,3}[.,]\d/.test(t)) return false;
    if (/^(italia|spagna|francia|prodotto da|made in|prodotto in|product of|producido por|denominazione|indicazione geografica|appellation|distillery|cantina)\b/i.test(t)) return false;
    return true;
  }
  function parse(raw, kind) {
    kind = kind === 'vino' ? 'vino' : 'gin';
    var lines = String(raw || '').split(/\r?\n/).map(tidy).filter(function (v) {return v.length > 1;}).slice(0, 90);
    var full = lines.join(' ');
    var result = {name:'',producer:'',country:'',region:'',grape:'',vintage:'',appellation:'',raw:raw || '',reasons:[]};
    // Country from explicit wording only, or from a strongly identified region.
    for (var i=0; i<countries.length; i++) {
      if (countries[i][1].some(function (n) { return has(full,n); })) { result.country = countries[i][0]; result.reasons.push('Nazione stampata sull\u0027etichetta'); break; }
    }
    for (var j=0; j<regions.length; j++) {
      var r = regions[j];
      if (r[2].some(function (n) {return has(full,n);})) {
        // Do not silently contradict an explicitly printed country.
        if (result.country && result.country !== r[1] && !(result.country==='Scozia' && r[1]==='Regno Unito')) continue;
        result.region = r[0];
        if (!result.country) result.country = r[1];
        result.reasons.push('Territorio trovato sull\u0027etichetta');
        break;
      }
    }
    // Producer only if labelled as such. Marketing brand alone isn't proof of manufacturer.
    for (var k=0; k<lines.length; k++) {
      var m = lines[k].match(/(?:prodotto|imbottigliato|distillato|vinificato)\s+da\s*[:\-]?\s*(.+)$/i)
        || lines[k].match(/(?:produced|distilled|bottled|made)\s+by\s*[:\-]?\s*(.+)$/i)
        || lines[k].match(/(?:produttore|producer|winery|cantina|distilleria|distillery|azienda agricola|estate)\s*[:\-]\s*(.+)$/i);
      if (m) {
        var p=tidy(m[1].split(/[,;]|\s+\d{5}\b/)[0]);
        if (p.length >= 3 && p.length <= 95 && !/\b(www|italia|italy)\b/i.test(p)) {result.producer=p;break;}
      }
    }
    if (kind==='vino') {
      var vintage = full.match(/(?:annata|vintage|vendemmia)\s*:?\s*((?:19|20)\d{2})\b/i);
      if (!vintage) vintage = lines.slice(0,12).join(' ').match(/\b((?:19[5-9]|20[0-3])\d)\b/);
      if(vintage) result.vintage=vintage[1];
      var grapes=['nebbiolo','sangiovese','barbera','merlot','cabernet sauvignon','pinot nero','pinot noir','chardonnay','sauvignon blanc','riesling','vermentino','primitivo','aglianico','glera','montepulciano','syrah','tempranillo','malbec','grenache','garnacha'];
      result.grape=grapes.find(function(g){return has(full,g);})||'';
      var appell = lines.find(function(s){return /\b(DOCG|DOC|IGT|DOP|AOP|AOC|IGP)\b/i.test(s) && s.length<85;});
      if(appell) result.appellation=appell;
    }
    // Suggest visible title, avoiding generic types, ingredients, address and producer labels.
    var candidates=lines.slice(0, Math.min(12,lines.length)).filter(possibleName).filter(function(s){
      return !/\b(distilled in|bottled|product of|made in|prodotto in|made by|produttore|azienda agricola|vinificato da|distillato da)\b/i.test(s);
    });
    var typeMatches = candidates.filter(function(s){return kind==='gin'?/\bgin\b/i.test(s):/\b(barolo|chianti|amarone|brunello|barbaresco|prosecco|franciacorta|ribera|rioja|champagne|chardonnay|nebbiolo)\b/i.test(s);});
    var chosen = (typeMatches.length ? typeMatches[0] : candidates[0]) || '';
    if (chosen && kind==='gin' && /^london dry gin\s+/i.test(chosen)) chosen=tidy(chosen.replace(/^london dry gin\s+/i,''));
    result.name = chosen;
    return result;
  }
  function status(s,bad) {
    var out=el('ocrStatus');if(!out)return;
    out.textContent=s;
    out.style.color=bad?'#ac3e38':'#69513e';
  }
  function showRaw(text) {
    if(el('ocrRaw')) el('ocrRaw').textContent=text || '(Nessun testo trovato)';
    if(el('ocrRawDetails')) el('ocrRawDetails').hidden=!text;
  }
  function setField(id,value,allowDefault) {
    var field=el(id);
    if (!field || !value) return false;
    var existing = field.value.trim();
    var canUpdateOCR = Object.prototype.hasOwnProperty.call(autoFilled,id) && existing === autoFilled[id];
    if (existing && !canUpdateOCR && !(allowDefault && existing === 'Italia' && !touchedCountry && !editingExisting)) return false;
    internalWrite=true;
    field.value=value.slice(0,Number(field.maxLength)||100);
    autoFilled[id]=field.value;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    internalWrite=false;
    return true;
  }
  function apply(data) {
    var assigned=[];
    if (setField('ginName',data.name)) assigned.push('nome');
    if (setField('ginBrand',data.producer)) assigned.push('produttore');
    if (setField('ginRegion',data.region)) assigned.push('regione');
    if (setField('ginCountry',data.country,true)) assigned.push('nazione');
    if (type==='vino' && el('ginNotes') && !el('ginNotes').value.trim()) {
      var notes=[];
      if(data.vintage) notes.push('Annata: '+data.vintage);
      if(data.grape) notes.push('Vitigno: '+data.grape);
      if(data.appellation) notes.push('Denominazione (da verificare): '+data.appellation);
      if(notes.length) {el('ginNotes').value=notes.join('\n');assigned.push('note vino');}
    }
    var msg=assigned.length ? 'Compilati: '+assigned.join(', ')+'. Controlla i dati prima di salvare.' : 'Nessun campo compilato con sicurezza. Leggi il testo riconosciuto e completa a mano.';
    status(msg);
  }
  function loadLibrary() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve,reject) {
      var s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.async=true;
      s.onload=function(){root.Tesseract?resolve(root.Tesseract):reject(new Error('Motore OCR non disponibile'));};
      s.onerror=function(){reject(new Error('Connessione necessaria al primo utilizzo del riconoscimento'));};
      document.head.appendChild(s);
    }).catch(function(err){loadPromise=null;throw err;});
    return loadPromise;
  }
  function getWorker() {
    if (workerPromise) return workerPromise;
    workerPromise=loadLibrary().then(function (Tesseract) {
      status('Scarico i dizionari italiano e inglese (solo al primo utilizzo)...');
      return Tesseract.createWorker(['ita','eng'],1,{
        logger:function(p) {
          if(!p || !p.status)return;
          if(p.status==='recognizing text') status('Leggo l\u0027etichetta: '+Math.round((p.progress||0)*100)+'%');
          else if(/loading|initializing/i.test(p.status)) status('Preparo il riconoscimento... '+Math.round((p.progress||0)*100)+'%');
        }
      });
    }).catch(function(err){workerPromise=null;throw err;});
    return workerPromise;
  }
  // Use the ORIGINAL photo for recognition (not the thumbnail/compressed archive copy).
  // A source canvas is scaled down only to avoid excessive mobile memory use.
  function decodeImage(input) {
    return new Promise(function(resolve,reject) {
      var url = typeof input === 'string' ? input : URL.createObjectURL(input);
      var objectURL = typeof input !== 'string';
      var img = new Image();
      img.onload=function() {
        if(objectURL) URL.revokeObjectURL(url);
        if(!img.naturalWidth || !img.naturalHeight) { reject(new Error('Foto non leggibile')); return; }
        resolve(img);
      };
      img.onerror=function(){ if(objectURL)URL.revokeObjectURL(url);reject(new Error('Immagine non supportata')); };
      img.src=url;
    });
  }
  function sourceCanvas(img) {
    var factor=Math.min(1,2100/Math.max(img.naturalWidth,img.naturalHeight));
    var c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.naturalWidth*factor));
    c.height=Math.max(1,Math.round(img.naturalHeight*factor));
    var g=c.getContext('2d',{willReadFrequently:true});
    g.fillStyle='#ffffff';g.fillRect(0,0,c.width,c.height);
    g.drawImage(img,0,0,c.width,c.height);
    return c;
  }
  function normalizeRect(r) {
    var x=Math.max(0,Math.min(.95,Number(r.x)||0));
    var y=Math.max(0,Math.min(.95,Number(r.y)||0));
    var w=Math.max(.05,Math.min(1-x,Number(r.w)||1));
    var h=Math.max(.05,Math.min(1-y,Number(r.h)||1));
    return {x:x,y:y,w:w,h:h};
  }
  // Enlarge the label, stretch contrast using percentile intensity boundaries,
  // then optionally use monochrome. All processing remains inside this browser.
  function renderVariant(src,region,mode) {
    region=normalizeRect(region);
    var sw=Math.max(1,Math.round(src.width*region.w));
    var sh=Math.max(1,Math.round(src.height*region.h));
    var sx=Math.max(0,Math.min(src.width-sw,Math.round(region.x*src.width)));
    var sy=Math.max(0,Math.min(src.height-sh,Math.round(region.y*src.height)));
    var multiplier=Math.min(2.7,Math.max(1,1400/Math.max(sw,sh)));
    var sizeLimit=1900;
    var c=document.createElement('canvas');
    c.width=Math.min(sizeLimit,Math.max(1,Math.round(sw*multiplier)));
    c.height=Math.min(sizeLimit,Math.max(1,Math.round(sh*multiplier)));
    var g=c.getContext('2d',{willReadFrequently:true});
    g.imageSmoothingEnabled=true;
    g.imageSmoothingQuality='high';
    g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
    g.drawImage(src,sx,sy,sw,sh,0,0,c.width,c.height);
    if(mode==='original')return c;
    var image=g.getImageData(0,0,c.width,c.height);
    var a=image.data,hist=new Uint32Array(256),gray=new Uint8Array(c.width*c.height);
    var total=gray.length;
    for(var i=0,p=0;i<a.length;i+=4,p++) {
      var lum=Math.max(0,Math.min(255,Math.round(.299*a[i]+.587*a[i+1]+.114*a[i+2])));
      gray[p]=lum;hist[lum]++;
    }
    var targetLow=total*.045,targetHigh=total*.955;
    var cumulative=0,lo=0,hi=255;
    for(var j=0;j<256;j++){cumulative+=hist[j];if(cumulative>=targetLow){lo=j;break;}}
    cumulative=0;
    for(var k=0;k<256;k++){cumulative+=hist[k];if(cumulative>=targetHigh){hi=k;break;}}
    if(hi-lo<35){lo=Math.max(0,lo-20);hi=Math.min(255,hi+20);}
    for(var n=0;n<total;n++) {
      var stretched=Math.round(255*(gray[n]-lo)/Math.max(1,hi-lo));
      stretched=Math.max(0,Math.min(255,stretched));
      if(mode==='binary')stretched=stretched<144?15:250;
      var pos=n*4;
      a[pos]=a[pos+1]=a[pos+2]=stretched;
    }
    g.putImageData(image,0,0);
    return c;
  }
  function scoreOCR(output,parsed) {
    var conf=Number(output && output.data && output.data.confidence)||0;
    var raw=String(output && output.data && output.data.text || '');
    var meaningful=raw.replace(/[^A-Za-zÀ-ÿ]/g,'').length;
    var score=Math.min(40,Math.max(0,conf*.38));
    if(parsed.name)score+=27;
    if(parsed.producer)score+=19;
    if(parsed.region)score+=15;
    if(parsed.country)score+=10;
    if(parsed.vintage)score+=6;
    if(parsed.grape)score+=6;
    if(meaningful<7)score-=30;
    // Reject OCR detritus, even when the engine reports misleading confidence.
    if(parsed.name && /^(?:[A-Z]{2,4}\s*[#0-9]+|[A-Z]{1,3})$/i.test(parsed.name))score-=25;
    return score;
  }
  function usableResult(entry) {
    if(!entry)return false;
    var fields=entry.parsed;
    return entry.score>=43 && Boolean(fields.name || fields.country || fields.region || fields.producer || fields.vintage);
  }
  async function process(photo,version) {
    busy=true;
    if(el('ocrTry'))el('ocrTry').disabled=true;
    if(el('ocrCrop'))el('ocrCrop').disabled=true;
    showRaw('');
    status('Preparo ingrandimento e contrasto dell\'etichetta...');
    try {
      var img=await decodeImage(photo);
      var src=sourceCanvas(img);
      var worker=await getWorker();
      var attempts;
      if(cropRegion) {
        attempts=[
          {title:'ritaglio scelto',area:cropRegion,mode:'contrast',psm:'6'},
          {title:'ritaglio nitido',area:cropRegion,mode:'original',psm:'11'},
          {title:'ritaglio bianco/nero',area:cropRegion,mode:'binary',psm:'6'}
        ];
      } else {
        attempts=[
          {title:'centro etichetta',area:{x:.17,y:.12,w:.66,h:.76},mode:'contrast',psm:'11'},
          {title:'dettaglio centrale',area:{x:.29,y:.16,w:.42,h:.67},mode:'original',psm:'6'},
          {title:'foto completa',area:{x:0,y:0,w:1,h:1},mode:'contrast',psm:'11'}
        ];
      }
      var best=null;
      for(var j=0;j<attempts.length;j++) {
        if(version!==revision || !el('editorOverlay').classList.contains('open'))return;
        var attempt=attempts[j];
        status('Analisi '+(j+1)+'/'+attempts.length+': '+attempt.title+'...');
        if(worker.setParameters)await worker.setParameters({tessedit_pageseg_mode:attempt.psm});
        var c=renderVariant(src,attempt.area,attempt.mode);
        var result=await worker.recognize(c);
        c.width=1;c.height=1;
        var raw=String(result && result.data && result.data.text || '').trim();
        var parsed=parse(raw,type);
        var entry={raw:raw,parsed:parsed,score:scoreOCR(result,parsed),attempt:attempt.title};
        if(!best || entry.score>best.score)best=entry;
        // Quick exit when the label has enough identifying fields.
        if(entry.score>=92 && parsed.name && (parsed.country || parsed.region || parsed.producer))break;
      }
      if(version!==revision || !el('editorOverlay').classList.contains('open'))return;
      currentLabel=(best && best.raw)||'';
      showRaw(currentLabel);
      if(!best || !usableResult(best)) {
        status('Lettura ancora incerta. Tocca «Ritaglia etichetta», seleziona solo la parte con le scritte e riprova. Nessun dato inserito automaticamente.');
        return;
      }
      apply(best.parsed);
      if(el('ocrStatus'))el('ocrStatus').textContent+=' (Lettura migliore: '+best.attempt+'.)';
    } catch(err) {
      if(version===revision)status('Lettura non riuscita: '+(err&&err.message?err.message:'errore sconosciuto')+'. Compila manualmente o riprova.',true);
    } finally {
      busy=false;
      if(el('ocrTry'))el('ocrTry').disabled=false;
      if(el('ocrCrop'))el('ocrCrop').disabled=false;
      if(version!==revision && lastPhoto && el('editorOverlay').classList.contains('open'))start();
    }
  }
  function start() {
    if(busy)return;
    var photo=lastPhoto || (el('photoPreview') && !el('photoPreview').classList.contains('hide') && el('photoPreview').src);
    if(!photo){status('Prima fotografa la bottiglia oppure seleziona una foto.');return;}
    process(photo,revision);
  }
  function makeCropModal() {
    if(el('ocrCropModal'))return;
    var overlay=document.createElement('div');
    overlay.id='ocrCropModal';
    overlay.className='ocr-crop-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Ritaglia etichetta');
    overlay.hidden=true;
    overlay.innerHTML='<div class="ocr-crop-sheet"><h3>Seleziona l\'etichetta</h3>'+ 
      '<p>Trascina il dito o il mouse per delimitare solo le scritte leggibili. Non modifichiamo la foto salvata.</p>'+ 
      '<div class="ocr-crop-area"><div id="ocrCropStage" class="ocr-crop-stage">'+
      '<img id="ocrCropImage" alt="Fotografia da ritagliare"><div id="ocrCropSelection" class="ocr-crop-selection"></div>'+ 
      '</div></div><div class="ocr-crop-actions"><button type="button" id="ocrCropCancel">Annulla</button>'+ 
      '<button type="button" id="ocrCropApply">Usa ritaglio e rileggi</button></div></div>';
    document.body.appendChild(overlay);
    var stage=el('ocrCropStage');
    var startPt=null;
    function pos(e){var r=stage.getBoundingClientRect();return {
      x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
      y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))
    };}
    function updateSelection(){var div=el('ocrCropSelection');var r=cropRegion || {x:.20,y:.16,w:.60,h:.70};
      div.style.left=(r.x*100)+'%';div.style.top=(r.y*100)+'%';
      div.style.width=(r.w*100)+'%';div.style.height=(r.h*100)+'%';}
    stage.addEventListener('pointerdown',function(e){
      e.preventDefault();startPt=pos(e);stage.setPointerCapture(e.pointerId);
      cropRegion={x:startPt.x,y:startPt.y,w:.01,h:.01};updateSelection();
    });
    stage.addEventListener('pointermove',function(e){
      if(!startPt)return;var p=pos(e);
      cropRegion={x:Math.min(startPt.x,p.x),y:Math.min(startPt.y,p.y),
        w:Math.abs(p.x-startPt.x),h:Math.abs(p.y-startPt.y)};updateSelection();
    });
    function endDrag(){
      if(!startPt)return;startPt=null;
      if(!cropRegion || cropRegion.w<.08 || cropRegion.h<.07)cropRegion={x:.20,y:.16,w:.60,h:.70};
      updateSelection();
    }
    stage.addEventListener('pointerup',endDrag);
    stage.addEventListener('pointercancel',endDrag);
    function close(){overlay.hidden=true;if(cropURL){URL.revokeObjectURL(cropURL);cropURL=null;}}
    el('ocrCropCancel').addEventListener('click',close);
    overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
    el('ocrCropApply').addEventListener('click',function(){
      endDrag();close();revision++;if(!busy)start();else status('Completo la lettura corrente, poi applico il ritaglio...');
    });
    overlay.updateSelection=updateSelection;
    overlay.open=function(photo){
      if(cropURL){URL.revokeObjectURL(cropURL);cropURL=null;}
      var pic=el('ocrCropImage');
      if(typeof photo==='string')pic.src=photo;
      else {cropURL=URL.createObjectURL(photo);pic.src=cropURL;}
      cropRegion=cropRegion || {x:.20,y:.16,w:.60,h:.70};
      overlay.hidden=false;updateSelection();
    };
  }
  function openCrop() {
    var photo=lastPhoto || (el('photoPreview') && el('photoPreview').src);
    if(!photo){status('Prima scegli una fotografia.');return;}
    makeCropModal();el('ocrCropModal').open(photo);
  }
  function onPhotoReady(file) {
    if(!file)return;
    revision++;
    lastPhoto=file;
    cropRegion=null;
    autoFilled={};
    status('Foto pronta: ingrandisco e leggo automaticamente l\'etichetta...');
    start();
  }
  function onEditorOpen(isEditing) {
    revision++;
    lastPhoto=null;
    cropRegion=null;
    autoFilled={};
    touchedCountry=false;
    editingExisting=Boolean(isEditing);
    currentLabel='';
    showRaw('');
    status('Scatta una foto dell\'etichetta: il riconoscimento parte automaticamente.');
  }
  function setup() {
    var btn=el('ocrTry');
    if(btn)btn.addEventListener('click',function(e){e.preventDefault();start();});
    var crop=el('ocrCrop');
    if(crop)crop.addEventListener('click',function(e){e.preventDefault();openCrop();});
    var country=el('ginCountry');
    if(country)country.addEventListener('input',function(){if(!internalWrite)touchedCountry=true;});
  }
  root.GinVinoOCR={parse:parse,onPhotoReady:onPhotoReady,onEditorOpen:onEditorOpen,recognize:start,renderVariant:renderVariant,scoreOCR:scoreOCR};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
})(window);
