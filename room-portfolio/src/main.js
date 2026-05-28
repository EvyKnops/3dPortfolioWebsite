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

  renderer.render( scene, camera );
  window.requestAnimationFrame( render );
}

render();