import { encode } from "uqr";

const QUIET_ZONE = 2;

/** مسار SVG واحد لكل الوحدات الداكنة: مربع 1×1 عند كل وحدة. */
function modulesPath(data: readonly (readonly boolean[])[]): string {
  const parts: string[] = [];
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        parts.push(`M${String(x)} ${String(y)}h1v1h-1z`);
      }
    });
  });
  return parts.join("");
}

interface QrCodeProps {
  readonly value: string;
  readonly label: string;
  readonly className: string | undefined;
}

/**
 * رمز QR يُرسم على الخادم عناصرَ SVG (بلا صورة خارجية ولا innerHTML ولا سكربت)، فسر التسجيل لا يغادر
 * الخادم إلا في هذه الصفحة. اللون من الصنف الممرَّر (أسود على أبيض) بهامش هادئ ليقرأه أي تطبيق تحقق.
 */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { data, size } = encode(value, { ecc: "M", border: QUIET_ZONE });
  return (
    <svg
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label}
      className={className}
      shapeRendering="crispEdges"
    >
      <path d={modulesPath(data)} fill="currentColor" />
    </svg>
  );
}
