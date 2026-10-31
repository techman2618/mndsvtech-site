import PROFILE from './MNDSVtech.mobileconfig';
// Mound Hopper global leaderboard - Cloudflare Worker + D1 (free tier)
const BAD=['fuck','shit','bitch','cunt','nigg','fag','dick','cock','pussy','whore','slut','rape','nazi','penis','vagina','asshole','retard','kkk'];
const HC_MAX=200000,HC_MPS=45,HC_FREE=60,MAX_SCORE=10000, SEC_PER_POINT=1.0, RUN_TTL=6*3600*1000, TM_MAX=500000, TM_PPS=150, TM_FREE=500;
function clean(n){return String(n||'').normalize('NFKC').replace(/[^\p{L}\p{N} ._\-!]/gu,'').replace(/\s+/g,' ').trim().slice(0,12)}
function bad(n){const s=n.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/\$/g,'s');return BAD.some(w=>s.includes(w))}
function cors(req,env){const o=req.headers.get('Origin')||'';const ok=(env.ALLOWED_ORIGINS||'').split(',').includes(o);return{'Access-Control-Allow-Origin':ok?o:'https://www.mndsvtech.com','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}}
const J=(d,s,h)=>new Response(JSON.stringify(d),{status:s||200,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...h}});
async function limited(env,ip,max,win){const now=Date.now();await env.DB.prepare('DELETE FROM hits WHERE ts<?').bind(now-3600e3).run();const r=await env.DB.prepare('SELECT COUNT(*) c FROM hits WHERE ip=? AND ts>?').bind(ip,now-win).first();if(r.c>=max)return true;await env.DB.prepare('INSERT INTO hits(ip,ts) VALUES(?,?)').bind(ip,now).run();return false}
const TBL={mh:'scores',tm:'tm_scores',hc:'hc_scores'};function gk(v){return v==='tm'||v==='hc'?v:'mh'}
// America/New_York day/week (Sun) start, in ms
function nyStart(now,week){const f=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',weekday:'short'});const q={};for(const x of f.formatToParts(new Date(now)))q[x.type]=x.value;
 const asUTC=Date.UTC(+q.year,+q.month-1,+q.day,+q.hour,+q.minute,+q.second),off=asUTC-Math.floor(now/1000)*1000;let mid=Date.UTC(+q.year,+q.month-1,+q.day);
 if(week)mid-=((['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(q.weekday))*864e5);let t=mid-off;
 const chk=new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'});if(+chk!==0)t+=(+chk>12?24-+chk:-+chk)*36e5;return t}
async function since(env,g,t){const {results}=await env.DB.prepare('SELECT name,score,created FROM '+TBL[g||'mh']+' WHERE created>=? ORDER BY score DESC,created ASC LIMIT 5').bind(t).all();return results}
async function boards(env,g){const n=Date.now();const [a,day,week]=await Promise.all([top(env,g),since(env,g,nyStart(n,0)),since(env,g,nyStart(n,1))]);return{top:a,day,week}}
async function top(env,g){const {results}=await env.DB.prepare('SELECT name,score,created FROM '+TBL[g||'mh']+' ORDER BY score DESC,created ASC LIMIT 10').all();return results}
// Live ghosts: one Durable Object room, WebSockets, batched broadcast ~10x/sec
export class LiveRoom{constructor(state,env){this.state=state;this.env=env;this.p=new Map();this.timer=null}
 async fetch(req){const pair=new WebSocketPair(),[c,s]=Object.values(pair);s.accept();const id=crypto.randomUUID().slice(0,8);
  s.addEventListener('message',e=>{if(typeof e.data!=='string'||e.data.length>200)return;let d;try{d=JSON.parse(e.data)}catch{return}
   const n=clean(d.n);if(!n||bad(n))return;const y=Math.max(0,Math.min(1,+d.y||0)),sc=Math.max(0,Math.min(MAX_SCORE,d.s|0));
   this.p.set(id,{ws:s,n,y:Math.round(y*1000)/1000,s:sc,a:d.a?1:0,t:Date.now()});this.tick()});
  const gone=()=>{this.p.delete(id)};s.addEventListener('close',gone);s.addEventListener('error',gone);
  this.p.set(id,{ws:s,t:Date.now()});this.tick();return new Response(null,{status:101,webSocket:c})}
 tick(){if(this.timer)return;this.timer=setInterval(()=>{const now=Date.now();for(const[k,v]of this.p)if(now-v.t>3000){try{v.ws.close(1000,'idle')}catch{}this.p.delete(k)}
   if(!this.p.size){clearInterval(this.timer);this.timer=null;return}
   const list=[];for(const[k,v]of this.p)if(v.n&&v.a)list.push({i:k,n:v.n,y:v.y,s:v.s});
   for(const[k,v]of this.p){const others=list.filter(o=>o.i!==k).slice(0,10);try{v.ws.send(JSON.stringify({c:this.p.size,g:others}))}catch{this.p.delete(k)}}},100)}}
// Download counter: no personal data kept; hash only used for 1h dedupe then wiped
const PLAT=['android','ios','web'];
async function countDl(env,req,pl){try{const ip=req.headers.get('CF-Connecting-IP')||'local',now=Date.now();const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('mndsv-dl|'+ip+'|'+pl));const h=[...new Uint8Array(buf)].slice(0,12).map(b=>b.toString(16).padStart(2,'0')).join('');
 await env.DB.prepare('UPDATE downloads SET h=NULL WHERE h IS NOT NULL AND ts<?').bind(now-3600e3).run();
 const r=await env.DB.prepare('SELECT 1 FROM downloads WHERE h=? LIMIT 1').bind(h).first();if(!r)await env.DB.prepare('INSERT INTO downloads(platform,ts,h) VALUES(?,?,?)').bind(pl,now,h).run()}catch(e){}}
async function dlCounts(env){const {results}=await env.DB.prepare('SELECT platform,COUNT(*) c FROM downloads GROUP BY platform').all();const o={android:0,ios:0,web:0};for(const r of results)if(r.platform in o)o[r.platform]=r.c;o.total=o.android+o.ios+o.web;return o}
export default{async fetch(req,env,ctx){{const pu=new URL(req.url).pathname;
 if((req.method==='GET'||req.method==='HEAD')&&pu==='/dl/android'){if(req.method==='GET')await countDl(env,req,'android');return new Response(null,{status:302,headers:{Location:'https://www.mndsvtech.com/downloads/MNDSVtech.apk','Cache-Control':'no-store'}})}
 if(req.method==='GET'&&pu==='/dl/ios'){await countDl(env,req,'ios');return new Response(PROFILE,{headers:{'Content-Type':'application/x-apple-aspen-config','Content-Disposition':'attachment; filename="MNDSVtech.mobileconfig"','Content-Length':String(PROFILE.byteLength),'Cache-Control':'no-store'}})}
 if(pu==='/dl/web'||pu==='/downloads'){const h=cors(req,env);if(req.method==='OPTIONS')return new Response(null,{headers:h});
  if(pu==='/dl/web'&&req.method==='POST'){await countDl(env,req,'web');return J({ok:true},200,h)}
  if(pu==='/downloads'&&req.method==='GET')return J(await dlCounts(env),200,h)}}
if(new URL(req.url).pathname==='/live'){const o=req.headers.get('Origin')||'';if(!(env.ALLOWED_ORIGINS||'').split(',').includes(o))return new Response('forbidden',{status:403});if(req.headers.get('Upgrade')!=='websocket')return new Response('expected websocket',{status:426});return env.LIVE.get(env.LIVE.idFromName('mh')).fetch(req)}if((req.method==='GET'||req.method==='HEAD')&&new URL(req.url).pathname==='/MNDSVtech.mobileconfig')return new Response(req.method==='HEAD'?null:PROFILE,{headers:{'Content-Type':'application/x-apple-aspen-config','Content-Disposition':'attachment; filename="MNDSVtech.mobileconfig"','Content-Length':String(PROFILE.byteLength),'Cache-Control':'public, max-age=3600'}});const h=cors(req,env),u=new URL(req.url),ip=req.headers.get('CF-Connecting-IP')||'local';
 if(req.method==='OPTIONS')return new Response(null,{headers:h});
 try{
 if(req.method==='GET'&&u.pathname==='/top')return J(await boards(env,gk(u.searchParams.get('game'))),200,h);
 if(req.method==='POST'&&u.pathname==='/start'){if(await limited(env,ip+':start',60,60e3))return J({error:'slow down'},429,h);let sb={};try{sb=await req.json()}catch{}const g=gk(sb&&sb.game);const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO runs(id,ip,started,game) VALUES(?,?,?,?)').bind(id,ip,Date.now(),g).run();await env.DB.prepare('DELETE FROM runs WHERE started<?').bind(Date.now()-RUN_TTL).run();return J({run:id},200,h)}
 if(req.method==='POST'&&u.pathname==='/score'){if(await limited(env,ip+':score',10,60e3))return J({error:'slow down'},429,h);
  let b;try{b=await req.json()}catch{return J({error:'bad json'},400,h)}
  const g=gk(b.game),name=clean(b.name),score=Number(b.score);
  if(name.length<1)return J({error:'name required'},400,h);if(bad(name))return J({error:'pick another name'},400,h);
  if(!Number.isInteger(score)||score<0||score>(g==='tm'?TM_MAX:g==='hc'?HC_MAX:MAX_SCORE))return J({error:'bad score'},400,h);
  const run=await env.DB.prepare('SELECT * FROM runs WHERE id=?').bind(String(b.run||'')).first();
  if(!run||run.used||run.ip!==ip||(run.game||'mh')!==g)return J({error:'invalid run'},400,h);
  await env.DB.prepare('UPDATE runs SET used=1 WHERE id=?').bind(run.id).run();
  const secs=(Date.now()-run.started)/1000;if(g==='hc'){if(score>secs*HC_MPS+HC_FREE)return J({error:'too fast'},400,h)}else if(g==='tm'){if(score>secs*TM_PPS+TM_FREE)return J({error:'too fast'},400,h)}else{let need=0;for(let i=0;i<score;i++)need+=1.3684/Math.pow(1.05,Math.floor(i/20));if(score>0&&secs<need*0.7)return J({error:'too fast'},400,h)}
  const ins=await env.DB.prepare('INSERT INTO '+TBL[g]+'(name,score,created) VALUES(?,?,?)').bind(name,score,Date.now()).run();
  const rk=await env.DB.prepare('SELECT COUNT(*)+1 r FROM '+TBL[g]+' WHERE score>?').bind(score).first();
  return J({ok:true,id:ins.meta.last_row_id,rank:rk.r,...(await boards(env,g))},200,h)}
 return J({error:'not found'},404,h)}catch(e){console.log('ERR',e&&e.stack);return J({error:'server error'},500,h)}}};
