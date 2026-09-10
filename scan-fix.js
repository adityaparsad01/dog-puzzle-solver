// Improved screenshot detector. It chooses the grid size by measuring
// how uniform each candidate cell is, rather than favoring fewer clusters.
(function(){
  function rgbDist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}
  function patch(data,w,h,cx,cy,rad){
    const vals=[];
    for(let y=Math.max(0,Math.floor(cy-rad));y<=Math.min(h-1,Math.ceil(cy+rad));y++)
      for(let x=Math.max(0,Math.floor(cx-rad));x<=Math.min(w-1,Math.ceil(cx+rad));x++){
        const i=(y*w+x)*4; vals.push([data[i],data[i+1],data[i+2]]);
      }
    const mean=[0,1,2].map(k=>vals.reduce((s,v)=>s+v[k],0)/vals.length);
    const variance=vals.reduce((s,v)=>s+(v[0]-mean[0])**2+(v[1]-mean[1])**2+(v[2]-mean[2])**2,0)/vals.length;
    const color=[0,1,2].map(k=>{const a=vals.map(v=>v[k]).sort((x,y)=>x-y);return a[Math.floor(a.length/2)]});
    return {color,variance};
  }
  function nearestLabels(samples,centers){return samples.map(s=>{let bi=0,bd=Infinity;centers.forEach((c,i)=>{const d=rgbDist(s,c);if(d<bd){bd=d;bi=i}});return bi})}
  function cluster(samples,k){
    const centers=[];
    for(let i=0;i<k;i++) centers.push(samples[Math.floor((i+.5)*samples.length/k)].slice());
    for(let pass=0;pass<15;pass++){
      const groups=Array.from({length:k},()=>[]);
      samples.forEach(s=>{let bi=0,bd=Infinity;centers.forEach((c,i)=>{const d=rgbDist(s,c);if(d<bd){bd=d;bi=i}});groups[bi].push(s)});
      groups.forEach((g,i)=>{if(g.length) centers[i]=[0,1,2].map(q=>Math.round(g.reduce((s,v)=>s+v[q],0)/g.length))});
    }
    const labels=nearestLabels(samples,centers);
    let sse=0; samples.forEach((s,i)=>sse+=rgbDist(s,centers[labels[i]])**2);
    return {centers,labels,sse};
  }
  function detect(){
    const canvas=$('previewCanvas'); if(!canvas||!canvas.width)return;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height,data=ctx.getImageData(0,0,w,h).data;
    // Find the largest roughly square region containing saturated puzzle colors.
    const scale=Math.max(1,Math.floor(Math.min(w,h)/220)),W=Math.ceil(w/scale),H=Math.ceil(h/scale),mask=new Uint8Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const i=(Math.min(h-1,y*scale)*w+Math.min(w-1,x*scale))*4,r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx?(mx-mn)/mx:0;
      mask[y*W+x]=(sat>.08&&mx>.25)?1:0;
    }
    let region=null;
    for(let s=Math.floor(Math.min(W,H)*.18);s<=Math.floor(Math.min(W,H)*.96);s+=2){
      for(let y=0;y+s<=H;y+=2)for(let x=0;x+s<=W;x+=2){
        let hit=0,total=0;
        for(let yy=y;yy<y+s;yy+=3)for(let xx=x;xx<x+s;xx+=3){hit+=mask[yy*W+xx];total++}
        const density=hit/total,score=density*s*s;
        if(!region||score>region.score)region={x,y,s,score,density};
      }
    }
    if(!region||region.density<.06){$('status').textContent='⚠️ Could not find the puzzle board. Upload a screenshot containing the full colored grid.';return}
    const bx=region.x*scale,by=region.y*scale,bw=region.s*scale;
    let winner=null;
    for(let n=4;n<=15;n++){
      const samples=[],vars=[],cell=bw/n,rad=Math.max(1,cell*.10);
      for(let r=0;r<n;r++)for(let c=0;c<n;c++){const p=patch(data,w,h,bx+(c+.5)*cell,by+(r+.5)*cell,rad);samples.push(p.color);vars.push(p.variance)}
      const km=cluster(samples,n),avgVar=vars.reduce((a,b)=>a+b,0)/vars.length,avgSse=km.sse/samples.length;
      let sep=255;for(let i=0;i<km.centers.length;i++)for(let j=i+1;j<km.centers.length;j++)sep=Math.min(sep,rgbDist(km.centers[i],km.centers[j]));
      // Correct n has uniform cell centers, exactly n color groups, and distinct colors.
      const score=avgVar + avgSse*0.8 - Math.min(sep,140)*0.25;
      if(!winner||score<winner.score)winner={n,score,samples,km};
    }
    size=winner.n;
    $('size').value=String(size);
    board=Array.from({length:size},(_,r)=>winner.km.labels.slice(r*size,(r+1)*size));
    // Keep the actual screenshot colors instead of mapping them to a fixed palette.
    window.detectedPalette=winner.km.centers.map((rgb,i)=>[`Color ${i+1}`,`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`]);
    const oldColors=window.colors;
    window.colors=function(){return window.detectedPalette||oldColors()};
    dogs=Array(size).fill(-1);selected=0;
    $('scanPreview').hidden=true;
    $('status').textContent=`📷 Screenshot scanned. Detected ${size}×${size}. Check the colors, then press Solve.`;
    legend();render();
  }
  window.detectBoard=detect;
  $('detectButton').onclick=detect;
})();
