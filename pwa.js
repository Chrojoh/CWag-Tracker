/* Installation/offline controls; record calculations remain in index.html. */
(() => {
  let registration, installPrompt, busy=false;
  let lastState;
  const $ = id => document.getElementById(id);
  const say = message => { if ($('offlineStatus')) $('offlineStatus').textContent=message; };
  function describe(state) {
    lastState=state;
    if (!state?.ready) { say('Offline preparation is incomplete. Stay connected and choose Check for updates.'); return; }
    const when = new Date(state.savedAt).toLocaleString();
    say((navigator.onLine ? 'Ready for offline use. ' : 'Offline — using saved records. ') + 'Files saved: '+when+'.');
    $('offlineDetails').textContent='Saved data: '+(Object.values(state.files).reduce((sum,file)=>sum+file.bytes,0)/1e6).toFixed(1)+' MB. Your existing records remain available if an update fails. Saved files may be removed if browser storage is cleared.';
  }
  function message(type) {
    return new Promise((resolve,reject)=>{
      const worker=navigator.serviceWorker.controller || registration?.active;
      if (!worker) { reject(new Error('The offline app is not ready yet')); return; }
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();reject(new Error('Update took too long. Try again on a reliable connection.'));},300000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      worker.postMessage({type},[channel.port2]);
    });
  }
  async function synchronize(manual=false) {
    if(busy)return;
    busy=true;$('checkUpdates').disabled=true;
    try {
      if (!navigator.onLine) { const result=await message('STATUS');describe(result.state);return; }
      say('Checking and saving tracker files. Keep this page open until it says ready for offline use…');
      const result=await message('SYNC');
      describe(result.state);
      if(!result.ok) say((result.state?.ready?'Using your previously saved records. ':'Offline preparation is incomplete. ')+ 'Update failed: '+result.error);
      else if(manual && result.state.changed) {
        say('Updated records are saved. Choose Load updated records to use them.');
        $('reloadTracker').hidden=false;
      } else if(manual) say('Your saved records are up to date. Ready for offline use.');
    } catch(error) { say('Could not check for updates. '+error.message); }
    finally {busy=false;$('checkUpdates').disabled=false;}
  }
  function offerUpdate() {
    if(registration.waiting) {
      $('updateApp').hidden=false;
      $('updateApp').onclick=()=>{
        navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
        registration.waiting.postMessage({type:'SKIP_WAITING'});
      };
    }
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();installPrompt=event;
    if($('installTracker'))$('installTracker').hidden=false;
  });
  window.addEventListener('appinstalled',()=>{installPrompt=null;if($('installTracker'))$('installTracker').hidden=true;});
  window.addEventListener('offline',()=>{if(lastState)describe(lastState);});
  window.addEventListener('online',()=>{if(lastState)describe(lastState);});
  window.trackerOfflineReady=new Promise(resolve=>document.addEventListener('DOMContentLoaded',async()=>{
    $('installTracker').hidden=!installPrompt;
    $('installTracker').onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installTracker').hidden=true;}};
    $('reloadTracker').onclick=()=>location.reload();
    $('checkUpdates').onclick=async()=>{
      await synchronize(true);
      if(registration){await registration.update().catch(()=>{});offerUpdate();}
    };
    if(!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol==='file:') {
      say('Install and offline features are available from the HTTPS beta website. This local file still runs as the regular tracker.');
      $('checkUpdates').disabled=true;resolve();return;
    }
    try {
      registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      say('Preparing the offline app and certificate files. Please keep this page open…');
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offline setup has not finished. Reopen the page when connected to try again.')),90000))
      ]);
      if(!navigator.serviceWorker.controller) await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Reload this page to finish offline setup.')),10000);
        navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
        if(navigator.serviceWorker.controller){clearTimeout(timer);resolve();}
      });
      offerUpdate();
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();});
      });
      await synchronize();
      // Storage persistence is best effort; availability depends on browser policy.
      navigator.storage?.persist?.().catch(()=>{});
    } catch(error) {say('Offline setup could not finish: '+error.message);}
    finally {resolve();}
  },{once:true}));
})();
