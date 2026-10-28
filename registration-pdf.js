/* Physical PDF pages, independent of a phone's webpage print orientation. */
async function buildRegistrationPdf(dogs) {
    const {PDFDocument, StandardFonts, rgb} = PDFLib;
    const pdf = await PDFDocument.create();
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    let names = regular;
    if (typeof fontkit !== 'undefined') {
        pdf.registerFontkit(fontkit);
        const response = await fetch(new URL('./fonts/Maiandra%20GD.TTF', document.baseURI));
        if (!response.ok) throw new Error('The saved certificate font is unavailable. Connect and check for updates.');
        names = await pdf.embedFont(await response.arrayBuffer(), {subset:true});
    }
    const logoResponse = await fetch(new URL('./cwags-logo.png', document.baseURI));
    if (!logoResponse.ok) throw new Error('The saved tracker logo is unavailable. Connect and check for updates.');
    const logo = await pdf.embedPng(await logoResponse.arrayBuffer());
    const ordered = [...dogs].sort((a,b)=>a.regNumber.localeCompare(b.regNumber,undefined,{numeric:true}));
    const groups = new Map();
    ordered.forEach(dog=>{
        const handler=dog.handlerName || 'Handler not recorded';
        if(!groups.has(handler))groups.set(handler,[]);
        groups.get(handler).push(dog);
    });
    const title='C-WAGS Registration Card - '+Array.from(groups.keys()).join(' & ');
    pdf.setTitle(title);pdf.setAuthor('C-WAGS Tracker');
    const page=pdf.addPage([792,612]); // Letter, 11 x 8.5 inches, landscape.
    const ink=rgb(.14,.22,.29),muted=rgb(.32,.40,.48),purple=rgb(.46,.38,.68);
    function wrap(text,font,size,width) {
        const lines=[];let line='';
        for(const word of String(text).split(/\s+/)) {
            const candidate=line?line+' '+word:word;
            if(line && font.widthOfTextAtSize(candidate,size)>width){lines.push(line);line=word;}
            else line=candidate;
        }
        if(line)lines.push(line);
        return lines;
    }
    const footerText='For consistency and accuracy, please enter your dog in trials using the name shown on this registration card.';
    page.drawText('Cut on the outside dashed lines. Landscape Letter: 11 x 8.5 inches.',{x:24,y:593,size:9,font:regular,color:muted});
    for(const x of [24,405]) {
        const width=363, bottom=24, top=578, padding=16;
        page.drawRectangle({x,y:bottom,width,height:top-bottom,borderColor:rgb(.55,.55,.55),borderWidth:.6,borderDashArray:[3,3]});
        const logoSize=58, logoScale=Math.min(logoSize/logo.width,logoSize/logo.height);
        page.drawImage(logo,{x:x+padding,y:top-72,width:logo.width*logoScale,height:logo.height*logoScale});
        page.drawText('Registration Card',{x:x+87,y:top-37,font:bold,size:22,color:ink});
        page.drawText('C-WAGS | Trial entry reference',{x:x+87,y:top-56,font:regular,size:10,color:muted});
        page.drawLine({start:{x,y:top-84},end:{x:x+width,y:top-84},thickness:3,color:purple});
        const footerWidth=width-padding*2;
        const footerLines=wrap(footerText,regular,11,footerWidth);
        const reminderLines=wrap('Create a new card after registration details change.',regular,11,footerWidth);
        let footerY=bottom+24+(footerLines.length+reminderLines.length)*15+13;
        const footerTop=footerY+18;
        page.drawLine({start:{x:x+padding,y:footerTop},end:{x:x+width-padding,y:footerTop},thickness:.5,color:rgb(.83,.86,.89)});
        for(const lines of [footerLines,reminderLines]) {
            for(const line of lines){page.drawText(line,{x:x+(width-regular.widthOfTextAtSize(line,11))/2,y:footerY,font:regular,size:11,color:muted});footerY-=15;}
            footerY-=8;
        }
        const created='Created '+new Date().toLocaleDateString();
        page.drawText(created,{x:x+(width-regular.widthOfTextAtSize(created,9))/2,y:bottom+12,font:regular,size:9,color:muted});
        const available=top-98-footerTop-8;
        // Fit the whole selected list on each copy, increasing row spacing for short lists.
        let fontSize=17,layout;
        for(;fontSize>=7;fontSize-=.5) {
            layout=Array.from(groups,([handler,entries])=>({
                heading:wrap(handler,names,fontSize+1,footerWidth),
                entries:entries.map(dog=>({dog,lines:wrap(dog.callName||'Call name not recorded',names,fontSize,footerWidth*.48)}))
            }));
            const needed=layout.reduce((sum,group)=>sum+14+group.heading.length*(fontSize+4)+26+group.entries.reduce((n,row)=>n+row.lines.length*(fontSize+3)+8,0),0);
            if(needed<=available)break;
        }
        if(fontSize<7)throw new Error('Too many dogs for a readable single-sheet card. Select fewer dogs for this PDF.');
        const needed=layout.reduce((sum,group)=>sum+14+group.heading.length*(fontSize+4)+26+group.entries.reduce((n,row)=>n+row.lines.length*(fontSize+3)+8,0),0);
        const extra=Math.min(10,(available-needed)/Math.max(1,dogs.length));
        let y=top-102;
        for(const group of layout) {
            page.drawText('HANDLER',{x:x+padding,y,size:8,font:regular,color:muted});y-=fontSize+4;
            for(const line of group.heading){page.drawText(line,{x:x+padding,y,font:names,size:fontSize+1,color:ink});y-=fontSize+4;}
            y-=3;
            page.drawText('Dog call name',{x:x+padding,y,font:regular,size:9,color:muted});
            const label='Registration number';page.drawText(label,{x:x+width-padding-regular.widthOfTextAtSize(label,9),y,font:regular,size:9,color:muted});y-=14;
            for(const row of group.entries) {
                page.drawLine({start:{x:x+padding,y:y+4},end:{x:x+width-padding,y:y+4},thickness:.4,color:rgb(.87,.9,.92)});
                y-=fontSize;
                const regSize=Math.min(fontSize, (footerWidth*.48)/bold.widthOfTextAtSize(row.dog.regNumber,1));
                page.drawText(row.dog.regNumber,{x:x+width-padding-bold.widthOfTextAtSize(row.dog.regNumber,regSize),y,font:bold,size:regSize,color:ink});
                row.lines.forEach((line,index)=>page.drawText(line,{x:x+padding,y:y-index*(fontSize+3),font:names,size:fontSize,color:ink}));
                y-=row.lines.length*(fontSize+3)-fontSize+8+extra;
            }
            y-=8;
        }
    }
    return {bytes:await pdf.save(),title};
}
async function saveRegistrationPdf(dogs, cardWindow) {
    const doc=cardWindow.document,button=doc.getElementById('printCardButton'),status=doc.getElementById('status');
    button.disabled=true;status.textContent='Preparing your landscape PDF…';
    try {
        const {bytes,title}=await buildRegistrationPdf(dogs);
        const objectUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
        const link=doc.createElement('a');link.href=objectUrl;
        link.download=title.replace(/[\\/:*?"<>|]/g,'-')+'.pdf';link.textContent='Open landscape PDF';link.target='_blank';
        status.replaceChildren(doc.createTextNode('Your 11 × 8½-inch landscape PDF is ready. '),link);
        link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),3600000);
    } catch(error) {status.textContent='Could not create the PDF: '+error.message;}
    finally {button.disabled=false;}
}
