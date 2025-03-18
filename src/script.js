import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

var renderer, camera, scene, controls, mainGlobe, glowGlobe;
var countriesData, arcsData;

const countryCodeToName = {
    POR: "Portugal",
    ESP: "Spain",
    FRA: "France",
    ING: "England",
    ITA: "Italy",
    PBA: "Netherlands",
    BEL: "Belgium",
    ALE: "Germany",
    TUR: "Turkey",
    ASA: "Saudi Arabia",
    CHI: "China",
    EUA: "USA",
    MEX: "Mexico",
    BRA: "Brazil",
    ARG: "Argentina",
};

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

    document.getElementById("applyFilter").addEventListener("click", applyFilter);

    const selectAllCheckbox = document.getElementById("selectAll");
    selectAllCheckbox.addEventListener("change", toggleAllCountries);

    const continentCheckboxes = document.querySelectorAll('.continent-checkbox');
    continentCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", toggleContinent);
    });
}

function toggleAllCountries(event) {
    const selectAllCheckbox = event.target;
    const countryCheckboxes = document.querySelectorAll('input[name="country"]');
    const continentCheckboxes = document.querySelectorAll('.continent-checkbox');

    countryCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    continentCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

function toggleContinent(event) {
    const continentCheckbox = event.target;
    const continentGroup = continentCheckbox.closest('.continent-group');
    const countryCheckboxes = continentGroup.querySelectorAll('input[name="country"]');

    countryCheckboxes.forEach(checkbox => {
        checkbox.checked = continentCheckbox.checked;
    });

    updateSelectAllCheckbox();
}

function updateSelectAllCheckbox() {
    const countryCheckboxes = document.querySelectorAll('input[name="country"]');
    const selectAllCheckbox = document.getElementById("selectAll");

    const allChecked = Array.from(countryCheckboxes).every(checkbox => checkbox.checked);
    selectAllCheckbox.checked = allChecked;
}

async function loadJsonData() {
    try {
        const countriesResponse = await fetch("./files/maps/countriesToday.json");
        countriesData = await countriesResponse.json();

        const linesResponse = await fetch("./files/arcs/lines_2025.json");
        arcsData = await linesResponse.json();

        initGlobe(countriesData);

        const arcsDataWithThickness = arcsData.arcs.map((arc) => ({
            startLat: arc.startLat,
            startLng: arc.startLong,
            endLat: arc.endLat,
            endLng: arc.endLong,
            thickness: arc.thickness,
            color: arc.color,
            from: arc.from,
            to: arc.to,
        }));
        createArcs(arcsDataWithThickness);
    } catch (error) {
        console.error("Error loading JSON files:", error);
    }
}

function applyFilter() {
    const selectedCountries = Array.from(document.querySelectorAll('input[name="country"]:checked')).map(checkbox => checkbox.value);

    const showTransfersIn = document.getElementById("showTransfersIn").checked;
    const showTransfersOut = document.getElementById("showTransfersOut").checked;

    const filteredArcs = arcsData.arcs.filter(arc => {
        const startCountryName = countryCodeToName[arc.from];
        const endCountryName = countryCodeToName[arc.to];

        const isTransferIn = selectedCountries.includes(endCountryName) && showTransfersIn;
        const isTransferOut = selectedCountries.includes(startCountryName) && showTransfersOut;

        return isTransferIn || isTransferOut;
    });

    console.log("Filtered Arcs:", filteredArcs);

    const filteredArcsWithThickness = filteredArcs.map((arc) => ({
        startLat: arc.startLat,
        startLng: arc.startLong,
        endLat: arc.endLat,
        endLng: arc.endLong,
        thickness: arc.thickness,
        color: arc.color,
    }));

    createArcs(filteredArcsWithThickness);
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
                    const radius = 100.6;
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
                        const radius = 100.6;
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

function initGlobe(countries) {
    glowGlobe = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
    })
        .arcsData([])
        .arcColor((arc) => arc.color || "#FF0000")
        .arcAltitudeAutoScale(0.5)
        .arcStroke((arc) => arc.stroke || 0.1)
        .arcDashLength(1)
        .arcDashGap(0)
        .arcDashAnimateTime(2000)
        .arcsTransitionDuration(1000);

    glowGlobe.scale.set(100, 100, 100);
    scene.add(glowGlobe);

    mainGlobe = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
    })
        .polygonsData(countries.features)
        .polygonAltitude(0.005)
        .polygonCapColor(() => "#002244")
        .polygonSideColor(() => "#01305a")
        .showAtmosphere(true)
        .atmosphereColor("#002244")
        .atmosphereAltitude(0.25)
        .arcsData([])
        .arcColor((arc) => arc.color || "#FF0000")
        .arcAltitudeAutoScale(0.5)
        .arcStroke((arc) => arc.stroke || 0.1)
        .arcDashLength(0.25)
        .arcDashGap(0.25)
        .arcDashAnimateTime(2000)
        .arcsTransitionDuration(1000);

    const globeMaterial = mainGlobe.globeMaterial();
    globeMaterial.color = new THREE.Color("#00000E");
    globeMaterial.emissive = new THREE.Color("#002244");
    globeMaterial.emissiveIntensity = 0.2;
    globeMaterial.shininess = 0.8;

    mainGlobe.scale.set(100, 100, 100);
    scene.add(mainGlobe);

    const borders = createCountryBorders(countries);
    scene.add(borders);
}

function createArcs(arcsData) {
    const arcsWithThickness = arcsData.map((arc) => ({
        ...arc,
        stroke: arc.thickness || 0.1,
    }));

    const glowArcs = arcsData.map((arc) => {
        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return { r, g, b };
        };

        const { r, g, b } = hexToRgb(arc.color);

        return {
            ...arc,
            stroke: (arc.thickness || 0.1) * 2,
            color: `rgba(${r}, ${g}, ${b}, 0.25)`,
        };
    });

    mainGlobe.arcsData(arcsWithThickness);
    glowGlobe.arcsData(glowArcs);
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