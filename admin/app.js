(()=>{
 'use strict';
 const M=CwagsAdminModel,G=CwagsAdminGitHub,$=id=>document.getElementById(id);
 if(location.protocol==='file:'){
  $('githubToken').value='';$('githubToken').disabled=true;
  $('startup').textContent='This is the local working copy. Upload the complete admin folder to the beta repository, then open https://chrojoh.github.io/CWag-Tracker/admin/ to connect.';return;
 }
 if(!M||!G||typeof XLSX==='undefined'||typeof CwagsAdminZip!=='function'){$('startup').textContent='A required administrator file is missing. Upload all files in the admin folder and reload.';return;}
 if(!window.isSecureContext){document.body.textContent='Open this administrator page using HTTPS, or localhost for testing.';return;}
 if(window.top!==window.self){document.body.textContent='Open the administrator page directly in its own browser tab.';return;}
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const draftKey='cwags-beta-admin-draft-v1';
 let api=null,account='',snapshot=null,datasets={},changes=[],view='dogs',kind='dogs',query='',page=0,editing=null,patch=[],restore=null,busy=false,batchId=crypto.randomUUID();
 const PAGE_SIZE=50;
 const status=text=>{$('status').textContent=text;};
 const error=text=>{$('error').textContent=text||'';};
 const entryKey=change=>change.kind+':'+change.id;
 function download(value,name,type){const url=URL.createObjectURL(value instanceof Blob?value:new Blob([value],{type}));const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 function persist(){
  try{if(changes.length)localStorage.setItem(draftKey,JSON.stringify({repository:G.REPOSITORY,changes,batchId}));else localStorage.removeItem(draftKey);}
  catch(_){status('Draft is available in this tab, but browser storage is full. Use Download draft to keep a copy.');}
 }
 function savedDraft(){try{const saved=JSON.parse(localStorage.getItem(draftKey)||'null');return saved?.repository===G.REPOSITORY&&Array.isArray(saved.changes)?saved:null;}catch(_){return null;}}
 async function run(action){if(busy)return;busy=true;error('');toggleBusy();try{await action();}catch(e){error(e.message||'The operation could not finish.');}finally{busy=false;toggleBusy();}}
 function toggleBusy(){document.querySelectorAll('button').forEach(button=>{
  if(busy){if(!button.hasAttribute('data-was-disabled'))button.dataset.wasDisabled=button.disabled?'1':'0';button.disabled=true;}
  else if(button.hasAttribute('data-was-disabled')){button.disabled=button.dataset.wasDisabled==='1';delete button.dataset.wasDisabled;}
 });$('githubToken').disabled=busy;}
 async function load(){
  const next=await api.snapshot(await api.head()),loaded={};
  for(const key of ['dogs','results']){
   status('Loading '+M.FILES[key]+' from the beta repository…');
   const bytes=await api.blob(next.files[M.FILES[key]]);await new Promise(resolve=>setTimeout(resolve,0));
   loaded[key]=M.open(key,bytes,next.files[M.FILES[key]],XLSX);
  }
  snapshot=next;datasets=loaded;query='';page=0;patch=[];editing=null;restore=null;
  $('identity').textContent='Connected as '+account+' · '+G.REPOSITORY;
  $('revision').textContent='Loaded commit '+snapshot.head.slice(0,8);
  status('Loaded '+datasets.dogs.records.length.toLocaleString()+' dogs and '+datasets.results.records.length.toLocaleString()+' trial results. Nothing has been changed on GitHub.');
  render();
 }
 function filtered(){return datasets[kind].records.filter(record=>!query||Object.values(record.value).join(' ').toLowerCase().includes(query.toLowerCase()));}
 function draftNotice(){
  const saved=savedDraft();if(changes.length||!saved?.changes.length)return '';
  const valid=saved.changes.every(change=>datasets[change.kind]?.sha===change.sourceSha);
  return '<section class="panel"><h3>Saved draft found</h3><p>'+saved.changes.length+' pending change(s). '+(valid?'Its source revisions match the current files.':'The workbooks have changed. This draft cannot be applied without a new review.')+'</p><div class="actions">'+(valid?'<button data-action="restore-draft">Restore draft</button>':'')+'<button data-action="download-saved-draft">Download saved draft</button><button data-action="discard-saved-draft">Discard saved draft</button></div></section>';
 }
 function render(){
  if(!snapshot)return;
  $('draftCount').textContent=changes.length;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  $('heading').textContent={dogs:'DogInfo records',results:'Trial results',patch:'Upload a patch',review:'Review & publish',history:'History & restore'}[view];
  let html=draftNotice();
  if(view==='dogs'||view==='results'){
   kind=view;const matches=filtered(),visible=matches.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
   html+='<label for="recordSearch">Find by registration, name'+(kind==='results'?', date, level or judge':' or handler')+'</label><div class="toolbar"><input class="search" id="recordSearch" value="'+escape(query)+'" placeholder="Search published records"><span class="hint">'+matches.length.toLocaleString()+' matching records</span></div><div class="actions"><button data-action="add">Add '+(kind==='dogs'?'dog':'trial result')+'</button><button data-action="export-visible">Export these rows for patching</button><button data-action="template">Download blank patch template</button></div>';
   html+='<div class="table-scroll"><table><thead><tr><th>Registration / record</th><th>Dog'+(kind==='results'?' / trial':' / handler')+'</th><th>'+(kind==='results'?'Judge / points':'Registered name')+'</th><th></th></tr></thead><tbody>'+visible.map(record=>{
    const value=record.value,pending=changes.some(item=>item.kind===kind&&item.id===record.id);
    return '<tr><td class="key">'+escape(value.registrationNumber)+(kind==='results'?'<small>'+escape(record.id)+'</small>':'')+'</td><td>'+escape(value.callName)+'<small>'+escape(kind==='dogs'?value.handlerName:value.date+' · '+value.level)+'</small></td><td>'+escape(kind==='dogs'?value.registeredName:value.judge)+'<small>'+(kind==='results'?escape(value.Qs)+' point(s)':'')+'</small></td><td>'+(pending?'<span class="badge">Draft</span> ':'')+'<button data-edit="'+escape(record.id)+'">Edit</button></td></tr>';
   }).join('')+'</tbody></table></div><div class="actions"><button data-action="previous" '+(page===0?'disabled':'')+'>Previous</button><span>Page '+(page+1)+' of '+Math.max(1,Math.ceil(matches.length/PAGE_SIZE))+'</span><button data-action="next" '+((page+1)*PAGE_SIZE>=matches.length?'disabled':'')+'>Next</button></div><div id="editor"></div>';
  }
  if(view==='patch')html+='<section class="panel"><label for="patchKind">Workbook to update</label><select id="patchKind"><option value="dogs" '+(kind==='dogs'?'selected':'')+'>DogInfo.xlsx</option><option value="results" '+(kind==='results'?'selected':'')+'>Data for Tracker web.xlsx</option></select><p>Use a blank patch template for additions. To edit existing records, export the relevant rows from the records screen, keeping their Record ID and Source Revision columns.</p><div class="actions"><button data-action="template">Download blank patch template</button></div><label for="patchFile">Choose the completed .xlsx patch</label><input id="patchFile" type="file" accept=".xlsx"><p class="hint">Only the rows you select below will be staged. Other records are kept. Maximum: 1,000 rows.</p></section>'+patchMarkup();
  if(view==='review')html+=reviewMarkup();
  if(view==='history')html+='<div class="actions"><button data-action="load-history">Load GitHub history</button><button data-action="backup">Download current workbook backup</button></div><div id="historyList"></div><div id="restoreReview"></div>';
  $('content').innerHTML=html;
  if(editing&&$('editor'))renderEditor();
 }
 function field(key,value,readonly){
  const type=key==='date'?'date':key==='Qs'?'number':'text';
  return '<div><label for="edit-'+key+'">'+escape(M.LABELS[key])+'</label><input id="edit-'+key+'" name="'+key+'" type="'+type+'" '+(key==='Qs'?'step="any" min="0" ':'')+(readonly?'readonly ':'')+'value="'+escape(value)+'"></div>';
 }
 function renderEditor(){
  const pending=changes.find(item=>item.kind===kind&&item.id===editing.id),existing=datasets[kind].byId.get(editing.id),isNew=editing.action==='add';
  const value=pending?.after||existing?.value||Object.fromEntries(M.FIELDS[kind].map(key=>[key,key==='Qs'?1:'']));
  $('editor').innerHTML='<section class="panel"><h3>'+(isNew?'Add record':'Edit '+escape(editing.id))+'</h3><form id="editForm"><div class="form-grid">'+M.FIELDS[kind].map(key=>field(key,value[key],kind==='dogs'&&key==='registrationNumber'&&!isNew)).join('')+'<div class="full"><label for="editReason">Reason for this change</label><input id="editReason" name="reason" required maxlength="400" value="'+escape(pending?.reason||'')+'"></div>'+(kind==='results'&&isNew?'<label class="inline-check full"><input id="allowDuplicate" type="checkbox">This is a separate trial entry even if all values match an existing result.</label>':'')+'</div><div class="actions"><button type="button" class="primary" data-action="save-edit">Save to review</button><button type="button" data-action="cancel-edit">Cancel</button>'+(!isNew?'<button type="button" class="danger" data-action="delete-record">Stage removal of this entry</button>':'')+'</div><p class="hint">Saving to review does not change GitHub or the phone tracker.</p></form></section>';
  $('editor').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 function differences(item){
  if(item.action==='delete')return 'Remove '+escape(item.before.callName)+' ('+escape(item.before.registrationNumber)+')';
  if(item.action==='add')return 'Add '+escape(item.after.callName)+' ('+escape(item.after.registrationNumber)+')';
  return M.FIELDS[item.kind].filter(key=>!M.equal(item.before[key],item.after[key])).map(key=>'<div>'+escape(M.LABELS[key])+': '+escape(item.before[key])+' → '+escape(item.after[key])+'</div>').join('');
 }
 function reviewMarkup(){
  if(!changes.length)return '<section class="panel"><p>No draft changes. Edit a record or upload a patch first.</p></section>';
  return '<p>These changes are not published yet. Both workbook revisions will be checked again before saving.</p><div class="table-scroll"><table><thead><tr><th>Workbook / record</th><th>Before → after</th><th>Reason</th><th></th></tr></thead><tbody>'+changes.map((item,index)=>'<tr><td>'+escape(M.FILES[item.kind])+'<small>'+escape(item.id)+'</small></td><td>'+differences(item)+'</td><td>'+escape(item.reason)+'</td><td><button data-remove="'+index+'">Remove from draft</button></td></tr>').join('')+'</tbody></table></div><label for="publishNote">Publication note</label><input id="publishNote" maxlength="500" value="Reviewed tracker record corrections"><label class="inline-check"><input type="checkbox" id="confirmPublish">I reviewed these changes for the Chrojoh beta repository.</label><div class="actions"><button class="primary" data-action="publish">Publish '+changes.length+' change(s) to beta</button><button data-action="download-draft">Download draft</button><button data-action="backup">Download current workbook backup</button><button data-action="discard">Discard draft</button></div><p class="hint">The save creates a normal GitHub commit. Earlier files remain in history. Phone apps will receive the files after the GitHub Pages deployment finishes.</p>';
 }
 function patchMarkup(){
  if(!patch.length)return '';
  return '<div class="table-scroll"><table><thead><tr><th>Include</th><th>Row</th><th>Change or issue</th></tr></thead><tbody>'+patch.map((item,index)=>'<tr><td><input type="checkbox" data-patch="'+index+'" aria-label="Include patch row '+item.row+'" '+(item.selected?'checked ':'')+(!item.valid||!item.change?'disabled':'')+'></td><td>'+item.row+'</td><td>'+escape(item.message)+(item.change?'<div>'+differences(item.change)+'</div>':'')+'</td></tr>').join('')+'</tbody></table></div><button class="primary" data-action="stage-patch">Add selected rows to review</button>';
 }
 function stage(item){
  if(!item){status('No values changed.');return;}
  const next=changes.filter(old=>entryKey(old)!==entryKey(item));next.push(item);
  M.validateBatch(datasets,next);changes=next;persist();editing=null;render();status('Change saved to review. GitHub files are unchanged.');
 }
 async function backup(){
  const files={};for(const key of ['dogs','results'])files[M.FILES[key]]=datasets[key].bytes;
  files['RESTORE.txt']='C-WAGS beta workbook backup\nRepository: '+G.REPOSITORY+'\nCommit: '+snapshot.head+'\n\nTo restore, upload both XLSX files together to the beta repository and wait for GitHub Pages to deploy. This archive contains no access token.\n';
  download(CwagsAdminZip(files),'CWag-Tracker-data-backup-'+new Date().toISOString().slice(0,10)+'.zip');
 }
 async function publish(){
  if(!$('confirmPublish').checked)throw Error('Confirm that you reviewed the beta changes.');
  const note=$('publishNote').value.trim();if(!note)throw Error('Enter a publication note.');
  M.validateBatch(datasets,changes);status('Checking source revisions and preparing the revised workbooks…');
  const updates={};for(const key of ['dogs','results'])if(changes.some(item=>item.kind===key)){
   await new Promise(resolve=>setTimeout(resolve,0));updates[M.FILES[key]]=M.write(datasets[key],changes,XLSX);
  }
  const result=await api.publish({expected:snapshot.files,updates,note,batchId});
  changes=[];batchId=crypto.randomUUID();persist();
  const commit=result.head;
  try{await load();}catch(e){error('GitHub saved commit '+commit.slice(0,8)+', but reloading the files failed. Do not republish. Reconnect and reload. '+e.message);return;}
  status('Saved beta commit '+commit.slice(0,8)+'. Wait for GitHub Pages deployment, then use Check for updates in the tracker.');
 }
 async function history(){
  status('Loading recent GitHub commits…');const commits=await api.history();
  $('historyList').innerHTML=commits.map(commit=>'<article class="history-item"><div class="toolbar"><a href="https://github.com/'+G.REPOSITORY+'/commit/'+escape(commit.sha)+'" target="_blank" rel="noopener">'+escape(commit.sha.slice(0,8))+'</a><button data-restore="'+escape(commit.sha)+'">Review these workbook versions</button></div><p>'+escape(commit.commit.message.split('\n')[0])+'</p><small>'+escape(commit.commit.author?.name||'GitHub user')+' · '+escape(commit.commit.author?.date||'')+'</small></article>').join('');status('Choose a historical snapshot to review; this does not alter branch history.');
 }
 async function reviewRestore(sha){
  if(changes.length)throw Error('Finish or discard the current draft before preparing a restore.');
  status('Reading the historical workbook snapshot…');const target=await api.snapshot(sha),counts={};
  for(const key of ['dogs','results']){
   const file=M.FILES[key];if(target.files[file]===snapshot.files[file])continue;
   const previous=M.open(key,await api.blob(target.files[file]),target.files[file],XLSX);
   const oldMap=previous.byId,currentMap=datasets[key].byId;
   let changed=0;for(const [id,record] of oldMap)if(currentMap.has(id)&&!M.equal(record.value,currentMap.get(id).value))changed++;
   counts[key]={previous:previous.records.length,current:datasets[key].records.length,changed};
  }
  if(!Object.keys(counts).length){$('restoreReview').innerHTML='';status('Those workbook versions are already current.');return;}
  restore={target,expected:{...snapshot.files},batchId:crypto.randomUUID(),counts};
  $('restoreReview').innerHTML='<section class="panel"><h3>Restore workbooks from '+escape(sha.slice(0,8))+'</h3><p>This replaces the affected beta workbook contents with the selected versions. Later corrections in those workbooks will be replaced. The master repository is not changed.</p>'+Object.entries(counts).map(([key,count])=>'<p>'+escape(M.FILES[key])+': '+count.current.toLocaleString()+' current records → '+count.previous.toLocaleString()+' records; '+count.changed.toLocaleString()+' matching row IDs have different values.</p>').join('')+'<label for="restoreNote">Reason for restoring</label><input id="restoreNote" value="Restore workbook snapshot '+escape(sha.slice(0,8))+'"><label class="inline-check"><input type="checkbox" id="confirmRestore">I reviewed this replacement of the beta workbooks.</label><div class="actions"><button class="danger" data-action="publish-restore">Restore reviewed workbook versions</button><button data-action="backup">Download current backup first</button></div></section>';
  status('Historical snapshot loaded for review. Nothing has been restored yet.');
 }
 async function publishRestore(){
  if(!restore||!$('confirmRestore').checked)throw Error('Review and confirm the workbook replacement first.');
  const updates={};for(const key of Object.keys(restore.counts)){const file=M.FILES[key];updates[file]=restore.target.files[file];}
  const result=await api.publish({expected:restore.expected,updates,note:$('restoreNote').value,batchId:restore.batchId});
  restore=null;await load();view='history';render();status('Restored workbooks in new beta commit '+result.head.slice(0,8)+'. Existing branch history was preserved.');
 }
 $('connect').addEventListener('click',()=>run(async()=>{
  const token=$('githubToken').value.trim();$('githubToken').value='';
  if(!/^github_pat_[A-Za-z0-9_]{20,}$/.test(token))throw Error('Use a fine-grained GitHub token beginning github_pat_. Do not enter your GitHub password.');
  const connection=G.client(token);
  try{status('Checking GitHub account and beta repository permissions…');const identity=await connection.connect();api=connection;account=identity.login;await load();$('signin').hidden=true;$('workspace').hidden=false;$('signOut').hidden=false;}
  catch(e){connection.disconnect();api=null;throw e;}
 }));
 $('signOut').addEventListener('click',()=>{api?.disconnect();api=null;datasets={};snapshot=null;changes=[];editing=null;patch=[];restore=null;$('content').replaceChildren();$('signin').hidden=false;$('workspace').hidden=true;$('signOut').hidden=true;status('Signed out. The token has been cleared from this tab. Saved drafts contain no token.');error('');});
 $('reload').addEventListener('click',()=>run(async()=>{if(changes.length)throw Error('Download or discard the current draft before reloading.');await load();}));
 document.querySelector('nav').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(!button||busy)return;view=button.dataset.view;if(view==='dogs'||view==='results')kind=view;page=0;query='';editing=null;restore=null;error('');render();});
 $('content').addEventListener('input',event=>{
  if(event.target.id==='recordSearch'){
   const position=event.target.selectionStart;query=event.target.value;page=0;render();const input=$('recordSearch');input.focus();input.setSelectionRange(position,position);
  }
 });
 $('content').addEventListener('change',event=>{
  if(event.target.id==='patchKind'){kind=event.target.value;patch=[];render();}
  if(event.target.dataset.patch!==undefined)patch[Number(event.target.dataset.patch)].selected=event.target.checked;
  if(event.target.id==='patchFile')run(async()=>{
   const file=event.target.files[0];if(!file)return;
   if(!/\.xlsx$/i.test(file.name)||file.size>25*1024*1024)throw Error('Choose an .xlsx patch smaller than 25 MB.');
   patch=M.parsePatch(datasets[kind],new Uint8Array(await file.arrayBuffer()),XLSX);render();status('Patch checked. Conflicts and invalid rows cannot be selected. Removals require explicit selection.');
  });
 });
 $('content').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.dataset.edit){editing={id:button.dataset.edit,action:'update'};renderEditor();return;}
  if(button.dataset.remove!==undefined){changes.splice(Number(button.dataset.remove),1);persist();render();return;}
  if(button.dataset.restore){run(()=>reviewRestore(button.dataset.restore));return;}
  const action=button.dataset.action;
  run(async()=>{
   if(action==='add'){editing={id:'',action:'add'};renderEditor();}
   if(action==='cancel-edit'){editing=null;$('editor').innerHTML='';}
   if(action==='save-edit'||action==='delete-record'){
    const values=new FormData($('editForm')),after={};for(const key of M.FIELDS[kind])after[key]=values.get(key);
    const item=M.change(datasets[kind],{id:editing.id,action:action==='delete-record'?'delete':editing.action,after,reason:values.get('reason'),allowDuplicate:Boolean($('allowDuplicate')?.checked)});stage(item);
   }
   if(action==='previous'){page=Math.max(0,page-1);render();}
   if(action==='next'){page++;render();}
   if(action==='template'||action==='export-visible'){
    const entries=action==='template'?[]:filtered().slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
    download(M.template(datasets[kind],entries,XLSX),(kind==='dogs'?'DogInfo':'Trial-results')+'-patch.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
   }
   if(action==='stage-patch'){
    const next=[...changes];for(const item of patch.filter(row=>row.selected&&row.valid&&row.change).map(row=>row.change)){
     const existing=next.find(old=>entryKey(old)===entryKey(item));
     if(existing){if(existing.action===item.action&&M.equal(existing.after,item.after))continue;throw Error('A selected record already has a different draft correction. Review that draft first.');}
     next.push(item);
    }
    M.validateBatch(datasets,next);changes=next;persist();view='review';render();status('Selected patch rows saved to review. No GitHub files changed.');
   }
   if(action==='publish')await publish();
   if(action==='backup')await backup();
   if(action==='discard'){changes=[];batchId=crypto.randomUUID();persist();render();status('Draft discarded. Published files are unchanged.');}
   if(action==='download-draft')download(JSON.stringify({repository:G.REPOSITORY,changes,batchId},null,2),'CWag-Tracker-admin-draft.json','application/json');
   if(action==='restore-draft'){const saved=savedDraft();M.validateBatch(datasets,saved.changes);changes=saved.changes;batchId=saved.batchId;view='review';render();status('Saved draft restored for review.');}
   if(action==='download-saved-draft')download(JSON.stringify(savedDraft(),null,2),'CWag-Tracker-saved-draft.json','application/json');
   if(action==='discard-saved-draft'){localStorage.removeItem(draftKey);render();}
   if(action==='load-history')await history();
   if(action==='publish-restore')await publishRestore();
  });
 });
 document.addEventListener('submit',event=>event.preventDefault());
 window.addEventListener('pagehide',()=>{api?.disconnect();api=null;});
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 $('startup').textContent='';$('connect').disabled=false;
})();
