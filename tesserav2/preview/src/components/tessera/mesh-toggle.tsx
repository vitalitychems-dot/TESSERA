import { useState } from "react";

/** Visible owner switch for the install's mesh node. Default OFF. */
export function MeshToggle(props: { initial?: boolean; onChange: (on: boolean) => void }) {
  const [on, setOn] = useState(props.initial ?? false);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        role="switch"
        aria-checked={on}
        checked={on}
        onChange={(e) => { setOn(e.target.checked); props.onChange(e.target.checked); }}
      />
      <span>Mesh node {on ? "ON — sharing cached pages on this LAN" : "OFF — nothing is sent"}</span>
    </label>
  );
}
