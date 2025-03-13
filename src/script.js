import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

var renderer, camera, scene, controls, Globe;

init();
loadJsonData();
onWindowResize();
animate();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    const loader = new THREE.TextureLoader();
    loader.load('./files/space_background.jpg', function (texture) {
        scene.background = texture;
    });

    var ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    var hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    scene.add(hemisphereLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 0, 400);
    scene.add(camera);

    var dLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dLight.position.set(-800, 2000, 400);
    scene.add(dLight);

    var dLight1 = new THREE.DirectionalLight(0xffffff, 1);
    dLight1.position.set(-200, 500, 200);
    scene.add(dLight1);

    var dLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dLight2.position.set(200, -500, -200);
    scene.add(dLight2);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 200;
    controls.maxDistance = 300;
    controls.autoRotate = false;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 2;

    window.addEventListener("resize", onWindowResize, false);
}

async function loadJsonData() {
    try {
        const countriesResponse = await fetch("./files/maps/countriesToday.json");
        const countries = await countriesResponse.json();

        const linesResponse = await fetch("./files/arcs/lines_2025.json");
        const lines = await linesResponse.json();

        initGlobe(countries);

        const arcsData = lines.arcs.map((arc) => ({
            startLat: arc.startLat,
            startLng: arc.startLong,
            endLat: arc.endLat,
            endLng: arc.endLong,
            thickness: arc.thickness,
            color: arc.color
        }));
        createArcs(arcsData);
    } catch (error) {
        console.error("Error loading JSON files:", error);
    }
}

function createCountryBorders(countries) {
    const borderMaterial = new THREE.LineBasicMaterial({ color: "#000000", linewidth: 1 });
    const bordersGroup = new THREE.Group();

    countries.features.forEach((country) => {
        const coordinates = country.geometry.coordinates;

        if (country.geometry.type === "Polygon") {
            coordinates.forEach((polygon) => {
                const points = polygon.map(([lng, lat]) => {
                    const phi = (90 - lat) * (Math.PI / 180);
                    const theta = (lng + 90) * (Math.PI / 180);
                    const radius = 101.1;
                    return new THREE.Vector3(
                        -radius * Math.sin(phi) * Math.cos(theta),
                        radius * Math.cos(phi),
                        radius * Math.sin(phi) * Math.sin(theta)
                    );
                });

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const borderLine = new THREE.Line(geometry, borderMaterial);
                bordersGroup.add(borderLine);
            });
        } else if (country.geometry.type === "MultiPolygon") {
            coordinates.forEach((multiPolygon) => {
                multiPolygon.forEach((polygon) => {
                    const points = polygon.map(([lng, lat]) => {
                        const phi = (90 - lat) * (Math.PI / 180);
                        const theta = (lng + 90) * (Math.PI / 180);
                        const radius = 101.1;
                        return new THREE.Vector3(
                            -radius * Math.sin(phi) * Math.cos(theta),
                            radius * Math.cos(phi),
                            radius * Math.sin(phi) * Math.sin(theta)
                        );
                    });

                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const borderLine = new THREE.Line(geometry, borderMaterial);
                    bordersGroup.add(borderLine);
                });
            });
        }
    });

    return bordersGroup;
}

function createLandingEffect(lat, lng, color) {
    Globe.ringsData([
        ...Globe.ringsData(),
        {
            lat: lat,
            lng: lng,
            maxRadius: 2,
            propagationSpeed: 1,
            repeatPeriod: 0,
            color: color,
        },
    ]);
}

function initGlobe(countries) {
    Globe = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
    })
        .polygonsData(countries.features)
        .polygonAltitude(0.01)
        .polygonCapColor(() => "#ffcf5c")
        .showAtmosphere(true)
        .atmosphereColor("#87CEEB")
        .atmosphereAltitude(0.25)
        .arcsData([])
        .arcColor((arc) => arc.color)
        .arcAltitudeAutoScale(0.5)
        .arcStroke((arc) => arc.stroke || 0.1)
        .arcDashLength(0.3)
        .arcDashInitialGap(2)
        .arcDashGap(1000)
        .arcDashAnimateTime(3000)
        .arcsTransitionDuration(2000)
        .ringsData([])
        .ringAltitude(0.01)
        .ringColor((ring) => ring.color)
        .ringMaxRadius(1.2)
        .ringPropagationSpeed(1)
        .ringRepeatPeriod(0)
        .ringResolution(64);

    const globeMaterial = Globe.globeMaterial();
    globeMaterial.color = new THREE.Color("#7fcdff");
    globeMaterial.emissive = new THREE.Color("#002244");
    globeMaterial.emissiveIntensity = 0.2;
    globeMaterial.shininess = 0.8;

    Globe.scale.set(100, 100, 100);
    scene.add(Globe);

    const borders = createCountryBorders(countries);
    scene.add(borders);
}

function createArcs(arcsData) {
    const arcsWithThickness = arcsData.map((arc) => ({
        ...arc,
        stroke: arc.thickness || 0.2,
        color: arc.color || "#000000"
    }));

    Globe.arcsData(arcsWithThickness);

    arcsWithThickness.forEach((arc) => {
        const arrivalTime = 6000;

        setTimeout(() => {
            createLandingEffect(arc.endLat, arc.endLng, arc.color || '#000000');
        }, arrivalTime);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}