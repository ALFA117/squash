interface Edge {
  from: string;
  to: string;
}

interface Node {
  id: string;
  initial: string;
  isYou?: boolean;
}

interface Props {
  nodes: Node[];
  /** Every pairwise obligation before netting — drawn faint. */
  grossEdges: Edge[];
  /** What actually moves — drawn bold, with arrowheads. */
  transfers: Edge[];
}

const W = 330;
const H = 248;
const CX = 165;
const CY = 118;
const R = 88;
const NODE_R = 20;

/** The tangle settles in first; the transfers cut through it afterwards. */
const TANGLE_MS = 500;
const DRAW_MS = 550;

/**
 * One picture of the compression: the faint web is what everyone owed each
 * other, the bold arrows are what is left. Positions are computed from the
 * party count, so the drawing follows the data instead of a fixed hexagon.
 *
 * The reveal is CSS, deliberately, and every element's RESTING state is the
 * finished drawing — the animation only supplies a starting point to travel
 * from. A graph parked at opacity 0 waiting on a JS frame is an invisible
 * graph the moment anything goes wrong: a throttled tab, a failed hydration,
 * a device that never gets around to painting. This is the one image the
 * whole product is explained by; it does not get to depend on that.
 *
 * `prefers-reduced-motion` is honoured globally in globals.css, which
 * collapses these to their end state rather than removing them.
 */
export function DebtGraph({ nodes, grossEdges, transfers }: Props) {
  const n = nodes.length;
  const at = new Map<string, { x: number; y: number }>();

  nodes.forEach((node, i) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    at.set(node.id, {
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    });
  });

  const trim = (from: string, to: string, startPad: number, endPad: number) => {
    const a = at.get(from)!;
    const b = at.get(to)!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: a.x + ux * startPad,
      y1: a.y + uy * startPad,
      x2: b.x - ux * endPad,
      y2: b.y - uy * endPad,
      length: Math.max(len - startPad - endPad, 1),
    };
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`${nodes.length} personas con ${grossEdges.length} deudas cruzadas comprimidas a ${transfers.length} transferencias`}
    >
      <defs>
        <marker
          id="squash-tip"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5.5"
          markerHeight="5.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--settled)" />
        </marker>
      </defs>

      <g stroke="var(--owed)" strokeWidth="1.1">
        {grossEdges.map((e, i) => {
          const a = at.get(e.from);
          const b = at.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={`g-${e.from}-${e.to}`}
              className="dg-edge"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              style={{ animationDelay: `${(i / grossEdges.length) * TANGLE_MS}ms` }}
            />
          );
        })}
      </g>

      <g stroke="var(--settled)" strokeWidth="2.4" fill="none" markerEnd="url(#squash-tip)">
        {transfers.map((t, i) => {
          if (!at.has(t.from) || !at.has(t.to)) return null;
          const { x1, y1, x2, y2, length } = trim(t.from, t.to, NODE_R, NODE_R + 4);
          return (
            <line
              key={`t-${t.from}-${t.to}`}
              className="dg-draw"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              style={
                {
                  strokeDasharray: length,
                  "--dg-len": `${length}`,
                  animationDelay: `${TANGLE_MS + 150 + i * 120}ms`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </g>

      {nodes.map((node, i) => {
        const p = at.get(node.id)!;
        return (
          <g
            key={node.id}
            className="dg-node"
            style={{
              transformOrigin: `${p.x}px ${p.y}px`,
              animationDelay: `${i * 45}ms`,
            }}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={NODE_R}
              fill={node.isYou ? "var(--ink)" : "var(--surface)"}
              stroke={node.isYou ? "var(--ink)" : "var(--rule)"}
              strokeWidth="1.2"
            />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontFamily="var(--f-body)"
              fontSize="12"
              fontWeight="500"
              fill={node.isYou ? "var(--surface)" : "var(--ink)"}
            >
              {node.initial}
            </text>
          </g>
        );
      })}

      <text
        x={CX}
        y={H - 6}
        textAnchor="middle"
        fontFamily="var(--f-mono)"
        fontSize="10.5"
        letterSpacing="0.8"
        fill="var(--muted)"
      >
        LO TENUE ES LO QUE SE DEBÍAN ANTES
      </text>
    </svg>
  );
}
