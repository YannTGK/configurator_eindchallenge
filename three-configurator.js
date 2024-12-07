import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

let scene, camera, renderer, controls, shoeObject, raycaster, mouse, highlightedObject;
const INTERSECTED_COLOR = new THREE.Color(0x00ff00);

// Define default colors for shoe parts
const basicColors = {
  "laces": new THREE.Color(0xffffff),   // white
  "inside": new THREE.Color(0xff0000),   // red
  "outside_1": new THREE.Color(0x000000), // black
  "outside_2": new THREE.Color(0xff0000), // red
  "outside_3": new THREE.Color(0xff0000), // red
  "sole_top": new THREE.Color(0x888888),  // gray
  "sole_bottom": new THREE.Color(0x000000) // black
};

export function initializeCanvas(canvas) {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  // Camera setup
  camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(0, 10, -55);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Raycaster setup
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // HDRI environment mapping
  const rgbeLoader = new RGBELoader();
  rgbeLoader.load('/environment/skiline_city.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    scene.background = envMap;
  });

  // DRACOLoader setup
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');

  // GLTFLoader setup
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  // Load the shoe model
  loader.load('/models/Shoe.gltf', (gltf) => {
    shoeObject = gltf.scene;
    shoeObject.rotation.y = -Math.PI / 2;
    shoeObject.scale.set(50, 50, 50);

    // Load textures for each part of the shoe
    const textureLoader = new THREE.TextureLoader();
    const textures = {
      "laces": textureLoader.load('/textures/normal_t_white.jpg'),
      "inside": textureLoader.load('/textures/normal_t_white.jpg'),
      "outside_1": textureLoader.load('/textures/normal_t_white.jpg'),
      "outside_2": textureLoader.load('/textures/normal_t_white.jpg'),
      "outside_3": textureLoader.load('/textures/normal_t_white.jpg'),
      "sole_top": textureLoader.load('/textures/normal_t_white.jpg'),
      "sole_bottom": textureLoader.load('/textures/normal_t_white.jpg')
    };

    shoeObject.traverse((child) => {
      if (child.isMesh) {
        const objectName = child.name.toLowerCase(); // Convert name to lowercase for comparison

        // Set default color based on object name
        if (basicColors[objectName]) {
          child.material.color.set(basicColors[objectName]); // Apply the basic color to the mesh
        } else {
          // Fallback color if no specific color is defined
          child.material.color.set(0x999999); // Gray for undefined parts
        }

        // Apply texture if it exists
        if (textures[objectName]) {
          const material = new THREE.MeshStandardMaterial({
            map: textures[objectName], // Apply the texture
            color: child.material.color, // Keep the base color as a tint
            emissive: new THREE.Color(0x000000),
            roughness: 0.5,
            metalness: 0.5,
          });
          child.material = material; // Assign new material with texture
        }

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(shoeObject);
  });

  // Ground (shadow catcher)
  const groundGeometry = new THREE.PlaneGeometry(5000, 5000);
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -5;
  ground.receiveShadow = true;
  scene.add(ground);

  // Lighting setup
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 50, 10);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Add event listeners for mouse interaction
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onMouseClick);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function onMouseMove(event) {
  event.preventDefault();

  // Get the bounding rectangle of the canvas
  const rect = renderer.domElement.getBoundingClientRect();

  // Calculate mouse position relative to the canvas
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Set up the raycaster (no need to call update)
  raycaster.setFromCamera(mouse, camera);

  // Find the intersections
  const intersects = raycaster.intersectObject(shoeObject, true);
}

function onMouseClick(event) {
  // Get canvas bounding rectangle
  const rect = renderer.domElement.getBoundingClientRect();

  // Map mouse position to normalized device coordinates (NDC)
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Use raycaster to detect intersected objects
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(shoeObject ? shoeObject.children : [], true);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;

    // If a new object is clicked and it's different from the previously highlighted object
    if (highlightedObject !== clickedObject) {
      // Reset the previously clicked object's emissive color
      if (highlightedObject) {
        highlightedObject.material.emissive.set(0x000000); // Reset emissive color
      }

      // Highlight the newly clicked object
      highlightedObject = clickedObject;
      highlightedObject.material.emissive.set(INTERSECTED_COLOR); // Set emissive color to indicate selection

      // Change the color of the clicked object
      if (selectedColor) {
        clickedObject.material.color.set(selectedColor); // Apply selected color to the object
      }

      console.log('Clicked Object:', clickedObject.name);
    }
  } else {
    // If no object is clicked, deselect any currently highlighted object
    if (highlightedObject) {
      highlightedObject.material.emissive.set(0x000000); // Reset the emissive color
      highlightedObject = null; // Clear the highlighted object
    }
  }
}

let selectedColor = null; // Default color
export function updateShoeColor(color) {
  selectedColor = color;

  // If an object is currently highlighted, update its color and remove highlight
  if (highlightedObject) {
    highlightedObject.material.color.set(selectedColor);
    // Remove the highlight by resetting the emissive color
    highlightedObject.material.emissive.set(0x000000);
    highlightedObject = null; // Clear the highlighted object after color change
  }

  //reset the saved color
  selectedColor = null;
}

// Function to update shoe fabric texture
export function updateShoeFabric(fabricTexture) {
  const textureLoader = new THREE.TextureLoader();
  const newFabricTexture = textureLoader.load(fabricTexture);

  if (shoeObject) {
    shoeObject.traverse((child) => {
      if ((child.isMesh && child.name.toLowerCase().includes('outside')) | (child.isMesh && child.name.toLowerCase().includes('inside')) | (child.isMesh && child.name.toLowerCase().includes('sole_top'))) {
        child.material.map = newFabricTexture; // Apply fabric texture only to "outside" parts
      }
    });
  }
}