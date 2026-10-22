import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const element=()=>({children:[],classList:{add(){},remove(){},contains(){return false}},contains(){return false},matches(){return false},addEventListener(type,fn){this[type]=fn},appendChild(x){this.children.push(x)},set textContent(v){this.children=[]},get textContent(){return ''}});
const toast=element(),document={activeElement:null,getElementById:()=>toast,createElement:element};
const source=fs.readFileSync(new URL('../js/toast.js',import.meta.url),'utf8').replace(/export /g,'');
const c=vm.createContext({document,setTimeout:()=>1,clearTimeout(){}});vm.runInContext(source+'\nglobalThis.api={showToast,clearToast};',c);
let restored=0;const old=c.api.showToast('A removed a vehicle','Undo',()=>restored++);c.api.clearToast();old.click();assert.equal(restored,0,'A detached Undo button cannot restore the previous copy');
c.api.showToast('B removed a vehicle','Undo',()=>restored++).click();assert.equal(restored,1,'Current-copy Undo still works');
// Exercise the production image callback gate with a deferred image load.
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const guard=app.slice(app.indexOf('let copyGeneration ='),app.indexOf('export function formatVehicleTitle'));
let complete;const context=vm.createContext({normalizeImageToStudio:(_src,cb)=>{complete=cb}});vm.runInContext(guard+'\nglobalThis.api={normaliseCurrentImage,reset(){copyGeneration++}};',context);
let inserted=0;context.api.normaliseCurrentImage('official',()=>inserted++);context.api.reset();complete('photo');assert.equal(inserted,0,'Late image load cannot insert a departed copy');
context.api.normaliseCurrentImage('official',()=>inserted++);complete('photo');assert.equal(inserted,1,'Current copy can add an image');
// Integration hook must invalidate both kinds of retained work before resetting inputs.
const hook=app.slice(app.indexOf('  beforeApply() {'),app.indexOf('  reload() {',app.indexOf('initAccount({')));
assert.ok(hook.indexOf('copyGeneration++')<hook.indexOf('clearState()'));
assert.ok(hook.indexOf('clearToast()')<hook.indexOf('clearState()'));
assert.match(hook, /'aiModal'/);assert.match(hook, /'shareLink'/);assert.match(hook, /vahanaiq:copy-reset/);
console.log('Copy privacy: stale Undo and image callbacks rejected; current-copy actions preserved');
