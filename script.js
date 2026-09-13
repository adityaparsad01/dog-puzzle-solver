const baseColors=[
  ['Pink','#ffa4bd'],['Blue','#729edf'],['Lime','#bfd449'],['Green','#3f894e'],['Yellow','#ffe284'],
  ['Purple','#9f5a9d'],['Dark Pink','#cd3a6e'],['Cyan','#5ee1d3'],['Orange','#ffb166'],['Dark Blue','#5871d6'],
  ['Coral','#ef8a70'],['Teal','#55b8a9'],['Violet','#8f79c9'],['Gold','#d7aa42'],['Sky','#6bb8e8']
];

let size=10;
let board=blankBoard(size);
let selected=0;
let dogs=Array(size).fill(-1);
let detectedPalette=null;
let detectedRegions=null;
let scanImage=null;

const $=id=>document.getElementById(id);

function paletteFor(n){
  const p=baseColors.slice(0,n);
  while(p.length<n){
    const i=p.length;
    const h=Math.round((i*137.508)%360);
    p.push([`Color ${i+1}`,`hsl(${h} 65% 70%)`]);
  }
  return p;
}

function colors(){return detectedPalette||paletteFor(size)}

function blankBoard(n){return Array.from({length:n},()=>Array(n).fill(null))}

function setSize(n,loadBlank=true){
  n=Math.max(2,Math.floor(Number(n)||10));
  size=n;
  detectedPalette=null;
  detectedRegions=null;
  $('size').value=String(n);
  selected=0;
  board=loadBlank?blankBoard(n):board;
  dogs=Array(n).fill(-1);
  $('solution').style.display='none';
  $('status').textContent=`${n}×${n} board created. Paint the colors, then press Solve.`;
  legend();
  render();
}

function buildRegions(){
  if(detectedRegions)return detectedRegions;
  const regions=Array.from({length:size},()=>Array(size).fill(-1));
  let id=0;
  for(let r=0;r<size;r++)for(let c=0;c<size;c++){
    if(regions[r][c]>=0)continue;
    const color=board[r][c];
    const q=[[r,c]];
    regions[r][c]=id;
    for(let head=0;head<q.length;head++){
      const [y,x]=q[head];
      const next=[[y-1,x],[y+1,x],[y,x-1],[y,x+1]];
      for(const [ny,nx] of next){
        if(ny<0||ny>=size||nx<0||nx>=size||regions[ny][nx]>=0||board[ny][nx]!==color)continue;
        regions[ny][nx]=id;
        q.push([ny,nx]);
      }
    }
    id++;
  }
  detectedRegions=regions;
  return regions;
}

function legend(){
  const cs=colors();
  $('legend').innerHTML=cs.map((x,i)=>`<button class="swatch ${i===selected?'selected':''}" data-i="${i}"><span class="dot" style="background:${x[1]}"></span>${i+1}: ${x[0]}</button>`).join('');
  document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{selected=+b.dataset.i;legend()});
}

function render(){
  const cs=colors(),g=$('grid');
  g.style.gridTemplateColumns=`repeat(${size},1fr)`;
  g.innerHTML='';
  for(let r=0;r<size;r++)for(let c=0;c<size;c++){
    const b=document.createElement('button');
    const colorIndex=board[r][c];
    b.className='cell'+(colorIndex===null?' empty':'')+(dogs[r]===c?' fox solution':'');
    b.style.setProperty('--cell-color',colorIndex===null?'#fff':cs[colorIndex]?.[1]||'#fff');
    b.title=colorIndex===null?`R${r+1} C${c+1}: Empty`:`R${r+1} C${c+1}: ${cs[colorIndex]?.[0]||'Color'}`;
    b.onclick=()=>{
      board[r][c]=selected;
      detectedRegions=null;
      dogs.fill(-1);
      $('solution').style.display='none';
      $('status').textContent='Board changed. Press Solve.';
      render();
    };
    g.appendChild(b);
  }
}

function solve(){
  dogs.fill(-1);
  const cs=colors();
  const regions=buildRegions();
  let nodes=0;

  if(board.some(row=>row.some(cell=>cell===null))){
    $('status').textContent='⚠️ Please paint every cell before solving.';
    $('solution').style.display='none';
    render();
    return;
  }

  const regionCount=Math.max(-1,...regions.flat())+1;
  if(regionCount!==size){
    $('status').textContent=`⚠️ Found ${regionCount} connected regions on a ${size}×${size} board. The puzzle needs exactly ${size} regions.`;
    $('solution').style.display='none';
    render();
    return;
  }

  const cols=new Set(),usedRegions=new Set();

  function legal(r,c){
    const region=regions[r][c];
    if(cols.has(c)||usedRegions.has(region))return false;
    for(let rr=0;rr<size;rr++){
      if(dogs[rr]>=0&&Math.abs(rr-r)<=1&&Math.abs(dogs[rr]-c)<=1)return false;
    }
    return true;
  }

  function dfs(n){
    nodes++;
    if(n===size)return true;

    let bestRow=-1,bestCandidates=null;
    for(let r=0;r<size;r++){
      if(dogs[r]>=0)continue;
      const candidates=[];
      for(let c=0;c<size;c++)if(legal(r,c))candidates.push(c);
      if(!candidates.length)return false;
      if(bestCandidates===null||candidates.length<bestCandidates.length){
        bestRow=r;
        bestCandidates=candidates;
        if(candidates.length===1)break;
      }
    }

    for(const c of bestCandidates){
      const region=regions[bestRow][c];
      dogs[bestRow]=c;
      cols.add(c);
      usedRegions.add(region);
      if(dfs(n+1))return true;
      cols.delete(c);
      usedRegions.delete(region);
      dogs[bestRow]=-1;
    }
    return false;
  }

  if(dfs(0)){
    $('status').textContent=`✅ Solution found for ${size}×${size} (${nodes.toLocaleString()} search nodes)`;
    $('solution').textContent=dogs.map((c,r)=>`Row ${r+1} → Column ${c+1} → ${cs[board[r][c]]?.[0]||'Region'}`).join('\n');
    $('solution').style.display='block';
    render();
  }else{
    $('status').textContent=`❌ No solution found for ${size}×${size}`;
    render();
  }
}

window.applyDetectedBoard=function(n,newBoard,newPalette,newRegions){
  size=n;
  detectedPalette=newPalette||null;
  detectedRegions=newRegions||null;
  board=newBoard;
  dogs=Array(n).fill(-1);
  selected=0;
  $('size').value=String(n);
  $('scanPreview').hidden=true;
  $('solution').style.display='none';
  const regionCount=newRegions?Math.max(...newRegions.flat())+1:n;
  $('status').textContent=`📷 Screenshot scanned successfully. Detected ${n}×${n} board and ${regionCount} regions. Check the board, then press Solve.`;
  legend();
  render();
};

$('scanButton').onclick=()=>$('imageInput').click();
$('imageInput').onchange=e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  $('scanName').textContent=file.name;
  const reader=new FileReader();
  reader.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      scanImage=img;
      const c=$('previewCanvas');
      const scale=Math.min(1,1400/img.width);
      c.width=Math.round(img.width*scale);
      c.height=Math.round(img.height*scale);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      $('scanPreview').hidden=false;
      $('status').textContent='Screenshot loaded. Tap Crop & Detect.';
    };
    img.src=reader.result;
  };
  reader.readAsDataURL(file);
};

$('size').onchange=()=>setSize(+$('size').value,true);
$('newBoard').onclick=()=>setSize(+$('size').value,true);
$('solve').onclick=solve;
$('clearDogs').onclick=()=>{dogs.fill(-1);$('solution').style.display='none';$('status').textContent='Foxes cleared.';render()};
$('clearBoard').onclick=()=>{board=blankBoard(size);detectedRegions=null;dogs.fill(-1);$('solution').style.display='none';$('status').textContent=`${size}×${size} board cleared.`;render()};

$('size').value='10';
legend();
render();
