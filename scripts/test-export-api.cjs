// Read-only live integration check; private credentials/CSVs stay under work/.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MongoClient } = require('../dashboard/node_modules/mongodb');
const env = Object.fromEntries(fs.readFileSync('dashboard/.env.local','utf8').split(/\r?\n/).filter(x => x && !x.startsWith('#')).map(x => {
  const i = x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];
}));
const origin = process.argv[2] || 'http://localhost:3100';
const date = process.argv[3] || '2026-11-27';
const output = process.argv[4] || 'work/daily-export-local-check.json';
const payload = (Date.now()+3600000) + '.' + crypto.randomBytes(16).toString('hex');
const cookie = 'fleet_session=' + payload + '.' + crypto.createHmac('sha256',env.DASHBOARD_PASSWORD).update(payload).digest('hex');
const auth = {Authorization:'Bearer '+env.EXPORT_JOB_SECRET};
const checks = {};
function httpGet(url,headers){
  // Fresh sockets avoid this Windows/hotspot's intermittent pooled-fetch stalls.
  return new Promise((resolve,reject)=>{
    const transport=require(url.startsWith('https:')?'node:https':'node:http');
    const request=transport.get(url,{headers,agent:false,timeout:20000},response=>{
      const chunks=[];response.on('data',x=>chunks.push(x));response.on('end',()=>{
        const body=Buffer.concat(chunks).toString('utf8');
        resolve({status:response.statusCode,text:async()=>body,json:async()=>JSON.parse(body)});
      });response.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(new Error('HTTP timeout')));request.on('error',reject);
  });
}
async function expectStatus(url,status,headers) {
  let r;
  for(let attempt=0;attempt<3;attempt++){
    try{r=await httpGet(origin+url,headers);break;}
    catch(error){if(attempt===2)throw new Error('Network failure at '+url.split('?')[0]);await new Promise(resolve=>setTimeout(resolve,500));}
  }
  assert.equal(r.status,status,url);return r;
}
function csvRows(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&c===','){row.push(cell);cell='';}
    else if(!quoted&&c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  assert.ok(!quoted);return rows;
}
(async()=>{
  for(const route of ['day?date='+date,'plan','backup','setup']) await expectStatus('/api/exports/'+route,401);
  await expectStatus('/api/exports/setup',401,auth);
  await expectStatus('/api/exports/plan',401,{Cookie:cookie});
  await expectStatus('/api/exports/day?date=2026-02-30',400,auth);
  await expectStatus('/api/exports/day?date='+date+'&node=wrong',400,auth);
  checks.authorizationAndValidation=true;
  const html=await(await expectStatus('/',200,{Cookie:cookie})).text();
  assert.ok(html.includes('Daily data files')&&html.includes('Download CSV'));checks.dashboardForm=true;
  const setup=await(await expectStatus('/api/exports/setup',200,{Cookie:cookie})).text();
  assert.ok(setup.includes('configureFleetExport')&&setup.includes(env.EXPORT_JOB_SECRET));
  new(require('node:vm').Script)(setup);checks.privateSetupSyntax=true;
  let cursor='',snapshot='',total=-1,count=0,parts=[],pages=0;
  do{
    const q=new URLSearchParams({date,...(snapshot?{snapshot}:{}),...(cursor?{cursor}:{})});
    const p=await(await expectStatus('/api/exports/day?'+q,200,auth)).json();pages++;
    if(!snapshot){snapshot=p.snapshot;total=p.total;parts.push(p.header);
      if(p.nextCursor)await expectStatus('/api/exports/day?date=2026-11-26&snapshot='+encodeURIComponent(snapshot)+'&cursor='+encodeURIComponent(p.nextCursor),400,auth);
    }
    assert.equal(p.snapshot,snapshot);assert.equal(p.date,date);count+=p.rows;parts.push(p.csv);cursor=p.nextCursor;
  }while(cursor);
  assert.equal(count,total);const csv=parts.join('');const parsed=csvRows(csv);
  assert.equal(parsed.length,count+1);assert.equal(parsed[0].length,20);
  const ids=new Set(),nodes=new Set();for(const row of parsed.slice(1)){
    assert.equal(row.length,20);assert.equal(row[0],date);assert.ok(!ids.has(row[4]+':'+row[5]));ids.add(row[4]+':'+row[5]);nodes.add(row[4]);
  }
  const client=env.MONGODB_URI ? new MongoClient(env.MONGODB_URI,{serverSelectionTimeoutMS:8000}) : undefined;
  try{
    if (client) {
    const start=new Date(date+'T00:00:00+05:30'),end=new Date(+start+86400000);
    const expected=await client.db(env.MONGODB_DATABASE||'esp32_fleet').collection('events').countDocuments({receivedAt:{$lte:new Date(snapshot)},$or:[
      {sampledAt:{$gte:+start/1000,$lt:+end/1000}},
      {sampledAt:{$exists:false},receivedAt:{$gte:start,$lt:end,$lte:new Date(snapshot)}}]});
    assert.equal(count,expected);checks.atlasCountMatches=true;
    } else { checks.atlasCountMatches='Independent connector comparison required; production secret is not available locally'; }
  }finally{await client?.close();}
  if(count>1000)assert.ok(pages>1);checks.completePaginatedDownload=true;checks.uniqueRows=true;
  const node=[...nodes][0];if(node){
    const p=await(await expectStatus('/api/exports/day?'+new URLSearchParams({date,node,snapshot}),200,{Cookie:cookie})).json();
    assert.ok(p.rows>0);assert.ok(csvRows(p.header+p.csv).slice(1).every(row=>row[4]===node));checks.nodeFilter=true;
  }
  const plan=await(await expectStatus('/api/exports/plan',200,auth)).json();assert.ok(Array.isArray(plan.dates));checks.automaticPlan=true;
  const result={checkedAtUtc:new Date().toISOString(),origin,date,snapshot,rows:count,pages,nodes:[...nodes],bytes:Buffer.byteLength('\ufeff'+csv),
    sha256:crypto.createHash('sha256').update('\ufeff'+csv).digest('hex'),checks,driveAuthorization:'Not exercised by this API test'};
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  fs.writeFileSync(path.join(path.dirname(output),path.basename(output,'.json')+'.csv'),'\ufeff'+csv);
  console.log(JSON.stringify(result));
})().catch(error=>{console.error(error.name+': '+error.message);process.exitCode=1;});
