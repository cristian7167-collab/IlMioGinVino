const NAME='bibirub-vino-distillati-pwa-v1.7.1';
const PREFIX='bibirub-vino-distillati-pwa-';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./logo-il-mio-vino.webp','./logo-bibirub-distillati.webp','./hero-vino.webp','./hero-distillati.webp','./geo-europa.js'];
self.addEventListener('install', event=>{
 event.waitUntil(caches.open(NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET' || new URL(req.url).origin!==self.location.origin) return;
 const scope=new URL(self.registration.scope);
 if(!req.url.startsWith(scope.href))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(NAME).then(cache=>cache.put('./index.html',copy)).catch(()=>{});}
   return response;
  }).catch(async()=>await caches.match('./index.html')||Response.error()));
  return;
 }
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
  if(res.ok){const copy=res.clone();caches.open(NAME).then(cache=>cache.put(req,copy)).catch(()=>{});}
  return res;
 })));
});
