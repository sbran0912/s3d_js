// Ambient-Deklaration fuer das Einbetten von OBJ-Dateien als Text.
// Nur fuer Editor/Typcheck gedacht - der Bun-Build benoetigt sie nicht.
declare module "*.obj" {
  const text: string;
  export default text;
}
