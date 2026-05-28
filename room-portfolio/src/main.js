import './style.scss'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


const canvas = document.querySelector('#experience-canvas');
const sizes = {
  height: window.innerHeight,
  width: window.innerWidth
}

const scene = new THREE.Scene();

// iframe overlay variables (YouTube placeholder)
let iframeEl = null;
let anchorMesh = null;
const iframeSize = { w: 720, h: 404 };
const iframeVideoId = 'kWVFEVWJMz8'; // replace with actual YouTube ID

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

    // create iframe and insert into #experience so it's positioned relative to the canvas
    function createIframe(videoId) {
      const container = document.getElementById('experience') || document.body;
      iframeEl = document.createElement('iframe');
      iframeEl.id = 'yt-iframe';
      iframeEl.src = `https://www.youtube.com/embed/${videoId}`;
      iframeEl.title = 'YouTube video';
      iframeEl.frameBorder = '0';
      iframeEl.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframeEl.allowFullscreen = true;
      iframeEl.style.position = 'absolute';
      iframeEl.style.transform = 'translate(-50%, -50%)';
      iframeEl.style.pointerEvents = 'auto';
      iframeEl.style.width = `${iframeSize.w}px`;
      iframeEl.style.height = `${iframeSize.h}px`;
      iframeEl.style.zIndex = '100';
      container.appendChild(iframeEl);
    }

    createIframe(iframeVideoId);
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
});

const render = ( time ) => {
  controls.update();

  // cube.rotation.x = time / 2000;
  // cube.rotation.y = time / 1000;

  // update iframe position if attached
  if (iframeEl && anchorMesh) {
    const worldPos = new THREE.Vector3();
    const distPos = new THREE.Vector3();
    anchorMesh.getWorldPosition(worldPos);
    worldPos.project(camera);
    const x = (worldPos.x * 0.5 + 0.5) * sizes.width;
    const y = (-worldPos.y * 0.5 + 0.5) * sizes.height;
    iframeEl.style.left = `${x}px`;
    iframeEl.style.top = `${y}px`;

    // scale iframe by distance so it appears roughly the right size
    anchorMesh.getWorldPosition(distPos);
    const distance = camera.position.distanceTo(distPos);
    const scale = Math.max(0.35, 2 / distance);
    iframeEl.style.width = `${iframeSize.w * scale}px`;
    iframeEl.style.height = `${iframeSize.h * scale}px`;
  }

  renderer.render( scene, camera );
  window.requestAnimationFrame( render );
}

render();