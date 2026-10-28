(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CwagsAdminGitHub=api;})(globalThis,()=>{
 'use strict';
 const REPOSITORY='Chrojoh/CWag-Tracker',BRANCH='main';
 const FILES=['DogInfo.xlsx','Data for Tracker web.xlsx'];
 const SHA=/^[0-9a-f]{40}$/;
 class Conflict extends Error{}
 function fromBase64(value){const binary=atob(value.replace(/\s/g,'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
 function toBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
 function client(accessToken,fetcher=globalThis.fetch){
  let token=accessToken;
  async function request(path,method='GET',body){
   if(!token)throw Error('Sign in again to continue.');
   if(!/^\/(?:user$|repos\/Chrojoh\/CWag-Tracker(?:\/|$))/.test(path))throw Error('This beta administrator can access only Chrojoh/CWag-Tracker.');
   let response;
   try {response=await fetcher('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});}
   catch(_){throw Error('GitHub could not be reached. Your draft is kept. No publication is assumed successful.');}
   if(!response.ok){
    if(response.status===401)throw Error('GitHub sign-in expired or the token is invalid.');
    if(response.status===403)throw Error('GitHub denied access. Use a fine-grained token for Chrojoh/CWag-Tracker with Contents: Read and write, and check its expiry or request limit.');
    if(response.status===409||response.status===422)throw new Conflict('GitHub rejected this update, possibly because someone else published first. Reload and review before trying again.');
    throw Error('GitHub request failed (HTTP '+response.status+').');
   }
   return response.status===204?null:response.json();
  }
  const base='/repos/'+REPOSITORY;
  async function head(){const ref=await request(base+'/git/ref/heads/'+BRANCH);if(!SHA.test(ref.object.sha))throw Error('Invalid GitHub revision.');return ref.object.sha;}
  async function snapshot(commitSha){
   const commit=await request(base+'/git/commits/'+commitSha);
   const tree=await request(base+'/git/trees/'+commit.tree.sha);
   if(tree.truncated)throw Error('The repository tree is incomplete.');
   const files={};for(const filename of FILES){const entry=tree.tree.find(e=>e.path===filename&&e.type==='blob');if(!entry||!SHA.test(entry.sha))throw Error('Missing workbook: '+filename);files[filename]=entry.sha;}
   return {head:commitSha,tree:commit.tree.sha,files,commit};
  }
  async function connect(){
   const user=await request('/user'),repo=await request(base);
   if(repo.full_name.toLowerCase()!==REPOSITORY.toLowerCase()||repo.default_branch!==BRANCH)throw Error('Repository or branch does not match this beta configuration.');
   if(!repo.permissions?.push)throw Error('This GitHub account does not have permission to update the beta repository.');
   return {login:user.login,snapshot:await snapshot(await head())};
  }
  async function blob(sha){if(!SHA.test(sha))throw Error('Invalid file revision.');const value=await request(base+'/git/blobs/'+sha);if(value.encoding!=='base64'||value.size>25*1024*1024)throw Error('Unsupported or oversized workbook.');return fromBase64(value.content);}
  async function publish({expected,updates,note,batchId}){
   if(!/^[a-z0-9-]{10,80}$/i.test(batchId))throw Error('Invalid publication identifier.');
   if(!note.trim()||note.length>500)throw Error('Enter a publication note (1–500 characters).');
   const names=Object.keys(updates);if(!names.length||names.some(name=>!FILES.includes(name)))throw Error('Only the two tracker workbooks can be published here.');
   const current=await snapshot(await head());
   if(current.commit.message?.includes('CWAGS-Admin-Batch: '+batchId))return {head:current.head,files:current.files,alreadyPublished:true};
   // Check both files, including the one not being edited, against the reviewed baseline.
   for(const name of FILES)if(current.files[name]!==expected[name])throw new Conflict('The workbooks changed after this draft was prepared. Reload both files and review again.');
   const entries=[];
   for(const name of names){
    const value=updates[name];let sha;
    if(typeof value==='string'){if(!SHA.test(value))throw Error('Invalid rollback revision.');sha=value;}
    else {const created=await request(base+'/git/blobs','POST',{content:toBase64(value),encoding:'base64'});sha=created.sha;}
    entries.push({path:name,mode:'100644',type:'blob',sha});
   }
   const tree=await request(base+'/git/trees','POST',{base_tree:current.tree,tree:entries});
   const commit=await request(base+'/git/commits','POST',{message:'Tracker admin: '+note.trim()+'\n\nCWAGS-Admin-Batch: '+batchId,tree:tree.sha,parents:[current.head]});
   // Never force-push. A concurrent writer makes this commit non-fast-forward and GitHub rejects it.
   try {await request(base+'/git/refs/heads/'+BRANCH,'PATCH',{sha:commit.sha,force:false});}
   catch(error){
    // A connection can drop after GitHub accepted the ref update. Verify before allowing a retry.
    try{const observed=await head();if(observed===commit.sha)return {head:observed,previous:current.head,files:{...current.files,...Object.fromEntries(entries.map(e=>[e.path,e.sha]))},recovered:true};}catch(_){}
    throw error;
   }
   return {head:commit.sha,previous:current.head,files:{...current.files,...Object.fromEntries(entries.map(e=>[e.path,e.sha]))}};
  }
  async function history(){return request(base+'/commits?per_page=20');}
  return {connect,head,snapshot,blob,publish,history,disconnect(){token='';}};
 }
 return {REPOSITORY,BRANCH,FILES,client,Conflict};
});
