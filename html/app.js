/**
 * Explorador de disciplinas semelhantes do ICMC-USP.
 *
 * Como ler este arquivo:
 * 1. prepara cores e utilitários compartilhados;
 * 2. configura a busca e o painel da disciplina selecionada;
 * 3. desenha o mapa de agrupamentos (Q1);
 * 4. compara visualmente as disciplinas mais semelhantes (Q2);
 * 5. desenha a grade e a rede de requisitos de cada curso (Q3).
 *
 * Os dados vêm de html/data/disciplinas.js, gerado pelo notebook 02.
 */
(() => {
  "use strict";

  const data = window.DATA;
  const subjects = data.nodes;
  const topics = data.topics;

  // 1. Configuração visual e funções compartilhadas
  // `subjects` usa índices numéricos; arestas, grades e requisitos apontam para esses índices.
  // uma cor por tópico, em sequência de matiz; a ordem dos tópicos vem do dendrograma (topicOrder)
  const PALETTE = [
    "#dcbebe",
    "#fa6e50",
    "#b47864",
    "#826400",
    "#fab464",
    "#d2b428",
    "#82a000",
    "#a0be78",
    "#3ca03c",
    "#286e3c",
    "#28be8c",
    "#285a5a",
    "#50bec8",
    "#006496",
    "#0082fa",
    "#8cb4e6",
    "#6446b4",
    "#b496fa",
    "#be50be",
    "#8c2882",
    "#a0648c",
    "#b40064",
    "#fa78b4",
    "#b40a32",
  ];
  const topicColors = [];
  data.topicOrder.forEach((t, g) => {
    topicColors[t] = PALETTE[g % PALETTE.length];
  });
  const topicColor = (topic) => topicColors[topic];
  const topicTextColor = (topic) => {
    const c = d3.hcl(topicColor(topic));
    c.l = Math.min(c.l, 40);
    return c.formatHex();
  };
  const topicBorderColor = (topic) =>
    d3.color(topicColor(topic)).darker(0.9).formatHex();

  const $ = (s) => document.querySelector(s);
  const formatSimilarity = (value) => value.toFixed(2).replace(".", ",");
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const truncate = (text, maxLength) =>
    text.length > maxLength
      ? text.slice(0, Math.max(1, maxLength - 1)) + "…"
      : text;
  const normalizeText = (text) =>
    text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // Lista de vizinhas usada apenas dentro do mapa de semelhança.
  const shortenCourseName = (name) => name.replace("Bacharelado em ", "");
  // Cada visualização mantém seu próprio estado; o mapa (Q1) e a grade (Q3) abrem sem seleção.
  const mapState = { selectedSubject: null }; // o mapa abre sem seleção

  // Tooltip compartilhado pelas três visualizações.
  const tooltip = $("#tip");
  const showTip = (e, head, body) => {
    tooltip.hidden = false;
    tooltip.innerHTML = `<b>${escapeHtml(head)}</b>${escapeHtml(body)}`;
    tooltip.style.left = Math.min(e.clientX + 14, innerWidth - 310) + "px";
    tooltip.style.top = e.clientY + 16 + "px";
  };
  const hideTip = () => {
    tooltip.hidden = true;
  };

  // 2. Busca por nome ou código
  const searchIndex = subjects.map((subject, subjectIndex) => ({
    subjectIndex,
    normalizedText: normalizeText(`${subject.name} ${subject.codes.join(" ")}`),
  }));
  function createSubjectFinder(
    inputElement,
    resultsElement,
    allowedSubjectIndexes,
    onSelect,
  ) {
    let matches = [],
      selectedResult = -1;
    const allowedSubjects = allowedSubjectIndexes
      ? new Set(allowedSubjectIndexes)
      : null;

    function search() {
      const query = normalizeText(inputElement.value.trim());
      const resultScore = (result) =>
        (normalizeText(subjects[result.subjectIndex].name) === query
          ? 0
          : normalizeText(subjects[result.subjectIndex].name).startsWith(query)
            ? 1
            : 2) *
          1000 +
        subjects[result.subjectIndex].name.length;
      matches =
        query.length < 2
          ? []
          : searchIndex
              .filter(
                (result) =>
                  (!allowedSubjects ||
                    allowedSubjects.has(result.subjectIndex)) &&
                  query
                    .split(/\s+/)
                    .every((word) => result.normalizedText.includes(word)),
              )
              .sort((a, b) => resultScore(a) - resultScore(b))
              .slice(0, 8)
              .map((result) => result.subjectIndex);
      selectedResult = matches.length ? 0 : -1;
      // na lista de resultados: o código digitado, se houver; senão "VÁRIOS" para
      // disciplinas reunidas a partir de mais de um código
      const typedCode = (subject) =>
        subject.codes.find((code) =>
          query.split(/\s+/).some((word) => word.length >= 3 && normalizeText(code).includes(word)),
        ) || (subject.codes.length > 1 ? "VÁRIOS" : subject.codes[0]);
      resultsElement.innerHTML = matches
        .map(
          (subjectIndex, resultIndex) =>
            `<li role="option" data-subject="${subjectIndex}" aria-selected="${resultIndex === selectedResult}">${escapeHtml(subjects[subjectIndex].name)}<span>${typedCode(subjects[subjectIndex])}</span></li>`,
        )
        .join("");
      resultsElement.hidden = !matches.length;
      inputElement.setAttribute(
        "aria-expanded",
        String(!resultsElement.hidden),
      );
    }
    const selectSubject = (subjectIndex) => {
      resultsElement.hidden = true;
      onSelect(subjectIndex);
    };
    inputElement.addEventListener("input", search);
    inputElement.addEventListener("focus", () => inputElement.select());
    inputElement.addEventListener("keydown", (e) => {
      if (!matches.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        selectedResult =
          (selectedResult + (e.key === "ArrowDown" ? 1 : matches.length - 1)) %
          matches.length;
        resultsElement
          .querySelectorAll("li")
          .forEach((resultElement, resultIndex) =>
            resultElement.setAttribute(
              "aria-selected",
              String(resultIndex === selectedResult),
            ),
          );
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectSubject(matches[selectedResult]);
      } else if (e.key === "Escape") {
        resultsElement.hidden = true;
      }
    });
    resultsElement.addEventListener("mousedown", (e) => {
      const resultElement = e.target.closest("li");
      if (resultElement) selectSubject(+resultElement.dataset.subject);
    });
    inputElement.addEventListener("blur", () =>
      setTimeout(() => {
        resultsElement.hidden = true;
      }, 150),
    );
  }
  const subjectSearchInput = $("#find");
  createSubjectFinder(subjectSearchInput, $("#find-list"), null, (i) =>
    selectDetailSubject(i),
  );

  // 3. Q1 · Mapa da rede de semelhança
  const similarityMap = {};
  function drawSimilarityMap() {
    const host = $("#net");
    host.innerHTML = "";
    const width = host.clientWidth;
    const height = Math.max(460, Math.min(700, Math.round(width * 0.56)));
    const margin = 26;
    // escala única nos dois eixos: a projeção é centralizada, não esticada até o retângulo
    const spanY = d3.max(subjects, (subject) => subject.y);
    const scale = Math.min(width - 2 * margin, (height - 2 * margin) / spanY);
    const offsetX = (width - scale) / 2;
    const offsetY = (height - scale * spanY) / 2;
    // repulsão visual: cada ponto fica preso à posição do UMAP e só se afasta o
    // necessário para não se sobrepor aos vizinhos (textos idênticos deixam de coincidir)
    const MAP_RADIUS = 4.6;
    const layout = subjects.map((subject) => {
      const x0 = offsetX + subject.x * scale;
      const y0 = offsetY + subject.y * scale;
      return { x0, y0, x: x0, y: y0 };
    });
    const collision = d3
      .forceSimulation(layout)
      .force("x", d3.forceX((d) => d.x0).strength(0.3))
      .force("y", d3.forceY((d) => d.y0).strength(0.3))
      .force("collide", d3.forceCollide(MAP_RADIUS + 0.9).iterations(2))
      .stop();
    for (let tick = 0; tick < 120; tick++) collision.tick();
    const position = new Map(subjects.map((subject, i) => [subject, layout[i]]));
    const projectX = (subject) => position.get(subject).x;
    const projectY = (subject) => position.get(subject).y;
    const radius = (i) => (i === mapState.selectedSubject ? 7 : MAP_RADIUS);
    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Rede de semelhança entre disciplinas");
    const g = svg.append("g");
    similarityMap.edges = g
      .append("g")
      .selectAll("line")
      .data(data.edges)
      .join("line")
      .attr("class", "n-edge")
      .attr("x1", ([a]) => projectX(subjects[a]))
      .attr("y1", ([a]) => projectY(subjects[a]))
      .attr("x2", ([, b]) => projectX(subjects[b]))
      .attr("y2", ([, b]) => projectY(subjects[b]));
    // linhas da selecionada até suas cinco vizinhas mais semelhantes
    similarityMap.links = g.append("g");
    similarityMap.nodes = g
      .append("g")
      .selectAll("circle")
      .data(subjects)
      .join("circle")
      .attr("class", "n-node")
      .attr("cx", projectX)
      .attr("cy", projectY)
      .attr("r", (n, i) => radius(i))
      .attr("fill", (n) => topicColor(n.topic))
      .on("mousemove", (e, n) =>
        showTip(e, topics[n.topic].name, n.name),
      )
      .on("mouseleave", hideTip)
      .on("click", (e, n) => {
        e.stopPropagation();
        selectMapSubject(subjects.indexOf(n));
      });

    // nomes dos tópicos no centro de cada grupo, empurrados para não se sobrepor
    const labels = topics
      .map((t) => {
        const mem = subjects.filter((n) => n.topic === t.id);
        return {
          t,
          x: d3.median(mem, projectX),
          y: d3.median(mem, projectY),
        };
      })
      .sort((a, b) => a.y - b.y);
    const boxes = [];
    for (const l of labels) {
      const w = l.t.name.length * 7,
        h = 16;
      let y = l.y;
      for (
        let k = 0;
        k < 30 &&
        boxes.some(
          (b) => Math.abs(b.x - l.x) < (b.w + w) / 2 && Math.abs(b.y - y) < h,
        );
        k++
      )
        y += 8;
      l.y = y;
      l.x = Math.max(w / 2 + 6, Math.min(width - w / 2 - 6, l.x));
      boxes.push({ x: l.x, y, w });
    }
    similarityMap.topicLabels = g
      .append("g")
      .selectAll("text")
      .data(labels)
      .join("text")
      .attr("class", "t-label")
      .attr("x", (l) => l.x)
      .attr("y", (l) => l.y)
      .attr("text-anchor", "middle")
      .attr("fill", (l) => topicTextColor(l.t.id))
      .text((l) => l.t.name);
    // marcadores numerados das vizinhas, acima dos pontos e dos rótulos
    similarityMap.badges = g.append("g");
    // índice abaixo do mapa: a selecionada e as vizinhas numeradas
    host.insertAdjacentHTML("beforeend", '<div class="net-index" aria-live="polite"></div>');
    host.querySelector(".net-index").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-subject]");
      if (button) selectMapSubject(+button.dataset.subject);
    });
    similarityMap.projectX = projectX;
    similarityMap.projectY = projectY;
    similarityMap.radius = radius;
    similarityMap.zoom = 1;

    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on("zoom", (e) => {
        similarityMap.zoom = e.transform.k;
        g.attr("transform", e.transform);
        similarityMap.nodes.attr(
          "r",
          (n, i) => radius(i) / Math.sqrt(similarityMap.zoom),
        );
        similarityMap.topicLabels
          .style("font-size", `${15 / similarityMap.zoom}px`)
          .style("stroke-width", `${4 / similarityMap.zoom}px`);
        similarityMap.badges
          .selectAll("circle")
          .attr("r", MAP_BADGE_RADIUS / similarityMap.zoom);
        similarityMap.badges
          .selectAll("text")
          .style("font-size", `${MAP_BADGE_FONT / similarityMap.zoom}px`);
        similarityMap.edges.attr(
          "stroke-width",
          (d) => edgeW(d) / similarityMap.zoom,
        );
        hideTip();
      });
    svg.call(zoom).on("click", () => selectMapSubject(null));

    updateSimilarityMap();
  }
  const edgeW = ([, , s]) => 0.4 + Math.max(0, s - 0.6) * 4;

  // Seleção no mapa: a disciplina escolhida ganha um anel; suas cinco vizinhas mais
  // semelhantes (cosseno nos embeddings) recebem números 1–5, repetidos no índice
  // abaixo do mapa, como no beeswarm da Q2. O restante é esmaecido.
  const MAP_TOP = 5;
  const MAP_BADGE_RADIUS = 8.5;
  const MAP_BADGE_FONT = 10;
  const textOnColor = (color) => (d3.lab(color).l < 58 ? "#ffffff" : "#22201c");
  function updateSimilarityMap() {
    if (!similarityMap.nodes) return;
    const selectedSubject = mapState.selectedSubject;
    const zoomLevel = similarityMap.zoom;
    const anchor = selectedSubject === null ? null : subjects[selectedSubject];
    const nearest = anchor
      ? anchor.near.slice(0, MAP_TOP).map(([j, s], rank) => ({ j, s, rank }))
      : [];
    const highlighted = new Set([selectedSubject, ...nearest.map((d) => d.j)]);
    similarityMap.nodes
      .attr("opacity", (n, i) => (anchor === null || highlighted.has(i) ? 1 : 0.18))
      .attr("r", (n, i) => similarityMap.radius(i) / Math.sqrt(zoomLevel))
      .attr("stroke", (n, i) =>
        i === selectedSubject ? "var(--ink)" : topicBorderColor(n.topic),
      )
      .attr("stroke-width", (n, i) => (i === selectedSubject ? 2.4 : 0.6));
    similarityMap.edges.attr("stroke-opacity", anchor === null ? 0.14 : 0.03);
    similarityMap.topicLabels.attr("opacity", anchor === null ? 1 : 0.2);

    similarityMap.links
      .selectAll("line")
      .data(nearest, (d) => d.j)
      .join("line")
      .attr("class", "n-link")
      .attr("x1", () => similarityMap.projectX(anchor))
      .attr("y1", () => similarityMap.projectY(anchor))
      .attr("x2", (d) => similarityMap.projectX(subjects[d.j]))
      .attr("y2", (d) => similarityMap.projectY(subjects[d.j]));

    const badges = similarityMap.badges
      .selectAll("g")
      .data(nearest, (d) => d.j)
      .join((enter) => {
        const badge = enter.append("g").attr("class", "n-badge");
        badge.append("circle");
        badge.append("text");
        return badge;
      })
      .attr(
        "transform",
        (d) =>
          `translate(${similarityMap.projectX(subjects[d.j])},${similarityMap.projectY(subjects[d.j])})`,
      )
      .on("mousemove", (e, d) =>
        showTip(e, topics[subjects[d.j].topic].name, subjects[d.j].name),
      )
      .on("mouseleave", hideTip)
      .on("click", (e, d) => {
        e.stopPropagation();
        selectMapSubject(d.j);
      });
    badges
      .select("circle")
      .attr("r", MAP_BADGE_RADIUS / zoomLevel)
      .attr("fill", (d) => topicColor(subjects[d.j].topic));
    badges
      .select("text")
      .style("font-size", `${MAP_BADGE_FONT / zoomLevel}px`)
      .attr("fill", (d) => textOnColor(topicColor(subjects[d.j].topic)))
      .text((d) => d.rank + 1);

    const index = $("#net .net-index");
    if (anchor === null) {
      index.innerHTML =
        '<p class="net-index-hint">Clique numa disciplina para numerar no mapa suas cinco vizinhas mais semelhantes</p>';
      return;
    }
    index.innerHTML = `
      <div class="net-index-head">
        <span class="net-index-ring" aria-hidden="true"></span>
        <span><span class="bs-index-name">${escapeHtml(anchor.name)}</span><span class="bs-index-meta">${escapeHtml(topics[anchor.topic].name)}</span></span>
      </div>
      <ol class="bs-index net-index-list">${nearest
        .map(({ j, rank }) => {
          const color = topicColor(subjects[j].topic);
          return `<li><button type="button" data-subject="${j}">
          <span class="bs-index-n" style="background:${color};color:${textOnColor(color)}">${rank + 1}</span>
          <span class="bs-index-name">${escapeHtml(subjects[j].name)}</span>
        </button></li>`;
        })
        .join("")}</ol>`;
  }

  // 4. Ficha da disciplina encontrada na busca
  // A ficha tem estado próprio e não acompanha o mapa: a coordenação entre visões
  // fica para a próxima entrega.
  function selectMapSubject(subjectIndex) {
    mapState.selectedSubject = subjectIndex;
    hideTip();
    updateSimilarityMap();
  }

  const detailState = { selectedSubject: null };
  function selectDetailSubject(subjectIndex) {
    detailState.selectedSubject = subjectIndex;
    renderSubjectDetails();
  }

  function renderSubjectDetails() {
    const box = $("#detail"),
      el = $("#card");
    if (detailState.selectedSubject === null) {
      box.hidden = true;
      el.innerHTML = "";
      subjectSearchInput.value = "";
      return;
    }
    box.hidden = false;
    const n = subjects[detailState.selectedSubject];
    subjectSearchInput.value = n.name;
    const rows = [
      [
        "Tópico",
        `<span style="color:${topicTextColor(n.topic)}">${escapeHtml(topics[n.topic].name)}</span>`,
      ],
      [
        "Carga",
        [n.credits && `${n.credits} créditos`, n.hours && `${n.hours} h`]
          .filter(Boolean)
          .join(" · "),
      ],
      ["Semestre", n.period ? `${n.period}º` : ""],
      [n.codes.length > 1 ? "Códigos" : "Código", n.codes.join(", ")],
    ].filter(([, v]) => v);
    el.innerHTML = `
      <div class="card-main">
        <p class="code">Disciplina</p>
        <h4 class="name">${escapeHtml(n.name)}</h4>
        <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        ${[["Ementa", n.ementa], ["Objetivos", n.objectives], ["Conteúdo Programático", n.program]]
          .filter(([, text]) => text)
          .map(([title, text]) => `<h5>${title}</h5><p class="text just">${escapeHtml(text)}</p>`)
          .join("")}
        <a href="https://uspdigital.usp.br/jupiterweb/obterDisciplina?sgldis=${n.id}" target="_blank" rel="noopener">Ver no JúpiterWeb ↗</a>
      </div>`;
  }
  $("#detail-close").addEventListener("click", () => selectDetailSubject(null));

  // 5. Q2 · Comparação visual de similaridade textual
  const similaritySearchInput = $("#similarity-find");
  const similarityState = { selectedSubject: null };
  createSubjectFinder(
    similaritySearchInput,
    $("#similarity-find-list"),
    null,
    selectSimilaritySubject,
  );

  function selectSimilaritySubject(subjectIndex) {
    similarityState.selectedSubject = subjectIndex;
    hideTip();
    drawSubjectSimilarity();
  }

  function drawSubjectSimilarity() {
    const host = $("#similarity");
    host.innerHTML = "";
    const referenceIndex = similarityState.selectedSubject;
    if (referenceIndex === null) {
      similaritySearchInput.value = "";
      $("#similarity-note").textContent = "";
      host.innerHTML =
        '<p class="similarity-empty">Selecione uma disciplina de referência para comparar as ementas.</p>';
      return;
    }
    const reference = subjects[referenceIndex];
    similaritySearchInput.value = reference.name;
    $("#similarity-note").textContent =
      `${reference.codes[0]} · ${topics[reference.topic].name}`;

    // Beeswarm: uma linha por tópico e um ponto por disciplina, posicionado pela
    // semelhança com a disciplina de referência. Os tópicos com a disciplina mais
    // parecida aparecem primeiro; as cinco mais parecidas têm o número dentro da bolinha, repetido no índice.
    // O limiar é o percentil 90 de todos os pares; as cinco mais parecidas aparecem mesmo abaixo dele.
    const FLOOR = data.meta.p90All;
    const TOP = 5;
    const similarities = data.sim[referenceIndex];
    const items = subjects
      .map((subject, subjectIndex) => ({ subjectIndex, topic: subject.topic, value: similarities[subjectIndex] / 100 }))
      .filter((d) => d.subjectIndex !== referenceIndex)
      .sort((a, b) => b.value - a.value)
      .filter((d, rank) => rank < TOP || d.value >= FLOOR);
    items.forEach((d, rank) => { d.rank = rank; });
    const lowest = Math.min(FLOOR, items.length ? items[items.length - 1].value : FLOOR);

    host.insertAdjacentHTML("beforeend", `<div class="bs-wrap"><div class="bs-fig"></div><aside class="bs-side"><h4>As cinco mais parecidas</h4><ol class="bs-index"></ol></aside></div>`);
    const fig = host.querySelector(".bs-fig");
    const width = Math.max(320, fig.clientWidth);
    const compact = width < 640;
    const labelW = compact ? 0 : 230, r = 5.2, rTop = 9, top = 24;
    const radius = (d) => (d.rank < TOP ? rTop : r);
    const x = d3.scaleLinear().domain([lowest, 1]).range([labelW + 12, width - 10]);

    const rows = d3.groups(items, (d) => d.topic)
      .map(([topic, list]) => ({ topic, list, best: list[0].value }))
      .sort((a, b) => b.best - a.best);
    let y0 = top;
    for (const row of rows) {
      row.list.forEach((d, k) => { d.x = x(d.value); d.y = ((k % 3) - 1) * 1.5; });
      const simulation = d3.forceSimulation(row.list)
        .force("x", d3.forceX((d) => x(d.value)).strength(1))
        .force("y", d3.forceY(0).strength(0.08))
        .force("collide", d3.forceCollide((d) => radius(d) + 0.9))
        .stop();
      for (let k = 0; k < 200; k++) simulation.tick();
      const extent = d3.max(row.list, (d) => Math.abs(d.y) + radius(d)) || r;
      const head = compact ? 20 : 0;
      row.y0 = y0;
      row.cy = y0 + head + extent + 9;
      row.list.forEach((d) => { d.y += row.cy; });
      y0 += Math.max(compact ? 44 : 40, head + 2 * extent + 18);
    }
    const height = y0 + 4;
    const svg = d3.select(fig).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img")
      .attr("aria-label", `Beeswarm das ${items.length} disciplinas com semelhança de pelo menos ${formatSimilarity(FLOOR)} com ${reference.name}, agrupadas em ${rows.length} tópicos. A mais parecida é ${items.length ? subjects[items[0].subjectIndex].name : "nenhuma"}`);

    // eixo de semelhança
    const axis = svg.append("g").attr("class", "sim-axis");
    const ticks = d3.range(Math.ceil(lowest * 10), 11)
      .filter((k) => !compact || (10 - k) % 2 === 0)
      .map((k) => k / 10);
    for (const v of ticks) {
      axis.append("line").attr("x1", x(v)).attr("x2", x(v)).attr("y1", top - 6).attr("y2", height).attr("stroke-dasharray", "1 3");
      axis.append("text").attr("x", x(v)).attr("y", top - 12).attr("text-anchor", v === 1 ? "end" : "middle").text(formatSimilarity(v));
    }

    for (const row of rows) {
      svg.append("line").attr("class", "bs-rule").attr("x1", 0).attr("x2", width).attr("y1", row.y0).attr("y2", row.y0);
      const labelY = compact ? row.y0 + 15 : row.cy - 1;
      svg.append("text").attr("class", "bs-row").attr("x", 0).attr("y", labelY).attr("fill", topicTextColor(row.topic))
        .text(truncate(topics[row.topic].name, compact ? 40 : 34));
      svg.append("text").attr("class", "bs-sub").attr("x", compact ? width : 0).attr("y", compact ? labelY : labelY + 14)
        .attr("text-anchor", compact ? "end" : "start")
        .text(`${row.list.length} disciplina${row.list.length === 1 ? "" : "s"}${row.topic === reference.topic ? " · mesmo tópico" : ""}`);

      svg.append("g").selectAll("circle").data(row.list).join("circle").attr("class", "bs-dot")
        .attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", radius)
        .attr("fill", (d) => topicColor(d.topic)).attr("stroke", (d) => (d.rank < TOP ? "var(--ink)" : topicBorderColor(d.topic)))
        .attr("stroke-width", (d) => (d.rank < TOP ? 1.2 : null))
        .on("click", (event, d) => selectSimilaritySubject(d.subjectIndex))
        .on("mousemove", (event, d) => {
          const subject = subjects[d.subjectIndex];
          showTip(event, `${subject.codes[0]} · semelhança ${formatSimilarity(d.value)}`, subject.name);
        })
        .on("mouseleave", hideTip);
      // número da posição dentro das cinco maiores bolinhas, com contraste calculado sobre a cor
      svg.append("g").selectAll("text").data(row.list.filter((d) => d.rank < TOP)).join("text").attr("class", "bs-num")
        .attr("x", (d) => d.x).attr("y", (d) => d.y + 3.5).attr("text-anchor", "middle")
        .attr("fill", (d) => (d3.lab(topicColor(d.topic)).l < 58 ? "#ffffff" : "#22201c"))
        .text((d) => d.rank + 1);
    }

    host.querySelector(".bs-index").innerHTML = items.slice(0, TOP).map((d) => {
      const subject = subjects[d.subjectIndex];
      return `<li><button type="button" data-subject="${d.subjectIndex}">
        <span class="bs-index-n" style="background:${topicColor(d.topic)};color:${d3.lab(topicColor(d.topic)).l < 58 ? "#ffffff" : "#22201c"}">${d.rank + 1}</span>
        <span><span class="bs-index-name">${escapeHtml(subject.name)}</span><span class="bs-index-meta">${subject.codes[0]} · ${formatSimilarity(d.value)}</span></span>
      </button></li>`;
    }).join("");
    host.querySelector(".bs-index").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-subject]");
      if (button) selectSimilaritySubject(+button.dataset.subject);
    });
  }

  // 6. Q3 · Grade do curso e rede de requisitos
  // Uma coluna por semestre ideal, uma caixa por disciplina (cheia: obrigatória; clara: optativa).
  // Os requisitos usados são somente os do curso escolhido: a mesma disciplina pode ter
  // requisitos diferentes em cursos diferentes.
  const curriculumCourseSelect = $("#grid-course");
  const curriculumKindToggle = $("#grid-kind");
  curriculumCourseSelect.innerHTML =
    '<option value="">Selecione um curso</option>' +
    data.courses
      .map(
        (course, courseIndex) =>
          `<option value="${courseIndex}">${escapeHtml(shortenCourseName(course.name))}</option>`,
      )
      .join("");
  curriculumCourseSelect.value = "";
  const curriculumState = {
    course: null,
    kind: "all",
    selectedSubject: null, // a grade abre sem seleção
  };
  curriculumCourseSelect.addEventListener("change", () => {
    curriculumState.course =
      curriculumCourseSelect.value === ""
        ? null
        : Number(curriculumCourseSelect.value);
    curriculumState.selectedSubject = null;
    drawCurriculum();
  });
  curriculumKindToggle.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    curriculumState.kind = b.dataset.kind;
    curriculumState.selectedSubject = null;
    curriculumKindToggle
      .querySelectorAll("button")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawCurriculum();
  });

  // requisitos do curso: entradas e saídas de cada disciplina
  function buildCourseRequisiteMaps(course) {
    const prerequisitesBySubject = new Map();
    const unlockedBySubject = new Map();
    for (const [prerequisiteIndex, subjectIndex, strong] of course.reqs) {
      if (!prerequisitesBySubject.has(subjectIndex)) {
        prerequisitesBySubject.set(subjectIndex, []);
      }
      prerequisitesBySubject
        .get(subjectIndex)
        .push([prerequisiteIndex, strong]);
      if (!unlockedBySubject.has(prerequisiteIndex)) {
        unlockedBySubject.set(prerequisiteIndex, []);
      }
      unlockedBySubject.get(prerequisiteIndex).push([subjectIndex, strong]);
    }
    return { prerequisitesBySubject, unlockedBySubject };
  }
  const findReachableSubjects = (startSubject, adjacencyMap) => {
    const visitedSubjects = new Set();
    const pendingSubjects = [startSubject];
    while (pendingSubjects.length) {
      const currentSubject = pendingSubjects.pop();
      for (const [nextSubject] of adjacencyMap.get(currentSubject) || []) {
        if (!visitedSubjects.has(nextSubject)) {
          visitedSubjects.add(nextSubject);
          pendingSubjects.push(nextSubject);
        }
      }
    }
    visitedSubjects.delete(startSubject);
    return visitedSubjects;
  };

  function drawCurriculum() {
    const host = $("#grid");
    host.innerHTML = "";
    if (curriculumState.course === null) {
      $("#grid-note").textContent = "";
      host.innerHTML =
        '<p class="grid-empty">Selecione um curso para visualizar sua grade e seus requisitos.</p>';
      return;
    }
    const course = data.courses[curriculumState.course];
    const allCourseSubjects = course.items.map(
      ([subjectIndex, mandatory, semester, kind]) => ({
        subjectIndex,
        mandatory,
        semester,
        kind,
      }),
    );
    const visibleSubjects = allCourseSubjects.filter(
      (item) => curriculumState.kind === "all" || item.mandatory,
    );
    const semesters = d3.range(
      1,
      d3.max(allCourseSubjects, (item) => item.semester) + 1,
    );
    const width = host.clientWidth;
    const semesterWidth = width / semesters.length;
    const boxWidth = semesterWidth - 10;
    const boxHeight = 22;
    const verticalGap = 5;
    const topMargin = 30;
    const topicOrderIndex = (item) =>
      data.topicOrder.indexOf(subjects[item.subjectIndex].topic);
    const subjectsBySemester = d3.group(
      visibleSubjects,
      (item) => item.semester,
    );
    let maximumY = 0;
    const positionsBySubject = new Map();
    for (const semester of semesters) {
      const semesterSubjects = (subjectsBySemester.get(semester) || []).sort(
        (a, b) =>
          b.mandatory - a.mandatory ||
          topicOrderIndex(a) - topicOrderIndex(b) ||
          subjects[a.subjectIndex].name.localeCompare(
            subjects[b.subjectIndex].name,
            "pt",
          ),
      );
      let y = topMargin;
      semesterSubjects.forEach((item, itemIndex) => {
        if (
          itemIndex > 0 &&
          semesterSubjects[itemIndex - 1].mandatory &&
          !item.mandatory
        ) {
          y += 10;
        }
        positionsBySubject.set(item.subjectIndex, {
          x: (semester - 1) * semesterWidth + 4,
          y,
          item,
        });
        y += boxHeight + verticalGap;
      });
      maximumY = Math.max(maximumY, y);
    }
    const height = maximumY + 6;

    // disciplina escolhida: acendem só os requisitos (diretos e indiretos) e o que ela libera, neste curso
    const { prerequisitesBySubject, unlockedBySubject } =
      buildCourseRequisiteMaps(course);
    const selectedSubject = curriculumState.selectedSubject;
    const selectedInCourse =
      selectedSubject !== null &&
      allCourseSubjects.some((item) => item.subjectIndex === selectedSubject);
    const selectedIsVisible =
      selectedSubject !== null && positionsBySubject.has(selectedSubject);
    const prerequisites = selectedIsVisible
      ? findReachableSubjects(selectedSubject, prerequisitesBySubject)
      : new Set();
    const unlockedSubjects = selectedIsVisible
      ? findReachableSubjects(selectedSubject, unlockedBySubject)
      : new Set();
    const isHighlighted = (subjectIndex) =>
      !selectedIsVisible ||
      subjectIndex === selectedSubject ||
      prerequisites.has(subjectIndex) ||
      unlockedSubjects.has(subjectIndex);
    $("#grid-note").textContent =
      selectedSubject === null
        ? `${visibleSubjects.length} disciplinas`
        : !selectedInCourse
          ? `${subjects[selectedSubject].name} não está na grade deste curso`
          : !selectedIsVisible
            ? `${subjects[selectedSubject].name} não aparece neste filtro`
            : `${prerequisites.size} requisito${prerequisites.size === 1 ? "" : "s"} · libera ${unlockedSubjects.size}`;

    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", `Grade de ${course.name} por semestre ideal`);
    semesters.forEach((semester) => {
      svg
        .append("text")
        .attr("class", "g-col")
        .attr("x", (semester - 1) * semesterWidth + 4)
        .attr("y", 14)
        .text(`${semester}º semestre`);
      svg
        .append("line")
        .attr("class", "g-rule")
        .attr("x1", (semester - 1) * semesterWidth + 4)
        .attr("x2", (semester - 1) * semesterWidth + 4 + boxWidth)
        .attr("y1", 21)
        .attr("y2", 21);
    });

    const fillColor = (item) =>
      d3.interpolateRgb(
        "#f7f4ed",
        topicColor(subjects[item.subjectIndex].topic),
      )(item.mandatory ? 0.88 : 0.38);
    const textColor = (item) =>
      d3.lab(fillColor(item)).l < 58 ? "#ffffff" : "#22201c";
    const box = svg
      .append("g")
      .selectAll("g")
      .data([...positionsBySubject.values()])
      .join("g")
      .attr("class", "g-box")
      .attr("transform", (p) => `translate(${p.x},${p.y})`)
      .on("click", (e, p) => {
        curriculumState.selectedSubject =
          p.item.subjectIndex === curriculumState.selectedSubject
            ? null
            : p.item.subjectIndex;
        drawCurriculum();
      })
      .on("mousemove", (e, p) =>
        showTip(
          e,
          `${subjects[p.item.subjectIndex].codes[0]} · ${p.item.semester}º semestre · ${["obrigatória", "optativa eletiva", "optativa livre"][p.item.kind]}${
            selectedIsVisible && prerequisites.has(p.item.subjectIndex)
              ? " · requisito"
              : selectedIsVisible && unlockedSubjects.has(p.item.subjectIndex)
                ? " · liberada"
                : ""
          }`,
          subjects[p.item.subjectIndex].name,
        ),
      )
      .on("mouseleave", hideTip);
    box
      .append("rect")
      .attr("width", boxWidth)
      .attr("height", boxHeight)
      .attr("rx", 2)
      .attr("fill", (p) =>
        isHighlighted(p.item.subjectIndex)
          ? fillColor(p.item)
          : d3.interpolateRgb("#f7f4ed", fillColor(p.item))(0.16),
      )
      .attr("stroke", (p) =>
        p.item.subjectIndex === selectedSubject
          ? "var(--ink)"
          : p.item.mandatory
            ? "none"
            : isHighlighted(p.item.subjectIndex)
              ? topicBorderColor(subjects[p.item.subjectIndex].topic)
              : "#d4ccbc",
      )
      .attr("stroke-width", (p) =>
        p.item.subjectIndex === selectedSubject ? 2 : 1,
      )
      .attr("stroke-dasharray", (p) =>
        p.item.subjectIndex !== selectedSubject && !p.item.mandatory
          ? "3 2"
          : null,
      );
    box
      .append("text")
      .attr("class", "g-name")
      .attr("x", 6)
      .attr("y", 15)
      .attr("fill", (p) =>
        isHighlighted(p.item.subjectIndex) ? textColor(p.item) : "#bdb6a8",
      )
      .text((p) =>
        truncate(
          subjects[p.item.subjectIndex].name,
          Math.floor((boxWidth - 10) / 5.9),
        ),
      );

    host.insertAdjacentHTML(
      "beforeend",
      `<p class="grid-key">Clique numa disciplina para destacar seus requisitos e as disciplinas que ela libera neste curso</p>`,
    );
  }

  // 7. Construção independente das três visualizações desta entrega
  function buildVisualizations() {
    hideTip();
    drawSimilarityMap();
    renderSubjectDetails();
    drawSubjectSimilarity();
    drawCurriculum();
  }

  let lastW = document.body.clientWidth;
  new ResizeObserver(() => {
    const w = document.body.clientWidth;
    if (Math.abs(w - lastW) > 30) {
      lastW = w;
      buildVisualizations();
    }
  }).observe(document.body);

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    buildVisualizations();
  });
})();
