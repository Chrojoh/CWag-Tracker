(function(root,factory){const zip=factory();if(typeof module==='object'&&module.exports)module.exports=zip;else root.CwagsAdminZip=zip;})(globalThis,()=>{
 const encoder=new TextEncoder();
 const table=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 function crc(bytes){let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 function header(length,values){const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);for(const [offset,size,value] of values)size===2?view.setUint16(offset,value,true):view.setUint32(offset,value,true);return bytes;}
 return function(files){
  const local=[],central=[];let offset=0,centralSize=0;
  for(const [name,value] of Object.entries(files)){
   const filename=encoder.encode(name),bytes=typeof value==='string'?encoder.encode(value):value,checksum=crc(bytes);
   const a=header(30,[[0,4,0x04034b50],[4,2,20],[6,2,0x800],[14,4,checksum],[18,4,bytes.length],[22,4,bytes.length],[26,2,filename.length]]);
   const b=header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[16,4,checksum],[20,4,bytes.length],[24,4,bytes.length],[28,2,filename.length],[42,4,offset]]);
   local.push(a,filename,bytes);central.push(b,filename);offset+=a.length+filename.length+bytes.length;centralSize+=b.length+filename.length;
  }
  const count=Object.keys(files).length,end=header(22,[[0,4,0x06054b50],[8,2,count],[10,2,count],[12,4,centralSize],[16,4,offset]]);
  return new Blob([...local,...central,end],{type:'application/zip'});
 };
});
