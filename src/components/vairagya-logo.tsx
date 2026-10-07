import mark from "@/assets/vairagya-mark.png";

export function VairagyaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Vairagya">
      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card">
        <img src={mark} alt="" className="h-5 w-5 object-contain" />
      </span>
      {!compact && <span className="text-[13px] font-semibold uppercase tracking-[0.18em]">Vairagya</span>}
    </span>
  );
}