export type Point = { x: number; y: number };
export type GridNode = {
  x: number;
  y: number;
  walkable: boolean;
  cost: number; // For Dijkstra/A*
  distance: number;
  heuristic: number;
  parent: GridNode | null;
  state: 'unvisited' | 'open' | 'closed' | 'path';
};

// Heuristic for A* (Manhattan distance)
const heuristic = (a: GridNode, b: GridNode) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export class PathfindingGrid {
  width: number;
  height: number;
  nodes: GridNode[];

  constructor(width: number, height: number, obstacles: number = 0.2) {
    this.width = width;
    this.height = height;
    this.nodes = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.nodes.push({
          x,
          y,
          walkable: Math.random() > obstacles,
          cost: 1,
          distance: Infinity,
          heuristic: 0,
          parent: null,
          state: 'unvisited',
        });
      }
    }
  }

  getNode(x: number, y: number): GridNode | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.nodes[y * this.width + x];
  }

  getNeighbors(node: GridNode): GridNode[] {
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 1, y: 0 },  // Right
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }, // Left
    ];

    const neighbors: GridNode[] = [];
    for (const dir of directions) {
      const neighbor = this.getNode(node.x + dir.x, node.y + dir.y);
      if (neighbor && neighbor.walkable) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  reset() {
    this.nodes.forEach(node => {
      node.distance = Infinity;
      node.parent = null;
      node.state = 'unvisited';
    });
  }
}

// Generator functions to yield steps for visualization

export function* runAStar(grid: PathfindingGrid, start: Point, end: Point) {
  grid.reset();
  const startNode = grid.getNode(start.x, start.y);
  const endNode = grid.getNode(end.x, end.y);

  if (!startNode || !endNode || !startNode.walkable || !endNode.walkable) return;

  startNode.distance = 0;
  startNode.heuristic = heuristic(startNode, endNode);
  startNode.state = 'open';

  let openSet: GridNode[] = [startNode];

  while (openSet.length > 0) {
    // Sort by f-score (distance + heuristic) - naive priority queue
    openSet.sort((a, b) => (a.distance + a.heuristic) - (b.distance + b.heuristic));
    const current = openSet.shift()!;

    if (current === endNode) {
      // Reconstruct path
      let temp: GridNode | null = current;
      while (temp) {
        temp.state = 'path';
        temp = temp.parent;
      }
      yield grid.nodes.map(n => n.state); // Final update
      return;
    }

    current.state = 'closed';
    yield grid.nodes.map(n => n.state); // Yield current state

    const neighbors = grid.getNeighbors(current);
    for (const neighbor of neighbors) {
      if (neighbor.state === 'closed') continue;

      const tentDist = current.distance + neighbor.cost;
      if (tentDist < neighbor.distance) {
        neighbor.distance = tentDist;
        neighbor.heuristic = heuristic(neighbor, endNode);
        neighbor.parent = current;
        if (neighbor.state !== 'open') {
            neighbor.state = 'open';
            openSet.push(neighbor);
        }
      }
    }
    yield grid.nodes.map(n => n.state);
  }
}

export function* runDijkstra(grid: PathfindingGrid, start: Point, end: Point) {
    // Dijkstra is A* without heuristic
    grid.reset();
    const startNode = grid.getNode(start.x, start.y);
    const endNode = grid.getNode(end.x, end.y);
  
    if (!startNode || !endNode || !startNode.walkable || !endNode.walkable) return;
  
    startNode.distance = 0;
    startNode.state = 'open';
  
    let openSet: GridNode[] = [startNode];
  
    while (openSet.length > 0) {
      openSet.sort((a, b) => a.distance - b.distance);
      const current = openSet.shift()!;
  
      if (current === endNode) {
        let temp: GridNode | null = current;
        while (temp) {
          temp.state = 'path';
          temp = temp.parent;
        }
        yield grid.nodes.map(n => n.state);
        return;
      }
  
      current.state = 'closed';
      yield grid.nodes.map(n => n.state);
  
      const neighbors = grid.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (neighbor.state === 'closed') continue;
  
        const tentDist = current.distance + neighbor.cost;
        if (tentDist < neighbor.distance) {
          neighbor.distance = tentDist;
          neighbor.parent = current;
          if (neighbor.state !== 'open') {
              neighbor.state = 'open';
              openSet.push(neighbor);
          }
        }
      }
    }
}

export function* runBFS(grid: PathfindingGrid, start: Point, end: Point) {
    grid.reset();
    const startNode = grid.getNode(start.x, start.y);
    const endNode = grid.getNode(end.x, end.y);
    if (!startNode || !endNode) return;

    const queue: GridNode[] = [startNode];
    startNode.state = 'open';
    const visited = new Set<GridNode>();
    visited.add(startNode);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === endNode) {
             let temp: GridNode | null = current;
            while (temp) {
                temp.state = 'path';
                temp = temp.parent;
            }
            yield grid.nodes.map(n => n.state);
            return;
        }

        current.state = 'closed';
        yield grid.nodes.map(n => n.state);

        for (const neighbor of grid.getNeighbors(current)) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                neighbor.parent = current;
                neighbor.state = 'open';
                queue.push(neighbor);
            }
        }
    }
}

export function* runDFS(grid: PathfindingGrid, start: Point, end: Point) {
    grid.reset();
    const startNode = grid.getNode(start.x, start.y);
    const endNode = grid.getNode(end.x, end.y);
    if (!startNode || !endNode) return;

    const stack: GridNode[] = [startNode];
    const visited = new Set<GridNode>();
    
    // We don't mark start as visited immediately in stack-based DFS until popped,
    // or we can to avoid duplicates. Standard iterative DFS:
    
    while (stack.length > 0) {
        const current = stack.pop()!;
        
        if (current === endNode) {
             let temp: GridNode | null = current;
            while (temp) {
                temp.state = 'path';
                temp = temp.parent;
            }
            yield grid.nodes.map(n => n.state);
            return;
        }

        if (!visited.has(current)) {
            visited.add(current);
            current.state = 'closed';
             yield grid.nodes.map(n => n.state);

            const neighbors = grid.getNeighbors(current);
            // Randomize neighbors for cool maze effect? Or standard order.
            // Let's randomize to make it look "organic"
             neighbors.sort(() => Math.random() - 0.5);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    neighbor.parent = current;
                    stack.push(neighbor);
                    // Visualize visually as "open" (in stack)
                    neighbor.state = 'open'; 
                }
            }
        }
    }
}
