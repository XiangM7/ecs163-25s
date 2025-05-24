// generate color for types
const typeColors = {
  Bug:      "#A8B820", Dark:     "#705848", Dragon:   "#7038F8",
  Electric: "#F8D030", Fairy:    "#EE99AC", Fighting: "#C03028",
  Fire:     "#F08030", Flying:   "#A890F0", Ghost:     "#705898",
  Grass:    "#78C850", Ground:   "#E0C068", Ice:       "#98D8D8",
  Normal:   "#A8A878", Poison:   "#A040A0", Psychic:   "#F85888",
  Rock:     "#B8A038", Steel:    "#B8B8D0", Water:     "#6890F0"
};

// Load CSV and parse into numeric and string fields
d3.csv("Pokemon.csv", d => ({
  name:      d.Name,
  type1:     d.Type_1,
  type2:     d.Type_2 || null,
  attack:    +d.Attack,
  hp:        +d.HP,
  def:       +d.Defense,
  spAtk:     +d.Sp_Atk,
  spDef:     +d.Sp_Def,
  speed:     +d.Speed,
  catchRate: +d.Catch_Rate
})).then(raw => {

  const entries = [];

  // Create entries array, splitting dual types with weight
  raw.forEach(d => {
    const w = d.type2 ? 0.5 : 1;
    entries.push({ type: d.type1, w, atk: d.attack, hp: d.hp, def: d.def });
    if (d.type2) entries.push({ type: d.type2, w, atk: d.attack, hp: d.hp, def: d.def });
  });

  const types = Array.from(new Set(entries.map(e => e.type)));
  const stats = ["Attack > 100", "HP > 100", "Defense > 100"];

  const nodes = [], indexByName = new Map();

  // Add a node with given name
  function addNode(name) {
    indexByName.set(name, nodes.length);
    nodes.push({ name });
  }
  addNode("All Pokémon");
  types.forEach(addNode);
  stats.forEach(addNode);

  const links = [];

  // Build sankey links based on type and stat thresholds
  entries.forEach(e => {
    links.push({ source: indexByName.get("All Pokémon"), target: indexByName.get(e.type), value: e.w });
    if (e.atk > 100) links.push({ source: indexByName.get(e.type), target: indexByName.get("Attack > 100"), value: e.w });
    if (e.hp  > 100) links.push({ source: indexByName.get(e.type), target: indexByName.get("HP > 100"), value: e.w });
    if (e.def > 100) links.push({ source: indexByName.get(e.type), target: indexByName.get("Defense > 100"), value: e.w });
  });

  const { sankey, sankeyLinkHorizontal } = d3; // Destructure sankey functions
  const chartDiv = document.getElementById("chart"),
        W = chartDiv.clientWidth,
        H = chartDiv.clientHeight;

  // Configure sankey layout generator
  const sankeyGen = sankey()
    .nodeWidth(15)
    .nodePadding(5)
    .nodeAlign(d3.sankeyJustify)
    .extent([[1,1],[W-1,H-1]]);

  // Generate sankey graph data
  const graph = sankeyGen({ nodes: nodes.map(d => ({ ...d })), links });

  // Create main SVG element
  const svg    = d3.select("#chart").append("svg")
                   .attr("viewBox", `0 0 ${W} ${H}`)
                   .attr("width", W).attr("height", H)
                   .style("font", "10px sans-serif");
  const linkG  = svg.append("g").attr("fill", "none");   // Group for links
  const nodeG  = svg.append("g");                         // Group for nodes
  const labelG = svg.append("g").attr("class", "labels"); // Group for node labels
  const valueG = svg.append("g").attr("class", "values"); // Group for value annotations

  // Reset zoom when clicking on background
  svg.on("click", (event) => {
    if (event.target.tagName === "svg") {
      svg.transition().duration(600).attr("viewBox", `0 0 ${W} ${H}`);
      valueG.selectAll("*").remove();
    }
  });

  const phase1 = graph.links.filter(d => d.source.name === "All Pokémon");
  const phase2 = graph.links.filter(d => d.source.name !== "All Pokémon");

  // Draw sankey links with entry animation
  function drawPhase(data, cls, delay) {
    const sel = linkG.selectAll(`path.${cls}`)
      .data(data, d => d.source.name + "→" + d.target.name);

    sel.enter().append("path")
      .attr("class", cls)
      .attr("d", sankeyLinkHorizontal()) // Path generator
      .attr("stroke", d => {
        const key = d.source.name==="All Pokémon" ? d.target.name : d.source.name;
        return typeColors[key] || "#ccc";
      })
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr("stroke-opacity", 0.7)
      .each(function() {
        const L = this.getTotalLength();
        d3.select(this)
          .attr("stroke-dasharray", `${L} ${L}`)
          .attr("stroke-dashoffset", L)
          .transition().delay(delay).duration(1000)
            .attr("stroke-dashoffset", 0);
      });

    sel.exit().remove();
  }

  drawPhase(phase1, "p1", 0);
  drawPhase(phase2, "p2", 400);

  // Draw nodes and add click handlers for stats nodes
  nodeG.selectAll("rect")
    .data(graph.nodes)
    .join("rect")
      .attr("x",      d => d.x0)
      .attr("y",      d => d.y0)
      .attr("width",  d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => {
        if (d.name === "All Pokémon") return "#ccc";
        if (typeColors[d.name]) return typeColors[d.name];
        if (d.name === "Attack > 100")  return "#e41a1c";
        if (d.name === "HP > 100")      return "#377eb8";
        if (d.name === "Defense > 100") return "#4daf4a";
        return "#999";
      })
      .attr("stroke", "#000")
      .style("cursor", d => stats.includes(d.name) ? "pointer" : "default")
      .on("click", (e,d) => {
        if (!stats.includes(d.name)) return;
        e.stopPropagation();
        zoomTo(d);               // Zoom into clicked node
        showValues(d.name);      // Show stat values
      });

  // Add text labels for nodes
  labelG.selectAll("text")
    .data(graph.nodes)
    .join("text")
      .attr("x", d => stats.includes(d.name)
        ? (d.x0 + d.x1)/2 - 25
        : (d.x0 < W/2 ? d.x1 + 6 : d.x0 - 6))
      .attr("y", d => stats.includes(d.name)
        ? d.y1 + 14
        : (d.y0 + d.y1)/2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => stats.includes(d.name)
        ? "middle"
        : (d.x0 < W/2 ? "start" : "end"))
      .text(d => d.name);

  // Zoom helper function
  function zoomTo(d) {
    const pad = 20;
    const dx  = d.x1 - d.x0 + pad*2;
    const dy  = d.y1 - d.y0 + pad*2;
    const minX = d.x0 - pad;
    const minY = d.y0 - pad;
    svg.transition().duration(600)
       .attr("viewBox", `${minX} ${minY} ${dx} ${dy}`);
  }

  // Prepare top-10 totals for bar chart
  const totals = raw.map(d => ({
    name: d.name,
    type: d.type1,
    total: d.attack + d.hp + d.def
  }))
  .sort((a,b) => b.total - a.total)
  .slice(0, 10);

  const barMargin = { top: 0, right: 20, bottom: 80, left: 60 };
  const rc = d3.select("#rank-chart"),
        BW = rc.node().clientWidth - barMargin.left - barMargin.right,
        BH = rc.node().clientHeight - barMargin.top - barMargin.bottom;

  // Create bar chart SVG
  const barSvg = rc.append("svg")
      .attr("width", BW + barMargin.left + barMargin.right)
      .attr("height", BH + barMargin.top + barMargin.bottom)
    .append("g")
      .attr("transform", `translate(${barMargin.left},${barMargin.top})`);

  // X scale for bar names
  const x = d3.scaleBand()
      .domain(totals.map(d => d.name))
      .range([0, BW]).padding(0.2);

  // Y scale for bar values
  const y = d3.scaleLinear()
      .domain([0, d3.max(totals, d => d.total)]).nice()
      .range([BH, 0]);

  // Draw X axis with rotated labels
  barSvg.append("g")
      .attr("transform", `translate(0,${BH})`)
      .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "rotate(-45)")
      .attr("text-anchor","end")
      .attr("dx","-0.5em")
      .attr("dy","0.25em");

  // Draw Y axis
  barSvg.append("g")
      .call(d3.axisLeft(y).ticks(5));

  // Placeholder for X axis label
  barSvg.append("text")
      .attr("x", BW/2).attr("y", BH + 60)
      .attr("text-anchor","middle")
      .text("");

  // Y axis label for bar chart
  barSvg.append("text")
      .attr("transform","rotate(-90)")
      .attr("x", -BH/2).attr("y", -45)
      .attr("text-anchor","middle")
      .text("Total Points (Atk+HP+Def)");

  // Draw bars and attach click for radar chart
  barSvg.selectAll("rect.bar")
    .data(totals)
    .join("rect")
      .attr("class","bar")
      .attr("x", d => x(d.name))
      .attr("y", d => y(d.total))
      .attr("width", x.bandwidth())
      .attr("height", d => BH - y(d.total))
      .attr("fill", d => typeColors[d.type] || "#ccc")
      .style("cursor","pointer")
      .on("click", (e,d) => drawRadar(d.name));

  // Insert bar chart title
  rc.insert("h2","svg")
    .text("Top 10 Pokémon by Total Points")
    .style("text-align","center")
    .style("margin","0 0 8px");

  // Immediately-invoked function to draw scatter plot
  (function drawScatter(raw) {
    // Roll up data by type and catch rate
    const grouped = d3.rollup(
      raw,
      v => ({ count: v.length, avgTotal: d3.mean(v, d => d.attack + d.hp + d.def) }),
      d => d.type1,
      d => +d.catchRate
    );
    const scatterData = [];
    for (const [type, rateMap] of grouped) {
      for (const [catchRate, stats] of rateMap) {
        scatterData.push({ type, catchRate, count: stats.count, avgTotal: stats.avgTotal });
      }
    }
    const container = d3.select("#scatter-chart");
    const margin    = { top:20, right:20, bottom:50, left:60 };
    const width     = container.node().clientWidth - margin.left - margin.right;
    const height    = container.node().clientHeight - margin.top - margin.bottom;
    let xExtent = d3.extent(scatterData, d => d.catchRate);
    let yExtent = d3.extent(scatterData, d => d.avgTotal);
    const xScale = d3.scaleLinear().domain(xExtent).nice().range([0,width]);
    const yScale = d3.scaleLinear().domain(yExtent).nice().range([height,0]);
    const rScale = d3.scaleSqrt().domain([1, d3.max(scatterData, d => d.count)]).range([3,12]);

    // Create SVG for scatter
    const svg = container.append("svg")
        .attr("width", width+margin.left+margin.right)
        .attr("height", height+margin.top+margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Background rect for click-to-reset
    svg.append("rect")
      .attr("class","bg")
      .attr("width", width)
      .attr("height", height)
      .attr("fill","transparent")
      .style("cursor","pointer")
      .on("click", resetZoom);

    // X axis group
    const xAxisG = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
    // Y axis group
    const yAxisG = svg.append("g")
        .call(d3.axisLeft(yScale));

    // X axis label
    svg.append("text")
      .attr("x", width/2).attr("y", height + 30)
      .attr("text-anchor", "middle")
      .attr("font-size","12px")
      .text("Catch Rate");

    // Y axis label
    svg.append("text")
        .attr("transform","rotate(-90)")
        .attr("x",-height/2).attr("y",-45)
        .attr("text-anchor","middle")
        .text("Avg Total Points");

    // Draw data circles
    const circles = svg.append("g").selectAll("circle")
      .data(scatterData).join("circle")
        .attr("cx", d => xScale(d.catchRate))
        .attr("cy", d => yScale(d.avgTotal))
        .attr("r", d => rScale(d.count))
        .attr("fill", d => typeColors[d.type] || "#ccc")
        .attr("opacity",0.7)
        .style("cursor","pointer")
        .on("click", pointClick);

    // Point click to zoom and annotate
    function pointClick(event,d) {
      event.stopPropagation();
      circles.attr("stroke",null);
      d3.select(this).attr("stroke","#000").attr("stroke-width",2);
      const deltaX=(xExtent[1]-xExtent[0])*0.2;
      const deltaY=(yExtent[1]-yExtent[0])*0.2;
      xScale.domain([d.catchRate-deltaX,d.catchRate+deltaX]).nice();
      yScale.domain([d.avgTotal-deltaY,d.avgTotal+deltaY]).nice();
      const t=svg.transition().duration(750);
      xAxisG.transition(t).call(d3.axisBottom(xScale));
      yAxisG.transition(t).call(d3.axisLeft(yScale));
      circles.transition(t)
        .attr("cx",d=>xScale(d.catchRate))
        .attr("cy",d=>yScale(d.avgTotal));
      svg.selectAll(".annot").remove();
      const info = [
        `Type: ${d.type}`,
        `Avg Total: ${d.avgTotal.toFixed(1)}`,
        `Catch Rate: ${d.catchRate}`
      ];
      info.forEach((txt,i) => svg.append("text")
        .attr("class","annot")
        .attr("x", xScale(d.catchRate)+8)
        .attr("y", yScale(d.avgTotal)-8 + i*14)
        .attr("font-size","12px")
        .attr("font-weight","bold")
        .text(txt));
    }

    // Reset zoom to full extents
    function resetZoom() {
      circles.attr("stroke",null);
      xScale.domain(xExtent).nice();
      yScale.domain(yExtent).nice();
      const t=svg.transition().duration(750);
      xAxisG.transition(t).call(d3.axisBottom(xScale));
      yAxisG.transition(t).call(d3.axisLeft(yScale));
      circles.transition(t)
        .attr("cx",d=>xScale(d.catchRate))
        .attr("cy",d=>yScale(d.avgTotal));
      svg.selectAll(".annot").remove();
    }

    // Chart title
    svg.append("text")
        .attr("x", width/2).attr("y", -5)
        .attr("text-anchor","middle")
        .attr("font-weight","bold")
        .text("Catch Rate vs Total Points");
  })(raw);

  // Draw radar chart for selected Pokémon
  function drawRadar(pokeName) {
    const cont = d3.select("#radar-chart");
    cont.selectAll("*").remove();
    const p = raw.find(d => d.name === pokeName);
    if (!p) return;
    const axes = [
      {axis:"HP", value:p.hp},
      {axis:"Attack", value:p.attack},
      {axis:"Defense", value:p.def},
      {axis:"Sp.Atk", value:p.spAtk},
      {axis:"Sp.Def", value:p.spDef},
      {axis:"Speed", value:p.speed}
    ];
    const W2 = cont.node().clientWidth,
          H2 = cont.node().clientHeight,
          m = 40,
          rMax = Math.min(W2,H2)/2 - m,
          angleSlice = Math.PI*2/axes.length,
          maxStat = d3.max(axes, d => d.value),
          rScale = d3.scaleLinear().domain([0, maxStat]).range([0, rMax]);
    const svgR = cont.append("svg")
      .attr("width", W2).attr("height", H2)
      .append("g")
      .attr("transform", `translate(${W2/2},${H2/2})`);
    // Draw concentric circles
    for (let lvl = 1; lvl <= 5; lvl++) {
      svgR.append("circle")
        .attr("r", rMax * lvl / 5)
        .attr("fill", "#ddd")
        .attr("stroke", "#aaa")
        .attr("fill-opacity", 0.1);
    }
    // Draw axes lines and labels
    axes.forEach((d,i) => {
      const ang = angleSlice * i - Math.PI/2;
      svgR.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", rMax * Math.cos(ang))
        .attr("y2", rMax * Math.sin(ang))
        .attr("stroke", "#888");
      svgR.append("text")
        .attr("x", (rMax+10) * Math.cos(ang))
        .attr("y", (rMax+10) * Math.sin(ang))
        .attr("text-anchor", "middle")
        .text(d.axis);
    });
    // Radar line generator
    const radarLine = d3.lineRadial()
      .radius(d => rScale(d.value))
      .angle((_,i) => i * angleSlice)
      .curve(d3.curveCatmullRomClosed);
    // Draw radar shape
    svgR.append("path")
      .datum(axes)
      .attr("d", radarLine)
      .attr("fill", typeColors[p.type1] || "#69b3a2")
      .attr("fill-opacity", 0.6)
      .attr("stroke", typeColors[p.type1] || "#69b3a2")
      .attr("stroke-width", 2);
    // Add radar chart title
    cont.insert("h3","svg")
      .text(`${pokeName} — Base Stats`)
      .style("text-align","center")
      .style("margin","4px 0");
  }

}).catch(err => console.error(err));
