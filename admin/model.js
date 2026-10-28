/* Workbook operations only. No authentication or network access in this module. */
(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.CwagsAdminModel=model;})(globalThis,()=>{
 'use strict';
 const FILES={dogs:'DogInfo.xlsx',results:'Data for Tracker web.xlsx'};
 const FIELDS={dogs:['registrationNumber','callName','registeredName','handlerName'],results:['registrationNumber','callName','date','level','results','judge','Qs']};
 const LABELS={registrationNumber:'Registration Number',callName:'Call Name',registeredName:'Registered Name',handlerName:'Handler Name',date:'Date',level:'Level',results:'Results',judge:'Judge',Qs:'Points'};
 const reg=value=>/^(?:\d{2}-\d{4}-\d{2}|\d{8})$/.test(String(value||'').trim());
 const text=value=>String(value??'').trim();
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function date(value,X){
  if(value==null||value==='')return '';
  if(typeof value==='number'){const d=X.SSF.parse_date_code(value);return d?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:'';}
  if(value instanceof Date)return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  const result=text(value).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(result)?result:'';
 }
 function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}
 function clean(kind,record){
  const out={};for(const key of FIELDS[kind])out[key]=key==='Qs'?Number(record[key]):text(record[key]);return out;
 }
 function validate(kind,record){
  const r=clean(kind,record);
  if(!reg(r.registrationNumber))throw Error('Registration number must be YY-NNNN-NN or eight digits.');
  if(!r.callName||r.callName.length>150)throw Error('A call name of 1–150 characters is required.');
  if(kind==='dogs'){
   if(!r.handlerName||r.handlerName.length>200)throw Error('A handler name of 1–200 characters is required.');
   if(r.registeredName.length>300)throw Error('Registered name is too long.');
  }else{
   if(!validDate(r.date))throw Error('Enter a real date in YYYY-MM-DD format.');
   if(!r.level||r.level.length>100)throw Error('A level is required.');
   if(!r.judge||r.judge.length>200)throw Error('A judge is required.');
   if(record.Qs==null||text(record.Qs)===''||!Number.isFinite(r.Qs)||r.Qs<0)throw Error('Points must be a non-negative number.');
   if(r.results.length>300)throw Error('Results text is too long.');
  }
  for(const value of Object.values(r))if(typeof value==='string'&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('Control characters are not allowed.');
  return r;
 }
 function assertXlsx(bytes,maxRows){
  if(bytes.byteLength>25*1024*1024)throw Error('Workbook is too large for this beta (25 MB maximum).');
  const b=new Uint8Array(bytes);if(b[0]!==0x50||b[1]!==0x4b)throw Error('Choose an .xlsx workbook, not a CSV, XLS or HTML file.');
  // Bound the expanded ZIP size before parsing user-supplied workbooks.
  let expanded=0;
  for(let i=0;i+46<b.length;i++)if(b[i]===0x50&&b[i+1]===0x4b&&b[i+2]===1&&b[i+3]===2){
   const view=new DataView(b.buffer,b.byteOffset+i,46);expanded+=view.getUint32(24,true);
   if(expanded>180*1024*1024)throw Error('Expanded workbook is too large for the browser beta.');
   i+=45+view.getUint16(28,true)+view.getUint16(30,true)+view.getUint16(32,true);
  }
 }
 function open(kind,bytes,sha,X){
  assertXlsx(bytes);
  const workbook=X.read(bytes,{type:'array',cellDates:false,cellStyles:true,cellFormula:true});
  const sheetName=kind==='results'&&workbook.Sheets.Data?'Data':workbook.SheetNames[0];
  const sheet=workbook.Sheets[sheetName],range=X.utils.decode_range(sheet['!ref']||'A1');
  const records=[],byId=new Map(),byRegistration=new Map();
  for(let row=range.s.r;row<=range.e.r;row++){
   const raw=FIELDS[kind].map((_,col)=>sheet[X.utils.encode_cell({r:row,c:col})]?.v);
   if(!raw[0]||kind==='dogs'&&!reg(raw[0])||kind==='results'&&!raw[3])continue;
   if(kind==='results'&&/registration/i.test(text(raw[0])))continue;
   const value={};FIELDS[kind].forEach((key,col)=>value[key]=key==='date'?date(raw[col],X):key==='Qs'?Number(raw[col])||0:text(raw[col]));
   const id=kind==='dogs'?value.registrationNumber:'row-'+(row+1);
   if(kind==='dogs'&&byId.has(id)){
    const entry=byId.get(id);
    const comparable=r=>Object.fromEntries(Object.entries(r).map(([key,value])=>[key,typeof value==='string'?value.replace(/\s+/g,' '):value]));
    if(!equal(comparable(entry.value),comparable(value)))throw Error('DogInfo contains conflicting duplicate registration '+id+'. Resolve that source conflict before editing.');
    entry.rows.push(row);entry.value=value;continue;
   }
   const entry={id,rows:[row],value};records.push(entry);byId.set(id,entry);
   if(!byRegistration.has(value.registrationNumber))byRegistration.set(value.registrationNumber,[]);
   byRegistration.get(value.registrationNumber).push(entry);
  }
  if(!records.length)throw Error('No usable '+kind+' records were found.');
  return {kind,sha,bytes:new Uint8Array(bytes),sheetName,records,byId,byRegistration};
 }
 function change(dataset,{id,action='update',after,reason,allowDuplicate=false}){
  if(!['add','update','delete'].includes(action))throw Error('Choose add, update or delete.');
  const existing=action==='add'?null:dataset.byId.get(id);
  if(action!=='add'&&!existing)throw Error('This record no longer exists. Reload the workbook.');
  const value=action==='delete'?null:validate(dataset.kind,after);
  if(action==='update'&&dataset.kind==='dogs'&&value.registrationNumber!==existing.value.registrationNumber)throw Error('Registration numbers cannot be reassigned in this beta.');
  if(action==='add'&&dataset.kind==='dogs'&&dataset.byId.has(value.registrationNumber))throw Error('That registration already exists. Edit its existing DogInfo record.');
  if(action==='update'&&equal(value,existing.value))return null;
  if(!text(reason)||text(reason).length>400)throw Error('A correction reason of 1–400 characters is required.');
  if(action==='add'&&dataset.kind==='results'&&!allowDuplicate&&(dataset.byRegistration.get(value.registrationNumber)||[]).some(entry=>equal(entry.value,value)))throw Error('Possible duplicate trial entry. Review the existing result before adding it.');
  return {kind:dataset.kind,id:action==='add'?(dataset.kind==='dogs'?value.registrationNumber:'new-'+crypto.randomUUID()):id,action,sourceSha:dataset.sha,before:existing?{...existing.value}:null,after:value,reason:text(reason),allowDuplicate:Boolean(allowDuplicate)};
 }
 function validateBatch(datasets,changes){
  if(!changes.length)throw Error('There are no changes to publish.');
  if(changes.length>1000)throw Error('Publish at most 1,000 reviewed changes at a time.');
  const keys=new Set(),addedResults=new Set();
  for(const item of changes){
   if(!Object.hasOwn(FILES,item.kind))throw Error('Unknown workbook type in this draft.');
   const dataset=datasets[item.kind];if(!dataset)throw Error('Reload the affected workbook first.');
   if(item.sourceSha!==dataset.sha)throw Error('A draft was prepared against an older workbook. Reload and review it again.');
   const key=item.kind+':'+item.id;if(keys.has(key))throw Error('The draft contains two changes to the same record.');keys.add(key);
   const verified=change(dataset,item);if(!verified)throw Error('An unchanged draft record must be removed.');
   if(!equal(verified.before,item.before))throw Error('The source record does not match this draft. Reload it.');
   if(item.action==='add'&&item.kind==='results'){
    const fingerprint=JSON.stringify(verified.after);if(addedResults.has(fingerprint)&&!item.allowDuplicate)throw Error('The patch repeats the same new trial result.');addedResults.add(fingerprint);
   }
  }
 }
 function write(dataset,changes,X){
  // Work on a fresh workbook so a failed publication never mutates the loaded baseline.
  const workbook=X.read(dataset.bytes,{type:'array',cellDates:false,cellStyles:true,cellFormula:true});
  const sheet=workbook.Sheets[dataset.sheetName];let range=X.utils.decode_range(sheet['!ref']);
  for(const item of changes.filter(c=>c.kind===dataset.kind)){
   const rows=item.action==='add'?[++range.e.r]:dataset.byId.get(item.id).rows;
   for(const row of rows){
    if(item.action==='delete'){for(let col=range.s.c;col<=range.e.c;col++)delete sheet[X.utils.encode_cell({r:row,c:col})];continue;}
    FIELDS[dataset.kind].forEach((key,col)=>{
     if(item.action==='update'&&equal(item.before[key],item.after[key]))return;
     const address=X.utils.encode_cell({r:row,c:col}),old=sheet[address];
     let value=item.after[key];
     if(key==='date')value=(Date.parse(value+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
     const cell={...(old||{}),t:typeof value==='number'?'n':'s',v:value};delete cell.f;delete cell.w;delete cell.h;
     if(key==='date')cell.z=old?.z||'yyyy-mm-dd';sheet[address]=cell;
    });
   }
  }
  sheet['!ref']=X.utils.encode_range(range);
  return new Uint8Array(X.write(workbook,{type:'array',bookType:'xlsx',cellStyles:true,compression:true}));
 }
 function template(dataset,entries,X){
  const headers=['Action','Record ID','Source Revision',...FIELDS[dataset.kind].map(key=>LABELS[key]),'Reason','Allow Duplicate'];
  const rows=[headers];
  for(const entry of entries)rows.push(['update',entry.id,dataset.sha,...FIELDS[dataset.kind].map(key=>entry.value[key]),'',false]);
  if(!entries.length)rows.push(['add','',dataset.sha,...FIELDS[dataset.kind].map(()=>''),'',false]);
  const workbook=X.utils.book_new();X.utils.book_append_sheet(workbook,X.utils.aoa_to_sheet(rows),'Patch');
  return new Uint8Array(X.write(workbook,{type:'array',bookType:'xlsx',compression:true}));
 }
 function parsePatch(dataset,bytes,X){
  assertXlsx(bytes);const workbook=X.read(bytes,{type:'array'}),sheet=workbook.Sheets[workbook.SheetNames[0]];
  const range=X.utils.decode_range(sheet['!ref']||'A1');if(range.e.r>1000)throw Error('A patch may contain at most 1,000 rows.');
  const rows=X.utils.sheet_to_json(sheet,{header:1,defval:''});
  const columns=rows[0].map(header=>text(header).toLowerCase()),column=label=>columns.indexOf(label.toLowerCase());
  for(const label of ['Action','Record ID','Source Revision','Reason'])if(column(label)<0)throw Error('Use the downloaded patch template; the '+label+' column is missing.');
  return rows.slice(1).map((row,index)=>{
   if(row.every(cell=>cell==null||cell===''))return null;
   try{
    for(let col=0;col<columns.length;col++)if(sheet[X.utils.encode_cell({r:index+1,c:col})]?.f)throw Error('Patch cells must contain values, not formulas.');
    const action=text(row[column('Action')]).toLowerCase(),id=text(row[column('Record ID')]),sourceSha=text(row[column('Source Revision')]);
    if(action!=='add'&&sourceSha!==dataset.sha)throw Error('Source workbook changed since this patch was prepared. Export fresh rows and review again.');
    const after={};for(const key of FIELDS[dataset.kind]){const col=column(LABELS[key]);if(col<0)throw Error('Missing '+LABELS[key]+' column.');after[key]=key==='date'?date(row[col],X):row[col];}
    const candidate=change(dataset,{id,action,after,reason:row[column('Reason')],allowDuplicate:/^(true|yes|1)$/i.test(text(row[column('Allow Duplicate')]))});
    return {row:index+2,valid:true,change:candidate,message:candidate?action:'No change',selected:Boolean(candidate)&&action!=='delete'};
   }catch(error){return {row:index+2,valid:false,change:null,message:error.message,selected:false};}
  }).filter(Boolean);
 }
 return {FILES,FIELDS,LABELS,open,validate,change,validateBatch,write,template,parsePatch,equal};
});
