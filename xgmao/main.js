

//  Pokémon‐type → hex lookup
const typeColors = {
  Bug:      "#A8B820", Dark:     "#705848", Dragon:   "#7038F8",
  Electric: "#F8D030", Fairy:    "#EE99AC", Fighting: "#C03028",
  Fire:     "#F08030", Flying:   "#A890F0", Ghost:     "#705898",
  Grass:    "#78C850", Ground:   "#E0C068", Ice:       "#98D8D8",
  Normal:   "#A8A878", Poison:   "#A040A0", Psychic:   "#F85888",
  Rock:     "#B8A038", Steel:    "#B8B8D0", Water:     "#6890F0"
};

//  Load & parse CSV 
d3.csv("Pokemon.csv", d => ({
  name:    d.Name,
  type1:   d.Type_1,
  type2:   d.Type_2 || null,
  attack: +d.Attack,
  hp:     +d.HP,
  def:    +d.Defense,
  spAtk:  +d.Sp_Atk,
  spDef:  +d.Sp_Def,
  speed:  +d.Speed,
  Catch_Rate:  +d.Catch_Rate
}))

.then(raw => {

  // A) DRAW SANKEY
  

  //  Flatten dual‐types & assign half‐weight
  const entries = [];
  raw.forEach(d => {
    const w = d.type2 ? 0.5 : 1;
    entries.push({ type: d.type1, w, atk: d.attack, hp: d.hp, def: d.def });
    if (d.type2) {
      entries.push({ type: d.type2, w, atk: d.attack, hp: d.hp, def: d.def });
    }
  });

  // Build node list: All, each type, then 3 stat‐nodes
  const types = Array.from(new Set(entries.map(e => e.type)));
  const nodes = [], indexByName = new Map();
  function addNode(name) {
    indexByName.set(name, nodes.length);
    nodes.push({ name });
  }
  addNode("All Pokémon");
  types.forEach(addNode);
  addNode("Attack > 100");
  addNode("HP > 100");
  addNode("Defense > 100");

  //  Build links into only the >100 nodes
  const links = [];
  entries.forEach(e => {
    // All → Type
    links.push({
      source: indexByName.get("All Pokémon"),
      target: indexByName.get(e.type),
      value:  e.w
    });
    // Type → Attack>100?
    if (e.atk > 100) {
      links.push({
        source: indexByName.get(e.type),
        target: indexByName.get("Attack > 100"),
        value:  e.w
      });
    }
    // Type → HP>100?
    if (e.hp > 100) {
      links.push({
        source: indexByName.get(e.type),
        target: indexByName.get("HP > 100"),
        value:  e.w
      });
    }
    // Type → Defense>100?
    if (e.def > 100) {
      links.push({
        source: indexByName.get(e.type),
        target: indexByName.get("Defense > 100"),
        value:  e.w
      });
    }
  });

  //  Sankey layout
  const { sankey, sankeyLinkHorizontal } = d3;
  const chartDiv = document.getElementById("chart");
  const W = chartDiv.clientWidth,
        H = chartDiv.clientHeight;

  const sankeyGen = sankey()
    .nodeWidth(15)
    .nodePadding(5)
    .nodeAlign(d3.sankeyJustify)
    .extent([[1,1],[W-1,H-1]]);

  const graph = sankeyGen({
    nodes: nodes.map(d => ({ ...d })),
    links
  });

  //  Draw Sankey SVG
  const svg = d3.select("#chart")
    .append("svg")
      .attr("width",  W)
      .attr("height", H)
      .style("font", "10px sans-serif");

  //  Ribbons
  svg.append("g").attr("fill","none")
    .selectAll("path")
    .data(graph.links)
    .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", d => {
        const key = d.source.name === "All Pokémon"
          ? d.target.name
          : d.source.name;
        return typeColors[key] || "#ccc";
      })
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr("stroke-opacity", 0.7);

  //  Nodes
  svg.append("g")
    .selectAll("rect")
    .data(graph.nodes)
    .join("rect")
      .attr("x",      d => d.x0)
      .attr("y",      d => d.y0)
      .attr("width",  d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => {
        if (d.name === "All Pokémon") return "#ccc";
        if (typeColors[d.name])      return typeColors[d.name];
        if (d.name === "Attack > 100")  return "#e41a1c";
        if (d.name === "HP > 100")      return "#377eb8";
        if (d.name === "Defense > 100") return "#4daf4a";
        return "#999";
      })
      .attr("stroke", "#000");

  //  Labels
  svg.append("g")
    .selectAll("text")
    .data(graph.nodes)
    .join("text")
      .attr("x",      d => d.x0 < W/2 ? d.x1 + 6 : d.x0 - 6)
      .attr("y",      d => (d.y0 + d.y1) / 2)
      .attr("dy",     "0.35em")
      .attr("text-anchor", d => d.x0 < W/2 ? "start" : "end")
      .text(d => d.name);



  // B) DRAW BAR CHART

  // Prepare totals and take top 20
  const totals = raw
  .map(d => ({
    name:  d.name,
    type:  d.type1,                        // ← add this
    total: d.attack + d.hp + d.def
  }))
  .sort((a,b) => b.total - a.total)
  .slice(0, 20);


  const margin = { top: 40, right: 20, bottom: 100, left: 60 };
  const rc = d3.select("#rank-chart"),
        BW = rc.node().clientWidth  - margin.left - margin.right,
        BH = rc.node().clientHeight - margin.top  - margin.bottom;
        
// Set up SVG canvas for the bar chart, including margins
  const barSvg = rc.append("svg")
      .attr("width",  BW + margin.left + margin.right)
      .attr("height", BH + margin.top  + margin.bottom)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
// Scales
  const x = d3.scaleBand()
      .domain(totals.map(d => d.name))
      .range([0, BW])
      .padding(0.2);

  const y = d3.scaleLinear()
      .domain([0, d3.max(totals, d => d.total)])
      .nice()
      .range([BH, 0]);

  // axes
  barSvg.append("g")
      .attr("transform", `translate(0,${BH})`)
      .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform","rotate(-45)")
      .attr("text-anchor","end")
      .attr("dx","-0.5em")
      .attr("dy","0.25em");

  barSvg.append("g")
      .call(d3.axisLeft(y).ticks(6));

  // axis labels
  barSvg.append("text")
      .attr("x", BW/2).attr("y", BH + 45)
      .attr("text-anchor","middle")
      .attr("font-size","14px")
      .text("Pokémon");

  barSvg.append("text")
      .attr("transform","rotate(-90)")
      .attr("x", -BH/2).attr("y", -45)
      .attr("text-anchor","middle")
      .attr("font-size","14px")
      .text("Total Points (Atk+HP+Def)");

  // bars
  barSvg.selectAll("rect")
    .data(totals)
    .enter().append("rect")
      .attr("x",      d => x(d.name))
      .attr("y",      d => y(d.total))
      .attr("width",  x.bandwidth())
      .attr("height", d => BH - y(d.total))
      .attr("fill", d => typeColors[d.type] || "#ccc");


  // bar chart title
  rc.insert("h2","svg")
    .text("Top 20 Pokémon by Total Points of Abilities")
    .style("text-align","center")
    .style("margin-bottom","0.5em");

// C') DRAW CATCH RATE vs TOTAL POINTS
(function drawScatter(raw) {
  // — 1) Roll up into a nested Map: type → catchRate → {count, avgTotal}
  const grouped = d3.rollup(
    raw,
    v => ({
      count:    v.length,
      avgTotal: d3.mean(v, d => d.attack + d.hp + d.def)
    }),
    d => d.type1,
    d => +d.Catch_Rate
  );

  //  Flatten into an array
  const scatterData = [];
  for (const [type, rateMap] of grouped) {
    for (const [catchRate, stats] of rateMap) {
      scatterData.push({
        type,
        catchRate,
        count:    stats.count,
        avgTotal: stats.avgTotal
      });
    }
  }

  // Set up dimensions
  const container = d3.select("#scatter-chart");
  const margin    = { top: 20, right: 20, bottom: 50, left: 60 };
  const width     = container.node().clientWidth  - margin.left - margin.right;
  const height    = container.node().clientHeight - margin.top  - margin.bottom;

  //  Scales
  const xScale = d3.scaleLinear()
      .domain(d3.extent(scatterData, d => d.catchRate)).nice()
      .range([0, width]);

  const yScale = d3.scaleLinear()
      .domain(d3.extent(scatterData, d => d.avgTotal)).nice()
      .range([height, 0]);

  const rScale = d3.scaleSqrt()
      .domain([1, d3.max(scatterData, d => d.count)])
      .range([3, 12]);  // min/max radius

  //  Create SVG
  const svg = container.append("svg")
      .attr("width",  width  + margin.left + margin.right)
      .attr("height", height + margin.top  + margin.bottom)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  //  Axes
  svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale));
  svg.append("g")
      .call(d3.axisLeft(yScale));

  //  Labels
  svg.append("text")
      .attr("x", width/2).attr("y", height + 40)
      .attr("text-anchor","middle")
      .text("Catch Rate");
  svg.append("text")
      .attr("transform","rotate(-90)")
      .attr("x", -height/2).attr("y", -45)
      .attr("text-anchor","middle")
      .text("Avg Total Points (Atk+HP+Def)");

  //  Draw one circle per group
  svg.selectAll("circle")
    .data(scatterData)
    .join("circle")
      .attr("cx", d => xScale(d.catchRate))
      .attr("cy", d => yScale(d.avgTotal))
      .attr("r",  d => rScale(d.count))
      .attr("fill", d => typeColors[d.type] || "#ccc")
      .attr("opacity", 0.7)
    .append("title")  // simple tooltip
      .text(d => 
        `${d.type}\nCatch Rate: ${d.catchRate}\nAvg Total: ${d.avgTotal.toFixed(1)}\nCount: ${d.count}`
      );

  //  Title
  svg.append("text")
      .attr("x", width/2).attr("y", -5)
      .attr("text-anchor","middle")
      .attr("font-weight","bold")
      .text("Are stronger Pokémon harder to catch?");

  svg.append("text")
      .attr("x", width/2).attr("y", 10)
      .attr("text-anchor","middle")
      .attr("font-weight","bold")
      .text("Catch Rate vs Total Points ");
})(raw);



})

.catch(err => console.error(err));
