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
// Allow the CSS3D root to receive pointer events so child elements (iframe)
// can be interactive. We handle forwarding non-iframe events to the WebGL
// canvas below, and disable OrbitControls while the pointer is over the iframe.
// by default let pointer events pass to the WebGL canvas; when the iframe is
// hovered we'll enable pointer events on the CSS3D root so the iframe can receive them
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '10';
const experienceElement = document.getElementById('experience');
if (experienceElement) experienceElement.appendChild(cssRenderer.domElement);

// Allow iframe interaction while preserving orbit controls:
// - When pointer is over the iframe, disable OrbitControls so iframe receives events.
// - When pointer interacts with CSS3D but not the iframe, forward the pointer event to the WebGL canvas.
function isEventOnIframe(e) {
  return iframeEl && (e.target === iframeEl || iframeEl.contains(e.target));
}

// (Removed: forwarding pointer events to avoid pointer capture issues.)

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

      // Make iframe focusable and add pointer enter/leave handlers to toggle controls
      try {
        iframeEl.style.pointerEvents = 'auto';
        iframeEl.tabIndex = -1;
        iframeEl.addEventListener('pointerenter', () => {
          // enable CSS3D root so iframe receives events and disable orbit controls
          cssRenderer.domElement.style.pointerEvents = 'auto';
          if (controls) controls.enabled = false;
        });
        iframeEl.addEventListener('pointerleave', () => {
          // restore pointerEvents so WebGL canvas receives events again
          cssRenderer.domElement.style.pointerEvents = 'none';
          if (controls) controls.enabled = true;
        });
      } catch (err) {
        // if controls not yet defined or iframe cross-origin, ignore
      }

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

    // collect clickable objects: anchorMesh and any meshes named like desk/monitor/table
    try {
      const names = ['monitor', 'screen', 'desk', 'table', 'computer', 'keyboard'];
      scene.traverse((child) => {
        if (child.isMesh) {
          const nm = (child.name || '').toLowerCase();
          for (const n of names) {
            if (nm.includes(n)) {
              clickableObjects.push(child);
              console.log('Registered clickable mesh:', child.name);
              break;
            }
          }
        }
      });
      // always add anchorMesh if present
      if (anchorMesh) clickableObjects.push(anchorMesh);
    } catch (err) {
      console.warn('Failed to populate clickable objects:', err);
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

// sensible default starting position (x, y, z)
camera.position.set(0, 1.6, 6);

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
// set default look target near the center ground so camera faces the room
controls.target.set(0, 1.6, 0);
controls.update();

// store initial camera state so we can return later
const initialCameraPosition = camera.position.clone();
const initialCameraQuaternion = camera.quaternion.clone();
const initialControlsTarget = controls.target.clone();

// Raycaster for click interactions
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickableObjects = [];
let pendingEnableCssFor = false;
let domIframeOverlay = null;

function updateDomIframeOverlay() {
  if (!domIframeOverlay || !anchorMesh || !anchorMesh.geometry || !anchorMesh.geometry.boundingBox) return;
  const bb = anchorMesh.geometry.boundingBox;
  const corners = [
    new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
    new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
    new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
    new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
    new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
    new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
    new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
    new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
  ];
  const ndcPoints = corners.map((c) => {
    const wc = c.clone();
    anchorMesh.localToWorld(wc);
    wc.project(camera);
    return { x: (wc.x * 0.5 + 0.5) * sizes.width, y: (-wc.y * 0.5 + 0.5) * sizes.height, z: wc.z };
  });

  // if all points are outside NDC [-1,1] or behind camera (z>1), hide overlay
  const visible = ndcPoints.some(p => p.z >= -1 && p.z <= 1 && p.x >= -1000 && p.x <= sizes.width+1000 && p.y >= -1000 && p.y <= sizes.height+1000);
  if (!visible) {
    domIframeOverlay.style.display = 'none';
    return;
  }

  const xs = ndcPoints.map(p => p.x);
  const ys = ndcPoints.map(p => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const padding = 4;
  domIframeOverlay.style.display = 'block';
  domIframeOverlay.style.left = `${Math.round(left - padding)}px`;
  domIframeOverlay.style.top = `${Math.round(top - padding)}px`;
  domIframeOverlay.style.width = `${Math.max(10, Math.round(right - left + padding*2))}px`;
  domIframeOverlay.style.height = `${Math.max(10, Math.round(bottom - top + padding*2))}px`;
}

// Populate clickableObjects once the model is loaded (we push anchorMesh and any desk/monitor-like meshes)


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
  // update DOM iframe overlay position each frame so it follows the monitor
  try { updateDomIframeOverlay(); } catch (err) {}
  cssRenderer.render( scene, camera );
  window.requestAnimationFrame( render );
}

render();

// ---- Click to move camera ----
function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }

function computeLookQuaternion(eyePos, targetPos) {
  const m = new THREE.Matrix4();
  m.lookAt(eyePos, targetPos, camera.up);
  const q = new THREE.Quaternion();
  q.setFromRotationMatrix(m);
  return q;
}

function animateCameraTo(targetPos, lookAtPos, duration = 1200) {
  const startPos = camera.position.clone();
  const startQuat = camera.quaternion.clone();
  const startTarget = controls.target.clone();

  const endPos = targetPos.clone();
  const endQuat = computeLookQuaternion(endPos, lookAtPos);
  const endTarget = lookAtPos.clone();

  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const e = easeInOutQuad(t);

    camera.position.lerpVectors(startPos, endPos, e);
    camera.quaternion.slerpQuaternions(startQuat, endQuat, e);
    controls.target.lerpVectors(startTarget, endTarget, e);
    controls.update();

    if (t < 1) requestAnimationFrame(step);
    else {
      // ensure controls are enabled after animation completes
      controls.enabled = true;
      controls.update();
      // enable CSS3D root pointer events if requested (so iframe can receive input)
      if (pendingEnableCssFor) {
            console.log('Preparing DOM iframe overlay for interactivity; anchorMesh:', anchorMesh);
            // hide CSS3D iframe to avoid wrapper intercepting clicks
            try { if (cssObject && cssObject.element) cssObject.element.style.pointerEvents = 'none'; } catch (e) {}
            // create or update a top-level DOM iframe overlay positioned over the mesh
            try {
              if (!domIframeOverlay) {
                domIframeOverlay = document.createElement('iframe');
                domIframeOverlay.style.position = 'absolute';
                domIframeOverlay.style.border = '0';
                domIframeOverlay.style.zIndex = '20';
                domIframeOverlay.style.pointerEvents = 'auto';
                domIframeOverlay.src = websiteURL;
                const experience = document.getElementById('experience');
                if (experience) experience.appendChild(domIframeOverlay);
              }
              // compute screen rect from anchorMesh bounding box
              if (anchorMesh && anchorMesh.geometry && anchorMesh.geometry.boundingBox) {
                const bb = anchorMesh.geometry.boundingBox;
                const corners = [
                  new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
                  new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
                  new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
                  new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
                  new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
                  new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
                  new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
                  new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
                ];
                const ndcPoints = corners.map((c) => {
                  const wc = c.clone();
                  anchorMesh.localToWorld(wc);
                  wc.project(camera);
                  return { x: (wc.x * 0.5 + 0.5) * sizes.width, y: (-wc.y * 0.5 + 0.5) * sizes.height };
                });
                const xs = ndcPoints.map(p => p.x);
                const ys = ndcPoints.map(p => p.y);
                const left = Math.min(...xs);
                const right = Math.max(...xs);
                const top = Math.min(...ys);
                const bottom = Math.max(...ys);
                const padding = 4; // small padding
                domIframeOverlay.style.left = `${Math.round(left - padding)}px`;
                domIframeOverlay.style.top = `${Math.round(top - padding)}px`;
                domIframeOverlay.style.width = `${Math.round(right - left + padding*2)}px`;
                domIframeOverlay.style.height = `${Math.round(bottom - top + padding*2)}px`;
                console.log('DOM iframe overlay positioned at', domIframeOverlay.style.left, domIframeOverlay.style.top, domIframeOverlay.style.width, domIframeOverlay.style.height);
              }
            } catch (err) {
              console.warn('Failed to create DOM iframe overlay:', err);
            }
            pendingEnableCssFor = false;
      }
    }
  }
  requestAnimationFrame(step);
}

function moveCameraToObject(object) {
  const worldPos = new THREE.Vector3();
  object.getWorldPosition(worldPos);

  // determine surface normal approximation: object's world direction
  const normal = new THREE.Vector3();
  object.getWorldDirection(normal);
  // if normal is zero, fallback to camera-to-object direction
  if (normal.lengthSq() < 1e-6) {
    normal.copy(worldPos).sub(camera.position).normalize();
  }
  // rotate approach vector 90 degrees around Y so camera approaches from the side
  const yAxis = new THREE.Vector3(0, 1, 0);
  normal.applyAxisAngle(yAxis, Math.PI / 2);
  console.log('Rotated approach normal by 90deg:', normal);

  const distance = 1.8; // desired distance from the screen
  const desiredCameraPos = worldPos.clone().add(normal.multiplyScalar(distance));
  // slightly raise camera to center the view
  desiredCameraPos.y += 0.1;

  // If this object is the anchorMesh (or a child of it), enable the iframe after moving
  let enableIframeAfter = false;
  if (anchorMesh) {
    let cur = object;
    while (cur) {
      if (cur === anchorMesh) { enableIframeAfter = true; break; }
      cur = cur.parent;
    }
  }
  if (enableIframeAfter) pendingEnableCssFor = true;

  animateCameraTo(desiredCameraPos, worldPos, 1000);
}

  // Debug: log pointer events on the CSS3D root
  try {
    cssRenderer.domElement.addEventListener('pointerdown', (e) => {
      console.log('CSS3D root pointerdown target:', e.target, 'css root pointerEvents:', cssRenderer.domElement.style.pointerEvents);
    });
  } catch (err) {}

renderer.domElement.addEventListener('pointerdown', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableObjects, true);
  if (intersects.length > 0) {
    const picked = intersects[0].object;
    console.log('Clicked object:', picked.name || picked.id, 'moving camera to it');
    moveCameraToObject(picked);
  }
});

// Raycast on pointer move to detect when the cursor is over a clickable object
// (only change cursor feedback here; enabling CSS3D pointer events is done
// after camera animation completes to avoid intercepting clicks on the canvas)
renderer.domElement.addEventListener('pointermove', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableObjects, true);
  if (intersects.length > 0) {
    renderer.domElement.style.cursor = 'pointer';
  } else {
    renderer.domElement.style.cursor = 'default';
  }
});

// press Escape to return to initial camera
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    animateCameraTo(initialCameraPosition, initialControlsTarget, 1000);
  }
});