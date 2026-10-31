import PROFILE from './MNDSVtech.mobileconfig';
// Mound Hopper global leaderboard - Cloudflare Worker + D1 (free tier)
const BAD=['fuck','shit','bitch','cunt','nigg','fag','dick','cock','pussy','whore','slut','rape','nazi','penis','vagina','asshole','retard','kkk'];
const MAX_SCORE=10000, SEC_PER_POINT=1.0, RUN_TTL=6*3600*1000, TM_MAX=500000, TM_PPS=150, TM_FREE=500;
function clean(n){return String(n||'').normalize('NFKC').replace(/[^\p{L}\p{N} ._\-!]/gu,'').replace(/\s+/g,' ').trim().slice(0,12)}
function bad(n){const s=n.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/\$/g,'s');return BAD.some(w=>s.includes(w))}
function cors(req,env){const o=req.headers.get('Origin')||'';const ok=(env.ALLOWED_ORIGINS||'').split(',').includes(o);return{'Access-Control-Allow-Origin':ok?o:'https://www.mndsvtech.com','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}}
const J=(d,s,h)=>new Response(JSON.stringify(d),{status:s||200,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...h}});
async function limited(env,ip,max,win){const now=Date.now();await env.DB.prepare('DELETE FROM hits WHERE ts<?').bind(now-3600e3).run();const r=await env.DB.prepare('SELECT COUNT(*) c FROM hits WHERE ip=? AND ts>?').bind(ip,now-win).first();if(r.c>=max)return true;await env.DB.prepare('INSERT INTO hits(ip,ts) VALUES(?,?)').bind(ip,now).run();return false}
const TBL={mh:'scores',tm:'tm_scores'};function gk(v){return v==='tm'?'tm':'mh'}
async function top(env,g){const {results}=await env.DB.prepare('SELECT name,score,created FROM '+TBL[g||'mh']+' ORDER BY score DESC,created ASC LIMIT 10').all();return results}
export default{async fetch(req,env){if((req.method==='GET'||req.method==='HEAD')&&new URL(req.url).pathname==='/MNDSVtech.mobileconfig')return new Response(req.method==='HEAD'?null:PROFILE,{headers:{'Content-Type':'application/x-apple-aspen-config','Content-Disposition':'attachment; filename="MNDSVtech.mobileconfig"','Content-Length':String(PROFILE.byteLength),'Cache-Control':'public, max-age=3600'}});const h=cors(req,env),u=new URL(req.url),ip=req.headers.get('CF-Connecting-IP')||'local';
 if(req.method==='OPTIONS')return new Response(null,{headers:h});
 try{
 if(req.method==='GET'&&u.pathname==='/top')return J({top:await top(env,gk(u.searchParams.get('game')))},200,h);
 if(req.method==='POST'&&u.pathname==='/start'){if(await limited(env,ip+':start',60,60e3))return J({error:'slow down'},429,h);let sb={};try{sb=await req.json()}catch{}const g=gk(sb&&sb.game);const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO runs(id,ip,started,game) VALUES(?,?,?,?)').bind(id,ip,Date.now(),g).run();await env.DB.prepare('DELETE FROM runs WHERE started<?').bind(Date.now()-RUN_TTL).run();return J({run:id},200,h)}
 if(req.method==='POST'&&u.pathname==='/score'){if(await limited(env,ip+':score',10,60e3))return J({error:'slow down'},429,h);
  let b;try{b=await req.json()}catch{return J({error:'bad json'},400,h)}
  const g=gk(b.game),name=clean(b.name),score=Number(b.score);
  if(name.length<1)return J({error:'name required'},400,h);if(bad(name))return J({error:'pick another name'},400,h);
  if(!Number.isInteger(score)||score<0||score>(g==='tm'?TM_MAX:MAX_SCORE))return J({error:'bad score'},400,h);
  const run=await env.DB.prepare('SELECT * FROM runs WHERE id=?').bind(String(b.run||'')).first();
  if(!run||run.used||run.ip!==ip||(run.game||'mh')!==g)return J({error:'invalid run'},400,h);
  await env.DB.prepare('UPDATE runs SET used=1 WHERE id=?').bind(run.id).run();
  const secs=(Date.now()-run.started)/1000;if(g==='tm'){if(score>secs*TM_PPS+TM_FREE)return J({error:'too fast'},400,h)}else{let need=0;for(let i=0;i<score;i++)need+=1.3684/Math.pow(1.05,Math.floor(i/20));if(score>0&&secs<need*0.7)return J({error:'too fast'},400,h)}
  const ins=await env.DB.prepare('INSERT INTO '+TBL[g]+'(name,score,created) VALUES(?,?,?)').bind(name,score,Date.now()).run();
  const rk=await env.DB.prepare('SELECT COUNT(*)+1 r FROM '+TBL[g]+' WHERE score>?').bind(score).first();
  return J({ok:true,id:ins.meta.last_row_id,rank:rk.r,top:await top(env,g)},200,h)}
 return J({error:'not found'},404,h)}catch(e){return J({error:'server error'},500,h)}}};
