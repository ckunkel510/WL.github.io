'use strict';
const DAY=86400000;
function chooseLayout({layouts,active,category,audience,historyComplete,now=Date.now()}){
 if(historyComplete!==true)return {status:'blocked',reason:'layout_history_required'};
 const valid=(layouts||[]).filter(x=>x.status==='approved'&&x.owner&&x.revision&&x.family&&x.categories?.includes(category)&&x.audiences?.includes(audience)&&Date.parse(x.expiresAt)>now&&x.brandPromise==='Built on Quality');
 const started=Date.parse(active?.startedAt);if(active&&!Number.isFinite(started))return {status:'blocked',reason:'layout_history_required'};
 if(active&&now-started<14*DAY){const current=valid.find(x=>x.id===active.id&&x.revision===active.revision);if(current)return {status:'ready',layout:current,refreshDueAt:new Date(started+14*DAY).toISOString()};}
 const alternatives=valid.filter(x=>!active||x.family!==active.family).sort((a,b)=>a.id.localeCompare(b.id));
 return alternatives.length?{status:'ready',layout:alternatives[0],rotationRequired:!!active}:{status:'needs_review',reason:'fresh_layout_revision_required'};
}
module.exports={chooseLayout};
