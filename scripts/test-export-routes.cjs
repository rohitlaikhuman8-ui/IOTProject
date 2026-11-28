const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('../dashboard/node_modules/typescript');
const {z}=require('../dashboard/node_modules/zod');
function load(file,requires={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:9}}).outputText,
 {exports,require:n=>requires[n]||require(n),Buffer,Date,console,Response,Request,URL,process:{env:{EXPORT_JOB_SECRET:'test-secret-with-at-least-32-characters'}}});return exports;
}
const fmt=load('dashboard/lib/export-format.ts');
let session=false,job=false,query;
const helpers=load('dashboard/lib/exports.ts',{'./session':{authenticated:async()=>session},'./fleet':{secretMatches:(a,b)=>a===b},'./export-format':fmt,zod:{z}});
const snapshot='2026-11-28T00:00:00.000Z',date='2026-11-27';
const receivedAt=new Date('2026-11-27T12:00:00Z');
const rows=Array.from({length:1001},(_,i)=>({_id:'esp32-3013a5f4e9d4:'+i.toString(16).padStart(32,'0'),nodeId:'esp32-3013a5f4e9d4',eventId:i.toString(16).padStart(32,'0'),receivedAt,
 sampledAt:Math.floor(+receivedAt/1000),kind:'sample',value:9.8,sensitivity:1,version:'v',uptimeMs:i,resetReason:1}));
const routes=load('dashboard/app/api/exports/day/route.ts',{
 '../../../../lib/fleet':{nodeId:z.string().regex(/^esp32-[a-f0-9]{12}$/),events:()=>({find:q=>{query=q;let current=q.$and?rows.slice(1000):rows;
   return {sort(){return this},limit(){return this},maxTimeMS(){return this},toArray:async()=>current};},countDocuments:async()=>1001})},
 '../../../../lib/exports':{...helpers,exportAuthenticated:async()=>session||job},'../../../../lib/export-format':fmt});
(async()=>{
 assert.equal((await routes.GET(new Request('https://fleet.test/api/exports/day?date='+date))).status,401);
 job=true;
 assert.equal((await routes.GET(new Request('https://fleet.test/api/exports/day?date=2026-02-30'))).status,400);
 const first=await(await routes.GET(new Request('https://fleet.test/api/exports/day?'+new URLSearchParams({date,snapshot})))).json();
 assert.equal(first.rows,1000);assert.equal(first.total,1001);assert.ok(first.nextCursor);assert.ok(first.csv.includes(rows[0].eventId));
 const last=await(await routes.GET(new Request('https://fleet.test/api/exports/day?'+new URLSearchParams({date,snapshot,cursor:first.nextCursor})))).json();
 assert.equal(last.rows,1);assert.equal(last.nextCursor,null);assert.equal(query.$and[1].$or[1]._id.$gt,rows[999]._id);
 assert.equal((await routes.GET(new Request('https://fleet.test/api/exports/day?'+new URLSearchParams({date:'2026-11-26',snapshot,cursor:first.nextCursor})))).status,400);
 const filter=helpers.exportFilter(date,new Date(snapshot));assert.equal(filter.$or[1].sampledAt.$exists,false);
 assert.equal(filter.$or[0].sampledAt.$gte,Date.parse('2026-11-26T18:30:00Z')/1000);
 assert.equal(filter.$or[0].sampledAt.$lt,Date.parse('2026-11-27T18:30:00Z')/1000);
 console.log('PASS: actual route authorization, invalid date rejection, 1001-record boundary, tied receipt-time cursor, scope rejection and capture/fallback query bounds');
})().catch(e=>{console.error(e);process.exitCode=1});
