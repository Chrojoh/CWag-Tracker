(()=>{
 const note=document.getElementById('startup');
 window.addEventListener('error',event=>{
  if(event.target?.tagName==='SCRIPT')note.textContent='An administrator script could not load. Upload the entire admin folder, wait for GitHub Pages to deploy, then reload this page.';
  else if(event.message)note.textContent='The administrator controls could not start. Reload this page after confirming that all admin files were uploaded.';
 },true);
})();
