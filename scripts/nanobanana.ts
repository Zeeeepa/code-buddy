import fs from 'fs';
import path from 'path';

// This script simulates "Nanobanana", the tool requested to generate images.
// It generates SVG diagrams based on descriptions.

const IMAGES_DIR = path.join(process.cwd(), 'docs/livre/images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

interface DiagramSpec {
  name: string;
  type: 'box' | 'tree' | 'timeline' | 'pyramid' | 'spectrum' | 'flow';
  title: string;
  data: any;
}

const specs: DiagramSpec[] = [
  // Chapter 2
  {
    name: 'pyramide_ia',
    type: 'pyramid',
    title: 'Pyramide de l\'IA Appliquée',
    data: [
      { label: 'NIVEAU 4 : MULTI-AGENTS', detail: 'Collaboration', color: '#FF6B6B' },
      { label: 'NIVEAU 3 : AGENT AUTONOME', detail: 'Boucle autonome', color: '#4ECDC4' },
      { label: 'NIVEAU 2 : ASSISTANT AUGMENTÉ', detail: 'Aide l\'humain', color: '#45B7D1' },
      { label: 'NIVEAU 1 : CHATBOT', detail: 'Conversation simple', color: '#96CEB4' }
    ]
  },
  {
    name: 'spectre_autonomie',
    type: 'spectrum',
    title: 'Spectre de l\'Autonomie',
    data: {
      left: 'Aucune autonomie',
      right: 'Autonomie totale',
      steps: [
        { label: 'Chatbot', desc: 'L\'humain décide tout', x: 10 },
        { label: 'Assistant', desc: 'L\'humain guide', x: 35 },
        { label: 'Agent', desc: 'L\'humain supervise', x: 65 },
        { label: 'AGI?', desc: 'Autonomie complète', x: 90 }
      ]
    }
  },
  {
    name: 'chronologie_ia',
    type: 'timeline',
    title: 'Chronologie des Innovations 2020-2025',
    data: [
      { year: '2020', label: 'GPT-3', desc: 'Fondations' },
      { year: '2022', label: 'ChatGPT', desc: 'Grand Public' },
      { year: '2023', label: 'GPT-4 / AutoGPT', desc: 'Outils & Agents' },
      { year: '2024', label: 'Claude 3 / MCP', desc: 'Contexte & Standards' },
      { year: '2025', label: 'Grok-CLI', desc: 'Maturité Open Source' }
    ]
  },
  // Chapter 3
  {
    name: 'architecture_globale',
    type: 'box',
    title: 'Architecture Agent Cognitif',
    data: {
      nodes: [
        { id: 'UI', label: 'INTERFACE UTILISATEUR', x: 300, y: 50, w: 400, h: 60, type: 'input' },
        { id: 'ORCH', label: 'ORCHESTRATEUR', x: 300, y: 150, w: 400, h: 60, type: 'core' },
        { id: 'REAS', label: 'REASONING', x: 100, y: 300, w: 120, h: 80, type: 'component' },
        { id: 'MEM', label: 'MEMORY', x: 230, y: 300, w: 120, h: 80, type: 'component' },
        { id: 'ACT', label: 'ACTION', x: 360, y: 300, w: 120, h: 80, type: 'component' },
        { id: 'LEARN', label: 'LEARNING', x: 490, y: 300, w: 120, h: 80, type: 'component' },
        { id: 'SEC', label: 'SECURITY', x: 620, y: 300, w: 120, h: 80, type: 'component' },
        { id: 'PERS', label: 'PERSISTANCE', x: 300, y: 450, w: 600, h: 60, type: 'storage' }
      ],
      edges: [
        { from: 'UI', to: 'ORCH' },
        { from: 'ORCH', to: 'REAS' },
        { from: 'ORCH', to: 'MEM' },
        { from: 'ORCH', to: 'ACT' },
        { from: 'ORCH', to: 'LEARN' },
        { from: 'ORCH', to: 'SEC' },
        { from: 'REAS', to: 'PERS' },
        { from: 'MEM', to: 'PERS' },
        { from: 'ACT', to: 'PERS' },
        { from: 'LEARN', to: 'PERS' },
        { from: 'SEC', to: 'PERS' }
      ]
    }
  },
  {
    name: 'boucle_react',
    type: 'flow',
    title: 'Boucle Agentique ReAct',
    data: {
      steps: ['PERCEIVE', 'THINK', 'DECIDE', 'ACT', 'OBSERVE'],
      loop: true
    }
  },
  {
    name: 'pipeline_rag',
    type: 'flow',
    title: 'Pipeline RAG Moderne',
    data: {
      steps: ['QUERY', 'EMBED', 'SEARCH', 'EXPAND', 'RERANK', 'CONTEXT'],
      loop: false
    }
  },
    {
    name: 'flux_execution_outil',
    type: 'flow',
    title: 'Flux Execution Outil',
    data: {
      steps: ['REQUEST', 'VALIDATE', 'SECURITY CHECK', 'CONFIRMATION', 'EXECUTE', 'RESULT'],
      loop: false
    }
  },
  // Chapter 4
  {
    name: 'tot_vs_cot',
    type: 'tree',
    title: 'Tree-of-Thought vs Linear',
    data: {
      root: 'Problème',
      children: [
        { label: 'Piste A (0.3)', children: [{ label: 'Échec', color: 'red' }] },
        { label: 'Piste B (0.7)', children: [
            { label: 'B.1 (0.4)', color: 'red' },
            { label: 'B.2 (0.9)', color: 'green', children: [{label: 'Solution', color: 'green'}] }
        ] }
      ]
    }
  }
];

function generateSVG(spec: DiagramSpec): string {
  const width = 800;
  const height = spec.type === 'box' ? 600 : 400;

  let content = '';

  const style = `
    <style>
      .text { font-family: sans-serif; fill: #eee; }
      .title { font-size: 24px; font-weight: bold; text-anchor: middle; fill: #fff; }
      .label { font-size: 14px; text-anchor: middle; }
      .desc { font-size: 10px; fill: #aaa; text-anchor: middle; }
      .box { fill: #2d2d2d; stroke: #4ECDC4; stroke-width: 2; }
      .line { stroke: #666; stroke-width: 2; }
    </style>
  `;

  if (spec.type === 'pyramid') {
    const levels = spec.data.length;
    content = spec.data.map((item: any, i: number) => {
      const y = 50 + i * (300 / levels);
      const w = 200 + i * 100;
      const x = (width - w) / 2;
      const h = 300 / levels;
      return `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${item.color}" opacity="0.8" />
        <text x="${width/2}" y="${y + h/2}" class="text label" fill="black" style="fill: black; font-weight: bold;">${item.label}</text>
        <text x="${width/2}" y="${y + h/2 + 15}" class="text desc" fill="#333" style="fill: #333;">${item.detail}</text>
      `;
    }).join('');
  } else if (spec.type === 'spectrum') {
    content = `
      <line x1="50" y1="200" x2="750" y2="200" stroke="#fff" stroke-width="4" />
      <text x="50" y="230" class="text" text-anchor="start">${spec.data.left}</text>
      <text x="750" y="230" class="text" text-anchor="end">${spec.data.right}</text>
      ${spec.data.steps.map((step: any) => `
        <circle cx="${50 + (step.x/100)*700}" cy="200" r="10" fill="#4ECDC4" />
        <text x="${50 + (step.x/100)*700}" y="180" class="text label">${step.label}</text>
        <text x="${50 + (step.x/100)*700}" y="250" class="text desc">${step.desc}</text>
      `).join('')}
    `;
  } else if (spec.type === 'timeline') {
    content = `
      <line x1="50" y1="200" x2="750" y2="200" stroke="#666" stroke-width="4" />
      ${spec.data.map((item: any, i: number) => {
        const x = 50 + i * (700 / (spec.data.length - 1));
        return `
          <circle cx="${x}" cy="200" r="8" fill="#FF6B6B" />
          <text x="${x}" y="170" class="text label" style="font-weight: bold;">${item.year}</text>
          <text x="${x}" y="190" class="text label">${item.label}</text>
          <text x="${x}" y="230" class="text desc">${item.desc}</text>
        `;
      }).join('')}
    `;
  } else if (spec.type === 'box') {
     content = `
       ${spec.data.edges.map((edge: any) => {
         const fromNode = spec.data.nodes.find((n: any) => n.id === edge.from);
         const toNode = spec.data.nodes.find((n: any) => n.id === edge.to);
         if (!fromNode || !toNode) return '';
         const x1 = fromNode.x + fromNode.w/2;
         const y1 = fromNode.y + fromNode.h;
         const x2 = toNode.x + toNode.w/2;
         const y2 = toNode.y;
         return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="line" marker-end="url(#arrowhead)" />`;
       }).join('')}
       ${spec.data.nodes.map((node: any) => `
         <rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" class="box" rx="5" />
         <text x="${node.x + node.w/2}" y="${node.y + node.h/2 + 5}" class="text label">${node.label}</text>
       `).join('')}
     `;
  } else if (spec.type === 'flow') {
    const stepWidth = 120;
    const gap = 30;
    const startX = (width - (spec.data.steps.length * (stepWidth + gap))) / 2;

    content = spec.data.steps.map((step: string, i: number) => {
       const x = startX + i * (stepWidth + gap);
       return `
         <rect x="${x}" y="150" width="${stepWidth}" height="60" class="box" fill="#333" />
         <text x="${x + stepWidth/2}" y="185" class="text label">${step}</text>
         ${i < spec.data.steps.length - 1 ?
           `<line x1="${x + stepWidth}" y1="180" x2="${x + stepWidth + gap}" y2="180" class="line" marker-end="url(#arrowhead)" />` : ''}
       `;
    }).join('');

    if (spec.data.loop) {
        // Draw loop back line
        const endX = startX + spec.data.steps.length * (stepWidth + gap) - gap;
        content += `
            <path d="M ${endX} 210 Q ${endX} 280, ${width/2} 280 Q ${startX} 280, ${startX + stepWidth/2} 210" fill="none" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)" />
        `;
    }
  } else if (spec.type === 'tree') {
      // Simplified tree rendering
      content = `
        <rect x="350" y="50" width="100" height="40" class="box" />
        <text x="400" y="75" class="text label">${spec.data.root}</text>

        <line x1="400" y1="90" x2="200" y2="150" class="line" />
        <line x1="400" y1="90" x2="600" y2="150" class="line" />

        <rect x="150" y="150" width="100" height="40" class="box" />
        <text x="200" y="175" class="text label">${spec.data.children[0].label}</text>

        <rect x="550" y="150" width="100" height="40" class="box" />
        <text x="600" y="175" class="text label">${spec.data.children[1].label}</text>

        <line x1="150" y1="170" x2="150" y2="200" class="line" stroke="red"/>

        <line x1="600" y1="190" x2="500" y2="250" class="line" />
        <line x1="600" y1="190" x2="700" y2="250" class="line" />

        <rect x="450" y="250" width="100" height="40" class="box" stroke="red"/>
        <text x="500" y="275" class="text label">${spec.data.children[1].children[0].label}</text>

        <rect x="650" y="250" width="100" height="40" class="box" stroke="green" stroke-width="3"/>
        <text x="700" y="275" class="text label">${spec.data.children[1].children[1].label}</text>
      `;
  }

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#1a1a1a" />
  ${style}
  <text x="${width/2}" y="30" class="title">${spec.title}</text>
  ${content}
</svg>
  `.trim();
}

console.log(`Generating ${specs.length} images...`);

specs.forEach(spec => {
  const svg = generateSVG(spec);
  const filepath = path.join(IMAGES_DIR, `${spec.name}.svg`);
  fs.writeFileSync(filepath, svg);
  console.log(`Generated ${filepath}`);
});

console.log('Done!');
