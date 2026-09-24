// Quad Tree  (Processing Round 3/Quad_Tree)
//
// A point quadtree with capacity 1, drawn with its node boundaries (the
// original had the boundary drawing commented out; here it's the point) so
// the tree visibly subdivides as points keep arriving. Points arrive around a
// few slowly wandering hotspots plus some uniform scatter; after a few hundred
// the tree is cleared and starts again.
//
// A 50x50-style query box highlights (green) the points it finds via the
// classic range query: it follows the mouse when someone is using the page,
// otherwise it sweeps a slow Lissajous path.

const INSERT_EVERY = 2; // frames
const MAX_POINTS = 650;
const HOLD_FRAMES = 150;

class Rect {
  constructor(x, y, w, h) {
    Object.assign(this, { x, y, w, h });
  }
  contains(pt) {
    return pt.x >= this.x - this.w / 2 && pt.x <= this.x + this.w / 2 && pt.y >= this.y - this.h / 2 && pt.y <= this.y + this.h / 2;
  }
  intersects(r) {
    return !(
      r.x - r.w / 2 > this.x + this.w / 2 ||
      r.x + r.w / 2 < this.x - this.w / 2 ||
      r.y + r.h / 2 < this.y - this.h / 2 ||
      r.y - r.h / 2 > this.y + this.h / 2
    );
  }
}

class QuadTree {
  constructor(boundary, capacity) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
  }
  insert(pt) {
    if (this.points.length < this.capacity) {
      this.points.push(pt);
      return;
    }
    if (!this.divided) this.subdivide();
    for (const q of [this.northeast, this.northwest, this.southeast, this.southwest]) {
      if (q.boundary.contains(pt)) {
        q.insert(pt);
        return;
      }
    }
  }
  subdivide() {
    const { x, y, w, h } = this.boundary;
    this.northeast = new QuadTree(new Rect(x + w / 4, y - h / 4, w / 2, h / 2), this.capacity);
    this.northwest = new QuadTree(new Rect(x - w / 4, y - h / 4, w / 2, h / 2), this.capacity);
    this.southeast = new QuadTree(new Rect(x + w / 4, y + h / 4, w / 2, h / 2), this.capacity);
    this.southwest = new QuadTree(new Rect(x - w / 4, y + h / 4, w / 2, h / 2), this.capacity);
    this.divided = true;
  }
  query(range, found) {
    if (!this.boundary.intersects(range)) return found;
    for (const pt of this.points) if (range.contains(pt)) found.push(pt);
    if (this.divided) {
      this.northeast.query(range, found);
      this.northwest.query(range, found);
      this.southeast.query(range, found);
      this.southwest.query(range, found);
    }
    return found;
  }
  eachNode(fn) {
    fn(this);
    if (this.divided) {
      this.northeast.eachNode(fn);
      this.northwest.eachNode(fn);
      this.southeast.eachNode(fn);
      this.southwest.eachNode(fn);
    }
  }
}

export default function quadTree(p) {
  let qt;
  let count = 0;
  let hotspots = [];
  let hold = 0;
  let t = 0;
  let qx = 0;
  let qy = 0;

  function reset() {
    qt = new QuadTree(new Rect(p.width / 2, p.height / 2, p.width, p.height), 1);
    count = 0;
    hold = 0;
    hotspots = Array.from({ length: 3 }, () => ({
      seed: Math.random() * 1000,
      spread: Math.min(p.width, p.height) * (0.04 + Math.random() * 0.08),
    }));
  }

  function nextPoint() {
    if (Math.random() < 0.3) return { x: Math.random() * p.width, y: Math.random() * p.height };
    const h = hotspots[Math.floor(Math.random() * hotspots.length)];
    const cx = p.noise(h.seed, t * 0.002) * p.width;
    const cy = p.noise(h.seed + 50, t * 0.002) * p.height;
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
    return {
      x: Math.min(p.width - 1, Math.max(0, cx + g() * h.spread)),
      y: Math.min(p.height - 1, Math.max(0, cy + g() * h.spread)),
    };
  }

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    reset();
  };

  p.draw = () => {
    t++;
    if (count < MAX_POINTS) {
      if (t % INSERT_EVERY === 0) {
        qt.insert(nextPoint());
        count++;
      }
    } else if (++hold > HOLD_FRAMES) {
      reset();
    }

    const size = Math.max(38, Math.min(p.width, p.height) * 0.105);
    if (p.interactive()) {
      qx = p.mouseX;
      qy = p.mouseY;
    } else {
      qx = p.width / 2 + Math.sin(t * 0.0071) * p.width * 0.36;
      qy = p.height / 2 + Math.sin(t * 0.0113 + 1) * p.height * 0.34;
    }
    const range = new Rect(qx, qy, size, size);

    const ctx = p.drawingContext;
    p.background(0);

    // boundaries
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    qt.eachNode((n) => {
      if (!n.divided) return;
      const { x, y, w, h } = n.boundary;
      ctx.moveTo(x - w / 2, y + 0.5);
      ctx.lineTo(x + w / 2, y + 0.5);
      ctx.moveTo(x + 0.5, y - h / 2);
      ctx.lineTo(x + 0.5, y + h / 2);
    });
    ctx.stroke();

    // points
    ctx.fillStyle = '#fff';
    qt.eachNode((n) => {
      for (const pt of n.points) ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    });

    // query
    const found = qt.query(range, []);
    ctx.strokeStyle = 'rgb(0,255,0)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(qx - size / 2, qy - size / 2, size, size);
    ctx.fillStyle = 'rgb(0,255,0)';
    for (const pt of found) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    reset();
  };
}
