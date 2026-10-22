import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { MODEL_URLS, isTouch } from "./MascotArt";

/**
 * Fetch and parse every 3D model on the home page into drei's cache, so each one appears the moment it scrolls into
 * view. Progress comes from three's shared loading manager (it counts the hero mascot too, which its own module
 * queues as soon as it's imported). Resolves when everything has loaded.
 */
export function preloadModels(onProgress: (fraction: number) => void): Promise<void> {
  // touch devices show stills of the section mascots, so only the hero's model is fetched there
  const urls = isTouch() ? [] : MODEL_URLS;
  return new Promise((resolve) => {
    const m = THREE.DefaultLoadingManager;
    m.onProgress = (_url, loaded, total) => {
      onProgress(total ? loaded / total : 0);
      if (total > urls.length && loaded === total) resolve();
    };
    m.onLoad = () => resolve();
    m.onError = () => resolve(); // a failed model just keeps its artwork; never hold the page
    void import("./hero/Mascot3D");
    urls.forEach((url) => useGLTF.preload(url));
  });
}
