export interface Word {
  surface: string;
  tag: string;
}

interface Pair {
  key: [string, string];
  value: number;
}

class WordPair {
  map: Pair[];

  constructor() {
    this.map = [];
  }

  set(key: [string, string], value: number): void {
    for (const item of this.map) {
      if (item.key[0] === key[0] && item.key[1] === key[1]) {
        item.value = value;
        return;
      }
    }
    this.map.push({ key: key, value: value });
  }

  get(key: [string, string]): number {
    for (const item of this.map) {
      if (item.key[0] === key[0] && item.key[1] === key[1]) {
        return item.value;
      }
    }
    return undefined;
  }

  entries(): Pair[] {
    return this.map;
  }
}

class TextRankGraph {
  graph: Map<string, [string, string, number][]> = new Map();
  d = 0.85;
  min_diff = 1e-5;
  steps = 10;

  addEdge(start: string, end: string, weight: number): void {
    (this.graph.get(start) || this.graph.set(start, []).get(start)).push([
      start,
      end,
      weight,
    ]);
    (this.graph.get(end) || this.graph.set(end, []).get(end)).push([
      end,
      start,
      weight,
    ]);
  }

  rank(): Map<string, number> {
    const defaultWeight = 1.0 / (this.graph.size || 1.0);
    const nodeweight: Map<string, number> = new Map();
    const outsumNode: Map<string, number> = new Map();

    for (const [node, outEdge] of this.graph.entries()) {
      nodeweight.set(node, defaultWeight);
      outsumNode.set(
        node,
        outEdge.reduce<number>((acc, cur) => acc + cur[2], 0.0)
      );
    }
    const sortedKeys = Array.from(this.graph.keys()).sort();
    const stepDict = [0];
    for (let step = 0; step < this.steps; ++step) {
      for (const node of sortedKeys) {
        let s = 0.0;
        for (const e of this.graph.get(node)) {
          s += (e[2] / outsumNode.get(e[1])) * nodeweight.get(e[1]);
        }
        nodeweight.set(node, 1 - this.d + this.d * s);
      }
      stepDict.push(
        Array.from(nodeweight.values()).reduce((acc, cur) => acc + cur)
      );

      if (Math.abs(stepDict[step] - stepDict[step - 1]) <= this.min_diff) break;
    }
    let [minRank, maxRank] = [0, 0];
    for (const w of nodeweight.values()) {
      if (w < minRank) minRank = w;
      if (w > maxRank) maxRank = w;
    }
    for (const [n, w] of nodeweight.entries()) {
      console.log((w - minRank / 10.0) / (maxRank - minRank / 10.0));
      nodeweight.set(n, (w - minRank / 10.0) / (maxRank - minRank / 10.0));
    }
    console.log(nodeweight);
    return nodeweight;
  }
}

export default class TextRank {
  stopWords: Word[] = [
    {
      surface: "있",
      tag: "VV",
    },
    {
      surface: "하",
      tag: "VV",
    },
    {
      surface: "되",
      tag: "VV",
    },
    {
      surface: "없",
      tag: "VV",
    },
    {
      surface: "보",
      tag: "VV",
    },
  ]; // stop words
  candi_tags: string[] = ["NNG", "NNP", "VV", "VA"]; // candidate tags
  w: number; // window size

  constructor(windowSize = 5) {
    this.w = windowSize;
  }

  extractKeywords(wordList: Word[], numKeywords: number): [string, number][] {
    const g = new TextRankGraph();
    const cm = new WordPair();
    for (let i = 0; i < wordList.length; ++i) {
      const word = wordList[i];
      if (this.candi_tags.includes(word.tag) && word.surface.length > 1) {
        for (let j = i + 1; j < i + this.w; ++j) {
          if (j >= wordList.length) break;
          if (
            !this.candi_tags.includes(wordList[j].tag) ||
            this.stopWords.filter(
              (word) =>
                word.surface === wordList[j].surface &&
                word.tag === wordList[j].tag
            ).length > 0 ||
            wordList[j].surface.length < 2
          ) {
            continue;
          }
          const pair: [string, string] = [word.surface, wordList[j].surface];
          cm.set(pair, (cm.get(pair) || 0) + 1);
        }
      }
    }
    for (const entry of cm.entries()) {
      g.addEdge(entry.key[0], entry.key[1], entry.value);
    }
    return Array.from(g.rank().entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, numKeywords);
  }
}
