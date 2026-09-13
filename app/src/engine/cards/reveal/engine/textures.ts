import * as THREE from 'three';
import { Asset } from 'expo-asset';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import type { PixelImage } from '../art/packArt';

/** Wraps a Skia-rendered RGBA8 buffer as a three.js DataTexture — the
 * native stand-in for `new THREE.CanvasTexture(canvas)` in the web
 * prototype, since React Native has no DOM canvas to hand three.js. */
export function makeDataTexture(img: PixelImage, opts: { repeatX?: boolean } = {}): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    img.data,
    img.width,
    img.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  // DOM canvas textures default flipY=true; DataTexture defaults to false —
  // set explicitly so the baked art reads right-side-up on the mesh.
  tex.flipY = true;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  if (opts.repeatX) tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Loads a bundled logo (require(...) module id) as a Skia image for the
 * art layer to draw into the pack's front-panel frame. Returns null on any
 * failure so callers fall back to the procedural gold emblem — the pack
 * must never fail to build just because artwork didn't decode. */
export async function loadLogoImage(assetModule: number): Promise<SkImage | null> {
  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const data = await Skia.Data.fromURI(uri);
    return Skia.Image.MakeImageFromEncoded(data);
  } catch (e) {
    console.warn('[grailhaus] logo image failed to load — using emblem fallback', e);
    return null;
  }
}
