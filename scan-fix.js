// Robust screenshot detector for Logic Riddle.
// Detects every colored cell, including the pale-green region, then derives N x N.
(function(){
  let detectedPalette=null;
  window.colors=()=>detectedPalette||paletteFor(size);
  const originalSetSize=setSize;
  setSize=function(n,loadBlank=true){detectedPalette=null;return originalSetSize(n,loadBlank)};
  const hexRgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const rgbDist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  function borderBackground(data,w,h){
    const vals=[];const step=Math.max(1,Math.floor(Math.min(w,h)/80));
    for(let x=0;x<w;x+=step){vals.push([data[x*4],data[x*4+1],data[x*4+2]]);const i=((h-1)*w+x)*4;vals.push([data[i],data[i+1],data[i+2]])}
    for(let y=0;y<h;y+=step){let i=(y*w)*4;vals.push([data[i],data[i+1],data[i+2]]);i=(y*w+w-1)*4;vals.push([data[i],data[i+1],data[i+2]])}
    return vals.reduce((best,v)=>v[0]+v[1]+v[2]>best[0]+best[1]+best[2]?v:best,vals[0]);
  }
  function detect(){
    const src=$('previewCanvas');if(!src||!src.width)return;
    const maxW=900,scale=Math.min(1,maxW/src.width),w=Math.max(1,Math.round(src.width*scale)),h=Math.max(1,Math.round(src.height*scale));
    const work=document.createElement('canvas');work.width=w;work.height=h;const ctx=work.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h).data,bg=borderBackground(data,w,h),mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=(mx-mn)/Math.max(mx,1);mask[y*w+x]=(sat>.025&&rgbDist([r,g,b],bg)>18)?1:0}
    const seen=new Uint8Array(w*h),stack=new Int32Array(w*h),comps=[];
    for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++){const start=sy*w+sx;if(!mask[start]||seen[start])continue;let sp=0;stack[sp++]=start;seen[start]=1;let area=0,minX=sx,maxX=sx,minY=sy,maxY=sy,sumX=0,sumY=0;
      while(sp){const p=stack[--sp],y=Math.floor(p/w),x=p-y*w;area++;sumX+=x;sumY+=y;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(x>0){const q=p-1;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}if(x+1<w){const q=p+1;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}if(y>0){const q=p-w;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}if(y+1<h){const q=p+w;if(mask[q]&&!seen[q]){seen[q]=1;stack[sp++]=q}}}
      const cw=maxX-minX+1,ch=maxY-minY+1,fill=area/(cw*ch),aspect=cw/ch;if(area>=180&&cw>=12&&ch>=12&&cw<=120&&ch<=120&&aspect>.72&&aspect<1.35&&fill>.45)comps.push({area,x:minX,y:minY,w:cw,h:ch,cx:sumX/area,cy:sumY/area});}
    if(comps.length<16){$('status').textContent='⚠️ Could not find enough board cells. Upload the full Logic Riddle board screenshot.';return}
    const dims=comps.map(c=>(c.w+c.h)/2).sort((a,b)=>a-b),typical=dims[Math.floor(dims.length/2)],link=typical*2.05,adj=Array.from({length:comps.length},()=>[]);
    for(let i=0;i<comps.length;i++)for(let j=i+1;j<comps.length;j++)if(Math.abs(comps[i].cx-comps[j].cx)<link&&Math.abs(comps[i].cy-comps[j].cy)<link){adj[i].push(j);adj[j].push(i)}
    const used=new Uint8Array(comps.length),clusters=[];for(let i=0;i<comps.length;i++){if(used[i])continue;const q=[i],cl=[];used[i]=1;while(q.length){const v=q.pop();cl.push(v);for(const j of adj[v])if(!used[j]){used[j]=1;q.push(j)}}clusters.push(cl)}clusters.sort((a,b)=>b.length-a.length);
    const boardCluster=clusters.find(cl=>{const n=Math.round(Math.sqrt(cl.length));return n>=4&&n<=15&&n*n===cl.length})||clusters[0],cells=boardCluster.map(i=>comps[i]);
    const clusterCenters=vals=>{const out=[];for(const v of vals.sort((a,b)=>a-b)){const last=out[out.length-1];if(!last||Math.abs(v-last.mean)>typical*.55)out.push({mean:v,count:1});else{last.mean=(last.mean*last.count+v)/(++last.count)}}return out.map(x=>x.mean)};
    const xs=clusterCenters(cells.map(c=>c.cx)),ys=clusterCenters(cells.map(c=>c.cy)),n=xs.length===ys.length&&xs.length>=4&&xs.length<=15?xs.length:Math.max(xs.length,ys.length);
    if(n<4||n>15||xs.length!==n||ys.length!==n){$('status').textContent=`⚠️ Grid inference failed (${ys.length} rows × ${xs.length} columns). Try a tighter crop.`;return}
    const x0=xs[0],y0=ys[0],xStep=(xs[n-1]-x0)/(n-1),yStep=(ys[n-1]-y0)/(n-1),samples=[];
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){const x=Math.max(0,Math.min(w-1,Math.round(x0+c*xStep))),y=Math.max(0,Math.min(h-1,Math.round(y0+r*yStep))),i=(y*w+x)*4;samples.push([data[i],data[i+1],data[i+2]])}
    const palette=[];for(const rgb of samples){let found=-1;for(let k=0;k<palette.length;k++)if(rgbDist(rgb,palette[k].rgb)<28){found=k;break}if(found<0)palette.push({rgb:rgb.slice(),count:1});else{const p=palette[found];p.count++;p.rgb=p.rgb.map((v,k)=>Math.round((v*(p.count-1)+rgb[k])/p.count))}}
    palette.sort((a,b)=>b.count-a.count);if(palette.length!==n){$('status').textContent=`⚠️ Detected ${palette.length} color regions for a ${n}×${n} board. Expected ${n}.`;return}
    const toHex=rgb=>`#${rgb.map(v=>v.toString(16).padStart(2,'0')).join('')}`,names=[],usedNames=new Set();
    for(const p of palette){let bestName='',bestDist=Infinity;baseColors.forEach(c=>{const d=rgbDist(p.rgb,hexRgb(c[1]));if(d<bestDist){bestDist=d;bestName=c[0]}});if(bestDist>55)bestName='Mint';if(usedNames.has(bestName))bestName=`Color ${names.length+1}`;usedNames.add(bestName);names.push([bestName,toHex(p.rgb)])}
    detectedPalette=names;const detected=samples.map(rgb=>{let best=0,bd=Infinity;palette.forEach((p,k)=>{const d=rgbDist(rgb,p.rgb);if(d<bd){bd=d;best=k}});return best});
    size=n;$('size').value=String(n);board=Array.from({length:n},(_,r)=>detected.slice(r*n,(r+1)*n));dogs=Array(n).fill(-1);selected=0;$('scanPreview').hidden=true;$('status').textContent=`📷 Screenshot scanned successfully. Detected ${n}×${n} and ${n} color regions. Check the board, then press Solve.`;legend();render();
  }
  window.detectBoard=detect;
})();
