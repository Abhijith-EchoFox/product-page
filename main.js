    import * as THREE from 'three';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
    import { gsap } from 'gsap/gsap-core';

    let scene, camera,renderer,controls;
    const clock = new THREE.Clock();
    // --- NEW VARIABLES FOR SCROLL NAVIGATION ---
    let productTargets = []; // This will store our individual product models
    let currentTargetIndex = 0; // Tracks which product we are looking at
    let isAnimating = false; // Prevents spamming the scroll animation
    const mouse = new THREE.Vector2(); // Stores normalized mouse coordinates
    let baseCameraPosition = new THREE.Vector3(); // Stores the initial camera position for parallax calculations
    const parallaxGroup = new THREE.Group();


    init();
    animate();
    function init()
    {
        scene = new THREE.Scene();
        camera     = new THREE.PerspectiveCamera(24, innerWidth/innerHeight, 0.01, 100000);
        camera.position.set(0, 0, 0);
        baseCameraPosition.copy(camera.position); // Store the base position for parallax
        


        //renderer
        renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
        renderer.setPixelRatio(devicePixelRatio);
        renderer.setSize(innerWidth, innerHeight);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top      = '0';
        renderer.domElement.style.left     = '0';
        document.body.appendChild(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);


        controls.enableDamping = true;
        // Set the controls target to the model's position for intuitive rotation
        // -- TO LOCK THE CAMERA VIEW LATER --
        // After you confirm the view, uncomment the three lines below.
        controls.enableZoom = false;
        controls.enableRotate = false;
        controls.enablePan = false;
        //controls.target.set(0, 0, 0);
        //controls.update(); 

        

        //lighting
        // // Directional Light (updated position and rotation from screenshot)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(100,140,40);
        dirLight.castShadow = false; // Enable shadows for this light
        dirLight.shadow.mapSize.width = 4096; // Increased resolution for crisper shadows
        dirLight.shadow.mapSize.height = 4096;
        // with PCFSoftShadowMap active on your renderer:
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        dirLight.shadow.radius = 20;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 400;
        // CORRECTED: Increased shadow camera frustum size to ensure it covers the model and ground
        dirLight.shadow.camera.left = -150;
        dirLight.shadow.camera.right = 150;
        dirLight.shadow.camera.top = 150;
        dirLight.shadow.camera.bottom = -150;
        dirLight.shadow.bias = -0.0001; // push the shadow map sample back onto the surface
        dirLight.shadow.normalBias = 0.05; // helps even out stretched shadows
        scene.add(dirLight);
        scene.add(dirLight.target);
        dirLight.target.position.set(50, 60, 20);

        const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
        scene.add(ambientLight);

        let model = null;
        const loader = new GLTFLoader();
        const loaderElement = document.getElementById('loader');
        loader.load(
            'assets/models/final7.glb',
            (gltf) => {
                
                model = gltf.scene;  
                //console.log(model," model");      
                model.position.set(0, 0, 0);
                model.scale.set(5, 5,5);
                // --- IMPORTANT: FINDING YOUR PRODUCTS ---
                // We traverse the loaded model to find the items you want to focus on.
                // Replace the names in the array below with the EXACT names of your product objects from your 3D modeling software (e.g., Blender).
                // 'cameraPosition': The EXACT position the camera MOVES to.
                const productsWithOffsets = [
                    { name: "Airfrens",  targetOffset: new THREE.Vector3(-5, 1, 0),    cameraPosition: new THREE.Vector3(5, 5, -50) },
                    { name: "Kylabs",    targetOffset: new THREE.Vector3(-6, 1, 2),   cameraPosition: new THREE.Vector3(90, 5, -50) },
                    { name: "Cox",       targetOffset: new THREE.Vector3(-6, 1, 1),    cameraPosition: new THREE.Vector3(200, 5, -50) },
                    { name: "Monitor",    targetOffset: new THREE.Vector3(-7, 1, 0),    cameraPosition: new THREE.Vector3(300, 12, -40) },
                    { name: "Games", targetOffset: new THREE.Vector3(-7, 4, 0),    cameraPosition: new THREE.Vector3(400, 5, -40) },
                    { name: "vcard", targetOffset: new THREE.Vector3(-7, 4, 0),    cameraPosition: new THREE.Vector3(500, 5, -40) }
                ];
                const productNames = productsWithOffsets.map(p => p.name);;
                //console.log("Loaded model's children:");
                model.traverse((child) => {
                    console.log(child.name); // This log helps you find the correct names!
                    if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    }
                    // If a child's name is in our list, add it to our targets array.
                    const productData = productsWithOffsets.find(p => p.name === child.name);
                    if (productData) {
                        // Store the object and its offset together
                        productTargets.push({ object: child, targetOffset: productData.targetOffset,cameraPosition:productData.cameraPosition });
                        
                    }
                });
                // It's better to sort them to ensure a consistent order
                // Sort based on the original array order to fix the scroll jumping issue.
                productTargets.sort((a, b) => productNames.indexOf(a.object.name) - productNames.indexOf(b.object.name));
                //console.log(productTargets,"productTargets");
                scene.add(model);
                // Hide the loader and set the initial camera position
                //loaderElement.style.display = 'none';
                if (productTargets.length > 0) {
                    focusCameraOnTarget(currentTargetIndex, 0); // Focus instantly on the first item
                } else {
                    console.error("Could not find any of the specified product models. Check the names.");
                    // Fallback: just look at the center if no products are found
                    camera.position.set(0, 5, 20);
                    controls.target.set(0, 0, 0);
                }
            },
            undefined,
            (error) => {
                console.error('Error loading glTF model:', error);
            }
        );
        
        parallaxGroup.add(model);
        scene.add(parallaxGroup);
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove); // Listener for the new parallax effect
    }

    // --- NEW: CAMERA ANIMATION FUNCTION ---
    function focusCameraOnTarget(targetIndex, duration = 2) { // Default duration of 1.2 seconds
        if (isAnimating && duration > 0) return;
                isAnimating = true;

                const { object, targetOffset,cameraPosition } = productTargets[targetIndex];
                const targetPosition = new THREE.Vector3();
                object.getWorldPosition(targetPosition);

                // --- APPLY THE OFFSET ---
                // The final camera target is the object's position plus its defined offset
                const finalTarget = new THREE.Vector3().addVectors(targetPosition,  targetOffset);
                console.log(cameraPosition," cameraOffset")
                // --- DUAL GSAP ANIMATION ---
                // Animate camera position and target simultaneously for a smooth, cinematic effect.
                const tl = gsap.timeline({
                    onComplete: () => { isAnimating = false; 
                        baseCameraPosition = cameraPosition;
                        console.log(baseCameraPosition," baseCameraPosition")
                    }
                });

                tl.to(camera.position, {
                    x: cameraPosition.x,
                    y: cameraPosition.y,
                    z: cameraPosition.z,
                    duration: duration,
                    ease: "power2.outIn"
                }, 0); // The '0' at the end makes it start at the same time as the next animation

                tl.to(controls.target, {
                    x: finalTarget.x,
                    y: finalTarget.y,
                    z: finalTarget.z,
                    duration: duration,
                    ease: "power2.outIn"
                }, 0); // Starts at the beginning of the timeline
                // gsap.to(camera.position, {
                //     x: cameraOffset.x,
                //     y: cameraOffset.y,
                //     z: cameraOffset.z,
                //     duration,
                //     ease: "power3.inOut"
                // });
                // console.log(camera.position," camera.position")

                // // Use GSAP for a smooth animation of the OrbitControls target
                // gsap.to(controls.target, {
                //     x: finalTarget.x,
                //     y: finalTarget.y,
                //     z: finalTarget.z,
                //     duration: duration,
                //     ease: "power3.inOut",
                //     onComplete: () => {
                //         //isAnimating = false;
                //         // --- SECONDARY "SETTLE" ANIMATION ---
                // // After the main animation, create a subtle movement for polish.
                // if (duration > 0) {
                //     gsap.to(controls.target, {
                //         x: `+=${Math.random() * 0.4 - 0.2}`, // Move slightly on x
                //         y: `+=${Math.random() * 0.4 - 0.2}`, // Move slightly on y
                //         duration: 0.8,
                //         ease: "power2.out",
                //         onComplete: () => { isAnimating = false; }
                //     });
                // } else {
                //     isAnimating = false;
                // }
                //     }
                // });
    }
    // --- NEW: SCROLL HANDLING FUNCTION ---
    function onWheel(event) {
        if (isAnimating || productTargets.length === 0) return; // Ignore scroll if an animation is playing

        // Determine scroll direction
        const scrollDirection = event.deltaY > 0 ? 1 : -1;

        currentTargetIndex += scrollDirection;

        // Loop back around if we go past the start or end
        if (currentTargetIndex >= productTargets.length) {
            currentTargetIndex = 0;
        } else if (currentTargetIndex < 0) {
            currentTargetIndex = productTargets.length - 1;
        }
        
        focusCameraOnTarget(currentTargetIndex);
    }
    function onResize() {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    }
    // This function updates the mouse coordinates for the parallax effect.
    function onMouseMove(event) {
        // Normalize mouse position from -1 to 1
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function animate()
    {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        if(!isAnimating)
        {
            // // 1) Parallax camera‐position shift (optional)
            const pf = 4;
            const targetX = baseCameraPosition.x + mouse.x * pf;
            const targetY = baseCameraPosition.y + mouse.y * pf;
            camera.position.x += (targetX - camera.position.x) * 0.05;
            camera.position.y += (targetY - camera.position.y) * 0.05;

            // 2) Tiny group rotations
            const pa = 1;
            const ty = mouse.x * pa, tx = mouse.y * pa;
            parallaxGroup.rotation.y += (ty - parallaxGroup.rotation.y) * 0.05;
            parallaxGroup.rotation.x += (tx - parallaxGroup.rotation.x) * 0.05;
        }

        
        
        
        controls.update();
        renderer.render(scene, camera);
    }