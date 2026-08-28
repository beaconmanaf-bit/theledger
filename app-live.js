(function(){
  let DATA = [];
  let lastUpdated = null;

  const COLS = [
    {key:'rank', label:'Rank', align:'left', fmt: v => v},
    {key:'name', label:'Company', align:'left', fmt: null},
    {key:'mcap', label:'Mkt Cap (Cr)', align:'right', fmt: v => fmtNum(v)},
    {key:'price', label:'Price (₹)', align:'right', fmt: v => fmtNum(v)},
    {key:'pe', label:'P/E', align:'right', fmt: v => fmtNum(v)},
    {key:'roce', label:'ROCE %', align:'right', fmt: v => fmtPct(v)},
    {key:'profitGrowth', label:'Profit Gr %', align:'right', fmt: v => fmtPct(v), signed:true},
    {key:'salesGrowth', label:'Sales Gr %', align:'right', fmt: v => fmtPct(v), signed:true},
    {key:'debtEq', label:'Debt/Eq', align:'right', fmt: v => fmtNum(v)},
    {key:'peg', label:'PEG', align:'right', fmt: v => fmtNum(v)},
    {key:'potential', label:'Potential', align:'right', fmt: null},
  ];

  let state = {
    search:'',
    sector:'',
    minMcap:0,
    minPotential:0,
    sortKey:'rank',
    sortDir:'asc',
    page:1,
    pageSize:25,
  };

  function fmtNum(v){
    if(v===null||v===undefined||isNaN(v)) return '—';
    return Number(v).toLocaleString('en-IN', {maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0});
  }
  function fmtPct(v){
    if(v===null||v===undefined||isNaN(v)) return '—';
    const s = v>0 ? '+' : '';
    return s + Number(v).toFixed(1);
  }

  const sectorSelect = document.getElementById('sectorSelect');
  let sectors = [];
  function populateSectors(){
    sectors = Array.from(new Set(DATA.map(d=>d.sector))).sort();
    sectors.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sectorSelect.appendChild(opt);
    });
  }

  function populateHeaderStats(){
    document.getElementById('hCount').textContent = DATA.length;
    document.getElementById('hSectors').textContent = sectors.length;
  }

  const tickerTrack = document.getElementById('tickerTrack');
  function buildTicker(list){
    return list.map(d=>{
      const cls = d.profitGrowth >= 0 ? 'up' : 'down';
      const arrow = d.profitGrowth >= 0 ? '▲' : '▼';
      return `<span class="tick"><b>${escapeHtml(d.name)}</b> · Potential ${d.potential.toFixed(0)} <span class="chg ${cls}">${arrow} ${fmtPct(d.profitGrowth)}%</span></span>`;
    }).join('');
  }
  function populateTicker(){
    const topTicker = [...DATA].sort((a,b)=>b.potential-a.potential).slice(0,16);
    tickerTrack.innerHTML = buildTicker(topTicker) + buildTicker(topTicker);
  }

  // ---------- table head ----------
  const headRow = document.getElementById('tableHeadRow');
  function renderHead(){
    headRow.innerHTML = COLS.map(c=>{
      const sorted = state.sortKey === c.key;
      const arrow = sorted ? (state.sortDir === 'asc' ? '▲' : '▼') : '';
      return `<th data-key="${c.key}" class="${sorted?'sorted':''}" style="text-align:${c.align}">${c.label}<span class="arrow">${arrow}</span></th>`;
    }).join('');
    headRow.querySelectorAll('th').forEach(th=>{
      th.addEventListener('click', ()=>{
        const key = th.dataset.key;
        if(state.sortKey === key){ state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'; }
        else { state.sortKey = key; state.sortDir = (key==='rank') ? 'asc' : 'desc'; }
        state.page = 1;
        render();
      });
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function getFiltered(){
    const q = state.search.trim().toLowerCase();
    let rows = DATA.filter(d=>{
      if(q && !d.name.toLowerCase().includes(q) && !d.business.toLowerCase().includes(q)) return false;
      if(state.sector && d.sector !== state.sector) return false;
      if(d.mcap < state.minMcap) return false;
      if(d.potential < state.minPotential) return false;
      return true;
    });
    rows.sort((a,b)=>{
      let av = a[state.sortKey], bv = b[state.sortKey];
      const aNull = (av===null||av===undefined), bNull = (bv===null||bv===undefined);
      if(aNull && bNull) return 0;
      if(aNull) return 1;   // nulls always sort to the end, regardless of direction
      if(bNull) return -1;
      if(typeof av === 'string') return state.sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return state.sortDir==='asc' ? av-bv : bv-av;
    });
    return rows;
  }

  function tagFor(d){
    if(d.potential >= 60) return '<span class="tag high">High</span>';
    if(d.potential >= 40) return '<span class="tag watch">Watch</span>';
    return '';
  }

  function renderStats(rows){
    const strip = document.getElementById('statStrip');
    const avgPotential = rows.length ? (rows.reduce((s,d)=>s+d.potential,0)/rows.length) : 0;
    const highCount = rows.filter(d=>d.potential>=60).length;
    const totalMcap = rows.reduce((s,d)=>s+d.mcap,0);
    const bySector = {};
    rows.forEach(d=>{ bySector[d.sector]=(bySector[d.sector]||0)+1; });
    const topSector = Object.entries(bySector).sort((a,b)=>b[1]-a[1])[0];
    strip.innerHTML = `
      <div class="stat"><div class="num">${rows.length.toLocaleString('en-IN')}</div><div class="lbl">Matching companies</div></div>
      <div class="stat accent"><div class="num">${highCount}</div><div class="lbl">High potential (≥60)</div></div>
      <div class="stat"><div class="num">${avgPotential.toFixed(1)}</div><div class="lbl">Avg. potential score</div></div>
      <div class="stat"><div class="num">${topSector ? topSector[0] : '—'}</div><div class="lbl">Leading sector (${topSector?topSector[1]:0})</div></div>
    `;
  }

  function render(){
    renderHead();
    const rows = getFiltered();
    renderStats(rows);
    document.getElementById('resultCount').textContent = `${rows.length} of ${DATA.length} shown`;

    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if(state.page > totalPages) state.page = totalPages;
    const start = (state.page-1)*state.pageSize;
    const pageRows = rows.slice(start, start+state.pageSize);

    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    if(pageRows.length === 0){
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      tbody.innerHTML = pageRows.map(d=>{
        const pctClass = v => v===null||v===undefined ? '' : (v>=0?'pos':'neg');
        return `<tr data-name="${escapeHtml(d.name)}">
          <td><span class="rank-badge ${d.rank<=10?'top':''}">${d.rank}</span></td>
          <td class="name-cell"><span class="stock-name">${escapeHtml(d.name)}</span><span class="stock-sector">${escapeHtml(d.sector)}</span></td>
          <td class="num">${fmtNum(d.mcap)}</td>
          <td class="num">${fmtNum(d.price)}</td>
          <td class="num">${fmtNum(d.pe)}</td>
          <td class="num">${fmtPct(d.roce)}</td>
          <td class="num ${pctClass(d.profitGrowth)}">${fmtPct(d.profitGrowth)}</td>
          <td class="num ${pctClass(d.salesGrowth)}">${fmtPct(d.salesGrowth)}</td>
          <td class="num">${fmtNum(d.debtEq)}</td>
          <td class="num">${fmtNum(d.peg)}</td>
          <td class="num">
            <div class="potential-cell">
              ${tagFor(d)}
              <div class="potential-bar"><i style="width:${d.potential}%"></i></div>
              <span class="potential-score">${d.potential.toFixed(0)}</span>
            </div>
          </td>
        </tr>`;
      }).join('');
      tbody.querySelectorAll('tr').forEach(tr=>{
        tr.addEventListener('click', ()=>{
          const d = DATA.find(x=>x.name === tr.dataset.name);
          openDrawer(d);
        });
      });
    }

    renderPager(totalPages, rows.length);
  }

  function renderPager(totalPages, total){
    const pager = document.getElementById('pager');
    if(total === 0){ pager.innerHTML=''; return; }
    pager.innerHTML = `
      <button id="prevBtn" ${state.page<=1?'disabled':''}>← Prev</button>
      <span>Page ${state.page} of ${totalPages}</span>
      <button id="nextBtn" ${state.page>=totalPages?'disabled':''}>Next →</button>
    `;
    const prev = document.getElementById('prevBtn');
    const next = document.getElementById('nextBtn');
    if(prev) prev.addEventListener('click', ()=>{ state.page--; render(); window.scrollTo({top: document.querySelector('.table-wrap').offsetTop - 20, behavior:'smooth'}); });
    if(next) next.addEventListener('click', ()=>{ state.page++; render(); window.scrollTo({top: document.querySelector('.table-wrap').offsetTop - 20, behavior:'smooth'}); });
  }

  // ---------- drawer ----------
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('drawer');
  function openDrawer(d){
    const pctClass = v => v===null||v===undefined ? '' : (v>=0?'pos':'neg');
    drawer.innerHTML = `
      <button class="close-btn" id="closeDrawer">✕</button>
      <div class="sector-line">${escapeHtml(d.sector)} · Rank #${d.rank} of ${DATA.length}</div>
      <h2>${escapeHtml(d.name)}</h2>
      <div class="business-line">${escapeHtml(d.business || '')}</div>

      <div class="potential-block">
        <div class="p-top">
          <div>
            <div class="p-lbl">Potential score</div>
            <div class="p-score">${d.potential.toFixed(1)}</div>
          </div>
          ${tagFor(d)}
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric"><div class="m-lbl">Price</div><div class="m-val">₹${fmtNum(d.price)}</div></div>
        <div class="metric"><div class="m-lbl">Market cap</div><div class="m-val">₹${fmtNum(d.mcap)} Cr</div></div>
        <div class="metric"><div class="m-lbl">P/E</div><div class="m-val">${fmtNum(d.pe)}</div></div>
        <div class="metric"><div class="m-lbl">PEG</div><div class="m-val">${fmtNum(d.peg)}</div></div>
        <div class="metric"><div class="m-lbl">ROCE</div><div class="m-val">${fmtPct(d.roce)}%</div></div>
        <div class="metric"><div class="m-lbl">Debt / Equity</div><div class="m-val">${fmtNum(d.debtEq)}</div></div>
        <div class="metric"><div class="m-lbl">Profit growth</div><div class="m-val ${pctClass(d.profitGrowth)}">${fmtPct(d.profitGrowth)}%</div></div>
        <div class="metric"><div class="m-lbl">Sales growth</div><div class="m-val ${pctClass(d.salesGrowth)}">${fmtPct(d.salesGrowth)}%</div></div>
        <div class="metric"><div class="m-lbl">Div yield</div><div class="m-val">${fmtNum(d.divYield)}%</div></div>
        <div class="metric"><div class="m-lbl">From 52w high</div><div class="m-val">${d.from52wHigh!==null? (d.from52wHigh*100).toFixed(0)+'%':'—'}</div></div>
        <div class="metric"><div class="m-lbl">Net profit (qtr)</div><div class="m-val">₹${fmtNum(d.netProfit)} Cr</div></div>
        <div class="metric"><div class="m-lbl">Sales (qtr)</div><div class="m-val">₹${fmtNum(d.salesQtr)} Cr</div></div>
      </div>

      <div class="drawer-note">Figures are from the uploaded snapshot and are for screening purposes only — not a recommendation to buy or sell.</div>
    `;
    document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
    overlay.classList.add('open');
  }
  function closeDrawer(){ overlay.classList.remove('open'); }
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeDrawer(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeDrawer(); });

  // ---------- controls ----------
  document.getElementById('searchInput').addEventListener('input', (e)=>{
    state.search = e.target.value; state.page = 1; render();
  });
  document.getElementById('sectorSelect').addEventListener('change', (e)=>{
    state.sector = e.target.value; state.page = 1; render();
  });

  let maxMcap = 100000;
  const mcapSlider = document.getElementById('mcapSlider');
  const mcapVal = document.getElementById('mcapVal');
  function mcapFromSlider(v){
    // exponential scale for better control over huge range
    const t = v/100;
    return Math.round(500 + (Math.pow(t,2.5) * (maxMcap-500)));
  }
  mcapSlider.addEventListener('input', (e)=>{
    state.minMcap = mcapFromSlider(Number(e.target.value));
    mcapVal.textContent = '₹' + state.minMcap.toLocaleString('en-IN') + ' Cr';
    state.page = 1; render();
  });

  const potSlider = document.getElementById('potSlider');
  const potVal = document.getElementById('potVal');
  potSlider.addEventListener('input', (e)=>{
    state.minPotential = Number(e.target.value);
    potVal.textContent = state.minPotential;
    state.page = 1; render();
  });

  document.getElementById('resetBtn').addEventListener('click', ()=>{
    state = {search:'', sector:'', minMcap:0, minPotential:0, sortKey:'rank', sortDir:'asc', page:1, pageSize:25};
    document.getElementById('searchInput').value='';
    document.getElementById('sectorSelect').value='';
    mcapSlider.value = 0; mcapVal.textContent = '₹500 Cr';
    potSlider.value = 0; potVal.textContent = '0';
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    render();
  });

  // ---------- presets ----------
  document.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const already = chip.classList.contains('active');
      document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      state.sector=''; document.getElementById('sectorSelect').value='';
      state.search=''; document.getElementById('searchInput').value='';
      state.minMcap=0; mcapSlider.value=0; mcapVal.textContent='₹500 Cr';
      state.minPotential=0; potSlider.value=0; potVal.textContent='0';
      state.sortKey='potential'; state.sortDir='desc';

      if(!already){
        chip.classList.add('active');
        const preset = chip.dataset.preset;
        if(preset==='highPotential'){ state.minPotential = 55; potSlider.value=55; potVal.textContent='55'; }
        if(preset==='lowDebt'){ state.sortKey='debtEq'; state.sortDir='asc'; }
        if(preset==='growth'){ state.sortKey='profitGrowth'; state.sortDir='desc'; }
        if(preset==='undervalued'){ state.sortKey='peg'; state.sortDir='asc'; }
      } else {
        state.sortKey='rank'; state.sortDir='asc';
      }
      state.page = 1;
      render();
    });
  });

  async function loadData(){
    try {
      const res = await fetch('./stocks.json?t=' + Date.now());
      const json = await res.json();
      DATA = json.stocks || json;   // supports either {stocks:[...], lastUpdated:...} or a raw array
      lastUpdated = json.lastUpdated || null;
    } catch (e) {
      console.error('Could not load stocks.json', e);
      document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif;color:#e2665a;">Could not load stock data (stocks.json). If you are opening this file directly from disk, run it through a local web server instead — browsers block file:// fetches.</p>';
      return;
    }

    // populate sector dropdown, header stats, ticker, table (all defined above using DATA)
    populateSectors();
    populateHeaderStats();
    populateTicker();
    maxMcap = Math.max(...DATA.map(d=>d.mcap));
    render();

    const stamp = document.getElementById('lastUpdatedStamp');
    if(stamp) stamp.textContent = lastUpdated ? ('Data as of ' + lastUpdated) : '';
  }

  loadData();
})();
