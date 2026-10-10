/* Il Mio Gin e Il Mio Vino: OCR gratuito eseguito nel browser.
   Le foto rimangono sul dispositivo: scarichiamo solo il motore OCR e i dizionari.
   Versione 2026-10-10 / Nessuna API e nessun riconoscimento cloud. */
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
  var ignorable = /^(gin|dry gin|london dry gin|distilled gin|vino|wine|red wine|white wine|rose|ros\u00e9|alc|vol|alcohol|prodotto|produced|imbottigliato|bottled|distilled|750\s?ml|70\s?cl|100\s?cl|doc|docg|igt|organic|bio|superiore|riserva|original|premium)$/i;
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
    if (field.value.trim() && !(allowDefault && field.value.trim() === 'Italia' && !touchedCountry && !editingExisting)) return false;
    internalWrite=true;
    field.value=value.slice(0,Number(field.maxLength)||100);
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
  function prepareImage(input) {
    return new Promise(function(resolve,reject) {
      var url = typeof input === 'string' ? input : URL.createObjectURL(input);
      var objURL=typeof input !== 'string';
      var img=new Image();
      img.onload=function() {
        if(objURL) URL.revokeObjectURL(url);
        var width=img.naturalWidth,height=img.naturalHeight;
        if(!width || !height){reject(new Error('Foto non leggibile'));return;}
        var factor=Math.min(1,1800/Math.max(width,height));
        var canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(width*factor));
        canvas.height=Math.max(1,Math.round(height*factor));
        var ctx=canvas.getContext('2d');
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.88));
      };
      img.onerror=function(){if(objURL)URL.revokeObjectURL(url);reject(new Error('Immagine non supportata dal browser'));};
      img.src=url;
    });
  }
  async function process(photo,version) {
    busy=true;
    if(el('ocrTry'))el('ocrTry').disabled=true;
    showRaw('');
    status('Preparo la foto per la lettura...');
    try {
      var image=await prepareImage(photo);
      var worker=await getWorker();
      var output=await worker.recognize(image);
      if(version!==revision || !el('editorOverlay').classList.contains('open'))return;
      var raw=(output && output.data && output.data.text || '').trim();
      currentLabel=raw;
      showRaw(raw);
      if (!raw){status('Testo non leggibile. Fotografa da vicino la parte frontale dell\u0027etichetta.');return;}
      apply(parse(raw,type));
    } catch(err) {
      if(version===revision)status('Lettura non riuscita: '+(err && err.message ? err.message : 'errore sconosciuto')+'. Puoi compilare la scheda manualmente.',true);
    } finally {
      busy=false;
      if(el('ocrTry'))el('ocrTry').disabled=false;
      if(version!==revision && lastPhoto && el('editorOverlay').classList.contains('open'))start();
    }
  }
  function start() {
    if(busy)return;
    var photo=lastPhoto || (el('photoPreview') && !el('photoPreview').classList.contains('hide') && el('photoPreview').src);
    if(!photo){status('Prima fotografa la bottiglia oppure seleziona una foto dalla galleria.');return;}
    process(photo,revision);
  }
  function onPhotoReady(file) {
    if(!file)return;
    revision++;
    lastPhoto=file;
    status('Foto pronta: avvio il riconoscimento gratuito...');
    start();
  }
  function onEditorOpen(isEditing) {
    revision++;
    lastPhoto=null;
    touchedCountry=false;
    editingExisting=Boolean(isEditing);
    currentLabel='';
    showRaw('');
    status('Scatta una foto dell\u0027etichetta: il riconoscimento parte automaticamente.');
  }
  function setup() {
    var btn=el('ocrTry');
    if(btn)btn.addEventListener('click',function(e){e.preventDefault();start();});
    var country=el('ginCountry');
    if(country)country.addEventListener('input',function(){if(!internalWrite)touchedCountry=true;});
  }
  root.GinVinoOCR={parse:parse,onPhotoReady:onPhotoReady,onEditorOpen:onEditorOpen,recognize:start};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
})(window);
