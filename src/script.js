import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

var renderer, camera, scene, controls, mainGlobe, glowGlobe;
var countriesData, arcsData;
var arcsArray = [];
let countryCodeToName = {};

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

init();
loadJsonData(1951);
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
    controls.minDistance = 160;
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

    const timeSlider = document.getElementById("time-slider");
    timeSlider.addEventListener("input", debounce(() => {
        const year = timeSlider.value;
        document.getElementById("current-year").textContent = year;
        loadJsonData(year);
    }, 200));

    document.addEventListener("DOMContentLoaded", function () {
        const filtersDiv = document.getElementById("filters");
        const toggleButton = document.getElementById("toggle-filters");
    
        filtersDiv.style.display = "none";
        toggleButton.textContent = "Show Filters";
    
        toggleButton.addEventListener("click", function () {
            if (filtersDiv.style.display === "none" || filtersDiv.style.display === "") {
                filtersDiv.style.display = "block";
                toggleButton.textContent = "Hide Filters";
            } else {
                filtersDiv.style.display = "none";
                toggleButton.textContent = "Show Filters";
            }
        });
    });

    window.addEventListener('mousemove', onMouseMove, false);
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

async function loadJsonData(year) {
    try {
        if (1951 <= year <= 1959) {
            const countriesResponse = await fetch("./files/maps/countries1945.json");
            countriesData = await countriesResponse.json();
        } else if (1960 <= year <= 1993) {
            const countriesResponse = await fetch("./files/maps/countries1960.json");
            countriesData = await countriesResponse.json();
        } else if (1994 <= year <= 1999) {
            const countriesResponse = await fetch("./files/maps/countries1994.json");
            countriesData = await countriesResponse.json();
        } else if (2000 <= year <= 2010){
            const countriesResponse = await fetch("./files/maps/countries2000.json");
            countriesData = await countriesResponse.json();
        } else {
            const countriesResponse = await fetch("./files/maps/countriesToday.json");
            countriesData = await countriesResponse.json();
        }

        const mapResponse = await fetch("./files/map.json");
        const mapData = await mapResponse.json();

        mapData.coordinates.forEach((country) => {
            const code = country.text;
            const name = country.country;
            countryCodeToName[code] = name;
        });

        const linesResponse = await fetch(`./files/arcs/lines_${year}.json`);
        arcsData = await linesResponse.json();

        if (mainGlobe) {
            scene.remove(mainGlobe);
            scene.remove(glowGlobe);
        }

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
            count: arc.count,
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

    let filteredArcs = arcsData.arcs.filter(arc => {
        const startCountryName = countryCodeToName[arc.from];
        const endCountryName = countryCodeToName[arc.to];

        const isTransferIn = selectedCountries.includes(endCountryName) && showTransfersIn;
        const isTransferOut = selectedCountries.includes(startCountryName) && showTransfersOut;

        return isTransferIn || isTransferOut;
    });

    if (selectedCountries.length === 1) {
        const selectedCountry = selectedCountries[0];

        filteredArcs = filteredArcs.map(arc => {
            const endCountryName = countryCodeToName[arc.to];

            return {
                ...arc,
                color: endCountryName === selectedCountry ? "#00FF00" : "#FF0000",
            };
        });
    }

    const filteredArcsWithThickness = filteredArcs.map(arc => ({
        startLat: arc.startLat,
        startLng: arc.startLong,
        endLat: arc.endLat,
        endLng: arc.endLong,
        thickness: arc.thickness,
        color: arc.color,
        from: arc.from,
        to: arc.to,
        count: arc.count,
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
                    const radius = 100.7;
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
                        const radius = 100.7;
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
        .arcAltitudeAutoScale((arc) => arc.scale || 0.5)
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
        .arcAltitudeAutoScale((arc) => arc.scale || 0.5)
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
    arcsArray = [];

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
            stroke: (arc.thickness || 0.1) * 1.2,
            color: `rgba(${r}, ${g}, ${b}, 0.25)`,
        };
    });

    mainGlobe.arcsData(arcsWithThickness);
    glowGlobe.arcsData(glowArcs);

    arcsArray = mainGlobe.arcsData();
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

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredArc = null;

function latLonToVector3(lat, lon, radius = 1) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 90) * (Math.PI / 180);

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    let closestArc = null;
    let closestDistance = Infinity;

    arcsArray.forEach((arc) => {
        const start = latLonToVector3(arc.startLat, arc.startLng);
        const end = latLonToVector3(arc.endLat, arc.endLng);
        const midpoint = new THREE.Vector3().lerpVectors(start, end, 0.5);

        // Convert to screen coordinates
        const screenPosition = midpoint.clone().project(camera);

        // Convert to pixel space
        const screenX = (screenPosition.x + 1) * window.innerWidth / 2;
        const screenY = (1 - screenPosition.y) * window.innerHeight / 2;

        const distance = Math.sqrt(
            Math.pow(event.clientX - screenX, 2) +
            Math.pow(event.clientY - screenY, 2)
        );

        if (distance < closestDistance) {
            closestDistance = distance;
            closestArc = arc;
        }
    });

    if (closestArc && closestDistance < 30) {  // Adjust threshold based on pixel space
        if (hoveredArc !== closestArc) {
            hoveredArc = closestArc;
            showTooltip(closestArc, event.clientX, event.clientY);
        }
    } else {
        if (hoveredArc !== null) {
            hideTooltip();
            hoveredArc = null;
        }
    }
}
function showTooltip(arc) {
    const tooltip = document.getElementById('tooltip');
    const arcData = arc;

    const originCountry = countryCodeToName[arcData.from] || "Unknown";
    const destinationCountry = countryCodeToName[arcData.to] || "Unknown";
    const playerCount = arcData.count;

    tooltip.innerHTML = `
        <strong>From:</strong> ${originCountry}<br>
        <strong>To:</strong> ${destinationCountry}<br>
        <strong>Players:</strong> ${playerCount}
    `;

    tooltip.style.display = 'block';
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
}