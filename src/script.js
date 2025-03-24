import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

var renderer, camera, scene, controls, mainGlobe, glowGlobe;
var countriesData, arcsData;
var arcsArray = [];
let countryCodeToName = {};
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredArc = null;
let globeInitialized = false;

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

init();
loadInitialData();
onWindowResize();
animate();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

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
        loadArcsForYear(year);
    }, 200));

    document.addEventListener("DOMContentLoaded", function () {
        const filtersDiv = document.getElementById("filters");
        const toggleButton = document.getElementById("toggle-filters");
    
        filtersDiv.style.display = "none";
        toggleButton.textContent = "Mostrar Filtros";
    
        toggleButton.addEventListener("click", function () {
            if (filtersDiv.style.display === "none" || filtersDiv.style.display === "") {
                filtersDiv.style.display = "block";
                toggleButton.textContent = "Esconder Filtros";
            } else {
                filtersDiv.style.display = "none";
                toggleButton.textContent = "Mostrar Filtros";
            }
        });
    });

    window.addEventListener('mousemove', onMouseMove, false);
}

// Load initial data and create the globe
async function loadInitialData() {
    try {
        // Load countries data (only need to do this once)
        const countriesResponse = await fetch("./files/maps/countriesToday.json");
        countriesData = await countriesResponse.json();

        // Load country code to name mapping
        const mapResponse = await fetch("./files/map.json");
        const mapData = await mapResponse.json();

        mapData.coordinates.forEach((country) => {
            const code = country.text;
            const name = country.country;
            countryCodeToName[code] = name;
        });

        // Initialize the globe with countries data
        initGlobe(countriesData);
        
        // Now load the initial arcs data for the starting year
        const initialYear = document.getElementById("time-slider").value || 1951;
        document.getElementById("current-year").textContent = initialYear;
        
        await loadArcsForYear(initialYear);
        
    } catch (error) {
        console.error("Error loading initial data:", error);
    }
}

// Load arcs data for a specific year
async function loadArcsForYear(year) {
    try {
        console.log(`Loading arcs for year: ${year}`);
        
        // Load the arcs data for this year
        const linesResponse = await fetch(`./files/arcs/lines_${year}.json`);
        arcsData = await linesResponse.json();

        // Process and display the arcs
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
        
        // Update the arcs without recreating the globe
        updateArcs(arcsDataWithThickness);
        
    } catch (error) {
        console.error(`Error loading arcs for year ${year}:`, error);
    }
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

function applyFilter() {
    const selectedCountries = Array.from(document.querySelectorAll('input[name="country"]:checked')).map(checkbox => checkbox.value);
    const allCountries = Array.from(document.querySelectorAll('input[name="country"]')).map(checkbox => checkbox.value);
    const allSelected = selectedCountries.length === allCountries.length;

    const showTransfersIn = document.getElementById("showTransfersIn").checked;
    const showTransfersOut = document.getElementById("showTransfersOut").checked;
    const showAllTransfers = showTransfersIn && showTransfersOut;

    // If all countries are selected and both transfer directions are checked, show all arcs
    if (allSelected && showAllTransfers) {
        console.log("Showing all arcs - all countries and directions selected");
        
        const allArcsWithThickness = arcsData.arcs.map((arc) => ({
            startLat: arc.startLat,
            startLng: arc.startLong,
            endLat: arc.endLat,
            endLng: arc.endLong,
            thickness: arc.thickness,
            color: arc.color || "#FF0000", // Default to red if no color specified
            from: arc.from,
            to: arc.to,
            count: arc.count,
            scale: 0.5, // Default scale
        }));
        
        updateArcs(allArcsWithThickness);
        return;
    }
    
    // If no transfer directions are selected, show no arcs
    if (!showTransfersIn && !showTransfersOut) {
        console.log("No transfer directions selected, showing no arcs");
        updateArcs([]);
        return;
    }

    // Create a reverse mapping from country names to country codes
    // This helps us match the selected country names with the country codes in the arcs
    const countryNameToCode = {};
    Object.entries(countryCodeToName).forEach(([code, name]) => {
        countryNameToCode[name] = code;
    });
    
    // Get country codes for the selected countries
    const selectedCountryCodes = selectedCountries.map(name => countryNameToCode[name]).filter(Boolean);
    console.log("Selected country codes:", selectedCountryCodes);
    
    // Filter arcs based on selected countries and transfer directions
    let filteredArcs = arcsData.arcs.filter(arc => {
        const isTransferIn = selectedCountryCodes.includes(arc.to) && showTransfersIn;
        const isTransferOut = selectedCountryCodes.includes(arc.from) && showTransfersOut;
        
        return isTransferIn || isTransferOut;
    });

    console.log(`Filtered to ${filteredArcs.length} arcs out of ${arcsData.arcs.length} total`);

    // If only one country is selected, color the arcs based on direction
    if (selectedCountryCodes.length === 1) {
        const selectedCountryCode = selectedCountryCodes[0];
        
        filteredArcs = filteredArcs.map(arc => {
            // If the arc ends in the selected country, it's an incoming transfer (green)
            // If the arc starts from the selected country, it's an outgoing transfer (red)
            const isIncoming = arc.to === selectedCountryCode;
            const color = isIncoming ? "#00FF00" : "#FF0000";
            
            return {
                ...arc,
                color: color
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
        scale: arc.color === "#00FF00" ? 0.3 : 0.5,
    }));

    updateArcs(filteredArcsWithThickness);
    
    // Reset hover state when filters are applied
    if (hoveredArc) {
        hoveredArc = null;
        hideTooltip();
    }
}

function createCountryBorders(countries) {
    const borderMaterial = new THREE.LineBasicMaterial({ color: "#d6dbdf", linewidth: 1 });
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
    if (globeInitialized) return; // Only initialize once
    
    console.log("Initializing globe");
    
    // Create glow globe
    glowGlobe = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
    })
        .showAtmosphere(false)
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

    // Create main globe
    mainGlobe = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
    })
        .polygonsData(countries.features)
        .polygonAltitude(0.005)
        .polygonCapColor(() => "#abb2b9")
        .polygonSideColor(() => "#abb2b9")
        .showAtmosphere(true)
        .atmosphereColor("#f8f9f9")
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
    globeMaterial.emissive = new THREE.Color("#f8f9f9");
    globeMaterial.emissiveIntensity = 0.2;
    globeMaterial.shininess = 0.8;

    mainGlobe.scale.set(100, 100, 100);
    scene.add(mainGlobe);

    const borders = createCountryBorders(countries);
    scene.add(borders);
    
    globeInitialized = true;
}

// Update only the arcs without recreating the globe
function updateArcs(arcsData) {
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

        const { r, g, b } = hexToRgb(arc.color || "#FF0000");

        return {
            ...arc,
            stroke: (arc.thickness || 0.1) * 1.2,
            color: `rgba(${r}, ${g}, ${b}, 0.25)`,
        };
    });

    // Update arcs with smooth transition
    mainGlobe.arcsData(arcsWithThickness);
    glowGlobe.arcsData(glowArcs);

    arcsArray = mainGlobe.arcsData();
    
    // Reset hover state when arcs are updated
    if (hoveredArc) {
        hoveredArc = null;
        hideTooltip();
    }
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

function latLonToVector3(lat, lon, radius = 100) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 90) * (Math.PI / 180);

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
}

// Generate points along an arc path with proper altitude
function generateArcPoints(startLat, startLng, endLat, endLng, scale, numPoints = 30) {
    const points = [];
    const start = latLonToVector3(startLat, startLng, 100);
    const end = latLonToVector3(endLat, endLng, 100);
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        // Create a point along the arc
        const point = new THREE.Vector3().lerpVectors(start, end, t);
        
        // Apply altitude curve to the point
        const altitude = scale || 0.5;
        const altitudeFactor = Math.sin(t * Math.PI) * altitude;
        const elevated = point.clone().normalize().multiplyScalar(100 * (1 + altitudeFactor * 0.4));
        
        points.push(elevated);
    }
    
    return points;
}

function onMouseMove(event) {
    // Update mouse coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    let closestArc = null;
    let closestDistance = Infinity;

    if (!arcsArray || arcsArray.length === 0) return;

    // Check each arc
    arcsArray.forEach((arc) => {
        // Generate more points along the arc for better detection
        const arcPoints = generateArcPoints(
            arc.startLat, 
            arc.startLng, 
            arc.endLat, 
            arc.endLng, 
            arc.scale,
            50 // Increased number of points for better detection
        );
        
        // Check each segment of the arc
        let minDistanceToArc = Infinity;
        
        for (let i = 0; i < arcPoints.length - 1; i++) {
            const start = arcPoints[i];
            const end = arcPoints[i + 1];
            
            // Project both points to screen space
            const startScreen = start.clone().project(camera);
            const endScreen = end.clone().project(camera);
            
            // Convert to screen coordinates
            const startX = (startScreen.x * 0.5 + 0.5) * window.innerWidth;
            const startY = (startScreen.y * -0.5 + 0.5) * window.innerHeight;
            const endX = (endScreen.x * 0.5 + 0.5) * window.innerWidth;
            const endY = (endScreen.y * -0.5 + 0.5) * window.innerHeight;
            
            // Calculate distance from mouse to this line segment in screen space
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            // Line segment distance calculation in 2D
            const A = mouseX - startX;
            const B = mouseY - startY;
            const C = endX - startX;
            const D = endY - startY;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            
            if (lenSq !== 0) {
                param = dot / lenSq;
            }
            
            let xx, yy;
            
            if (param < 0) {
                xx = startX;
                yy = startY;
            } else if (param > 1) {
                xx = endX;
                yy = endY;
            } else {
                xx = startX + param * C;
                yy = startY + param * D;
            }
            
            const dx = mouseX - xx;
            const dy = mouseY - yy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistanceToArc) {
                minDistanceToArc = distance;
            }
        }
        
        // If this arc is closer than previous closest, update
        if (minDistanceToArc < closestDistance) {
            closestDistance = minDistanceToArc;
            closestArc = arc;
        }
    });

    // Threshold for hover detection - increased for better usability
    const hoverThreshold = 10; // Increased threshold
    
    if (closestArc && closestDistance < hoverThreshold) {
        if (hoveredArc !== closestArc) {
            // Set new hovered arc
            hoveredArc = closestArc;
            
            // Show tooltip
            showTooltip(closestArc, event.clientX, event.clientY);
        } else {
            // Update tooltip position even if the arc hasn't changed
            updateTooltipPosition(event.clientX, event.clientY);
        }
    } else {
        if (hoveredArc !== null) {
            // Hide tooltip
            hideTooltip();
            hoveredArc = null;
        }
    }
}

// Add this new function to update tooltip position without changing content
function updateTooltipPosition(clientX, clientY) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip || tooltip.style.display === 'none') return;
    
    const offsetX = 15;
    const offsetY = 15;
    
    // Ensure tooltip stays within viewport
    const tooltipWidth = tooltip.offsetWidth || 150;
    const tooltipHeight = tooltip.offsetHeight || 80;
    
    const left = Math.min(clientX + offsetX, window.innerWidth - tooltipWidth - 5);
    const top = Math.min(clientY + offsetY, window.innerHeight - tooltipHeight - 5);
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function showTooltip(arc, clientX, clientY) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    const arcData = arc;
    const originCountry = countryCodeToName[arcData.from] || "Unknown";
    const destinationCountry = countryCodeToName[arcData.to] || "Unknown";
    const playerCount = arcData.count;

    tooltip.innerHTML = `
        <strong>Origem:</strong> ${originCountry}<br>
        <strong>Destino:</strong> ${destinationCountry}<br>
        <strong>Quantidade:</strong> ${playerCount}
    `;

    tooltip.style.display = 'block';
    updateTooltipPosition(clientX, clientY);
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}