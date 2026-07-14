// Coloured indicator dot used next to phases, regions and languages.
export const Dot = ({ color, sz = 6 }) => (
  <span className="inline-block shrink-0 rounded-full" style={{ width: sz, height: sz, background: color }} />
);
