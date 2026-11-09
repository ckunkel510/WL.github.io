'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../NativeCheckout.js'),'utf8');
function blurFixture(tag,options={}) {
  const timers=[],commits=[];let listener;
  const active={},target={tagName:tag},related=options.inside?{}:null;
  const pane={contains:node=>options.inside&&node===related};
  const context=vm.createContext({wizard:{addEventListener(type,fn){listener=fn;}},win:{clearTimeout(){},setTimeout(fn){timers.push(fn);}},document:{activeElement:active},doc:{activeElement:active},commitTimer:null,paneFor:()=>pane,stepFor:node=>node===active?(options.otherEditor?3:0):4,finish:(...args)=>commits.push(args)});
  const start=source.indexOf("    wizard.addEventListener('focusout',function (event)");
  vm.runInContext(source.slice(start,source.indexOf("    wizard.addEventListener('click'",start)),context);
  listener({target,relatedTarget:related});timers.forEach(fn=>fn());
  return {commits,timers};
}
test('hiding the focused Edit billing button cannot close the newly opened billing editor',()=>{
  const f=blurFixture('BUTTON');assert.equal(f.timers.length,0);assert.equal(f.commits.length,0);
});
test('a completed data-entry field can still commit when the customer leaves its section',()=>{
  for(const tag of ['INPUT','SELECT','TEXTAREA']) assert.deepEqual(blurFixture(tag).commits,[[4,false]]);
});
test('moving between billing fields leaves the editor open',()=>{
  assert.equal(blurFixture('INPUT',{inside:true}).commits.length,0);
});
test('finishing a field cannot close another editor the customer has already focused',()=>{
  assert.equal(blurFixture('INPUT',{otherEditor:true}).commits.length,0);
});

const core=require('../NativeCheckout');
test('explicit address mismatch replies give statement-address guidance without inventing a charge result',()=>{
 for(const message of ['Transaction declined: AVS verification failed','Billing address does not match','AVS result: N']) {
  const result=core.paymentFeedback(message);assert.equal(result.kind,'billing');assert.match(result.detail,/card statement/);assert.doesNotMatch(result.detail,/no charge|not charged|never charged/i);
 }
});
test('card security, issuer decline and insufficient funds receive distinct, accurate guidance',()=>{
 assert.equal(core.paymentFeedback('CVV did not match').kind,'security-code');
 assert.equal(core.paymentFeedback('Your card was declined').kind,'declined');
 assert.equal(core.paymentFeedback('Payment declined: insufficient funds').kind,'funds');
 assert.doesNotMatch(core.paymentFeedback('Payment declined: insufficient funds').detail,/billing address/);
});
test('timeouts and unavailable address verification never tell the customer that their address is wrong',()=>{
 for(const message of ['Payment gateway timed out','Your payment could not be confirmed','AVS unavailable','Payment gateway timeout, AVS failed']) {
  const result=core.paymentFeedback(message);assert.equal(result.kind,'unconfirmed');assert.match(result.detail,/order history/);assert.doesNotMatch(result.detail,/try again|address.*wrong/i);
 }
});
test('an approval with an AVS warning and an order confirmation never become a fabricated decline',()=>{
 for(const message of ['Payment approved. AVS result: N','Order confirmed. AVS mismatch','Transaction was approved. AVS result: Z'])assert.equal(core.paymentFeedback(message),null);
});
test('field formatting, ordinary billing instructions and unrelated errors are not payment declines',()=>{
 for(const message of ['ZIP must be 5 digits','Use the billing address on your card statement','Login failed','An error occurred',''])assert.equal(core.paymentFeedback(message),null);
});

function feedbackDOM(message) {
 const nodes=new Map();
 const element=tag=>({tagName:tag.toUpperCase(),dataset:{},children:[],attributes:{},textContent:'',setAttribute(key,value){this.attributes[key]=value;},append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},remove(){nodes.delete(this.id);},closest(){return this.id==='wl-native-payment-feedback'?this:null;}});
 const native=element('p');native.id='CartResponseMessage';native.textContent=message;
 const host={firstChild:native,insertBefore(node){nodes.set(node.id,node);}};
 const doc={getElementById:id=>nodes.get(id)||null,querySelectorAll:()=>[native],querySelector:()=>host,createElement:element,head:{appendChild(node){nodes.set(node.id,node);}}};
 return {native,nodes,win:{document:doc,getComputedStyle:node=>({display:node.hidden?'none':'block',visibility:'visible'})}};
}
test('a native payment mismatch receives accessible guidance while preserving the original error and hiding no controls',()=>{
 const f=feedbackDOM('AVS verification failed for private customer details');
 core.renderPaymentFeedback(f.win);const box=f.nodes.get('wl-native-payment-feedback');
 assert.equal(box.dataset.kind,'billing');assert.equal(box.attributes.role,'alert');
 assert.equal(f.native.textContent,'AVS verification failed for private customer details');
 assert.equal(box.children[0].textContent,'Check your billing address');
 assert.doesNotMatch(box.children[1].textContent,/private customer/);
 core.renderPaymentFeedback(f.win);assert.equal(f.nodes.get('wl-native-payment-feedback'),box);
});
test('a changed native error updates the guidance and a cleared error removes it',()=>{
 const f=feedbackDOM('AVS mismatch');core.renderPaymentFeedback(f.win);
 f.native.textContent='CVV did not match';core.renderPaymentFeedback(f.win);assert.equal(f.nodes.get('wl-native-payment-feedback').dataset.kind,'security-code');
 f.native.textContent='';core.renderPaymentFeedback(f.win);assert.equal(f.nodes.has('wl-native-payment-feedback'),false);
});
test('hidden stale native errors and approved payments do not produce a warning',()=>{
 const hidden=feedbackDOM('AVS mismatch');hidden.native.hidden=true;core.renderPaymentFeedback(hidden.win);assert.equal(hidden.nodes.has('wl-native-payment-feedback'),false);
 const approved=feedbackDOM('Payment approved. AVS result: N');core.renderPaymentFeedback(approved.win);assert.equal(approved.nodes.has('wl-native-payment-feedback'),false);
});

function finishFixture(options={}) {
 let oldError=true,validations=0,opened=null;
 const context=vm.createContext({abandoned:false,asyncBusy:()=>!!options.busy,editing:4,adapter:{valid:()=>!options.invalid,validate(){validations++;oldError=!!options.invalid;return !options.invalid;}},refresh:()=>({next:5}),open:step=>{opened=step;}});
 const start=source.indexOf('    function finish(step,explicit)');
 vm.runInContext(source.slice(start,source.indexOf('    panes.forEach(',start)),context);
 return {run:explicit=>context.finish(4,explicit),error:()=>oldError,validations:()=>validations,opened:()=>opened,context};
}
test('corrected billing clears its stale native error before the valid section is collapsed',()=>{
 const f=finishFixture();f.run(true);assert.equal(f.error(),false);assert.equal(f.validations(),1);assert.equal(f.opened(),5);assert.equal(f.context.editing,null);
});
test('valid field blur clears stale errors without moving focus into another section',()=>{
 const f=finishFixture();f.run(false);assert.equal(f.error(),false);assert.equal(f.opened(),null);
});
test('invalid billing stays open and a pending native update cannot confirm it',()=>{
 const invalid=finishFixture({invalid:true});invalid.run(true);assert.equal(invalid.error(),true);assert.equal(invalid.opened(),4);
 const busy=finishFixture({busy:true});busy.run(true);assert.equal(busy.validations(),0);assert.equal(busy.context.editing,4);
});

test('ambiguous processor-dependent AVS letter codes are not invented billing declines',()=>{
 for(const code of ['A','W','Z'])assert.equal(core.paymentFeedback('AVS result: '+code),null);
});
test('the normal native order-confirmation wording cannot become a payment warning',()=>{
 assert.equal(core.paymentFeedback('Thank you. Your reserved order W123456 was submitted and will be processed. AVS mismatch'),null);
 assert.equal(core.paymentFeedback('No order was submitted. Payment declined.').kind,'declined');
});
