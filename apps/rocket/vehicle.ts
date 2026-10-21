import { type Body, closestPointToFace } from "../../lib3d/bodies";
import { Vec3, constrain } from "../../lib3d/lib3d";

// ====================================================================
// SCHWEBENDE HINDERNISBOX
//
// Ein FloatingBox ist ein Body mit Grundposition, sanfter Auf-und-Ab-
// Bewegung (Sinus) und langsamer Rotation um die Y-Achse. Der Radius ist
// die maximale Entfernung eines Vertices vom Ursprung (Bounding-Sphere-
// Radius) und dient als schneller Vorab-Test.
//
// Port von apps/rocket/vehicle.go (Go-Fassung).
// ====================================================================

export class FloatingBox {
  body: Body;
  base: Vec3;
  phase: number;
  spin: number;
  radius: number; // Bounding-Sphere-Radius (max. Vertex-Laenge)

  constructor(b: Body, phase: number, spin: number) {
    this.body = b;
    this.base = b.pos.clone();
    this.phase = phase;
    this.spin = spin;

    let maxR = 0.0;
    const t = b.geometry.triangles;
    for (let i = 0; i + 2 < t.length; i += 9) {
      const x = t[i];
      const y = t[i + 1];
      const z = t[i + 2];
      const l = Math.sqrt(x * x + y * y + z * z);
      if (l > maxR) {
        maxR = l;
      }
    }
    this.radius = maxR;
  }

  /** update animiert die Box (Schweben + Rotation). t ist die Zeit in Sekunden. */
  update(t: number): void {
    this.body.pos = new Vec3(this.base.x, this.base.y + Math.sin(t + this.phase) * 6.0, this.base.z);
    this.body.rot.y += this.spin;
  }
}

// ====================================================================
// VEHICLE (BOID)
//
// Ein Vehicle ist ein Body mit Geschwindigkeit/Beschleunigung samt den
// Flocking-Regeln (separate, align, cohesion) sowie Ausweichen vor den
// Hindernissen (avoidObstacles) und Reflexion an den Weltgrenzen
// (applyBoundary).
// ====================================================================

export class Vehicle {
  body: Body;
  vel: Vec3;
  accel: Vec3;
  heading: Vec3;
  health: number;
  dna: number[];

  constructor(b: Body, v: Vec3 = new Vec3()) {
    this.body = b;
    this.vel = v;
    this.accel = new Vec3();
    this.heading = new Vec3();
    this.health = 1.0;
    this.dna = [];
  }

  /** alignToVelocity richtet den Body an der Geschwindigkeit aus. */
  alignToVelocity(): void {
    const mag = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y + this.vel.z * this.vel.z);
    if (mag < 0.0001) {
      return;
    }

    const magXZ = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);

    // vel.y/mag muss in [-1,1] liegen (Schutz vor NaN durch Float-Rundung).
    const cosY = constrain(this.vel.y / mag, -1.0, 1.0);
    this.body.rot.x = Math.acos(cosY);
    if (magXZ < 0.0001) {
      this.body.rot.y = 0.0;
    } else {
      this.body.rot.y = Math.atan2(this.vel.x / magXZ, this.vel.z / magXZ);
    }
    this.body.rot.z = 0.0;

    this.heading = new Vec3(this.vel.x / mag, this.vel.y / mag, this.vel.z / mag);
  }

  /** applyForce addiert eine Kraft zur Beschleunigung. */
  applyForce(force: Vec3): void {
    this.accel = this.accel.add(force);
  }

  /** update integriert die Bewegung und begrenzt die Geschwindigkeit. */
  update(): void {
    this.vel = this.vel.add(this.accel);
    const speed = this.vel.length();
    this.vel = this.vel.normalize().scale(constrain(speed, 0.5, 2.0));
    this.accel = new Vec3();
    this.body.pos = this.body.pos.add(this.vel);
  }

  /** seek steuert das Fahrzeug in Richtung eines Ziels. */
  seek(target: Vec3): void {
    const desired = target.sub(this.body.pos).limit(3.0);
    const steer = desired.sub(this.vel).limit(2.0);
    this.applyForce(steer.scale(0.2));
  }

  /** align gleicht die Geschwindigkeit an die der Nachbarn an (Alignment). */
  align(vehics: Vehicle[]): void {
    const minDistance = 50.0;
    let sumVel = new Vec3();
    let count = 0;

    for (const other of vehics) {
      const distance = this.body.pos.distanceTo(other.body.pos);
      if (distance > 0 && distance < minDistance) {
        sumVel = sumVel.add(other.vel);
        count++;
      }
    }

    if (count > 0) {
      sumVel = sumVel.scale(1.0 / count); // Durchschnittsgeschwindigkeit
      sumVel = sumVel.mag(0.1);
      const steer = sumVel.sub(this.vel).scale(0.1);
      this.applyForce(steer);
    }
  }

  /** separate haelt Abstand zu den Nachbarn (Separation). */
  separate(vehics: Vehicle[]): void {
    const minDistance = 40.0;
    let diffSum = new Vec3();
    let count = 0;

    for (const other of vehics) {
      const distance = this.body.pos.distanceTo(other.body.pos);
      if (distance > 0 && distance < minDistance) {
        diffSum = diffSum.add(this.body.pos.sub(other.body.pos).normalize());
        count++;
      }
    }

    if (count > 0) {
      diffSum = diffSum.scale(1.0 / count); // Durchschnitt
      diffSum = diffSum.mag(0.1);
      const steer = diffSum.sub(this.vel).scale(0.1);
      this.applyForce(steer);
    }
  }

  /** cohesion steuert in Richtung des Schwerpunkts der Nachbarn (Kohaesion). */
  cohesion(vehics: Vehicle[]): void {
    const minDistance = 50.0;
    let sumPos = new Vec3();
    let count = 0;

    for (const other of vehics) {
      const distance = this.body.pos.distanceTo(other.body.pos);
      if (distance > 0 && distance < minDistance) {
        sumPos = sumPos.add(other.body.pos);
        count++;
      }
    }

    if (count > 0) {
      sumPos = sumPos.scale(1.0 / count); // Schwerpunkt der Nachbarn
      let desired = sumPos.sub(this.body.pos); // Richtung zur Gruppenmitte
      desired = desired.mag(0.1);
      const steer = desired.sub(this.vel).scale(0.1);
      this.applyForce(steer);
    }
  }

  /**
   * avoidObstacles laesst das Vehicle den schwebenden Boxen per Steering
   * ausweichen. margin ist die letzte Absicherung, detect der
   * Vorausschau-Radius.
   */
  avoidObstacles(obstacles: FloatingBox[], margin: number, detect: number): void {
    for (const o of obstacles) {
      // Schneller Vorab-Test (Bounding Sphere).
      if (this.body.pos.distanceTo(o.body.pos) > o.radius + detect) {
        continue;
      }

      const faces = o.body.worldFaces();
      if (faces.length === 0) {
        continue;
      }

      // Naechste Flaeche ueber den betragsmaessig kleinsten
      // vorzeichenbehafteten Abstand bestimmen.
      let signedDist = 0.0;
      let closest = new Vec3();
      let normal = new Vec3();
      let bestAbs = Infinity;
      for (const f of faces) {
        const hit = closestPointToFace(this.body.pos, f);
        const absDist = Math.abs(hit.signedDistance);
        if (absDist < bestAbs) {
          bestAbs = absDist;
          signedDist = hit.signedDistance;
          closest = hit.point;
          normal = hit.normal;
        }
      }

      // ---- Weiches, vorausschauendes Ausweichen ----
      let away = this.body.pos.sub(closest);
      if (signedDist < 0.0 || away.length() < 1e-6) {
        away = normal;
      }
      away = away.normalize();

      // near = 1 direkt an der Oberflaeche, 0 am Rand des Vorausschau-Bereichs.
      const dist = constrain(signedDist, 0.0, detect);
      const near = constrain(1.0 - dist / detect, 0.0, 1.0);

      if (near > 0.0) {
        const maxSpeed = 2.0; // Zielgeschwindigkeit
        const maxForce = 2.0; // Grenze der Steering-Kraft
        const weight = 0.02; // Einfluss (klein = sanfter)

        const desired = away.mag(maxSpeed);
        const steer = desired.sub(this.vel).limit(maxForce);
        this.applyForce(steer.scale(weight * near));
      }

      // ---- Letzte Absicherung gegen Eindringen ----
      // Zum Testen deaktiviert (false). Auf true setzen, um die harte
      // Rueckstellung wieder zu aktivieren.
      const hardSafety: boolean = false;
      if (hardSafety && signedDist < margin) {
        this.body.pos = this.body.pos.add(normal.scale(margin - signedDist));

        const intoVel = this.vel.dot(normal);
        if (intoVel < 0.0) {
          this.vel = this.vel.sub(normal.scale(intoVel));
        }
        const intoAccel = this.accel.dot(normal);
        if (intoAccel < 0.0) {
          this.accel = this.accel.sub(normal.scale(intoAccel));
        }
      }
    }
  }

  /** applyBoundary reflektiert die Geschwindigkeit an den Weltgrenzen. */
  applyBoundary(): void {
    const minX = -400.0;
    const maxX = 400.0;
    const minY = -400.0;
    const maxY = 400.0;
    const minZ = -400.0;
    const maxZ = 400.0;

    if (this.body.pos.x < minX || this.body.pos.x > maxX) {
      this.vel.x *= -1.0;
    }
    if (this.body.pos.y < minY || this.body.pos.y > maxY) {
      this.vel.y *= -1.0;
    }
    if (this.body.pos.z < minZ || this.body.pos.z > maxZ) {
      this.vel.z *= -1.0;
    }
  }
}
