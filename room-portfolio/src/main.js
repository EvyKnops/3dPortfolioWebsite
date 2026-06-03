import './style.scss'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';


const canvas = document.querySelector('#experience-canvas');
const sizes = {
  height: window.innerHeight,
  width: window.innerWidth
}

const scene = new THREE.Scene();
const websiteURL = 'https://2dportfoliowebsite-clbh.vercel.app/'; // replace with your deployed portfolio URL
let anchorMesh = null;
let iframeEl = null;
let cssObject = null;
const iframeCSSSize = { w: 720, h: 405 };

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(sizes.width, sizes.height);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.left = '0';
// allow pointer events to pass through the CSS3D overlay so the WebGL canvas
// (and OrbitControls) receive mouse input; individual CSS3D elements
// (like the iframe) keep their own `pointer-events: auto` so they remain interactive
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '10';
const experienceElement = document.getElementById('experience');
if (experienceElement) experienceElement.appendChild(cssRenderer.domElement);

//loaderss
const textureLoader = new THREE.TextureLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// weet niet zeker of ik deze nodig heb want heb geen aparte textures
const modelPath = "/models/room_try2-v1.glb";
gltfLoader.load(
  modelPath,
  (glb) => {
    const model = glb.scene;
    scene.add(model);
    console.log("GLTF loaded:", model);

    // find a mesh that looks like a screen to attach the iframe to
    function findScreenMesh(root) {
      let found = null;
      root.traverse((child) => {
        if (child.isMesh) {
          const name = (child.name || '').toLowerCase();
          if (name.includes('screen') || name.includes('monitor') || name.includes('tv') || name.includes('display') || name.includes('panel')) {
            found = child;
          }
        }
      });
      return found;
    }

    anchorMesh = findScreenMesh(model) || model;
    if (anchorMesh && anchorMesh !== model) console.log('Anchoring iframe to mesh:', anchorMesh.name);
    else console.log('No explicit screen mesh found; anchoring to model root.');

    function createWebsiteIframe(url) {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.title = 'Portfolio website';
      iframe.style.border = '0';
      iframe.style.width = `${iframeCSSSize.w}px`;
      iframe.style.height = `${iframeCSSSize.h}px`;
      iframe.style.pointerEvents = 'auto';
      iframe.style.background = 'white';

      iframeEl = iframe;
      cssObject = new CSS3DObject(iframe);

      if (anchorMesh && anchorMesh.isMesh && anchorMesh.geometry) {
        anchorMesh.geometry.computeBoundingBox();
        const bbox = anchorMesh.geometry.boundingBox;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bbox.getSize(size);
        bbox.getCenter(center);

        cssObject.position.copy(center);

        // Map the mesh bounding-box size to iframe width/height.
        // Some monitor meshes have zero size on one axis (e.g. x) so we pick the
        // two largest axes from the bounding box and treat them as width/height.
        const absSize = new THREE.Vector3(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z));
        const axes = [
          { axis: 'x', value: absSize.x },
          { axis: 'y', value: absSize.y },
          { axis: 'z', value: absSize.z }
        ];
        axes.sort((a, b) => b.value - a.value);
        const major = axes[0];
        const minor = axes[1];

        // compute scale factors so iframe displays roughly the same physical size
        const scaleX = major.value / iframeCSSSize.w || 0.001;
        const scaleY = minor.value / iframeCSSSize.h || 0.001;

        cssObject.scale.set(scaleX, scaleY, 1);
        // rotate the iframe 90 degrees around Y so it faces the monitor surface
        cssObject.rotation.set(0, Math.PI / 2, 0);
        anchorMesh.add(cssObject);
        console.log('Embedded website iframe on mesh:', anchorMesh.name || '(unnamed screen mesh)');
        console.log('Applied cssObject rotation (radians):', cssObject.rotation);
        console.log('Bounding box sizes:', size, 'mapped axes:', major.axis, minor.axis, 'scales:', scaleX, scaleY);

        // Debug: add a translucent plane showing the found bounding box
        try {
          const planeGeo = new THREE.PlaneGeometry(size.x, size.y);
          const planeMat = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.35, transparent: true, side: THREE.DoubleSide });
          const debugPlane = new THREE.Mesh(planeGeo, planeMat);
          // small offset to avoid z-fighting with the mesh surface
          const planeOffset = new THREE.Vector3(0, 0, 0.01);
          debugPlane.position.copy(center).add(planeOffset);
          // if the anchorMesh has rotation/scale, add the debugPlane as a child so it shares transforms
          anchorMesh.add(debugPlane);
          console.log('Debug plane added at center', center, 'size', size);
        } catch (err) {
          console.warn('Could not add debug plane:', err);
        }
      } else {
        // Fallback: place the iframe directly in front of the camera at a visible size
        const frontPos = new THREE.Vector3();
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        frontPos.copy(camera.position).add(dir.multiplyScalar(2)); // 2 units in front

        cssObject.position.copy(frontPos);
        // scale down the 720x405 iframe to a reasonable world size so it's visible
        cssObject.scale.set(0.01, 0.01, 1);
        scene.add(cssObject);
        console.warn('Could not find a screen mesh; iframe placed in front of the camera for debugging. Rename your screen mesh to include "screen", "monitor", "tv", or "display" for automatic anchoring.');
      }
    }

    createWebsiteIframe(websiteURL);
    // Additional debug info to help diagnose visibility issues
    try {
      console.log('CSS3D DOM children count:', cssRenderer.domElement.childElementCount);
      if (iframeEl) {
        console.log('Iframe element present with src:', iframeEl.src);
      } else {
        console.log('Iframe element not set yet');
      }
      if (anchorMesh) {
        console.log('Anchor mesh name:', anchorMesh.name);
        const worldPos = new THREE.Vector3();
        anchorMesh.getWorldPosition(worldPos);
        console.log('Anchor world position:', worldPos);
        const worldQuat = new THREE.Quaternion();
        anchorMesh.getWorldQuaternion(worldQuat);
        console.log('Anchor world quaternion:', worldQuat);
        if (anchorMesh.geometry && anchorMesh.geometry.boundingBox) {
          const bb = anchorMesh.geometry.boundingBox;
          console.log('Anchor geometry bbox min/max:', bb.min, bb.max);
        }
      }
    } catch (err) {
      console.warn('Debug logging failed:', err);
    }
  },
  undefined,
  (error) => {
    console.error("GLTF load error:", error);
  }
);

const camera = new THREE.PerspectiveCamera( 
  75,
  sizes.width / sizes.height, 
  0.1, 
  1000 
);

camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
renderer.setSize( sizes.width, sizes.height );
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// const geometry = new THREE.BoxGeometry( 1, 1, 1 );
// const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } ); 
// const cube = new THREE.Mesh( geometry, material );
// scene.add( cube );

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

//event listenerss
window.addEventListener('resize', () => {
  //update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  //update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  //update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  cssRenderer.setSize(sizes.width, sizes.height);
});

const render = ( time ) => {
  controls.update();

  // cube.rotation.x = time / 2000;
  // cube.rotation.y = time / 1000;

  renderer.render( scene, camera );
  cssRenderer.render( scene, camera );
  window.requestAnimationFrame( render );
}

render();