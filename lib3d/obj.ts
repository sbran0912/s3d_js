// ====================================================================
// MESH-LADEN (Wavefront OBJ)
//
// Nur das Laden externer Geometrie. Es gibt bewusst KEINE Bau-/Speicher-
// Funktionen in der Bibliothek - Meshes werden ausserhalb erzeugt (Editor wie
// Blender oder ein eigenes Skript) und hier eingelesen.
//
// Anders als in der C++-/Go-Fassung laeuft die Bibliothek im Browser, kennt
// daher kein Dateisystem. "Von der Festplatte laden" heisst hier: per HTTP
// holen (loadObj -> fetch). Der reine Parser (parseObj) ist synchron und
// damit ohne Browser/GL testbar.
// ====================================================================

import type { Mesh } from "./mesh";

/**
 * parseObj parst Wavefront-OBJ-Text in die flache Mesh-Darstellung:
 *
 *  - "v x y z"  -> Vertex-Pool
 *  - "f ..."    -> triangles (Dreiecke 1:1, Polygone per Fan-Triangulierung)
 *  - "l ..."    -> lines (aufeinanderfolgende Paare)
 *
 * Kommentare (#) und unbekannte Direktiven (vn, vt, g, o, s, mtllib, usemtl,
 * ...) werden ignoriert. Indizes duerfen 1-basiert und negativ sein; die
 * a/b/c-Schreibweise (Vertex/UV/Normal) wird akzeptiert, UV/Normal-Teile
 * bleiben unberuecksichtigt.
 *
 * Die Koordinaten bleiben unveraendert (OBJ ist typischerweise Y-up). Die
 * Dreiecke koennen direkt fuer bodies (buildFaces/makeBody) verwendet werden.
 */
export function parseObj(text: string): Mesh {
  const verts: { x: number; y: number; z: number }[] = [];
  const mesh: Mesh = { triangles: [], lines: [] };

  // Zeilenumbrueche normalisieren (Windows CRLF).
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const fields = line.split(/\s+/);
    switch (fields[0]) {
      case "v": {
        if (fields.length < 4) {
          throw new Error(`OBJ Zeile ${lineNo}: unvollstaendiger Vertex`);
        }
        const x = Number(fields[1]);
        const y = Number(fields[2]);
        const z = Number(fields[3]);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
          throw new Error(`OBJ Zeile ${lineNo}: ungueltiger Vertex`);
        }
        verts.push({ x, y, z });
        break;
      }

      case "f": {
        const idx = objIndices(fields.slice(1), verts.length, lineNo);
        // Fan-Triangulierung: (0, j, j+1) fuer j = 1 .. n-2.
        for (let j = 1; j + 1 < idx.length; j++) {
          const a = verts[idx[0]];
          const b = verts[idx[j]];
          const c = verts[idx[j + 1]];
          mesh.triangles.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        }
        break;
      }

      case "l": {
        const idx = objIndices(fields.slice(1), verts.length, lineNo);
        // Aufeinanderfolgende Paare: (j, j+1).
        for (let j = 0; j + 1 < idx.length; j++) {
          const a = verts[idx[j]];
          const b = verts[idx[j + 1]];
          mesh.lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
        break;
      }

      default:
        // vn, vt, g, o, s, mtllib, usemtl, ... ignorieren.
        break;
    }
  }

  return mesh;
}

/**
 * loadObj laedt ein OBJ per HTTP (fetch) und parst es. Browser koennen keine
 * Dateien synchron lesen, daher asynchron.
 */
export async function loadObj(url: string): Promise<Mesh> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OBJ "${url}" konnte nicht geladen werden (HTTP ${res.status})`);
  }
  return parseObj(await res.text());
}

/**
 * objIndices parst Face-/Line-Tokens ("i", "i/j", "i/j/k", "i//k") in
 * 0-basierte Vertex-Indizes. vertexCount ist die Anzahl der bisher gelesenen
 * Vertices (fuer negative Indizes und die Bereichspruefung).
 */
function objIndices(tokens: string[], vertexCount: number, lineNo: number): number[] {
  const idx: number[] = [];
  for (const tok of tokens) {
    const slash = tok.indexOf("/");
    const s = slash >= 0 ? tok.slice(0, slash) : tok; // UV/Normal-Teil abschneiden
    if (s === "") {
      throw new Error(`OBJ Zeile ${lineNo}: ungueltiger Index "${tok}"`);
    }
    const raw = Number(s);
    if (!Number.isInteger(raw)) {
      throw new Error(`OBJ Zeile ${lineNo}: ungueltiger Index "${tok}"`);
    }
    let n = raw < 0 ? vertexCount + raw : raw - 1; // negativ: vom Ende; sonst 1-basiert
    if (n < 0 || n >= vertexCount) {
      throw new Error(`OBJ Zeile ${lineNo}: Index "${tok}" ausserhalb des Bereichs`);
    }
    idx.push(n);
  }
  return idx;
}
