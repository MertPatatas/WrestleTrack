// Quitar cuando los datos sean reales.
export function SampleNotice({
  text = 'Datos de ejemplo. Los reales llegarán con el backend.',
}: {
  text?: string;
}) {
  return <p className="muted small notice">{text}</p>;
}
