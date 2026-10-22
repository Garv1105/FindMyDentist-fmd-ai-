import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { MODEL_URLS } from "./MascotArt";

/**
 * Fetch and parse every 3D model on the home page into drei's cache, so each one appears the moment it scrolls into
 * view. Progress comes from three's shared loading manager (it counts the hero mascot too, which its own module
 * queues as soon as it's imported). Resolves when everything has loaded.
 */
export function preloadModels(onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const m = THREE.DefaultLoadingManager;
    m.onProgress = (_url, loaded, total) => {
      onProgress(total ? loaded / total : 0);
      if (total >= MODEL_URLS.length && loaded === total) resolve();
    };
    m.onLoad = () => resolve();
    m.onError = () => resolve(); // a failed model just keeps its artwork; never hold the page
    void import("./hero/Mascot3D");
    MODEL_URLS.forEach((url) => useGLTF.preload(url));
  });
}
