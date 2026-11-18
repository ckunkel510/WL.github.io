'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pairing=require('../ProductPairing');
function fixture(camera='174184',options={}){
 const model=pairing.pairFor(camera);let rows=[{pid:'900',code:'KEEP',name:'Unrelated project supplies',unit:'bag',quantity:3,price:525}];
 const products=Object.fromEntries([{pid:camera,code:model.cameraCode,name:model.cameraName,price:12999},...Object.values(pairing.accessories).map(s=>({...s,price:s.key==='sd'?2499:1039}))].map(s=>[s.pid,{...s,unit:'ea'}]));
 if(options.existing)rows.push(...[camera,'2853','290616'].map(id=>({...products[id],quantity:2})));
 let posts=[];const io={read:async()=>({store:'Bryan',scope:'local',items:structuredClone(rows)}),product:async id=>({...products[id]}),stock:async id=>({verified:true,branches:{Bryan:options.stock?.[id]??20}}),add:async(p,q)=>{posts.push([p.pid,q]);if(options.reject===p.pid)throw Error('Rejected');const old=rows.find(r=>r.pid===p.pid);if(old)old.quantity+=q;else rows.push({...p,quantity:q});if(options.lostReply)throw Error('Reply lost');if(options.afterAdd)options.afterAdd(p,products,rows);}};
 return{io,products,posts,rows:()=>rows};
}
test('SPARK and the other exact kits disclose included cards and never offer a duplicate required card',()=>{
 for(const id of ['246159','174183','185533']){const p=pairing.pairFor(id);assert.equal(p.cardIncluded,true);assert.equal(p.accessories.some(s=>s.key==='sd'),false);assert.match(p.disclosure,/includes|included/i);}
 const spark=pairing.pairFor('246159');assert.equal(spark.includedCardGB,16);assert.match(spark.disclosure,/8 AA/);assert.match(spark.disclosure,/optional spare/);
});
test('only exact reviewed standalone models get the full-size 32GB SDHC card',()=>{
 for(const id of ['174184','174187','246162','225714']){const p=pairing.pairFor(id);assert.equal(p.cardIncluded,false);assert.equal(p.cardMaxGB,32);assert.equal(p.accessories.find(s=>s.key==='sd').code,'RFS32GB');}
 assert.equal(pairing.pairFor('277247').cardIncluded,null);assert.deepEqual(pairing.pairFor('277247').accessories.map(a=>a.key),['sd']);assert.equal(pairing.pairFor('some-other-camera'),null);
});
test('camera plus SD only adds no batteries and keeps existing unrelated lines',async()=>{
 const f=fixture(),q=await pairing.prepare(f.io,'174184',2,['sd']);assert.equal(q.total,30996);assert.deepEqual(q.products.map(p=>p.pid),['174184','290616']);
 await pairing.addBoth(f.io,q,true);assert.deepEqual(f.posts,[['174184',2],['290616',2]]);assert.equal(f.rows()[0].quantity,3);assert.equal(f.rows().some(p=>p.pid==='2853'),false);
});
test('one combined selection adds the camera only once, then batteries and SD, preserving old quantities',async()=>{
 const f=fixture('174184',{existing:true}),q=await pairing.prepare(f.io,'174184',2,['sd','battery']);assert.deepEqual(q.selectedKeys,['battery','sd']);
 await pairing.addBoth(f.io,q,true);assert.deepEqual(f.posts,[['174184',2],['2853',2],['290616',2]]);assert.deepEqual(f.rows().map(p=>[p.pid,p.quantity]),[['900',3],['174184',4],['2853',4],['290616',4]]);
});
test('empty, duplicated, unknown and included-card selections cause no writes',async()=>{
 for(const [camera,keys] of [['174184',[]],['174184',['sd','sd']],['174184',['micro-sd']],['246159',['sd']],['174183',['sd']]]){const f=fixture(camera);await assert.rejects(pairing.prepare(f.io,camera,1,keys));assert.equal(f.posts.length,0);}
});
test('unavailable or wrong-SKU SD blocks that option while a verified battery-only selection still works',async()=>{
 const f=fixture('174184',{stock:{'290616':0}}),inspection=await pairing.inspect(f.io,pairing.pairFor('174184'),1);assert.equal(inspection.choices.find(c=>c.spec.key==='battery').error,null);assert.match(inspection.choices.find(c=>c.spec.key==='sd').error,/not confirmed/);
 await assert.rejects(pairing.prepare(f.io,'174184',1,['sd']));await pairing.addBoth(f.io,await pairing.prepare(f.io,'174184',1,['battery']),true);assert.equal(f.posts.length,2);
 const wrong=fixture();wrong.products['290616'].code='MICRO64GB';await assert.rejects(pairing.prepare(wrong.io,'174184',1,['sd']),/exact products/);assert.equal(wrong.posts.length,0);
});
test('third-item failure leaves the confirmed camera and battery, stops and never retries',async()=>{
 const f=fixture('174184',{reject:'290616'}),q=await pairing.prepare(f.io,'174184',1,['battery','sd']);await assert.rejects(pairing.addBoth(f.io,q,true),e=>e.reviewCart===true);
 assert.deepEqual(f.posts,[['174184',1],['2853',1],['290616',1]]);assert.deepEqual(f.rows().map(p=>p.pid),['900','174184','2853']);await assert.rejects(pairing.addBoth(f.io,q,true));assert.equal(f.posts.length,3);
});
test('lost SD reply is reconciled without another add; changed SD price after earlier write stops',async()=>{
 const f=fixture('174184',{lostReply:true});await pairing.addBoth(f.io,await pairing.prepare(f.io,'174184',1,['battery','sd']),true);assert.equal(f.posts.length,3);
 const changed=fixture('174184',{afterAdd:(p,products)=>{if(p.pid==='2853')products['290616'].price++;}});await assert.rejects(pairing.addBoth(changed.io,await pairing.prepare(changed.io,'174184',1,['battery','sd']),true),e=>e.reviewCart===true);assert.deepEqual(changed.posts,[['174184',1],['2853',1]]);
});
test('card-only models use the same native guarded path',async()=>{
 for(const camera of ['246162','225714','277247']){const f=fixture(camera);await pairing.addBoth(f.io,await pairing.prepare(f.io,camera,1,['sd']),true);assert.deepEqual(f.posts,[[camera,1],['290616',1]]);}
});
