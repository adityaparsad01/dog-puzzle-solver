const baseColors=[
  ['Pink','#ffa4bd'],['Blue','#729edf'],['Lime','#bfd449'],['Green','#3f894e'],
  ['Yellow','#ffe284'],['Purple','#9f5a9d'],['Dark Pink','#cd3a6e'],['Cyan','#5ee1d3'],
  ['Orange','#ffb166'],['Dark Blue','#5871d6'],['Coral','#ef8a70'],['Teal','#55b8a9'],
  ['Violet','#8f79c9'],['Gold','#d7aa42'],['Sky','#6bb8e8']
];

const example=[[0,0,0,1,1,1,0,0,0,0],[2,2,0,3,3,1,1,0,6,6],[2,2,0,3,4,4,5,0,0,6],[2,2,0,3,4,4,5,5,0,6],[2,2,0,7,4,5,5,5,0,6],[2,2,0,7,7,7,8,8,0,6],[2,2,0,7,7,8,8,8,0,0],[9,2,0,0,0,0,8,8,8,0],[9,9,9,9,9,0,8,8,8,0],[9,9,0,0,0,0,0,0,0,0]];

let size=10;
let board=example.map(r=>r.slice());
let selected=0;
let dogs=Array(size).fill(-1);
const $=id=>document.getElementById(id);

function paletteFor(n){
  const palette=baseColors.slice(0,n);
  while(palette.length<n){
    const i=palette.length;
    const hue=Math.round((i*137.508)%360);
    palette.push([`Color ${i+1}`,`hsl(${hue} 65% 70%)`]);
  }
  return palette;
}

function colors(){return paletteFor(size)}

function blankBoard(n){return Array.from({length:n},()=>Array(n).fill(null))}

function setSize(n,loadBlank=true){
  size=n;
  $('size').value=String(n);
  selected=Math.min(selected,n-1);
  board=loadBlank?blankBoard(n):example.map(r=>r.slice());
  dogs=Array(n).fill(-1);
  $('solution').style.display='none';
  $('status').textContent=loadBlank?`${n}×${n} board created. Paint the colors, then press Solve.`:'10×10 example loaded. Press Solve.';
  legend();
  render();
}

function legend(){
  const cs=colors();
  $('legend').innerHTML=cs.map((x,i)=>`<button class="swatch ${i===selected?'selected':''}" data-i="${i}"><span class="dot" style="background:${x[1]}"></span>${i+1}: ${x[0]}</button>`).join('');
  document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{selected=+b.dataset.i;legend()});
}

function render(){
  const cs=colors();
  const g=$('grid');
  g.style.gridTemplateColumns=`repeat(${size},1fr)`;
  g.innerHTML='';
  for(let r=0;r<size;r++){
    for(let c=0;c<size;c++){
      const b=document.createElement('button');
      const colorIndex=board[r][c];
      b.className='cell'+(dogs[r]===c?' dog solution':'');
      b.style.background=colorIndex===null?'#fff':cs[colorIndex][1];
      b.title=colorIndex===null?`R${r+1} C${c+1}: Empty`:`R${r+1} C${c+1}: ${cs[colorIndex][0]}`;
      b.onclick=()=>{
        board[r][c]=selected;
        dogs.fill(-1);
        $('solution').style.display='none';
        $('status').textContent='Board changed. Press Solve.';
        render();
      };
      g.appendChild(b);
    }
  }
}

function solve(){
  dogs.fill(-1);
  const cs=colors();
  let nodes=0;

  if(board.some(row=>row.some(cell=>cell===null))){
    $('status').textContent='⚠️ Please paint every cell before solving.';
    $('solution').style.display='none';
    render();
    return;
  }

  const cols=new Set();
  const usedColors=new Set();

  function legal(r,c){
    if(cols.has(c)||usedColors.has(board[r][c]))return false;
    for(let rr=0;rr<size;rr++){
      if(dogs[rr]>=0&&Math.abs(rr-r)<=1&&Math.abs(dogs[rr]-c)<=1)return false;
    }
    return true;
  }

  function dfs(n){
    nodes++;
    if(n===size)return true;
    let bestRow=-1,bestCells=[];
    for(let r=0;r<size;r++){
      if(dogs[r]>=0)continue;
      const cells=[];
      for(let c=0;c<size;c++)if(legal(r,c))cells.push(c);
      if(!cells.length)return false;
      if(bestRow<0||cells.length<bestCells.length){bestRow=r;bestCells=cells}
    }
    for(const c of bestCells){
      dogs[bestRow]=c;
      cols.add(c);
      usedColors.add(board[bestRow][c]);
      if(dfs(n+1))return true;
      cols.delete(c);
      usedColors.delete(board[bestRow][c]);
      dogs[bestRow]=-1;
    }
    return false;
  }

  if(dfs(0)){
    $('status').textContent=`✅ Solution found for ${size}×${size} (${nodes.toLocaleString()} search nodes)`;
    $('solution').textContent=dogs.map((c,r)=>`Row ${r+1} → Column ${c+1} → ${cs[board[r][c]][0]}`).join('\n');
    $('solution').style.display='block';
    render();
  }else{
    $('status').textContent=`❌ No solution found for ${size}×${size}`;
    render();
  }
}

$('size').onchange=()=>setSize(+$('size').value,true);
$('newBoard').onclick=()=>setSize(+$('size').value,true);
$('solve').onclick=solve;
$('clearDogs').onclick=()=>{dogs.fill(-1);$('solution').style.display='none';$('status').textContent='Dogs cleared.';render()};
$('example').onclick=()=>{
  if(size!==10){$('size').value='10';size=10;}
  board=example.map(r=>r.slice());
  dogs=Array(10).fill(-1);
  selected=0;
  $('solution').style.display='none';
  $('status').textContent='10×10 example loaded. Press Solve.';
  legend();render();
};
$('clearBoard').onclick=()=>{
  board=blankBoard(size);
  dogs.fill(-1);
  $('solution').style.display='none';
  $('status').textContent=`${size}×${size} board cleared.`;
  render();
};

$('size').value='10';
legend();
render();