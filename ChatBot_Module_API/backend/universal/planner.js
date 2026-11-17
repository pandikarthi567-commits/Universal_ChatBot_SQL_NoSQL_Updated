'use strict';
const stop = new Set('how many what is are the a an of in on for me please show list get give tell about count total all available find data records details iruku irukka ethana evlo எத்தனை என்ன உள்ளன காட்டு'.split(' '));
function words(s) { return String(s || '').normalize('NFKC').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || []; }
function stem(s) { return s.length > 4 && s.endsWith('ies') ? s.slice(0,-3)+'y' : s.length > 3 && s.endsWith('s') ? s.slice(0,-1) : s; }
function tokens(s) { return new Set(words(s).filter(x=>!stop.has(x)).map(stem)); }
function rank(question, resources) { const q=tokens(question); return resources.map(r=>({r,score:[...tokens([r.name,...(r.aliases||[])].join(' '))].filter(t=>q.has(t)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score); }
function plan(question, resources, previous) {
 const q=String(question).trim();
 if (/\b(delete|drop|truncate|insert|update|modify|remove|execute|alter|transfer|purchase|create|cancel)\b/i.test(q)) return {kind:'unsupported'};
 const ranked=rank(q,resources); let r=ranked[0]?.r;
 if(ranked.length>1 && ranked[0].score===ranked[1].score) return {kind:'clarify'};
 if(!r && /\b(it|its|them|those|same|them|their)\b/i.test(q)) r=resources.find(x=>x.name===previous);
 if(!r) return {kind:'knowledge'};
 const count=/\b(how many|count|total number|number of|ethana|evlo|ettana)\b|எத்தனை|எவ்வளவு/iu.test(q);
 const list=/\b(list|show|display|get|give|all|details|records)\b|காட்டு|பட்டியல்/iu.test(q);
 const filter=/\b(where|with|between|before|after|today|yesterday|month|year|week|last|this|greater|less|above|below|under|only|from|named|called|status|active|inactive|pending|completed|stock)\b/iu.test(q);
 // Never silently drop a requested condition. Only explicit field = value equality is supported.
 const matches=[...q.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s,;]+))/g)];
 let where=null;
 if(matches.length===1){const m=matches[0];const field=m[1];if(!(r.filters||[]).includes(field))return {kind:'clarify'};const raw=m[2]??m[3]??m[4]; let value=raw; const type=r.field_types?.[field]; if(type==='number'){value=Number(raw);if(!Number.isFinite(value))return {kind:'clarify'};} if(type==='boolean'){if(!/^(true|false)$/i.test(raw))return {kind:'clarify'};value=raw.toLowerCase()==='true';} where={field,value};}
 const residual=q.replace(/\b[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/g,'');
 const recognized=tokens([r.name,...(r.aliases||[])].join(' '));
 const extra=[...tokens(residual)].filter(t=>!recognized.has(t)&&!['number','total','currently','current','database','record','row','it','its','them','those','same','their','where','with','and'].includes(t));
 if(matches.length>1 || (filter && !where) || /\b(sum|average|mean|maximum|minimum|highest|lowest|top|latest|recent|first|oldest|sort|group)\b/i.test(residual) || extra.length) return {kind:'clarify',resource:r};
 if(!count&&!list) return {kind:'clarify',resource:r};
 return {kind:'query',resource:r,operation:count?'count':'list',where};
}
function validateResources(items){if(!Array.isArray(items)||items.length>100)throw new Error('resources must be an array of up to 100 items'); const names=new Set(); const id=/^[A-Za-z_][A-Za-z0-9_]*$/; const forbidden=/password|secret|token|credential|api.?key|hash|ssn|salary|private/i; return items.map(x=>{if(!x||!id.test(x.name)||names.has(x.name)||!['database','api'].includes(x.source))throw new Error('Invalid or duplicate resource');names.add(x.name); const fields=x.fields||[];const filters=x.filters||[];if(!Array.isArray(fields)||!fields.length||fields.length>30||fields.some(f=>!id.test(f)||forbidden.test(f))||!Array.isArray(filters)||filters.some(f=>!fields.includes(f)))throw new Error('Invalid or sensitive fields'); if(x.source==='database'&&(!id.test(x.table)||forbidden.test(x.table)||!id.test(x.schema||'public')))throw new Error('Invalid database table/schema'); if(x.source==='api'&&(!Number.isSafeInteger(x.endpoint_id)||x.endpoint_id<1))throw new Error('Approved endpoint_id required');const aliases=x.aliases||[];if(!Array.isArray(aliases)||aliases.length>30||aliases.some(a=>typeof a!=='string'||a.length>100))throw new Error('Invalid aliases');const field_types=x.field_types||{};if(Object.entries(field_types).some(([k,v])=>!filters.includes(k)||!['string','number','boolean'].includes(v)))throw new Error('Invalid field types');return {name:x.name,source:x.source,table:x.table,schema:x.schema||'public',endpoint_id:x.endpoint_id,fields:[...new Set(fields)],filters:[...new Set(filters)],aliases,field_types};});}
module.exports={plan,rank,tokens,validateResources};
