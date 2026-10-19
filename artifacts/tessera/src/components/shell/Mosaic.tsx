export default function Mosaic({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "next-mosaic tx-mosaic-sm" : "next-mosaic"} aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  );
}
