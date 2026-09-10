// Robust screenshot detector for Logic Riddle.
// Detects the actual colored cell rectangles first, then derives N x N from them.
(function(){
  const hexRgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const rgbDist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

  function detect(){
    const src=$('previewCanvas');
    if(!src||!src.width)return;

    // Work on a smaller copy so large phone screenshots stay fast on mobile.
    const maxW=700, scale=Math.min(1,maxW/src.width);
    const w=Math.max(1,Math.round(src.width*scale));
    const h=Math.max(1,Math.round(src.height*scale));
    const work=document.createElement('canvas');
    work.width=w; work.height=h;
    const wctx=work.getContext('2d',{willReadFrequently:true});
    wctx.drawImage(src,0,0,w,h);
    const data=wctx.getImageData(0,0,w,h).data;

    // Colored cells are more saturated and farther from the screenshot background.
    const bg=[data[0],data[1],data[2]],mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      const sat=(mx-mn)/Math.max(mx,1);
      mask[y*w+x]=(sat>.10&&rgbDist([r,g,b],bg)>24)?1:0;
    }

    // Connected components correspond to individual colored cells.
    const seen=new Uint8Array(w*h),stack=new Int32Array(w*h),comps=[];
    for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++){
      const start=sy*w+sx;
      if(!mask[start]||seen[start])continue;
      let sp=0;stack[sp++]=start;seen[start]=1;
      let area=0,minX=sx,maxX=sx,minY=sy,maxY=sy,sumX=0,sumY=0;
      while(sp){
        const p=stack[--sp],y=Math.floor(p/w),x=p-y*w;
        area++;sumX+=x;sumY+=y;
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
        if(x>0){const q=p-1;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
        if(x+1<w){const q=p+1;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
        if(y>0){const q=p-w;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
        if(y+1<h){const q=p+w;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}
      }
      const cw=maxX-minX+1,ch=maxY-minY+1,fill=area/(cw*ch),aspect=cw/ch;
      if(area>=180&&cw>=12&&ch>=12&&cw<=110&&ch<=110&&aspect>.72&&aspect<1.35&&fill>.45){
        comps.push({area,x:minX,y:minY,w:cw,h:ch,cx:sumX/area,cy:sumY/area});
      }
    }

    if(comps.length<16){
      $('status').textContent='⚠️ Could not find enough colored cells. Upload the full Logic Riddle board screenshot.';
      return;
    }

    // Board cells form one dense component cluster; UI icons are isolated.
    const dims=comps.map(c=>(c.w+c.h)/2).sort((a,b)=>a-b);
    const typical=dims[Math.floor(dims.length/2)],link=typical*2.05;
    const adj=Array.from({length:comps.length},()=>[]);
    for(let i=0;i<comps.length;i++)for(let j=i+1;j<comps.length;j++){
      if(Math.abs(comps[i].cx-comps[j].cx)<link&&Math.abs(comps[i].cy-comps[j].cy)<link){
        adj[i].push(j);adj[j].push(i);
      }
    }
    const used=new Uint8Array(comps.length),clusters=[];
    for(let i=0;i<comps.length;i++){
      if(used[i])continue;
      const q=[i],cl=[];used[i]=1;
      while(q.length){const v=q.pop();cl.push(v);for(const j of adj[v])if(!used[j]){used[j]=1;q.push(j)}}
      clusters.push(cl);
    }
    clusters.sort((a,b)=>b.length-a.length);
    const boardCluster=clusters.find(cl=>{
      const n=Math.round(Math.sqrt(cl.length));
      return n>=4&&n<=15&&n*n===cl.length;
    })||clusters[0];

    const cells=boardCluster.map(i=>comps[i]);
    cells.sort((a,b)=>a.cy-b.cy||a.cx-b.cx);
    const rowGap=typical*.55,rows=[];
    for(const cell of cells){
      let row=rows[rows.length-1];
      if(!row||Math.abs(cell.cy-row.cy)>rowGap){row={cy:cell.cy,cells:[]};rows.push(row)}
      row.cells.push(cell);
      row.cy=row.cells.reduce((s,c)=>s+c.cy,0)/row.cells.length;
    }
    rows.forEach(r=>r.cells.sort((a,b)=>a.cx-b.cx));

    const n=rows.length,counts=rows.map(r=>r.cells.length);
    if(n<4||n>15||counts.some(v=>v!==n)){
      $('status').textContent=`⚠️ Grid detected, but rows are inconsistent (${n} rows: ${counts.join(', ')}). Upload the complete board screenshot.`;
      return;
    }

    // Sample each cell center and map it to the game's first N palette colors.
    // The geometry determines N, so 8x8, 9x9 ... 15x15 cannot collapse to 4x4.
    const palette=baseColors.slice(0,n);
    const detected=rows.map(row=>row.cells.map(cell=>{
      const x=Math.max(0,Math.min(w-1,Math.round(cell.cx)));
      const y=Math.max(0,Math.min(h-1,Math.round(cell.cy)));
      const i=(y*w+x)*4,rgb=[data[i],data[i+1],data[i+2]];
      let best=0,bd=Infinity;
      palette.forEach((p,k)=>{const d=rgbDist(rgb,hexRgb(p[1]));if(d<bd){bd=d;best=k}});
      return best;
    }));

    size=n;
    $('size').value=String(n);
    board=detected;
    dogs=Array(n).fill(-1);
    selected=0;
    $('scanPreview').hidden=true;
    $('status').textContent=`📷 Screenshot scanned successfully. Detected ${n}×${n}. Check the colors, then press Solve.`;
    legend();
    render();
  }

  window.detectBoard=detect;
  $('detectButton').onclick=detect;
})();
