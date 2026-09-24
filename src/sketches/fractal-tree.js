// Fractal Tree  (Processing Android/fractalTreeWallpaper)
//
// The original Android live wallpaper maps the branch angle to mouseX. That
// carries over when someone is actually moving the mouse; otherwise the angle
// sways slowly on its own so the tree breathes as a wallpaper.
//
// Scaling note: the original used branchFraction = (height/10)/100, which
// only works at its 800px height (0.8) and would recurse forever on taller
// screens, so the 0.8 ratio is kept fixed and sizes scale with height.

const TALLER = 1.25;

export default function fractalTree(p) {
  let angle = Math.PI / 8;
  let smallest;
  let initBranchSize;
  const branchFraction = 0.8;
  let t = 0;

  function sizes() {
    // 25% taller than the original: longer trunk, everything else in proportion
    const k = (p.height / 800) * TALLER;
    initBranchSize = (p.height / 10) * TALLER;
    smallest = 10 * k;
  }

  function branch(len) {
    if (len <= smallest) return;
    p.line(0, 0, 0, -len);
    p.push();
    p.translate(0, -len);
    p.rotate(angle);
    branch(len * branchFraction);
    p.pop();
    p.push();
    p.translate(0, -len);
    p.rotate(-angle);
    branch(len * branchFraction);
    p.pop();
  }

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    sizes();
  };

  p.draw = () => {
    if (p.interactive()) {
      const target = p.map(p.mouseX, 0, p.width, 0, Math.PI / 4, true);
      angle += (target - angle) * 0.25;
    } else {
      t += 1 / 30;
      // slow sway across the same 0..PI/4 range the mouse covers
      const target = Math.PI / 8 + Math.sin(t * 0.18) * (Math.PI / 10) + Math.sin(t * 0.07) * (Math.PI / 40);
      angle += (target - angle) * 0.1;
    }

    p.background(51);
    p.stroke(255);
    p.strokeWeight(Math.max(1.5, 2 * (p.height / 800)));
    const stub = 50 * (p.height / 800) * TALLER;
    p.translate(p.width / 2, p.height - stub);
    p.line(0, 0, 0, stub);
    branch(initBranchSize);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    sizes();
  };
}
