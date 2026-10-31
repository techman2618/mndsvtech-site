const C='mndsv-v5';
const CORE=['/','/index.html','/services.html','/repair.html','/setup.html','/games.html','/about.html','/contact.html','/computers.html','/phones.html','/networking.html','/games/mound-hopper.html','/games/tech-merge.html','/offline.html','/app.html','/styles.css','/logo.png','/favicon.svg','/icons/icon-192.png','/icons/icon-512.png','/favicon.ico','/manifest.webmanifest','/images/mound-hopper.svg','/images/tech-merge.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/downloads/')||u.pathname.startsWith('/.well-known/'))return; // never touch leaderboard API / Square / other sites
 if(r.mode==='navigate'){e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('/offline.html','/app.html'))));return}
 e.respondWith(caches.match(r).then(m=>{const f=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>m);return m||f}));});
