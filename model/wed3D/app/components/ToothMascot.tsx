
"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function ToothHead() {
  const shape = useMemo(() => {
    const s = new THREE.Shape();

    s.moveTo(-0.65, -0.05);
    s.bezierCurveTo(-0.85, 0.35, -0.82, 0.85, -0.48, 1.05);
    s.bezierCurveTo(-0.20, 1.22, -0.03, 1.02, 0.12, 0.98);
    s.bezierCurveTo(0.38, 0.92, 0.48, 1.18, 0.73, 0.95);
    s.bezierCurveTo(1.02, 0.68, 0.83, 0.16, 0.65, -0.12);
    s.bezierCurveTo(0.48, -0.42, 0.25, -0.45, 0.02, -0.38);
    s.bezierCurveTo(-0.25, -0.30, -0.43, -0.45, -0.65, -0.05);

    s.closePath();
    return s;
  }, []);

  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.38,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.07,
        bevelThickness: 0.07,
        curveSegments: 24,
      }),
    [shape]
  );

  return (
    <group position={[0, 2.35, 0]}>
      <mesh geometry={geometry} position={[0, 0, -0.19]}>
        <meshPhysicalMaterial
          color="#fffaf6"
          roughness={0.24}
          metalness={0}
          clearcoat={0.8}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* Eyes */}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 0.28, 0.25]}>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshStandardMaterial color="#171521" roughness={0.25} />
        </mesh>
      ))}

      {/* Eye highlights */}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x - 0.02, 0.31, 0.33]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshBasicMaterial color="white" />
        </mesh>
      ))}

      {/* Smile */}
      <mesh position={[0, -0.02, 0.28]}>
        <torusGeometry args={[0.105, 0.018, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#211925" roughness={0.4} />
      </mesh>
    </group>
  );
}

function MascotBody() {
  return (
    <group>
      {/* Blue scrub shirt */}
      <mesh position={[0, 1.15, 0]}>
        <capsuleGeometry args={[0.36, 0.55, 8, 16]} />
        <meshStandardMaterial color="#0755c9" roughness={0.55} />
      </mesh>

      {/* White lab coat */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.29, 1.12, 0.035]}
          rotation={[0, 0, -side * 0.08]}
        >
          <boxGeometry args={[0.19, 0.77, 0.22]} />
          <meshStandardMaterial color="#fffdfb" roughness={0.42} />
        </mesh>
      ))}

      {/* Coat lapels */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.13, 1.47, 0.17]}
          rotation={[0, 0, side * 0.32]}
        >
          <boxGeometry args={[0.12, 0.4, 0.055]} />
          <meshStandardMaterial color="#f3f5fb" roughness={0.45} />
        </mesh>
      ))}

      {/* Arms */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.43, 1.42, 0]}>
          <mesh
            position={[side * 0.20, -0.10, 0]}
            rotation={[0, 0, -side * 0.85]}
          >
            <capsuleGeometry args={[0.105, 0.43, 6, 12]} />
            <meshStandardMaterial color="#fffdfb" roughness={0.5} />
          </mesh>

          {/* Hands */}
          <mesh position={[side * 0.39, -0.29, 0.02]}>
            <sphereGeometry args={[0.13, 20, 20]} />
            <meshStandardMaterial color="#fffaf6" roughness={0.38} />
          </mesh>
        </group>
      ))}

      {/* Legs */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.23, 0.53, 0]}>
          <mesh rotation={[0, 0, side * 0.45]}>
            <capsuleGeometry args={[0.17, 0.38, 6, 12]} />
            <meshStandardMaterial color="#0755c9" roughness={0.65} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Character() {
  const root = useRef<THREE.Group>(null);

  useFrame(({ clock, pointer }) => {
    if (!root.current) return;

    const t = clock.elapsedTime;

    root.current.position.y = Math.sin(t * 1.3) * 0.06;
    root.current.rotation.y = THREE.MathUtils.lerp(
      root.current.rotation.y,
      pointer.x * 0.35,
      0.04
    );
    root.current.rotation.x = THREE.MathUtils.lerp(
      root.current.rotation.x,
      -pointer.y * 0.12,
      0.04
    );
  });

  return (
    <group ref={root}>
      <ToothHead />
      <MascotBody />
    </group>
  );
}

export default function ToothMascot() {
  return (
    <div className="h-[600px] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-sky-50 to-white">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 2.0, 6.5], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={2.5}
          castShadow
        />
        <pointLight position={[-3, 2, 2]} color="#72bfff" intensity={25} />

        <Character />

        <ContactShadows
          position={[0, -0.12, 0]}
          opacity={0.25}
          scale={5}
          blur={2.5}
        />

        <Environment preset="studio" />

        <OrbitControls
          enablePan={false}
          minDistance={4.5}
          maxDistance={9}
          target={[0, 1.5, 0]}
        />
      </Canvas>
    </div>
  );
}
