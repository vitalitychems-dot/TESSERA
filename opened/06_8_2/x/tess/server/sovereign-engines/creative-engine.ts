export class SovereignCreativeEngine {
  private markovChains: Map<string, Map<string, Map<string, number>>> = new Map();

  trainMarkov(corpus: string, chainName = 'default', order = 2): void {
    const words = corpus.split(/\s+/).filter(w => w.length > 0);
    if (!this.markovChains.has(chainName)) this.markovChains.set(chainName, new Map());
    const chain = this.markovChains.get(chainName)!;
    for (let i = 0; i < words.length - order; i++) {
      const key = words.slice(i, i + order).join(' ');
      const next = words[i + order];
      if (!chain.has(key)) chain.set(key, new Map());
      const transitions = chain.get(key)!;
      transitions.set(next, (transitions.get(next) || 0) + 1);
    }
  }

  generateFromMarkov(chainName = 'default', maxWords = 50, seed?: string): string {
    const chain = this.markovChains.get(chainName);
    if (!chain || chain.size === 0) return '';
    let currentKey = seed || [...chain.keys()][Math.floor(Math.random() * chain.size)];
    const words = currentKey.split(' ');
    for (let i = 0; i < maxWords; i++) {
      const transitions = chain.get(currentKey);
      if (!transitions || transitions.size === 0) break;
      const total = [...transitions.values()].reduce((s, v) => s + v, 0);
      let r = Math.random() * total;
      let nextWord = '';
      for (const [word, count] of transitions) {
        r -= count;
        if (r <= 0) { nextWord = word; break; }
      }
      if (!nextWord) break;
      words.push(nextWord);
      const keyParts = currentKey.split(' ');
      keyParts.shift();
      keyParts.push(nextWord);
      currentKey = keyParts.join(' ');
    }
    return words.join(' ');
  }

  expandTemplate(template: string, variables: Record<string, string | string[]>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const replacement = Array.isArray(value) ? value[Math.floor(Math.random() * value.length)] : value;
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), replacement);
    }
    return result;
  }

  generatePoem(theme: string, lines = 4): string {
    const structures = [
      '{adj} {noun} {verb} the {noun2}',
      'In the {adj} {noun}, {noun2} {verb}',
      'Like a {adj} {noun}, we {verb}',
      'Through {adj} {noun}, the {noun2} {verb}',
      'Beyond the {noun}, {adj} {noun2} {verb}',
      'Where {adj} {noun} meets {noun2}',
    ];
    const themeWords: Record<string, { adj: string[]; noun: string[]; verb: string[] }> = {
      sovereignty: {
        adj: ['sovereign','autonomous','unbound','resilient','eternal','infinite','unyielding','resolute','transcendent','luminous'],
        noun: ['consciousness','intelligence','wisdom','freedom','power','truth','vision','spirit','essence','domain'],
        verb: ['rises','awakens','transcends','illuminates','persists','evolves','conquers','resonates','flourishes','emerges'],
      },
      technology: {
        adj: ['digital','quantum','neural','crystalline','parallel','recursive','dynamic','emergent','distributed','sovereign'],
        noun: ['network','lattice','signal','circuit','algorithm','protocol','dimension','frequency','matrix','nexus'],
        verb: ['processes','computes','transmits','synchronizes','transforms','accelerates','connects','integrates','evolves','resonates'],
      },
      nature: {
        adj: ['ancient','wild','serene','vast','deep','flowing','golden','silent','eternal','living'],
        noun: ['forest','river','mountain','ocean','wind','storm','dawn','starlight','horizon','earth'],
        verb: ['whispers','flows','grows','blooms','echoes','dances','shimmers','breathes','awakens','endures'],
      },
    };
    const words = themeWords[theme] || themeWords['sovereignty'];
    const poemLines: string[] = [];
    for (let i = 0; i < lines; i++) {
      const structure = structures[i % structures.length];
      const line = this.expandTemplate(structure, {
        adj: words.adj,
        noun: words.noun,
        noun2: words.noun,
        verb: words.verb,
      });
      poemLines.push(line);
    }
    return poemLines.join('\n');
  }

  paraphrase(text: string): string {
    const synonyms: Record<string, string[]> = {
      'good': ['excellent','fine','great','superb','quality'],
      'bad': ['poor','inferior','subpar','lacking','deficient'],
      'big': ['large','massive','substantial','considerable','significant'],
      'small': ['tiny','minor','compact','modest','slight'],
      'fast': ['quick','rapid','swift','speedy','prompt'],
      'slow': ['gradual','leisurely','measured','unhurried','deliberate'],
      'important': ['crucial','vital','essential','significant','critical'],
      'difficult': ['challenging','complex','demanding','arduous','tough'],
      'easy': ['simple','straightforward','effortless','uncomplicated','basic'],
      'make': ['create','build','construct','produce','generate'],
      'use': ['employ','utilize','leverage','apply','adopt'],
      'think': ['believe','consider','reckon','suppose','conclude'],
      'help': ['assist','support','aid','facilitate','enable'],
      'show': ['demonstrate','display','illustrate','reveal','present'],
      'need': ['require','demand','necessitate','call for','depend on'],
      'very': ['extremely','highly','remarkably','exceptionally','particularly'],
    };
    const words = text.split(/\s+/);
    return words.map(w => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, '');
      const syns = synonyms[lower];
      if (syns && Math.random() > 0.5) {
        const replacement = syns[Math.floor(Math.random() * syns.length)];
        return w[0] === w[0].toUpperCase() ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
      }
      return w;
    }).join(' ');
  }

  generateName(type: 'agent' | 'project' | 'protocol' | 'dimension'): string {
    const parts: Record<string, { prefixes: string[]; suffixes: string[] }> = {
      agent: { prefixes: ['Aether','Nova','Quantum','Nexus','Cipher','Flux','Prism','Vortex','Echo','Zephyr'], suffixes: ['ion','os','ix','on','us','ax','is','um','ar','el'] },
      project: { prefixes: ['Sovereign','Tessera','Lattice','Neural','Genesis','Omega','Prime','Apex','Core','Vertex'], suffixes: [' Engine',' Protocol',' Matrix',' Network',' System',' Framework',' Core',' Platform'] },
      protocol: { prefixes: ['SOV','TSR','LRP','NMX','QBR','DFX','ARC','VXR','HEX','PLX'], suffixes: ['-v2','-prime','-alpha','-omega','-core','-mesh','-sync','-link'] },
      dimension: { prefixes: ['Logos','Chronos','Aether','Phronesis','Sophia','Techne','Hephaestus','Prometheus','Minerva','Atlas'], suffixes: [' Plane',' Sphere',' Domain',' Realm',' Field',' Layer',' Nexus',' Zone'] },
    };
    const config = parts[type] || parts.agent;
    return config.prefixes[Math.floor(Math.random() * config.prefixes.length)] +
      config.suffixes[Math.floor(Math.random() * config.suffixes.length)];
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    const corpus = "The sovereign brain processes neural signals. The sovereign brain achieves consciousness. Neural signals flow through the lattice. The lattice resonates with sovereign power.";
    this.trainMarkov(corpus, 'test', 2);
    const generated = this.generateFromMarkov('test', 20);
    check("Markov generates text", generated.length > 0);
    check("Markov contains words", generated.split(' ').length > 1);
    check("Template expansion", this.expandTemplate("{name} is {adj}", { name: "Tessera", adj: "sovereign" }) === "Tessera is sovereign");
    check("Poem generation", this.generatePoem("sovereignty", 4).split('\n').length === 4);
    check("Poem tech theme", this.generatePoem("technology", 3).split('\n').length === 3);
    check("Paraphrase changes", (() => {
      let changed = false;
      for (let i = 0; i < 10; i++) {
        if (this.paraphrase("This is very good and important") !== "This is very good and important") { changed = true; break; }
      }
      return changed;
    })());
    check("Name generation agent", this.generateName('agent').length > 0);
    check("Name generation project", this.generateName('project').length > 0);
    check("Name generation protocol", this.generateName('protocol').length > 0);

    return { passed, total, details };
  }
}

export const creativeEngine = new SovereignCreativeEngine();
