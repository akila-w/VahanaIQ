// Real account controller with deferred Firebase operations; synthetic identities only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../js/account.js', import.meta.url), 'utf8')
 .replace(/^import .*;\n/gm, '').replace(/export /g, '');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b}); return {promise,resolve,reject}; };
const flush = async () => { for(let i=0;i<8;i++)await Promise.resolve(); };
function harness() {
 const values=new Map(), elements=new Map(), reads=[], writes=[], deletes=[], alerts=[];
 let resetCount=0, reloadCount=0;
 const element=id=>{ if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',disabled:false,classList:{toggle(){}},setAttribute(){},focus(){}});return elements.get(id); };
 const context=vm.createContext({ console, setTimeout, clearTimeout, document:{getElementById:element}, window:{}, localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  STORE_KEY:'inputs', COMPARISON_KEY:'cars', PLANNER_KEY:'planner', cleanPlanner:x=>x,
  openModal(){},closeModal(){},isOpen(){return false},showToast:x=>alerts.push(x)});
 vm.runInContext(source+`\nglobalThis.testApi={onUser,runSync,resolveConflict,deleteData,signOutHere,session,current,syncNow,localCopy,cloudCopy,fingerprint,install(f){fb=f;hooks={beforeApply(){testReset()},reload(){testReload()}}},state(){return {user,conflict,failed,syncing}}};`,context);
 context.testReset=()=>{resetCount++;values.delete('inputs')};context.testReload=()=>reloadCount++;
 const fb={db:{},auth:{},F:{doc:(_db,_path,uid)=>uid,getDoc:uid=>{const d=deferred();reads.push({uid,...d});return d.promise},setDoc:(uid,data)=>{const d=deferred();writes.push({uid,data,...d});return d.promise},deleteDoc:uid=>{const d=deferred();deletes.push({uid,...d});return d.promise},serverTimestamp:()=>1},A:{signOut:async()=>context.testApi.onUser(null)}};
 const api=context.testApi;api.install(fb);
 return {api,values,elements,reads,writes,deletes,alerts,get resets(){return resetCount},get reloads(){return reloadCount}};
}
const account=uid=>({uid,email:uid+'@example.invalid'});
const snapshot=copy=>({exists:()=>true,data:()=>({data:JSON.stringify(copy)})});
// Initial anonymous data survives Firebase's initial signed-out callback.
{
 const h=harness();h.values.set('inputs','{"income":"123"}');h.api.onUser(null);assert.equal(h.resets,0);assert.ok(h.values.has('inputs'));
}
// A's late read cannot populate B or write B's document.
{
 const h=harness();h.api.onUser(account('A'));h.api.onUser(account('B'));
 h.reads[0].resolve(snapshot({inputs:{income:'111'},cars:[]}));await flush();
 assert.equal(h.api.state().user.uid,'B');assert.equal(h.writes.length,0);assert.ok(!h.values.get('inputs')?.includes('111'));
 h.reads[1].resolve(snapshot({inputs:{income:'222'},cars:[]}));await flush();assert.ok(h.values.get('inputs').includes('222'));
}
// A → signed out → A is a different session, even though its UID is unchanged.
{
 const h=harness();h.api.onUser(account('A'));const ctx=h.api.session();h.api.onUser(null);h.api.onUser(account('A'));
 assert.equal(h.api.current(ctx),false);h.reads[0].resolve(snapshot({inputs:{income:'111'},cars:[]}));await flush();assert.ok(!h.values.get('inputs')?.includes('111'));
}
// External logout clears storage, private UI and hidden account identity immediately.
{
 const h=harness();h.api.onUser(account('A'));h.values.set('inputs','{"income":"999"}');h.values.set('planner','private');h.api.onUser(null);
 assert.equal(h.values.get('inputs'),'{}');assert.equal(h.values.has('planner'),false);assert.ok(h.resets>0&&h.reloads>0);assert.equal(h.elements.get('accountEmail').textContent,'');
}
// An old upload's acknowledgement cannot become B's sync baseline.
{
 const h=harness();h.values.set('inputs','{"income":"111"}');h.api.onUser(account('A'));h.reads[0].resolve({exists:()=>false});await flush();
 assert.equal(h.writes[0].uid,'A');h.api.onUser(account('B'));h.writes[0].resolve();await flush();assert.equal(h.values.has('vahanaiq_synced_v1'),false);
}
// Conflict actions expire on identity change.
{
 const h=harness();h.values.set('inputs','{"income":"111"}');h.api.onUser(account('A'));h.reads[0].resolve(snapshot({inputs:{income:'222'},cars:[]}));await flush();assert.ok(h.api.state().conflict);
 h.api.onUser(account('B'));h.api.resolveConflict(true);assert.ok(!h.values.get('inputs')?.includes('222'));
}
// A delete already awaiting a sync must not start deleting B after that await.
{
 const h=harness();h.api.onUser(account('A'));const deletion=h.api.deleteData();h.api.onUser(account('B'));h.reads[0].resolve({exists:()=>false});await deletion;assert.equal(h.deletes.length,0);
}
// Explicit local sign-out retains unsynchronised edits, with its promised warning.
{
 const h=harness();h.api.onUser(account('A'));h.reads[0].resolve({exists:()=>false});await flush();h.values.set('inputs','{"income":"333"}');await h.api.signOutHere('',{flush:false});assert.ok(h.values.get('inputs').includes('333'));assert.ok(h.alerts.some(x=>x.includes('kept them')));
}
// Deletion bars new writes until the existing work has drained and deletion ends.
{
 const h=harness();h.api.onUser(account('A'));h.reads[0].resolve({exists:()=>false});await flush();
 const deletion=h.api.deleteData();await flush();assert.equal(h.deletes.length,1);
 h.values.set('inputs','{"income":"444"}');await h.api.syncNow();assert.equal(h.reads.length,1);assert.equal(h.writes.length,0);
 h.deletes[0].resolve();await deletion;assert.equal(h.api.state().user,null);
}
console.log('Account session transitions: nine deferred-operation and privacy scenarios passed');
