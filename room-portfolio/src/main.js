import './style.scss'
import * as THREE from 'three';


const canvas = document.querySelector('#experience-canvas');
const sizes = {
  height = window.innerHeight,
  width = window.innerWidth
}



const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 
  75,
  sizes.width / sizes.height, 
  0.1, 
  1000 
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( sizes.width, sizes.height );

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 5;

function animate( time ) {


}

const render = () => {
  cube.rotation.x = time / 2000;
  cube.rotation.y = time / 1000;

  renderer.render( scene, camera );
  window.requestAnimationFrame( render );
}

render();